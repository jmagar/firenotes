# Session: Extract Bug Investigation & Dependency Updates

**Date:** 2026-02-03
**Duration:** ~1 hour
**Branch:** `feat/phase-3-legacy-cleanup`

---

## Session Overview

Investigated CLI support for `summary` and `changeTracking` output formats, discovered and documented a critical bug in Firecrawl's self-hosted extract endpoint, and updated all dependencies from Dependabot PRs.

---

## Timeline

### 1. Format Support Investigation
- **Question:** Does CLI support `summary` and `changeTracking` as output formats?
- **Finding:** `summary` is fully implemented, `changeTracking` is partially implemented

### 2. Format Implementation Analysis
- Reviewed `src/utils/output.ts:88-95` - Found `RAW_TEXT_FORMATS` array
- `summary` included in raw text formats (line 94)
- `changeTracking` defined in types but NOT in `RAW_TEXT_FORMATS`
- `extractContent()` at `output.ts:158-161` explicitly handles `summary`

### 3. Live Testing
- Tested `scrape --format summary` on multiple sites:
  - `example.com` - Working
  - `en.wikipedia.org/wiki/Web_scraping` - Working
  - `modelcontextprotocol.io` - Working
  - `docs.firecrawl.dev/sdks/cli` - Working

### 4. Multi-Format Testing
- Tested combined formats: `--format markdown,summary,links`
- JSON output structure verified with `--json --pretty`
- `changeTracking` requires Supabase database (not available in self-hosted)

### 5. Extract Command Investigation
- Attempted `extract --prompt` and `extract --schema`
- Both return empty `data: {}` despite successful LLM extraction
- Logs show LLM correctly extracts requested data

### 6. Bug Root Cause Analysis
- Error in `analyzeSchemaAndPrompt_F0` validation layer
- Expects internal fields: `isMultiEntity`, `reasoning`, `keyIndicators`
- LLM output doesn't include these fields, causing validation failure
- Data is discarded before reaching CLI

### 7. GitHub Issue Research
- Found Issue #1294: Same error, closed as "weak LLM" problem
- Our case: Strong LLM (Gemini 3 Flash), validation schema mismatch
- Comment from `mogery`: "llama3.2:1b is not good enough"
- Our situation is different - validation bug, not LLM capability

### 8. Dependency Updates
- Updated all Dependabot PRs (8 total)
- Updated GitHub Actions (3 workflows)
- Created comprehensive bug report document

---

## Key Findings

### Format Support Status
| Format | Type | Status | Location |
|--------|------|--------|----------|
| `summary` | ScrapeFormat | Fully Working | `output.ts:94`, `output.ts:158-161` |
| `changeTracking` | ScrapeFormat | Requires Supabase | `types/scrape.ts:15` |

### Extract Bug Details
- **Location:** `analyzeSchemaAndPrompt_F0` in Firecrawl backend
- **Cause:** Validation expects internal metadata fields not in user schemas
- **Evidence:** Logs show correct LLM extraction, empty API response
- **Workaround:** Use `scrape --format summary` instead

### LLM Extraction (from logs)
```json
{
  "title": "Model Context Protocol (MCP)",
  "mainPurpose": "An open standard that enables developers...",
  "keyFeatures": ["Standardized architecture...", "Pre-built connectors..."]
}
```

---

## Technical Decisions

1. **Format Handling:** `summary` treated as raw text format (curl-like output when used alone)
2. **changeTracking:** Requires database for diff tracking - documented as unavailable in self-hosted
3. **Extract Workaround:** Recommend `scrape --format summary` for AI-generated summaries
4. **PR #2 (biome update):** Skipped - larger refactoring PR that touches source code, not simple dep bump

---

## Files Modified

### Created
| File | Purpose |
|------|---------|
| `.docs/firecrawl-extract-validation-bug.md` | Comprehensive bug report for Firecrawl team |

### Updated
| File | Changes |
|------|---------|
| `package.json` | Updated 5 dependencies |
| `pnpm-lock.yaml` | Lockfile regenerated |
| `.github/workflows/ci.yml` | actions/checkout v6, actions/setup-node v6, codecov v5 |
| `.github/workflows/security.yml` | actions/checkout v6, actions/setup-node v6 |
| `.github/workflows/release.yml` | actions/checkout v6, actions/setup-node v6 |

---

## Commands Executed

### Format Testing
```bash
# Summary format tests
node dist/index.js scrape https://example.com --format summary --no-embed
node dist/index.js scrape https://modelcontextprotocol.io --format summary --no-embed

# Multi-format test
node dist/index.js scrape https://modelcontextprotocol.io \
  --only-main-content --format markdown,summary,links \
  --exclude-tags nav,footer --json --pretty --no-embed
```

### Extract Testing
```bash
# Both return empty data
node dist/index.js extract https://modelcontextprotocol.io \
  --prompt "What is MCP and what are its key features?" --pretty --no-embed

node dist/index.js extract https://example.com \
  --schema '{"type":"object","properties":{"title":{"type":"string"}}}' --pretty --no-embed
```

### GitHub Research
```bash
gh issue list --repo firecrawl/firecrawl --search "isMultiEntity" --state all
gh issue view 1294 --repo firecrawl/firecrawl
gh api repos/firecrawl/firecrawl/issues/1294/comments
```

### Dependency Updates
```bash
pnpm install  # Updated 5 packages
pnpm build    # Verified build success
pnpm test     # 610 tests passed
```

---

## Dependency Updates Summary

### NPM Packages
| Package | From | To |
|---------|------|-----|
| @mendable/firecrawl-js | 4.10.0 | 4.12.0 |
| commander | 14.0.2 | 14.0.3 |
| @types/node | 20.19.27 | 25.2.0 |
| lint-staged | 15.5.2 | 16.2.7 |
| vitest | 4.0.16 | 4.0.18 |

### GitHub Actions
| Action | From | To |
|--------|------|-----|
| actions/checkout | v4 | v6 |
| actions/setup-node | v4 | v6 |
| codecov/codecov-action | v4 | v5 |

---

## Next Steps

1. **File New Issue:** Report extract validation bug to Firecrawl (different from #1294)
2. **Merge PR #11:** Phase 3 legacy cleanup branch ready for review
3. **Close Dependabot PRs:** PRs 3-9, 12 superseded by this commit
4. **Review PR #2:** Biome update needs separate review (touches source code)
5. **Document Workaround:** Update CLI docs to recommend `scrape --format summary`

---

## Commit Created

```
61dbbbd chore(deps): update dependencies and document extract validation bug
```

Changes:
- 6 files changed, +413 insertions, -291 deletions
- All 610 tests passing
