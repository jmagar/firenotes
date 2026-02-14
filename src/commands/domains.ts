/**
 * Domains command implementation
 * Lists unique domains with aggregate statistics
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type {
  DomainInfo,
  DomainsOptions,
  DomainsResult,
} from '../types/domains';
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
  addVectorOutputOptions,
  aggregatePointsByDomain,
  getQdrantUrlError,
  requireContainer,
  resolveCollectionName,
} from './shared';

/**
 * Execute domains command
 *
 * @param container DI container with services
 * @param options Domains options
 * @returns DomainsResult with domain list or error
 */
export async function executeDomains(
  container: IContainer,
  options: DomainsOptions
): Promise<DomainsResult> {
  try {
    const qdrantUrl = container.config.qdrantUrl;
    const collection = resolveCollectionName(container, options.collection);

    if (!qdrantUrl) {
      return {
        success: false,
        error: getQdrantUrlError('domains'),
      };
    }

    const qdrantService = container.getQdrantService();

    // Scroll all points
    const points = await qdrantService.scrollAll(collection);

    // Aggregate by domain using shared function
    const domainMap = aggregatePointsByDomain(points, true);

    // Convert to array and sort by vector count descending
    let domains: DomainInfo[] = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        urlCount: data.urls.size,
        vectorCount: data.vectors,
        lastUpdated: data.lastUpdated || '',
      }))
      .sort((a, b) => b.vectorCount - a.vectorCount);

    // Calculate totals before limiting
    const totalUrls = domains.reduce((sum, d) => sum + d.urlCount, 0);
    const totalVectors = domains.reduce((sum, d) => sum + d.vectorCount, 0);

    // Apply limit
    if (options.limit && options.limit > 0) {
      domains = domains.slice(0, options.limit);
    }

    return {
      success: true,
      data: {
        domains,
        totalDomains: domainMap.size,
        totalUrls,
        totalVectors,
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
 * Format domains as table
 */
function formatTable(domains: DomainInfo[]): string {
  if (domains.length === 0) {
    return `  ${CANONICAL_EMPTY_STATE}`;
  }

  return formatAlignedTable(
    [
      { header: 'Domain', width: 35 },
      { header: 'URLs', width: 6, align: 'right' },
      { header: 'Vectors', width: 8, align: 'right' },
      { header: 'Last Updated', width: 12 },
    ],
    domains.map((domain) => [
      truncateWithEllipsis(displayValue(domain.domain), 35),
      String(domain.urlCount),
      String(domain.vectorCount),
      formatDateOnly(domain.lastUpdated),
    ]),
    false
  );
}

/**
 * Format domains summary
 */
function formatSummary(
  data: NonNullable<DomainsResult['data']>,
  options: DomainsOptions
): string {
  const filters = buildFiltersEcho([
    ['collection', options.collection],
    ['limit', options.limit],
  ]);
  const lines = formatHeaderBlock({
    title: 'Domains',
    summary: `Showing ${data.domains.length} of ${data.totalDomains} domains | URLs: ${data.totalUrls} | Vectors: ${data.totalVectors}`,
    filters,
  });
  lines.push(formatTable(data.domains));
  return lines.join('\n');
}

/**
 * Handle domains command output
 */
export async function handleDomainsCommand(
  container: IContainer,
  options: DomainsOptions
): Promise<void> {
  processCommandResult(
    await executeDomains(container, options),
    options,
    (resultData) => formatSummary(resultData, options)
  );
}

/**
 * Create and configure the domains command
 */
export function createDomainsCommand(): Command {
  const domainsCmd = addVectorOutputOptions(
    new Command('domains')
      .description('List unique domains in the vector database')
      .option('--limit <number>', 'Maximum domains to show', (val) =>
        parseInt(val, 10)
      )
  ).action(async (options, command: Command) => {
    const container = requireContainer(command);

    await handleDomainsCommand(container, {
      limit: options.limit,
      collection: options.collection,
      output: options.output,
      json: options.json,
    });
  });

  return domainsCmd;
}
