/**
 * Embed command implementation
 * Embeds content from URL, file, or stdin into Qdrant via TEI
 */

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import type { EmbedOptions, EmbedResult } from '../types/embed';
import { getClient } from '../utils/client';
import { chunkText } from '../utils/chunker';
import { handleCommandError, formatJson } from '../utils/command';
import { getConfig } from '../utils/config';
import { getTeiInfo, embedChunks } from '../utils/embeddings';
import { writeOutput } from '../utils/output';
import { ensureCollection, deleteByUrl, upsertPoints } from '../utils/qdrant';
import { isUrl } from '../utils/url';

/**
 * Read stdin as a string
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Execute embed command
 */
export async function executeEmbed(
  options: EmbedOptions
): Promise<EmbedResult> {
  try {
    const config = getConfig();
    const teiUrl = config.teiUrl;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!teiUrl || !qdrantUrl) {
      return {
        success: false,
        error:
          'TEI_URL and QDRANT_URL must be set in .env for the embed command.',
      };
    }

    let content: string;
    let url: string;
    let title: string | undefined;

    if (options.input === '-') {
      // Stdin mode
      if (!options.url) {
        return {
          success: false,
          error: '--url is required when reading from stdin.',
        };
      }
      content = await readStdin();
      url = options.url;
    } else if (isUrl(options.input)) {
      // URL mode -- scrape first
      const app = getClient({ apiKey: options.apiKey });
      const result = await app.scrape(options.input, {
        formats: ['markdown'],
      });
      content = result.markdown || '';
      url = options.input;
      title = result.metadata?.title;
    } else if (fs.existsSync(options.input)) {
      // File mode
      if (!options.url) {
        return {
          success: false,
          error: '--url is required when embedding a file.',
        };
      }
      content = fs.readFileSync(options.input, 'utf-8');
      url = options.url;
    } else {
      return {
        success: false,
        error: `Input "${options.input}" is not a valid URL, file, or "-" for stdin.`,
      };
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return {
        success: false,
        error: 'No content to embed.',
      };
    }

    // Get TEI dimension
    const teiInfo = await getTeiInfo(teiUrl);

    // Ensure collection exists
    await ensureCollection(qdrantUrl, collection, teiInfo.dimension);

    // Chunk content
    const chunks = options.noChunk
      ? [{ text: trimmed, index: 0, header: null }]
      : chunkText(trimmed);

    if (chunks.length === 0) {
      return {
        success: false,
        error: 'Content produced no chunks after processing.',
      };
    }

    // Generate embeddings
    const texts = chunks.map((c) => c.text);
    const vectors = await embedChunks(teiUrl, texts);

    // Delete old vectors then upsert new ones
    await deleteByUrl(qdrantUrl, collection, url);

    const now = new Date().toISOString();
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = 'unknown';
    }

    const points = chunks.map((chunk, i) => ({
      id: randomUUID(),
      vector: vectors[i],
      payload: {
        url,
        title: title || '',
        domain,
        chunk_index: chunk.index,
        chunk_text: chunk.text,
        chunk_header: chunk.header,
        total_chunks: chunks.length,
        source_command: 'embed',
        content_type: 'text',
        scraped_at: now,
      },
    }));

    await upsertPoints(qdrantUrl, collection, points);

    return {
      success: true,
      data: {
        url,
        chunksEmbedded: chunks.length,
        collection,
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
 * Handle embed command output
 */
export async function handleEmbedCommand(options: EmbedOptions): Promise<void> {
  const result = await executeEmbed(options);

  // Use shared error handler
  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({
      success: true,
      data: result.data,
    });
  } else {
    outputContent = `Embedded ${result.data.chunksEmbedded} chunks for ${result.data.url} into ${result.data.collection}`;
  }

  writeOutput(outputContent, options.output, !!options.output);
}
