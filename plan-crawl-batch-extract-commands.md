# Crawl/Batch/Extract Management Commands Implementation Plan

> **📁 Organization Note:** This plan was intentionally created in the repo root per user request. When this plan is fully implemented and verified, move this file to `docs/plans/complete/` to keep the plans folder organized.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CLI support for crawl cancel/active/errors, batch scrape (start/status/cancel/errors), and extract status endpoints with full unit test coverage using strict TDD.

**Architecture:** Extend the existing Commander-based CLI. Reuse the Firecrawl JS SDK via `getClient()` for all new endpoints. Add a new `batch` command and add new “mode” flags to the existing `crawl` and `extract` commands. Output JSON for management endpoints using shared `utils/command` helpers, and keep crawl’s existing human-readable status output behavior. Ensure job-id operations do not pass through URL normalization and allow job-id-only commands without URL arguments.

**Tech Stack:** TypeScript, Commander, Vitest, Firecrawl JS SDK, existing CLI utilities (`utils/command`, `utils/output`, `utils/options`, `utils/job`).

---

### Task 1: Crawl cancel command (TDD)

**Files:**
- Modify: `src/types/crawl.ts`
- Modify: `src/commands/crawl.ts`
- Modify: `src/__tests__/commands/crawl.test.ts`
- Modify: `src/__tests__/utils/mock-client.ts`

**Step 1: Write the failing test**

Add a new describe block in `src/__tests__/commands/crawl.test.ts`:

```ts
import { writeOutput } from '../../utils/output';

// ...existing mocks...

describe('executeCrawlCancel', () => {
  type CrawlCancelMock = MockFirecrawlClient &
    Required<Pick<MockFirecrawlClient, 'cancelCrawl'>>;

  let mockClient: CrawlCancelMock;

  beforeEach(() => {
    setupTest();
    initializeConfig({ apiKey: 'test-api-key', apiUrl: 'https://api.firecrawl.dev' });

    mockClient = { cancelCrawl: vi.fn() };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should cancel crawl and return status', async () => {
    mockClient.cancelCrawl.mockResolvedValue(true);

    const result = await executeCrawlCancel('job-123');

    expect(mockClient.cancelCrawl).toHaveBeenCalledWith('job-123');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'cancelled' });
  });

  it('should return error when cancel fails', async () => {
    mockClient.cancelCrawl.mockRejectedValue(new Error('Cancel failed'));

    const result = await executeCrawlCancel('job-123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cancel failed');
  });
});

describe('handleCrawlCommand cancel mode', () => {
  it('should write cancel output and exit without crawling', async () => {
    const mockClient = { cancelCrawl: vi.fn().mockResolvedValue(true) };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );

    await handleCrawlCommand({ urlOrJobId: 'job-123', cancel: true });

    expect(mockClient.cancelCrawl).toHaveBeenCalledWith('job-123');
    expect(writeOutput).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlCancel"
```
Expected: FAIL with “executeCrawlCancel is not defined” or missing method errors.

**Step 3: Write minimal implementation**

Update `src/types/crawl.ts`:

```ts
export interface CrawlOptions {
  // ...existing fields...
  cancel?: boolean;
}

export interface CrawlCancelData {
  status: 'cancelled';
}

export interface CrawlCancelResult {
  success: boolean;
  data?: CrawlCancelData;
  error?: string;
}
```

Update `src/__tests__/utils/mock-client.ts` to include the new method:

```ts
export interface MockFirecrawlClient {
  // ...existing methods...
  cancelCrawl?: Mock;
}
```

Update `src/commands/crawl.ts`:

```ts
import type { CrawlCancelResult } from '../types/crawl';
import { formatJson } from '../utils/command';

export async function executeCrawlCancel(jobId: string): Promise<CrawlCancelResult> {
  try {
    const app = getClient();
    const ok = await app.cancelCrawl(jobId);

    if (!ok) {
      return { success: false, error: 'Cancel failed' };
    }

    return { success: true, data: { status: 'cancelled' } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
```

