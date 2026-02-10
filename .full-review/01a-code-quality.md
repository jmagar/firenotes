# Code Quality Review: cli-firecrawl

**Date**: 2026-02-09
**Branch**: `feat/phase-3-legacy-cleanup`
**Scope**: 86 TypeScript source files (~51,160 lines) across `src/`
**Reviewer**: Claude Code (Opus 4.6)

---

## Executive Summary

The cli-firecrawl codebase demonstrates a reasonably mature CLI application with good dependency injection patterns, well-structured embedding pipeline architecture, and consistent error handling in several areas. However, this review identifies **42 findings** across the codebase, including **3 Critical**, **10 High**, **18 Medium**, and **11 Low** severity issues.

The most impactful areas for improvement are:
1. **Logic Bug** in `isUrl()` that returns `true` on parse failure (Critical)
2. **Potential double lock release** in `tryClaimJob()` (Critical)
3. **God function** `executeJobStatus()` at 230+ lines with high cyclomatic complexity (High)
4. **Duplicated code blocks** across multiple files totaling ~200 lines (High)
5. **40+ scattered `process.exit(1)` calls** undermining testability and composability (High)

---

## Table of Contents

- [Critical Findings](#critical-findings)
- [High Severity Findings](#high-severity-findings)
- [Medium Severity Findings](#medium-severity-findings)
- [Low Severity Findings](#low-severity-findings)
- [Summary Statistics](#summary-statistics)

---

## Critical Findings

### C-01: `isUrl()` Returns `true` on URL Parse Failure

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/url.ts` (line 14)
**Category**: Correctness Bug

The `isUrl()` function has a logic error where the `catch` block returns `true` instead of `false`. When a string starts with `http://` or `https://` but fails to parse as a valid URL, the function incorrectly reports it as a valid URL.

```typescript
// Current (BUGGY):
export function isUrl(str: string): boolean {
  if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return true; // BUG: Should be false
    }
  }
  // ...
}
```

**Impact**: Any malformed URL string starting with `http://` or `https://` will be accepted as valid, potentially causing downstream API calls with invalid URLs that fail with confusing error messages. This affects scrape, crawl, map, and search commands since they all use `isUrl()` for input validation in `src/index.ts`.

**Fix**:
```typescript
export function isUrl(str: string): boolean {
  if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false; // Parse failure means not a valid URL
    }
  }
  // ...
}
```

---

### C-02: Double Lock Release in `tryClaimJob()`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 177-256)
**Category**: Concurrency / Resource Management

The `tryClaimJob()` function calls `release()` in both the `try` block (lines 192, 202) and the `finally` block (line 243). When the happy path succeeds, `release()` is called once in `try` and once in `finally`, resulting in a double release. While `proper-lockfile` may handle this gracefully, this is a correctness issue that could lead to unexpected errors or log noise.

```typescript
export async function tryClaimJob(jobId: string): Promise<boolean> {
  let release: (() => void) | undefined;
  try {
    release = await lockfile.lock(jobPath, { retries: 0, stale: 60000 });

    // ...
    if (!job || job.status !== 'pending') {
      await release();        // <-- First release (early return path)
      return false;
    }

    // ...
    await release();          // <-- First release (success path)
    return true;
  } catch (error) {
    // ...
    return false;
  } finally {
    if (release) {
      try {
        await release();      // <-- Second release (ALWAYS runs)
      } catch (releaseError) {
        // ...
      }
    }
  }
}
```

**Impact**: On the success path, the lock is released twice. On the early-return path (`job.status !== 'pending'`), the lock is also released twice. The `finally` block always executes after both `try` and `catch`, meaning every successful lock acquisition results in double release.

**Fix**: Remove `release()` calls from the `try` block and rely solely on `finally` for cleanup:

```typescript
export async function tryClaimJob(jobId: string): Promise<boolean> {
  const jobPath = getJobPath(jobId);
  if (!(await pathExists(jobPath))) return false;

  let release: (() => void) | undefined;
  try {
    release = await lockfile.lock(jobPath, { retries: 0, stale: 60000 });
    const data = await fs.readFile(jobPath, 'utf-8');
    const job: EmbedJob = JSON.parse(data);

    if (!job || job.status !== 'pending') {
      return false;  // finally will release
    }

    job.status = 'processing';
    job.updatedAt = new Date().toISOString();
    await writeSecureFile(jobPath, JSON.stringify(job, null, 2));
    return true;     // finally will release
  } catch (error) {
    // ... error handling unchanged ...
    return false;
  } finally {
    if (release) {
      try {
        await release();
      } catch (releaseError) {
        console.error(
          fmt.error(`Failed to release lock for job ${jobId}: ${
            releaseError instanceof Error ? releaseError.message : String(releaseError)
          }`)
        );
      }
    }
  }
}
```

---

### C-03: `job-history.ts` Uses `process.cwd()` for Data Path

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/job-history.ts` (line 21)
**Category**: Correctness / Data Integrity

The job history module resolves its storage directory using `process.cwd()`:

```typescript
const HISTORY_DIR = join(process.cwd(), '.cache');
const HISTORY_PATH = join(HISTORY_DIR, 'job-history.json');
```

This means the job history file location changes depending on which directory the user runs the CLI from. Running `firecrawl status` from `/home/user/project-a` versus `/home/user/project-b` will read different history files. Users will see different status results depending on their working directory, and job IDs recorded in one directory are invisible from another.

**Impact**: The status command (`status.ts` line 326-328) calls `getRecentJobIds()` which reads from this path. Users will get inconsistent status results and may think their jobs have disappeared.

**Fix**: Use the same `~/.config/firecrawl-cli/` directory used by `embed-queue.ts` and `credentials.ts`:

```typescript
const HISTORY_DIR = join(
  process.env.HOME ?? process.env.USERPROFILE ?? '.',
  '.config',
  'firecrawl-cli'
);
const HISTORY_PATH = join(HISTORY_DIR, 'job-history.json');
```

---

## High Severity Findings

### H-01: God Function `executeJobStatus()` -- 230+ Lines, High Cyclomatic Complexity

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (lines 305-537)
**Category**: Complexity / Maintainability

The `executeJobStatus()` function spans 230+ lines with an estimated cyclomatic complexity of 25+. It handles:
- Cleaning up old jobs
- Summarizing embed queues
- Parsing and resolving IDs for crawl, batch, and extract jobs
- Making parallel API calls with timeouts
- Pruning stale job IDs from history
- Building URL-to-ID maps from crawl data
- Updating embed job URLs
- Filtering, sorting, and slicing embed jobs by status (three near-identical blocks)
- Sorting and slicing crawl, batch, and extract results
- Assembling a complex return object

**Impact**: The function is extremely difficult to test in isolation, hard to reason about, and resistant to modification. Any change risks breaking unrelated behavior.

**Fix**: Decompose into focused helper functions:

```typescript
// Extract repeated filter-sort-slice pattern
function filterSortSlice<T extends { updatedAt: string }>(
  items: T[],
  predicate: (item: T) => boolean,
  limit: number = 10
): T[] {
  return items
    .filter(predicate)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

// Extract ID resolution
function resolveJobIds(
  explicitIds: string[],
  recentIds: string[],
  additionalIds: string[] = []
): string[] {
  return filterValidJobIds(
    explicitIds.length > 0
      ? explicitIds
      : Array.from(new Set([...recentIds, ...additionalIds])).slice(0, 10)
  );
}

// Extract parallel API fetch
async function fetchJobStatuses(
  client: Firecrawl,
  crawlIds: string[],
  batchIds: string[],
  extractIds: string[],
  timeoutMs: number
): Promise<{ crawls: any[]; batches: any[]; extracts: any[]; activeCrawls: any }> {
  // ... parallel fetch logic ...
}
```

---

### H-02: Duplicated Stale Job Error Handler in `background-embedder.ts`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts` (lines 510-557)
**Category**: Code Duplication (DRY Violation)

The stale job processing error handler is copy-pasted identically between the initial invocation (lines 510-532) and the interval callback (lines 534-557). Both blocks contain identical `.then()` and `.catch()` handlers:

```typescript
// Block 1 (lines 510-532): Initial one-time call
void processStaleJobsOnce(container, staleMs)
  .then(() => {
    if (consecutiveFailures > 0) {
      console.error(fmt.dim('[Embedder] Stale job processing recovered'));
      consecutiveFailures = 0;
    }
  })
  .catch((error) => {
    consecutiveFailures++;
    const failureMsg = `[Embedder] Failed to process stale jobs...`;
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
      console.error(fmt.error(`CRITICAL: ${failureMsg}`));
      // ...
    } else {
      console.error(fmt.error(failureMsg));
    }
  });

// Block 2 (lines 534-557): Identical code inside setInterval
const intervalId = setInterval(() => {
  void processStaleJobsOnce(container, staleMs)
    .then(() => { /* IDENTICAL */ })
    .catch((error) => { /* IDENTICAL */ });
}, intervalMs);
```

**Impact**: ~50 lines of exact duplication. Any bug fix or logging change must be applied in two places.

**Fix**: Extract to a named function:

```typescript
function runStaleJobProcessing(container: IContainer, staleMs: number): void {
  void processStaleJobsOnce(container, staleMs)
    .then(() => {
      if (consecutiveFailures > 0) {
        console.error(fmt.dim('[Embedder] Stale job processing recovered'));
        consecutiveFailures = 0;
      }
    })
    .catch((error) => {
      consecutiveFailures++;
      const failureMsg = `[Embedder] Failed to process stale jobs (${consecutiveFailures} consecutive failures): ${
        error instanceof Error ? error.message : String(error)
      }`;
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
        console.error(fmt.error(`CRITICAL: ${failureMsg}`));
        console.error(fmt.error('[Embedder] Daemon may be unhealthy - check TEI/Qdrant connectivity'));
      } else {
        console.error(fmt.error(failureMsg));
      }
    });
}

// Usage
runStaleJobProcessing(container, staleMs);
const intervalId = setInterval(() => runStaleJobProcessing(container, staleMs), intervalMs);
```

---

### H-03: `QdrantService` Pagination Duplication Between `scrollByUrl` and `scrollAll`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/QdrantService.ts` (lines 277-346, 461-530)
**Category**: Code Duplication (DRY Violation)

The `scrollByUrl()` and `scrollAll()` methods contain nearly identical pagination logic (~70 lines each). Both methods:
1. Initialize `allPoints` and `offset` variables
2. Loop with `isFirstPage` sentinel
3. Build request body with `limit`, `with_payload`, filter
4. POST to `/points/scroll`
5. Parse response and push points
6. Update offset from `next_page_offset`

The only differences are:
- `scrollByUrl` uses a fixed URL filter; `scrollAll` uses an optional generic filter
- `scrollByUrl` includes `with_vector: true`; `scrollAll` uses `with_vector: false`
- `scrollByUrl` sorts by `chunk_index` after; `scrollAll` does not

**Fix**: Extract a generic pagination helper:

```typescript
private async scrollPaginated<T>(
  collection: string,
  options: {
    filter?: Record<string, unknown>;
    withVector: boolean;
    mapPoint: (p: { id: string; vector?: number[]; payload?: Record<string, unknown> }) => T;
  }
): Promise<T[]> {
  const allPoints: T[] = [];
  let offset: string | number | null = null;
  let isFirstPage = true;

  while (isFirstPage || offset !== null) {
    isFirstPage = false;
    const body: Record<string, unknown> = {
      limit: SCROLL_PAGE_SIZE,
      with_payload: true,
      with_vector: options.withVector,
    };
    if (options.filter) body.filter = options.filter;
    if (offset !== null) body.offset = offset;

    const response = await this.httpClient.fetchWithRetry(
      `${this.qdrantUrl}/collections/${collection}/points/scroll`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
    );

    if (!response.ok) {
      throw new Error(await this.formatError(response, 'Qdrant scroll failed'));
    }

    const data = (await response.json()) as { result?: { points?: any[]; next_page_offset?: string | number | null } };
    for (const p of data.result?.points || []) {
      allPoints.push(options.mapPoint(p));
    }
    offset = data.result?.next_page_offset ?? null;
  }

  return allPoints;
}
```

---

### H-04: 40+ `process.exit(1)` Calls Scattered Across Commands

**Files**: Multiple (see grep results above)
**Category**: Testability / Composability

The codebase contains 40+ `process.exit(1)` calls scattered across 18 files. Notable concentrations:
- `src/commands/config.ts` -- 4 calls
- `src/commands/batch.ts` -- 4 calls
- `src/commands/completion.ts` -- 6 calls
- `src/commands/search.ts` -- 3 calls
- `src/commands/extract.ts` -- 3 calls
- `src/commands/scrape.ts` -- 2 calls
- `src/utils/auth.ts` -- 1 call (in `ensureAuthenticated`)
- `src/utils/output.ts` -- 1 call
- `src/utils/command.ts` -- 1 call (configurable via `exitOnError`)

**Impact**:
- Makes functions impossible to unit test without mocking `process.exit`
- Prevents function composition (callers cannot handle errors)
- Breaks graceful shutdown patterns
- Commander.js has its own error handling that gets bypassed

**Fix**: Replace `process.exit(1)` with thrown errors. Commander.js will catch unhandled errors from action handlers. For commands, use a central error boundary:

```typescript
// In command.ts, the handleCommandError already exists but isn't used everywhere
export function handleCommandError(error: unknown, exitOnError = true): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(fmt.error(message));
  if (exitOnError) {
    process.exitCode = 1; // Set exit code without forcing immediate exit
  }
}
```

Then in each command handler, throw errors instead of calling `process.exit(1)`:

```typescript
// Before:
if (!apiKey) {
  console.error(fmt.error('API key required'));
  process.exit(1);
}

// After:
if (!apiKey) {
  throw new Error('API key required');
}
```

---

### H-05: `Container.ts` Uses `require()` Instead of Dynamic `import()`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/Container.ts` (lines 79, 101, 127, 145)
**Category**: Type Safety / Best Practices

Four service getters use CommonJS `require()` with type assertions (`as IType`) instead of dynamic `import()`:

```typescript
// Current:
const { HttpClient } = require('./services/HttpClient');
this.httpClient = new HttpClient() as IHttpClient;

const { TeiService } = require('./services/TeiService');
this.teiService = new TeiService(this.config.teiUrl, this.getHttpClient()) as ITeiService;

const { QdrantService } = require('./services/QdrantService');
const { EmbedPipeline } = require('./services/EmbedPipeline');
```

**Impact**:
- Bypasses TypeScript type checking entirely at the module boundary
- `as IType` assertions silently hide type mismatches
- Makes refactoring error-prone since renames won't be caught
- ESLint `@typescript-eslint/no-require-imports` rule would flag this

**Fix**: Use dynamic `import()` which preserves type information:

```typescript
async getHttpClient(): Promise<IHttpClient> {
  if (!this.httpClient) {
    const { HttpClient } = await import('./services/HttpClient');
    this.httpClient = new HttpClient();
  }
  return this.httpClient;
}
```

Note: This requires changing the return type to `Promise<IHttpClient>` and making callers `await` the result. If synchronous access is required, initialize services in a factory method and verify types at compile time.

---

### H-06: `shouldOutputJson` Function Defined in Two Locations

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/utils/output.ts` (line 74)
- `/home/jmagar/workspace/cli-firecrawl/src/utils/command.ts` (line 147)
**Category**: Code Duplication

Two different `shouldOutputJson` functions exist with different signatures:

```typescript
// output.ts (line 74) - takes separate parameters
function shouldOutputJson(outputPath?: string, jsonFlag?: boolean): boolean {
  // ...
}

// command.ts (line 147) - takes options object
export function shouldOutputJson(options: CommonOutputOptions): boolean {
  // ...
}
```

Both are used by different callers (`batch.ts` imports from `command.ts`; `output.ts` uses its internal version). Having two functions with the same name and slightly different behavior creates confusion.

**Fix**: Consolidate into a single implementation in `command.ts` and have `output.ts` use it:

```typescript
// command.ts - single source of truth
export function shouldOutputJson(options: { output?: string; json?: boolean }): boolean {
  return !!(options.json || (options.output && options.output.endsWith('.json')));
}
```

---

### H-07: `MAX_CONCURRENT_EMBEDS` Constant Defined in Three Files

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/container/services/EmbedPipeline.ts` (line 20)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/extract.ts` (line 21)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/search.ts` (line 32)
**Category**: DRY Violation

The constant `MAX_CONCURRENT_EMBEDS = 10` is independently defined in three files. If the concurrency limit needs adjustment (e.g., based on resource profiling), all three must be updated in sync.

**Fix**: Define once in a shared constants file:

```typescript
// src/utils/constants.ts
export const MAX_CONCURRENT_EMBEDS = 10;
```

Then import from all three locations.

---

### H-08: Embed Job Filter-Sort-Slice Pattern Repeated Three Times in `status.ts`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (lines 465-517)
**Category**: Code Duplication

Three near-identical blocks filter embed jobs by status, map to a subset of fields, sort by `updatedAt` descending, and slice to 10 items:

```typescript
// Block 1: Failed embeds (lines 465-479)
const failedEmbeds = embedQueue.jobs
  .filter((job) => job.status === 'failed')
  .map((job) => ({ jobId: job.jobId, url: job.url, retries: job.retries, ... }))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 10);

// Block 2: Pending embeds (lines 480-493) -- nearly identical
const pendingEmbeds = embedQueue.jobs
  .filter((job) => job.status === 'pending')
  .map((job) => ({ jobId: job.jobId, url: job.url, retries: job.retries, ... }))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 10);

// Block 3: Completed embeds (lines 494-506) -- nearly identical
const completedEmbeds = embedQueue.jobs
  .filter((job) => job.status === 'completed')
  .map((job) => ({ jobId: job.jobId, url: job.url, ... }))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 10);
```

Similarly, lines 509-517 repeat the sort-and-slice pattern for crawl, batch, and extract results.

**Fix**:
```typescript
function recentByStatus(
  jobs: EmbedJob[],
  status: EmbedJob['status'],
  limit = 10
): EmbedJob[] {
  return jobs
    .filter((job) => job.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

const failedEmbeds = recentByStatus(embedQueue.jobs, 'failed');
const pendingEmbeds = recentByStatus(embedQueue.jobs, 'pending');
const completedEmbeds = recentByStatus(embedQueue.jobs, 'completed');
```

---

### H-09: Prune ID Pattern Repeated Three Times in `status.ts`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (lines 416-431)
**Category**: Code Duplication

Three identical blocks filter, map, and prune job IDs:

```typescript
const crawlPruneIds = crawlStatuses
  .filter((status) => shouldPruneError((status as { error?: string }).error))
  .map((status) => status.id)
  .filter((id): id is string => Boolean(id));
const batchPruneIds = batchStatuses
  .filter((status) => shouldPruneError((status as { error?: string }).error))
  .map((status) => status.id)
  .filter((id): id is string => Boolean(id));
const extractPruneIds = extractStatuses
  .filter((status) => shouldPruneError((status as { error?: string }).error))
  .map((status) => status.id)
  .filter((id): id is string => Boolean(id));

await removeJobIds('crawl', crawlPruneIds);
await removeJobIds('batch', batchPruneIds);
await removeJobIds('extract', extractPruneIds);
```

**Fix**:
```typescript
function extractPruneIds(statuses: Array<{ id?: string; error?: string }>): string[] {
  return statuses
    .filter((s) => shouldPruneError(s.error))
    .map((s) => s.id)
    .filter((id): id is string => Boolean(id));
}

const pruneMap: Array<[JobType, string[]]> = [
  ['crawl', extractPruneIds(crawlStatuses)],
  ['batch', extractPruneIds(batchStatuses)],
  ['extract', extractPruneIds(extractStatuses)],
];
await Promise.all(pruneMap.map(([type, ids]) => removeJobIds(type, ids)));
```

---

### H-10: Duplicate `declare module 'commander'` Augmentation

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/index.ts` (lines 58-62)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/batch.ts` (lines 22-26)
**Category**: Type Safety / DRY Violation

Both files contain identical module augmentation:

```typescript
declare module 'commander' {
  interface Command {
    _container?: IContainer;
  }
}
```

Module augmentations in TypeScript are global -- the second declaration is redundant but could diverge and cause confusion.

**Fix**: Move the augmentation to a single shared type declaration file:

```typescript
// src/types/commander.d.ts
import type { IContainer } from '../container/types';

declare module 'commander' {
  interface Command {
    _container?: IContainer;
  }
}
```

Then remove both inline declarations.

---

## Medium Severity Findings

### M-01: Non-Top-Level Imports in 7 Command Files

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/commands/map.ts` (line 487)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/search.ts` (line 363)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/extract.ts` (line 196)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/query.ts` (line 219)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/config.ts` (line 266)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/login.ts` (line 74)
- `/home/jmagar/workspace/cli-firecrawl/src/commands/embed.ts` (line 182)
**Category**: Code Organization

Multiple command files place `import { Command } from 'commander'` at the bottom of the file, after all function definitions. While this works in TypeScript/CommonJS due to hoisting, it violates the conventional import-first pattern and makes dependency scanning harder.

**Impact**: Confuses code readers and tools. IDE "organize imports" may move them unexpectedly.

**Fix**: Move all imports to the top of each file. If the pattern was intentional for code splitting, document it with a comment.

---

### M-02: `status.ts` is 1023 Lines -- File-Level Complexity

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts`
**Category**: Maintainability

At 1023 lines, `status.ts` is the largest file in the codebase. It contains:
- 4 interface definitions
- 12+ functions
- Complex display formatting logic
- API interaction logic
- Queue management logic
- History management logic

**Impact**: Cognitive load for any developer touching this file is very high. Changes risk unintended side effects.

**Fix**: Split into focused modules:
- `status/types.ts` -- interfaces
- `status/data.ts` -- `executeJobStatus()` and data fetching
- `status/render.ts` -- all `render*` functions
- `status/command.ts` -- Commander command definition
- `status/embed-context.ts` -- `getEmbedContext()` (already exported/tested)

---

### M-03: `QdrantService` Count Methods Are Copy-Paste

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/QdrantService.ts`
**Category**: Code Duplication

Three count methods (`countPoints`, `countByUrl`, `countByDomain`) at lines 538-586 follow nearly identical patterns -- POST to `/points/count` with varying filters. Similarly, `deleteByUrl` and `deleteByDomain` share the same pattern with different filter keys.

**Fix**: Extract a generic helper:

```typescript
private async countWithFilter(
  collection: string,
  filter?: { key: string; value: string }
): Promise<number> {
  const body: Record<string, unknown> = { exact: true };
  if (filter) {
    body.filter = { must: [{ key: filter.key, match: { value: filter.value } }] };
  }
  const response = await this.httpClient.fetchWithRetry(
    `${this.qdrantUrl}/collections/${collection}/points/count`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
  );
  if (!response.ok) throw new Error(await this.formatError(response, 'Qdrant count failed'));
  const data = (await response.json()) as { result?: { count?: number } };
  return data.result?.count ?? 0;
}

async countPoints(collection: string): Promise<number> {
  return this.countWithFilter(collection);
}
async countByUrl(collection: string, url: string): Promise<number> {
  return this.countWithFilter(collection, { key: 'url', value: url });
}
async countByDomain(collection: string, domain: string): Promise<number> {
  return this.countWithFilter(collection, { key: 'domain', value: domain });
}
```

---

### M-04: `embed-queue.ts` Read-Modify-Write Pattern Not Atomic

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts`
**Category**: Concurrency

Functions `markJobProcessing`, `markJobCompleted`, `markJobFailed`, `markJobConfigError`, and `updateJobProgress` (lines 384-525) all follow a read-modify-write pattern without file locking:

```typescript
export async function markJobProcessing(jobId: string): Promise<void> {
  const job = await getEmbedJob(jobId);  // READ
  if (job) {
    job.status = 'processing';           // MODIFY
    await updateEmbedJob(job);           // WRITE
  }
}
```

If two processes attempt to update the same job simultaneously, one update will be silently lost. Only `tryClaimJob()` uses proper locking.

**Impact**: In production with the daemon running, concurrent access is possible when the CLI and daemon both operate on the same job.

**Fix**: Apply file locking consistently, or consolidate all mutations through a single locked update function:

```typescript
async function withJobLock<T>(
  jobId: string,
  operation: (job: EmbedJob) => T | Promise<T>
): Promise<T | null> {
  const jobPath = getJobPath(jobId);
  if (!(await pathExists(jobPath))) return null;

  const release = await lockfile.lock(jobPath, { retries: 2, stale: 60000 });
  try {
    const data = await fs.readFile(jobPath, 'utf-8');
    const job: EmbedJob = JSON.parse(data);
    const result = await operation(job);
    job.updatedAt = new Date().toISOString();
    await writeSecureFile(jobPath, JSON.stringify(job, null, 2));
    return result;
  } finally {
    await release();
  }
}
```

---

### M-05: `job-history.ts` Has No File Locking

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/job-history.ts`
**Category**: Concurrency

The `recordJob()` and `removeJobIds()` functions perform read-modify-write operations on `job-history.json` without any locking mechanism. If two CLI instances record jobs simultaneously, one write will overwrite the other.

**Impact**: Lost job history entries. Less severe than embed queue since history is advisory, but still a data integrity issue.

**Fix**: Use `proper-lockfile` (already a dependency) around `saveHistory()` calls.

---

### M-06: Excessive `type` Assertions (`as`) in `status.ts`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts`
**Category**: Type Safety

Multiple type assertions are used to extract error information and progress data from API responses:

```typescript
const crawlError = (crawl as { error?: string }).error;  // line 581
const batchError = (batch as { error?: string }).error;   // line 689
const maybeData = (crawl as { data?: Array<{ metadata?: ... }> }).data;  // line 438-441
(crawl as { url?: string }).url = displayUrl;  // line 449 -- MUTATION via assertion
```

Line 449 is especially concerning: it uses a type assertion to mutate a property on an object that may not have a `url` field, silently adding it without type checking.

**Fix**: Define proper response types for Firecrawl API responses:

```typescript
interface CrawlStatusResponse {
  id: string;
  status: string;
  completed?: number;
  total?: number;
  url?: string;
  error?: string;
  data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
}
```

---

### M-07: `renderBatchSection` and `renderExtractSection` Are Nearly Identical

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (lines 680-749)
**Category**: Code Duplication

`renderBatchSection()` and `renderExtractSection()` both:
1. Print a heading
2. Check for empty results
3. Loop through items
4. Extract error, compute icon/color
5. Print formatted line with optional progress

The only differences are heading text ("Batch Status" vs "Extract Status") and the presence of progress display in batch.

**Fix**: Create a generic `renderJobSection()`:

```typescript
function renderJobSection(
  heading: string,
  items: Array<{ id?: string; status?: string; error?: string; completed?: number; total?: number }>,
  showProgress = false
): void {
  console.log('');
  console.log(statusHeading(heading));
  if (items.length === 0) {
    console.log(fmt.dim(`  No recent ${heading.toLowerCase()} found.`));
    return;
  }
  for (const item of items) {
    const error = item.error;
    const icon = getStatusIcon(item.status ?? 'unknown', !!error);
    const statusColor = getStatusColor(item.status ?? 'unknown', !!error);
    // ... render logic
  }
}
```

---

### M-08: `summarizeEmbedQueue` Duplicates `getQueueStats`

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (lines 144-178)
- `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 442-470)
**Category**: Code Duplication

`summarizeEmbedQueue()` in `status.ts` reimplements the status counting logic that `getQueueStats()` in `embed-queue.ts` already provides. Both iterate through all jobs and count by status.

**Fix**: Use `getQueueStats()` from `embed-queue.ts` in `status.ts`, and add a combined function that returns both stats and jobs in a single pass if needed:

```typescript
const jobs = await listEmbedJobs();
const summary = await getQueueStats(); // Use existing function
return { summary, jobs };
```

---

### M-09: `theme.ts` Standalone Functions Duplicate `fmt.*` Methods

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/theme.ts` (lines 190-253)
**Category**: API Inconsistency / Duplication

Module-level functions `success()`, `error()`, `warning()`, `info()` exist alongside the `fmt` object which has `fmt.success()`, `fmt.error()`, `fmt.warning()`, `fmt.info()`. Both sets are exported and both are used by different callers:

```typescript
// Two ways to do the same thing:
import { fmt } from './theme';
console.error(fmt.error('Something failed'));

import { error } from './theme';
console.error(error('Something failed'));
```

The standalone versions add icons and use `colorize`, while `fmt.*` versions just apply ANSI colors. They behave differently despite having the same names.

**Impact**: Developers may use the wrong version, leading to inconsistent output formatting.

**Fix**: Rename the standalone versions to be distinct (e.g., `formatError`, `formatWarning`) or deprecate them in favor of `fmt.*` with consistent behavior.

---

### M-10: `getEmbedJobDetailed` Returns `job` but Doesn't Validate Shape

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 131-151)
**Category**: Input Validation

The function reads a JSON file and casts it directly to `EmbedJob` without any validation:

```typescript
const data = await fs.readFile(path, 'utf-8');
const job = JSON.parse(data);  // No validation!
return { job, status: 'found' };
```

If the JSON file contains valid JSON but doesn't match the `EmbedJob` schema (e.g., missing `status` field, wrong types), callers will get runtime errors at unexpected locations.

**Fix**: Add minimal runtime validation:

```typescript
function isValidEmbedJob(data: unknown): data is EmbedJob {
  return (
    typeof data === 'object' && data !== null &&
    'id' in data && typeof (data as EmbedJob).id === 'string' &&
    'status' in data && ['pending', 'processing', 'completed', 'failed'].includes((data as EmbedJob).status)
  );
}
```

Or use Zod (already a project dependency for `credentials.ts`).

---

### M-11: `config.ts` Uses Long If-Else Chain for Key Validation

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/config.ts`
**Category**: Maintainability

The `handleConfigGet` function uses a long if-else chain to validate configuration key names. Each branch is a string comparison:

```typescript
if (key === 'api-key') { ... }
else if (key === 'api-url') { ... }
else if (key === 'tei-url') { ... }
// ... etc.
```

**Fix**: Use a lookup map:

```typescript
const CONFIG_KEYS: Record<string, (config: ImmutableConfig) => string | undefined> = {
  'api-key': (c) => c.apiKey ? '****' : undefined,
  'api-url': (c) => c.apiUrl,
  'tei-url': (c) => c.teiUrl,
  'qdrant-url': (c) => c.qdrantUrl,
  // ... etc.
};

function handleConfigGet(config: ImmutableConfig, key: string): void {
  const getter = CONFIG_KEYS[key];
  if (!getter) {
    throw new Error(`Unknown config key: ${key}. Valid keys: ${Object.keys(CONFIG_KEYS).join(', ')}`);
  }
  const value = getter(config);
  console.log(value ?? '(not set)');
}
```

---

### M-12: `embed-queue.ts` `markJobFailed` Has Asymmetric Status Logic

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 408-419)
**Category**: Correctness

The `markJobFailed` function has logic that sets status conditionally but always increments retries:

```typescript
job.status = job.retries + 1 >= job.maxRetries ? 'failed' : 'pending';
job.retries += 1;
```

The comparison uses `job.retries + 1` but then increments afterward. This means:
- If `retries = 2` and `maxRetries = 3`: `2 + 1 >= 3` is `true`, status becomes `'failed'`, retries becomes `3`. Correct.
- If `retries = 1` and `maxRetries = 3`: `1 + 1 >= 3` is `false`, status becomes `'pending'`, retries becomes `2`. Correct.

The logic is technically correct but the pre-increment comparison is confusing. It would be clearer to increment first:

```typescript
job.retries += 1;
job.status = job.retries >= job.maxRetries ? 'failed' : 'pending';
job.lastError = error;
```

---

### M-13: `embed-queue.ts` Stores API Key in Plain Text on Disk

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (line 111)
**Category**: Security

The `EmbedJob` interface includes an `apiKey?: string` field that gets serialized to JSON files on disk:

```typescript
const job: EmbedJob = {
  // ...
  apiKey,  // Stored in plain text in JSON file
};
await writeSecureFile(getJobPath(jobId), JSON.stringify(job, null, 2));
```

While the file is written with `0o600` permissions (owner-only), the API key is still stored in plain text. If the queue directory is on shared storage or if file permissions are bypassed, the key is exposed.

**Impact**: API keys persisted to disk in plain text could be accessed by other processes or users if file permissions are compromised.

**Fix**: Either encrypt the API key before storage, or don't store it at all (retrieve from the credential store when processing the job).

---

### M-14: `index.ts` Contains Inline ANSI Gradient Functions

**File**: `/home/jmagar/workspace/cli-firecrawl/src/index.ts`
**Category**: Code Organization

The entry point file contains inline ANSI color helper functions (`fg256()`, `bg256()`, `gradientText()`) that duplicate the functionality available in `theme.ts`. These are used only for the startup banner.

**Fix**: Move banner rendering and any custom ANSI utilities into `theme.ts` or a separate `banner.ts` module.

---

### M-15: `EmbedPipeline.batchEmbed()` Tracks `failedUrls` But Result Doesn't Include Them

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/EmbedPipeline.ts` (lines 158, 186, 231-236)
**Category**: API Design

The `batchEmbed()` method collects `failedUrls` into a local array and logs them, but the return type only includes `{ succeeded: number; failed: number; errors: string[] }`. Callers cannot programmatically access which specific URLs failed without parsing the `errors` array strings.

**Fix**: Add `failedUrls` to the return type:

```typescript
async batchEmbed(...): Promise<{
  succeeded: number;
  failed: number;
  errors: string[];
  failedUrls: string[];  // Add this
}> {
```

---

### M-16: `embed-queue.ts` Functions Don't Validate Job Existence Consistently

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts`
**Category**: Error Handling

Functions like `markJobProcessing`, `markJobCompleted`, `markJobFailed`, and `markJobConfigError` silently return `undefined` when the job doesn't exist:

```typescript
export async function markJobProcessing(jobId: string): Promise<void> {
  const job = await getEmbedJob(jobId);
  if (job) {
    job.status = 'processing';
    await updateEmbedJob(job);
  }
  // Silently returns undefined if job not found
}
```

**Impact**: Callers have no way to know if the operation succeeded or if the job was not found. In the daemon, this could lead to jobs being silently dropped.

**Fix**: Return a boolean indicating success, or throw an error for missing jobs:

```typescript
export async function markJobProcessing(jobId: string): Promise<boolean> {
  const job = await getEmbedJob(jobId);
  if (!job) return false;
  job.status = 'processing';
  await updateEmbedJob(job);
  return true;
}
```

---

### M-17: `QdrantService.ensureCollection()` Cache TTL is Indefinite

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/QdrantService.ts`
**Category**: Correctness

The `collectionExistsCache` uses `lru-cache` to cache whether a collection exists, but the cache has no TTL. Once a collection is confirmed to exist, it is cached forever for the lifetime of the process. If a collection is deleted externally (e.g., via Qdrant API directly), the cache will return stale data.

**Impact**: The daemon process runs indefinitely, so the cache will never invalidate. A deleted collection will still be considered "existing" and upsert operations will fail with confusing errors.

**Fix**: Add a TTL to the cache:

```typescript
const collectionExistsCache = new LRUCache<string, boolean>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

---

### M-18: `tryClaimJob` Error Classification Has Maintainability Issue

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 209-236)
**Category**: Maintainability

The error classification in `tryClaimJob` uses a long if-else chain with string matching:

```typescript
if (errorMsg.includes('EACCES')) { ... }
else if (errorMsg.includes('ENOSPC')) { ... }
else if (errorMsg.includes('EIO')) { ... }
else if (errorName === 'SyntaxError') { ... }
else if (errorMsg.includes('lock')) { ... }
else { ... }
```

This is fragile and hard to extend. New error types require modifying the chain.

**Fix**: Use a map-based approach:

```typescript
const ERROR_CLASSIFIERS: Array<{ test: (msg: string, name: string) => boolean; label: string }> = [
  { test: (msg) => msg.includes('EACCES'), label: 'Permission denied (EACCES)' },
  { test: (msg) => msg.includes('ENOSPC'), label: 'No space left on device (ENOSPC)' },
  { test: (msg) => msg.includes('EIO'), label: 'I/O error (EIO)' },
  { test: (_, name) => name === 'SyntaxError', label: 'Corrupted JSON in job file' },
  { test: (msg) => msg.includes('lock'), label: 'Lock acquisition failed' },
];

const classifier = ERROR_CLASSIFIERS.find(c => c.test(errorMsg, errorName));
const label = classifier ? classifier.label : `${errorName} - ${errorMsg}`;
console.error(fmt.error(`Failed to claim job ${jobId}: ${label}`));
```

---

## Low Severity Findings

### L-01: `embed-queue.ts` `getQueueStats` Reimplements Status Counting

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 442-470)
**Category**: Minor Duplication

The `getQueueStats()` function uses a `switch` statement to count jobs by status. This could be simplified using `reduce` with a typed accumulator, or even better, reuse the `summarizeEmbedQueue` pattern from `status.ts`.

---

### L-02: `options.ts` Contains Trivial Pass-Through Functions

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/options.ts`
**Category**: Over-Engineering

Functions like `parseDeleteOptions` and `parseInfoOptions` simply extract a subset of properties from an object and return them. They add a function call overhead with zero logic:

```typescript
export function parseDeleteOptions(options: Record<string, unknown>) {
  return {
    apiKey: options.apiKey as string | undefined,
    // ...
  };
}
```

**Fix**: Either add meaningful validation logic to justify these functions, or inline the property access at call sites.

---

### L-03: `extractDomain` Returns 'unknown' Instead of Throwing

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/url.ts` (lines 45-51)
**Category**: Error Handling Style

```typescript
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
```

Returning `'unknown'` as a sentinel value means callers must check for it. This is a minor concern since `'unknown'` as a domain name is harmless in display contexts, but it could cause issues if used as a filter key.

---

### L-04: `embedder-daemon.ts` Cleanup Timeout Uses `Promise.race` with Rejection

**File**: `/home/jmagar/workspace/cli-firecrawl/src/embedder-daemon.ts` (lines 57-68)
**Category**: Best Practices

The timeout mechanism creates a rejecting promise that is never cleaned up if cleanup succeeds first:

```typescript
await Promise.race([
  cleanup(),
  new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`Cleanup timed out after ${CLEANUP_TIMEOUT_MS}ms`)), CLEANUP_TIMEOUT_MS)
  ),
]);
```

The timeout `setTimeout` will remain in the event loop even if `cleanup()` resolves first, potentially keeping the process alive briefly.

**Fix**: Use `AbortController` or clear the timeout:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), CLEANUP_TIMEOUT_MS);
try {
  await cleanup();
} finally {
  clearTimeout(timeoutId);
}
```

---

### L-05: `QdrantService` Missing `Content-Type` Header on GET Requests

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/QdrantService.ts` (line 411-414)
**Category**: Inconsistency

The `getCollectionInfo()` method makes a GET request without specifying `Content-Type`, while all POST methods include `'Content-Type': 'application/json'`. This is technically correct (GET requests don't have bodies), but the inconsistency could confuse developers maintaining the code.

---

### L-06: `embed-queue.ts` `cleanupOldJobs` Reads All Jobs to Delete a Few

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 475-495)
**Category**: Performance

`cleanupOldJobs()` reads all jobs from disk, parses them all, then only deletes a subset. For a large queue, this means reading potentially hundreds of JSON files when only a few need cleanup.

**Impact**: Minor -- the queue is unlikely to have more than a few dozen jobs in practice.

---

### L-07: Missing JSDoc on Several Exported Functions

**Files**: Various
**Category**: Documentation

Several exported functions lack JSDoc documentation:
- `getStatus()` in `status.ts` (line 71) -- has a one-liner but no `@param` or `@returns`
- `parseIds()` in `status.ts` (line 121) -- no documentation
- `filterValidJobIds()` in `status.ts` (line 131) -- no documentation
- `shouldPruneError()` in `status.ts` (line 135) -- no documentation

While these are internal to the module, exported functions should have documentation for maintainability.

---

### L-08: `writeSecureFile` Doesn't Verify Permissions Were Applied

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 28-30)
**Category**: Security

The `writeSecureFile` function sets `mode: 0o600` but doesn't verify the permissions were actually applied. On Windows, `mode` in `writeFile` is ignored.

```typescript
async function writeSecureFile(filePath: string, data: string): Promise<void> {
  await fs.writeFile(filePath, data, { mode: 0o600 });
}
```

**Fix**: This is acceptable since the `ensureQueueDir` function already has a comment noting Windows incompatibility. Consider adding a similar comment to `writeSecureFile`.

---

### L-09: `background-embedder.ts` `processEmbedJob` Function Length

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts`
**Category**: Complexity

The `processEmbedJob()` function is approximately 160 lines long, exceeding the project's 50-line function guideline (from `CLAUDE.md`). It handles HTTP fetch, response parsing, content extraction, batch embedding orchestration, progress tracking, and error handling.

**Fix**: Extract sub-operations into helper functions:
- `fetchCrawlResults()` -- HTTP fetch and response parsing
- `extractEmbeddableContent()` -- content extraction from crawl data
- `trackEmbedProgress()` -- progress callback handling

---

### L-10: `EmbedPipeline.autoEmbedInternal` Calls `ensureCollection` on Every Invocation

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/services/EmbedPipeline.ts` (lines 55-58)
**Category**: Performance

Every call to `autoEmbedInternal()` calls `ensureCollection()`, which makes a network request to check/create the collection. While `QdrantService` has an LRU cache for this, the cache lookup still adds overhead for every document embedded.

**Impact**: Minor -- the cache makes this fast after the first call.

---

### L-11: `embed-queue.ts` Uses String-Based Date Comparisons for Sorting

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 334-337)
**Category**: Fragility

```typescript
.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
```

Creating `Date` objects for every comparison in a sort is slower than necessary. Since the dates are ISO 8601 strings, lexicographic comparison works correctly:

```typescript
.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
```

This is already used in `status.ts` but not in `embed-queue.ts`.

---

## Summary Statistics

| Severity | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 3 | Logic bug, concurrency defect, data path fragility |
| **High** | 10 | Code duplication (~200 lines), god functions, type safety, testability |
| **Medium** | 18 | Duplication, concurrency, security, organization, validation |
| **Low** | 11 | Style, performance, documentation, minor inconsistencies |
| **Total** | **42** | |

### Duplication Hotspots (Estimated Duplicated Lines)

| Pattern | Files | ~Lines |
|---------|-------|--------|
| Stale job error handler | `background-embedder.ts` | 50 |
| Scroll pagination | `QdrantService.ts` | 70 |
| Filter-sort-slice embeds | `status.ts` | 45 |
| Prune ID extraction | `status.ts` | 18 |
| Batch/Extract render | `status.ts` | 40 |
| Count methods | `QdrantService.ts` | 30 |
| `shouldOutputJson` | `output.ts`, `command.ts` | 10 |
| **Total** | | **~263** |

### Complexity Hotspots (Estimated Cyclomatic Complexity)

| Function | File | ~CC | Lines |
|----------|------|-----|-------|
| `executeJobStatus` | `status.ts` | 25+ | 230 |
| `renderCrawlStatusSection` | `status.ts` | 15+ | 130 |
| `processEmbedJob` | `background-embedder.ts` | 18+ | 160 |
| `tryClaimJob` | `embed-queue.ts` | 12+ | 80 |
| `renderHumanStatus` | `status.ts` | 10+ | 90 |

### Files Needing Most Attention

1. **`src/commands/status.ts`** (1023 lines) -- 6 findings, needs decomposition
2. **`src/utils/embed-queue.ts`** (525 lines) -- 6 findings, needs lock consistency
3. **`src/container/services/QdrantService.ts`** (612 lines) -- 3 findings, needs deduplication
4. **`src/utils/background-embedder.ts`** (615 lines) -- 3 findings, needs extraction
5. **`src/container/Container.ts`** (167 lines) -- 1 finding, needs type safety fix
