/**
 * Embed pipeline orchestrator
 * Coordinates chunking, embedding, and vector storage
 */

import { randomUUID } from 'crypto';
import { getConfig } from './config';
import { chunkText } from './chunker';
import { getTeiInfo, embedChunks } from './embeddings';
import { ensureCollection, deleteByUrl, upsertPoints } from './qdrant';

interface EmbedMetadata {
  url: string;
  title?: string;
  sourceCommand: string;
  contentType?: string;
}

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
 * Auto-embed content into Qdrant via TEI
 * No-op if TEI_URL or QDRANT_URL not configured
 * Never throws -- errors are logged but don't break the calling command
 */
export async function autoEmbed(
  content: string,
  metadata: EmbedMetadata
): Promise<void> {
  try {
    const config = getConfig();
    const { teiUrl, qdrantUrl, qdrantCollection } = config;

    // No-op if not configured
    if (!teiUrl || !qdrantUrl) return;

    const collection = qdrantCollection || 'firecrawl_collection';

    // No-op for empty content
    const trimmed = content.trim();
    if (!trimmed) return;

    // Get TEI info (dimension) -- cached after first call
    const teiInfo = await getTeiInfo(teiUrl);

    // Ensure collection exists
    await ensureCollection(qdrantUrl, collection, teiInfo.dimension);

    // Chunk content
    const chunks = chunkText(trimmed);
    if (chunks.length === 0) return;

    // Generate embeddings
    const texts = chunks.map((c) => c.text);
    const vectors = await embedChunks(teiUrl, texts);

    // Delete existing vectors for this URL (overwrite dedup)
    await deleteByUrl(qdrantUrl, collection, metadata.url);

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
        source_command: metadata.sourceCommand,
        content_type: metadata.contentType || 'text',
        scraped_at: now,
      },
    }));

    // Upsert to Qdrant
    await upsertPoints(qdrantUrl, collection, points);

    console.error(`Embedded ${chunks.length} chunks for ${metadata.url}`);
  } catch (error) {
    console.error(
      `Embed failed for ${metadata.url}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
