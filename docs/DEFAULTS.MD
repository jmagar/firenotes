# Axon CLI Defaults Reference

**Last Updated:** 2026-02-16

This document describes the current default behavior in code.
Primary sources:
- `src/utils/default-settings.ts`
- `src/container/config-resolver.ts`
- command option definitions in `src/commands/*`

## Configuration Priority

Resolution order (highest to lowest):
1. CLI flags
2. Environment variables
3. Stored credentials/settings in `AXON_HOME` (default `~/.axon`)
4. Built-in defaults

## Environment Defaults

| Variable | Built-in Default | Notes |
|---|---:|---|
| `FIRECRAWL_API_KEY` | unset | No built-in key; set in env or credentials store |
| `FIRECRAWL_API_URL` | `https://api.firecrawl.dev` | From `DEFAULT_API_URL` |
| `AXON_HOME` | `~/.axon` | Unified storage root |
| `TEI_URL` | unset | Required for embedding/vector commands |
| `QDRANT_URL` | unset | Required for vector commands |
| `QDRANT_COLLECTION` | `cortex` | Fallback in config resolver |
| `ASK_CLI` | unset | If unset, `ask` can use OpenAI-compatible fallback |
| `OPENAI_BASE_URL` | unset | Used by `ask` fallback when `ASK_CLI` is unset |
| `OPENAI_API_KEY` | unset | Used by `ask` fallback |
| `OPENAI_MODEL` | unset | Used by `ask` fallback |
| `AXON_CLI_DISABLE_LOCAL_ENV` | unset | Set to `1` to disable auto-loading `<cwd>/.env` |

## Settings Defaults (`settings.json`)

Defaults from `getDefaultSettings()`:

### `crawl`
- `maxDepth`: `5`
- `crawlEntireDomain`: `true`
- `allowSubdomains`: `true`
- `onlyMainContent`: `true`
- `excludeTags`: `['nav', 'footer']`
- `sitemap`: `'include'`
- `ignoreQueryParameters`: `true`
- `autoEmbed`: `true`
- `pollIntervalSeconds`: `5`

### `scrape`
- `formats`: `['markdown']`
- `onlyMainContent`: `true`
- `timeoutSeconds`: `15`
- `excludeTags`: `['nav', 'footer']`
- `autoEmbed`: `true`

### `map`
- `sitemap`: `'include'`
- `includeSubdomains`: `null`
- `ignoreQueryParameters`: `true`
- `ignoreCache`: `null`

### `search`
- `limit`: `5`
- `sources`: `['web']`
- `timeoutMs`: `60000`
- `ignoreInvalidUrls`: `true`
- `scrape`: `true`
- `scrapeFormats`: `['markdown']`
- `onlyMainContent`: `true`
- `autoEmbed`: `true`

### `extract`
- `allowExternalLinks`: `false`
- `enableWebSearch`: `true`
- `includeSubdomains`: `true`
- `showSources`: `true`
- `ignoreInvalidUrls`: `true`
- `autoEmbed`: `true`

### `batch`
- `onlyMainContent`: `false`
- `ignoreInvalidUrls`: `false`

### `ask`
- `limit`: `10`
- `fullDocs`: `5`
- `backfillChunks`: `3`

### `http`
- `timeoutMs`: `30000`
- `maxRetries`: `3`
- `baseDelayMs`: `5000`
- `maxDelayMs`: `60000`

### `chunking`
- `maxChunkSize`: `1500`
- `targetChunkSize`: `1000`
- `overlapSize`: `100`
- `minChunkSize`: `50`

### `embedding`
- `maxConcurrent`: `10`
- `batchSize`: `24`
- `maxConcurrentBatches`: `4`
- `maxRetries`: `3`

### `polling`
- `intervalMs`: `5000`

## Key Command Defaults (CLI)

Defaults visible via `axon <command> --help`:

- `ask`
  - `--limit 10`
  - `--full-docs 5`
  - `--backfill-chunks 3`
  - `--max-context 250000`
- `query`
  - `--limit 10`
- `search`
  - `--limit 5`
  - `--timeout 60000`
  - `--scrape true`
- `scrape`
  - `--timeout 15`
  - `--only-main-content true`
- `crawl`
  - `--max-depth 5`
  - `--poll-interval 5`
  - `--sitemap include`
  - `--crawl-entire-domain true`
  - `--allow-subdomains true`
  - `--ignore-query-parameters true`
- `status`
  - `--interval 3`

## Collection Routing (Important)

- Resolved collection name uses:
  - explicit `--collection`, else
  - resolved container config `qdrantCollection` (typically from `QDRANT_COLLECTION`), else
  - `'axon'` in command-level fallback.
- `embed` has special local-routing behavior:
  - URL input: uses normal resolved/default collection.
  - file/stdin input: defaults to repo-name collection (for example `axon`) unless `--collection` is set.

Note: if your local `.env` sets `QDRANT_COLLECTION`, `--help` output may show that resolved value instead of the built-in fallback.

## Storage Defaults

- Storage root: `AXON_HOME` or `~/.axon`
- Default embed queue directory: `<storageRoot>/embed-queue`
- Queue dir override: `AXON_EMBEDDER_QUEUE_DIR` (legacy fallback: `FIRECRAWL_EMBEDDER_QUEUE_DIR`)
