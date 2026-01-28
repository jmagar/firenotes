/**
 * Extract command implementation
 */

import type { ExtractOptions, ExtractResult } from '../types/extract';
import { getClient } from '../utils/client';
import { handleCommandError, formatJson } from '../utils/command';
import { batchEmbed, type EmbedItem } from '../utils/embedpipeline';
import { writeOutput } from '../utils/output';

/**
 * Convert extracted data to human-readable text for embedding
 */
function extractionToText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data === null || data === undefined) return '';

  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
  }

  return String(data);
}

type ExtractResponse = {
  success?: boolean;
  data?: unknown;
  error?: string;
  sources?: string[];
  warning?: string;
};

/**
 * Execute extract command
 */
export async function executeExtract(
  options: ExtractOptions
): Promise<ExtractResult> {
  try {
    const app = getClient({ apiKey: options.apiKey });

    // Build single-arg object for new Firecrawl SDK extract()
    const extractArgs: Record<string, unknown> = {
      urls: options.urls,
      ignoreInvalidURLs: true,
    };

    if (options.prompt) {
      extractArgs.prompt = options.prompt;
    }

    if (options.schema) {
      try {
        extractArgs.schema = JSON.parse(options.schema);
      } catch {
        return {
          success: false,
          error: 'Invalid JSON schema. Provide valid JSON string.',
        };
      }
    }

    if (options.systemPrompt) {
      extractArgs.systemPrompt = options.systemPrompt;
    }
    if (options.allowExternalLinks !== undefined) {
      extractArgs.allowExternalLinks = options.allowExternalLinks;
    }
    if (options.enableWebSearch !== undefined) {
      extractArgs.enableWebSearch = options.enableWebSearch;
    }
    if (options.includeSubdomains !== undefined) {
      extractArgs.includeSubdomains = options.includeSubdomains;
    }
    if (options.showSources !== undefined) {
      extractArgs.showSources = options.showSources;
    }

    const result = (await app.extract(extractArgs)) as ExtractResponse;

    if ('error' in result && !result.success) {
      return {
        success: false,
        error: result.error || 'Extraction failed',
      };
    }

    return {
      success: true,
      data: {
        extracted: result.data,
        sources: result.sources,
        warning: result.warning,
      },
    };
  } catch (error: unknown) {
    let message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // Surface validation details from Firecrawl SDK errors
    const details = (error as { details?: unknown })?.details;
    if (Array.isArray(details)) {
      const msgs = details
        .map((d: { message?: string }) => d.message)
        .filter(Boolean);
      if (msgs.length > 0) {
        message += ': ' + msgs.join('; ');
      }
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Handle extract command output
 */
export async function handleExtractCommand(
  options: ExtractOptions
): Promise<void> {
  const result = await executeExtract(options);

  // Use shared error handler
  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  // Determine embed targets: prefer sources, fallback to input URLs
  const embedTargets =
    result.data.sources && result.data.sources.length > 0
      ? result.data.sources
      : options.urls;

  // Build embed items for batch embedding
  // Extract command embeds the extracted data (not markdown/html)
  if (options.embed !== false) {
    const extractedText = extractionToText(result.data.extracted);
    const embedItems: EmbedItem[] = embedTargets.map((targetUrl) => ({
      content: extractedText,
      metadata: {
        url: targetUrl,
        sourceCommand: 'extract',
        contentType: 'extracted',
      },
    }));
    await batchEmbed(embedItems);
  }

  // Format output using shared utility
  const outputData: Record<string, unknown> = {
    success: true,
    data: result.data.extracted,
  };
  if (result.data.sources) {
    outputData.sources = result.data.sources;
  }
  if (result.data.warning) {
    outputData.warning = result.data.warning;
  }

  const outputContent = formatJson(outputData, options.pretty);
  writeOutput(outputContent, options.output, !!options.output);
}
