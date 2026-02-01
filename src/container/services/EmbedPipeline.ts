/**
 * Embedding Pipeline Service
 * Orchestrates chunking, embedding, and vector storage
 *
 * Coordinates the flow:
 * 1. Chunk content (via chunker utility)
 * 2. Generate embeddings (via TeiService)
 * 3. Store in vector database (via QdrantService)
 */

import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import { chunkText } from '../../utils/chunker';
import type { IEmbedPipeline, IQdrantService, ITeiService } from '../types';

/**
 * Maximum concurrent embedding operations to prevent resource exhaustion
 */
const MAX_CONCURRENT_EMBEDS = 10;

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * EmbedPipeline implementation
 * Composes TEI and Qdrant services for end-to-end embedding workflow
 */
export class EmbedPipeline implements IEmbedPipeline {
  constructor(
    private readonly teiService: ITeiService,
    private readonly qdrantService: IQdrantService,
    private readonly collectionName: string = 'firecrawl_collection'
  ) {}

  /**
   * Auto-embed content into Qdrant via TEI
   *
   * Features:
   * - Chunks content using markdown-aware chunker
   * - Generates embeddings via TEI
   * - Deletes existing vectors for URL (dedup)
   * - Stores in Qdrant with rich metadata
   * - Never throws - errors are logged but don't break caller
   *
   * @param content Text content to embed
   * @param metadata Metadata for the content
   */
  async autoEmbed(
    content: string,
    metadata: {
      url: string;
      title?: string;
      sourceCommand?: string;
      contentType?: string;
      [key: string]: unknown;
    }
  ): Promise<void> {
    try {
      // No-op for empty content
      const trimmed = content.trim();
      if (!trimmed) return;

      // Get TEI info (dimension) - cached after first call
      const teiInfo = await this.teiService.getTeiInfo();

      // Ensure collection exists
      await this.qdrantService.ensureCollection(
        this.collectionName,
        teiInfo.dimension
      );

      // Chunk content
      const chunks = chunkText(trimmed);
      if (chunks.length === 0) return;

      // Generate embeddings
      const texts = chunks.map((c) => c.text);
      const vectors = await this.teiService.embedChunks(texts);

      // Delete existing vectors for this URL (overwrite dedup)
      await this.qdrantService.deleteByUrl(this.collectionName, metadata.url);

      // Build points with metadata
      const now = new Date().toISOString();
      const domain = extractDomain(metadata.url);
      const totalChunks = chunks.length;

      const points = chunks.map((chunk, i) => ({
        id: randomUUID(),
        vector: vectors[i],
        payload: {
          url: metadata.url,
          title: metadata.title || '',
          domain,
          chunk_index: chunk.index,
          chunk_text: chunk.text,
          chunk_header: chunk.header,
          total_chunks: totalChunks,
          source_command: metadata.sourceCommand || 'unknown',
          content_type: metadata.contentType || 'text',
          scraped_at: now,
          // Include any additional metadata fields
          ...Object.fromEntries(
            Object.entries(metadata).filter(
              ([key]) =>
                !['url', 'title', 'sourceCommand', 'contentType'].includes(key)
            )
          ),
        },
      }));

      // Upsert to Qdrant
      await this.qdrantService.upsertPoints(this.collectionName, points);

      console.error(`Embedded ${chunks.length} chunks for ${metadata.url}`);
    } catch (error) {
      console.error(
        `Embed failed for ${metadata.url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Batch embed multiple items with concurrency control
   *
   * Features:
   * - Prevents resource exhaustion via p-limit
   * - Default concurrency: 10
   * - Silently ignores individual embedding errors
   * - Never throws - designed for fire-and-forget usage
   *
   * @param items Array of items to embed
   * @param options Batch options (concurrency limit)
   */
  async batchEmbed(
    items: Array<{
      content: string;
      metadata: {
        url: string;
        title?: string;
        sourceCommand?: string;
        contentType?: string;
        [key: string]: unknown;
      };
    }>,
    options: { concurrency?: number } = {}
  ): Promise<void> {
    if (items.length === 0) return;

    const concurrency = options.concurrency ?? MAX_CONCURRENT_EMBEDS;
    const limit = pLimit(concurrency);

    const promises = items.map((item) =>
      limit(async () => {
        try {
          await this.autoEmbed(item.content, item.metadata);
        } catch {
          // Silently ignore individual embedding errors - don't fail the batch
        }
      })
    );

    await Promise.all(promises);
  }
}
