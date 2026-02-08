# Test Command Output Examples

Real-world examples of test-command skill output for various scenarios.

## Example 1: Successful Test Run

**Command**: `/test-command scrape`

**Output**:
```
✓ Found command: src/commands/scrape.ts

→ Running type check...
✓ Type check passed

→ Running tests for 'scrape'...

 ✓ src/__tests__/commands/scrape.test.ts (12)
   ✓ scrape command
     ✓ should scrape a URL successfully
     ✓ should handle scrape failures gracefully
     ✓ should validate URL format
     ✓ should generate embeddings by default
     ✓ should skip embeddings with --no-embed flag
     ✓ should save output to file with --output flag
     ✓ should format output as JSON with --format json
     ✓ should format output as markdown with --format markdown
     ✓ should handle API errors
     ✓ should show progress with --wait flag
     ✓ should poll job status until complete
     ✓ should timeout after max retries

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  14:23:45
   Duration  245ms

✓ All tests passed

Ready to commit!
```

---

## Example 2: Failed Tests

**Command**: `/test-command config`

**Output**:
```
✓ Found command: src/commands/config.ts

→ Running type check...
✓ Type check passed

→ Running tests for 'config'...

 ✓ src/__tests__/commands/config.test.ts (6/8)
   ✓ config command
     ✓ should display current configuration
     ✓ should set API key
     ✓ should set API URL
     ✓ should validate API URL format
     ✓ should reset configuration
     ✓ should save to credential store
     ✗ should load from credential store (expected "test-key", received undefined)
     ✗ should handle missing credentials gracefully (expected error, got success)

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
   Start at  14:25:12
   Duration  312ms

✗ Tests failed

Fix failing tests before committing
```

---

## Example 3: Type Check Failure

**Command**: `/test-command extract`

**Output**:
```
✓ Found command: src/commands/extract.ts

→ Running type check...

src/commands/extract.ts:45:12 - error TS2339: Property 'schema' does not exist on type 'ExtractOptions'.

45   const { schema, url } = options;
              ~~~~~~

src/commands/extract.ts:67:23 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'ExtractSchema'.

67   const result = await extractData(url, schema);
                              ~~~~~~

Found 2 errors in 1 file.

✗ Type check failed

Fix type errors before running tests
```

---

## Example 4: Command Not Found

**Command**: `/test-command foobar`

**Output**:
```
✗ Command 'foobar' not found

Available commands:
  - batch
  - config
  - crawl
  - delete
  - domains
  - embed
  - extract
  - history
  - info
  - list
  - login
  - logout
  - map
  - query
  - retrieve
  - scrape
  - search
  - sources
  - stats
  - status
  - version
```

---

## Example 5: Command with Subdirectory

**Command**: `/test-command crawl`

**Output**:
```
✓ Found command directory: src/commands/crawl/

→ Running type check...
✓ Type check passed

→ Running tests for 'crawl'...

 ✓ src/__tests__/commands/crawl/command.test.ts (15)
 ✓ src/__tests__/commands/crawl/options.test.ts (8)
 ✓ src/__tests__/commands/crawl/polling.test.ts (6)
 ✓ src/__tests__/commands/crawl/progress.test.ts (4)
 ✓ src/__tests__/commands/crawl/embeddings.test.ts (12)
 ✓ src/__tests__/commands/crawl/output.test.ts (7)
 ✓ src/__tests__/commands/crawl/error-handling.test.ts (9)

 Test Files  7 passed (7)
      Tests  61 passed (61)
   Start at  14:27:33
   Duration  1.2s

✓ All tests passed

Ready to commit!
```

---

## Example 6: Docker Services Not Running (E2E Test)

**Command**: `/test-command crawl` (with E2E tests enabled)

**Output**:
```
✓ Found command directory: src/commands/crawl/

→ Running type check...
✓ Type check passed

→ Running tests for 'crawl'...

 ✓ src/__tests__/commands/crawl/command.test.ts (15)
 ✗ src/__tests__/e2e/crawl.e2e.test.ts (0/3)
   ✗ crawl E2E tests
     ✗ should crawl a real website (Connection refused to http://localhost:53002)
     ✗ should generate embeddings (Connection refused to http://localhost:53000)
     ✗ should store vectors in Qdrant (Connection refused to http://localhost:53333)

 Test Files  1 failed | 1 passed (2)
      Tests  3 failed | 15 passed (18)
   Start at  14:29:05
   Duration  428ms

✗ Tests failed

Fix failing tests before committing

Note: E2E tests require Docker services to be running.
Run: docker compose up -d
```

---

## Example 7: Timeout Failure

**Command**: `/test-command map`

**Output**:
```
✓ Found command: src/commands/map.ts

→ Running type check...
✓ Type check passed

→ Running tests for 'map'...

 ✓ src/__tests__/commands/map.test.ts (9/10)
   ✓ map command
     ✓ should map URLs from sitemap
     ✓ should handle sitemap errors
     ✓ should filter by URL pattern
     ✓ should respect max depth
     ✓ should parse robots.txt
     ✓ should handle redirects
     ✓ should deduplicate URLs
     ✓ should save to file
     ✓ should format as JSON
     ✗ should poll large sitemap (Test timed out after 5000ms)

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
   Start at  14:30:22
   Duration  5.1s

✗ Tests failed

Fix failing tests before committing

Note: Consider increasing timeout for slow operations.
```

---

## Usage Patterns

### Quick Validation (TDD Workflow)

1. Edit command implementation
2. Run `/test-command <name>`
3. See immediate feedback
4. Fix issues and re-run

### Pre-Commit Check

Before committing changes to a specific command:

```bash
/test-command scrape
# Wait for ✓ or ✗
# If ✗, fix and re-run
# If ✓, commit
```

### Deep Analysis on Failure

If tests fail and you need detailed analysis:

```bash
/test-command crawl
# → ✗ Tests failed

"Can you analyze the test failures in detail?"
# → Spawns cli-tester agent for root cause analysis
```