Wire into `handleCrawlCommand` before the existing status logic:

```ts
if (options.cancel) {
  const result = await executeCrawlCancel(options.urlOrJobId);
  if (!result.success) {
    console.error('Error:', result.error || 'Unknown error occurred');
    process.exit(1);
  }
  const output = formatJson({ success: true, data: result.data }, options.pretty);
  writeOutput(output, options.output, !!options.output);
  return;
}
```

Update `createCrawlCommand()` to add the flag:

```ts
.option('--cancel', 'Cancel an existing crawl job', false)
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlCancel"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/crawl.ts src/commands/crawl.ts src/__tests__/commands/crawl.test.ts src/__tests__/utils/mock-client.ts
git commit -m "feat: add crawl cancel command"
```

---

### Task 2: Crawl errors command (TDD)

**Files:**
- Modify: `src/types/crawl.ts`
- Modify: `src/commands/crawl.ts`
- Modify: `src/__tests__/commands/crawl.test.ts`
- Modify: `src/__tests__/utils/mock-client.ts`

**Step 1: Write the failing test**

Add to `src/__tests__/commands/crawl.test.ts`:

```ts
describe('executeCrawlErrors', () => {
  type CrawlErrorsMock = MockFirecrawlClient &
    Required<Pick<MockFirecrawlClient, 'getCrawlErrors'>>;

  let mockClient: CrawlErrorsMock;

  beforeEach(() => {
    setupTest();
    initializeConfig({ apiKey: 'test-api-key', apiUrl: 'https://api.firecrawl.dev' });

    mockClient = { getCrawlErrors: vi.fn() };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should return crawl errors and robotsBlocked', async () => {
    mockClient.getCrawlErrors.mockResolvedValue({
      errors: [
        { id: 'err-1', url: 'https://a.com', error: 'timeout', timestamp: '2024-01-01', code: 'TIMEOUT' },
      ],
      robotsBlocked: ['https://b.com/robots'],
    });

    const result = await executeCrawlErrors('job-123');

    expect(mockClient.getCrawlErrors).toHaveBeenCalledWith('job-123');
    expect(result.success).toBe(true);
    expect(result.data?.errors.length).toBe(1);
    expect(result.data?.robotsBlocked.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlErrors"
```
Expected: FAIL with “executeCrawlErrors is not defined”.

**Step 3: Write minimal implementation**

Update `src/types/crawl.ts`:

```ts
export interface CrawlErrorItem {
  id: string;
  url: string;
  error: string;
  timestamp?: string;
  code?: string;
}

export interface CrawlErrorsData {
  errors: CrawlErrorItem[];
  robotsBlocked: string[];
}

export interface CrawlErrorsResult {
  success: boolean;
  data?: CrawlErrorsData;
  error?: string;
}

export interface CrawlOptions {
  // ...existing...
  errors?: boolean;
}
```

Update `src/__tests__/utils/mock-client.ts`:

```ts
export interface MockFirecrawlClient {
  // ...existing...
  getCrawlErrors?: Mock;
}
```

Update `src/commands/crawl.ts`:

```ts
import type { CrawlErrorsResult } from '../types/crawl';

export async function executeCrawlErrors(jobId: string): Promise<CrawlErrorsResult> {
  try {
    const app = getClient();
    const errors = await app.getCrawlErrors(jobId);
    return { success: true, data: errors };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
```

Wire into `handleCrawlCommand` before status logic:

```ts
if (options.errors) {
  const result = await executeCrawlErrors(options.urlOrJobId);
  if (!result.success) {
    console.error('Error:', result.error || 'Unknown error occurred');
    process.exit(1);
  }
  const output = formatJson({ success: true, data: result.data }, options.pretty);
  writeOutput(output, options.output, !!options.output);
  return;
}
```

