/**
 * History command implementation
 * Shows time-based view of indexed content
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type {
  HistoryEntry,
  HistoryOptions,
  HistoryResult,
} from '../types/history';
import { processCommandResult } from '../utils/command';
import {
  buildFiltersEcho,
  CANONICAL_EMPTY_STATE,
  displayValue,
  formatAlignedTable,
  formatDateOnly,
  formatHeaderBlock,
  truncateWithEllipsis,
} from '../utils/style-output';
import {
  addDomainSourceFilterOptions,
  addVectorOutputOptions,
  buildDomainSourceFilter,
  requireContainer,
  resolveCollectionName,
  validateQdrantUrl,
} from './shared';

/**
 * Execute history command
 * Shows time-based view of indexed content, sorted by date descending
 *
 * @param container DI container with services
 * @param options History options including filters
 * @returns HistoryResult with history entries or error
 */
export async function executeHistory(
  container: IContainer,
  options: HistoryOptions
): Promise<HistoryResult> {
  try {
    const qdrantUrl = container.config.qdrantUrl;
    const collection = resolveCollectionName(container, options.collection);

    const validation = validateQdrantUrl(qdrantUrl, 'history');
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const qdrantService = container.getQdrantService();

    const points = await qdrantService.scrollAll(
      collection,
      buildDomainSourceFilter(options)
    );

    // Aggregate by URL - process ONLY chunk_index === 0 to avoid duplicates
    const entriesMap = new Map<string, HistoryEntry>();

    for (const point of points) {
      const chunkIndex = Number(point.payload.chunk_index ?? 0);
      if (chunkIndex !== 0) continue; // Skip non-first chunks

      const url = String(point.payload.url || '');
      if (!url) continue;

      const scrapedAt = String(point.payload.scraped_at || '');
      if (!scrapedAt) continue; // Skip entries without date

      if (!entriesMap.has(url)) {
        entriesMap.set(url, {
          date: scrapedAt,
          url,
          domain: String(point.payload.domain || ''),
          sourceCommand: String(point.payload.source_command || ''),
          chunks: Number(point.payload.total_chunks || 1),
        });
      }
    }

    // Convert to array
    let entries = Array.from(entriesMap.values());

    // Filter by days if specified
    if (options.days && options.days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.days);
      const cutoffTime = cutoffDate.getTime();

      entries = entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate.getTime() >= cutoffTime;
      });
    }

    // Sort by date descending (newest first)
    entries.sort((a, b) => b.date.localeCompare(a.date));

    // Store total count before limit
    const totalEntries = entries.length;

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    // Calculate date range (from = earliest, to = latest)
    const dateRange = { from: '', to: '' };
    if (entries.length > 0) {
      // Since entries are sorted descending, first is latest, last is earliest
      dateRange.to = entries[0].date;
      dateRange.from = entries[entries.length - 1].date;
    }

    return {
      success: true,
      data: {
        entries,
        totalEntries,
        dateRange,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format history as table
 */
function formatTable(entries: HistoryEntry[]): string {
  const lines: string[] = [];
  if (entries.length === 0) {
    lines.push(`  ${CANONICAL_EMPTY_STATE}`);
    lines.push('');
  }

  lines.push(
    formatAlignedTable(
      [
        { header: 'Date', width: 10 },
        { header: 'Domain', width: 25 },
        { header: 'URL', width: 45 },
        { header: 'Source', width: 8 },
        { header: 'Chunks', width: 6, align: 'right' },
      ],
      entries.map((entry) => [
        formatDateOnly(entry.date),
        truncateWithEllipsis(displayValue(entry.domain), 25),
        truncateWithEllipsis(displayValue(entry.url), 45),
        truncateWithEllipsis(displayValue(entry.sourceCommand), 8),
        String(entry.chunks),
      ])
    )
  );

  return lines.join('\n');
}

/**
 * Format history summary
 */
function formatSummary(
  data: NonNullable<HistoryResult['data']>,
  options: HistoryOptions
): string {
  const filters = buildFiltersEcho([
    ['collection', options.collection],
    ['domain', options.domain],
    ['source', options.source],
    ['days', options.days],
    ['limit', options.limit],
  ]);
  const parts = formatHeaderBlock({
    title: 'History',
    summary: `Showing ${data.entries.length} of ${data.totalEntries} entries`,
    filters,
  });
  if (data.dateRange.from && data.dateRange.to) {
    const fromDate = formatDateOnly(data.dateRange.from);
    const toDate = formatDateOnly(data.dateRange.to);
    parts.push(`  Date range: ${fromDate} to ${toDate}`);
    parts.push('');
  }

  parts.push(formatTable(data.entries));

  return parts.join('\n');
}

/**
 * Handle history command output
 */
export async function handleHistoryCommand(
  container: IContainer,
  options: HistoryOptions
): Promise<void> {
  await processCommandResult(
    await executeHistory(container, options),
    options,
    (resultData) => formatSummary(resultData, options)
  );
}

/**
 * Create and configure the history command
 */
export function createHistoryCommand(): Command {
  const historyCmd = addVectorOutputOptions(
    addDomainSourceFilterOptions(
      new Command('history')
        .description('Show time-based view of indexed content')
        .option(
          '--days <number>',
          'Filter by entries from last N days',
          (val) => Number.parseInt(val, 10)
        )
        .option('--limit <number>', 'Maximum entries to show', (val) =>
          Number.parseInt(val, 10)
        )
    )
  ).action(async (options, command: Command) => {
    const container = requireContainer(command);

    await handleHistoryCommand(container, {
      days: options.days,
      domain: options.domain,
      source: options.source,
      limit: options.limit,
      collection: options.collection,
      output: options.output,
      json: options.json,
    });
  });

  return historyCmd;
}
