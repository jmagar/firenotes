# Session Documentation - cli-firecrawl

Generated: 17:26:49 | 02/08/2026 EST
Session: session-2026-02-08-17-26

## 1) Session Overview
This session focused on legacy-code removal and regression cleanup while iterating on map/crawl behavior for ReadTheDocs domains. Work included:
- Removing legacy wiring and deprecated code paths.
- Fixing two reviewed regressions: crawl embed job-id normalization and status auth-source misreporting.
- Fixing map `--sitemap skip` request compatibility with API v2.
- Implementing ReadTheDocs-specific map fallback behavior so map still returns URL lists.
- Fixing two further reviewed regressions: runtime auth context propagation after interactive login and glob pattern handling in URL filtering.

## 2) Timeline
1. Legacy cleanup and dedupe continuation.
2. Addressed review issues:
   - Preserved raw crawl job IDs for `--embed` flow.
   - Corrected status auth source detection.
3. Investigated ReadTheDocs mapping under `map` and `crawl`.
4. Fixed map UA HTTP path from v1 to v2 endpoint.
5. Added map fallback to crawl discovery for RTD-like hosts.
6. Refined RTD root handling to use `/en/latest/` and return usable URL lists.
7. Addressed latest review issues:
   - Rebound container auth context after interactive login.
   - Added glob-first matching in URL filtering and tests.

## 3) Key Findings
- Manual crawl embedding by job ID broke because `normalizeUrl` rewrote job IDs to pseudo-URLs. Fixed in `src/commands/crawl/command.ts:395`.
- `status` auth source was misclassified as explicit because resolved config key was passed into source detection. Fixed in `src/commands/status.ts:72`.
- `map --sitemap skip` failed on UA code path because request was sent to v1 endpoint. Fixed to v2 in `src/commands/map.ts` (HTTP map request path).
- ReadTheDocs often returned sparse/empty map results while crawl discovery yielded expected doc coverage; map fallback was required.
- Interactive login saved credentials but didn’t update active command container; immediate command could still fail until next invocation. Fixed in:
  - `src/index.ts:324-345`
  - `src/commands/embed.ts:252-269`
- Glob excludes like `**/*.pdf` were previously treated as raw regex and could be invalid. Fixed in `src/utils/url-filter.ts:32-104` with glob conversion and tests.

## 4) Technical Decisions
- Keep global sitemap behavior (`include`) intact; do not globally force `skip`.
- Add domain-pattern fallback only where map reliability is known poor (ReadTheDocs pattern), preserving default behavior elsewhere.
- For auth, preserve immutable container design and re-create command-scoped containers when newly authenticated keys are obtained.
- For filtering, prioritize glob detection before regex classification to avoid misinterpreting user glob patterns.

## 5) Files Modified
- `src/commands/crawl/command.ts`
  - Preserve raw job IDs when `--embed` is used.
- `src/commands/status.ts`
  - Correct auth source reporting.
- `src/commands/map.ts`
  - Switch UA map HTTP path to v2; add ReadTheDocs map fallback via crawl discovery and root handling.
- `src/index.ts`
  - Rebind per-command container after interactive auth acquires new key.
- `src/commands/embed.ts`
  - Rebind local container after interactive auth in embed URL mode.
- `src/utils/url-filter.ts`
  - Add glob-aware matching logic before regex fallback.
- `src/__tests__/commands/crawl.test.ts`
  - Regression test for embed job-id path.
- `src/__tests__/commands/status-auth-source.test.ts`
  - Regression test for auth source classification.
- `src/__tests__/commands/map.test.ts`
  - Coverage for map endpoint behavior and RTD fallback behavior.
- `src/__tests__/utils/url-filter.test.ts`
  - Coverage for glob matching and filtering behavior.

## 6) Commands Executed
- Discovery and diagnostics:
  - `rg -n "sitemap|map\(" ...`
  - `sed -n ... src/commands/map.ts`
  - `node dist/index.js map ... --sitemap skip --json`
- Build and validation:
  - `pnpm build` -> success
  - `pnpm -s type-check` -> success
  - `pnpm -s vitest run src/__tests__/commands/map.test.ts` -> passing
  - `pnpm -s vitest run src/__tests__/utils/url-filter.test.ts` -> passing
  - `pnpm -s vitest run src/__tests__/commands/embed.test.ts` -> passing
  - `pnpm -s vitest run src/__tests__/utils/auth.test.ts` -> passing

## 7) Next Steps
1. Add optional heuristic/flag to disable RTD fallback where users want strict API-map-only behavior.
2. Add integration/e2e coverage for first-run interactive auth + immediate command execution.
3. Consider expanding docs-host profiles beyond ReadTheDocs (similar doc-hosting patterns).
4. Add concise CLI note/help text explaining when map fallback was used.