Add CLI flag in `createCrawlCommand()`:

```ts
.option('--errors', 'Fetch crawl errors for a job ID', false)
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlErrors"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/crawl.ts src/commands/crawl.ts src/__tests__/commands/crawl.test.ts src/__tests__/utils/mock-client.ts
git commit -m "feat: add crawl errors command"
```

---

### Task 3: Crawl active command (TDD)

**Files:**
- Modify: `src/types/crawl.ts`
- Modify: `src/commands/crawl.ts`
- Modify: `src/__tests__/commands/crawl.test.ts`
- Modify: `src/__tests__/utils/mock-client.ts`

**Step 1: Write the failing test**

Add to `src/__tests__/commands/crawl.test.ts`:

```ts
describe('executeCrawlActive', () => {
  type CrawlActiveMock = MockFirecrawlClient &
    Required<Pick<MockFirecrawlClient, 'getActiveCrawls'>>;

  let mockClient: CrawlActiveMock;

  beforeEach(() => {
    setupTest();
    initializeConfig({ apiKey: 'test-api-key', apiUrl: 'https://api.firecrawl.dev' });

    mockClient = { getActiveCrawls: vi.fn() };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should return active crawls list (SDK shape)', async () => {
    mockClient.getActiveCrawls.mockResolvedValue({
      success: true,
      crawls: [{ id: 'job-1', teamId: 'team-1', url: 'https://a.com', options: null }],
    });

    const result = await executeCrawlActive();

    expect(mockClient.getActiveCrawls).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.data?.crawls.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlActive"
```
Expected: FAIL with “executeCrawlActive is not defined”.

**Step 3: Write minimal implementation**

Update `src/types/crawl.ts`:

```ts
export interface ActiveCrawlItem {
  id: string;
  teamId: string;
  url: string;
  options?: Record<string, unknown> | null;
}

export interface ActiveCrawlsData {
  success: boolean;
  crawls: ActiveCrawlItem[];
}

export interface CrawlActiveResult {
  success: boolean;
  data?: ActiveCrawlsData;
  error?: string;
}

export interface CrawlOptions {
  // ...existing...
  active?: boolean;
}
```

Update `src/__tests__/utils/mock-client.ts`:

```ts
export interface MockFirecrawlClient {
  // ...existing...
  getActiveCrawls?: Mock;
}
```

Update `src/commands/crawl.ts`:

```ts
import type { CrawlActiveResult } from '../types/crawl';

export async function executeCrawlActive(): Promise<CrawlActiveResult> {
  try {
    const app = getClient();
    const active = await app.getActiveCrawls();
    return { success: true, data: active };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
```

Wire into `handleCrawlCommand` before cancel/errors/status:

```ts
if (options.active) {
  const result = await executeCrawlActive();
  if (!result.success) {
    console.error('Error:', result.error || 'Unknown error occurred');
    process.exit(1);
  }
  const output = formatJson({ success: true, data: result.data }, options.pretty);
  writeOutput(output, options.output, !!options.output);
  return;
}
```

Add CLI flag in `createCrawlCommand()`:

```ts
.option('--active', 'List active crawl jobs', false)
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "executeCrawlActive"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/crawl.ts src/commands/crawl.ts src/__tests__/commands/crawl.test.ts src/__tests__/utils/mock-client.ts
git commit -m "feat: add crawl active command"
```

---

### Task 4: Batch command (start) with tests (TDD)

