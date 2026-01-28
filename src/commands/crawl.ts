/**
 * Crawl command implementation
 */

import pLimit from 'p-limit';
import type {
  CrawlOptions,
  CrawlResult,
  CrawlStatusResult,
} from '../types/crawl';
import { getClient } from '../utils/client';
import { isJobId } from '../utils/job';
import { writeOutput } from '../utils/output';
import { autoEmbed } from '../utils/embedpipeline';
import { loadSettings } from '../utils/settings';

/**
 * Maximum concurrent embedding operations to prevent resource exhaustion
 */
const MAX_CONCURRENT_EMBEDS = 10;

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

    // Build crawl options
    const crawlOptions: any = {};

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

  return lines.join('\n') + '\n';
}

/**
 * Handle crawl command output
 */
export async function handleCrawlCommand(options: CrawlOptions): Promise<void> {
  const result = await executeCrawl(options);

  if (!result.success) {
    console.error('Error:', result.error);
    process.exit(1);
  }

  // Handle status check result
  if ('status' in result && result.data && 'status' in result.data) {
    const statusResult = result as CrawlStatusResult;
    if (statusResult.data) {
      let outputContent: string;

      if (options.pretty || !options.output) {
        // Human-readable format for status
        outputContent = formatCrawlStatus(statusResult.data);
      } else {
        // JSON format
        outputContent = options.pretty
          ? JSON.stringify({ success: true, data: statusResult.data }, null, 2)
          : JSON.stringify({ success: true, data: statusResult.data });
      }

      writeOutput(outputContent, options.output, !!options.output);
      return;
    }
  }

  // Handle crawl result (job ID or completed crawl)
  const crawlResult = result as CrawlResult;
  if (!crawlResult.data) {
    return;
  }

  // Auto-embed crawl results with concurrency limit
  const limit = pLimit(MAX_CONCURRENT_EMBEDS);
  const embedPromises: Promise<void>[] = [];
  if (
    options.embed !== false &&
    crawlResult.data &&
    !('jobId' in crawlResult.data)
  ) {
    // crawlResult.data is the SDK response; pages may be in .data (array) or .data.data (nested)
    const rawData = crawlResult.data.data;
    const pages = Array.isArray(rawData)
      ? rawData
      : rawData && Array.isArray(rawData.data)
        ? rawData.data
        : [];

    for (const page of pages) {
      if (page.markdown || page.html) {
        embedPromises.push(
          limit(async () => {
            try {
              await autoEmbed(page.markdown || page.html || '', {
                url: page.metadata?.sourceURL || page.metadata?.url || '',
                title: page.metadata?.title,
                sourceCommand: 'crawl',
                contentType: page.markdown ? 'markdown' : 'html',
              });
            } catch (err) {
              const url =
                page.metadata?.sourceURL || page.metadata?.url || 'unknown';
              console.error(
                `Embed failed for ${url}: ${err instanceof Error ? err.message : err}`
              );
            }
          })
        );
      }
    }
  }

  let outputContent: string;

  // If it's a job ID response (has jobId field)
  if ('jobId' in crawlResult.data) {
    const jobData = {
      jobId: crawlResult.data.jobId,
      url: crawlResult.data.url,
      status: crawlResult.data.status,
    };

    outputContent = options.pretty
      ? JSON.stringify({ success: true, data: jobData }, null, 2)
      : JSON.stringify({ success: true, data: jobData });
  } else {
    // Completed crawl - output the data
    // For completed crawls, output as JSON
    outputContent = options.pretty
      ? JSON.stringify(crawlResult.data, null, 2)
      : JSON.stringify(crawlResult.data);
  }

  writeOutput(outputContent, options.output, !!options.output);

  // Wait for embedding to complete
  if (embedPromises.length > 0) {
    await Promise.all(embedPromises);
  }
}
