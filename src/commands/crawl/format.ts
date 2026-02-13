/**
 * Output formatting for crawl results
 */

import type { CrawlStatusResult } from '../../types/crawl';
import {
  buildFiltersEcho,
  CANONICAL_EMPTY_STATE,
  formatHeaderBlock,
} from '../../utils/style-output';

/**
 * Format crawl status in human-readable way
 *
 * @param data - Crawl status data containing job details
 * @returns Formatted status string with job ID, status, progress, credits, and expiration
 *
 * @example
 * ```typescript
 * const formatted = formatCrawlStatus({
 *   id: 'job-123',
 *   status: 'completed',
 *   total: 100,
 *   completed: 100,
 *   creditsUsed: 50,
 *   expiresAt: '2026-02-15T00:00:00Z'
 * });
 * ```
 */
export function formatCrawlStatus(
  data: CrawlStatusResult['data'],
  options?: { filters?: Array<[string, string | number | boolean | undefined]> }
): string {
  if (!data) return '';

  const progress = `${data.completed}/${data.total}`;
  const lines = formatHeaderBlock({
    title: `Crawl Status for ${data.id}`,
    summary: `Status: ${data.status} | Progress: ${progress} pages`,
    filters: buildFiltersEcho(options?.filters ?? [['jobId', data.id]]),
    includeFreshness: true,
  });

  if (
    data.status !== 'completed' &&
    data.status !== 'failed' &&
    data.status !== 'cancelled' &&
    data.total === 0
  ) {
    lines.push(`  ${CANONICAL_EMPTY_STATE}`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`Job ID: ${data.id}`);
  lines.push(`Status: ${data.status}`);
  lines.push(`Progress: ${progress} pages`);

  if (data.creditsUsed !== undefined) {
    lines.push(`Credits Used: ${data.creditsUsed}`);
  }

  if (data.expiresAt) {
    try {
      const expiresDate = new Date(data.expiresAt);
      lines.push(
        `Expires: ${expiresDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      );
    } catch (_error) {
      // Fall back to ISO string if locale formatting fails
      lines.push(`Expires: ${data.expiresAt}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