**Files:**
- Create: `src/types/batch.ts`
- Create: `src/commands/batch.ts`
- Create: `src/__tests__/commands/batch.test.ts`
- Modify: `src/__tests__/utils/mock-client.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/commands/batch.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBatchCommand, executeBatch } from '../../commands/batch';
import { getClient } from '../../utils/client';
import { initializeConfig } from '../../utils/config';
import { writeOutput } from '../../utils/output';
import { setupTest, teardownTest } from '../utils/mock-client';

vi.mock('../../utils/client', async () => {
  const actual = await vi.importActual('../../utils/client');
  return { ...actual, getClient: vi.fn() };
});

vi.mock('../../utils/output', () => ({
  writeOutput: vi.fn(),
}));

describe('executeBatch', () => {
  let mockClient: {
    startBatchScrape: ReturnType<typeof vi.fn>;
    batchScrape: ReturnType<typeof vi.fn>;
    getBatchScrapeStatus: ReturnType<typeof vi.fn>;
    getBatchScrapeErrors: ReturnType<typeof vi.fn>;
    cancelBatchScrape: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    setupTest();
    initializeConfig({ apiKey: 'test-api-key', apiUrl: 'https://api.firecrawl.dev' });

    mockClient = {
      startBatchScrape: vi.fn(),
      batchScrape: vi.fn(),
      getBatchScrapeStatus: vi.fn(),
      getBatchScrapeErrors: vi.fn(),
      cancelBatchScrape: vi.fn(),
    };

    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should start batch scrape when wait is false', async () => {
    mockClient.startBatchScrape.mockResolvedValue({ id: 'batch-1', url: 'https://api/firecrawl.dev/v2/batch/scrape/batch-1' });

    const result = await executeBatch({
      urls: ['https://a.com', 'https://b.com'],
      wait: false,
    });

    expect(mockClient.startBatchScrape).toHaveBeenCalledWith(
      ['https://a.com', 'https://b.com'],
      expect.any(Object)
    );
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('batch-1');
  });

  it('should wait batch scrape when wait is true', async () => {
    mockClient.batchScrape.mockResolvedValue({
      id: 'batch-1',
      status: 'completed',
      completed: 2,
      total: 2,
      data: [],
    });

    const result = await executeBatch({
      urls: ['https://a.com'],
      wait: true,
      pollInterval: 2,
      timeout: 60,
    });

    expect(mockClient.batchScrape).toHaveBeenCalledWith(
      ['https://a.com'],
      expect.objectContaining({ pollInterval: 2, timeout: 60 })
    );
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
  });

  it('should not normalize job IDs when status is true', async () => {
    mockClient.getBatchScrapeStatus.mockResolvedValue({
      id: 'batch-1',
      status: 'scraping',
      completed: 1,
      total: 2,
      data: [],
    });

    const result = await executeBatch({ jobId: 'batch-1', status: true });

    expect(mockClient.getBatchScrapeStatus).toHaveBeenCalledWith('batch-1', undefined);
    expect(result.success).toBe(true);
  });
});

describe('createBatchCommand', () => {
  it('should define the batch command', () => {
    const cmd = createBatchCommand();
    expect(cmd.name()).toBe('batch');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/batch.test.ts
```
Expected: FAIL because `executeBatch` and `createBatchCommand` do not exist.

**Step 3: Write minimal implementation**

Create `src/types/batch.ts`:

```ts
export interface BatchOptions {
  urls?: string[];
  jobId?: string;
  wait?: boolean;
  status?: boolean;
  errors?: boolean;
  cancel?: boolean;
  pollInterval?: number;
  timeout?: number;
  // scrape options
  format?: string;
  onlyMainContent?: boolean;
  waitFor?: number;
  scrapeTimeout?: number;
  screenshot?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  // batch options
  maxConcurrency?: number;
  ignoreInvalidUrls?: boolean;
  webhook?: string;
  zeroDataRetention?: boolean;
  idempotencyKey?: string;
  appendToId?: string;
  integration?: string;
  // output
  output?: string;
  pretty?: boolean;
  json?: boolean;
  apiKey?: string;
}
```

Create `src/commands/batch.ts` (minimal, then expand later):

