# Test Helpers

Comprehensive test helper utilities to reduce duplication across test files and provide consistent testing patterns.

## Overview

This directory contains reusable test helpers organized by category:

- **mock-setup.ts** - Mock creation utilities for containers, clients, and services
- **module-mocks.ts** - Module mock patterns for command, output, job, and other utilities
- **process.ts** - Process-level helpers for exit codes and console capture
- **assertions.ts** - Common assertion patterns for results and mock calls
- **fixtures.ts** - Test data generators for API responses and entities
- **lifecycle.ts** - Test lifecycle management (setup/teardown patterns)
- **index.ts** - Central export point for all helpers

## Usage

Import helpers from the central index:

```typescript
import {
  createMockContainer,
  expectSuccessResult,
  createScrapeResponse,
  setupTestLifecycle,
} from '../helpers';
```

## Mock Setup Utilities

### createMockAxonClient()

Create a fully-featured mock Axon client with all methods:

```typescript
const mockClient = createMockAxonClient({
  scrape: vi.fn().mockResolvedValue(createScrapeResponse()),
});
```

### createMockContainer()

Create a mock container with all dependencies:

```typescript
const container = createMockContainer(
  { scrape: vi.fn() }, // Mock client methods
  { apiKey: 'test-key' }, // Config overrides
  { autoEmbed: mockAutoEmbed } // Embed pipeline config
);
```

### createMockEmbedPipeline()

Create a mock embed pipeline:

```typescript
const mockPipeline = createMockEmbedPipeline({
  autoEmbed: vi.fn().mockResolvedValue(undefined),
});
```

### createMockQdrantService()

Create a mock Qdrant service with all methods:

```typescript
const mockQdrant = createMockQdrantService();
vi.mocked(mockQdrant.scrollByUrl).mockResolvedValue(points);
```

### setupFsMocks(), setupOsMocks(), setupOutputMocks()

Create mock implementations for common Node.js modules:

```typescript
vi.mock('node:fs', () => setupFsMocks());
vi.mock('node:os', () => setupOsMocks('/home/testuser'));
vi.mock('../../utils/output', () => setupOutputMocks());
```

## Assertion Utilities

### expectSuccessResult() / expectErrorResult()

Type-safe assertions for command results:

```typescript
const result = await executeScrape(container, { url: 'https://example.com' });
expectSuccessResult(result);
expect(result.data.markdown).toBe('# Test');

const errorResult = await executeScrape(container, { url: 'invalid' });
expectErrorResult(errorResult, 'Invalid URL');
```

### expectCalledWithUrlAndOptions()

Assert mock was called with expected URL and options:

```typescript
expectCalledWithUrlAndOptions(mockClient.scrape, 'https://example.com', {
  formats: ['markdown'],
});
```

### expectCalledWithQueryAndOptions()

Assert mock was called with query string and options:

```typescript
expectCalledWithQueryAndOptions(mockClient.search, 'test query', {
  limit: 10,
});
```

### expectResultData()

Assert result data contains expected properties:

```typescript
expectResultData(result, {
  url: 'https://example.com',
  title: 'Test Page',
  totalChunks: 2,
});
```

### expectArrayResult()

Assert array result has expected length and items:

```typescript
expectArrayResult(result, 3, (item) => item.url.startsWith('https://'));
```

### Other Assertions

- `expectCalledWithContaining()` - Assert mock called with object containing properties
- `expectFetchCalled()` - Assert fetch called with URL and method
- `expectNotCalled()` - Assert mock was never called
- `expectCalledTimes()` - Assert mock called exact number of times
- `expectDefined()` - Type-safe assertion that value is not null/undefined
- `expectProperties()` - Assert object has specific property values

## Fixture Generators

### createScrapeResponse()

Generate mock scrape API responses:

```typescript
const response = createScrapeResponse({
  markdown: '# Custom Content',
  url: 'https://example.com',
  screenshot: 'base64...',
});
```

### createSearchResponse()

Generate mock search responses with multiple results:

```typescript
const response = createSearchResponse(5, {
  url: 'https://example.com',
  title: 'Result Title',
});
```

### createCrawlStatus()

Generate mock crawl status responses:

```typescript
const status = createCrawlStatus({
  status: 'completed',
  total: 10,
  completed: 10,
});
```

