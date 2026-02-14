# Session Log: PR #13 Remaining Issues Closure

## Session Overview
Completed a full closure pass for `docs/pr-13-remaining-issues.md`, covering critical/high/medium issues plus selected low-priority cleanup items. Implemented code fixes, updated/added regression tests, passed full test suite, and created commit `6264d6b` on branch `fix/query-deduplication-and-parseInt`.

## Timeline
1. Loaded and analyzed `docs/pr-13-remaining-issues.md` to enumerate unresolved items.
2. Verified each listed issue against current source via targeted `rg`/`sed` inspection.
3. Implemented fixes in core command/service paths (embed pipeline, status, map, extract, query, crawl cleanup, doctor, doctor-debug, stats, settings, display).
4. Updated tests for changed behavior and added missing regression coverage.
5. Ran focused Vitest batches for touched areas.
6. Ran full test suite and validated all tests green.
7. Applied additional low-priority cleanup items from the same tracking doc.
8. Fixed one TypeScript narrowing issue caught by pre-commit.
9. Re-ran hooks and unit tests; committed all tracked fixes as `6264d6b`.

## Key Findings
- Promise cache bug in embed collection initialization caused sticky failures after transient TEI/Qdrant errors; fixed by clearing failed cache (`src/container/services/EmbedPipeline.ts:56`).
- `status --watch --interval` accepted NaN and could spin tightly; fixed numeric guard and 1000ms floor (`src/commands/status.ts:1563`).
- Map settings-sourced `ignoreQueryParameters` was dropped due to option-source logic; fixed by passing explicit option value (`src/commands/map.ts:616`).
- Extract output wrongly forced JSON when `--output` existed; fixed to rely only on JSON intent (`src/commands/extract.ts:242`).
- Query limit validation failed for NaN; fixed finite-number validation (`src/commands/query.ts:69`).
- Crawl cleanup silently swallowed non-not-found failures; added skipped tracking and warning output (`src/commands/crawl/status.ts:214`, `src/types/crawl.ts:141`).
- Doctor-debug streamed OpenAI fallback could double-request when provider returned non-SSE JSON; fixed by consuming JSON before retry (`src/commands/doctor-debug.ts:306`).
- Doctor-debug incorrectly passed `-p` to Gemini CLI; fixed CLI-specific arg handling (`src/commands/doctor-debug.ts:161`).
- Doctor compose parser assumed NDJSON only; now supports array JSON + NDJSON (`src/commands/doctor.ts:101`).
- Table empty-state duplication in stats/domains outputs removed by disabling dash placeholder rows where explicit empty state exists (`src/commands/stats.ts:134`, `src/commands/domains.ts:91`).
- Freshness label standardized to ET for DST correctness (`src/utils/display.ts:86`).
- Config dir creation simplified by removing redundant `existsSync` pre-check (`src/utils/settings.ts:54`).
- Shell trap quoting fixed and script hardened for non-TTY output + divide-by-zero avg case (`scripts/extract-base-urls.sh:142`).

## Technical Decisions
- Retained existing config command `process.exit(1)` behavior to preserve command-contract expectations while still cleaning import placement and sync/async consistency (`src/commands/config.ts`).
- Added targeted regression tests immediately adjacent to each behavioral fix to prevent relapses.
- Kept warning-level logging for skipped crawl cleanup entries to improve operator visibility without failing cleanup operation.
- Accepted pre-commit pipeline as source of truth; corrected TypeScript narrowing issue rather than suppressing it.

## Files Modified
- `.claude/skills/firecrawl/examples/ask-command-usage.md`: corrected Claude CLI package name.
- `docker-compose.tei.yaml`: removed external hardcoded network dependency.
- `docker-compose.tei.mxbai.yaml`: removed external hardcoded network dependency.
- `scripts/extract-base-urls.sh`: trap quoting, TTY color guard, divide-by-zero guard.
- `src/container/services/EmbedPipeline.ts`: clear failed collection promise cache.
- `src/commands/status.ts`: safe watch interval handling.
- `src/commands/map.ts`: preserve ignoreQueryParameters from settings/defaults.
- `src/commands/extract.ts`: output mode fix.
- `src/commands/query.ts`: robust limit validation.
- `src/commands/crawl/status.ts`: skipped cleanup accounting + warnings.
- `src/commands/crawl/command.ts`: include skipped cleanup stat in output.
- `src/types/crawl.ts`: added `skipped` field.
- `src/commands/doctor-debug.ts`: Gemini CLI arg fix + non-SSE JSON handling.
- `src/commands/doctor.ts`: compose JSON parser fallback + write probe hardening + W_OK check.
- `src/commands/stats.ts`: remove duplicate empty-state dash row.
- `src/commands/domains.ts`: remove duplicate empty-state dash row.
- `src/utils/display.ts`: ET label fix.
- `src/utils/settings.ts`: remove redundant exists check before mkdir.
- `src/commands/crawl/options.ts`: avoid repeated settings reads.
- `src/commands/config.ts`: import placement, sync view function cleanup, behavior-preserving consistency updates.
- Test files updated for all above behavior changes.

## Commands Executed
- `sed -n '1,260p' docs/pr-13-remaining-issues.md` → extracted authoritative issue list.
- `rg -n "..." src scripts` (multiple) → confirmed unresolved paths and line-level evidence.
- `pnpm vitest run <targeted-files>` (multiple) → validated iterative fixes.
- `pnpm vitest run` → full suite pass (`71 test files`, `1120 tests`, `0 failed`).
- `git commit ...` (with hooks) → initial attempt blocked by TS error; fixed and re-committed.
- Final commit: `6264d6b` with all tracked fixes.

## Next Steps
1. Push branch `fix/query-deduplication-and-parseInt` and open/update PR #13 with commit `6264d6b`.
2. Decide whether to include `docs/pr-13-remaining-issues.md` in repo history or keep it local tracking only.
3. Optional: run lint/type/test in CI-equivalent container image for parity before merge.
