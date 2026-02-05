# Crawl Status Connection Issue Debugging

**Date:** 2026-02-05 12:40 UTC
**Issue:** `firecrawl status` command showing 9 "Job not found" errors
**Status:** ✅ RESOLVED

## Problem Summary

The status command was displaying errors for crawl jobs that no longer exist in the Firecrawl API:

```
Failed crawls:
  ✗ 019c2d81-a329-7113-a255-426d5eeda1b0 error (Job not found)
  ✗ 019c2d80-884d-720b-a20d-998a0b8248b9 error (Job not found)
  ... (9 total errors)
```

## Root Cause Analysis

### Source of Job IDs

The status command (src/commands/status.ts:193-202) pulls crawl IDs from multiple sources:
- Job history cache (`.cache/job-history.json`)
- **Embed queue** (`/home/jmagar/appdata/cli-firecrawl/embed-queue/`)

```typescript
const resolvedCrawlIds = filterValidJobIds(
  crawlIds.length > 0
    ? crawlIds
    : Array.from(
        new Set([...getRecentJobIds('crawl', 10), ...embedJobIds])  // ⚠️ ISSUE
      ).slice(0, 10)
);
```

### The Disconnect

1. **Embed queue**: Retained 14 completed embedding jobs
2. **Job timestamps**: All from Feb 5, 2026 (oldest: 01:03 UTC, newest: 12:11 UTC)
3. **Problem**: Status command extracted job IDs from **completed** embed jobs and tried to query crawl status from Firecrawl API
4. **Result**: API returned "Job not found" because crawls had already completed and been garbage collected

### Design Assumption

The code assumed:
- If an embed job exists, its corresponding crawl should still be queryable
- **Reality**: Completed crawls are removed from the Firecrawl API after completion
- **Gap**: Embed queue retained completed jobs indefinitely (no automatic cleanup)

## Solution

### Fix 1: Auto-cleanup of Old Embed Jobs

Added automatic cleanup in the status command (src/commands/status.ts:182-184):

```typescript
// Clean up old completed/failed embed jobs (older than 1 hour)
// This prevents "Job not found" errors from completed crawls that no longer exist in the API
cleanupOldJobs(1); // 1 hour retention
```

This leverages the existing `cleanupOldJobs()` function (src/utils/embed-queue.ts:345-363) which was never called automatically.

### Fix 2: Filter Out Completed Embeds

Modified crawl ID resolution to only include **active** embed jobs (src/commands/status.ts:191-202):

```typescript
// Only include pending/processing embed jobs in crawl status checks
// Completed/failed embeds indicate the crawl is done, so no need to query API
const activeEmbedJobIds = embedQueue.jobs
  .filter((job) => job.status === 'pending' || job.status === 'processing')
  .map((job) => job.jobId);

const resolvedCrawlIds = filterValidJobIds(
  crawlIds.length > 0
    ? crawlIds
    : Array.from(
        new Set([...getRecentJobIds('crawl', 10), ...activeEmbedJobIds])
      ).slice(0, 10)
);
```

## Test Coverage

Added test case to verify the fix (src/__tests__/commands/status-command.test.ts:170-244):

```typescript
it('should not query crawl status for completed embed jobs', async () => {
  // Setup completed, pending, processing, and failed embed jobs
  // Verify only pending/processing jobs are queried
  // Verify completed/failed jobs are NOT queried
});
```

All 21 tests pass ✅

## Results

### Before
- 9 "Job not found" errors
- Confusing status display mixing failed crawls with completed embeds

### After
- ✅ Zero "Job not found" errors
- ✅ Clear separation: only active crawls are queried
- ✅ Completed embeds displayed correctly in embeddings section
- ✅ Auto-cleanup of old embed jobs (>1 hour)

## Technical Details

- **Embed queue location**: `/home/jmagar/appdata/cli-firecrawl/embed-queue/` (configured via FIRECRAWL_EMBEDDER_QUEUE_DIR)
- **Retention policy**: 1 hour for completed/failed jobs
- **Status logic**: Only pending/processing embeds trigger crawl status queries

## Related Files

- src/commands/status.ts (main fix)
- src/utils/embed-queue.ts (cleanup function)
- src/__tests__/commands/status-command.test.ts (test coverage)

## Verification

```bash
$ node dist/index.js status

Crawls
  No active crawls.

Crawl Status
  No recent crawl job IDs found.

Embeddings
  ◉ pending 0 | ◉ processing 0 | ✓ completed 3 | ✗ failed 0
  Completed embeds:
    ✓ 019c2d95-e2c6-7158-9987-ec571c694928 https://www.python.org/doc/
    ✓ 019c2d96-e415-70c9-a326-58e4b113acb4 https://zod.dev/
    ✓ 019c2d95-45e0-76cb-b745-8895aeb3862b https://code.visualstudio.com/docs
```

No errors! ✨
