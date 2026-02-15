/**
 * Shared helpers for the status command
 */

import { colorize, colors, fmt, formatRetries } from '../../utils/theme';
import type { EmbedContext, StatusBucket } from './types';

export function statusHeading(text: string): string {
  return fmt.bold(colorize(colors.primary, text));
}

export function accentJobId(id: string): string {
  return colorize(colors.materialLightBlue, id);
}

export function accentProgressText(text: string): string {
  return text.replace(/(\d+%|\(\d+\/\d+\))/g, (segment) =>
    colorize(colors.materialLightBlue, segment)
  );
}

export function statusBucket(status: string, hasError: boolean): StatusBucket {
  if (hasError) return 'failed';
  const normalized = status.toLowerCase();
  if (['failed', 'error', 'cancelled'].includes(normalized)) return 'failed';
  if (['stalled', 'degraded', 'partial', 'unknown'].includes(normalized)) {
    return 'warn';
  }
  if (['completed', 'success'].includes(normalized)) return 'completed';
  if (
    ['pending', 'queued', 'running', 'processing', 'scraping'].includes(
      normalized
    )
  ) {
    return 'pending';
  }
  return 'other';
}

export function formatRelativeAge(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const diffMs = Math.max(0, Date.now() - then);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `updated ${days}d ago`;
}

export function formatQueueLag(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const diffMs = Math.max(0, Date.now() - then);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `queue ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `queue ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `queue ${hours}h`;
}

export function domainFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function changedPrefix(key: string, changedKeys: Set<string>): string {
  if (!changedKeys.has(key)) return '';
  return `${colorize(colors.info, '\u21BA')} `;
}

/**
 * Detects keys that changed value, were added, or were removed between polls.
 */
export function computeChangedKeys(
  previous: Map<string, string> | null,
  current: Map<string, string>
): Set<string> {
  if (!previous) return new Set();
  const changed = new Set<string>();
  for (const [key, value] of current.entries()) {
    const prior = previous.get(key);
    if (prior === undefined || prior !== value) {
      changed.add(key);
    }
  }
  for (const key of previous.keys()) {
    if (!current.has(key)) {
      changed.add(key);
    }
  }
  return changed;
}

// Intentionally hardcoded to America/New_York to match the server timezone.
// All timestamps in the status dashboard display in EST/EDT for consistency
// with server-side job scheduling and log correlation.
export function formatAsOfEst(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const time = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  const month = getPart('month');
  const day = getPart('day');
  const year = getPart('year');
  return `${time} | ${month}/${day}/${year}`;
}

/**
 * Counts items by status bucket to avoid repeated filter calls.
 * Includes all possible buckets from statusBucket() so totals match items.length.
 */
export function countByBucket(
  items: Array<{ status?: string; error?: string }>
): { pending: number; failed: number; completed: number; warn: number; other: number } {
  const counts = { pending: 0, failed: 0, completed: 0, warn: 0, other: 0 };
  for (const item of items) {
    const bucket = statusBucket(item.status ?? 'unknown', !!item.error);
    counts[bucket]++;
  }
  return counts;
}

/**
 * Get display context for an embedding job based on its status and related crawl data
 */
export function getEmbedContext(
  embedJob: {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retries: number;
    maxRetries: number;
    totalDocuments?: number;
    processedDocuments?: number;
    failedDocuments?: number;
  },
  crawlData?: {
    status: string;
    completed: number;
    total: number;
  }
): EmbedContext {
  const {
    status,
    retries,
    maxRetries,
    totalDocuments,
    processedDocuments,
    failedDocuments,
  } = embedJob;

  if (status === 'processing') {
    if (totalDocuments && processedDocuments !== undefined) {
      const percentage = Math.floor(
        (processedDocuments / totalDocuments) * 100
      );
      return {
        message: 'Embedding in progress',
        metadata: `${processedDocuments}/${totalDocuments} - ${percentage}%`,
      };
    }
    return { message: 'Embedding in progress...' };
  }

  if (status === 'completed') {
    if (
      totalDocuments !== undefined &&
      processedDocuments !== undefined &&
      failedDocuments !== undefined &&
      failedDocuments > 0
    ) {
      return {
        message: 'Completed with failures',
        metadata: `${processedDocuments}/${totalDocuments} succeeded, ${failedDocuments} failed`,
      };
    }
    return { message: 'Embedded successfully' };
  }

  if (status === 'failed') {
    return {
      message: 'Embedding failed',
      metadata: formatRetries(retries, maxRetries),
    };
  }

  // Status is 'pending'
  if (!crawlData) {
    return { message: 'Queued for embedding' };
  }

  const { status: crawlStatus, completed, total } = crawlData;

  if (crawlStatus === 'failed' || crawlStatus === 'cancelled') {
    return { message: 'Blocked (crawl failed)' };
  }

  if (crawlStatus === 'completed') {
    return {
      message: 'Ready to embed',
      metadata: `${total} documents`,
    };
  }

  return {
    message: 'Queued for embedding',
    metadata: `crawl: ${completed}/${total} scraped`,
  };
}
