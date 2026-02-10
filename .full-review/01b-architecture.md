# Architectural Review: cli-firecrawl

**Reviewer**: Claude Opus 4.6 (Software Architecture Specialist)
**Date**: 2026-02-09
**Branch**: `feat/phase-3-legacy-cleanup`
**Scope**: Full codebase -- 86 source files, 62 test files

---

## Executive Summary

The cli-firecrawl codebase demonstrates a well-structured CLI application with a clean
dependency injection container, consistent command patterns, and strong separation between
service layers. The architecture follows a layered approach: CLI entry point -> command
handlers -> execute functions -> container services -> external APIs. The DI container
(`src/container/`) is a clear architectural strength, providing immutable configuration,
lazy service initialization, and testable interfaces.

However, the codebase exhibits several architectural concerns that, if left unaddressed,
will create maintenance burden as the project grows. The most significant issues are
duplicate type definitions, inconsistent collection name defaults, mixed error handling
strategies across commands, and a partially-completed migration from legacy utility
functions to container-based services.

**Finding Summary by Severity:**

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 5 |
| Medium | 8 |
| Low | 6 |
| **Total** | **20** |

---

## Critical Findings

### C-1: Duplicate `CommandResult<T>` Type Definitions

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/types/common.ts` (lines 4-8)
- `/home/jmagar/workspace/cli-firecrawl/src/utils/command.ts` (lines 21-25)

**Description**: Two independent `CommandResult<T>` interfaces exist with identical shapes
but no shared lineage. The type in `types/common.ts` is used by all type definitions in
`src/types/*.ts` (scrape, crawl, query, embed, etc.), while the one in `utils/command.ts`
is used by the `processCommandResult`, `handleCommandError`, and `writeJsonOutput` utility
functions. These two types are structurally identical, so TypeScript's structural typing
prevents compile-time errors. However, this creates a maintenance hazard: if one definition
changes without the other, runtime behavior will diverge silently.

The `batch.ts` command imports `CommandResult` from `utils/command.ts` directly
(line 9: `type CommandResult`), while all other commands import the type transitively
through their `types/*.ts` files. This inconsistency indicates that developers have already
encountered confusion about which canonical source to use.

**Architectural Impact**: High -- violates Single Source of Truth principle. Divergence
between the two definitions would introduce subtle type incompatibilities across the
command layer.

**Recommendation**: Delete the `CommandResult` interface from `utils/command.ts` and
re-export from `types/common.ts`. Update `utils/command.ts` to import from
`../types/common`. Update `batch.ts` to import from `../types/common` as well.

---

## High Severity Findings

### H-1: Inconsistent Qdrant Collection Name Defaults

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/utils/defaults.ts` (line 10): `'firecrawl_collection'`
- `/home/jmagar/workspace/cli-firecrawl/src/commands/shared.ts` (line 37): `'firecrawl'`
- `/home/jmagar/workspace/cli-firecrawl/src/commands/scrape.ts` (line 81): `'firecrawl'`
- `/home/jmagar/workspace/cli-firecrawl/src/container/Container.ts` (line 149): `'firecrawl'`
- `/home/jmagar/workspace/cli-firecrawl/src/container/services/EmbedPipeline.ts` (line 30): `'firecrawl_collection'`
- `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts` (line 57): `'firecrawl'`
- `/home/jmagar/workspace/cli-firecrawl/src/container/config-resolver.ts` (line 106): uses `DEFAULT_QDRANT_COLLECTION` (`'firecrawl_collection'`)

**Description**: The canonical default collection name is defined as `'firecrawl_collection'`
in `utils/defaults.ts`, and this is correctly used by `config-resolver.ts` when building
the container config. However, at least four other locations provide their own fallback
default of `'firecrawl'` (without `_collection`). This means:

1. When the container config resolves correctly (the normal path), the collection name is
   `'firecrawl_collection'` via `DEFAULT_QDRANT_COLLECTION`.
2. When code directly accesses `container.config.qdrantCollection` and applies its own
   fallback (`|| 'firecrawl'`), it uses a different name.

The `EmbedPipeline` constructor default also differs from the `Container.ts` default --
the pipeline uses `'firecrawl_collection'` while the container passes `'firecrawl'` to it.
If the pipeline is ever instantiated with the container's fallback, the names would match
only by coincidence of override.

**Architectural Impact**: High -- data could be written to one collection and read from
another, causing silent data loss or "empty results" bugs that are extremely difficult to
diagnose.

**Recommendation**: Remove all inline fallback collection names. Use
`DEFAULT_QDRANT_COLLECTION` from `utils/defaults.ts` as the single source of truth.
The `resolveCollectionName()` function in `shared.ts` should import and use this constant.
The `EmbedPipeline` and `Container` should not provide their own defaults -- they should
require the collection name as a constructor parameter (which they already receive from
the container config).

### H-2: Dynamic `require()` Calls in Container for Lazy Loading

**File**: `/home/jmagar/workspace/cli-firecrawl/src/container/Container.ts` (lines 79, 101, 126, 145)

**Description**: The DI container uses `require()` calls inside getter methods to lazily
load service implementations:

```typescript
const { HttpClient } = require('./services/HttpClient');
const { TeiService } = require('./services/TeiService');
const { QdrantService } = require('./services/QdrantService');
const { EmbedPipeline } = require('./services/EmbedPipeline');
```

This pattern:
1. Defeats TypeScript's type safety -- the `require()` returns `any` and must be cast.
2. Hides dependencies from static analysis and bundlers.
3. Prevents tree-shaking if the project ever moves to ESM.
4. Prevents IDE "go to definition" from working through these boundaries.
5. Is unnecessary for lazy initialization -- the methods already short-circuit via
   memoization checks, and the service classes are lightweight constructors.

The stated purpose (avoiding circular dependencies or reducing startup time) is not
substantiated: the service files have no circular imports, and Node.js module caching
means the overhead of top-level imports is negligible.

**Architectural Impact**: High -- undermines the type safety that the rest of the
container architecture carefully maintains through interfaces and generics.

**Recommendation**: Replace all `require()` calls with top-level `import` statements.
The lazy initialization pattern (memoized getter) is preserved as-is -- only the module
loading mechanism changes. This maintains the same runtime behavior while restoring
full type safety.

### H-3: Mixed Error Handling Strategies Across Commands

**Files**: Multiple command files in `src/commands/`

**Description**: The codebase uses two incompatible error handling strategies:

**Strategy A -- `process.exit(1)`**: Used by `scrape.ts`, `search.ts`, `extract.ts`,
`batch.ts`, `config.ts`, `login.ts`, `logout.ts`, `completion.ts`, `map.ts`, `embed.ts`,
and `status.ts`. These commands call `process.exit(1)` directly on errors, preventing
the caller from handling errors gracefully and making the code untestable without
mocking `process.exit`.

**Strategy B -- `process.exitCode = 1` with `return`**: Used by `crawl/command.ts`.
This is the architecturally correct approach because it allows the Node.js event loop
to drain naturally, ensures cleanup handlers run (including the container's `dispose()`
method), and is testable without process mocking.

The shared utility `handleCommandError()` in `utils/command.ts` (line 61) also calls
`process.exit(1)`, propagating Strategy A into commands that use the shared helper
(`delete.ts`, `domains.ts`, `info.ts`, `query.ts`, `history.ts`, `retrieve.ts`, etc.).

This inconsistency means:
- Some commands trigger the graceful shutdown handler in `index.ts` (via `process.exitCode`).
- Other commands abort immediately, potentially leaving container resources undisposed.

**Architectural Impact**: High -- inconsistent resource cleanup on error paths, unreliable
testing, and violation of the graceful shutdown contract established in `index.ts`.

**Recommendation**: Standardize on `process.exitCode = 1` with early `return` across all
commands. Update `handleCommandError()` to set `process.exitCode = 1` and return `false`
instead of calling `process.exit(1)`. This aligns with the crawl command's existing
pattern and the shutdown handler's design intent.

### H-4: `shouldOutputJson` Defined Twice with Different Signatures

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/utils/output.ts` (line 74): `shouldOutputJson(outputPath?: string, jsonFlag?: boolean): boolean`
- `/home/jmagar/workspace/cli-firecrawl/src/utils/command.ts` (line 147): `shouldOutputJson(options: CommonOutputOptions): boolean`

**Description**: Two functions with identical names and identical logic exist in
different modules. The `output.ts` version takes individual parameters; the `command.ts`
version takes an options object. Both are used in different parts of the codebase.

This is a classic DRY violation that emerged during the introduction of the
`processCommandResult` utility layer. The `output.ts` version is used only by
`handleScrapeOutput()`, while the `command.ts` version is used by `processCommandResult()`
and other commands.

**Architectural Impact**: Medium-High -- confusion about which module provides the
canonical implementation, and behavioral divergence risk if only one copy is updated.

**Recommendation**: Remove the `shouldOutputJson` function from `output.ts`. Refactor
`handleScrapeOutput` to use the version from `command.ts`, or extract the logic into
a shared helper that both modules consume.

### H-5: `MAX_CONCURRENT_EMBEDS` Constant Duplicated Across Three Files

**Files**:
- `/home/jmagar/workspace/cli-firecrawl/src/commands/search.ts` (line 32): `const MAX_CONCURRENT_EMBEDS = 10;`
- `/home/jmagar/workspace/cli-firecrawl/src/commands/extract.ts` (line 21): `const MAX_CONCURRENT_EMBEDS = 10;`
- `/home/jmagar/workspace/cli-firecrawl/src/container/services/EmbedPipeline.ts` (line 20): `const MAX_CONCURRENT_EMBEDS = 10;`

**Description**: The same concurrency constant is defined independently in three files.
If the optimal concurrency value changes (due to infrastructure scaling or TEI capacity
changes), all three must be updated in lockstep.

Furthermore, `search.ts` and `extract.ts` create their own `pLimit` instances to embed
results, duplicating the concurrency control logic that `EmbedPipeline.batchEmbed()`
already provides. These commands should use the pipeline's built-in batch embedding
instead of reimplementing concurrency control.

**Architectural Impact**: High -- the duplicated embedding logic in commands bypasses the
pipeline's error tracking, progress reporting, and failure collection. If a batch embed
fails, the command-level code silently swallows the error via `autoEmbed`'s fire-and-forget
behavior, losing the pipeline's structured `{ succeeded, failed, errors }` result.

**Recommendation**: Move `MAX_CONCURRENT_EMBEDS` to `utils/constants.ts`. Refactor
`search.ts` and `extract.ts` to use `container.getEmbedPipeline().batchEmbed()` instead
of manually calling `pLimit` + `autoEmbed` in a loop.

---

## Medium Severity Findings

### M-1: Scrape Command Bypasses Container for Qdrant Operations

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/scrape.ts` (lines 60-95)

**Description**: The `--remove` flag in the scrape command directly accesses
`container.config.qdrantUrl` and `container.config.qdrantCollection` and applies its own
fallback (`qdrantCollection || 'firecrawl'`), bypassing the `resolveCollectionName()`
helper used by all other vector commands. This means the scrape `--remove` operation
potentially targets a different collection than `query`, `sources`, `stats`, or `delete`.

**Recommendation**: Use `resolveCollectionName(container)` and delegate to the shared
delete pattern already implemented in `delete.ts`.

### M-2: Entry Point File Too Large (524 lines)

**File**: `/home/jmagar/workspace/cli-firecrawl/src/index.ts`

**Description**: The entry point contains 524 lines including custom help rendering
(~130 lines of formatting code with ANSI color functions), URL detection logic, argument
rewriting, and signal handling. This file should be a thin orchestrator that wires
commands to the program and dispatches.

The `fg256()`, `bg256()`, `gradientText()`, and `renderTopLevelHelp()` functions
(lines 168-324) are presentation concerns that belong in the theme/display layer.

**Recommendation**: Extract help rendering to `utils/help-renderer.ts`. Move
`isCloudApiUrl()` and `isTopLevelHelpInvocation()` to appropriate utility modules.
The entry point should be under 100 lines.

### M-3: Status Command is 1023 Lines

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/status.ts` (1023 lines)

**Description**: At 1023 lines, this is the largest single file in the codebase,
more than doubling the next-largest (615 lines). This suggests the status command
has accumulated too many responsibilities. For a CLI command, this size indicates
that formatting, data aggregation, and command logic are insufficiently decomposed.

**Recommendation**: Apply the same decomposition pattern used for the crawl command:
split into `status/command.ts`, `status/format.ts`, `status/execute.ts`, and
`status/index.ts`.

### M-4: Background Embedder Creates Containers Per Job

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts` (line 90)

**Description**: Inside `processEmbedJob()`, a new `DaemonContainer` is created for each
job via `createDaemonContainer({ apiKey: job.apiKey })`. This means each job creates new
service instances (HttpClient, TeiService, QdrantService, EmbedPipeline) rather than
reusing the daemon's existing container.

While this provides per-job API key isolation, it also means:
1. TEI info is re-fetched for every job (the cache is per-TeiService instance).
2. Qdrant collection existence checks are repeated (the cache is per-QdrantService instance).
3. No connection reuse between jobs.

**Recommendation**: If per-job API keys are needed, create a container override only for
the Firecrawl client, while reusing the shared TEI and Qdrant services from the daemon
container. Alternatively, introduce a shared TEI info cache at the module level.

### M-5: Duplicate Stale Job Processing Error Handler

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts` (lines 510-532, 534-558)

**Description**: The error handling logic for `processStaleJobsOnce()` is duplicated
verbatim between the initial call (lines 510-532) and the `setInterval` callback
(lines 534-558). The `consecutiveFailures` tracking, `MAX_FAILURES_BEFORE_ALERT` check,
and console error logging are copied line-for-line.

**Recommendation**: Extract a named function `handleStaleJobError(error: unknown): void`
that encapsulates the error tracking and alerting logic.

### M-6: `auth.ts` Uses `require()` for Package Version

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/auth.ts` (line 71)

**Description**: `const packageJson = require('../../package.json');` is used inside a
function body, which is unnecessary given that `resolveJsonModule: true` is enabled in
`tsconfig.json`. The top-level `index.ts` already demonstrates the proper pattern:
`import packageJson from '../package.json'`.

**Recommendation**: Replace with a top-level `import` statement.

### M-7: Webhook Server Binds to 0.0.0.0 Without Documentation

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/background-embedder.ts` (line 457)

**Description**: The embedder webhook server binds to `0.0.0.0`, which means it listens
on all network interfaces, not just localhost. For a local development daemon, this
exposes the webhook endpoint (including the health check and status endpoints) to the
entire network. While the webhook path is protected by an optional HMAC secret, the
`/health` and `/status` endpoints are unauthenticated.

**Recommendation**: Default to `127.0.0.1` (localhost) for the bind address. Add an
environment variable (`FIRECRAWL_EMBEDDER_BIND_ADDRESS`) for explicit override when
network access is needed.

### M-8: Import Ordering Inconsistency in Command Files

**Files**: `src/commands/query.ts` (line 219), `src/commands/extract.ts` (line 196),
`src/commands/search.ts` (line 363)

**Description**: Several command files have `import { Command } from 'commander'`
statements mid-file, after function definitions. TypeScript allows this because imports
are hoisted, but it creates a confusing code organization where the file appears to have
two "sections" of imports.

This pattern emerged because the command creation function (`createXxxCommand`) was
added after the execute/handler functions, and the `Command` import was placed near its
usage rather than at the top of the file.

**Recommendation**: Move all import statements to the top of each file. Run biome
formatting/linting to enforce consistent import ordering.

---

## Low Severity Findings

### L-1: `_container` Property Uses Underscore Convention on Public API

**File**: `/home/jmagar/workspace/cli-firecrawl/src/index.ts` (lines 58-62)

**Description**: The container is stored on Commander's `Command` object via a property
named `_container`, using module augmentation:

```typescript
declare module 'commander' {
  interface Command {
    _container?: IContainer;
  }
}
```

The underscore prefix conventionally indicates a private property, but this is accessed
publicly across the command layer via `requireContainer()` and `requireContainerFromCommandTree()`.

**Recommendation**: Consider using a WeakMap keyed by the Command instance to avoid
polluting the Commander type, or rename to `container` without the underscore prefix.

### L-2: Unused `container` Parameter in `createExtractCommand`

**File**: `/home/jmagar/workspace/cli-firecrawl/src/commands/extract.ts` (line 249)

**Description**: `createExtractCommand(container?: IContainer)` accepts an optional
container parameter that is only used for testing (line 337-339: stored on `_container`).
No other `createXxxCommand` function takes a container parameter -- they all rely on the
`preAction` hook in `index.ts`. This breaks the uniform command creation contract.

**Recommendation**: Remove the container parameter. For testing, provide the container
through the standard `preAction` hook mechanism or use the `requireContainer` helper.

### L-3: `Semaphore` Class in `tei-helpers.ts` Duplicates `p-limit` Functionality

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/tei-helpers.ts` (lines 58-85)

**Description**: A hand-rolled `Semaphore` class provides concurrency limiting for
`runConcurrentBatches()`. The project already depends on `p-limit` (used in
`EmbedPipeline.ts`, `search.ts`, and `extract.ts`), which provides the same
functionality with more robust edge-case handling.

**Recommendation**: Replace the custom `Semaphore` with `p-limit` for consistency
with the rest of the codebase.

### L-4: `EmbedJob` Has Redundant `id` and `jobId` Fields

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts` (lines 33-34)

**Description**: The `EmbedJob` interface has both `id: string` and `jobId: string`,
and the `enqueueEmbedJob` function sets them to the same value (line 103-104):
```typescript
id: jobId,
jobId,
```

This creates ambiguity about which field is the canonical identifier.

**Recommendation**: Remove the redundant `id` field and use `jobId` exclusively as the
identifier.

### L-5: `@deprecated` Functions Still in Active Use

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/embed-queue.ts`

**Description**: Two functions are marked `@deprecated` with instructions to use their
"Detailed" counterparts:
- `getEmbedJob()` (line 158): "Use `getEmbedJobDetailed()`"
- `listEmbedJobs()` (line 322): "Use `listEmbedJobsDetailed()`"

However, both deprecated functions are actively called throughout the codebase
(`markJobProcessing`, `markJobCompleted`, `markJobFailed`, `markJobConfigError`,
`updateJobProgress`, `getPendingJobs`, `getStalePendingJobs`, `getStuckProcessingJobs`,
`getQueueStats`, `cleanupOldJobs`). The "detailed" versions are not used anywhere except
internally by the deprecated functions themselves.

**Recommendation**: Either complete the migration to the detailed variants or remove
the `@deprecated` annotations if the migration is not planned.

### L-6: Sync File I/O in Credentials Module

**File**: `/home/jmagar/workspace/cli-firecrawl/src/utils/credentials.ts`

**Description**: The credentials module uses synchronous file system operations
(`fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`, `fs.chmodSync`,
`fs.mkdirSync`, `fs.unlinkSync`) while the embed queue module (`embed-queue.ts`)
uses async operations (`fs.promises`) for similar file management tasks. For a CLI
that runs as a one-shot process, sync I/O is acceptable for startup-path credential
loading, but the inconsistency within the utility layer creates confusion about the
project's I/O conventions.

**Recommendation**: This is acceptable as-is since credentials are loaded during
startup before any async operations begin. Document the intentional design choice
with a brief comment.

---

## Architectural Strengths

The following aspects of the architecture are well-designed and worth preserving:

### S-1: DI Container with Immutable Configuration

The `Container` class with `ImmutableConfig` (frozen via `Object.freeze`) provides a
clean separation between configuration resolution and service usage. The factory pattern
(`createContainer`, `createContainerWithOverride`) enables per-command overrides without
global mutation. This is a textbook implementation of the Dependency Inversion Principle.

### S-2: Consistent Command Architecture

The three-layer command pattern (`createXxxCommand` -> `handleXxxCommand` -> `executeXxx`)
provides clean separation between:
- CLI definition (Commander.js wiring, argument parsing)
- Output formatting (human-readable vs JSON)
- Business logic (API calls, data transformation)

This makes commands independently testable at each layer.

### S-3: Interface-First Service Design

All container services (`IHttpClient`, `ITeiService`, `IQdrantService`, `IEmbedPipeline`)
are defined as interfaces in `container/types.ts` before their implementations. This
enables mocking in tests and future implementation swaps.

### S-4: Path Traversal Protection

The `validateOutputPath()` function in `output.ts` follows symlinks via `fs.realpathSync()`
and validates the resolved path stays within the allowed base directory. This is a
defense-in-depth measure that goes beyond simple string prefix checking.

### S-5: Shared Command Utilities

The `processCommandResult()`, `handleCommandError()`, and `writeCommandOutput()` functions
in `utils/command.ts` eliminate boilerplate across vector commands. The adoption of these
utilities in newer commands (sources, stats, delete, query, etc.) shows the architecture
is converging toward consistency.

### S-6: Graceful Shutdown Design

The signal handling in `index.ts` and `embedder-daemon.ts` implements a clean
double-signal pattern (first signal = graceful, second signal = force) with timeout
protection. The container's `dispose()` method is correctly awaited during shutdown.

### S-7: Markdown-Aware Chunking

The chunker in `utils/chunker.ts` uses a well-designed multi-pass strategy (header split
-> paragraph split -> fixed-size split -> tiny chunk merge) that preserves semantic
boundaries in markdown content. This is architecturally appropriate for a system that
indexes scraped web content.

### S-8: No Circular Dependencies

Static analysis confirms zero circular import chains across all 86 source files. This
is a strong indicator of well-designed module boundaries and correct dependency direction
(commands -> container -> utils, with no reverse dependencies).

---

## Dependency Direction Analysis

The codebase follows a clean dependency direction with four layers:

```
Layer 1: Entry Points
  index.ts, embedder-daemon.ts
  Depends on: Layer 2, Layer 3, Layer 4

Layer 2: Commands (src/commands/)
  All command files
  Depends on: Layer 3, Layer 4
  Never depends on: Layer 1

Layer 3: Container (src/container/)
  Container, factories, services
  Depends on: Layer 4
  Never depends on: Layer 1, Layer 2

Layer 4: Utilities (src/utils/, src/types/, src/schemas/)
  Pure functions, type definitions, validation
  Depends on: nothing (leaf nodes)
  Never depends on: Layer 1, Layer 2, Layer 3
```

**Violations found**:
- `utils/background-embedder.ts` imports from `container/DaemonContainerFactory` and
  `container/types` -- this is a Layer 4 -> Layer 3 dependency violation. The background
  embedder is architecturally a service/entry point, not a utility. Its placement in
  `utils/` is misleading.
- `utils/embedder-webhook.ts` imports `ImmutableConfig` from `container/types` -- another
  Layer 4 -> Layer 3 violation.

**Recommendation**: Move `background-embedder.ts` and `embedder-webhook.ts` to a new
`src/daemon/` directory or into `src/container/services/`, since they are services that
depend on the container layer.

---

## Data Model Assessment

### Qdrant Point Schema

The vector point schema is implicitly defined through payload construction in
`embed-core.ts` (`buildEmbeddingPoints`) and validated through access patterns in query
result mapping. There is no explicit schema definition (e.g., Zod) for the Qdrant payload
structure.

**Payload fields** (inferred from usage):
- `url` (string) -- source URL, indexed as keyword
- `title` (string) -- page title
- `domain` (string) -- extracted domain, indexed as keyword
- `chunk_index` (number) -- position within document
- `chunk_text` (string) -- the actual text content
- `chunk_header` (string|null) -- nearest markdown header
- `total_chunks` (number) -- total chunks for the document
- `source_command` (string) -- command that generated the data, indexed as keyword
- `content_type` (string) -- 'markdown', 'html', 'text', 'extracted'
- `scraped_at` (ISO string) -- timestamp

This schema is adequate for the current use case. The three keyword indexes
(`url`, `domain`, `source_command`) align with the filtering patterns used by the
vector commands.

**Concern**: The payload schema is not validated at read time. The `queryPoints` and
`scrollAll` methods cast payload values using helper functions (`getString`, `getNumber`),
but there is no schema validation that would catch payload corruption or schema evolution
issues.

---

## API Design Assessment

### CLI API Surface

The CLI provides a well-organized command hierarchy:

- **Core operations**: `scrape`, `crawl`, `map`, `search`, `extract`, `batch`
- **Vector operations**: `embed`, `query`, `retrieve`, `sources`, `domains`, `stats`, `history`, `info`, `delete`
- **Account operations**: `config`, `view-config`, `login`, `logout`, `version`, `status`, `list`, `completion`

The subcommand pattern for `crawl` (`status`, `cancel`, `errors`) and `extract` (`status`)
provides a clean resource-action-target convention.

**Positive patterns**:
- Consistent `--json`, `--pretty`, `--output` flags across commands
- `--no-embed` opt-out pattern for auto-embedding
- Collection name override via `--collection` on vector commands
- Domain/source filtering via shared option builders

**Concerns**:
- The scrape command accepts `--remove` to delete vectors, which conflates scraping with
  vector management. This should be a `delete --domain` operation.
- The crawl command accepts `--embed` as both a boolean flag (auto-embed) and a trigger
  (manually embed a job ID). Overloading a single flag for two different operations is
  confusing.

---

## Recommendations Summary (Priority Order)

1. **[Critical]** Consolidate `CommandResult<T>` to single definition in `types/common.ts`
2. **[High]** Standardize Qdrant collection name defaults to `DEFAULT_QDRANT_COLLECTION`
3. **[High]** Replace `require()` calls in Container with top-level imports
4. **[High]** Standardize error handling on `process.exitCode = 1` + return
5. **[High]** Consolidate `shouldOutputJson` to single implementation
6. **[High]** Extract `MAX_CONCURRENT_EMBEDS` to constants; refactor commands to use `batchEmbed()`
7. **[Medium]** Extract help rendering from `index.ts` to dedicated module
8. **[Medium]** Decompose `status.ts` (1023 lines) into submodules
9. **[Medium]** Move `background-embedder.ts` and `embedder-webhook.ts` to correct layer
10. **[Medium]** Bind webhook server to `127.0.0.1` by default