```ts
import { Command } from 'commander';
import type { BatchOptions } from '../types/batch';
import { getClient } from '../utils/client';
import { formatJson, handleCommandError } from '../utils/command';
import { writeOutput } from '../utils/output';
import { parseFormats } from '../utils/options';
import { normalizeUrl } from '../utils/url';

function buildBatchScrapeOptions(options: BatchOptions) {
  const scrapeOptions: Record<string, unknown> = {};

  if (options.format) {
    scrapeOptions.formats = parseFormats(options.format).map((type) => ({ type }));
  }
  if (options.onlyMainContent !== undefined) scrapeOptions.onlyMainContent = options.onlyMainContent;
  if (options.waitFor !== undefined) scrapeOptions.waitFor = options.waitFor;
  if (options.scrapeTimeout !== undefined) scrapeOptions.timeout = options.scrapeTimeout * 1000;
  if (options.screenshot) {
    const formats = (scrapeOptions.formats as Array<{ type: string }> | undefined) ?? [];
    if (!formats.find((f) => f.type === 'screenshot')) formats.push({ type: 'screenshot' });
    scrapeOptions.formats = formats;
  }
  if (options.includeTags && options.includeTags.length > 0) scrapeOptions.includeTags = options.includeTags;
  if (options.excludeTags && options.excludeTags.length > 0) scrapeOptions.excludeTags = options.excludeTags;

  return {
    options: Object.keys(scrapeOptions).length > 0 ? scrapeOptions : undefined,
    webhook: options.webhook,
    maxConcurrency: options.maxConcurrency,
    ignoreInvalidURLs: options.ignoreInvalidUrls,
    zeroDataRetention: options.zeroDataRetention,
    idempotencyKey: options.idempotencyKey,
    appendToId: options.appendToId,
    integration: options.integration,
  };
}

export async function executeBatch(options: BatchOptions) {
  try {
    const app = getClient({ apiKey: options.apiKey });

    if (options.status && options.jobId) {
      const status = await app.getBatchScrapeStatus(options.jobId);
      return { success: true, data: status };
    }

    if (options.urls && options.urls.length > 0) {
      const batchOptions = buildBatchScrapeOptions(options);

      if (options.wait) {
        const job = await app.batchScrape(options.urls, {
          ...batchOptions,
          pollInterval: options.pollInterval,
          timeout: options.timeout,
        });
        return { success: true, data: job };
      }

      const started = await app.startBatchScrape(options.urls, batchOptions);
      return { success: true, data: started };
    }

    return { success: false, error: 'No URLs or job ID provided' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function handleBatchCommand(options: BatchOptions): Promise<void> {
  const result = await executeBatch(options);
  if (!handleCommandError(result)) return;

  const output = formatJson({ success: true, data: result.data }, options.pretty);
  writeOutput(output, options.output, !!options.output);
}

export function createBatchCommand(): Command {
  const batchCmd = new Command('batch')
    .description('Batch scrape multiple URLs using Firecrawl')
    .argument('[urls-or-job-id...]', 'URLs to scrape or a batch job ID for status/errors/cancel')
    .option('--wait', 'Wait for batch scrape to complete', false)
    .option('--poll-interval <seconds>', 'Polling interval in seconds', parseFloat)
    .option('--timeout <seconds>', 'Timeout in seconds for wait', parseFloat)
    .option('--status', 'Get status for a batch job ID', false)
    .option('--format <formats>', 'Scrape format(s) for batch results')
    .option('--only-main-content', 'Only return main content', false)
    .option('--wait-for <ms>', 'Wait time before scraping in milliseconds', parseInt)
    .option('--scrape-timeout <seconds>', 'Per-page scrape timeout', parseFloat)
    .option('--screenshot', 'Include screenshot format', false)
    .option('--include-tags <tags>', 'Comma-separated list of tags to include')
    .option('--exclude-tags <tags>', 'Comma-separated list of tags to exclude')
    .option('--max-concurrency <number>', 'Max concurrency for batch scraping', parseInt)
    .option('--ignore-invalid-urls', 'Ignore invalid URLs', false)
    .option('--webhook <url>', 'Webhook URL for batch completion')
    .option('--zero-data-retention', 'Enable zero data retention', false)
    .option('--idempotency-key <key>', 'Idempotency key for batch job')
    .option('--append-to-id <id>', 'Append results to existing batch id')
    .option('--integration <name>', 'Integration name for analytics')
    .option('-k, --api-key <key>', 'Firecrawl API key (overrides global --api-key)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--pretty', 'Pretty print JSON output', false)
    .action(async (rawArgs: string[], options) => {
      const urlsOrId = rawArgs ?? [];

      // If status/cancel/errors, treat first arg as job ID (do NOT normalize)
      const jobId = options.status || options.cancel || options.errors ? urlsOrId[0] : undefined;

      const urls = options.status || options.cancel || options.errors
        ? undefined
        : urlsOrId
            .flatMap((u) => (u.includes('\\n') ? u.split('\\n').filter(Boolean) : [u]))
            .map(normalizeUrl);

      const batchOptions: BatchOptions = {
        urls,
        jobId,
        wait: options.wait,
        status: options.status,
        pollInterval: options.pollInterval,
        timeout: options.timeout,
        format: options.format,
        onlyMainContent: options.onlyMainContent,
        waitFor: options.waitFor,
        scrapeTimeout: options.scrapeTimeout,
        screenshot: options.screenshot,
        includeTags: options.includeTags
          ? options.includeTags.split(',').map((t: string) => t.trim())
          : undefined,
        excludeTags: options.excludeTags
          ? options.excludeTags.split(',').map((t: string) => t.trim())
          : undefined,
        maxConcurrency: options.maxConcurrency,
        ignoreInvalidUrls: options.ignoreInvalidUrls,
        webhook: options.webhook,
        zeroDataRetention: options.zeroDataRetention,
        idempotencyKey: options.idempotencyKey,
        appendToId: options.appendToId,
        integration: options.integration,
        apiKey: options.apiKey,
        output: options.output,
        pretty: options.pretty,
      };

      await handleBatchCommand(batchOptions);
    });

  return batchCmd;
}
```

