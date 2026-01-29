/**
 * Crawl command implementation
 */

import type {
  Document,
  CrawlOptions as FirecrawlCrawlOptions,
} from '@mendable/firecrawl-js';
import { Command } from 'commander';
import type {
  CrawlJobData,
  CrawlOptions,
  CrawlResult,
  CrawlStatusResult,
} from '../types/crawl';
import { getClient } from '../utils/client';
import { formatJson } from '../utils/command';
import { batchEmbed, createEmbedItems } from '../utils/embedpipeline';
import { isJobId } from '../utils/job';
import { writeOutput } from '../utils/output';
import { loadSettings } from '../utils/settings';
import { normalizeUrl } from '../utils/url';

/**
 * Execute crawl status check
 */
async function checkCrawlStatus(
  jobId: string,
  options: CrawlOptions
): Promise<CrawlStatusResult> {
  try {
    const app = getClient({ apiKey: options.apiKey });
    const status = await app.getCrawlStatus(jobId);

    return {
      success: true,
      data: {
        id: status.id,
        status: status.status,
        total: status.total,
        completed: status.completed,
        creditsUsed: status.creditsUsed,
        expiresAt: status.expiresAt,
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
 * Execute crawl command
 */
export async function executeCrawl(
  options: CrawlOptions
): Promise<CrawlResult | CrawlStatusResult> {
  try {
    const app = getClient({ apiKey: options.apiKey });
    const { urlOrJobId, status, wait, pollInterval, timeout } = options;

    // If status flag is set or input looks like a job ID, check status
    if (status || isJobId(urlOrJobId)) {
      return await checkCrawlStatus(urlOrJobId, options);
    }

    // Build crawl options - extends SDK CrawlOptions with polling options
    const crawlOptions: FirecrawlCrawlOptions & {
      pollInterval?: number;
      crawlTimeout?: number;
    } = {};

    if (options.limit !== undefined) {
      crawlOptions.limit = options.limit;
    }
    if (options.maxDepth !== undefined) {
      crawlOptions.maxDiscoveryDepth = options.maxDepth;
    }
    // Merge default exclude paths from settings with CLI exclude paths
    const defaultExcludes = options.noDefaultExcludes
      ? []
      : (loadSettings().defaultExcludePaths ?? []);
    const cliExcludes = options.excludePaths ?? [];
    const mergedExcludes = [...new Set([...defaultExcludes, ...cliExcludes])];
    if (mergedExcludes.length > 0) {
      crawlOptions.excludePaths = mergedExcludes;
    }
    if (options.includePaths && options.includePaths.length > 0) {
      crawlOptions.includePaths = options.includePaths;
    }
    if (options.sitemap) {
      crawlOptions.sitemap = options.sitemap;
    }
    if (options.ignoreQueryParameters !== undefined) {
      crawlOptions.ignoreQueryParameters = options.ignoreQueryParameters;
    }
    if (options.crawlEntireDomain !== undefined) {
      crawlOptions.crawlEntireDomain = options.crawlEntireDomain;
    }
    if (options.allowExternalLinks !== undefined) {
      crawlOptions.allowExternalLinks = options.allowExternalLinks;
    }
    if (options.allowSubdomains !== undefined) {
      crawlOptions.allowSubdomains = options.allowSubdomains;
    }
    if (options.delay !== undefined) {
      crawlOptions.delay = options.delay;
    }
    if (options.maxConcurrency !== undefined) {
      crawlOptions.maxConcurrency = options.maxConcurrency;
    }
    if (options.scrapeTimeout !== undefined) {
      // Per-page scrape timeout goes in scrapeOptions, not crawlOptions
      crawlOptions.scrapeOptions = {
        ...(crawlOptions.scrapeOptions || {}),
        timeout: options.scrapeTimeout * 1000, // Convert seconds to milliseconds
      };
    }

    // If wait mode, use the convenience crawl method with polling
    if (wait) {
      // Set polling options
      if (pollInterval !== undefined) {
        crawlOptions.pollInterval = pollInterval * 1000; // Convert to milliseconds
      } else {
        // Default poll interval: 5 seconds
        crawlOptions.pollInterval = 5000;
      }
      // Note: timeout (per-page scrape) is already set above from scrapeTimeout
      // The SDK's app.crawl() method handles overall job timeout internally
      // If we need to set total crawl timeout, use crawlTimeout parameter
      if (timeout !== undefined) {
        crawlOptions.crawlTimeout = timeout * 1000; // Convert to milliseconds
      }

      // Show progress if requested - use custom polling for better UX
      if (options.progress) {
        // Start crawl first
        const response = await app.startCrawl(urlOrJobId, crawlOptions);
        const jobId = response.id;

        process.stderr.write(`Crawling ${urlOrJobId}...\n`);
        process.stderr.write(`Job ID: ${jobId}\n`);

        // Poll for status with progress updates
        const pollMs = crawlOptions.pollInterval || 5000;
        const startTime = Date.now();
        const timeoutMs = timeout ? timeout * 1000 : undefined;

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, pollMs));

          const status = await app.getCrawlStatus(jobId);

          // Show progress
          process.stderr.write(
            `\rProgress: ${status.completed}/${status.total} pages (${status.status})`
          );

          if (
            status.status === 'completed' ||
            status.status === 'failed' ||
            status.status === 'cancelled' ||
            (status.total > 0 && status.completed >= status.total)
          ) {
            process.stderr.write('\n');
            return {
              success: true,
              data: status,
            };
          }

          // Check timeout
          if (timeoutMs && Date.now() - startTime > timeoutMs) {
            process.stderr.write('\n');
            return {
              success: false,
              error: `Timeout after ${timeout} seconds. Crawl still in progress.`,
            };
          }
        }
      } else {
        // Use SDK's built-in polling (no progress display)
        const crawlJob = await app.crawl(urlOrJobId, crawlOptions);
        return {
          success: true,
          data: crawlJob,
        };
      }
    }

    // Otherwise, start crawl and return job ID
    const response = await app.startCrawl(urlOrJobId, crawlOptions);

    return {
      success: true,
      data: {
        jobId: response.id,
        url: response.url,
        status: 'processing',
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
 * Format crawl status in human-readable way
 */
function formatCrawlStatus(data: CrawlStatusResult['data']): string {
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
    lines.push(
      `Expires: ${expiresDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Handle crawl command output
 */
export async function handleCrawlCommand(options: CrawlOptions): Promise<void> {
  const result = await executeCrawl(options);

  // Handle errors - can't use shared handler due to union type
  if (!result.success) {
    console.error('Error:', result.error || 'Unknown error occurred');
    process.exit(1);
  }

  // Handle status check result
  if ('status' in result && result.data && 'status' in result.data) {
    const statusResult = result as CrawlStatusResult;
    if (statusResult.data) {
      // Human-readable format for status when no output file
      const outputContent =
        options.pretty || !options.output
          ? formatCrawlStatus(statusResult.data)
          : formatJson(
              { success: true, data: statusResult.data },
              options.pretty
            );

      writeOutput(outputContent, options.output, !!options.output);
      return;
    }
  }

  // Handle crawl result (job ID or completed crawl)
  const crawlResult = result as CrawlResult;
  if (!crawlResult.data) {
    return;
  }

  // Auto-embed crawl results using shared batch embedding
  if (options.embed !== false && crawlResult.data) {
    let pagesToEmbed: Document[] = [];

    if ('jobId' in crawlResult.data) {
      // Async job - poll until complete before embedding
      const app = getClient({ apiKey: options.apiKey });
      const jobId = crawlResult.data.jobId;
      const pollMs = (options.pollInterval ?? 10) * 1000; // Default 10s for embed polling

      process.stderr.write(`Waiting for crawl to complete for embedding...\n`);

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));

        const status = await app.getCrawlStatus(jobId);
        process.stderr.write(
          `\rEmbed wait: ${status.completed}/${status.total} pages (${status.status})`
        );

        if (
          status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'cancelled'
        ) {
          process.stderr.write('\n');

          if (status.status === 'completed' && status.data) {
            pagesToEmbed = Array.isArray(status.data) ? status.data : [];
          } else if (status.status !== 'completed') {
            process.stderr.write(
              `Crawl ${status.status}, skipping embedding.\n`
            );
          }
          break;
        }
      }
    } else {
      // Synchronous result - extract pages directly from CrawlJobData
      const crawlJobData = crawlResult.data as CrawlJobData;
      pagesToEmbed = crawlJobData.data ?? [];
    }

    // Use shared embedding utility
    if (pagesToEmbed.length > 0) {
      const embedItems = createEmbedItems(pagesToEmbed, 'crawl');
      await batchEmbed(embedItems);
    }
  }

  // Format output using shared utility
  let outputContent: string;
  if ('jobId' in crawlResult.data) {
    // Job ID response
    const jobData = {
      jobId: crawlResult.data.jobId,
      url: crawlResult.data.url,
      status: crawlResult.data.status,
    };
    outputContent = formatJson(
      { success: true, data: jobData },
      options.pretty
    );
  } else {
    // Completed crawl - output the data
    outputContent = formatJson(crawlResult.data, options.pretty);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the crawl command
 */
export function createCrawlCommand(): Command {
  const crawlCmd = new Command('crawl')
    .description('Crawl a website using Firecrawl')
    .argument('[url-or-job-id]', 'URL to crawl or job ID to check status')
    .option(
      '-u, --url <url>',
      'URL to crawl (alternative to positional argument)'
    )
    .option('--status', 'Check status of existing crawl job', false)
    .option(
      '--wait',
      'Wait for crawl to complete before returning results',
      false
    )
    .option(
      '--poll-interval <seconds>',
      'Polling interval in seconds when waiting (default: 5)',
      parseFloat
    )
    .option(
      '--timeout <seconds>',
      'Timeout in seconds when waiting for crawl job to complete (default: no timeout)',
      parseFloat
    )
    .option(
      '--scrape-timeout <seconds>',
      'Per-page scrape timeout in seconds (default: 5)',
      parseFloat,
      5
    )
    .option('--progress', 'Show progress dots while waiting', false)
    .option('--limit <number>', 'Maximum number of pages to crawl', parseInt)
    .option('--max-depth <number>', 'Maximum crawl depth', parseInt)
    .option(
      '--exclude-paths <paths>',
      'Comma-separated list of paths to exclude'
    )
    .option(
      '--include-paths <paths>',
      'Comma-separated list of paths to include'
    )
    .option('--sitemap <mode>', 'Sitemap handling: skip, include', 'include')
    .option(
      '--ignore-query-parameters',
      'Ignore query parameters when crawling',
      false
    )
    .option('--crawl-entire-domain', 'Crawl entire domain', false)
    .option('--allow-external-links', 'Allow external links', false)
    .option('--allow-subdomains', 'Allow subdomains', false)
    .option('--delay <ms>', 'Delay between requests in milliseconds', parseInt)
    .option(
      '--max-concurrency <number>',
      'Maximum concurrent requests',
      parseInt
    )
    .option(
      '-k, --api-key <key>',
      'Firecrawl API key (overrides global --api-key)'
    )
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--pretty', 'Pretty print JSON output', false)
    .option('--no-embed', 'Skip auto-embedding of crawl results')
    .option('--no-default-excludes', 'Skip default exclude paths from settings')
    .action(async (positionalUrlOrJobId, options) => {
      // Use positional argument if provided, otherwise use --url option
      const urlOrJobId = positionalUrlOrJobId || options.url;
      if (!urlOrJobId) {
        console.error(
          'Error: URL or job ID is required. Provide it as argument or use --url option.'
        );
        process.exit(1);
      }

      // Auto-detect if it's a job ID (UUID format)
      const isStatusCheck = options.status || isJobId(urlOrJobId);

      const crawlOptions = {
        urlOrJobId: isStatusCheck ? urlOrJobId : normalizeUrl(urlOrJobId),
        status: isStatusCheck,
        wait: options.wait,
        pollInterval: options.pollInterval,
        timeout: options.timeout,
        scrapeTimeout: options.scrapeTimeout,
        progress: options.progress,
        output: options.output,
        pretty: options.pretty,
        apiKey: options.apiKey,
        limit: options.limit,
        maxDepth: options.maxDepth,
        excludePaths: options.excludePaths
          ? options.excludePaths.split(',').map((p: string) => p.trim())
          : undefined,
        includePaths: options.includePaths
          ? options.includePaths.split(',').map((p: string) => p.trim())
          : undefined,
        sitemap: options.sitemap,
        ignoreQueryParameters: options.ignoreQueryParameters,
        crawlEntireDomain: options.crawlEntireDomain,
        allowExternalLinks: options.allowExternalLinks,
        allowSubdomains: options.allowSubdomains,
        delay: options.delay,
        maxConcurrency: options.maxConcurrency,
        embed: options.embed,
        noDefaultExcludes: options.defaultExcludes === false,
      };

      await handleCrawlCommand(crawlOptions);
    });

  return crawlCmd;
}