### createQdrantPoint() / createQdrantPoints()

Generate mock Qdrant vector database points:

```typescript
const point = createQdrantPoint({
  url: 'https://example.com',
  chunkIndex: 0,
  chunkText: 'Test content',
});

const points = createQdrantPoints(5, { domain: 'example.com' });
```

### createJobHistoryEntry() / createJobHistoryFile()

Generate mock job history data:

```typescript
const entry = createJobHistoryEntry({ id: 'crawl-123' });

const historyFile = createJobHistoryFile(
  [entry], // crawl jobs
  [], // batch jobs
  [] // extract jobs
);
```

### Other Fixtures

- `createCredentials()` - Mock credentials object
- `createMapResponse()` - Mock map API response
- `createExtractResponse()` - Mock extract API response
- `createBatchStatus()` - Mock batch scrape status
- `createSearchResult()` - Single search result item

## Lifecycle Utilities

### setupTestLifecycle()

Setup standard beforeEach/afterEach with mock clearing:

```typescript
describe('My Tests', () => {
  setupTestLifecycle(
    () => {
      // Custom beforeEach logic
    },
    () => {
      // Custom afterEach logic
    }
  );

  it('test case', () => {
    // Mocks are automatically cleared before/after each test
  });
});
```

### setupEnvVars()

Temporarily set environment variables with automatic cleanup:

```typescript
const cleanup = setupEnvVars({
  AXON_HOME: '/custom/path',
  API_KEY: undefined, // Delete this var
});

// Test code...

cleanup(); // Restore original env
```

### withEnv()

Run function with temporary environment variables:

```typescript
await withEnv({ AXON_HOME: '/tmp' }, async () => {
  // Code runs with modified env
  const result = await someFunction();
  expect(result).toBeDefined();
}); // Env automatically restored
```

### setupFileSystemMocks()

Setup comprehensive file system mocks:

```typescript
const { cleanup, setAxonHome } = setupFileSystemMocks(
  '/home/testuser', // homedir
  '/test/working/dir' // cwd
);

setAxonHome('/custom/path');

// Test code...

cleanup(); // Restore original fs state
```

### setupConsoleSpy()

Spy on console methods with automatic cleanup:

```typescript
const { spies, cleanup } = setupConsoleSpy(['log', 'error']);

// Test code...
expect(spies.log).toHaveBeenCalledWith('message');

cleanup(); // Restore original console
```

### Other Lifecycle Utilities

- `setupModuleMock()` - Mock module with cleanup
- `setupFakeTimers()` - Mock timers with cleanup
- `setupCwdMock()` - Mock process.cwd() with cleanup
- `createTestContext()` - Create test context with setup/teardown
- `flushPromises()` - Wait for pending promises to resolve

## Migration Examples

### Before (Duplicated Setup)

```typescript
describe('executeScrape', () => {
  let mockClient: MockAxonClient;
  let mockContainer: IContainer;

  beforeEach(() => {
    mockClient = {
      scrape: vi.fn(),
    };

    mockContainer = {
      config: {
        apiKey: 'test-api-key',
        apiUrl: 'https://api.axon.dev',
        teiUrl: 'http://localhost:8080',
        qdrantUrl: 'http://localhost:6333',
        qdrantCollection: 'test_collection',
      },
      getAxonClient: vi.fn().mockReturnValue(mockClient),
      getEmbedPipeline: vi.fn().mockReturnValue({
        autoEmbed: vi.fn().mockResolvedValue(undefined),
      }),
      getTeiService: vi.fn(),
      getQdrantService: vi.fn(),
      getHttpClient: vi.fn(),
    } as unknown as IContainer;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should scrape URL', async () => {
    const mockResponse = { markdown: '# Test', url: 'https://example.com' };
    mockClient.scrape.mockResolvedValue(mockResponse);

    const result = await executeScrape(mockContainer, {
      url: 'https://example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
    expect(mockClient.scrape).toHaveBeenCalledWith('https://example.com', {
      formats: ['markdown'],
    });
  });
});
```

### After (Using Helpers)

