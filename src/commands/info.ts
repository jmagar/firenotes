/**
 * Info command implementation
 * Shows detailed information for a specific URL including metadata and chunk listings
 */

import { existsSync } from 'node:fs';
import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { InfoOptions, InfoResult, UrlInfo } from '../types/info';
import {
  formatJson,
  processCommandResult,
  writeCommandOutput,
} from '../utils/command';
import { parseInfoOptions } from '../utils/options';
import {
  getCredentialsPath,
  getEmbedQueueDir,
  getJobHistoryPath,
  getSettingsPath,
  getStorageRoot,
} from '../utils/storage-paths';
import {
  buildFiltersEcho,
  displayValue,
  formatAlignedTable,
  formatDateOnly,
  formatHeaderBlock,
  truncateWithEllipsis,
} from '../utils/style-output';
import { icons } from '../utils/theme';
import { normalizeUrl } from '../utils/url';
import {
  getQdrantUrlError,
  requireContainer,
  resolveCollectionName,
} from './shared';

type StorageInfo = {
  storageRoot: string;
  credentialsPath: string;
  settingsPath: string;
  jobHistoryPath: string;
  embedQueueDir: string;
  exists: {
    storageRoot: boolean;
    credentialsPath: boolean;
    settingsPath: boolean;
    jobHistoryPath: boolean;
    embedQueueDir: boolean;
  };
};

/**
 * Execute info command
 * Retrieves all chunks for a URL and returns detailed metadata
 *
 * @param container DI container with services
 * @param options Info options with URL and filters
 * @returns InfoResult with URL details or error
 */
