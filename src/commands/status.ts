/**
 * Status command implementation
 * Displays CLI version, auth status, and API URL
 * Also supports job status inspection via `firecrawl status`
 */

import { Command } from 'commander';
import packageJson from '../../package.json';
import type { IContainer, ImmutableConfig } from '../container/types';
import { isAuthenticated } from '../utils/auth';
import { formatJson } from '../utils/command';
import { DEFAULT_API_URL } from '../utils/config';
import { loadCredentials } from '../utils/credentials';
import { listEmbedJobs, updateEmbedJob } from '../utils/embed-queue';
import { withTimeout } from '../utils/http';
import { isJobId } from '../utils/job';
import { getRecentJobIds, removeJobIds } from '../utils/job-history';
import { writeOutput } from '../utils/output';

type AuthSource = 'env' | 'stored' | 'none';

interface StatusResult {
  version: string;
  authenticated: boolean;
  authSource: AuthSource;
  apiUrl: string;
}

interface JobStatusOptions {
  apiKey?: string;
  crawl?: string;
  batch?: string;
  extract?: string;
  embed?: string | boolean;
  output?: string;
  json?: boolean;
  pretty?: boolean;
}

interface EmbedQueueSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Detect how the user is authenticated
 */
function getAuthSource(): AuthSource {
  if (process.env.FIRECRAWL_API_KEY) {
    return 'env';
  }
  const stored = loadCredentials();
  if (stored?.apiKey) {
    return 'stored';
  }
  return 'none';
}

/**
 * Get status information
 */
export function getStatus(config: ImmutableConfig): StatusResult {
  const authSource = getAuthSource();

  return {
    version: packageJson.version,
    authenticated: isAuthenticated(),
    authSource,
    apiUrl: config.apiUrl || DEFAULT_API_URL,
  };
}

/**
 * Handle status command output
 */
export async function handleStatusCommand(
  container: IContainer,
  _options: Record<string, unknown>
): Promise<void> {
  const orange = '\x1b[38;5;208m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const green = '\x1b[32m';
  const red = '\x1b[31m';

  const status = getStatus(container.config);

  // Header
  console.log('');
  console.log(
    `  ${orange}🔥 ${bold}firecrawl${reset} ${dim}cli${reset} ${dim}v${status.version}${reset}`
  );
  console.log('');

  // Auth status with source
  if (status.authenticated) {
    const sourceLabel =
      status.authSource === 'env'
        ? 'via FIRECRAWL_API_KEY'
        : 'via stored credentials';
    console.log(
      `  ${green}●${reset} Authenticated ${dim}${sourceLabel}${reset}`
    );
  } else {
    console.log(`  ${red}●${reset} Not authenticated`);
    console.log(`  ${dim}Run 'firecrawl login' to authenticate${reset}`);
    console.log('');
    return;
  }

  // API URL
  console.log(`  ${dim}API URL:${reset} ${status.apiUrl}`);
  console.log('');
}

function parseIds(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function filterValidJobIds(ids: string[]): string[] {
  return ids.filter((id) => isJobId(id));
}

function shouldPruneError(error: string | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes('job not found') ||
    normalized.includes('invalid job id')
  );
}

function summarizeEmbedQueue(): {
  summary: EmbedQueueSummary;
  jobs: Array<{
    id: string;
    jobId: string;
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retries: number;
    maxRetries: number;
    createdAt: string;
    updatedAt: string;
    lastError?: string;
    apiKey?: string;
  }>;
} {
  const jobs = listEmbedJobs();
  const summary: EmbedQueueSummary = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    if (job.status in summary) {
      summary[job.status as keyof EmbedQueueSummary] += 1;
    }
  }

  return { summary, jobs };
}