Update `src/__tests__/utils/mock-client.ts`:

```ts
export interface MockFirecrawlClient {
  // ...existing...
  startBatchScrape?: Mock;
  batchScrape?: Mock;
  getBatchScrapeStatus?: Mock;
  getBatchScrapeErrors?: Mock;
  cancelBatchScrape?: Mock;
}
```

Wire into `src/index.ts`:

```ts
import { createBatchCommand } from './commands/batch';

// ...after other commands...
program.addCommand(createBatchCommand());

// add to auth-required
const AUTH_REQUIRED_COMMANDS = ['scrape', 'crawl', 'map', 'search', 'extract', 'batch'];
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/batch.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/batch.ts src/commands/batch.ts src/__tests__/commands/batch.test.ts src/__tests__/utils/mock-client.ts src/index.ts
git commit -m "feat: add batch scrape command"
```

---

### Task 5: Batch status/cancel/errors commands (TDD)

**Files:**
- Modify: `src/types/batch.ts`
- Modify: `src/commands/batch.ts`
- Modify: `src/__tests__/commands/batch.test.ts`

**Step 1: Write the failing tests**

Append to `src/__tests__/commands/batch.test.ts`:

```ts
it('should cancel batch scrape job', async () => {
  mockClient.cancelBatchScrape.mockResolvedValue(true);

  const result = await executeBatch({ jobId: 'batch-1', cancel: true });

  expect(mockClient.cancelBatchScrape).toHaveBeenCalledWith('batch-1');
  expect(result.success).toBe(true);
  expect(result.data).toEqual({ success: true, message: 'cancelled' });
});

it('should get batch scrape errors', async () => {
  mockClient.getBatchScrapeErrors.mockResolvedValue({
    errors: [{ id: 'err-1', url: 'https://a.com', error: 'blocked', code: 'BLOCKED' }],
    robotsBlocked: ['https://b.com/robots'],
  });

  const result = await executeBatch({ jobId: 'batch-1', errors: true });

  expect(mockClient.getBatchScrapeErrors).toHaveBeenCalledWith('batch-1');
  expect(result.success).toBe(true);
  expect(result.data?.errors.length).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/batch.test.ts -t "cancel batch|batch scrape errors"
```
Expected: FAIL (paths not implemented).

