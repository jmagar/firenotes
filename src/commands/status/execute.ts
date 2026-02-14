/**
 * Data fetching and execution logic for the status command
 */

import type { IContainer } from '../../container/types';
import {
  cleanupOldJobs,
  listEmbedJobs,
  updateEmbedJob,
} from '../../utils/embed-queue';
import { withTimeout } from '../../utils/http';
import { isJobId } from '../../utils/job';
import { getRecentJobIds, removeJobIds } from '../../utils/job-history';
import type {
  EmbedJobBase,
  EmbedQueueSummary,
  FailedEmbed,
  JobStatusData,
  JobStatusOptions,
  PendingEmbed,
  RawEmbedJob,
} from './types';

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

/**
 * Extract job IDs that should be pruned from a list of statuses
 */
function extractPruneIds<T extends { id?: string; error?: string }>(
  statuses: T[]
): string[] {
  return statuses
    .filter((status) => shouldPruneError(status.error))
    .map((status) => status.id)
    .filter((id): id is string => Boolean(id));
}

async function summarizeEmbedQueue(): Promise<{
  summary: EmbedQueueSummary;
  jobs: RawEmbedJob[];
}> {
  const jobs = await listEmbedJobs();
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

/**
 * Fetches job statuses from the Firecrawl API in parallel
 */
async function fetchJobStatuses(
  client: ReturnType<IContainer['getFirecrawlClient']>,
  resolvedIds: {
    crawls: string[];
    batches: string[];
    extracts: string[];
  }
) {
  const STATUS_TIMEOUT_MS = 10000;
  const noPagination = { autoPaginate: false };

  const activeCrawlsPromise = withTimeout(
    client.getActiveCrawls(),
    STATUS_TIMEOUT_MS,
    'getActiveCrawls timed out'
  ).catch(() => ({ success: false, crawls: [] }));

  const crawlStatusesPromise = Promise.all(
    resolvedIds.crawls.map(async (id) => {
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
    resolvedIds.batches.map(async (id) => {
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
    resolvedIds.extracts.map(async (id) => {
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

  return {
    activeCrawls,
    crawlStatuses,
    batchStatuses,
    extractStatuses,
  };
}

/**
 * Builds a map of crawl IDs to their source URLs
 */
function buildCrawlSourceMap(
  activeCrawls: { crawls: Array<{ id: string; url: string }> },
  crawlStatuses: Array<{
    id: string;
    status?: string;
    data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
  }>
): Map<string, string> {
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

  return crawlSourceById;
}

/**
 * Updates embed job URLs in batch
 */
async function updateEmbedJobUrls(
  jobs: RawEmbedJob[],
  crawlSourceById: Map<string, string>
): Promise<void> {
  const jobsToUpdate = jobs.filter((job) => {
    const sourceUrl = crawlSourceById.get(job.jobId);
    return sourceUrl && job.url.includes('/v2/crawl/');
  });

  await Promise.all(
    jobsToUpdate.map(async (job) => {
      const sourceUrl = crawlSourceById.get(job.jobId);
      if (sourceUrl) {
        job.url = sourceUrl;
        await updateEmbedJob(job);
      }
    })
  );
}

/**
 * Filters and sorts embed jobs by status, returning top 10
 */
function filterAndSortEmbeds<T extends { status: string; updatedAt: string }>(
  jobs: T[],
  status: string
): T[] {
  return jobs
    .filter((job) => job.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);
}

/**
 * Formats job lists for output (sorts by ID descending, takes top 10)
 */
function formatJobsForDisplay<
  T extends { id?: string; status?: string },
  U extends { id?: string; status?: string },
  V extends { id?: string; status?: string },
>(crawlStatuses: Array<T>, batchStatuses: Array<U>, extractStatuses: Array<V>) {
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
    crawls: sortedCrawls,
    batches: sortedBatches,
    extracts: sortedExtracts,
  };
}

export async function executeJobStatus(
  container: IContainer,
  options: JobStatusOptions
): Promise<JobStatusData> {
  const client = container.getFirecrawlClient();

  // Clean up old completed/failed embed jobs (older than 1 hour)
  await cleanupOldJobs(1);

  const embedQueue = await summarizeEmbedQueue();
  const crawlIds = parseIds(options.crawl);
  const batchIds = parseIds(options.batch);
  const extractIds = parseIds(options.extract);

  // Only include pending/processing embed jobs in crawl status checks
  const activeEmbedJobIds = embedQueue.jobs
    .filter((job) => job.status === 'pending' || job.status === 'processing')
    .map((job) => job.jobId);

  const recentCrawlIds = await getRecentJobIds('crawl', 10);
  const recentBatchIds = await getRecentJobIds('batch', 10);
  const recentExtractIds = await getRecentJobIds('extract', 10);

  const resolvedCrawlIds = filterValidJobIds(
    crawlIds.length > 0
      ? crawlIds
      : Array.from(new Set([...recentCrawlIds, ...activeEmbedJobIds])).slice(
          0,
          10
        )
  );
  const resolvedBatchIds = filterValidJobIds(
    batchIds.length > 0 ? batchIds : recentBatchIds
  );
  const resolvedExtractIds = filterValidJobIds(
    extractIds.length > 0 ? extractIds : recentExtractIds
  );

  // Fetch all job statuses in parallel
  const { activeCrawls, crawlStatuses, batchStatuses, extractStatuses } =
    await fetchJobStatuses(client, {
      crawls: resolvedCrawlIds,
      batches: resolvedBatchIds,
      extracts: resolvedExtractIds,
    });

  // Prune invalid job IDs from history
  const crawlPruneIds = extractPruneIds(crawlStatuses);
  const batchPruneIds = extractPruneIds(batchStatuses);
  const extractStatusPruneIds = extractPruneIds(extractStatuses);

  await removeJobIds('crawl', crawlPruneIds);
  await removeJobIds('batch', batchPruneIds);
  await removeJobIds('extract', extractStatusPruneIds);

  // Build source URL mapping and update embed job URLs in batch
  const crawlSourceById = buildCrawlSourceMap(activeCrawls, crawlStatuses);
  await updateEmbedJobUrls(embedQueue.jobs, crawlSourceById);

  // Find specific embed job if requested
  const embedJobId = typeof options.embed === 'string' ? options.embed : null;
  const embedJob = embedJobId
    ? embedQueue.jobs.find((job) => job.jobId === embedJobId)
    : null;

  const failedEmbeds = filterAndSortEmbeds(embedQueue.jobs, 'failed').map(
    (job): FailedEmbed => ({
      jobId: job.jobId,
      url: job.url,
      retries: job.retries,
      maxRetries: job.maxRetries,
      lastError: job.lastError,
      updatedAt: job.updatedAt,
      totalDocuments: job.totalDocuments,
      processedDocuments: job.processedDocuments,
      failedDocuments: job.failedDocuments,
    })
  );

  const pendingEmbeds = filterAndSortEmbeds(embedQueue.jobs, 'pending').map(
    (job): PendingEmbed => ({
      jobId: job.jobId,
      url: job.url,
      retries: job.retries,
      maxRetries: job.maxRetries,
      updatedAt: job.updatedAt,
      totalDocuments: job.totalDocuments,
      processedDocuments: job.processedDocuments,
      failedDocuments: job.failedDocuments,
    })
  );

  const completedEmbeds = filterAndSortEmbeds(embedQueue.jobs, 'completed').map(
    (job): EmbedJobBase => ({
      jobId: job.jobId,
      url: job.url,
      maxRetries: job.maxRetries,
      updatedAt: job.updatedAt,
      totalDocuments: job.totalDocuments,
      processedDocuments: job.processedDocuments,
      failedDocuments: job.failedDocuments,
    })
  );

  // Format job lists for display
  const formattedJobs = formatJobsForDisplay(
    crawlStatuses,
    batchStatuses,
    extractStatuses
  );

  return {
    activeCrawls,
    crawls: formattedJobs.crawls,
    batches: formattedJobs.batches,
    extracts: formattedJobs.extracts,
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
