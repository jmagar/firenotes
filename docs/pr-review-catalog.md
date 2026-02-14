# PR #13 Review Comments Catalog

**PR**: feat: centralize storage paths and enhance query deduplication
**Total Comments**: 232 root comments (excluding replies)
**Repository**: jmagar/firenotes

## Summary

| Category | Count |
|----------|-------|
| Security | 23 |
| High Priority | 87 |
| Minor | 45 |
| Nitpick | 77 |
| **Total** | **232** |

## Reviewers

| Reviewer | Comments |
|----------|----------|
| coderabbitai[bot] | 161 |
| cubic-dev-ai[bot] | 47 |
| github-advanced-security[bot] | 23 |
| chatgpt-codex-connector[bot] | 1 |

---

## Category 1: Security (23 issues)

All from `github-advanced-security[bot]` - CodeQL static analysis findings.

### S1. Potential file system race condition

- **Severity**: Security
- **Author**: github-advanced-security[bot]
- **Files**: `src/utils/credentials.ts:145`, `src/utils/job-history.ts:N/A`, `src/utils/settings.ts:179`, `src/utils/settings.ts:N/A`, `src/utils/settings.ts:N/A`, `src/utils/settings.ts:179`, `src/utils/settings.ts:194`, `src/utils/settings.ts:205`, `src/utils/settings.ts:N/A`, `src/utils/credentials.ts:145`
- **Count**: 10 occurrences

**Issue**: TOCTOU (Time-of-check-to-time-of-use) race condition. File existence is checked then used separately.

**Recommended Fix**: Use atomic file operations - wrap in try/catch instead of check-then-act pattern. Use `fs.writeFile` with `wx` flag or handle `ENOENT` errors directly.

### S2. Incomplete URL substring sanitization

- **Severity**: Security
- **Author**: github-advanced-security[bot]
- **Files**: `src/__tests__/commands/query.test.ts:N/A`, `src/__tests__/commands/query.test.ts:N/A`, `src/__tests__/utils/deduplication.test.ts:105`
- **Count**: 3 occurrences

**Issue**: URL validation uses substring matching which can be bypassed.

**Recommended Fix**: Use proper URL parsing with `new URL()` and validate the hostname property.

### S3. Clear-text logging of sensitive information

- **Severity**: Security
- **Author**: github-advanced-security[bot]
- **Files**: `src/commands/config.ts:N/A`, `src/commands/config.ts:573`, `src/commands/config.ts:N/A`, `src/commands/config.ts:573`, `src/commands/config.ts:N/A`, `src/commands/config.ts:N/A`, `src/commands/config.ts:594`, `src/commands/config.ts:595`
- **Count**: 8 occurrences

**Issue**: Sensitive data may be logged in cleartext.

**Recommended Fix**: Redact sensitive fields before logging.

### S4. Useless assignment to local variable

- **Severity**: Security
- **Author**: github-advanced-security[bot]
- **Files**: `src/commands/doctor.ts:N/A`
- **Count**: 1 occurrences

**Issue**: ## Useless assignment to local variable

The initial value of message is unused, since it is always overwritten.