**Step 3: Write minimal implementation**

Update `src/types/batch.ts` to include fields for cancel/errors:

```ts
export interface BatchCancelData { success: true; message: string; }
export interface BatchErrorsData {
  errors: Array<{ id: string; url: string; error: string; timestamp?: string; code?: string }>;
  robotsBlocked: string[];
}
```

Update `executeBatch` in `src/commands/batch.ts` to handle cancel/errors before status/start:

```ts
if (options.cancel && options.jobId) {
  const ok = await app.cancelBatchScrape(options.jobId);
  if (!ok) return { success: false, error: 'Cancel failed' };
  return { success: true, data: { success: true, message: 'cancelled' } };
}

if (options.errors && options.jobId) {
  const errors = await app.getBatchScrapeErrors(options.jobId);
  return { success: true, data: errors };
}
```

Add CLI flags in `createBatchCommand()`:

```ts
.option('--cancel', 'Cancel a batch scrape job', false)
.option('--errors', 'Fetch batch scrape errors', false)
```

Validate job id in the action handler:

```ts
if ((options.status || options.cancel || options.errors) && !urlsOrId[0]) {
  console.error('Error: job ID is required for --status/--cancel/--errors');
  process.exit(1);
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/batch.test.ts -t "cancel batch|batch scrape errors"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/batch.ts src/commands/batch.ts src/__tests__/commands/batch.test.ts
git commit -m "feat: add batch cancel/errors commands"
```

---

### Task 6: Extract status command (TDD)

**Files:**
- Modify: `src/types/extract.ts`
- Modify: `src/commands/extract.ts`
- Modify: `src/__tests__/commands/extract.test.ts`
- Modify: `src/__tests__/utils/mock-client.ts`

**Step 1: Write the failing tests**

Append to `src/__tests__/commands/extract.test.ts`:

```ts
describe('executeExtract status mode', () => {
  it('should call getExtractStatus when status is true', async () => {
    const mockClient = { getExtractStatus: vi.fn() };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>
    );

    mockClient.getExtractStatus.mockResolvedValue({
      id: 'ext-1',
      status: 'completed',
      data: { ok: true },
      tokensUsed: 1,
    });

    const result = await executeExtract({
      status: true,
      jobId: 'ext-1',
      urls: [],
    });

    expect(mockClient.getExtractStatus).toHaveBeenCalledWith('ext-1');
    expect(result.success).toBe(true);
    expect(result.data?.extracted).toEqual({ ok: true });
    expect(result.data?.status).toBe('completed');
    expect(result.data?.tokensUsed).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test -- src/__tests__/commands/extract.test.ts -t "executeExtract status mode"
```
Expected: FAIL because status mode is not implemented.

**Step 3: Write minimal implementation**

Update `src/types/extract.ts`:

```ts
export interface ExtractOptions {
  // ...existing fields...
  status?: boolean;
  jobId?: string;
}

export interface ExtractResult {
  success: boolean;
  data?: {
    extracted: unknown;
    sources?: unknown;
    warning?: string;
    status?: 'processing' | 'completed' | 'failed' | 'cancelled';
    expiresAt?: string;
    tokensUsed?: number;
  };
  error?: string;
}
```

Update `src/__tests__/utils/mock-client.ts`:

```ts
export interface MockFirecrawlClient {
  // ...existing...
  getExtractStatus?: Mock;
  startExtract?: Mock;
}
```

Update `executeExtract` in `src/commands/extract.ts` to check status mode first:

