/**
 * Sources command implementation
 * Lists all unique source URLs indexed in Qdrant
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type {
  SourceInfo,
  SourcesOptions,
  SourcesResult,
} from '../types/sources';
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
 * Execute sources command
 * Scrolls all points and aggregates unique URLs
 *
 * @param container DI container with services
 * @param options Sources options including filters
 * @returns SourcesResult with source list or error
 */
export async function executeSources(
  container: IContainer,
  options: SourcesOptions
): Promise<SourcesResult> {
  try {
    const qdrantUrl = container.config.qdrantUrl;
    const collection = resolveCollectionName(container, options.collection);

    const validation = validateQdrantUrl(qdrantUrl, 'sources');
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

    // Aggregate by URL
    const sourcesMap = new Map<string, SourceInfo>();

    for (const point of points) {
      const url = String(point.payload.url || '');
      if (!url) continue;

      if (!sourcesMap.has(url)) {
        sourcesMap.set(url, {
          url,
          domain: String(point.payload.domain || ''),
          title: String(point.payload.title || ''),
          totalChunks: Number(point.payload.total_chunks || 1),
          sourceCommand: String(point.payload.source_command || ''),
          scrapedAt: String(point.payload.scraped_at || ''),
        });
      }
    }

    // Convert to array and sort by scrapedAt descending
    const allSources = Array.from(sourcesMap.values()).sort((a, b) =>
      b.scrapedAt.localeCompare(a.scrapedAt)
    );

    // Calculate aggregates before applying limit
    const totalSources = allSources.length;
    const uniqueDomains = new Set(allSources.map((s) => s.domain)).size;

    // Apply limit if specified
    const sources =
      options.limit && options.limit > 0
        ? allSources.slice(0, options.limit)
        : allSources;

    return {
      success: true,
      data: {
        sources,
        totalSources,
        totalChunks: points.length,
        uniqueDomains,
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
 * Format sources as table
 */
function formatTable(sources: SourceInfo[]): string {
  const lines: string[] = [];
  if (sources.length === 0) {
    lines.push(`  ${CANONICAL_EMPTY_STATE}`);
    lines.push('');
  }

  lines.push(
    formatAlignedTable(
      [
        { header: 'Domain', width: 25 },
        { header: 'URL', width: 50 },
        { header: 'Chunks', width: 6, align: 'right' },
        { header: 'Source', width: 8 },
        { header: 'Added', width: 10 },
      ],
      sources.map((source) => [
        truncateWithEllipsis(displayValue(source.domain), 25),
        truncateWithEllipsis(displayValue(source.url), 50),
        String(source.totalChunks),
        truncateWithEllipsis(displayValue(source.sourceCommand), 8),
        formatDateOnly(source.scrapedAt),
      ])
    )
  );

  return lines.join('\n');
}

/**
 * Format sources summary
 */
function formatSummary(
  data: NonNullable<SourcesResult['data']>,
  options: SourcesOptions
): string {
  const filters = buildFiltersEcho([
    ['collection', options.collection],
    ['domain', options.domain],
    ['source', options.source],
    ['limit', options.limit],
  ]);
  const lines = formatHeaderBlock({
    title: 'Sources',
    summary: `Showing ${data.sources.length} of ${data.totalSources} sources | Chunks: ${data.totalChunks} | Domains: ${data.uniqueDomains}`,
    filters,
  });
  lines.push(formatTable(data.sources));
  return lines.join('\n');
}

/**
 * Handle sources command output
 */
export async function handleSourcesCommand(
  container: IContainer,
  options: SourcesOptions
): Promise<void> {
  await processCommandResult(
    await executeSources(container, options),
    options,
    (resultData) => formatSummary(resultData, options)
  );
}

/**
 * Create and configure the sources command
 */
export function createSourcesCommand(): Command {
  const sourcesCmd = addVectorOutputOptions(
    addDomainSourceFilterOptions(
      new Command('sources')
        .description('List all source URLs indexed in the vector database')
        .option('--limit <number>', 'Maximum sources to show', (val) =>
          Number.parseInt(val, 10)
        )
    )
  ).action(async (options, command: Command) => {
    const container = requireContainer(command);

    await handleSourcesCommand(container, {
      domain: options.domain,
      source: options.source,
      limit: options.limit,
      collection: options.collection,
      output: options.output,
      json: options.json,
    });
  });

  return sourcesCmd;
}
