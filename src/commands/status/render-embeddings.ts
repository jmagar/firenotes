/**
 * Embedding status rendering for the status command
 */

import {
  colorize,
  colors,
  fmt,
  getStatusColor,
  getStatusIcon,
  icons,
} from '../../utils/theme';
import {
  accentJobId,
  changedPrefix,
  domainFromUrl,
  formatQueueLag,
  formatRelativeAge,
  getEmbedContext,
  statusHeading,
} from './helpers';
import type { JobStatusData, RenderStatusOptions } from './types';

/**
 * Renders the embedding status section including summary and job details.
 */
export function renderEmbeddingSection(
  data: JobStatusData,
  crawlUrlById: Map<string, string>,
  crawlDataById: Map<
    string,
    { status: string; completed: number; total: number }
  >,
  options: RenderStatusOptions
): void {
  console.log('');
  console.log(statusHeading(`${icons.bullet} Embeddings`));
  const summary = data.embeddings.summary;
  const total =
    summary.pending + summary.processing + summary.completed + summary.failed;
  if (total === 0) {
    console.log(fmt.dim('  No embedding jobs found.'));
  } else {
    const stats = [
      `${colorize(colors.warning, icons.processing)} pending ${summary.pending}`,
      `${colorize(colors.info, icons.processing)} processing ${summary.processing}`,
      `${colorize(colors.success, icons.success)} completed ${summary.completed}`,
      `${colorize(colors.error, icons.error)} failed ${summary.failed}`,
    ];
    console.log(`  ${stats.join(' | ')}`);
  }

  if (data.embeddings.job) {
    const job = data.embeddings.job;
    const statusColor = getStatusColor(job.status);
    const icon = getStatusIcon(job.status);
    console.log(
      `  ${colorize(statusColor, icon)} job ${accentJobId(job.jobId)} ${colorize(statusColor, job.status)} ${fmt.dim(`(retries ${job.retries}/${job.maxRetries})`)}`
    );
    if (job.lastError) {
      console.log(
        `  ${colorize(colors.error, `last error: ${job.lastError}`)}`
      );
    }
  }

  renderFailedEmbeds(data, crawlUrlById, options);
  renderPendingEmbeds(data, crawlUrlById, crawlDataById, options);
  renderCompletedEmbeds(data, crawlUrlById, options);
  console.log('');
}

function renderFailedEmbeds(
  data: JobStatusData,
  crawlUrlById: Map<string, string>,
  options: RenderStatusOptions
): void {
  console.log(
    `  ${colorize(colors.primary, 'Failed embeds:')} ${fmt.dim(`(${data.embeddings.failed.length})`)}`
  );
  if (data.embeddings.failed.length === 0) {
    console.log(fmt.dim('    No failed embedding jobs.'));
  } else {
    for (const job of data.embeddings.failed) {
      const displayUrl = crawlUrlById.get(job.jobId) ?? job.url;
      const context = getEmbedContext(
        {
          jobId: job.jobId,
          status: 'failed',
          retries: job.retries,
          maxRetries: job.maxRetries,
          totalDocuments: job.totalDocuments,
          processedDocuments: job.processedDocuments,
          failedDocuments: job.failedDocuments,
        },
        undefined
      );

      const changed = changedPrefix(`embed:${job.jobId}`, options.changedKeys);
      const age = formatRelativeAge(job.updatedAt);
      const queueLag = options.wide ? formatQueueLag(job.updatedAt) : null;
      const domain = options.wide ? domainFromUrl(displayUrl) : null;
      let line = `    ${changed}${colorize(colors.error, icons.error)} ${accentJobId(job.jobId)} ${context.message}`;
      if (context.metadata) {
        line += ` ${fmt.dim(`(${context.metadata})`)}`;
      }
      if (!options.compact) {
        line += ` ${fmt.dim(displayUrl)}`;
      }
      if (domain) line += ` ${fmt.dim(`(${domain})`)}`;
      if (queueLag) line += ` ${fmt.dim(queueLag)}`;
      if (age) line += ` ${fmt.dim(age)}`;

      if (job.lastError) {
        console.log(line);
        console.log(
          `      ${colorize(colors.error, `\u2514\u2500 ${job.lastError}`)}`
        );
      } else {
        console.log(line);
      }
    }
  }
}

