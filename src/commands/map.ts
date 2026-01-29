/**
 * Map command implementation
 */

import type { MapOptions, MapResult } from '../types/map';
import { formatJson, handleCommandError } from '../utils/command';
import {
  DEFAULT_API_URL,
  getApiKey,
  getConfig,
  validateConfig,
} from '../utils/config';
import { fetchWithTimeout } from '../utils/http';
import { addUrlsToNotebook } from '../utils/notebooklm';
import { writeOutput } from '../utils/output';

/** HTTP timeout for map API requests (60 seconds) */
const MAP_TIMEOUT_MS = 60000;

/**
 * Execute map command
 */
export async function executeMap(options: MapOptions): Promise<MapResult> {
  try {
    const config = getConfig();
    const apiKey = getApiKey(options.apiKey);
    validateConfig(apiKey);

    const apiUrl = config.apiUrl || DEFAULT_API_URL;
    const userAgent = config.userAgent;
    const { urlOrJobId } = options;

    // Build request body for direct API call
    // Bypass SDK to include headers (User-Agent) in the request body
    const body: Record<string, unknown> = {
      url: urlOrJobId,
    };

    if (options.limit !== undefined) {
      body.limit = options.limit;
    }
    if (options.search) {
      body.search = options.search;
    }
    if (options.sitemap) {
      // v2 API uses a single 'sitemap' enum value: 'skip', 'include', or 'only'
      body.sitemap = options.sitemap;
    }
    if (options.includeSubdomains !== undefined) {
      body.includeSubdomains = options.includeSubdomains;
    }
    if (options.ignoreQueryParameters !== undefined) {
      body.ignoreQueryParameters = options.ignoreQueryParameters;
    }
    if (options.timeout !== undefined) {
      body.timeout = options.timeout * 1000; // Convert to milliseconds
    }
    // Note: User-Agent cannot be set via request body in v2 API
    // It must be set as an HTTP header in the fetch request below

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    // Add User-Agent as HTTP header if configured
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }

    const response = await fetchWithTimeout(
      `${apiUrl}/v1/map`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      MAP_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.error || `API request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const mapData = await response.json();

    // Normalize response — API may return links as strings or objects
    const rawLinks: unknown[] = mapData.links || [];
    const links = rawLinks.map((link: unknown) => {
      if (typeof link === 'string') {
        return { url: link, title: undefined, description: undefined };
      }
      const obj = link as Record<string, unknown>;
      return {
        url: obj.url as string,
        title: obj.title as string | undefined,
        description: obj.description as string | undefined,
      };
    });

    return {
      success: true,
      data: { links },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format map data in human-readable way
 */
function formatMapReadable(data: MapResult['data']): string {
  if (!data || !data.links) return '';

  // Output one URL per line (like curl)
  return `${data.links.map((link) => link.url).join('\n')}\n`;
}

/**
 * Handle map command output and optional NotebookLM integration
 */
export async function handleMapCommand(options: MapOptions): Promise<void> {
  const result = await executeMap(options);

  // Use shared error handler
  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) {
    return;
  }

  // Optional: Add URLs to NotebookLM notebook
  if (options.notebook && result.data.links.length > 0) {
    const urls = result.data.links.map((link) => link.url);

    // Truncate to 300 URLs (NotebookLM Pro limit)
    if (urls.length > 300) {
      console.error(
        `[NotebookLM] Warning: Truncating to 300 URLs (NotebookLM limit), found ${urls.length}`
      );
    }

    const urlsToAdd = urls.slice(0, 300);

    console.error(
      `[NotebookLM] Adding ${urlsToAdd.length} URLs to notebook "${options.notebook}"...`
    );

    const notebookResult = await addUrlsToNotebook(options.notebook, urlsToAdd);

    if (notebookResult) {
      if (notebookResult.failed === 0) {
        console.error(
          `[NotebookLM] Added ${notebookResult.added}/${urlsToAdd.length} URLs as sources`
        );
      } else {
        console.error(
          `[NotebookLM] Added ${notebookResult.added}/${urlsToAdd.length} URLs as sources (${notebookResult.failed} failed)`
        );
        notebookResult.errors.slice(0, 5).forEach((error) => {
          console.error(`[NotebookLM]   - ${error}`);
        });
        if (notebookResult.errors.length > 5) {
          console.error(
            `[NotebookLM]   ... and ${notebookResult.errors.length - 5} more errors`
          );
        }
      }
      console.error(`[NotebookLM] Notebook ID: ${notebookResult.notebook_id}`);
    } else {
      console.error(
        '[NotebookLM] Failed to add URLs. Check that python3 and notebooklm are installed.'
      );
    }
  }

  let outputContent: string;

  // Use JSON format if --json flag is set
  if (options.json) {
    outputContent = formatJson(
      { success: true, data: result.data },
      options.pretty
    );
  } else {
    // Default to human-readable format (one URL per line)
    outputContent = formatMapReadable(result.data);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

import { Command } from 'commander';
import { normalizeUrl } from '../utils/url';

/**
 * Create and configure the map command
 */
export function createMapCommand(): Command {
  const mapCmd = new Command('map')
    .description('Map URLs on a website using Firecrawl')
    .argument('[url]', 'URL to map')
    .option(
      '-u, --url <url>',
      'URL to map (alternative to positional argument)'
    )
    .option('--wait', 'Wait for map to complete')
    .option('--limit <number>', 'Maximum URLs to discover', parseInt)
    .option('--search <query>', 'Search query to filter URLs')
    .option(
      '--sitemap <mode>',
      'Sitemap handling: only, include, skip (defaults to include if not specified)'
    )
    .option('--include-subdomains', 'Include subdomains')
    .option('--ignore-query-parameters', 'Ignore query parameters')
    .option('--timeout <seconds>', 'Timeout in seconds', parseFloat)
    .option(
      '--notebook <id-or-name>',
      'Add discovered URLs to NotebookLM notebook (ID or name)'
    )
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON format', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (positionalUrl, options) => {
      // Use positional URL if provided, otherwise use --url option
      const url = positionalUrl || options.url;
      if (!url) {
        console.error(
          'Error: URL is required. Provide it as argument or use --url option.'
        );
        process.exit(1);
      }

      const mapOptions = {
        urlOrJobId: normalizeUrl(url),
        wait: options.wait,
        output: options.output,
        json: options.json,
        pretty: options.pretty,
        apiKey: options.apiKey,
        limit: options.limit,
        search: options.search,
        sitemap: options.sitemap,
        includeSubdomains: options.includeSubdomains,
        ignoreQueryParameters: options.ignoreQueryParameters,
        timeout: options.timeout,
        notebook: options.notebook,
      };

      await handleMapCommand(mapOptions);
    });

  return mapCmd;
}
