/**
 * Background embedder for async, resilient embedding
 *
 * Processes embedding queue in the background with retries and exponential backoff.
 * Can be spawned as a detached process or run inline.
 */

import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';
import type { Document } from '@mendable/firecrawl-js';
import { createDaemonContainer } from '../container/DaemonContainerFactory';
import type { IContainer } from '../container/types';
import {
  cleanupOldJobs,
  type EmbedJob,
  getEmbedJob,
  getPendingJobs,
  getStalePendingJobs,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
  updateEmbedJob,
} from './embed-queue';
import {
  EMBEDDER_WEBHOOK_HEADER,
  extractEmbedderWebhookJobInfo,
  getEmbedderWebhookSettings,
} from './embedder-webhook';
import { batchEmbed, createEmbedItems } from './embedpipeline';

const POLL_INTERVAL_MS = 10000; // 10 seconds (retry base)
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60000; // 1 minute

/**
 * Calculate backoff delay with exponential backoff
 */
function getBackoffDelay(retries: number): number {
  const delay = Math.min(
    POLL_INTERVAL_MS * BACKOFF_MULTIPLIER ** retries,
    MAX_BACKOFF_MS
  );
  return delay;
}

/**
 * Process a single embedding job
 */
async function processEmbedJob(
  container: IContainer,
  job: EmbedJob,
  crawlStatus?: { status?: string; data?: Document[] }
): Promise<void> {
  console.error(
    `[Embedder] Processing job ${job.jobId} (attempt ${job.retries + 1}/${job.maxRetries})`
  );

  try {
    markJobProcessing(job.jobId);

    // Create job-specific container with job's API key
    const jobContainer = createDaemonContainer({
      apiKey: job.apiKey,
    });

    // Check if TEI/Qdrant are configured
    if (!jobContainer.config.teiUrl || !jobContainer.config.qdrantUrl) {
      throw new Error(
        'TEI_URL or QDRANT_URL not configured - skipping embedding'
      );
    }

    // Get crawl status and data (from webhook or API)
    const client = jobContainer.getFirecrawlClient();
    const status = crawlStatus?.status
      ? crawlStatus
      : await client.getCrawlStatus(job.jobId);

    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(`Crawl ${status.status}, cannot embed`);
    }

    if (status.status !== 'completed') {
      // Still processing, re-queue for later
      console.error(
        `[Embedder] Job ${job.jobId} still ${status.status}, will retry later`
      );
      throw new Error(`Crawl still ${status.status}`);
    }

    // Extract pages
    let pages: Document[] = Array.isArray(status.data)
      ? status.data
      : Array.isArray(crawlStatus?.data)
        ? crawlStatus.data
        : [];

    if (pages.length === 0 && status.status === 'completed') {
      const refreshed = await client.getCrawlStatus(job.jobId);
      pages = Array.isArray(refreshed.data) ? refreshed.data : [];
    }

    if (pages.length === 0) {
      console.error(`[Embedder] Job ${job.jobId} has no pages to embed`);
      markJobCompleted(job.jobId);
      return;
    }

    // Embed pages using job-specific container config
    console.error(`[Embedder] Embedding ${pages.length} pages for ${job.url}`);
    const embedItems = createEmbedItems(pages, 'crawl');
    await batchEmbed(embedItems);
    // Note: batchEmbed still uses legacy getConfig() internally
    // This is acceptable for daemon backward compatibility

    console.error(
      `[Embedder] Successfully embedded ${pages.length} pages for ${job.url}`
    );
    markJobCompleted(job.jobId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Embedder] Job ${job.jobId} failed:`, errorMsg);
    markJobFailed(job.jobId, errorMsg);

    // Apply backoff for next retry
    if (job.retries + 1 < job.maxRetries) {
      const delay = getBackoffDelay(job.retries);
      console.error(`[Embedder] Will retry in ${delay / 1000}s`);
    }
  }
}

/**
 * Process all pending jobs in the queue
 */
export async function processEmbedQueue(container: IContainer): Promise<void> {
  const pendingJobs = getPendingJobs();

  if (pendingJobs.length === 0) {
    return;
  }

  console.error(`[Embedder] Processing ${pendingJobs.length} pending jobs`);

  // Process jobs sequentially to avoid overwhelming TEI/Qdrant
  for (const job of pendingJobs) {
    await processEmbedJob(container, job);
  }
}

/**
 * Process stale pending jobs once, returning count processed.
 */
export async function processStaleJobsOnce(
  container: IContainer,
  maxAgeMs: number
): Promise<number> {
  const staleJobs = getStalePendingJobs(maxAgeMs);
  if (staleJobs.length === 0) {
    return 0;
  }

  console.error(`[Embedder] Processing ${staleJobs.length} stale jobs`);
  for (const job of staleJobs) {
    await processEmbedJob(container, job);
  }

  return staleJobs.length;
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

async function handleWebhookPayload(
  container: IContainer,
  payload: unknown
): Promise<void> {
  const info = extractEmbedderWebhookJobInfo(payload);
  if (!info) {
    console.error('[Embedder] Webhook payload missing job ID');
    return;
  }

  const job = getEmbedJob(info.jobId);
  if (!job) {
    console.error(`[Embedder] Webhook for unknown job: ${info.jobId}`);
    return;
  }

  if (job.status === 'completed') {
    return;
  }

  const status = info.status?.toLowerCase();
  if (status === 'failed' || status === 'cancelled') {
    job.status = 'failed';
    job.retries = job.maxRetries;
    job.lastError = `Crawl ${status}`;
    updateEmbedJob(job);
    return;
  }

  if (status !== 'completed') {
    console.error(
      `[Embedder] Ignoring webhook for ${info.jobId} with status ${info.status}`
    );
    return;
  }

  await processEmbedJob(container, job, {
    status: 'completed',
    data: info.pages,
  });
}

async function startEmbedderWebhookServer(
  container: IContainer
): Promise<void> {
  const settings = getEmbedderWebhookSettings(container.config);
  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');

    // Health check endpoint for daemon detection
    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'embedder-daemon' }));
      return;
    }

    if (req.method !== 'POST' || requestUrl.pathname !== settings.path) {
      res.statusCode = req.method === 'POST' ? 404 : 405;
      res.end();
      return;
    }

    if (settings.secret) {
      const provided = req.headers[EMBEDDER_WEBHOOK_HEADER];

      // Type check and validate provided secret
      if (!provided || typeof provided !== 'string') {
        res.statusCode = 401;
        res.end();
        return;
      }

      // Convert to buffers for timing-safe comparison
      const providedBuf = Buffer.from(provided, 'utf8');
      const secretBuf = Buffer.from(settings.secret, 'utf8');

      // Length check before comparison (timingSafeEqual requires equal lengths)
      if (providedBuf.length !== secretBuf.length) {
        res.statusCode = 401;
        res.end();
        return;
      }

      // Use constant-time comparison to prevent timing attacks
      try {
        if (!timingSafeEqual(providedBuf, secretBuf)) {
          res.statusCode = 401;
          res.end();
          return;
        }
      } catch {
        // timingSafeEqual can throw if lengths don't match (shouldn't happen due to check above)
        res.statusCode = 401;
        res.end();
        return;
      }
    }

    try {
      const payload = await readJsonBody(req);
      void handleWebhookPayload(container, payload);
      res.statusCode = 202;
      res.end();
    } catch (error) {
      console.error('[Embedder] Failed to parse webhook payload:', error);
      res.statusCode = 400;
      res.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.port, '0.0.0.0', () => resolve());
  });

  const localUrl = `http://localhost:${settings.port}${settings.path}`;
  console.error(`[Embedder] Webhook server listening on ${localUrl}`);

  if (!settings.url) {
    console.error(
      '[Embedder] FIRECRAWL_EMBEDDER_WEBHOOK_URL not set; configure a public URL to receive crawl completion events.'
    );
  }
}