async function executeJobStatus(
  container: IContainer,
  options: JobStatusOptions
) {
  const client = container.getFirecrawlClient();
  const embedQueue = summarizeEmbedQueue();
  const crawlIds = parseIds(options.crawl);
  const batchIds = parseIds(options.batch);
  const extractIds = parseIds(options.extract);
  const embedJobIds = embedQueue.jobs.map((job) => job.jobId);

  const resolvedCrawlIds = filterValidJobIds(
    crawlIds.length > 0
      ? crawlIds
      : Array.from(
          new Set([...getRecentJobIds('crawl', 10), ...embedJobIds])
        ).slice(0, 10)
  );
  const resolvedBatchIds = filterValidJobIds(
    batchIds.length > 0 ? batchIds : getRecentJobIds('batch', 10)
  );
  const resolvedExtractIds = filterValidJobIds(
    extractIds.length > 0 ? extractIds : getRecentJobIds('extract', 10)
  );

  const STATUS_TIMEOUT_MS = 10000; // 10 second timeout per API call

  const activeCrawlsPromise = withTimeout(
    client.getActiveCrawls(),
    STATUS_TIMEOUT_MS,
    'getActiveCrawls timed out'
  ).catch(() => ({ success: false, crawls: [] }));

  // Disable auto-pagination for status checks - we only need summary, not all data
  const noPagination = { autoPaginate: false };

  const crawlStatusesPromise = Promise.all(
    resolvedCrawlIds.map(async (id) => {
      try {
        return await withTimeout(
          client.getCrawlStatus(id, noPagination),
          STATUS_TIMEOUT_MS,
          `getCrawlStatus(${id}) timed out`
        );
      } catch (error) {
        return {
          id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );
  const batchStatusesPromise = Promise.all(
    resolvedBatchIds.map(async (id) => {
      try {
        return await withTimeout(
          client.getBatchScrapeStatus(id, noPagination),
          STATUS_TIMEOUT_MS,
          `getBatchScrapeStatus(${id}) timed out`
        );
      } catch (error) {
        return {
          id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );
  const extractStatusesPromise = Promise.all(
    resolvedExtractIds.map(async (id) => {
      try {
        return await withTimeout(
          client.getExtractStatus(id),
          STATUS_TIMEOUT_MS,
          `getExtractStatus(${id}) timed out`
        );
      } catch (error) {
        return {
          id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const [activeCrawls, crawlStatuses, batchStatuses, extractStatuses] =
    await Promise.all([
      activeCrawlsPromise,
      crawlStatusesPromise,
      batchStatusesPromise,
      extractStatusesPromise,
    ]);

  const crawlPruneIds = crawlStatuses
    .filter((status) => shouldPruneError((status as { error?: string }).error))
    .map((status) => status.id)
    .filter((id): id is string => Boolean(id));
  const batchPruneIds = batchStatuses
    .filter((status) => shouldPruneError((status as { error?: string }).error))
    .map((status) => status.id)
    .filter((id): id is string => Boolean(id));
  const extractPruneIds = extractStatuses
    .filter((status) => shouldPruneError((status as { error?: string }).error))
    .map((status) => status.id)
    .filter((id): id is string => Boolean(id));

  removeJobIds('crawl', crawlPruneIds);
  removeJobIds('batch', batchPruneIds);
  removeJobIds('extract', extractPruneIds);

  const activeUrlById = new Map(
    activeCrawls.crawls.map((crawl) => [crawl.id, crawl.url])
  );
  const crawlSourceById = new Map<string, string>();
  for (const crawl of crawlStatuses) {
    const maybeData = (
      crawl as {
        data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
      }
    ).data;
    const sourceUrl = Array.isArray(maybeData)
      ? (maybeData[0]?.metadata?.sourceURL ?? maybeData[0]?.metadata?.url)
      : undefined;
    const displayUrl = sourceUrl ?? activeUrlById.get(crawl.id);
    if (displayUrl && crawl.id) {
      crawlSourceById.set(crawl.id, displayUrl);
      (crawl as { url?: string }).url = displayUrl;
    }
  }

  for (const job of embedQueue.jobs) {
    const sourceUrl = crawlSourceById.get(job.jobId);
    if (sourceUrl && job.url.includes('/v2/crawl/')) {
      job.url = sourceUrl;
      updateEmbedJob(job);
    }
  }

  const embedJobId = typeof options.embed === 'string' ? options.embed : null;
  const embedJob = embedJobId
    ? embedQueue.jobs.find((job) => job.jobId === embedJobId)
    : null;
  const failedEmbeds = embedQueue.jobs
    .filter((job) => job.status === 'failed')
    .map((job) => ({
      jobId: job.jobId,
      url: job.url,
      retries: job.retries,
      lastError: job.lastError,
      updatedAt: job.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);
  const pendingEmbeds = embedQueue.jobs
    .filter((job) => job.status === 'pending')
    .map((job) => ({
      jobId: job.jobId,
      url: job.url,
      retries: job.retries,
      maxRetries: job.maxRetries,
      updatedAt: job.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);
  const completedEmbeds = embedQueue.jobs
    .filter((job) => job.status === 'completed')
    .map((job) => ({
      jobId: job.jobId,
      url: job.url,
      updatedAt: job.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);

  // Sort by ID descending (ULIDs are lexicographically sortable by timestamp)
  const sortedCrawls = crawlStatuses
    .sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''))
    .slice(0, 10);
  const sortedBatches = batchStatuses
    .sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''))
    .slice(0, 10);
  const sortedExtracts = extractStatuses
    .sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''))
    .slice(0, 10);

  return {
    activeCrawls,
    crawls: sortedCrawls,
    batches: sortedBatches,
    extracts: sortedExtracts,
    resolvedIds: {
      crawls: resolvedCrawlIds,
      batches: resolvedBatchIds,
      extracts: resolvedExtractIds,
    },
    embeddings: {
      summary: embedQueue.summary,
      job: embedJob ?? undefined,
      failed: failedEmbeds,
      pending: pendingEmbeds,
      completed: completedEmbeds,
    },
  };
}

function getStatusIcon(status: string, error?: string): string {
  if (error) return '✗';
  switch (status) {
    case 'completed':
      return '✓';
    case 'scraping':
    case 'processing':
      return '⏳';
    case 'failed':
      return '✗';
    default:
      return '•';
  }
}

function getStatusColor(status: string, error?: string): string {
  const isTTY = process.stdout.isTTY;
  if (!isTTY) return '';

  if (error) return '\x1b[31m'; // red
  switch (status) {
    case 'completed':
      return '\x1b[32m'; // green
    case 'scraping':
    case 'processing':
      return '\x1b[33m'; // yellow
    case 'failed':
      return '\x1b[31m'; // red
    default:
      return '\x1b[36m'; // cyan
  }
}

function formatProgress(completed: number, total: number): string {
  const isTTY = process.stdout.isTTY;
  if (!isTTY) return `${completed}/${total}`;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barWidth = 20;
  const filled = Math.round((completed / total) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  return `${bar} ${percentage}% (${completed}/${total})`;
}

function renderHumanStatus(data: Awaited<ReturnType<typeof executeJobStatus>>) {
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const isTTY = process.stdout.isTTY;

  const color = (code: string, text: string) =>
    isTTY ? `${code}${text}${reset}` : text;

  console.log('');
  console.log(color(bold, 'Crawls'));
  if (data.activeCrawls.crawls.length === 0) {
    console.log(color(dim, '  No active crawls.'));
  } else {
    for (const crawl of data.activeCrawls.crawls) {
      console.log(`  ${color('\x1b[33m', '⏳')} ${crawl.id} ${crawl.url}`);
    }
  }

  if (data.crawls.length > 0) {
    console.log('');
    console.log(color(bold, 'Crawl Status'));
    const activeUrlById = new Map(
      data.activeCrawls.crawls.map((crawl) => [crawl.id, crawl.url])
    );
    for (const crawl of data.crawls) {
      const crawlError = (crawl as { error?: string }).error;
      const crawlData = (
        crawl as {
          data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
        }
      ).data;
      const sourceUrl = Array.isArray(crawlData)
        ? (crawlData[0]?.metadata?.sourceURL ?? crawlData[0]?.metadata?.url)
        : undefined;
      const displayUrl = sourceUrl ?? activeUrlById.get(crawl.id);
      const icon = getStatusIcon(crawl.status ?? 'unknown', crawlError);
      const statusColor = getStatusColor(crawl.status ?? 'unknown', crawlError);

      if (crawlError) {
        const suffix = displayUrl ? ` ${color(dim, displayUrl)}` : '';
        console.log(
          `  ${color(statusColor, icon)} ${crawl.id} ${color(statusColor, 'error')} ${color(dim, `(${crawlError})`)}${suffix}`
        );
      } else if ('completed' in crawl && 'total' in crawl) {
        const progress = formatProgress(
          crawl.completed as number,
          crawl.total as number
        );
        console.log(
          `  ${color(statusColor, icon)} ${crawl.id} ${color(statusColor, crawl.status)} ${progress}${displayUrl ? ` ${color(dim, displayUrl)}` : ''}`
        );
      } else {
        console.log(
          `  ${color(statusColor, icon)} ${crawl.id} ${color(statusColor, crawl.status ?? 'unknown')}${displayUrl ? ` ${color(dim, displayUrl)}` : ''}`
        );
      }
    }
  } else if (data.resolvedIds.crawls.length === 0) {
    console.log('');
    console.log(color(bold, 'Crawl Status'));
    console.log(color(dim, '  No recent crawl job IDs found.'));
  }

  console.log('');
  console.log(color(bold, 'Batch Status'));
  if (data.batches.length === 0) {
    console.log(color(dim, '  No recent batch job IDs found.'));
  } else {
    for (const batch of data.batches) {
      const batchError = (batch as { error?: string }).error;
      const icon = getStatusIcon(batch.status ?? 'unknown', batchError);
      const statusColor = getStatusColor(batch.status ?? 'unknown', batchError);

      if (batchError) {
        console.log(
          `  ${color(statusColor, icon)} ${batch.id} ${color(statusColor, 'error')} ${color(dim, `(${batchError})`)}`
        );
      } else if ('completed' in batch && 'total' in batch) {
        const progress = formatProgress(
          batch.completed as number,
          batch.total as number
        );
        console.log(
          `  ${color(statusColor, icon)} ${batch.id} ${color(statusColor, batch.status)} ${progress}`
        );
      } else {
        console.log(
          `  ${color(statusColor, icon)} ${batch.id} ${color(statusColor, batch.status ?? 'unknown')}`
        );
      }
    }
  }

  console.log('');
  console.log(color(bold, 'Extract Status'));
  if (data.extracts.length === 0) {
    console.log(color(dim, '  No recent extract job IDs found.'));
  } else {
    for (const extract of data.extracts) {
      const extractError = (extract as { error?: string }).error;
      const icon = getStatusIcon(extract.status ?? 'unknown', extractError);
      const statusColor = getStatusColor(
        extract.status ?? 'unknown',
        extractError
      );

      if (extractError) {
        console.log(
          `  ${color(statusColor, icon)} ${extract.id} ${color(statusColor, 'error')} ${color(dim, `(${extractError})`)}`
        );
      } else {
        console.log(
          `  ${color(statusColor, icon)} ${extract.id} ${color(statusColor, extract.status ?? 'unknown')}`
        );
      }
    }
  }

  console.log('');
  console.log(color(bold, 'Embeddings'));
  const summary = data.embeddings.summary;
  const total =
    summary.pending + summary.processing + summary.completed + summary.failed;
  if (total === 0) {
    console.log(color(dim, '  No embedding jobs found.'));
  } else {
    const stats = [
      `${color('\x1b[33m', '⏳')} pending ${summary.pending}`,
      `${color('\x1b[36m', '⏳')} processing ${summary.processing}`,
      `${color('\x1b[32m', '✓')} completed ${summary.completed}`,
      `${color('\x1b[31m', '✗')} failed ${summary.failed}`,
    ];
    console.log(`  ${stats.join(' | ')}`);
  }

  if (data.embeddings.job) {
    const job = data.embeddings.job;
    const statusColor = getStatusColor(job.status);
    const icon = getStatusIcon(job.status);
    console.log(
      `  ${color(statusColor, icon)} job ${job.jobId} ${color(statusColor, job.status)} ${color(dim, `(retries ${job.retries}/${job.maxRetries})`)}`
    );
    if (job.lastError) {
      console.log(`  ${color('\x1b[31m', `last error: ${job.lastError}`)}`);
    }
  }

  console.log(`  ${color(dim, 'Failed embeds:')}`);
  if (data.embeddings.failed.length === 0) {
    console.log(color(dim, '    No failed embedding jobs.'));
  } else {
    for (const job of data.embeddings.failed) {
      console.log(
        `    ${color('\x1b[31m', '✗')} ${job.jobId} ${color('\x1b[31m', job.lastError ?? 'Unknown error')}`
      );
    }
  }

  const activeUrlById = new Map(
    data.activeCrawls.crawls.map((crawl) => [crawl.id, crawl.url])
  );
  const crawlUrlById = new Map(activeUrlById);
  for (const crawl of data.crawls) {
    const maybeData = (
      crawl as {
        data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
      }
    ).data;
    const sourceUrl = Array.isArray(maybeData)
      ? (maybeData[0]?.metadata?.sourceURL ?? maybeData[0]?.metadata?.url)
      : undefined;
    if (sourceUrl && crawl.id) {
      crawlUrlById.set(crawl.id, sourceUrl);
    }
  }

  console.log(`  ${color(dim, 'Pending embeds:')}`);
  if (data.embeddings.pending.length === 0) {
    console.log(color(dim, '    No pending embedding jobs.'));
  } else {
    for (const job of data.embeddings.pending) {
      const displayUrl = crawlUrlById.get(job.jobId) ?? job.url;
      console.log(
        `    ${color('\x1b[33m', '⏳')} ${job.jobId} ${color(dim, `(${job.retries}/${job.maxRetries})`)} ${color(dim, displayUrl)}`
      );
    }
  }

  console.log(`  ${color(dim, 'Completed embeds:')}`);
  if (data.embeddings.completed.length === 0) {
    console.log(color(dim, '    No completed embedding jobs.'));
  } else {
    for (const job of data.embeddings.completed) {
      const displayUrl = crawlUrlById.get(job.jobId) ?? job.url;
      console.log(
        `    ${color('\x1b[32m', '✓')} ${job.jobId} ${color(dim, displayUrl)}`
      );
    }
  }
  console.log('');
}

export async function handleJobStatusCommand(
  container: IContainer,
  options: JobStatusOptions
): Promise<void> {
  try {
    const data = await executeJobStatus(container, options);
    const wantsJson = options.json || options.pretty || options.output;
    if (!wantsJson) {
      renderHumanStatus(data);
      return;
    }

    const { embeddings, ...rest } = data;
    const { completed: _completed, ...embeddingsWithoutCompleted } = embeddings;
    const outputContent = formatJson(
      {
        success: true,
        data: {
          ...rest,
          embeddings: embeddingsWithoutCompleted,
        },
      },
      options.pretty ?? false
    );
    writeOutput(outputContent, options.output, !!options.output);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * UX Pattern Note:
 * Actions on resources should use subcommands (e.g., `firecrawl embed cancel <id>`)
 * rather than option flags (e.g., `--cancel-embed <id>`). This provides:
 * - Better discoverability via help text
 * - Clearer intent and semantics
 * - Follows standard CLI patterns (resource action target)
 * - Avoids cluttering status/info commands with action flags
 */
export function createStatusCommand(): Command {
  const statusCmd = new Command('status')
    .description('Show active jobs and embedding queue status')
    .option('-k, --api-key <key>', 'Firecrawl API key override')
    .option('--crawl <job-ids>', 'Comma-separated crawl job IDs to check')
    .option('--batch <job-ids>', 'Comma-separated batch job IDs to check')
    .option('--extract <job-ids>', 'Comma-separated extract job IDs to check')
    .option(
      '--embed [job-id]',
      'Show embedding queue status (optionally for job ID)'
    )
    .option('--json', 'Output JSON (compact)', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleJobStatusCommand(container, {
        apiKey: options.apiKey,
        crawl: options.crawl,
        batch: options.batch,
        extract: options.extract,
        embed: options.embed,
        output: options.output,
        json: options.json,
        pretty: options.pretty,
      });
    });

  return statusCmd;
}