```typescript
import {
  createMockContainer,
  createMockAxonClient,
  createScrapeResponse,
  expectSuccessResult,
  expectCalledWithUrlAndOptions,
  setupTestLifecycle,
} from '../helpers';

describe('executeScrape', () => {
  let mockClient: MockAxonClient;
  let container: IContainer;

  setupTestLifecycle(
    () => {
      mockClient = createMockAxonClient();
      container = createMockContainer({ scrape: mockClient.scrape });
    }
  );

  it('should scrape URL', async () => {
    const mockResponse = createScrapeResponse();
    mockClient.scrape.mockResolvedValue(mockResponse);

    const result = await executeScrape(container, {
      url: 'https://example.com',
    });

    expectSuccessResult(result);
    expectCalledWithUrlAndOptions(mockClient.scrape, 'https://example.com', {
      formats: ['markdown'],
    });
  });
});
```

## Module Mock Utilities

### mockOutputModule()

Create mock for output utility module:

```typescript
vi.mock('../../utils/output', () => mockOutputModule());
```

### mockCommandModule()

Create mock for command utility module:

```typescript
vi.mock('../../utils/command', () => mockCommandModule());
```

### mockJobModule(), mockJobHistoryModule()

Create mocks for job and job-history modules:

```typescript
vi.mock('../../utils/job', () => mockJobModule());
vi.mock('../../utils/job-history', () => mockJobHistoryModule());
```

### setupCommonCommandMocks()

Setup all common command test mocks at once:

```typescript
const mocks = setupCommonCommandMocks();
// Sets up output, command, job, and job-history mocks
// Access via mocks.output, mocks.command, etc.
```

### setupCrawlCommandMocks()

Setup all crawl command module mocks:

```typescript
const mocks = setupCrawlCommandMocks();
// Sets up execute, embed, format, and polling mocks
// Access via mocks.execute, mocks.embed, etc.
```

### connectCommandToOutput()

Connect writeCommandOutput to writeOutput (common delegation pattern):

```typescript
const { command, output } = setupCommonCommandMocks();
connectCommandToOutput(command.writeCommandOutput, output.writeOutput);
```

## Process Utilities

### setupExitCodeCapture()

Automatically capture and reset process.exitCode:

```typescript
const { getExitCode, resetExitCode } = setupExitCodeCapture();
// Automatically resets exitCode before/after each test
```

### withExitCodeCapture()

Execute function with exit code capture:

```typescript
const [result, exitCode] = await withExitCodeCapture(async () => {
  await handleCommand(container, options);
});
expect(exitCode).toBe(1);
```

### setupConsoleCapture()

Capture all console output:

```typescript
const capture = setupConsoleCapture();
// Do things that log to console
expect(capture.errors).toContain('Error message');
capture.restore(); // Clean up spies
```

### withConsoleCapture()

Execute function with console capture:

```typescript
const [result, logs, errors] = await withConsoleCapture(async () => {
  console.log('test');
  console.error('error');
  return 42;
});
expect(logs).toEqual(['test']);
expect(errors).toEqual(['error']);
```

### createConsoleSpy()

Create a single console spy (auto-restores):

```typescript
const mockError = createConsoleSpy('error');
// Do things
expect(mockError).toHaveBeenCalledWith('Error message');
```

### withSuppressedConsole()

Execute function with all console output suppressed:

```typescript
const result = await withSuppressedConsole(async () => {
  console.log('This is suppressed');
  return 42;
});
```

### setupCommandTestCapture()

Setup both exit code and console capture (common pattern):

```typescript
const { getExitCode, logs, errors, mockLog, mockError } = setupCommandTestCapture();
// Automatically manages both exitCode and console spies
```

## Benefits

1. **Reduced Duplication**: Common patterns extracted into reusable helpers
2. **Type Safety**: Helpers provide proper TypeScript types
3. **Consistency**: All tests use the same patterns
4. **Maintainability**: Update patterns in one place
5. **Readability**: Tests focus on behavior, not setup boilerplate
6. **Error Prevention**: Helpers encode best practices (e.g., frozen configs)
7. **Module Mocking**: Standardized mocks for common modules
8. **Process Management**: Safe exit code and console handling

## Contributing

When adding new test helpers:

1. Choose the appropriate category file
2. Add comprehensive JSDoc documentation
3. Export from index.ts
4. Update this README with usage examples
5. Ensure helpers are reusable across multiple test files