function renderPendingEmbeds(
  data: JobStatusData,
  crawlUrlById: Map<string, string>,
  crawlDataById: Map<
    string,
    { status: string; completed: number; total: number }
  >,
  options: RenderStatusOptions
): void {
  console.log(
    `  ${colorize(colors.primary, 'Pending embeds:')} ${fmt.dim(`(${data.embeddings.pending.length})`)}`
  );
  if (data.embeddings.pending.length === 0) {
    console.log(fmt.dim('    No pending embedding jobs.'));
  } else {
    for (const job of data.embeddings.pending) {
      const displayUrl = crawlUrlById.get(job.jobId) ?? job.url;
      const crawlData = crawlDataById.get(job.jobId);
      const context = getEmbedContext(
        {
          jobId: job.jobId,
          status: 'pending',
          retries: job.retries,
          maxRetries: job.maxRetries,
          totalDocuments: job.totalDocuments,
          processedDocuments: job.processedDocuments,
          failedDocuments: job.failedDocuments,
        },
        crawlData
      );

      const changed = changedPrefix(`embed:${job.jobId}`, options.changedKeys);
      const age = formatRelativeAge(job.updatedAt);
      const queueLag = options.wide ? formatQueueLag(job.updatedAt) : null;
      const domain = options.wide ? domainFromUrl(displayUrl) : null;
      let line = `    ${changed}${colorize(colors.warning, icons.processing)} ${accentJobId(job.jobId)} ${context.message}`;
      if (context.metadata) {
        line += ` ${fmt.dim(`(${context.metadata})`)}`;
      }
      if (!options.compact) {
        line += ` ${fmt.dim(displayUrl)}`;
      }
      if (domain) line += ` ${fmt.dim(`(${domain})`)}`;
      if (queueLag) line += ` ${fmt.dim(queueLag)}`;
      if (age) line += ` ${fmt.dim(age)}`;
      console.log(line);
    }
  }
}

function renderCompletedEmbeds(
  data: JobStatusData,
  crawlUrlById: Map<string, string>,
  options: RenderStatusOptions
): void {
  console.log(
    `  ${colorize(colors.primary, 'Completed embeds:')} ${fmt.dim(`(${data.embeddings.completed.length})`)}`
  );
  if (data.embeddings.completed.length === 0) {
    console.log(fmt.dim('    No completed embedding jobs.'));
  } else {
    for (const job of data.embeddings.completed) {
      const displayUrl = crawlUrlById.get(job.jobId) ?? job.url;
      const context = getEmbedContext(
        {
          jobId: job.jobId,
          status: 'completed',
          retries: 0,
          maxRetries: job.maxRetries,
          totalDocuments: job.totalDocuments,
          processedDocuments: job.processedDocuments,
          failedDocuments: job.failedDocuments,
        },
        undefined
      );
      console.log(
        `    ${changedPrefix(`embed:${job.jobId}`, options.changedKeys)}${colorize(colors.success, icons.success)} ${accentJobId(job.jobId)} ${context.message}${
          options.compact ? '' : ` ${fmt.dim(displayUrl)}`
        }${
          options.wide && domainFromUrl(displayUrl)
            ? ` ${fmt.dim(`(${domainFromUrl(displayUrl)})`)}`
            : ''
        }${
          options.wide && formatQueueLag(job.updatedAt)
            ? ` ${fmt.dim(formatQueueLag(job.updatedAt) as string)}`
            : ''
        }${
          formatRelativeAge(job.updatedAt)
            ? ` ${fmt.dim(formatRelativeAge(job.updatedAt) as string)}`
            : ''
        }`
      );
    }
  }
}
