/**
 * Overview/summary rendering for the status command
 */

import { colorize, colors, fmt, icons } from '../../utils/theme';
import { countByBucket, formatAsOfEst, statusHeading } from './helpers';
import {
  renderActiveCrawlsSection,
  renderCrawlStatusSection,
} from './render-crawls';
import { renderEmbeddingSection } from './render-embeddings';
import { renderBatchSection, renderExtractSection } from './render-jobs';
import type { JobStatusData, RenderStatusOptions } from './types';

/**
 * Builds URL and progress lookup maps from crawl data.
 */
function buildCrawlLookups(data: JobStatusData) {
  const activeUrlById = new Map(
    data.activeCrawls.crawls.map((crawl) => [crawl.id, crawl.url])
  );
  const crawlUrlById = new Map(activeUrlById);
  for (const crawl of data.crawls) {
    const maybeData = crawl.data;
    const sourceUrl = Array.isArray(maybeData)
      ? (maybeData[0]?.metadata?.sourceURL ?? maybeData[0]?.metadata?.url)
      : undefined;
    if (sourceUrl && crawl.id) {
      crawlUrlById.set(crawl.id, sourceUrl);
    }
  }

  const crawlDataById = new Map<
    string,
    { status: string; completed: number; total: number }
  >();
  for (const crawl of data.crawls) {
    if (
      crawl.id &&
      crawl.completed !== undefined &&
      crawl.total !== undefined &&
      crawl.status &&
      typeof crawl.completed === 'number' &&
      typeof crawl.total === 'number'
    ) {
      crawlDataById.set(crawl.id, {
        status: crawl.status,
        completed: crawl.completed,
        total: crawl.total,
      });
    }
  }

  return { crawlUrlById, crawlDataById };
}

/**
 * Builds a snapshot of all job statuses for change detection in watch mode.
 */
function buildStatusSnapshot(data: JobStatusData): Map<string, string> {
  const statusSnapshot = new Map<string, string>();
  for (const crawl of data.activeCrawls.crawls) {
    statusSnapshot.set(`active:${crawl.id}`, 'active');
  }
  for (const crawl of data.crawls) {
    if (crawl.id && crawl.status) {
      statusSnapshot.set(`crawl:${crawl.id}`, crawl.status);
    }
  }
  for (const batch of data.batches) {
    if (batch.id && batch.status) {
      statusSnapshot.set(`batch:${batch.id}`, batch.status);
    }
  }
  for (const extract of data.extracts) {
    if (extract.id && extract.status) {
      statusSnapshot.set(`extract:${extract.id}`, extract.status);
    }
  }
  for (const job of [
    ...data.embeddings.pending,
    ...data.embeddings.failed,
    ...data.embeddings.completed,
  ]) {
    statusSnapshot.set(
      `embed:${job.jobId}`,
      data.embeddings.pending.some((p) => p.jobId === job.jobId)
        ? 'pending'
        : data.embeddings.failed.some((f) => f.jobId === job.jobId)
          ? 'failed'
          : 'completed'
    );
  }
  return statusSnapshot;
}

/**
 * Renders the complete job status in human-readable format.
 * Delegates to specialized rendering functions for each section.
 */
export function renderHumanStatus(
  data: JobStatusData,
  options: RenderStatusOptions
): Map<string, string> {
  const { crawlUrlById, crawlDataById } = buildCrawlLookups(data);

  // Count by bucket using shared helper (replaces 9 separate filter calls)
  const crawlBuckets = countByBucket(data.crawls);
  const batchBuckets = countByBucket(data.batches);
  const extractBuckets = countByBucket(data.extracts);

  const pendingCounts =
    crawlBuckets.pending +
    batchBuckets.pending +
    extractBuckets.pending +
    data.embeddings.pending.length;
  const failedCounts =
    crawlBuckets.failed +
    batchBuckets.failed +
    extractBuckets.failed +
    data.embeddings.failed.length;
  const completedCounts =
    crawlBuckets.completed +
    batchBuckets.completed +
    extractBuckets.completed +
    data.embeddings.completed.length;
  const totalJobs =
    data.activeCrawls.crawls.length +
    data.crawls.length +
    data.batches.length +
    data.extracts.length +
    data.embeddings.pending.length +
    data.embeddings.failed.length +
    data.embeddings.completed.length;
  const activeCount =
    data.activeCrawls.crawls.length + data.embeddings.summary.processing;

  console.log('');
  console.log(statusHeading('Job Status (all)'));
  console.log(
    `  ${fmt.dim('Total:')} ${colorize(colors.materialLightBlue, String(totalJobs))} ${fmt.dim('| Failed:')} ${colorize(colors.error, String(failedCounts))} ${fmt.dim('| Active:')} ${colorize(colors.warning, String(activeCount))} ${fmt.dim('| Pending:')} ${colorize(colors.info, String(pendingCounts))} ${fmt.dim('| Completed:')} ${colorize(colors.success, String(completedCounts))}`
  );
  console.log(
    `  ${fmt.dim('Legend:')} ${colorize(colors.error, icons.error)} failed  ${colorize(colors.warning, icons.warning)} warn  ${colorize(colors.info, icons.processing)} processing/pending  ${colorize(colors.success, icons.success)} completed`
  );
  if (options.filtersEcho) {
    console.log(`  ${fmt.dim(options.filtersEcho)}`);
  }
  console.log(`  ${fmt.dim(`As of (EST): ${formatAsOfEst()}`)}`);

  // Render sections
  renderActiveCrawlsSection(data, options);
  renderCrawlStatusSection(data, crawlUrlById, options);
  renderBatchSection(data, options);
  renderExtractSection(data, options);
  renderEmbeddingSection(data, crawlUrlById, crawlDataById, options);

  console.log('');
  return buildStatusSnapshot(data);
}