export async function executeInfo(
  container: IContainer,
  options: InfoOptions
): Promise<InfoResult> {
  try {
    const qdrantUrl = container.config.qdrantUrl;
    const collection = resolveCollectionName(container, options.collection);

    if (!qdrantUrl) {
      return {
        success: false,
        error: getQdrantUrlError('info'),
      };
    }

    const qdrantService = container.getQdrantService();

    // Get all chunks for this URL
    const points = await qdrantService.scrollByUrl(collection, options.url);

    if (points.length === 0) {
      return {
        success: false,
        error: `URL not found in vector database: ${options.url}`,
      };
    }

    // Extract metadata from first point (should be consistent across chunks)
    const firstPoint = points[0];
    const payload = firstPoint.payload;

    // Map chunks with preview/full text
    const chunks = points.map((point) => {
      const text = String(point.payload.chunk_text || '');
      const textPreview =
        options.full || text.length <= 100 ? text : `${text.slice(0, 100)}...`;

      return {
        index: Number(point.payload.chunk_index || 0),
        header: point.payload.chunk_header
          ? String(point.payload.chunk_header)
          : null,
        textPreview,
      };
    });

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    const urlInfo: UrlInfo = {
      url: String(payload.url || ''),
      domain: String(payload.domain || ''),
      title: String(payload.title || ''),
      totalChunks: Number(payload.total_chunks || points.length),
      sourceCommand: String(payload.source_command || ''),
      contentType: String(payload.content_type || ''),
      scrapedAt: String(payload.scraped_at || ''),
      chunks,
    };

    return {
      success: true,
      data: urlInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getStorageInfo(): StorageInfo {
  const storageRoot = getStorageRoot();
  const credentialsPath = getCredentialsPath();
  const settingsPath = getSettingsPath();
  const jobHistoryPath = getJobHistoryPath();
  const embedQueueDir = getEmbedQueueDir();

  return {
    storageRoot,
    credentialsPath,
    settingsPath,
    jobHistoryPath,
    embedQueueDir,
    exists: {
      storageRoot: existsSync(storageRoot),
      credentialsPath: existsSync(credentialsPath),
      settingsPath: existsSync(settingsPath),
      jobHistoryPath: existsSync(jobHistoryPath),
      embedQueueDir: existsSync(embedQueueDir),
    },
  };
}

function formatStorageHuman(info: StorageInfo): string {
  const existingCount = Object.values(info.exists).filter(Boolean).length;
  const lines = formatHeaderBlock({
    title: 'Storage',
    summary: `Active local storage paths | Existing: ${existingCount}/5`,
    includeFreshness: true,
  });
  lines.push(
    formatAlignedTable(
      [
        { header: 'Path', width: 16 },
        { header: 'Value', width: 80 },
        { header: 'Exists', width: 6 },
      ],
      [
        [
          'Root',
          info.storageRoot,
          info.exists.storageRoot ? icons.success : '—',
        ],
        [
          'Credentials',
          info.credentialsPath,
          info.exists.credentialsPath ? icons.success : '—',
        ],
        [
          'Settings',
          info.settingsPath,
          info.exists.settingsPath ? icons.success : '—',
        ],
        [
          'Job history',
          info.jobHistoryPath,
          info.exists.jobHistoryPath ? icons.success : '—',
        ],
        [
          'Embed queue',
          info.embedQueueDir,
          info.exists.embedQueueDir ? icons.success : '—',
        ],
      ].map((row) => [
        row[0],
        truncateWithEllipsis(displayValue(row[1]), 80),
        row[2],
      ]),
      false
    )
  );
  return lines.join('\n');
}

/**
 * Handle info command execution
 * Wrapper for Commander.js integration
 *
 * @param container DI container with services
 * @param options Info options from CLI
 */
async function handleInfoCommand(
  container: IContainer,
  options: InfoOptions
): Promise<void> {
  await processCommandResult(
    await executeInfo(container, options),
    options,
    (resultData) => {
      const filters = buildFiltersEcho([
        [
          'collection',
          options.collection && options.collection !== 'axon'
            ? options.collection
            : undefined,
        ],
        ['full', options.full || undefined],
      ]);

      const data = resultData;
      const lines = formatHeaderBlock({
        title: 'URL Information',
        summary: `Chunks: ${data.totalChunks} | Domain: ${displayValue(data.domain)} | Source: ${displayValue(data.sourceCommand)}`,
        filters,
      });
      lines.push(
        formatAlignedTable(
          [
            { header: 'Field', width: 14 },
            { header: 'Value', width: 80 },
          ],
          [
            ['URL', displayValue(data.url)],
            ['Domain', displayValue(data.domain)],
            ['Title', displayValue(data.title)],
            ['Source', displayValue(data.sourceCommand)],
            ['Content Type', displayValue(data.contentType)],
            ['Scraped At', formatDateOnly(data.scrapedAt)],
            ['Total Chunks', String(data.totalChunks)],
          ].map((row) => [row[0], truncateWithEllipsis(row[1], 80)]),
          false
        )
      );
      lines.push('');
      lines.push('Chunks');
      lines.push(
        formatAlignedTable(
          [
            { header: '#', width: 3, align: 'right' },
            { header: 'Header', width: 24 },
            { header: 'Preview', width: 80 },
          ],
          data.chunks.map((chunk) => [
            String(chunk.index),
            truncateWithEllipsis(displayValue(chunk.header), 24),
            truncateWithEllipsis(
              chunk.textPreview.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
              80
            ),
          ]),
          false
        )
      );
      return lines.join('\n');
    }
  );
}

/**
 * Create info command for Commander.js
 *
 * @returns Commander Command instance
 */
export function createInfoCommand(): Command {
  const infoCmd = new Command('info')
    .description('Show detailed information for a specific URL')
    .argument('[url]', 'URL to get information for')
    .option(
      '-f, --full',
      'Show full chunk text (default: false, 100 char preview)',
      false
    )
    .option(
      '-c, --collection <name>',
      'Qdrant collection name (default: cortex)',
      'axon'
    )
    .option('-o, --output <file>', 'Write output to file (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .action(async (url: string, options, command: Command) => {
      if (!url) {
        command.error('URL is required. Use "axon info <url>".');
      }
      const container = requireContainer(command);
      const parsedOptions = parseInfoOptions(normalizeUrl(url), options);

      await handleInfoCommand(container, parsedOptions);
    });

  infoCmd
    .command('storage')
    .description('Show active local storage paths')
    .option('-o, --output <file>', 'Write output to file (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (options, command: Command) => {
      const storageInfo = getStorageInfo();
      const parentOptions =
        typeof command.parent?.opts === 'function' ? command.parent.opts() : {};
      const useJson =
        options.json ||
        options.pretty ||
        (parentOptions as { json?: boolean }).json === true;
      const usePretty =
        options.pretty ||
        (parentOptions as { pretty?: boolean }).pretty === true;
      const output = useJson
        ? formatJson(storageInfo, usePretty)
        : formatStorageHuman(storageInfo);
      await writeCommandOutput(output, options);
    });

  return infoCmd;
}