/**
 * Start background embedder daemon
 *
 * Runs webhook server and processes jobs on completion events.
 */
export async function startEmbedderDaemon(
  container: IContainer
): Promise<void> {
  console.error('[Embedder] Starting background embedder daemon');

  // Clean up old jobs on startup
  const cleaned = cleanupOldJobs(24);
  if (cleaned > 0) {
    console.error(`[Embedder] Cleaned up ${cleaned} old jobs`);
  }

  await startEmbedderWebhookServer(container);

  const staleMinutes = Number.parseFloat(
    process.env.FIRECRAWL_EMBEDDER_STALE_MINUTES ?? '10'
  );
  const staleMs =
    Number.isFinite(staleMinutes) && staleMinutes > 0
      ? staleMinutes * 60_000
      : 10 * 60_000;
  const intervalMs = Math.max(60_000, Math.floor(staleMs / 2));

  console.error(
    `[Embedder] Checking for stale jobs every ${Math.round(intervalMs / 1000)}s (stale after ${Math.round(staleMs / 1000)}s)`
  );

  void processStaleJobsOnce(container, staleMs).catch((error) => {
    console.error('[Embedder] Failed to process stale jobs:', error);
  });

  setInterval(() => {
    void processStaleJobsOnce(container, staleMs).catch((error) => {
      console.error('[Embedder] Failed to process stale jobs:', error);
    });
  }, intervalMs);
}

/**
 * Spawn background embedder as detached process
 *
 * Returns immediately, embedder runs in background.
 */
export function spawnBackgroundEmbedder(): void {
  // Get the path to the embedder script
  const scriptPath = join(__dirname, '..', '..', 'dist', 'embedder-daemon.js');

  // Spawn detached process
  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();

  console.error('[Embedder] Background embedder spawned');
}

/**
 * Check if embedder daemon is running
 *
 * Attempts to connect to the webhook server to verify daemon is responsive.
 */
export async function isEmbedderRunning(
  container?: IContainer
): Promise<boolean> {
  const settings = getEmbedderWebhookSettings(container?.config);

  try {
    // Attempt HTTP GET to webhook server (should return 405 Method Not Allowed)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`http://localhost:${settings.port}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Any response (even 404/405) means daemon is running
    return response.status !== undefined;
  } catch (error) {
    // Connection refused, timeout, or network error means daemon is not running
    return false;
  }
}