```ts
if (options.status && options.jobId) {
  const status = await app.getExtractStatus(options.jobId);

  if (status.error) {
    return { success: false, error: status.error };
  }

  return {
    success: true,
    data: {
      extracted: status.data,
      warning: status.warning,
      status: status.status,
      expiresAt: status.expiresAt,
      tokensUsed: (status as { tokensUsed?: number }).tokensUsed,
      sources: status.sources,
    },
  };
}
```

Update `createExtractCommand()` to accept status mode:

```ts
.argument('[urls-or-job-id...]', 'URL(s) to extract from or a job ID for status')
.option('--status', 'Get extract job status by ID', false)
```

Update the action handler to use job ID when `--status` is set:

```ts
.action(async (rawArgs: string[], options) => {
  if (options.status) {
    const jobId = rawArgs?.[0];
    if (!jobId) {
      console.error('Error: job ID is required for --status');
      process.exit(1);
    }

    await handleExtractCommand({
      status: true,
      jobId,
      urls: [],
      apiKey: options.apiKey,
      output: options.output,
      json: true,
      pretty: options.pretty,
      embed: false,
    });
    return;
  }

  // existing URL normalization path...
});
```

Update `handleExtractCommand` to output full status metadata when `options.status` is true:

```ts
if (options.status && result.data) {
  const outputContent = formatJson({ success: true, data: result.data }, options.pretty);
  writeOutput(outputContent, options.output, !!options.output);
  return;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test -- src/__tests__/commands/extract.test.ts -t "executeExtract status mode"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/extract.ts src/commands/extract.ts src/__tests__/commands/extract.test.ts src/__tests__/utils/mock-client.ts
git commit -m "feat: add extract status mode"
```

---

### Task 7: CLI help, validation, and safety checks (TDD)

**Files:**
- Modify: `src/commands/crawl.ts`
- Modify: `src/commands/batch.ts`
- Modify: `src/commands/extract.ts`

**Step 1: Write failing validation tests**

Add to appropriate test files (crawl/batch/extract) to assert:
- `firecrawl crawl --active` works without URL/job ID.
- `--cancel`/`--errors` without job id exits with error.
- `--status` for batch/extract requires job id.

**Step 2: Run tests to verify they fail**

Run:
```bash
pnpm test -- src/__tests__/commands/crawl.test.ts -t "cancel requires job"
pnpm test -- src/__tests__/commands/batch.test.ts -t "status requires job"
pnpm test -- src/__tests__/commands/extract.test.ts -t "status requires job"
```
Expected: FAIL.

**Step 3: Implement validation and command routing**

Add guards in action handlers similar to:

```ts
if ((options.cancel || options.errors) && !isJobId(urlOrJobId)) {
  console.error('Error: job ID is required for --cancel/--errors');
  process.exit(1);
}
```

Add a special-case for `--active` in the crawl action handler so it does not require a URL/job ID:

```ts
if (options.active) {
  await handleCrawlCommand({
    active: true,
    output: options.output,
    pretty: options.pretty,
    apiKey: options.apiKey,
  });
  return;
}
```

And in batch/extract handlers, ensure job id is present when needed.

**Step 4: Run tests again**

Run the same commands as Step 2. Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/crawl.ts src/commands/batch.ts src/commands/extract.ts src/__tests__/commands/*.test.ts
git commit -m "test: enforce job id validation for status/error/cancel"
```

---

### Task 8: Full test run and cleanup

**Files:**
- None

**Step 1: Run full unit test suite**

Run:
```bash
pnpm test
```
Expected: PASS.

**Step 2: Optional lint/type check**

Run:
```bash
pnpm lint
pnpm type-check
```
Expected: PASS.

**Step 3: Commit (if any fixes)**

```bash
git add .
git commit -m "chore: finalize crawl/batch/extract command coverage"
```

---

**Plan complete and saved to `plan-crawl-batch-extract-commands.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
