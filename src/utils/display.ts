/**
 * Display utilities for command execution info
 */

import { fmt, icons } from './theme';

export const canonicalSymbols = {
  running: '●',
  partial: '◐',
  stopped: '○',
  success: '✓',
  failed: '✗',
  warning: '⚠',
  info: 'ℹ',
} as const;

export const truncationMarkers = {
  continuation: '…',
  overflowPrefix: '+',
  unavailable: '—',
} as const;

export interface LegendItem {
  symbol: string;
  label: string;
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.join(',')}]`;
  }
  return String(value);
}

export function truncateWithMarker(text: string, maxLength: number): string {
  if (maxLength < 1) return '';
  if (text.length <= maxLength) return text;
  if (maxLength === 1) return truncationMarkers.continuation;
  return `${text.slice(0, maxLength - 1)}${truncationMarkers.continuation}`;
}

export function formatOverflowCount(hiddenCount: number): string {
  if (hiddenCount <= 0) return '';
  return `${truncationMarkers.overflowPrefix}${hiddenCount}`;
}

export function formatTitleLine(title: string): string {
  return fmt.bold(fmt.primary(title));
}

export function formatSummaryLine(segments: string[]): string {
  return segments.filter((segment) => segment.trim().length > 0).join(' | ');
}

export function formatLegendLine(items: LegendItem[]): string {
  if (items.length === 0) return '';
  const entries = items
    .map((item) => `${item.symbol} ${item.label}`)
    .join('  ');
  return `Legend: ${entries}`;
}

export function formatFiltersLine(filters: Record<string, unknown>): string {
  const entries = formatOptionEntries(filters);
  if (entries.length === 0) return '';
  const joined = entries
    .map((entry) => `${entry.key}=${entry.value}`)
    .join(', ');
  return `Filters: ${joined}`;
}

export function formatFreshnessLine(date: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/New_York',
  }).format(date);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(date);
  return `As of (ET): ${time} | ${formattedDate}`;
}

export function formatHeaderBlock(input: {
  title: string;
  summary: string[];
  legend?: LegendItem[];
  filters?: Record<string, unknown>;
  freshness?: boolean;
  now?: Date;
}): string[] {
  const lines: string[] = [
    formatTitleLine(input.title),
    formatSummaryLine(input.summary),
  ];

  if (input.legend && input.legend.length > 0) {
    lines.push(formatLegendLine(input.legend));
  }

  if (input.filters) {
    const filtersLine = formatFiltersLine(input.filters);
    if (filtersLine) {
      lines.push(filtersLine);
    }
  }

  if (input.freshness) {
    lines.push(formatFreshnessLine(input.now));
  }

  lines.push('');
  return lines;
}

/**
 * Format a value for display
 *
 * @param value - Value to format
 * @returns Formatted string representation
 */
function formatValue(value: unknown): string {
  return stableValue(value);
}

function formatOptionEntries(
  options: Record<string, unknown>
): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    entries.push({ key, value: formatValue(value) });
  }

  return entries;
}

/**
 * Format options for display, filtering out undefined/empty values
 *
 * @param options - Options object to format
 * @returns Formatted string of key=value pairs, or empty string if no options
 *
 * @example
 * ```typescript
 * formatOptionsDisplay({ limit: 10, timeout: undefined })
 * // Returns: "limit=10"
 *
 * formatOptionsDisplay({ tags: ['nav', 'footer'], enabled: true })
 * // Returns: "tags=[nav,footer], enabled=true"
 * ```
 */
export function formatOptionsDisplay(options: Record<string, unknown>): string {
  return formatOptionEntries(options)
    .map((entry) => `${entry.key}=${entry.value}`)
    .join(', ');
}

/**
 * Display command execution info to stderr
 *
 * Outputs the action being performed, target URL/query, and effective options.
 * All output goes to stderr so results can still be piped.
 *
 * @param action - Action being performed (e.g., "Crawling", "Scraping")
 * @param target - Target URL or query string
 * @param options - Options being used for the command
 *
 * @example
 * ```typescript
 * displayCommandInfo('Crawling', 'https://example.com', {
 *   maxDepth: 3,
 *   allowSubdomains: true,
 * });
 * // Outputs to stderr:
 * // Crawling: https://example.com
 * // Options: maxDepth=3, allowSubdomains=true
 * //
 * ```
 */
export function displayCommandInfo(
  action: string,
  target: string,
  options: Record<string, unknown>
): void {
  console.error(
    `  ${fmt.primary(`${icons.processing} ${action}`)} ${fmt.dim(target)}`
  );

  const optionsStr = formatOptionsDisplay(options);
  if (optionsStr) {
    console.error(`  ${fmt.primary('Options:')}`);
    for (const entry of formatOptionEntries(options)) {
      console.error(`    ${fmt.dim(`${entry.key}:`)} ${entry.value}`);
    }
  }

  console.error(''); // Blank line for separation
}
