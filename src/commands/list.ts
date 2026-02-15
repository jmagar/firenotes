/**
 * List command implementation
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { CrawlActiveResult } from '../types/crawl';
import { processCommandResult } from '../utils/command';
import {
  CANONICAL_EMPTY_STATE,
  formatAlignedTable,
  formatHeaderBlock,
  truncateWithEllipsis,
} from '../utils/style-output';
import { requireContainer } from './shared';

export interface ListOptions {
  apiKey?: string;
  output?: string;
  json?: boolean;
  pretty?: boolean;
}

/**
 * Execute list command (active crawls)
 */
export async function executeList(
  container: IContainer,
  _options: ListOptions
): Promise<CrawlActiveResult> {
  try {
    const app = container.getFirecrawlClient();
    const active = await app.getActiveCrawls();
    return { success: true, data: active };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Handle list command output
 */
export async function handleListCommand(
  container: IContainer,
  options: ListOptions
): Promise<void> {
  await processCommandResult(
    await executeList(container, options),
    { ...options, json: options.json || !!options.output },
    (data) => {
      const crawls = data?.crawls ?? [];
      const lines = formatHeaderBlock({
        title: 'Active Crawls',
        summary: `Active jobs: ${crawls.length}`,
        includeFreshness: true,
      });
      if (crawls.length === 0) {
        lines.push(`  ${CANONICAL_EMPTY_STATE}`);
        lines.push('');
      }
      lines.push(
        formatAlignedTable(
          [
            { header: 'Job ID', width: 28 },
            { header: 'Team', width: 16 },
            { header: 'URL', width: 56 },
          ],
          crawls.map((crawl) => [
            truncateWithEllipsis(crawl.id, 28),
            truncateWithEllipsis(crawl.teamId, 16),
            truncateWithEllipsis(crawl.url, 56),
          ])
        )
      );
      return lines.join('\n');
    }
  );
}

/**
 * Create and configure the list command
 */
export function createListCommand(): Command {
  const listCmd = new Command('list')
    .description('List active crawl jobs')
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (options, command: Command) => {
      const container = requireContainer(command);

      await handleListCommand(container, {
        apiKey: options.apiKey,
        json: options.json,
        output: options.output,
        pretty: options.pretty,
      });
    });

  return listCmd;
}
