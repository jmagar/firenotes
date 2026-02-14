/**
 * Generic job section renderer for batch and extract status
 *
 * Addresses MT-04: renderBatchSection and renderExtractSection are near-identical.
 * This module provides a single generic renderer used by both.
 */

import {
  colorize,
  colors,
  fmt,
  formatProgress,
  getStatusColor,
  getStatusIcon,
  icons,
} from '../../utils/theme';
import {
  accentJobId,
  accentProgressText,
  changedPrefix,
  domainFromUrl,
  formatRelativeAge,
  statusBucket,
  statusHeading,
} from './helpers';
import type { JobStatusData, RenderStatusOptions } from './types';

interface JobSectionConfig {
  heading: string;
  emptyMessage: string;
  /** Key prefix for changed-key tracking (e.g. 'batch', 'extract') */
  keyPrefix: string;
  /** Label for bucket groups (e.g. 'batches', 'extracts') */
  labelPrefix: string;
}

/**
 * Generic renderer for job type sections (batch, extract).
 * Both sections follow the same pattern: heading, empty check, row mapping,
 * bucket grouping, and group printing.
 */
function renderJobSection(
  items: Array<{
    id?: string;
    status?: string;
    completed?: number;
    total?: number;
    url?: string;
    error?: string;
    updatedAt?: string;
  }>,
  options: RenderStatusOptions,
  config: JobSectionConfig
): void {
  console.log('');
  console.log(statusHeading(`${icons.bullet} ${config.heading}`));
  if (items.length === 0) {
    console.log(fmt.dim(`  ${config.emptyMessage}`));
  } else {
    const rows = items.map((item) => {
      const itemError = item.error;
      const itemId = item.id ?? 'unknown';
      const icon = getStatusIcon(item.status ?? 'unknown', !!itemError);
      const statusColor = getStatusColor(item.status ?? 'unknown', !!itemError);
      const bucket = statusBucket(item.status ?? 'unknown', !!itemError);
      const age = formatRelativeAge(item.updatedAt);
      const displayUrl = item.url;
      const domain = options.wide ? domainFromUrl(displayUrl) : null;

      let line = `${changedPrefix(`${config.keyPrefix}:${itemId}`, options.changedKeys)}${colorize(statusColor, icon)} ${accentJobId(itemId)} `;
      if (itemError) {
        line += `${colorize(statusColor, 'error')} ${fmt.dim(`(${itemError})`)}`;
      } else if (item.completed !== undefined && item.total !== undefined) {
        const progress = formatProgress(item.completed, item.total);
        line += `${colorize(statusColor, item.status ?? 'unknown')} ${accentProgressText(progress)}`;
      } else {
        line += `${colorize(statusColor, item.status ?? 'unknown')}`;
      }
      if (!options.compact && displayUrl) {
        line += ` ${fmt.dim(displayUrl)}`;
      }
      if (domain) line += ` ${fmt.dim(`(${domain})`)}`;
      if (age) line += ` ${fmt.dim(age)}`;
      return { bucket, line };
    });

    const failed = rows.filter((row) => row.bucket === 'failed');
    const warn = rows.filter((row) => row.bucket === 'warn');
    const pending = rows.filter((row) => row.bucket === 'pending');
    const completed = rows.filter((row) => row.bucket === 'completed');
    const other = rows.filter((row) => row.bucket === 'other');

    const groups: Array<{ label: string; rows: typeof rows; color: string }> = [
      {
        label: `Failed ${config.labelPrefix} (${failed.length})`,
        rows: failed,
        color: colors.primary,
      },
      {
        label: `Warn ${config.labelPrefix} (${warn.length})`,
        rows: warn,
        color: colors.warning,
      },
      {
        label: `Pending ${config.labelPrefix} (${pending.length})`,
        rows: pending,
        color: colors.primary,
      },
      {
        label: `Completed ${config.labelPrefix} (${completed.length})`,
        rows: completed,
        color: colors.primary,
      },
      {
        label: `Other ${config.labelPrefix} (${other.length})`,
        rows: other,
        color: colors.primary,
      },
    ];

    for (const group of groups) {
      console.log(`  ${colorize(group.color, `${group.label}:`)}`);
      if (group.rows.length === 0) {
        console.log(fmt.dim('    None.'));
      } else {
        for (const row of group.rows) {
          console.log(`    ${row.line}`);
        }
      }
    }
  }
}

/**
 * Renders the batch scrape status section.
 */
export function renderBatchSection(
  data: JobStatusData,
  options: RenderStatusOptions
): void {
  renderJobSection(data.batches, options, {
    heading: 'Batch Status',
    emptyMessage: 'No recent batch job IDs found.',
    keyPrefix: 'batch',
    labelPrefix: 'batches',
  });
}

/**
 * Renders the extract job status section.
 */
export function renderExtractSection(
  data: JobStatusData,
  options: RenderStatusOptions
): void {
  renderJobSection(data.extracts, options, {
    heading: 'Extract Status',
    emptyMessage: 'No recent extract job IDs found.',
    keyPrefix: 'extract',
    labelPrefix: 'extracts',
  });
}
