# Session: Add --clear Flag to Status Command

**Date**: 2026-02-05
**Duration**: ~15 minutes
**Branch**: feat/phase-3-legacy-cleanup

## Session Overview

Added a `--clear` flag to the `firecrawl status` command to allow users to manually clear the job history cache. This addresses the issue of stale job IDs persisting in status output, particularly "Job not found" errors that clutter the display.

## Timeline

### 1. Initial Request (00:00)
- User requested help clearing stale job history from `firecrawl status` output
- Showed failed crawl with "Job not found" error: `550e8400-e29b-41d4-a716-446655440000`

### 2. Investigation (00:02)
- Activated `cli-firecrawl` project in Serena
- Read `src/commands/status.ts` to understand current cleanup logic
- Found existing auto-cleanup for "Job not found" errors via `removeJobIds()`
- Discovered `clearJobHistory()` function in `src/utils/job-history.ts`

### 3. Implementation (00:05)
- Added `--clear` option to `createStatusCommand()` in `src/commands/status.ts:697`
- Imported `clearJobHistory` function from job-history module
- Implemented early return when `--clear` flag is set, displaying success message

### 4. Testing (00:10)
- Built TypeScript: `pnpm build` (successful)
- Tested clear functionality: `node dist/index.js status --clear`
- Verified clean state: `node dist/index.js status` showed no job history

## Key Findings

### Job History Storage
- **Location**: `.cache/job-history.json`
- **Structure**: Separate arrays for `crawl`, `batch`, `extract` job types
- **Max Entries**: 20 per type (defined in `src/utils/job-history.ts:16`)

### Existing Auto-Cleanup
The status command already includes auto-cleanup logic:
- File: `src/commands/status.ts:204-218`
- Function: `cleanupOldJobs(1)` - removes embed jobs older than 1 hour
- Purpose: Prevents "Job not found" errors from completed crawls
- Issue: Only cleans embed jobs, not crawl/batch/extract history

### Manual Cleanup Options
Two approaches identified:
1. **Direct file deletion**: `rm .cache/job-history.json`
2. **New CLI flag**: `firecrawl status --clear` (implemented)

## Technical Decisions

### Why Add a Flag Instead of Auto-Cleanup?
- **User Control**: Manual clear allows users to preserve history when desired
- **Predictability**: Auto-cleanup could surprise users by losing job tracking
- **Simplicity**: Single flag is easier than complex auto-prune heuristics
- **Existing Pattern**: `clearJobHistory()` already existed, just needed exposure

### Implementation Approach
- **Early Return**: Clear operation exits before expensive API calls
- **Consistent UX**: Uses same theme utilities (`fmt.success()`, `icons.success`) as other commands
- **No Breaking Changes**: Optional flag preserves existing behavior

## Files Modified

### src/commands/status.ts
**Lines Changed**: 20, 697, 704-709

**Changes**:
1. Added `clearJobHistory` import (line 20)
2. Added `--clear` option to command definition (line 697)
3. Added clear handler with early return (lines 704-709)

**Purpose**: Expose job history clearing to users via CLI flag

## Commands Executed

```bash
# Build TypeScript
pnpm build

# Test clear functionality
node dist/index.js status --clear
# Output: ✓ Job history cleared

# Verify clean state
node dist/index.js status
# Output: No recent crawl/batch/extract job IDs found
```

## Feature Details

### New Command Usage

```bash
# Clear all job history
firecrawl status --clear

# View current status (after clear)
firecrawl status
```

### When to Use
- Persistent "Job not found" errors in status output
- Cleanup after mass crawl operations
- Fresh start for job tracking
- CI/CD environments between test runs

### What Gets Cleared
- All crawl job IDs (up to 20 most recent)
- All batch job IDs (up to 20 most recent)
- All extract job IDs (up to 20 most recent)
- Does NOT clear embed job queue (managed separately)

## Next Steps

### Potential Improvements
1. **Add confirmation prompt**: Ask "Are you sure?" before clearing
2. **Selective clearing**: Allow `--clear crawl`, `--clear batch`, etc.
3. **Better auto-cleanup**: Improve existing logic to catch more stale IDs
4. **Unify cleanup**: Merge job-history and embed-queue cleanup logic

### Documentation Updates
- [ ] Update README.md with `--clear` flag usage
- [ ] Add to command help text examples
- [ ] Document in troubleshooting section

### Testing Needs
- [ ] Unit test for `--clear` flag behavior
- [ ] Integration test verifying history persistence
- [ ] Edge case: clearing empty history

## Notes

- The auto-cleanup at line 204 (`cleanupOldJobs(1)`) only affects embed jobs, not the main job history
- The `shouldPruneError()` function catches "Job not found" and "Invalid job id" errors
- Job history is sorted by ULID (lexicographically sortable timestamps)
- TEI embedding is NOT available on this system (always use `--no-embed` flag)