[Show more details](https://github.com/jmagar/firenotes/security/code-scanning/31)

**Recommended Fix**: Address the security finding per CodeQL recommendation.

### S5. Unused variable, import, function or class

- **Severity**: Security
- **Author**: github-advanced-security[bot]
- **Files**: `src/commands/query.ts:N/A`
- **Count**: 1 occurrences

**Issue**: ## Unused variable, import, function or class

Unused variable grouped.

[Show more details](https://github.com/jmagar/firenotes/security/code-scanning/30)

**Recommended Fix**: Address the security finding per CodeQL recommendation.

---

## Category 2: High Priority (87 issues)

Major bugs, P1/P2 issues, and potential issues flagged by reviewers.

### H1. <sub><sub></sub></sub>  Honor --limit for all query output modes

- **Issue #4**
- **Severity**: P1
- **Author**: chatgpt-codex-connector[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: <sub><sub></sub></sub>  Honor --limit for all query output modes This change multiplies the Qdrant fetch size by 10 unconditionally, but only the compact formatter applies a post-fetch limit; `--full`, `--group`, and `--json` paths emit the raw `items` array, so `firecrawl query --limit 10` can now return up to 100 results and break scripts that rely on the documented maximum. Overfetching for deduplication should be gated to compact mode or sliced back to `requestedLimit` before returning data.

### H2. 🏁 Script executed:

- **Issue #6**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: Repository: jmagar/firenotes Length of output: 2356

### H3. Missing null guard on `data.result.collections` — will throw if Qdrant returns an unexpected shape.

- **Issue #8**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:127`

**Description**: Missing null guard on `data.result.collections` — will throw if Qdrant returns an unexpected shape. If `data.result` or `data.result.collections` is `undefined`, this line will throw an unhandled `TypeError`.

### H4. Restoring `undefined` to `process.env` sets the string `"undefined"`, polluting subsequent tests.

- **Issue #11**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/credentials.test.ts:50`

**Description**: Restoring `undefined` to `process.env` sets the string `"undefined"`, polluting subsequent tests. In Node.js, `process.env.X = undefined` coerces to the string `"undefined"`. If `FIRECRAWL_HOME` was not set before tests, the afterEach will leave it as `"undefined"` instead of removing it.

### H5. Env var restoration bug: assigning `undefined` to `process.env` sets the string `"undefined"`.

- **Issue #12**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/job-history.test.ts:59`

**Description**: Env var restoration bug: assigning `undefined` to `process.env` sets the string `"undefined"`. On line 52, if `originalFirecrawlHome` is `undefined` (i.e., it was not set before tests), `process.env.FIRECRAWL_HOME = undefined` sets the env var to the string `"undefined"`, not `delete`-ing it. Compare with `src/__tests__/commands/info.test.ts` (lines 378–382) which correctly handles this case.

### H6. Same `process.env` restoration bug — assigning `undefined` sets the string `"undefined"`.

- **Issue #13**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/storage-paths.test.ts:33`

**Description**: Same `process.env` restoration bug — assigning `undefined` sets the string `"undefined"`. Identical issue to `credentials.test.ts`. When `originalFirecrawlHome` is `undefined`, the afterEach will pollute the env instead of cleaning it.

### H7. 10× overfetch leaks into `--full`, `--group`, and `--json` output modes.

- **Issue #17**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: 10× overfetch leaks into `--full`, `--group`, and `--json` output modes. `executeQuery` now fetches `limit * 10` results, but deduplication/limiting only occurs inside `formatCompact`. The other output paths (`formatFull`, `formatGrouped`, and raw JSON via `processCommandResult`) receive all fetched items — up to 10× what the user requested via `--limit`.

### H8. Same `HOME`/`USERPROFILE` issue as `settings.ts` — use `homedir()` from `node:os`.

- **Issue #20**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/credentials.ts:53`

**Description**: Same `HOME`/`USERPROFILE` issue as `settings.ts` — use `homedir()` from `node:os`. This is the same pattern flagged in `settings.ts` `getLegacySettingsPaths()`. Use `homedir()` for robust cross-platform resolution.

### H9. Same `HOME`/`USERPROFILE` inconsistency as other legacy path helpers.

- **Issue #22**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:70`

**Description**: Same `HOME`/`USERPROFILE` inconsistency as other legacy path helpers. Use `homedir()` from `node:os` for consistency with `storage-paths.ts` and robustness when neither env var is set.

### H10. Unhandled errors during file-by-file copy can abort the entire migration and propagate to callers.

- **Issue #23**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:N/A`

**Description**: Unhandled errors during file-by-file copy can abort the entire migration and propagate to callers. If `fs.copyFile` fails for a single file (e.g., permission denied, corrupted symlink), the error propagates unhandled through `ensureQueueDir` → caller (e.g., `enqueueEmbedJob`), potentially breaking core queue operations. Wrap individual copies in try/catch and log failures rather than aborting.

### H11. Redundant `fs.access` before `fs.readFile` creates a TOCTOU race (CodeQL flag) and `_parsed` is unused.

- **Issue #25**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:122`

**Description**: Redundant `fs.access` before `fs.readFile` creates a TOCTOU race (CodeQL flag) and `_parsed` is unused. Two issues in the migration loop:

### H12. IPv6 loopback `::1` not recognized as local.

- **Issue #27**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/network-error.ts:41`

**Description**: IPv6 loopback `::1` not recognized as local. `isLocalApiUrl` misses `::1`, the IPv6 loopback address. Users running self-hosted services on `http://[::1]:3002` won't receive the actionable connectivity hint.

### H13. Use `homedir()` from `node:os` instead of `process.env.HOME ?? process.env.USERPROFILE`.

- **Issue #28**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/settings.ts:50`

**Description**: Use `homedir()` from `node:os` instead of `process.env.HOME ?? process.env.USERPROFILE`. `getLegacySettingsPaths()` manually reads `HOME`/`USERPROFILE` env vars, while the rest of the codebase (e.g., `storage-paths.ts`) uses `homedir()` from `node:os`, which handles platform-specific resolution more robustly (including fallbacks). The same inconsistency exists in `credentials.ts` (`getLegacyConfigDirs`). If neither env var is set, the fallback to `''` produces invalid root-relative paths like `/Library/Application Support/...`.

### H14. Inconsistent use of trimmed value in `getEmbedQueueDir`.

- **Issue #30**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/storage-paths.ts:69`

**Description**: Inconsistent use of trimmed value in `getEmbedQueueDir`. Line 67 checks `configuredDir.trim().length > 0`, but lines 68-70 use the untrimmed `configuredDir`. If the env var has leading whitespace (e.g., `" /absolute/path"`), it passes the guard but `startsWith('/')` fails, causing an absolute path to be incorrectly treated as relative to `cwd`.

### H15. Stale storage path reference.

- **Issue #51**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `CLAUDE.md:N/A`

**Description**: Stale storage path reference. Line 183 still references `~/.config/firecrawl-cli/` but this PR moves storage to `~/.firecrawl` (controlled by `FIRECRAWL_HOME`). Update to match the new storage location.

### H16. Missing blank lines around fenced code blocks.

- **Issue #52**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `CLAUDE.md:N/A`

**Description**: Missing blank lines around fenced code blocks. The markdown linter flags lines 201 and 241: fenced code blocks should be surrounded by blank lines per MD031.

### H17. 🏁 Script executed:

- **Issue #53**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.yaml:N/A`

**Description**: Repository: jmagar/firenotes Length of output: 1131

### H18. Same `FIRECRAWL_HOME` undefined risk as the embedder volume mount.

- **Issue #54**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.yaml:N/A`

**Description**: Same `FIRECRAWL_HOME` undefined risk as the embedder volume mount. If `QDRANT_DATA_DIR` and `FIRECRAWL_HOME` are both unset, `${FIRECRAWL_HOME}/qdrant` resolves to `/qdrant`, mapping host root `/qdrant` into the container.

### H19. 🏁 Script executed:

- **Issue #55**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: Repository: jmagar/firenotes Length of output: 2766

### H20. Minor: clarify what `<project>` means.

- **Issue #56**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: Minor: clarify what `<project>` means. "The CLI reads `<project>/.env`" — it's not immediately obvious that `<project>` means the current working directory. Consider using `<cwd>/.env` or adding a brief clarification.

### H21. Missing null guard on `data.result` — will throw if Qdrant returns an unexpected shape.

- **Issue #58**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:150`

**Description**: Missing null guard on `data.result` — will throw if Qdrant returns an unexpected shape. The same null-guard pattern applied in `listCollections` (lines 99–101) is absent here. If `data.result` is `undefined`, the caller in `displayHealthInfo` will dereference it and throw an unhandled `TypeError`.

### H22. `emptyContent` and `missingContent` double-count empty strings.

- **Issue #59**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:184`

**Description**: `emptyContent` and `missingContent` double-count empty strings. When `chunk_text` is `""`, `!point.payload.chunk_text` is `true` (incrementing `missingContent`) and the `trim().length === 0` check also passes (incrementing `emptyContent`). If the intent is for these to be distinct categories — missing means absent, empty means whitespace-only — the `missingContent` check should be narrowed.

### H23. `Math.min(...counts)` / `Math.max(...counts)` can blow the call stack on large collections.

- **Issue #60**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:585`

**Description**: `Math.min(...counts)` / `Math.max(...counts)` can blow the call stack on large collections. Spreading an array into `Math.min`/`Math.max` pushes every element onto the call stack. If the collection contains more unique URLs than the engine's argument limit (~10k–30k in V8), this will throw a `RangeError: Maximum call stack size exceeded`. Since `counts` is already sorted on line 436, you can just read the first and last element.

### H24. Environment cleanup in `beforeEach` does not cover all variables read by `buildRuntimeEnvItems`.

- **Issue #61**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/config-view.test.ts:153`

**Description**: Environment cleanup in `beforeEach` does not cover all variables read by `buildRuntimeEnvItems`. Variables like `FIRECRAWL_HOME`, `QDRANT_DATA_DIR`, `REDIS_URL`, `POSTGRES_PASSWORD`, `FIRECRAWL_EMBEDDER_WEBHOOK_URL`, `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET`, etc., are read by the production code but not cleaned in `beforeEach`. If the test runner or CI environment has any of these set, they could leak into test output and cause flaky assertions.

### H25. `getQdrantService()` and `getTeiService()` return `undefined` by default, unlike other service getters.

- **Issue #67**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/mock-setup.ts:181`

**Description**: `getQdrantService()` and `getTeiService()` return `undefined` by default, unlike other service getters. `getFirecrawlClient`, `getEmbedPipeline`, and `getHttpClient` all have `mockReturnValue(...)` configured, but `getTeiService` and `getQdrantService` are bare `vi.fn()` calls that return `undefined`. Any test that calls `container.getQdrantService()` without explicit setup will get `undefined`, likely causing a confusing NPE downstream.

### H26. 🏁 Script executed:

- **Issue #68**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/module-mocks.ts:248`

**Description**: Repository: jmagar/firenotes Length of output: 1111

### H27. `code` on the `close` event can be `null`; the current handler rejects spuriously when the child is killed by a signal.

- **Issue #70**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:301`

**Description**: `code` on the `close` event can be `null`; the current handler rejects spuriously when the child is killed by a signal. Node.js `ChildProcess` emits `close` with `(code: number | null, signal: string | null)`. When the process is killed by a signal (e.g., SIGTERM), `code` is `null`. The check `code !== 0` evaluates `null !== 0` → `true`, so a signal-terminated process always rejects with a confusing "exited with code null" message.

### H28. Critical: `claude` CLI requires `-p`/`--print` flag for non-interactive stdin piping — without it, the process will hang

- **Issue #71**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:254`

**Description**: Critical: `claude` CLI requires `-p`/`--print` flag for non-interactive stdin piping — without it, the process will hang in interactive mode. Piping input to Claude Code is handled by the `--print` (`-p`) flag. The `--print` flag enables non-interactive mode for automation, scripting, and CI/CD integration. Without this flag, `claude` enters its interactive TUI, ignoring piped stdin and causing the spawned process to hang indefinitely.

### H29. Missing error handler on `stdin` — write can throw if the child exits before stdin is consumed.

- **Issue #72**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:272`

**Description**: Missing error handler on `stdin` — write can throw if the child exits before stdin is consumed. If the spawned process exits immediately (e.g., bad `--model` flag), writing to `stdin` can emit an `EPIPE` error that is unhandled, crashing the parent process.

### H30. Sensitive values are stored raw in `EnvItem.value` — masking happens only at consumption points.

- **Issue #74**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:352`

**Description**: Sensitive values are stored raw in `EnvItem.value` — masking happens only at consumption points. `buildRuntimeEnvItems()` captures raw environment values (e.g., `OPENAI_API_KEY`, `POSTGRES_PASSWORD`, `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET`) in `item.value`. The masking is deferred to the display/serialization layer (`printRuntimeEnvironment` line 204, `buildConfigDiagnostics` line 241). While all current paths do mask correctly, this pattern risks accidental plain-text exposure if a new consumer of `buildRuntimeEnvItems()` forgets to check `item.masked`.

### H31. `clearedHistory` count may underreport.

- **Issue #77**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/status.ts:202`

**Description**: `clearedHistory` count may underreport. `recentCrawlIds` is capped at 100 entries (line 158), but `clearJobTypeHistory('crawl')` on line 177 wipes the entire history regardless of size. If the history has more than 100 entries, `clearedHistory` will report 100 instead of the actual count cleared.

### H32. 🏁 Script executed:

- **Issue #79**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/extract.ts:413`

**Description**: Repository: jmagar/firenotes Length of output: 2105

### H33. 🏁 Script executed:

- **Issue #83**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/container/services/EmbedPipeline.ts:N/A`

**Description**: Repository: jmagar/firenotes Length of output: 116

### H34. 🌐 Web query:

- **Issue #84**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/container/services/QdrantService.ts:568`

**Description**: 🌐 Web query: `Qdrant delete points empty filter must array`

### H35. TOCTOU race on credential migration (CodeQL finding) — low risk for a single-user CLI.

- **Issue #86**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/credentials.ts:193`

**Description**: TOCTOU race on credential migration (CodeQL finding) — low risk for a single-user CLI. Between the `existsSync(newPath)` check (line 77) and the `writeFileSync` (line 95), another process could create the file. Use `writeFileSync` with `{ flag: 'wx' }` (exclusive create) to atomically guard against this, instead of relying on the prior existence check.

### H36. `createQdrantPoint` is missing `total_chunks` in payload.

- **Issue #90**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/fixtures.ts:165`

**Description**: `createQdrantPoint` is missing `total_chunks` in payload. The query command reads `r.payload.total_chunks` (query.ts line 83), but the fixture doesn't include it. Tests relying on this fixture for query results may get `undefined` for `totalChunks`, silently falling back to the default of `1`. Consider adding it for completeness.

### H37. Inconsistent output channels for timing info on failure.

- **Issue #91**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:824`

**Description**: Inconsistent output channels for timing info on failure. When `--timing` is set, JSON-mode failures log timing to `console.error` (line 798), but non-JSON failures log to `console.log` (lines 814-818). For consistency and to keep `stdout` clean for piping, the non-JSON failure timing should also go to `console.error`.

### H38. Unquoted value containing escape sequence.

- **Issue #97**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.env.tei.example:11`

**Description**: Unquoted value containing escape sequence. The `\n` in the prompt value may not be correctly interpreted by all dotenv parsers unless the value is quoted. Some parsers treat unquoted `\n` as a literal backslash + `n` rather than a newline.

### H39. Hardcoded user-specific storage path.

- **Issue #98**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.env.tei.example:N/A`

**Description**: Hardcoded user-specific storage path. Same issue as the compose files — `/home/jmagar/appdata/tei` won't exist on other machines. Replace with a generic placeholder.

### H40. Unquoted value with spaces may cause parsing issues.

- **Issue #99**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.env.tei.mxbai.example:18`

**Description**: Unquoted value with spaces may cause parsing issues. `TEI_DEFAULT_PROMPT` contains spaces and is unquoted. While some tools handle this fine, others (e.g., shell `source`, some Docker Compose versions) may truncate at the first space. Quote it for safety.

### H41. Hardcoded user-specific path in example file.

- **Issue #100**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.env.tei.mxbai.example:28`

**Description**: Hardcoded user-specific path in example file. `/home/jmagar/appdata/tei-mxbai` is specific to your machine. Example files should use a generic placeholder so other users know to customize it.

### H42. Hardcoded user-specific path as default volume mount.

- **Issue #102**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.mxbai.yaml:N/A`

**Description**: Hardcoded user-specific path as default volume mount. `/home/jmagar/appdata/tei-mxbai` is a developer-specific path that will fail on any other machine. Use a relative path or an env-var-only approach with no hardcoded fallback, consistent with how other compose files in this PR handle storage via `FIRECRAWL_HOME`.

### H43. Unpinned `:latest` image tag.

- **Issue #103**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.yaml:N/A`

**Description**: Unpinned `:latest` image tag. Using `:latest` is non-reproducible and risks unexpected breaking changes on `docker compose pull`. The mxbai variant correctly pins to `cpu-1.8.1`. Pin this to a specific version as well (e.g., `ghcr.io/huggingface/text-embeddings-inference:1.8.1` for the GPU variant).

### H44. Hardcoded user-specific path as default volume mount.

- **Issue #104**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.yaml:N/A`

**Description**: Hardcoded user-specific path as default volume mount. Same issue as `docker-compose.tei.mxbai.yaml` — `/home/jmagar/appdata/tei` is developer-specific.

### H45. CodeQL: Incomplete URL substring sanitization (test-only, low risk).

- **Issue #109**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/query.test.ts:N/A`

**Description**: CodeQL: Incomplete URL substring sanitization (test-only, low risk). `hostname.endsWith('example.com')` would also match `evil-example.com`. While this is a false positive in a controlled test context, you can silence the CodeQL alert and make the assertion more precise:

### H46. 🏁 Script executed:

- **Issue #110**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/lifecycle.ts:236`

**Description**: Repository: jmagar/firenotes Length of output: 1435

### H47. Prefer `process.exitCode = 1` over `process.exit(1)` to allow graceful cleanup.

- **Issue #113**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:324`

**Description**: Prefer `process.exitCode = 1` over `process.exit(1)` to allow graceful cleanup. `process.exit(1)` terminates immediately, bypassing any pending async cleanup (e.g., `container.dispose()`). The rest of the codebase (per the PR summary) is moving away from `process.exit`. Use `process.exitCode = 1; return;` instead.

### H48. Connection-string URLs may embed credentials — consider masking them.

- **Issue #114**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: Connection-string URLs may embed credentials — consider masking them. `REDIS_URL`, `REDIS_RATE_LIMIT_URL`, and `NUQ_RABBITMQ_URL` commonly contain inline credentials (e.g., `redis://:secret@host:6379`, `amqp://user:pass@host`). These are logged in clear text because `masked` is not set.

### H49. Missing `-p`/`--print` flag for Claude CLI — will hang in interactive mode.

- **Issue #116**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor-debug.ts:213`

**Description**: Missing `-p`/`--print` flag for Claude CLI — will hang in interactive mode. `streamCliDebug` spawns `claude` with only `['--model', model]` but does not include the `-p` flag. In `ask.ts` (line 194), this was already fixed. Without `-p`, Claude enters interactive TUI and ignores piped stdin, causing the process to hang until the timeout kills it.

### H50. Uses bare `fetch` instead of `utils/http.ts` utilities.

- **Issue #117**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor-debug.ts:254`

**Description**: Uses bare `fetch` instead of `utils/http.ts` utilities. The coding guidelines require all external HTTP calls to use `fetchWithRetry()` or `fetchWithTimeout()` from `utils/http.ts`. Both the SSE streaming request (line 199) and the non-streaming fallback (line 264) use the global `fetch` directly, missing retry logic and consistent timeout handling.

### H51. Useless initial assignment to `message`.

- **Issue #120**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:627`

**Description**: Useless initial assignment to `message`. `message` on Line 506 is assigned `entry.Status || 'Unknown'` but every branch of the `if/else if/else` chain below unconditionally reassigns it. The initial value is never read.

### H52. Service URLs containing embedded credentials will be leaked in the doctor report.

- **Issue #121**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:N/A`

**Description**: Service URLs containing embedded credentials will be leaked in the doctor report. `REDIS_URL` and `NUQ_RABBITMQ_URL` (and potentially others) commonly contain connection strings with embedded passwords (e.g. `redis://user:secret@host:port`). These raw values are stored in `details.raw` of each check (Lines 636, 652, 674, 694) and are included verbatim in both the JSON and human-readable report output.

### H53. Unused variable `grouped` — flagged by CodeQL.

- **Issue #123**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: Unused variable `grouped` — flagged by CodeQL. `grouped` is assigned but never read in `formatFull`. Remove it.

### H54. `collectionEnsured` flag races under concurrency — use a cached promise instead.

- **Issue #125**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/container/services/EmbedPipeline.ts:N/A`

**Description**: `collectionEnsured` flag races under concurrency — use a cached promise instead. `batchEmbed` dispatches concurrent `autoEmbedInternal` calls via `p-limit`. Because `ensureCollectionReady` is async, every task in the first concurrency window will observe `collectionEnsured === false` before any of them sets it to `true`, causing redundant `getTeiInfo` + `ensureCollection` round-trips.

### H55. P2: The new readFileSync catch returns null for all filesystem errors, which hides permission/corruption issues and make

- **Issue #127**
- **Severity**: Major
- **Author**: cubic-dev-ai[bot]
- **File**: `src/utils/credentials.ts:N/A`

**Description**: P2: The new readFileSync catch returns null for all filesystem errors, which hides permission/corruption issues and makes credential read failures indistinguishable from “file missing.” Consider only returning null for ENOENT and rethrowing other errors so they’re reported. ✅ Addressed in [`0335066`](https://github.com/jmagar/firenotes/commit/033506654b8e5eb1e26a49755f48c1d0a5d995e5)

### H56. Inconsistent command counts in documentation.

- **Issue #134**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `CLAUDE.md:N/A`

**Description**: Inconsistent command counts in documentation. Line 34 says "22 user commands" but line 441 says "All 19 top-level commands" then proceeds to list 24+ command names (including `ask`). These counts should be reconciled.

### H57. External network `jakenet` is developer-specific.

- **Issue #135**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.mxbai.yaml:N/A`

**Description**: External network `jakenet` is developer-specific. The `jakenet` external network is likely specific to the developer's environment. Other users would need to create this network first or the container will fail to start. Consider making this configurable or using a default bridge network.

### H58. Missing blank lines before fenced code blocks (MD031).

- **Issue #137**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docs/testing-guide.md:66`

**Description**: Missing blank lines before fenced code blocks (MD031). Static analysis flags missing blank lines before the code fences on lines 55, 68, 74, and 81. Add a blank line between the bold text and the code fence to comply with markdownlint rules.

### H59. `getExitCode()` returns the value captured in the *previous* test's `afterEach`, not the current test's.

- **Issue #140**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/process.ts:79`

**Description**: `getExitCode()` returns the value captured in the *previous* test's `afterEach`, not the current test's. `capturedExitCode` is only assigned in `afterEach` (line 32), so calling `getExitCode()` inside a test assertion returns stale data from the prior test (or `undefined` for the first test). If the intent is to assert `process.exitCode` within a test, callers should read `process.exitCode` directly or the capture timing should be documented clearly.

### H60. Map dedup keeps the *last* item per base URL, not the highest-scoring one.

- **Issue #141**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:N/A`

**Description**: Map dedup keeps the *last* item per base URL, not the highest-scoring one. `Map.set` overwrites on duplicate keys, so when multiple query results share the same base URL, only the last one in the iteration order survives. Since `queryResult.data` is typically sorted by score (descending), this means the *lowest*-scoring item per URL is kept.

### H61. Destructive `clear` subcommand has no confirmation prompt.

- **Issue #143**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/command.ts:679`

**Description**: Destructive `clear` subcommand has no confirmation prompt. `crawl clear` deletes the *entire* crawl queue without confirmation. A mistyped command could wipe queued jobs. Consider adding a `--force` flag or an interactive confirmation prompt (unless `--json` is set) to guard against accidental data loss, similar to how `delete` commands often work.

### H62. Docker network TCP probe assumes Node.js is available in the target container.

- **Issue #145**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:329`

**Description**: Docker network TCP probe assumes Node.js is available in the target container. `runDockerNetworkTcpCheck` executes an inline Node.js script via `docker exec ... node -e ...`. If the chosen probe container doesn't have Node.js installed (e.g., a minimal Alpine or distroless image), this silently fails and reports unreachability.

### H63. `config_files` checks for non-credential files report `fail` when missing, but some are optional.

- **Issue #146**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:946`

**Description**: `config_files` checks for non-credential files report `fail` when missing, but some are optional. `settings.json` and `job-history.json` are created on-demand (when first writing settings or recording a job). Reporting `'fail'` when they don't exist on a fresh install could alarm users unnecessarily. Consider using `'warn'` or `'pass'` with a "(not yet created)" message for these optional files, similar to how `credentials.json` already adapts based on auth source.

### H64. Unbounded `fetchLimit` — large `--limit` values multiply to potentially excessive Qdrant queries.

- **Issue #147**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: Unbounded `fetchLimit` — large `--limit` values multiply to potentially excessive Qdrant queries. `fetchLimit = requestedLimit * 10` with no upper cap. If a user passes `--limit 1000`, this queries Qdrant for 10,000 results. Consider capping `fetchLimit` to a reasonable maximum:

### H65. Breaking change: default collection renamed from `firecrawl_collection` to `firecrawl`.

- **Issue #150**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/defaults.ts:15`

**Description**: Breaking change: default collection renamed from `firecrawl_collection` to `firecrawl`. Existing users with vectors stored under the old `firecrawl_collection` name will silently query an empty/non-existent `firecrawl` collection after upgrading, leading to missing results with no error. Consider adding a migration step or startup warning that detects the old collection and advises the user to rename it or set `QDRANT_COLLECTION=firecrawl_collection`.

### H66. 🏁 Script executed:

- **Issue #155**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/ask.test.ts:11`

**Description**: Repository: jmagar/firenotes Length of output: 762

### H67. No context size limit — risk of exceeding CLI stdin/token limits.

- **Issue #158**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:200`

**Description**: No context size limit — risk of exceeding CLI stdin/token limits. The `context` string concatenates full document content for up to `limit` (default 10) documents with no truncation. If documents are large, this could exceed the AI CLI's context window or cause performance issues. Consider adding a character/token budget and truncating documents that exceed it.

### H68. 🏁 Script executed:

- **Issue #159**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:36`

**Description**: Repository: jmagar/firenotes Length of output: 82

### H69. 🏁 Script executed:

- **Issue #161**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:496`

**Description**: Repository: jmagar/firenotes Length of output: 1512

### H70. Replace emoji with a terminal-safe icon.

- **Issue #163**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/command.ts:443`

**Description**: Replace emoji with a terminal-safe icon. Line 295 uses `⚠️` which may render inconsistently across terminals. The coding guidelines require terminal-safe icons from `utils/theme.ts`.

### H71. Fragile AI CLI binary detection — only two options assumed.

- **Issue #165**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:969`

**Description**: Fragile AI CLI binary detection — only two options assumed. Line 843 uses a simple `startsWith('gemini-')` check to decide between `gemini` and `claude` CLIs. Any other model prefix (e.g., `gpt-`, `llama-`, `mistral-`) silently falls through to `claude`, which will fail with a confusing error if `claude` isn't installed. Consider at minimum logging a warning or expanding the mapping.

### H72. Negative `--limit` values are not validated and propagate to Qdrant.

- **Issue #166**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:82`

**Description**: Negative `--limit` values are not validated and propagate to Qdrant. `parseInt(val, 10)` at line 860 happily parses `--limit -5` to `-5`. The `|| 10` fallback on line 57 does not catch negative numbers (they're truthy), so `requestedLimit = -5`, producing `fetchLimit = Math.min(-50, 1000) = -50`. This reaches `qdrantService.queryPoints` and will either error or produce undefined behavior.

### H73. `selectBestPreviewItem` will throw on empty input.

- **Issue #167**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:381`

**Description**: `selectBestPreviewItem` will throw on empty input. This function is `export`ed and `buildPreviewCandidates` may return an empty array if `groupItems` is empty. In that case `candidates[0]` is `undefined`, and accessing `selected.item` / `selected.previewScore` at lines 476-478 will throw a `TypeError`.

### H74. Success timing prints to `stdout` — may contaminate piped output.

- **Issue #169**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:816`

**Description**: Success timing prints to `stdout` — may contaminate piped output. When `--timing` is set without `--json`, success timing info goes to `console.log` (stdout) on lines 831-836, while failure timing correctly goes to `console.error` (stderr) on lines 840-844. If someone pipes the query output (e.g., `firecrawl query "..." --timing | jq`), the timing line will be mixed into the result stream.

### H75. Promise hangs if stdin closes before the user answers (non-interactive / piped input).

- **Issue #173**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/prompts.ts:38`

**Description**: Promise hangs if stdin closes before the user answers (non-interactive / piped input). When the CLI runs in a non-interactive context (CI, piped empty input, redirected stdin), `rl` can close before the `question` callback fires, leaving this promise unresolved forever. Add a `'close'` listener as a fallback:

### H76. P2: If ensureCollectionReady throws once, the rejected promise is cached and all future calls fail without retry. Clear 

- **Issue #181**
- **Severity**: Major
- **Author**: cubic-dev-ai[bot]
- **File**: `src/container/services/EmbedPipeline.ts:48`

**Description**: P2: If ensureCollectionReady throws once, the rejected promise is cached and all future calls fail without retry. Clear the cached promise on error so transient failures can recover. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### H77. 🌐 Web query:

- **Issue #191**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.claude/skills/firecrawl/examples/ask-command-usage.md:N/A`

**Description**: 🌐 Web query: `@anthropic-ai claude-code npm package`

### H78. Add TEI_URL guidance per `.env*` policy.

- **Issue #193**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `.env.tei.example:2`

**Description**: Add TEI_URL guidance per `.env*` policy. This example file should include the instruction (and ideally the commented `TEI_URL` line) so users can follow the required setup step.

### H79. 🏁 Script executed:

- **Issue #194**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.yaml:5`

**Description**: Repository: jmagar/firenotes Length of output: 117

### H80. Add a top-level heading or comment explaining this file's purpose.

- **Issue #195**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `indexme.md:N/A`

**Description**: Add a top-level heading or comment explaining this file's purpose. The file lacks any heading or description. A reader (or a new contributor) won't know what this URL list is for or how it's consumed. The markdownlint MD041 rule also flags this.

### H81. Division by zero when no URLs are extracted.

- **Issue #198**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/extract-base-urls.sh:209`

**Description**: Division by zero when no URLs are extracted. If the Qdrant points have no `url` payload field (or all values are null), `unique_count` will be 0 and line 190 will crash with a division-by-zero error.

### H82. Missing blank lines before fenced code blocks (MD031).

- **Issue #199**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `scripts/README.md:N/A`

**Description**: Missing blank lines before fenced code blocks (MD031). Multiple `Usage:` / `Examples:` labels are immediately followed by code fences without a separating blank line (lines 12, 25, 57, 66). Add a blank line between each bold label and the opening fence.

### H83. Initial spy creation (lines 197-203) leaks because `beforeEach` immediately overwrites without restoring them first.

- **Issue #202**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/process.ts:243`

**Description**: Initial spy creation (lines 197-203) leaks because `beforeEach` immediately overwrites without restoring them first. The spies created at lines 197-203 run at `describe`-level (before any `beforeEach`). When the first `beforeEach` fires, it calls `vi.spyOn(console, 'log')` again, which treats the *first spy* as the "original." After that, `mockRestore()` in `afterEach` only restores back to the first spy—never to the real `console.log`. Over multiple tests this nests spies.

### H84. Coding guideline needs updating — default path changed from `~/.config/firecrawl-cli/` to `~/.firecrawl`.

- **Issue #211**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/credentials.ts:67`

**Description**: Coding guideline needs updating — default path changed from `~/.config/firecrawl-cli/` to `~/.firecrawl`. The credential store path now resolves via `getStorageRoot()` (defaulting to `~/.firecrawl`), but the coding guideline for this file still specifies "file fallback to `~/.config/firecrawl-cli/`". The guideline should be updated to reflect the new unified storage root. As per coding guidelines, `src/utils/credentials.ts`: "Store API keys with 0600 file permissions in OS credential store with file fallback to ~/.config/firecrawl-cli/".

### H85. Bare `catch` swallows non-ENOENT errors silently.

- **Issue #212**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/credentials.ts:210`

**Description**: Bare `catch` swallows non-ENOENT errors silently. If `readFileSync` fails due to permission denied (`EACCES`) or another I/O error, the user gets a silent `null` with no diagnostic. Only suppress file-not-found; let other errors bubble to the outer catch where they are logged.

### H86. `cleanupEmbedQueue` removes *all* failed jobs regardless of age.

- **Issue #215**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:668`

**Description**: `cleanupEmbedQueue` removes *all* failed jobs regardless of age. Line 635 removes every job with `status === 'failed'` without checking `updatedAt`, while pending and processing jobs are age-gated. This is a design choice — if intentional, it's fine. But note that `cleanupOldJobs` (line 543) does respect age for failed jobs. The two functions have inconsistent cleanup semantics for failed jobs.

### H87. Both new colors use 24-bit truecolor escapes while existing colors use basic ANSI.

- **Issue #218**
- **Severity**: Major
- **Author**: coderabbitai[bot]
- **File**: `src/utils/theme.ts:19`

**Description**: Both new colors use 24-bit truecolor escapes while existing colors use basic ANSI. `\x1b[38;2;R;G;Bm` requires truecolor support, which most modern terminals provide but some older terminals and CI environments do not. In unsupported terminals these may render as garbage or be silently ignored. Since the existing palette (`success`, `error`, `warning`, etc.) uses universally supported 4-bit codes, the mixed approach could produce inconsistent fallback behavior.

---

## Category 3: Minor (45 issues)

Suggestions, improvements, and minor code quality issues.

### M1. P2: Absolute path detection uses `startsWith('/')`, which breaks on Windows drive-letter paths and mis-resolves valid ab

- **Issue #31**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/utils/storage-paths.ts:N/A`

**Description**: P2: Absolute path detection uses `startsWith('/')`, which breaks on Windows drive-letter paths and mis-resolves valid absolute queue directories. Use `path.isAbsolute` to handle all platforms. ✅ Addressed in [`c27c091`](https://github.com/jmagar/firenotes/commit/c27c0918dcbcf3e4db61a0a726f5200764eb2c44)

### M2. P2: `--full` and `--group` outputs now ignore the user’s `--limit` because results are fetched at 10× and rendered witho

- **Issue #32**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: P2: `--full` and `--group` outputs now ignore the user’s `--limit` because results are fetched at 10× and rendered without trimming. This makes those modes return far more results than requested. ✅ Addressed in [`c27c091`](https://github.com/jmagar/firenotes/commit/c27c0918dcbcf3e4db61a0a726f5200764eb2c44)

### M3. P2: Use `homedir()` from `node:os` instead of raw environment variables for legacy path resolution. The `os` import was 

- **Issue #33**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/utils/credentials.ts:N/A`

**Description**: P2: Use `homedir()` from `node:os` instead of raw environment variables for legacy path resolution. The `os` import was removed but `os.homedir()` is more robust than `process.env.HOME ?? process.env.USERPROFILE ?? ''` — it has OS-level fallbacks (e.g., `/etc/passwd`) for edge cases where `HOME` is unset. This inconsistency with `storage-paths.ts` (which uses `homedir()`) could cause silent migration failures in certain environments. ✅ Addressed in [`c27c091`](https://github.com/jmagar/firenotes/commit/c27c0918dcbcf3e4db61a0a726f5200764eb2c44)

### M4. P3: Restoring FIRECRAWL_HOME by assignment can leave a literal "undefined" value when the env var was originally unset. 

- **Issue #34**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/utils/credentials.test.ts:N/A`

**Description**: P3: Restoring FIRECRAWL_HOME by assignment can leave a literal "undefined" value when the env var was originally unset. This can pollute subsequent tests; delete the env var when it was originally undefined. ✅ Addressed in [`c27c091`](https://github.com/jmagar/firenotes/commit/c27c0918dcbcf3e4db61a0a726f5200764eb2c44)

### M5. P3: Restoring FIRECRAWL_HOME by direct assignment can leave a "undefined" string when the env var was previously unset. 

- **Issue #35**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/utils/job-history.test.ts:N/A`

**Description**: P3: Restoring FIRECRAWL_HOME by direct assignment can leave a "undefined" string when the env var was previously unset. Delete the variable when the original value was undefined to avoid leaking state into subsequent tests. ✅ Addressed in [`c27c091`](https://github.com/jmagar/firenotes/commit/c27c0918dcbcf3e4db61a0a726f5200764eb2c44)

### M6. P2: maskValue masks the literal "Not set" string into asterisks, so masked env vars that are actually missing appear as 

- **Issue #41**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: P2: maskValue masks the literal "Not set" string into asterisks, so masked env vars that are actually missing appear as masked secrets instead of "Not set". Handle the sentinel value explicitly to avoid misleading diagnostics. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M7. P2: `FIRECRAWL_HOME` lacks a fallback, so an unset env var makes the host path `/qdrant`. Provide a default value to avo

- **Issue #42**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docker-compose.yaml:N/A`

**Description**: P2: `FIRECRAWL_HOME` lacks a fallback, so an unset env var makes the host path `/qdrant`. Provide a default value to avoid root-level mounts and keep a predictable default storage location. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M8. P2: `FIRECRAWL_HOME` has no fallback, so when it’s unset the host path expands to `/embed-queue`. This changes the defau

- **Issue #43**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docker-compose.yaml:N/A`

**Description**: P2: `FIRECRAWL_HOME` has no fallback, so when it’s unset the host path expands to `/embed-queue`. This changes the default location to a root-level directory and can fail due to permissions. Add a default for `FIRECRAWL_HOME` (e.g., `${HOME}/.firecrawl`) so the volume resolves consistently. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M9. P2: Sources should reflect only the documents that were successfully retrieved; otherwise the output can cite URLs that 

- **Issue #44**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/ask.ts:N/A`

**Description**: P2: Sources should reflect only the documents that were successfully retrieved; otherwise the output can cite URLs that are not part of the context shown to the model. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M10. P2: normalizeUrlArgs should trim and drop empty entries before normalization; otherwise newline/whitespace artifacts (e.

- **Issue #45**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/shared.ts:N/A`

**Description**: P2: normalizeUrlArgs should trim and drop empty entries before normalization; otherwise newline/whitespace artifacts (e.g., CRLF or trailing spaces) become part of the URL and produce invalid requests. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M11. P2: `vi.unmock` is hoisted, so calling it inside the cleanup function won’t run at cleanup time. Use `vi.doUnmock` to un

- **Issue #46**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/helpers/lifecycle.ts:N/A`

**Description**: P2: `vi.unmock` is hoisted, so calling it inside the cleanup function won’t run at cleanup time. Use `vi.doUnmock` to unmock when cleanup executes. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M12. P2: `vi.mock` is hoisted and cannot safely capture the `homedir` parameter from this helper; the mock will execute befor

- **Issue #47**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/helpers/lifecycle.ts:N/A`

**Description**: P2: `vi.mock` is hoisted and cannot safely capture the `homedir` parameter from this helper; the mock will execute before `setupFileSystemMocks` is called, so the passed `homedir` value won’t be applied. Use `vi.doMock` (or move the mock to top-level) so the factory can access runtime values. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M13. P3: Docs say the embed queue always lives under `<storageRoot>`, but the code still honors `FIRECRAWL_EMBEDDER_QUEUE_DIR

- **Issue #48**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: P3: Docs say the embed queue always lives under `<storageRoot>`, but the code still honors `FIRECRAWL_EMBEDDER_QUEUE_DIR` overrides (including relative paths). This mismatch can misdirect users relying on a custom queue location. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M14. P3: Migration documentation is missing the override exception: legacy embed-queue migration is skipped when `FIRECRAWL_E

- **Issue #49**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: P3: Migration documentation is missing the override exception: legacy embed-queue migration is skipped when `FIRECRAWL_EMBEDDER_QUEUE_DIR` is set. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M15. P3: Documentation contradicts current behavior: FIRECRAWL_HOME allows `~` and relative paths (resolved via `path.resolve

- **Issue #50**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docs/storage-policy.md:N/A`

**Description**: P3: Documentation contradicts current behavior: FIRECRAWL_HOME allows `~` and relative paths (resolved via `path.resolve()`), but the doc now claims they are invalid. This will mislead users configuring storage paths. ✅ Addressed in [`df0d354`](https://github.com/jmagar/firenotes/commit/df0d3543be34a1177d27c4a29dc7409568949eec)

### M16. P2: ensureCollectionReady is not concurrency-safe: concurrent embeds can enter before collectionEnsured is set and each 

- **Issue #126**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/container/services/EmbedPipeline.ts:N/A`

**Description**: P2: ensureCollectionReady is not concurrency-safe: concurrent embeds can enter before collectionEnsured is set and each call will invoke ensureCollection. This defeats the “only once” guarantee and can trigger redundant collection creation or races under batch concurrency. ✅ Addressed in [`2df75c3`](https://github.com/jmagar/firenotes/commit/2df75c350abd9514ee1603ea71b7dcb7b547ec93)

### M17. P2: Default volume path is tied to a specific user home directory. Use a portable repo-relative or generic default so th

- **Issue #128**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docker-compose.tei.mxbai.yaml:N/A`

**Description**: P2: Default volume path is tied to a specific user home directory. Use a portable repo-relative or generic default so the compose file works out of the box without requiring a user-specific override. ✅ Addressed in [`e54bc66`](https://github.com/jmagar/firenotes/commit/e54bc66fb3142116868b29755ac78106bb20c8e1)

### M18. P2: `settings.json` and `job-history.json` are optional files created on-demand, but they're marked as `'fail'` when mis

- **Issue #129**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/doctor.ts:N/A`

**Description**: P2: `settings.json` and `job-history.json` are optional files created on-demand, but they're marked as `'fail'` when missing. On a fresh install, `doctor` would incorrectly report failures for files that simply haven't been created yet. Consider using `'warn'` (or `'pass'` with an informational message) for these optional files, similar to the special handling already done for `credentials.json`. ✅ Addressed in [`f683735`](https://github.com/jmagar/firenotes/commit/f683735f116c9084184b09cb57455821843e54d0)

### M19. P2: `parseComposePsJson` only handles NDJSON format (Docker Compose ≥2.21). Older versions output a JSON array, which wo

- **Issue #130**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/doctor.ts:101`

**Description**: P2: `parseComposePsJson` only handles NDJSON format (Docker Compose ≥2.21). Older versions output a JSON array, which would result in zero parsed entries ("No compose services detected"). Try parsing the whole string as a JSON array first, then fall back to line-by-line parsing. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M20. P2: When the initial OpenAI request returns non‑SSE JSON (common for providers that ignore `stream: true`), the code dis

- **Issue #131**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/doctor-debug.ts:317`

**Description**: P2: When the initial OpenAI request returns non‑SSE JSON (common for providers that ignore `stream: true`), the code discards that successful response and sends a second request. This doubles cost/latency and can hit rate limits. Handle the non‑event‑stream response body instead of re‑requesting. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M21. P2: Calling `.trim()` without a type guard can throw if `chunk_text` is not a string (Qdrant payloads are not type-safe)

- **Issue #132**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `scripts/check-qdrant-quality.ts:180`

**Description**: P2: Calling `.trim()` without a type guard can throw if `chunk_text` is not a string (Qdrant payloads are not type-safe). This will crash the quality check instead of reporting issues. Add a string type guard before trimming. ✅ Addressed in [`5a8036f`](https://github.com/jmagar/firenotes/commit/5a8036f4d38da94c646324f2fc4aa5a9e907a689)

### M22. P3: The `--default-prompt` default string ends with a stray `}`. TEI prepends this string verbatim to every input, so th

- **Issue #133**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `docker-compose.tei.yaml:N/A`

**Description**: P3: The `--default-prompt` default string ends with a stray `}`. TEI prepends this string verbatim to every input, so this typo becomes part of every query prompt. Remove the extra brace so prompts are clean. ✅ Addressed in [`e54bc66`](https://github.com/jmagar/firenotes/commit/e54bc66fb3142116868b29755ac78106bb20c8e1)

### M23. P2: The mock targets "child_process" but the new import uses "node:child_process", so the mock no longer applies and the

- **Issue #151**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/ask.test.ts:22`

**Description**: P2: The mock targets "child_process" but the new import uses "node:child_process", so the mock no longer applies and the test may invoke the real spawn. Update the mock specifier to match the new import. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M24. P2: The confirmation guard checks only stdout, but the prompt reads from stdin. In non-interactive environments with std

- **Issue #153**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/crawl/command.ts:427`

**Description**: P2: The confirmation guard checks only stdout, but the prompt reads from stdin. In non-interactive environments with stdin not TTY, this can still attempt a prompt. Check stdin (and optionally stdout) before prompting to avoid hanging or bypassing the safety check.

### M25. P2: Full mode is treated as non-deduplicated for fetch sizing, but executeQuery still deduplicates by URL. That means fu

- **Issue #154**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/query.ts:77`

**Description**: P2: Full mode is treated as non-deduplicated for fetch sizing, but executeQuery still deduplicates by URL. That means full mode can return fewer unique URLs than the requested limit because it only fetches `requestedLimit` chunks before grouping. Either keep overfetching or skip URL grouping when full is enabled. ✅ Addressed in [`e54bc66`](https://github.com/jmagar/firenotes/commit/e54bc66fb3142116868b29755ac78106bb20c8e1)

### M26. P2: The new settings-based default for `--ignore-query-parameters` is ignored because default-sourced values are strippe

- **Issue #182**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/map.ts:573`

**Description**: P2: The new settings-based default for `--ignore-query-parameters` is ignored because default-sourced values are stripped when building `mapOptions`, so user settings never take effect unless the flag is explicitly set. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M27. P2: `--allow-external-links` now takes its default from settings, but there is no `--no-allow-external-links` flag. If a

- **Issue #183**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/extract.ts:391`

**Description**: P2: `--allow-external-links` now takes its default from settings, but there is no `--no-allow-external-links` flag. If a user sets the default to true in settings, they can no longer disable external links for a single run. Add a `--no-allow-external-links` option or defer applying the setting until option handling so the CLI can override it.

### M28. P2: TOCTOU race: `fs.existsSync()` followed by `fs.statSync()` can throw an unhandled `ENOENT` if the file is deleted be

- **Issue #184**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/utils/settings.ts:N/A`

**Description**: P2: TOCTOU race: `fs.existsSync()` followed by `fs.statSync()` can throw an unhandled `ENOENT` if the file is deleted between the two calls. Use a single `statSync` in a try/catch instead. ✅ Addressed in [`9316cbe`](https://github.com/jmagar/firenotes/commit/9316cbef53649777a267651e05d57d9d23ae59a0)

### M29. P2: Limit validation doesn’t reject `NaN` (e.g., `--limit foo`), so invalid inputs silently default to 10. Validate with

- **Issue #185**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: P2: Limit validation doesn’t reject `NaN` (e.g., `--limit foo`), so invalid inputs silently default to 10. Validate with `Number.isFinite` (and optionally `Number.isInteger`) to enforce the “positive integer” constraint. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M30. P2: This assertion doesn't prove doc2 was excluded—`toHaveBeenCalledWith(expect.not.stringContaining(...))` will still p

- **Issue #186**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/ask.test.ts:428`

**Description**: P2: This assertion doesn't prove doc2 was excluded—`toHaveBeenCalledWith(expect.not.stringContaining(...))` will still pass if any call doesn't include doc2. Use a negative assertion so the test fails if doc2 was ever written. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M31. P2: `-p/--prompt` requires a prompt argument for both Claude and Gemini CLIs. Here it’s provided without a prompt, so th

- **Issue #187**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/doctor-debug.ts:N/A`

**Description**: P2: `-p/--prompt` requires a prompt argument for both Claude and Gemini CLIs. Here it’s provided without a prompt, so the CLI exits with a usage error before reading stdin, and doctor-debug will fail to run. Pass the prompt argument (or remove `-p` and rely on stdin mode).

### M32. P2: parseIntegerSetting uses parseInt, which silently accepts partial numeric strings (e.g., "10ms" → 10). This can appl

- **Issue #188**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: P2: parseIntegerSetting uses parseInt, which silently accepts partial numeric strings (e.g., "10ms" → 10). This can apply an unintended setting instead of rejecting invalid input. Use strict numeric parsing and integer validation so invalid values are rejected. ✅ Addressed in [`0335066`](https://github.com/jmagar/firenotes/commit/033506654b8e5eb1e26a49755f48c1d0a5d995e5)

### M33. P3: The `grep "^\d\."` example won’t match numbered lines with standard grep (\d isn’t a POSIX digit class). Use a porta

- **Issue #189**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `.claude/skills/firecrawl/examples/ask-command-usage.md:183`

**Description**: P3: The `grep "^\d\."` example won’t match numbered lines with standard grep (\d isn’t a POSIX digit class). Use a portable digit range or enable extended/PCRE regex so the example works as shown.

### M34. P2: Sanitize `--interval` before using it; a non-numeric value results in `NaN` and an immediate tight loop in watch mod

- **Issue #221**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/status.ts:N/A`

**Description**: P2: Sanitize `--interval` before using it; a non-numeric value results in `NaN` and an immediate tight loop in watch mode. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M35. P2: The example value uses `~/.firecrawl`, which is not an absolute path and can fail in Docker Compose env-file usage. 

- **Issue #222**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `.env.example:12`

**Description**: P2: The example value uses `~/.firecrawl`, which is not an absolute path and can fail in Docker Compose env-file usage. Keep the example absolute to match the guidance and avoid unresolved `~` expansion.

### M36. P2: `--output` now forces JSON formatting for extract output, even when the path isn’t `.json`. This overrides `shouldOu

- **Issue #223**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/extract.ts:N/A`

**Description**: P2: `--output` now forces JSON formatting for extract output, even when the path isn’t `.json`. This overrides `shouldOutputJson` and makes extract behave differently from other commands (and from non-JSON file outputs). Consider relying solely on `shouldOutputJson` so text output can still be saved to non-JSON files. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M37. P2: Console spies are not restored after each test, so they can leak into other test suites and mask console output. Add

- **Issue #224**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/completion.test.ts:13`

**Description**: P2: Console spies are not restored after each test, so they can leak into other test suites and mask console output. Add an afterEach/afterAll that calls vi.restoreAllMocks() or restore the spies explicitly.

### M38. P3: When there are no domains, formatTable still renders a table with a placeholder “—” row (formatAlignedTable inserts 

- **Issue #225**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/domains.ts:123`

**Description**: P3: When there are no domains, formatTable still renders a table with a placeholder “—” row (formatAlignedTable inserts a dash row for empty data). This produces a misleading output after the empty-state message. Consider skipping the table when domains.length === 0.

### M39. P3: `--pretty` no longer triggers JSON output for `embed status`. With this change, `--pretty` alone yields the human-re

- **Issue #226**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/embed.ts:290`

**Description**: P3: `--pretty` no longer triggers JSON output for `embed status`. With this change, `--pretty` alone yields the human-readable block instead of pretty-printed JSON, which is a behavioral regression from the previous logic.

### M40. P3: When there are no domains, this table already inserts a placeholder row (formatAlignedTable’s default), and you also

- **Issue #227**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/stats.ts:134`

**Description**: P3: When there are no domains, this table already inserts a placeholder row (formatAlignedTable’s default), and you also append the empty-state message. This yields duplicate empty-state output. Consider disabling the dash-row when you already show CANONICAL_EMPTY_STATE. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M41. P3: The label "EST" is incorrect during daylight saving time. Since the formatter uses America/New_York, the output will

- **Issue #228**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/utils/display.ts:N/A`

**Description**: P3: The label "EST" is incorrect during daylight saving time. Since the formatter uses America/New_York, the output will be EDT for part of the year, so the label should be generic (ET) or derived from the formatter. ✅ Addressed in [`6264d6b`](https://github.com/jmagar/firenotes/commit/6264d6b459d64a090b31eea396b440f58dbefa25)

### M42. P3: Restore console.log after each test to avoid mock leakage across test files.

- **Issue #229**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/version.test.ts:11`

**Description**: P3: Restore console.log after each test to avoid mock leakage across test files.

### M43. P2: The test can pass even if the overview table is missing because it never asserts that the metric or by-domain header

- **Issue #230**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/stats.test.ts:230`

**Description**: P2: The test can pass even if the overview table is missing because it never asserts that the metric or by-domain headers were found (indices can be -1, yielding an empty slice). Add explicit expectations for the indices so the test fails when the table is absent.

### M44. P2: `limit` should be validated as a positive integer before sending it to Qdrant. The current check only enforces finit

- **Issue #231**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/commands/query.ts:69`

**Description**: P2: `limit` should be validated as a positive integer before sending it to Qdrant. The current check only enforces finiteness and >0, so fractional values can slip through and violate the Qdrant API contract.

### M45. P3: The console.warn spy is never restored, so console.warn remains mocked after this test and can affect later tests. R

- **Issue #232**
- **Severity**: Minor
- **Author**: cubic-dev-ai[bot]
- **File**: `src/__tests__/commands/crawl/status.test.ts:421`

**Description**: P3: The console.warn spy is never restored, so console.warn remains mocked after this test and can affect later tests. Restore the spy (or call vi.restoreAllMocks) after the assertions.

---

## Category 4: Nitpick (77 issues)

Code style, trivial improvements, and cosmetic suggestions.

### N1. Consider commenting out `FIRECRAWL_HOME` since it matches the built-in default.

- **Issue #5**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `.env.example:N/A`

**Description**: Consider commenting out `FIRECRAWL_HOME` since it matches the built-in default. Setting `FIRECRAWL_HOME=~/.firecrawl` explicitly in the example means every user who copies the file verbatim will have an env var that merely replicates the default. This masks the "no override" state and can confuse users into thinking it's required. Commenting it out (like `TEI_URL`) makes it clearer that it's optional:

### N2. Bare `fetch()` calls lack timeouts — risk of hanging indefinitely.

- **Issue #7**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:103`

**Description**: Bare `fetch()` calls lack timeouts — risk of hanging indefinitely. All HTTP calls in this script (`getClusterInfo`, `listCollections`, `getCollectionInfo`, `fetchAllPoints`, `deletePoints`) use raw `fetch()` without any timeout. If Qdrant is unresponsive, the script will hang. As per coding guidelines, `/*.ts` files should use `fetchWithRetry()` or `fetchWithTimeout()` from `utils/http.ts`.

### N3. Unnecessary `Array.from()` — `Map.entries()` is directly iterable in `for...of`.

- **Issue #9**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:N/A`

**Description**: Unnecessary `Array.from()` — `Map.entries()` is directly iterable in `for...of`. > ‼️ IMPORTANT

### N4. Consider also testing a custom (non-default) `FIRECRAWL_HOME` path.

- **Issue #10**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/info.test.ts:383`

**Description**: Consider also testing a custom (non-default) `FIRECRAWL_HOME` path. This test verifies tilde expansion for `~/.firecrawl` (the default path). It would be more robust to test with a truly custom path like `~/custom-firecrawl-dir` to confirm FIRECRAWL_HOME actually overrides the default rather than coincidentally matching it.

### N5. Dynamic `await import()` without `vi.resetModules()` returns a cached module — works here, but is misleading.

- **Issue #14**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/storage-paths.test.ts:50`

**Description**: Dynamic `await import()` without `vi.resetModules()` returns a cached module — works here, but is misleading. `getStorageRoot()` reads `process.env` at call time, so the dynamic import is unnecessary. Repeated `await import()` calls return the same cached module. Consider a static import for clarity, or add `vi.resetModules()` in `beforeEach` if you actually intend to test module-load-time behavior:

### N6. Consider using theme icons instead of raw boolean strings for existence checks.

- **Issue #15**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/info.ts:N/A`

**Description**: Consider using theme icons instead of raw boolean strings for existence checks. The existence section displays raw `"true"`/`"false"` strings, while the rest of the CLI uses terminal-safe icons from `utils/theme.ts`. Using `icons.success`/`icons.error` (✓/✗) would be more consistent with the CLI's visual language.

### N7. Using `process.exit(1)` instead of Commander's error flow.

- **Issue #16**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/info.ts:306`

**Description**: Using `process.exit(1)` instead of Commander's error flow. `command.error(...)` is the idiomatic Commander.js way to report user-input errors — it integrates with `exitOverride()` and `configureOutput()`, which matters for testability. Direct `process.exit(1)` bypasses those hooks.

### N8. Inconsistent error message format compared to other commands.

- **Issue #18**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/search.ts:165`

**Description**: Inconsistent error message format compared to other commands. The crawl command wraps the error with `"Crawl operation failed: ${errorMessage}"`, but here the raw `buildApiErrorMessage` output is returned without a command-specific prefix. Consider wrapping with `"Search failed: ${...}"` for consistency.

### N9. Consider simplifying the undefined-filtering logic.

- **Issue #19**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/container/services/HttpClient.ts:N/A`

**Description**: Consider simplifying the undefined-filtering logic. The conditional spread for each field is correct but verbose. A helper or a compact filter pattern would reduce repetition, especially if more options are added later.

### N10. `QUEUE_DIR` is evaluated at import time — env changes after import are ignored.

- **Issue #21**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:N/A`

**Description**: `QUEUE_DIR` is evaluated at import time — env changes after import are ignored. `getEmbedQueueDir()` reads `FIRECRAWL_EMBEDDER_QUEUE_DIR` and `FIRECRAWL_HOME` at module load. This is consistent with `job-history.ts` (which does the same for `HISTORY_DIR`/`HISTORY_PATH`), and is fine for a CLI that sets env vars before running. However, it makes the module harder to test if tests need to vary these values — you'd need `vi.resetModules()` or dynamic imports to re-evaluate.

### N11. `getStoragePath()` with no arguments is semantically unclear.

- **Issue #24**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:N/A`

**Description**: `getStoragePath()` with no arguments is semantically unclear. `HISTORY_DIR = getStoragePath()` effectively returns `getStorageRoot()`. Consider using `getStorageRoot()` directly to better express intent, or introduce a `getStorageRoot` import.

### N12. Migration log doesn't use `fmt.dim()` — inconsistent with `credentials.ts` and `settings.ts`.

- **Issue #26**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:113`

**Description**: Migration log doesn't use `fmt.dim()` — inconsistent with `credentials.ts` and `settings.ts`. Other migration modules wrap their migration messages in `fmt.dim(...)` for consistent styling. This one outputs a plain string.

### N13. TOCTOU race in migration is low-risk but worth noting.

- **Issue #29**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/settings.ts:254`

**Description**: TOCTOU race in migration is low-risk but worth noting. CodeQL flags a race between `fs.existsSync(newPath)` (line 63) and `fs.writeFileSync(newPath, ...)` (line 81). Two concurrent CLI invocations could both see the target as absent and both write. Since both would write valid validated data, the practical risk is negligible for one-time migration code. If you want to harden this, use `fs.writeFileSync` with `{ flag: 'wx' }` (exclusive creation) and catch `EEXIST`.

### N14. Minor: Repetitive sentence structure in queue maintenance list.

- **Issue #57**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `README.md:1126`

**Description**: Minor: Repetitive sentence structure in queue maintenance list. Three consecutive bullet points start with "`firecrawl crawl`" (lines 970-973), which reads monotonously. Consider varying the phrasing, e.g. "The `crawl cleanup` subcommand removes…" or grouping crawl/embed bullets under sub-headings.

### N15. Good coverage for the happy path — consider adding edge-case tests.

- **Issue #62**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/crawl/status.test.ts:490`

**Description**: Good coverage for the happy path — consider adding edge-case tests. Both new suites (`executeCrawlClear`, `executeCrawlCleanup`) validate the primary flow well. Potential additions for robustness:

### N16. `expectCalledWithUrlAndOptions` and `expectCalledWithQueryAndOptions` are identical implementations.

- **Issue #63**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/assertions.ts:110`

**Description**: `expectCalledWithUrlAndOptions` and `expectCalledWithQueryAndOptions` are identical implementations. These two functions have the same body — only the parameter names differ. Consider consolidating into a single generic helper (e.g., `expectCalledWithArgAndOptions`) and aliasing if semantic naming is desired.

### N17. `expectProperties` uses `toBe()` (strict reference equality) for value comparison.

- **Issue #64**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/assertions.ts:243`

**Description**: `expectProperties` uses `toBe()` (strict reference equality) for value comparison. For primitive values this is fine, but if any property value is an object or array, `toBe` will fail even with structurally equal content. Consider using `toEqual()` for deep equality, or document that this helper is intended for primitives only.

### N18. `getContext()` will return `undefined` if called before `beforeEach` runs.

- **Issue #65**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/lifecycle.ts:165`

**Description**: `getContext()` will return `undefined` if called before `beforeEach` runs. The `context` variable on line 141 is declared with `let context: T` but never initialized. If a test accidentally calls `getContext()` before the first `beforeEach` executes, it silently returns `undefined` cast as `T`. Consider adding a guard:

### N19. `batchEmbed` default mock resolves to `undefined`, mismatching `IEmbedPipeline` return type.

- **Issue #66**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/mock-setup.ts:87`

**Description**: `batchEmbed` default mock resolves to `undefined`, mismatching `IEmbedPipeline` return type. The interface declares `batchEmbed` returns `Promise<{ succeeded: number; failed: number; errors: string[] }>`. The default `mockResolvedValue(undefined)` will type-check at runtime but silently return the wrong shape. Consider:

### N20. Unbounded parallel `executeRetrieve` calls — consider limiting concurrency.

- **Issue #69**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:138`

**Description**: Unbounded parallel `executeRetrieve` calls — consider limiting concurrency. `Promise.all` fires up to `limit` (default 10) parallel retrieve requests with no concurrency cap. While 10 is usually fine, a user-configurable `--limit` could cause a burst of requests. A bounded concurrency approach (e.g., `p-limit`) would be safer.

### N21. Good consolidation of subcommand handling logic.

- **Issue #73**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/batch.ts:179`

**Description**: Good consolidation of subcommand handling logic. The generic `handleBatchSubcommand` centralizes error handling, output formatting, and job recording for all batch subcommands. One note: the `process.exit(1)` in the catch block (line 155) makes this function difficult to unit-test in isolation compared to returning a `CommandResult`. The main `executeBatch` uses the result-object pattern — consider aligning for consistency if testability matters.

### N22. `validateSettingKey` never returns `false` — the return type is misleading.

- **Issue #75**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: `validateSettingKey` never returns `false` — the return type is misleading. The function either calls `process.exit(1)` or returns `true`. The `boolean` return type implies it could return `false`, which is never the case. A void return (or throwing) would be clearer.

### N23. Duplicate error-classification logic with `background-embedder.ts`.

- **Issue #76**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/status.ts:N/A`

**Description**: Duplicate error-classification logic with `background-embedder.ts`. `isNotFoundError` checks the same patterns (`'job not found'`, `'invalid job id'`) as `isPermanentJobError` in `src/utils/background-embedder.ts` (lines 46–53). Consider extracting a shared helper to avoid drift between these two classifications.

### N24. Sequential API calls for up to 100 jobs — acceptable but worth noting.

- **Issue #78**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/status.ts:275`

**Description**: Sequential API calls for up to 100 jobs — acceptable but worth noting. `executeCrawlCleanup` makes one `getCrawlStatus` call per job ID, up to 100 sequential network requests. This is fine for an infrequent maintenance operation, but consider adding a brief log or progress indicator so users aren't left waiting without feedback during cleanup.

### N25. Redundant re-grouping: items are already deduplicated in `executeQuery`.

- **Issue #80**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: Redundant re-grouping: items are already deduplicated in `executeQuery`. `executeQuery` (lines 88-98) already groups by base URL, ranks, and returns the flattened top-N items. `formatCompact` then calls `groupByBaseUrl` and `rankUrlGroups` a second time on the same items, performing identical work. The same applies to `formatGrouped` (line 684-688).

### N26. `extractResults` uses `||` — consider `??` to preserve explicit `null` distinction.

- **Issue #81**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/search.ts:150`

**Description**: `extractResults` uses `||` — consider `??` to preserve explicit `null` distinction. Using `||` means if `result.web` is `null` (rather than `undefined`), it falls through to `result.data.web`. If the API intentionally returns `null` for a field to indicate "no results for this source type" vs `undefined` for "field not requested," the `||` would mask that distinction. In practice this is likely fine since both cases mean "no results," but `??` would be more precise.

### N27. `process.exit(1)` in a shared utility hinders testability.

- **Issue #82**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/shared.ts:155`

**Description**: `process.exit(1)` in a shared utility hinders testability. `resolveRequiredUrl` calls `process.exit(1)` directly, which bypasses Commander's `exitOverride()` hook and makes the function impossible to test without intercepting the process exit. Since `validateEmbeddingUrls` and `validateQdrantUrl` already demonstrate the return-an-error-object pattern, consider the same approach here.

### N28. Fragile error classification via string matching.

- **Issue #85**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/background-embedder.ts:56`

**Description**: Fragile error classification via string matching. `isCrawlStillRunningError` relies on the error message starting with `"crawl still "` (line 56), which is tightly coupled to the `throw new Error(\`Crawl still ${status.status}\`)` on line 152. If the thrown message format changes, this detection silently breaks.

### N29. Migration runs on every `loadCredentials()` call.

- **Issue #87**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/credentials.ts:200`

**Description**: Migration runs on every `loadCredentials()` call. `migrateLegacyCredentials()` performs synchronous filesystem I/O (`existsSync`) on every invocation of `loadCredentials`. After migration, the fast path (line 77–78) is a single `existsSync` call, so the overhead is small. Consider adding a module-level `migrated` flag to skip entirely after the first run within a process lifetime.

### N30. Redundant check in `isIrrecoverableError`.

- **Issue #88**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:577`

**Description**: Redundant check in `isIrrecoverableError`. `'invalid job id format'` (line 571) is already matched by `'invalid job id'` (line 570) since `includes` is a substring check. The extra line is harmless but unnecessary.

### N31. Consider narrowing the `'socket'` indicator.

- **Issue #89**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/network-error.ts:16`

**Description**: Consider narrowing the `'socket'` indicator. The term `socket` is broad and could match non-network error messages (e.g., WebSocket-related messages). In practice, the `isLocalApiUrl` guard limits false positives, but a more specific indicator like `'socket hang up'` or `'esocket'` would be more precise.

### N32. CPU image default lacks GPU resources, but includes CUDA env vars.

- **Issue #101**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.mxbai.yaml:N/A`

**Description**: CPU image default lacks GPU resources, but includes CUDA env vars. The default image is `cpu-1.8.1` and there's no `deploy.resources.reservations.devices` block (unlike `docker-compose.tei.yaml`), which is fine for CPU-only use. However, `PYTORCH_CUDA_ALLOC_CONF` on line 40 is meaningless for a CPU-only container. This is harmless but potentially confusing.

### N33. Thorough `ask` command documentation with good architectural rationale.

- **Issue #105**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `README.md:861`

**Description**: Thorough `ask` command documentation with good architectural rationale. The "Why CLI Subprocess?" section (lines 818–823) effectively justifies the design choice. The stdout/stderr separation for pipe-safe output (lines 847–860) is a useful detail for CLI users.

### N34. Sorted array already gives min/max — `reduce` is unnecessary O(n).

- **Issue #106**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `scripts/check-qdrant-quality.ts:585`

**Description**: Sorted array already gives min/max — `reduce` is unnecessary O(n). `counts` is sorted ascending on Line 558. You can read `counts[0]` and `counts[counts.length - 1]` directly instead of iterating the entire array with `reduce`.

### N35. Consider typed return values for mock helpers instead of `any`.

- **Issue #107**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/ask.test.ts:N/A`

**Description**: Consider typed return values for mock helpers instead of `any`. `createMockQueryResult` and `createMockRetrieveResult` return `any`, which silently allows mismatches with the actual `QueryResultItem` / `RetrieveResult['data']` types. Importing and using the proper types would catch drift if the data shapes change.

### N36. Tests cover the happy paths well. Consider adding a case for partial OpenAI configuration.

- **Issue #108**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/doctor-debug.test.ts:52`

**Description**: Tests cover the happy paths well. Consider adding a case for partial OpenAI configuration. When only some of `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` are set (but not all), `hasDoctorDebugBackendConfigured()` should return `false`. A quick additional test would strengthen coverage of the `getOpenAiFallbackConfig` guard.

### N37. `mockFetch` is embedded inside `mockHttpClient` but accessing it requires a type escape hatch.

- **Issue #111**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/mock-setup.ts:149`

**Description**: `mockFetch` is embedded inside `mockHttpClient` but accessing it requires a type escape hatch. `mockFetch` (line 148) is available at runtime via `container.getHttpClient().mockFetch`, but since the container is cast through `unknown as IContainer`, callers have no type-safe way to reach it. Consider exporting a richer return type from `createMockContainer` (or a companion accessor) so tests can configure fetch behaviour without `as any` casts.

### N38. `resolveAskModel` returns raw env value without validation — could spawn an arbitrary CLI.

- **Issue #112**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/ask.ts:24`

**Description**: `resolveAskModel` returns raw env value without validation — could spawn an arbitrary CLI. If `ASK_CLI` is set to a value that doesn't start with `gemini-` (e.g., `malicious-binary`), the code on line 190 will attempt `spawn('claude', ['-p', '--model', 'malicious-binary'])`. While this isn't a direct arbitrary-execution vector (the binary is hardcoded to `claude` or `gemini`), consider documenting the expected values or validating the model name against a known set.

### N39. `viewConfig` is declared `async` but contains no `await` expressions.

- **Issue #115**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: `viewConfig` is declared `async` but contains no `await` expressions. The function is entirely synchronous. The `async` keyword adds unnecessary overhead (wraps return in a Promise). If the signature needs to stay `Promise<void>` for interface consistency, that's fine — just noting the mismatch.

### N40. Bare `fetch()` call bypasses the project's HTTP utilities.

- **Issue #118**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:237`

**Description**: Bare `fetch()` call bypasses the project's HTTP utilities. `runHttpCheck` uses the native `fetch` directly with a manual `AbortController` timeout. While the manual timeout works for a single-shot probe, this still violates the project convention.

### N41. Shell command constructed with string interpolation — safe here but fragile.

- **Issue #119**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:379`

**Description**: Shell command constructed with string interpolation — safe here but fragile. `containerPath` is currently always the hardcoded `'/qdrant/storage'` (Line 740), so the `touch "${probeFile}"` interpolation is safe. However, if `runContainerWriteProbe` is ever called with a user-supplied `containerPath`, the double-quoted shell expansion could break or be exploited. Consider documenting this constraint or switching to an array-based exec approach.

### N42. URL canonicalization is solid but consider case-normalizing the hostname.

- **Issue #122**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:N/A`

**Description**: URL canonicalization is solid but consider case-normalizing the hostname. `canonicalizeUrl` strips fragments, default ports, trailing slashes, and tracking params — good. However, hostnames are case-insensitive per RFC, and two chunks with `Example.COM` vs `example.com` would produce different canonical URLs and thus different groups. Consider adding `parsed.hostname = parsed.hostname.toLowerCase()` — though `new URL()` already lowercases the hostname in most runtimes, so this may be a non-issue.

### N43. Dead-code condition in `lastUpdated` tracking.

- **Issue #124**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/shared.ts:134`

**Description**: Dead-code condition in `lastUpdated` tracking. On Line 126, `entry.lastUpdated === undefined` is always `false` when `trackLastUpdated` is `true` because Line 115 initializes `lastUpdated` to `''`. The comparison `scrapedAt > entry.lastUpdated` on the same line already handles the empty-string initial case correctly, so this is functionally fine but the `undefined` check is misleading.

### N44. External network `jakenet` appears developer-specific.

- **Issue #136**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `docker-compose.tei.yaml:N/A`

**Description**: External network `jakenet` appears developer-specific. This ties the compose file to a pre-existing network on a specific developer's machine. Consider removing the network declaration or making it configurable for broader usability.

### N45. Background server PID file has no cleanup on crash.

- **Issue #138**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `docs/testing-guide.md:84`

**Description**: Background server PID file has no cleanup on crash. If the server process crashes or the machine reboots, the stale PID file at `/tmp/firecrawl-test-server.pid` will remain and `kill` will either fail or kill a wrong process. Consider adding a guard in the stop command.

### N46. Spreading the container to override `config.apiUrl` is fragile.

- **Issue #139**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/scrape.test.ts:262`

**Description**: Spreading the container to override `config.apiUrl` is fragile. The spread `{ ...mockContainer, config: { ...mockContainer.config, ... } } as IContainer` creates a plain object. If `mockContainer`'s methods (e.g., `getFirecrawlClient`) are prototype-based rather than own properties, they'd be silently dropped. Consider using `createMockContainer` with the `apiUrl` override directly instead:

### N47. Redundant unsupported-shell check — `validateShellAndGetRcPath` already exits.

- **Issue #142**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/completion.ts:242`

**Description**: Redundant unsupported-shell check — `validateShellAndGetRcPath` already exits. `validateShellAndGetRcPath(shell)` on line 235 calls `process.exit(1)` for unsupported shells, so the `generateScript(shell)` null check on line 238 is unreachable for the same condition. Consider removing the redundant guard or, if you want defense-in-depth, at least add a comment.

### N48. Silently skipping jobs on non-"not found" API errors.

- **Issue #144**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/status.ts:253`

**Description**: Silently skipping jobs on non-"not found" API errors. When `getCrawlStatus` throws a transient error (network timeout, 500, etc.), the job is silently skipped — no counter, no log. Consider tracking skipped jobs and surfacing the count in the result so users know some jobs weren't assessed.

### N49. `processStaleJobsOnce` return value doesn't account for cleanup.

- **Issue #148**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/background-embedder.ts:336`

**Description**: `processStaleJobsOnce` return value doesn't account for cleanup. The function returns `staleJobs.length` (line 334) but the irrecoverable cleanup on lines 325–332 may also remove jobs. Callers (and tests) treat the return value as "processed count," which is accurate for stale jobs but doesn't reflect cleanup work. This is minor since the return value is only used for logging, but worth noting if the semantics matter later.

### N50. Only the first invalid value is reported before exit.

- **Issue #149**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/command.ts:217`

**Description**: Only the first invalid value is reported before exit. If a user passes multiple invalid values (e.g., `--source foo,bar` where both are invalid), only the first one triggers an error message before `process.exit(1)`. Consider collecting all invalid values and reporting them together for a better user experience.

### N51. Success path test validates sources, scores, document count, and answer — good coverage.

- **Issue #156**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/ask.test.ts:387`

**Description**: Success path test validates sources, scores, document count, and answer — good coverage. One minor note: this test doesn't verify that `context` is correctly assembled (e.g., both documents appear in the stdin write). Consider asserting on `mockProc.stdin.write` call args if context integrity matters.

### N52. `clearJobTypeHistory` test validates selective clearing correctly.

- **Issue #157**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/job-history.test.ts:352`

**Description**: `clearJobTypeHistory` test validates selective clearing correctly. The test properly asserts that only the targeted job type is cleared while others remain intact.

### N53. `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET` raw value flows to `item.value` but `maskUrlCredentials` is not applied to it — only

- **Issue #160**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:444`

**Description**: `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET` raw value flows to `item.value` but `maskUrlCredentials` is not applied to it — only `maskValue` is used at display time. This is fine for secrets (maskValue handles them), but note that URL-type env vars like `SEARXNG_ENDPOINT` (Line 153) are eagerly masked with `maskUrlCredentials` at build time while secret strings rely on display-time masking. This inconsistency means `buildRuntimeEnvItems()` returns a mix of pre-masked and raw values, which makes the `masked` flag's semantics ambiguous: sometimes the value is already masked (URLs), sometimes it's raw and needs masking (API keys).

### N54. `validateSettingKey` uses `process.exit(1)` and returns `true` — the inconsistency with `handleConfigGet`'s inline valid

- **Issue #162**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:514`

**Description**: `validateSettingKey` uses `process.exit(1)` and returns `true` — the inconsistency with `handleConfigGet`'s inline validation is a maintenance risk. `handleConfigGet` (Lines 450-460) performs its own key validation with a different set of allowed keys (`excludes` is accepted there but not here). If someone adds a new setting and only updates one location, the other will reject it.

### N55. `access(path)` without a mode constant only checks visibility, not writability.

- **Issue #164**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/doctor.ts:350`

**Description**: `access(path)` without a mode constant only checks visibility, not writability. Line 328 calls `access(path)` without passing `fs.constants.W_OK`, so it only verifies the path is visible to the process (equivalent to `F_OK`). The subsequent write-probe catches the real failure, but the `access` call is misleading — it suggests a permission check that doesn't actually happen. Either pass `fs.constants.W_OK` or remove the redundant `access` call entirely.

### N56. Duplicated verbose-snippet debug block across `formatCompact` and `formatGrouped`.

- **Issue #168**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/query.ts:570`

**Description**: Duplicated verbose-snippet debug block across `formatCompact` and `formatGrouped`. The candidate-sorting-and-formatting logic at lines 626-643 and 740-761 is nearly identical. Extract a small helper to keep them in sync and reduce surface area for drift.

### N57. In-process lock implementation is correct but retains a non-null assertion.

- **Issue #170**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:46`

**Description**: In-process lock implementation is correct but retains a non-null assertion. The promise-chain lock pattern is sound — the executor runs synchronously so `releaseLock` is always assigned before line 44. However, the PR commits mention "removal of non-null assertions." You can eliminate the `!` by initializing `releaseLock` to a no-op.

### N58. Migration validates array presence but not element shape.

- **Issue #171**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:103`

**Description**: Migration validates array presence but not element shape. `parsed.crawl` etc. are checked with `Array.isArray`, but individual entries are trusted blindly. Malformed legacy entries (e.g., missing `id` or `updatedAt`) would silently propagate. Consider filtering entries to those matching `JobHistoryEntry`.

### N59. Temp file left behind if `rename` fails.

- **Issue #172**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/job-history.ts:148`

**Description**: Temp file left behind if `rename` fails. If `fs.rename` throws (e.g., cross-device move, permissions), the `.tmp` file remains on disk. A `try/finally` cleanup would improve robustness.

### N60. Fix markdownlint warnings: add blank lines around fenced code blocks in list items and add language specifiers.

- **Issue #190**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `.claude/skills/firecrawl/examples/ask-command-usage.md:232`

**Description**: Fix markdownlint warnings: add blank lines around fenced code blocks in list items and add language specifiers. Several fenced code blocks in the troubleshooting section are missing surrounding blank lines (MD031) and language specifiers (MD040). For example, the blocks at lines 197, 211, and 224 should have blank lines before/after within the list context, and the output blocks should specify a language (e.g., `text` or `bash`).

### N61. CI/CD example may need a note about authentication requirements.

- **Issue #192**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `.claude/skills/firecrawl/examples/ask-command-usage.md:300`

**Description**: CI/CD example may need a note about authentication requirements. The GitHub Actions example assumes `claude` CLI is available and authenticated in CI. Users following this pattern would need to set up Claude authentication in their CI environment. Consider adding a brief note about this prerequisite.

### N62. Missing TTY detection for ANSI color codes.

- **Issue #196**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `scripts/extract-base-urls.sh:36`

**Description**: Missing TTY detection for ANSI color codes. The script unconditionally sets ANSI color codes. When piped (e.g., `./extract-base-urls.sh | tee log.txt`), raw escape sequences will appear in the output. The project's own skills documentation recommends TTY-safe detection via `[ -t 1 ]` / `[ -t 2 ]`.

### N63. Temp file cleanup trap should quote the path.

- **Issue #197**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `scripts/extract-base-urls.sh:N/A`

**Description**: Temp file cleanup trap should quote the path. If `mktemp` returns a path with spaces (unlikely but possible on some systems), the unquoted `$temp_file` in the trap would break. Use escaped quotes inside the double-quoted trap string.

### N64. Subcommand existence tests are minimal but sufficient for registration verification.

- **Issue #200**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/commands/crawl.test.ts:1160`

**Description**: Subcommand existence tests are minimal but sufficient for registration verification. Consider adding at least one functional test per subcommand (e.g., verifying `clear` and `cleanup` call their respective handlers) to guard against wiring regressions.

### N65. `setupConsoleCapture` has no lifecycle hooks — callers must manually call `restore()`.

- **Issue #201**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/helpers/process.ts:143`

**Description**: `setupConsoleCapture` has no lifecycle hooks — callers must manually call `restore()`. Unlike `setupCommandTestCapture`, this function doesn't register `afterEach` cleanup. If a caller forgets to call `restore()`, spies leak across tests. This is fine if intentional (one-shot usage via `withConsoleCapture`), but worth a brief doc note to prevent misuse in `describe` blocks.

### N66. Regex fallback test relies on `new URL()` throwing for non-numeric ports on non-special schemes.

- **Issue #203**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/__tests__/utils/api-key-scrubber.test.ts:444`

**Description**: Regex fallback test relies on `new URL()` throwing for non-numeric ports on non-special schemes. `scheme://user:pass@host:port` triggers a regex fallback because the WHATWG URL parser rejects the non-numeric port string `"port"`. This is correct behavior per the spec today, but it's a somewhat subtle coupling. A comment noting *why* this specific URL triggers the fallback (non-numeric port on an authority-bearing URL) would make the intent clearer for future maintainers—though the existing comment is already decent.

### N67. `validateSettingKey` still uses `process.exit(1)` — inconsistent with the PR's move toward `process.exitCode`.

- **Issue #204**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:514`

**Description**: `validateSettingKey` still uses `process.exit(1)` — inconsistent with the PR's move toward `process.exitCode`. Other error paths in this PR (e.g., `handleSubcommandResult`, `handleAskCommand`) use `process.exitCode = 1; return;` for graceful cleanup. This function, along with the similar call at line 640 and 683, terminates immediately. For synchronous handlers this is less risky, but it's a consistency gap.

### N68. Same concern in `getSettingByPath` — no `default` branch.

- **Issue #205**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: Same concern in `getSettingByPath` — no `default` branch. Same exhaustiveness issue as `setSettingByPath`. If `SettingPath` is extended, this switch would silently return `undefined`.

### N69. `setSettingByPath` switch has no `default` branch — adding a new `SettingPath` would silently return `undefined`.

- **Issue #206**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: `setSettingByPath` switch has no `default` branch — adding a new `SettingPath` would silently return `undefined`. If a new entry is added to the `SettingPath` union and `SETTING_PATHS` array but `setSettingByPath` isn't updated, the switch falls through without returning, yielding `undefined`. TypeScript's exhaustiveness checking would catch this at compile time if you add a `default: never` guard.

### N70. Import statement at the bottom of the file.

- **Issue #207**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/config.ts:N/A`

**Description**: Import statement at the bottom of the file. `import { Command } from 'commander'` is placed after all function definitions. While TypeScript hoists `import` statements, placing imports at the top of the file is the conventional layout and improves readability.

### N71. Confirmation flow for `crawl clear` is well-structured.

- **Issue #208**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/command.ts:453`

**Description**: Confirmation flow for `crawl clear` is well-structured. The flow correctly:

### N72. `getSettings()` called 3 times per `buildCrawlOptions` invocation — consider passing the settings object down.

- **Issue #209**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/commands/crawl/options.ts:55`

**Description**: `getSettings()` called 3 times per `buildCrawlOptions` invocation — consider passing the settings object down. `buildCrawlOptions` already calls `getSettings()` on line 54, but `mergeExcludeExtensions` (line 132) and `mergeExcludePaths` (line 175) each call it again independently. While the mtime-based cache makes this functionally correct, each call still performs `fs.existsSync` + `fs.statSync`. Accepting an optional settings parameter in the merge helpers would avoid redundant filesystem syscalls on hot paths.

### N73. 🏁 Script executed:

- **Issue #210**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/schemas/storage.ts:175`

**Description**: 🏁 Script executed: Repository: jmagar/firenotes

### N74. Shallow merge is only one level deep — document or guard against nested sub-objects.

- **Issue #213**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/default-settings.ts:124`

**Description**: Shallow merge is only one level deep — document or guard against nested sub-objects. The current merge strategy (`{ ...defaults.crawl, ...userSettings.crawl }`) works because every settings section is currently a flat key-value map. If any section ever gains a nested object (e.g., `crawl.retry: { attempts, delay }`), user overrides would replace the entire nested object rather than merging it. This is fine today but worth a brief inline comment to prevent future surprises.

### N75. Migration has per-file error handling but does not remove the legacy directory.

- **Issue #214**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/embed-queue.ts:108`

**Description**: Migration has per-file error handling but does not remove the legacy directory. The per-file `try/catch` (lines 81-92) correctly prevents a single copy failure from aborting the entire migration — this addresses the prior review. However, the legacy directory remains after migration, which was noted in a previous review as a potential source of confusion.

### N76. `getDefaultHttpOptions()` triggers filesystem stat on every call — acceptable for CLI, but worth noting.

- **Issue #216**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/http.ts:35`

**Description**: `getDefaultHttpOptions()` triggers filesystem stat on every call — acceptable for CLI, but worth noting. Since `getSettings()` performs `fs.existsSync` + `fs.statSync` for its mtime cache check, every invocation of `getDefaultHttpOptions()` incurs two synchronous syscalls. For a CLI tool this is fine, but if these utilities are ever used in a high-throughput context (e.g., batch embedding with many parallel fetches), consider caching the result for the process lifetime or the duration of a command.

### N77. TOCTOU races in `ensureSettingsFileMaterialized` are well-documented but `ensureConfigDir` could be tightened.

- **Issue #217**
- **Severity**: Nitpick
- **Author**: coderabbitai[bot]
- **File**: `src/utils/settings.ts:213`

**Description**: TOCTOU races in `ensureSettingsFileMaterialized` are well-documented but `ensureConfigDir` could be tightened. The detailed comments (lines 126-140) clearly document that TOCTOU is accepted for a single-user CLI. The actual risk is very low since all paths write valid data. The CodeQL findings here are expected given the pattern.

---

## File Index

Files sorted by number of issues (most issues first).

| File | Issues | Security | High | Minor | Nitpick |
|------|--------|----------|------|-------|---------|
| `src/commands/config.ts` | 22 | 8 | 4 | 2 | 8 |
| `src/commands/query.ts` | 16 | 1 | 8 | 4 | 3 |
| `src/utils/settings.ts` | 11 | 7 | 1 | 1 | 2 |
| `src/commands/doctor.ts` | 11 | 1 | 5 | 2 | 3 |
| `src/utils/credentials.ts` | 9 | 2 | 5 | 1 | 1 |
| `src/commands/ask.ts` | 9 | 0 | 6 | 1 | 2 |
| `scripts/check-qdrant-quality.ts` | 8 | 0 | 4 | 1 | 3 |
| `src/utils/job-history.ts` | 7 | 1 | 1 | 0 | 5 |
| `docs/storage-policy.md` | 6 | 0 | 3 | 3 | 0 |
| `src/utils/embed-queue.ts` | 6 | 0 | 3 | 0 | 3 |
| `docker-compose.tei.yaml` | 5 | 0 | 3 | 1 | 1 |
| `src/__tests__/commands/ask.test.ts` | 5 | 0 | 1 | 2 | 2 |
| `docker-compose.yaml` | 4 | 0 | 2 | 2 | 0 |
| `src/__tests__/helpers/lifecycle.ts` | 4 | 0 | 1 | 2 | 1 |
| `src/commands/crawl/status.ts` | 4 | 0 | 1 | 0 | 3 |
| `src/container/services/EmbedPipeline.ts` | 4 | 0 | 3 | 1 | 0 |
| `docker-compose.tei.mxbai.yaml` | 4 | 0 | 2 | 1 | 1 |
| `src/commands/doctor-debug.ts` | 4 | 0 | 2 | 2 | 0 |
| `src/commands/crawl/command.ts` | 4 | 0 | 2 | 1 | 1 |
| `.claude/skills/firecrawl/examples/ask-command-usage.md` | 4 | 0 | 1 | 1 | 2 |
| `src/__tests__/utils/job-history.test.ts` | 3 | 0 | 1 | 1 | 1 |
| `src/__tests__/commands/query.test.ts` | 3 | 2 | 1 | 0 | 0 |
| `src/commands/shared.ts` | 3 | 0 | 0 | 1 | 2 |
| `CLAUDE.md` | 3 | 0 | 3 | 0 | 0 |
| `src/__tests__/helpers/mock-setup.ts` | 3 | 0 | 1 | 0 | 2 |
| `src/commands/extract.ts` | 3 | 0 | 1 | 2 | 0 |
| `.env.tei.example` | 3 | 0 | 3 | 0 | 0 |
| `src/__tests__/helpers/process.ts` | 3 | 0 | 2 | 0 | 1 |
| `scripts/extract-base-urls.sh` | 3 | 0 | 1 | 0 | 2 |
| `.env.example` | 2 | 0 | 0 | 1 | 1 |
| `src/__tests__/utils/credentials.test.ts` | 2 | 0 | 1 | 1 | 0 |
| `src/__tests__/utils/storage-paths.test.ts` | 2 | 0 | 1 | 0 | 1 |
| `src/commands/info.ts` | 2 | 0 | 0 | 0 | 2 |
| `src/commands/search.ts` | 2 | 0 | 0 | 0 | 2 |
| `src/utils/network-error.ts` | 2 | 0 | 1 | 0 | 1 |
| `src/utils/storage-paths.ts` | 2 | 0 | 1 | 1 | 0 |
| `README.md` | 2 | 0 | 0 | 0 | 2 |
| `src/__tests__/commands/crawl/status.test.ts` | 2 | 0 | 0 | 1 | 1 |
| `src/__tests__/helpers/assertions.ts` | 2 | 0 | 0 | 0 | 2 |
| `src/utils/background-embedder.ts` | 2 | 0 | 0 | 0 | 2 |
| `.env.tei.mxbai.example` | 2 | 0 | 2 | 0 | 0 |
| `docs/testing-guide.md` | 2 | 0 | 1 | 0 | 1 |
| `src/__tests__/commands/info.test.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/container/services/HttpClient.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/__tests__/commands/config-view.test.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/__tests__/helpers/module-mocks.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/commands/batch.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/container/services/QdrantService.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/__tests__/helpers/fixtures.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/__tests__/commands/doctor-debug.test.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/__tests__/commands/scrape.test.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/commands/completion.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/utils/command.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/utils/defaults.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/utils/prompts.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/commands/map.ts` | 1 | 0 | 0 | 1 | 0 |
| `indexme.md` | 1 | 0 | 1 | 0 | 0 |
| `scripts/README.md` | 1 | 0 | 1 | 0 | 0 |
| `src/__tests__/commands/crawl.test.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/__tests__/utils/api-key-scrubber.test.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/commands/crawl/options.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/schemas/storage.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/utils/default-settings.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/utils/http.ts` | 1 | 0 | 0 | 0 | 1 |
| `src/utils/theme.ts` | 1 | 0 | 1 | 0 | 0 |
| `src/__tests__/utils/deduplication.test.ts` | 1 | 1 | 0 | 0 | 0 |
| `src/commands/status.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/__tests__/commands/completion.test.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/commands/domains.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/commands/embed.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/commands/stats.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/utils/display.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/__tests__/commands/version.test.ts` | 1 | 0 | 0 | 1 | 0 |
| `src/__tests__/commands/stats.test.ts` | 1 | 0 | 0 | 1 | 0 |
