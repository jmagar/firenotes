# Embedding Pipeline Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-embed all CLI output (scrape, crawl, search, extract) into Qdrant via HF TEI, and provide semantic search + full document retrieval.

**Architecture:** When `TEI_URL` and `QDRANT_URL` are set, every command that fetches content automatically chunks the text, generates embeddings via TEI, and upserts them into Qdrant. Standalone `embed`, `query`, and `retrieve` commands provide direct access to the pipeline. A new `extract` command wraps the Firecrawl SDK's extraction API.

**Tech Stack:** Node.js fetch for TEI and Qdrant REST APIs. No new dependencies beyond dotenv (already installed).

---

## Services

### TEI Client (`src/utils/embeddings.ts`)

- Calls `POST {TEI_URL}/embed` with `{ inputs: string[] }`
- Batch size: 32 chunks per request (TEI max is 48, leave headroom)
- Returns `number[][]` — one 1024-dim vector per input
- Auto-truncation enabled on TEI side (32768 token max)

### Qdrant Client (`src/utils/qdrant.ts`)

- **Upsert**: `PUT {QDRANT_URL}/collections/{collection}/points`
- **Delete by URL**: `POST {QDRANT_URL}/collections/{collection}/points/delete` with filter on `url` field
- **Query**: `POST {QDRANT_URL}/collections/{collection}/points/query` with vector + optional filters
- **Retrieve by URL**: `POST {QDRANT_URL}/collections/{collection}/points/scroll` filtered by `url`, ordered by `chunk_index`
- Collection name from `QDRANT_COLLECTION` env var, defaults to `firecrawl_collection`

### Chunker (`src/utils/chunker.ts`)

Markdown-aware hybrid chunking:

1. Split on markdown headers (`#`, `##`, `###`, etc.) — each section is a candidate chunk
2. Split remaining large blocks on double newlines (paragraph boundaries)
3. Subdivide any chunk exceeding ~1500 characters into ~1000 char pieces with ~100 char overlap
4. Merge chunks smaller than 50 characters into the previous chunk

Each chunk carries:

```typescript
interface Chunk {
  text: string; // chunk content
  index: number; // 0-based position in document
  header: string | null; // nearest markdown heading above
}
```

### Embed Pipeline (`src/utils/embed-pipeline.ts`)

Orchestrator function called by all commands:

```typescript
async function autoEmbed(
  content: string,
  metadata: {
    url: string;
    title?: string;
    sourceCommand: string;
    contentType?: string;
  }
): Promise<void>;
```

- No-op if `TEI_URL` or `QDRANT_URL` not set
- Chunks content via chunker
- Batch-embeds via TEI client
- Deletes existing vectors for this URL (overwrite dedup)
- Upserts new vectors with metadata to Qdrant
- Logs summary: `Embedded N chunks for {url}`
- Never throws — errors are logged but don't break the command

## Metadata Per Vector Point

Each Qdrant point carries this payload:

| Field            | Type           | Description                                     |
| ---------------- | -------------- | ----------------------------------------------- |
| `url`            | string         | Source URL                                      |
| `title`          | string         | Page title from scrape metadata                 |
| `domain`         | string         | Extracted from URL (e.g. `example.com`)         |
| `chunk_index`    | number         | Position in document (0-based)                  |
| `chunk_text`     | string         | Raw text that was embedded                      |
| `chunk_header`   | string \| null | Nearest markdown heading above chunk            |
| `total_chunks`   | number         | Total chunks for this document                  |
| `source_command` | string         | `scrape`, `crawl`, `search`, `extract`, `embed` |
| `content_type`   | string         | `markdown`, `html`, `json`, etc.                |
| `scraped_at`     | string         | ISO timestamp                                   |

Point IDs: deterministic UUID v5 from `url + chunk_index` — ensures idempotent upserts.

## Deduplication

**Overwrite strategy**: before upserting new vectors for a URL, delete all existing points with matching `url` field. This keeps the index clean and ensures re-scraping a page replaces stale content.

## New Commands

### `extract` (`src/commands/extract.ts`)

Wraps the Firecrawl SDK `extract()` method:

```bash
firecrawl extract https://example.com --prompt "Extract product pricing"
firecrawl extract https://example.com --schema '{"name": "string", "price": "number"}'

Options:
  --prompt <prompt>      Natural language extraction prompt
  --schema <json>        JSON schema for structured extraction
  --wait                 Wait for extraction to complete (default: true)
  -o, --output <path>    Save to file
  --json                 Output as JSON
  --pretty               Pretty print
  --no-embed             Skip auto-embedding
```

Auto-embeds the serialized extracted JSON.

### `embed` (`src/commands/embed.ts`)

Standalone embed command — auto-detects input type:

```bash
firecrawl embed https://example.com         # URL → scrape first, then embed
firecrawl embed .firecrawl/example.md        # file → read and embed
cat page.md | firecrawl embed --url https://example.com  # stdin

Options:
  --url <url>            Source URL for metadata (required for stdin/file)
  --collection <name>    Override collection (default: firecrawl_collection)
  --no-chunk             Embed as single vector, skip chunking
```

### `query` (`src/commands/query.ts`)

Semantic search over Qdrant:

```bash
firecrawl query "how to authenticate"

Options:
  --limit <n>            Max results (default: 5)
  --domain <domain>      Filter to specific domain
  --full                 Show complete chunk text (for RAG/LLM context)
  --group                Group results by source URL
  --collection <name>    Override collection
  -o, --output <path>    Save to file
  --json                 Output as JSON
```

Default output (compact):

```
[0.92] https://docs.firecrawl.dev/auth — ## Authentication
  Set environment variables for self-hosted instances...

[0.87] https://docs.firecrawl.dev/auth — ## Authentication Methods
  Or login interactively: firecrawl login...
```

`--full` output (RAG-ready):

```
[0.92] https://docs.firecrawl.dev/auth — ## Authentication

Set environment variables for self-hosted instances:
export FIRECRAWL_API_KEY="your-api-key"
export FIRECRAWL_API_URL="http://localhost:53002"

[0.87] https://docs.firecrawl.dev/auth — ## Authentication Methods

Or login interactively: firecrawl login
firecrawl login --api-key "your-key" --api-url "http://localhost:53002"
```

### `retrieve` (`src/commands/retrieve.ts`)

Full document reconstruction from Qdrant:

```bash
firecrawl retrieve https://docs.firecrawl.dev/auth

Options:
  --collection <name>    Override collection
  -o, --output <path>    Save to file
  --json                 Output as JSON (includes metadata per chunk)
```

Fetches all chunks for the URL from Qdrant, orders by `chunk_index`, and reassembles the full document. No re-scraping needed.

## Integration Into Existing Commands

Each command handler calls `autoEmbed()` after receiving the response:

| Command   | What gets embedded                                         | Source            |
| --------- | ---------------------------------------------------------- | ----------------- |
| `scrape`  | Response content (markdown, html, etc.)                    | Response object   |
| `crawl`   | Markdown per page as results stream in                     | Per-page callback |
| `search`  | Snippet text per result (or scraped content if `--scrape`) | Results array     |
| `extract` | Serialized extracted JSON                                  | Extract response  |

All commands gain `--no-embed` flag to skip auto-embedding.

`autoEmbed()` is fire-and-forget: it logs progress but never blocks or fails the main command output.

## Configuration

Via `.env` (loaded by dotenv):

```bash
# Required for auto-embed
TEI_URL=http://100.74.16.82:52000
QDRANT_URL=http://localhost:53333

# Optional
QDRANT_COLLECTION=firecrawl_collection  # default
```

Auto-embed activates when both `TEI_URL` and `QDRANT_URL` are set. No other config needed.

## File Structure

**New files:**

| File                          | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `src/utils/chunker.ts`        | Markdown-aware hybrid text chunking           |
| `src/utils/embeddings.ts`     | TEI client — batch embed chunks               |
| `src/utils/qdrant.ts`         | Qdrant client — upsert, delete, query, scroll |
| `src/utils/embed-pipeline.ts` | `autoEmbed()` orchestrator                    |
| `src/commands/embed.ts`       | Standalone embed command                      |
| `src/commands/query.ts`       | Semantic search command                       |
| `src/commands/retrieve.ts`    | Full document retrieval command               |
| `src/commands/extract.ts`     | Structured extraction command                 |

**Modified files:**

| File                     | Change                                                    |
| ------------------------ | --------------------------------------------------------- |
| `src/commands/scrape.ts` | Add `autoEmbed()` call after response                     |
| `src/commands/crawl.ts`  | Add `autoEmbed()` call per page                           |
| `src/commands/search.ts` | Add `autoEmbed()` call per result                         |
| `src/index.ts`           | Register `embed`, `query`, `retrieve`, `extract` commands |
| `.env.example`           | Add `TEI_URL`, `QDRANT_URL`, `QDRANT_COLLECTION`          |

**No new npm dependencies** — fetch API for HTTP calls (Node 18+).

## RAG Workflow

Typical usage pattern:

```bash
# 1. Scrape docs (auto-embeds if TEI+Qdrant configured)
firecrawl crawl https://docs.example.com --wait --limit 50

# 2. Find relevant chunks
firecrawl query "authentication setup"

# 3. Get full document for the best match
firecrawl retrieve https://docs.example.com/auth

# 4. Or get full chunk text for LLM context
firecrawl query "authentication setup" --full
```
