/**
 * Output formatting for crawl results
 */

import type { CrawlStatusResult } from '../../types/crawl';

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
export function formatCrawlStatus(data: CrawlStatusResult['data']): string {
  if (!data) return '';

  const lines: string[] = [];
  lines.push(`Job ID: ${data.id}`);
  lines.push(`Status: ${data.status}`);
  lines.push(`Progress: ${data.completed}/${data.total} pages`);

  if (data.creditsUsed !== undefined) {
    lines.push(`Credits Used: ${data.creditsUsed}`);
  }

  if (data.expiresAt) {
    const expiresDate = new Date(data.expiresAt);
    // Extract locale from LANG environment variable, handling formats like en_US.UTF-8, C, etc.
    let locale = 'en-US';
    const langEnv = process.env.LANG;
    if (langEnv) {
      const langPart = langEnv.split('.')[0];
      // Only use if it looks like a valid locale (contains underscore or hyphen)
      if (langPart && (langPart.includes('_') || langPart.includes('-'))) {
        const candidateLocale = langPart.replace('_', '-');
        // Validate locale using try-catch to handle RangeError
        try {
          // Test the locale by attempting to use it
          new Intl.DateTimeFormat(candidateLocale);
          locale = candidateLocale;
        } catch (error) {
          // Fall back to 'en-US' if locale is invalid
          // No need to log - silent fallback is acceptable for locale formatting
        }
      }
    }

    // Wrap toLocaleString in try-catch as additional safety
    try {
      lines.push(
        `Expires: ${expiresDate.toLocaleString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      );
    } catch (error) {
      // Fall back to ISO string if locale formatting fails
      lines.push(`Expires: ${expiresDate.toISOString()}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
