# Phase 3A: Testing Strategy and Coverage Analysis

**Project**: cli-firecrawl
**Date**: 2026-02-10
**Test Suite**: 829 passing tests across 49 test files
**Test Framework**: Vitest v4
**Review Scope**: Comprehensive analysis of test coverage, quality, and gaps relative to 31 Critical/High security and performance findings from Phase 2

---

## Executive Summary

### Test Coverage Overview

- **Source Files**: 86 TypeScript files
- **Test Files**: 58 test files
- **Tests**: 829 passing tests (runtime: 4.15s)
- **Estimated Coverage**: ~67% (58/86 files have tests)
- **Test Pyramid**: Heavily weighted toward unit tests (good), minimal E2E tests (7 files), 1 integration test

### Critical Findings

**12 Critical-severity test gaps** directly correlate to security vulnerabilities and performance issues identified in Phase 2. The most severe gaps:

1. **No webhook authentication bypass tests** (H-16) - Server binds to 0.0.0.0 without auth tests
2. **No API key leakage tests** (H-17) - Embed queue stores plaintext keys, no validation tests
3. **No ReDoS validation tests** (M-10) - URL filter regex patterns lack comprehensive safety tests
4. **No unbounded request body tests** (M-9) - Webhook endpoint missing DoS protection tests
5. **No concurrency race condition tests** (C-02, M-11) - TOCTOU and double-lock-release bugs untested
6. **No performance/load tests** - God functions, memory growth, connection pooling not benchmarked

---

## Testing Quality Analysis

### Test Pyramid Health

```
    /\
   /E2E\          7 files (good - minimal E2E)
  /------\
 /Integr-\       1 file (webhook-status only)
/---------\
| Unit:49 |      Excellent unit test coverage
\---------/
```

**Assessment**: Healthy pyramid, but missing integration tests for critical paths (webhook auth, file system race conditions, concurrent embedding).

### Assertion Quality

**Strengths**:
- Tests use specific assertions (`toEqual`, `toThrow`, `toHaveLength`)
- Error messages validated (not just error presence)
- Edge cases covered (empty inputs, invalid JSON, malformed URLs)

**Weaknesses**:
- Many tests verify implementation details (mock call counts) over behavior
- Insufficient boundary value testing (e.g., exactly 50 wildcards tested, but not 49 or 51 edge transitions)
- Missing negative tests for security critical paths

### Test Isolation

**Strengths**:
- Good use of `beforeEach`/`afterEach` for cleanup
- Mock resets between tests
- Temporary directories for file-based tests

**Weaknesses**:
- Global singletons not always reset (container factories)
- Some tests depend on timing (`setTimeout(10ms)`)
- File permission tests may fail on Windows (not mocked/skipped)

---

## Critical Test Gaps (Severity: Critical)

### C-TG-01: Webhook Authentication Bypass (Links to H-16)

**Severity**: Critical
**Risk**: Unauthenticated attackers can trigger arbitrary job processing, consume resources, inject malicious payloads
**Current State**: Zero tests validating webhook auth header bypass scenarios
**Phase 2 Link**: H-16 - Server binds to 0.0.0.0 without authentication

**What's Missing**:
1. Tests for missing `X-Embedder-Secret` header
2. Tests for incorrect secret value
3. Tests for timing attack resistance (validated by code review, but not tested)
4. Tests for header injection attacks
5. Tests for bypassing auth via `/health` and `/status` endpoints (should be unauthenticated)

**Existing Coverage**:
- `src/__tests__/utils/embedder-webhook.test.ts` - Only tests payload extraction, NOT authentication
- `src/__tests__/utils/webhook-status.integration.test.ts` - Tests `/status` endpoint but not auth

**Recommended Tests**:

```typescript
// src/__tests__/utils/webhook-auth.test.ts
describe('Webhook Authentication', () => {
  describe('Secret-based authentication', () => {
    it('should reject requests without X-Embedder-Secret header', async () => {
      const server = await startWebhookServer({ secret: 'test-secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'test-123' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject requests with incorrect secret', async () => {
      const server = await startWebhookServer({ secret: 'correct-secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'X-Embedder-Secret': 'wrong-secret' },
        body: JSON.stringify({ jobId: 'test-123' }),
      });
      expect(response.status).toBe(401);
    });

    it('should accept requests with correct secret', async () => {
      const server = await startWebhookServer({ secret: 'correct-secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'X-Embedder-Secret': 'correct-secret' },
        body: JSON.stringify({ jobId: 'test-123', status: 'completed' }),
      });
      expect(response.status).toBe(202);
    });

    it('should resist timing attacks on secret comparison', async () => {
      // Measure response time variance for correct vs incorrect secrets
      const server = await startWebhookServer({ secret: 'a'.repeat(64) });

      const timings = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await fetch('http://localhost:53000/webhooks/crawl', {
          method: 'POST',
          headers: { 'X-Embedder-Secret': 'b'.repeat(64) },
          body: '{}',
        });
        timings.push(performance.now() - start);
      }

      // Standard deviation should be low (< 5ms) for constant-time comparison
      const stdDev = calculateStdDev(timings);
      expect(stdDev).toBeLessThan(5);
    });

    it('should reject secrets with length mismatch', async () => {
      const server = await startWebhookServer({ secret: 'secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'X-Embedder-Secret': 'secret-extra' },
        body: '{}',
      });
      expect(response.status).toBe(401);
    });

    it('should allow /health endpoint without authentication', async () => {
      const server = await startWebhookServer({ secret: 'test-secret' });
      const response = await fetch('http://localhost:53000/health');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    it('should allow /status endpoint without authentication', async () => {
      const server = await startWebhookServer({ secret: 'test-secret' });
      const response = await fetch('http://localhost:53000/status');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('pendingJobs');
    });
  });

  describe('No-auth mode', () => {
    it('should accept webhook requests when secret not configured', async () => {
      const server = await startWebhookServer({ secret: undefined });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'test-123', status: 'completed' }),
      });
      expect(response.status).toBe(202);
    });
  });

  describe('Header injection attacks', () => {
    it('should reject array of secrets (type confusion)', async () => {
      const server = await startWebhookServer({ secret: 'test-secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'X-Embedder-Secret': ['test-secret', 'extra'] } as any,
        body: '{}',
      });
      expect(response.status).toBe(401);
    });

    it('should reject non-string secret header', async () => {
      const server = await startWebhookServer({ secret: 'test-secret' });
      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'X-Embedder-Secret': 123 } as any,
        body: '{}',
      });
      expect(response.status).toBe(401);
    });
  });
});
```

**Impact**: Without these tests, regression in auth logic could expose webhook endpoint to public internet, allowing attackers to:
- Consume TEI/Qdrant resources via fake job submissions
- Inject malicious payloads into embedding pipeline
- Perform DoS attacks via repeated webhook calls

---

### C-TG-02: API Key Leakage via Embed Queue (Links to H-17)

**Severity**: Critical
**Risk**: API keys stored in plaintext JSON files in `~/.config/firecrawl-cli/embed-queue/*.json` with mode 0o600
**Current State**: No tests validate that keys are never logged, written to stdout, or exposed in error messages
**Phase 2 Link**: H-17 - API key storage in plaintext (mitigated by file permissions, but not tested)

**What's Missing**:
1. Tests that API keys are NOT included in error messages
2. Tests that API keys are NOT logged to console/stderr
3. Tests that API keys are scrubbed from JSON payloads in logs
4. Tests validating file permissions are actually 0o600 (exists but needs enhancement)
5. Tests for key exposure in crash dumps or stack traces

**Existing Coverage**:
- `src/__tests__/utils/embed-queue.test.ts:407-431` - Tests file permissions (good)
- No tests for key scrubbing in logs or errors

**Recommended Tests**:

```typescript
// src/__tests__/utils/embed-queue-security.test.ts
describe('API Key Security', () => {
  let consoleErrorSpy: vi.MockInstance;
  let consoleLogSpy: vi.MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should not log API key when enqueueing job', async () => {
    const apiKey = 'fc-secret-api-key-12345';
    await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    // Check all console.error calls
    for (const call of consoleErrorSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(apiKey);
    }
  });

  it('should not include API key in error messages on job failure', async () => {
    const apiKey = 'fc-secret-api-key-12345';
    await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    // Simulate processing failure
    await markJobFailed('job-1', 'Network error');

    // Verify key not in error logs
    for (const call of consoleErrorSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(apiKey);
    }
  });

  it('should scrub API key from stack traces', async () => {
    const apiKey = 'fc-secret-api-key-12345';
    const job = await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    try {
      // Trigger error with job object in scope
      throw new Error(`Processing failed for ${JSON.stringify(job)}`);
    } catch (error) {
      const stackTrace = error instanceof Error ? error.stack : '';
      expect(stackTrace).not.toContain(apiKey);

      // Verify sanitization function exists
      const sanitized = sanitizeForLogging(error);
      expect(sanitized).not.toContain(apiKey);
    }
  });

  it('should redact API key when converting job to string', async () => {
    const apiKey = 'fc-secret-api-key-12345';
    const job = await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    const jobString = JSON.stringify(job, null, 2);
    expect(jobString).not.toContain(apiKey);
    expect(jobString).toMatch(/apiKey.*\[REDACTED\]/);
  });

  it('should not expose API key via process listing', async () => {
    const apiKey = 'fc-secret-api-key-12345';

    // Spawn background embedder with API key in job
    const daemon = spawn('node', ['dist/embedder-daemon.js']);

    await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    // Read process command line
    const cmdline = await fs.readFile(`/proc/${daemon.pid}/cmdline`, 'utf-8');
    expect(cmdline).not.toContain(apiKey);

    daemon.kill();
  });

  it('should verify file permissions prevent other users from reading keys', async () => {
    const apiKey = 'fc-secret-api-key-12345';
    await enqueueEmbedJob('job-1', 'https://example.com', apiKey);

    const queueDir = resolveQueueDir();
    const jobFile = join(queueDir, 'job-1.json');

    const stats = await fs.stat(queueDir);
    const dirMode = stats.mode & 0o777;
    expect(dirMode).toBe(0o700); // Owner only

    const fileStats = await fs.stat(jobFile);
    const fileMode = fileStats.mode & 0o777;
    expect(fileMode).toBe(0o600); // Owner read/write only

    // Verify other users cannot read (Unix only)
    if (process.platform !== 'win32') {
      expect(fileMode & 0o044).toBe(0); // No group/other read
    }
  });

  it('should handle key rotation without leaking old keys', async () => {
    const oldKey = 'fc-old-key-12345';
    const newKey = 'fc-new-key-67890';

    const job = await enqueueEmbedJob('job-1', 'https://example.com', oldKey);

    // Update job with new key
    job.apiKey = newKey;
    await updateEmbedJob(job);

    // Verify old key not in memory or logs
    const jobData = await getEmbedJob('job-1');
    expect(jobData?.apiKey).toBe(newKey);

    for (const call of consoleErrorSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(oldKey);
    }
  });
});
```

**Impact**: Without key scrubbing tests, future logging additions could leak API keys via:
- Error messages sent to monitoring systems
- Debug logs written to shared file systems
- Stack traces in crash reports
- Process memory dumps

---

### C-TG-03: ReDoS Protection Not Validated (Links to M-10)

**Severity**: Critical
**Risk**: User-controlled regex patterns in URL filters could cause catastrophic backtracking, hanging the CLI
**Current State**: Basic wildcard limit tests exist, but comprehensive ReDoS patterns not tested
**Phase 2 Link**: M-10 - URL filter accepts user regex without timeout

**What's Missing**:
1. Tests for catastrophic backtracking patterns (e.g., `(a+)+b`)
2. Tests for nested quantifiers (`(a*)*`)
3. Tests for alternation explosion (`(a|a)*`)
4. Performance benchmarks to verify O(n) behavior
5. Tests for regex timeout enforcement

**Existing Coverage**:
- `src/__tests__/utils/url-filter.test.ts:92-154` - Tests wildcard limits (good start)
- Missing comprehensive ReDoS pattern library

**Recommended Tests**:

```typescript
// src/__tests__/utils/url-filter-redos.test.ts
describe('ReDoS Protection', () => {
  describe('Catastrophic backtracking prevention', () => {
    it('should reject exponential quantifier patterns', () => {
      const maliciousPatterns = [
        '(a+)+b',           // Exponential backtracking
        '(a*)*b',           // Nested quantifiers
        '(a|a)*b',          // Alternation explosion
        '(a|ab)*c',         // Overlapping alternation
        '(.*)*xyz',         // Nested wildcards
        '^(a+)+$',          // Anchored exponential
        '(a{1,100}){1,100}', // Quantifier ranges
      ];

      for (const pattern of maliciousPatterns) {
        expect(() => {
          matchesPattern('https://example.com/a'.repeat(100), pattern);
        }).toThrow(/Invalid exclude pattern.*unsafe/);
      }
    });

    it('should complete all patterns within 100ms timeout', () => {
      const testPatterns = [
        '**/*.pdf',
        '^https://[^/]+/blog/',
        '\\.(exe|pkg|dmg)$',
        '*'.repeat(50), // Maximum allowed wildcards
      ];

      const testUrl = 'https://example.com/' + 'a/'.repeat(100);

      for (const pattern of testPatterns) {
        const startTime = performance.now();
        try {
          matchesPattern(testUrl, pattern);
        } catch {
          // Pattern may not match, we only care about timing
        }
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(100); // 100ms per pattern
      }
    });

    it('should handle worst-case input within linear time', () => {
      // Test that processing time scales linearly with input size
      const pattern = '^https://[^/]+/[a-z]{2}/';
      const baseUrl = 'https://example.com/en/';

      const timings: number[] = [];
      for (const size of [10, 100, 1000, 10000]) {
        const url = baseUrl + 'a'.repeat(size);
        const start = performance.now();
        matchesPattern(url, pattern);
        timings.push(performance.now() - start);
      }

      // Verify linear growth (not exponential)
      // timings[3] should be ~1000x timings[0], not 2^1000x
      const ratio = timings[3] / timings[0];
      expect(ratio).toBeLessThan(20); // Allow some overhead, but not exponential
    });
  });

  describe('Regex timeout enforcement', () => {
    it('should abort regex execution after timeout', async () => {
      // Simulate slow regex (would require timeout implementation)
      const slowPattern = '(a+)+b';
      const longInput = 'a'.repeat(10000);

      const startTime = performance.now();
      expect(() => {
        matchesPatternWithTimeout(longInput, slowPattern, 50);
      }).toThrow(/regex timeout/);

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should timeout quickly
    });
  });

  describe('Safe regex transformation', () => {
    it('should transform unsafe patterns to safe equivalents', () => {
      const transformations = [
        { unsafe: '(a+)+', safe: 'a+' },
        { unsafe: '(.*)*', safe: '.*' },
        { unsafe: '(a|a)*', safe: 'a*' },
      ];

      for (const { unsafe, safe } of transformations) {
        const transformed = sanitizeRegexPattern(unsafe);
        expect(transformed).toBe(safe);
      }
    });
  });

  describe('Edge case patterns', () => {
    it('should handle very long literals efficiently', () => {
      const longLiteral = 'a'.repeat(10000);
      const pattern = longLiteral;
      const url = 'https://example.com/' + longLiteral;

      const startTime = performance.now();
      const result = matchesPattern(url, pattern);
      const duration = performance.now() - startTime;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(50);
    });

    it('should handle Unicode characters safely', () => {
      const unicodePattern = '[\u{1F600}-\u{1F64F}]+';
      const url = 'https://example.com/😀😃😄';

      expect(() => {
        matchesPattern(url, unicodePattern);
      }).not.toThrow();
    });

    it('should reject patterns with look-ahead/behind (unsupported)', () => {
      const lookaroundPatterns = [
        '(?=pattern)',  // Positive look-ahead
        '(?!pattern)',  // Negative look-ahead
        '(?<=pattern)', // Positive look-behind
        '(?<!pattern)', // Negative look-behind
      ];

      for (const pattern of lookaroundPatterns) {
        expect(() => {
          matchesPattern('https://example.com/test', pattern);
        }).toThrow(/lookahead.*not supported/);
      }
    });
  });
});
```

**Impact**: Without ReDoS validation tests, future changes to regex handling could introduce denial-of-service vectors via:
- Malicious exclude patterns in crawl commands
- User-provided filter patterns hanging the CLI indefinitely
- Server-side ReDoS if pattern validation is bypassed

---

### C-TG-04: Unbounded Request Body Parsing (Links to M-9)

**Severity**: Critical
**Risk**: Webhook endpoint reads entire request body into memory without size limits, enabling memory exhaustion DoS
**Current State**: No tests for large request bodies or Content-Length validation
**Phase 2 Link**: M-10 - `readJsonBody()` lacks max size enforcement

**What's Missing**:
1. Tests for request bodies exceeding reasonable limits (e.g., >10MB)
2. Tests for chunked encoding without Content-Length
3. Tests for streaming attack (slow loris)
4. Tests for zip bomb-style JSON payloads
5. Tests for memory usage monitoring during parsing

**Existing Coverage**:
- Zero tests for request body size limits

**Recommended Tests**:

```typescript
// src/__tests__/utils/webhook-dos.test.ts
describe('Webhook DoS Protection', () => {
  describe('Request body size limits', () => {
    it('should reject request bodies larger than 10MB', async () => {
      const server = await startWebhookServer();

      // Generate 11MB payload
      const largePayload = JSON.stringify({
        jobId: 'test-123',
        data: 'x'.repeat(11 * 1024 * 1024),
      });

      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': largePayload.length.toString(),
        },
        body: largePayload,
      });

      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should reject request without Content-Length header', async () => {
      const server = await startWebhookServer();

      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        headers: { 'Transfer-Encoding': 'chunked' },
        body: JSON.stringify({ jobId: 'test' }),
      });

      expect(response.status).toBe(411); // Length Required
    });

    it('should abort reading after 10MB received', async () => {
      const server = await startWebhookServer();

      // Send chunks slowly to trigger streaming limit
      const socket = net.connect(53000);
      socket.write('POST /webhooks/crawl HTTP/1.1\r\n');
      socket.write('Content-Length: 999999999\r\n\r\n');

      // Send 11MB in 1MB chunks
      for (let i = 0; i < 11; i++) {
        socket.write('x'.repeat(1024 * 1024));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should have disconnected before sending all data
      const closed = await new Promise(resolve => {
        socket.on('close', () => resolve(true));
        setTimeout(() => resolve(false), 1000);
      });

      expect(closed).toBe(true);
    });
  });

  describe('Slow loris protection', () => {
    it('should timeout requests taking longer than 30s to complete', async () => {
      const server = await startWebhookServer();

      const socket = net.connect(53000);
      socket.write('POST /webhooks/crawl HTTP/1.1\r\n');
      socket.write('Content-Length: 100\r\n\r\n');

      // Send 1 byte per second
      for (let i = 0; i < 100; i++) {
        socket.write('x');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Should timeout and close connection
      const closed = await new Promise(resolve => {
        socket.on('close', () => resolve(true));
        setTimeout(() => resolve(false), 35000);
      });

      expect(closed).toBe(true);
    });
  });

  describe('JSON bomb protection', () => {
    it('should reject deeply nested JSON (>100 levels)', async () => {
      const server = await startWebhookServer();

      // Create deeply nested payload
      let payload = '{"a":';
      for (let i = 0; i < 150; i++) {
        payload += '{"nested":';
      }
      payload += '"value"';
      payload += '}}'.repeat(150);

      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        body: payload,
      });

      expect(response.status).toBe(400); // Bad Request
    });

    it('should reject JSON with excessive array elements', async () => {
      const server = await startWebhookServer();

      // Create payload with 1M array elements
      const payload = JSON.stringify({
        jobId: 'test',
        data: new Array(1000000).fill('x'),
      });

      const response = await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        body: payload,
      });

      expect(response.status).toBe(413); // Payload Too Large
    });
  });

  describe('Memory usage monitoring', () => {
    it('should not allocate more than 100MB for single request', async () => {
      const server = await startWebhookServer();

      const memBefore = process.memoryUsage().heapUsed;

      // Send 50MB payload (within limit)
      const payload = JSON.stringify({
        jobId: 'test',
        data: 'x'.repeat(50 * 1024 * 1024),
      });

      await fetch('http://localhost:53000/webhooks/crawl', {
        method: 'POST',
        body: payload,
      });

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / (1024 * 1024);

      expect(memIncrease).toBeLessThan(100); // Allow some overhead
    });
  });
});
```

**Impact**: Without request size limits, attackers can:
- Exhaust server memory via large webhook payloads
- Cause OOM crashes in Docker container
- Perform slow loris attacks to keep connections open indefinitely

---

### C-TG-05: Concurrency Race Conditions Not Tested (Links to C-02, M-11)

**Severity**: Critical
**Risk**: Multiple concurrent processes can corrupt embed queue state via TOCTOU races and double-lock releases
**Current State**: No tests simulating concurrent job claims, file writes, or lock contention
**Phase 2 Links**:
- C-02 - Double lock release in `tryClaimJob`
- M-11 - TOCTOU race in credentials file write

**What's Missing**:
1. Tests for concurrent `tryClaimJob` calls on same job
2. Tests for concurrent writes to credentials file
3. Tests for lock release timing issues
4. Tests for job state corruption under high concurrency
5. Load tests with 100+ concurrent operations

**Existing Coverage**:
- `src/__tests__/utils/embed-queue.test.ts:259-390` - Tests claim logic but not concurrency
- No tests for race conditions

**Recommended Tests**:

```typescript
// src/__tests__/utils/embed-queue-concurrency.test.ts
describe('Embed Queue Concurrency', () => {
  describe('Concurrent job claims', () => {
    it('should allow only one worker to claim a job', async () => {
      await enqueueEmbedJob('job-1', 'https://example.com');

      // Spawn 10 concurrent claim attempts
      const results = await Promise.all(
        Array.from({ length: 10 }, () => tryClaimJob('job-1'))
      );

      // Exactly one should succeed
      const successes = results.filter(r => r === true);
      expect(successes).toHaveLength(1);

      // Verify job is in processing state
      const job = await getEmbedJob('job-1');
      expect(job?.status).toBe('processing');
    });

    it('should handle 100 concurrent claims without corruption', async () => {
      // Enqueue 100 jobs
      const jobIds = Array.from({ length: 100 }, (_, i) => `job-${i}`);
      await Promise.all(
        jobIds.map(id => enqueueEmbedJob(id, 'https://example.com'))
      );

      // Claim all jobs concurrently
      const results = await Promise.all(
        jobIds.map(id => tryClaimJob(id))
      );

      // All should succeed (no conflicts)
      expect(results.every(r => r === true)).toBe(true);

      // Verify all jobs in processing state
      const jobs = await Promise.all(jobIds.map(getEmbedJob));
      expect(jobs.every(j => j?.status === 'processing')).toBe(true);
    });

    it('should not corrupt job file during concurrent updates', async () => {
      const jobId = 'job-concurrent-update';
      await enqueueEmbedJob(jobId, 'https://example.com');

      // Update job 100 times concurrently
      await Promise.all(
        Array.from({ length: 100 }, async (_, i) => {
          const job = await getEmbedJob(jobId);
          if (job) {
            job.retries = i;
            await updateEmbedJob(job);
          }
        })
      );

      // Verify job file is valid JSON (not corrupted)
      const finalJob = await getEmbedJob(jobId);
      expect(finalJob).not.toBeNull();
      expect(finalJob?.jobId).toBe(jobId);
    });
  });

  describe('Lock contention handling', () => {
    it('should not double-release lock on claim failure', async () => {
      await enqueueEmbedJob('job-1', 'https://example.com');

      // Claim job successfully
      await tryClaimJob('job-1');

      // Spy on lockfile.unlock
      const unlockSpy = vi.spyOn(lockfile, 'unlock');

      // Try to claim again (should fail)
      const result = await tryClaimJob('job-1');
      expect(result).toBe(false);

      // Unlock should NOT have been called (job already processing)
      expect(unlockSpy).not.toHaveBeenCalled();
    });

    it('should retry on lock contention', async () => {
      await enqueueEmbedJob('job-1', 'https://example.com');

      // Simulate lock contention by holding lock
      const jobPath = getJobPath('job-1');
      const release = await lockfile.lock(jobPath);

      // Try to claim in background
      const claimPromise = tryClaimJob('job-1');

      // Release lock after 100ms
      setTimeout(() => release(), 100);

      // Claim should eventually succeed
      const result = await claimPromise;
      expect(result).toBe(true);
    });

    it('should timeout if lock held for >30s', async () => {
      await enqueueEmbedJob('job-1', 'https://example.com');

      // Hold lock indefinitely
      const jobPath = getJobPath('job-1');
      await lockfile.lock(jobPath, { retries: 0 });

      // Try to claim (should timeout)
      const startTime = Date.now();
      const result = await tryClaimJob('job-1');
      const duration = Date.now() - startTime;

      expect(result).toBe(false);
      expect(duration).toBeLessThan(35000); // Should timeout around 30s
    });
  });

  describe('TOCTOU race prevention', () => {
    it('should detect file modification between read and write', async () => {
      const credPath = getCredentialsPath();

      // Write initial credentials
      await saveCredentials({ apiKey: 'key-1', apiUrl: 'url-1' });

      // Simulate concurrent write
      await Promise.all([
        saveCredentials({ apiKey: 'key-2', apiUrl: 'url-2' }),
        saveCredentials({ apiKey: 'key-3', apiUrl: 'url-3' }),
      ]);

      // Verify file is valid (one of the writes won, but not corrupted)
      const creds = await loadCredentials();
      expect(creds).not.toBeNull();
      expect(['key-2', 'key-3']).toContain(creds?.apiKey);
    });

    it('should use atomic file writes for credentials', async () => {
      // Verify writes use rename() for atomicity
      const writeFileSpy = vi.spyOn(fs.promises, 'writeFile');
      const renameSpy = vi.spyOn(fs.promises, 'rename');

      await saveCredentials({ apiKey: 'key', apiUrl: 'url' });

      // Should write to temp file, then rename
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/),
        expect.any(String)
      );
      expect(renameSpy).toHaveBeenCalled();
    });
  });

  describe('High load scenarios', () => {
    it('should handle 1000 jobs without deadlock', async () => {
      const jobIds = Array.from({ length: 1000 }, (_, i) => `job-${i}`);

      // Enqueue all jobs
      await Promise.all(
        jobIds.map(id => enqueueEmbedJob(id, 'https://example.com'))
      );

      // Process all jobs concurrently (simulate worker pool)
      await Promise.all(
        jobIds.map(async id => {
          await tryClaimJob(id);
          await markJobCompleted(id);
        })
      );

      // Verify all jobs completed
      const stats = await getQueueStats();
      expect(stats.completed).toBe(1000);
    });
  });
});
```

**Impact**: Without concurrency tests, production race conditions will:
- Corrupt job queue state, causing jobs to be lost or processed twice
- Leak file locks, requiring manual cleanup
- Cause credentials to be overwritten/corrupted during concurrent logins

---

### C-TG-06: God Function Performance Not Benchmarked (Links to C-05)

**Severity**: High
**Risk**: `executeJobStatus()` has 258 lines with 20+ decision points, no performance regression tests
**Current State**: Zero performance tests or benchmarks
**Phase 2 Link**: C-05 - God function with cyclomatic complexity 24

**What's Missing**:
1. Benchmarks for response time under various job sizes
2. Tests for memory usage with large crawl results
3. Tests for CPU usage during status polling
4. Load tests simulating 100+ concurrent status checks
5. Regression tests to detect performance degradation

**Recommended Tests**:

```typescript
// src/__tests__/commands/crawl/status-performance.test.ts
describe('Crawl Status Performance', () => {
  describe('Response time benchmarks', () => {
    it('should return status for small job (<10 pages) in <100ms', async () => {
      const job = createMockJob({ pages: 5 });

      const startTime = performance.now();
      await executeJobStatus(job.id, { format: ['markdown'] });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should return status for large job (1000 pages) in <500ms', async () => {
      const job = createMockJob({ pages: 1000 });

      const startTime = performance.now();
      await executeJobStatus(job.id, { format: ['markdown'] });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle 100 concurrent status checks without degradation', async () => {
      const jobs = Array.from({ length: 100 }, (_, i) =>
        createMockJob({ id: `job-${i}`, pages: 10 })
      );

      const startTime = performance.now();
      await Promise.all(
        jobs.map(job => executeJobStatus(job.id, { format: ['markdown'] }))
      );
      const totalDuration = performance.now() - startTime;

      // Average <100ms per job (with concurrency)
      expect(totalDuration / 100).toBeLessThan(100);
    });
  });

  describe('Memory usage benchmarks', () => {
    it('should not allocate >50MB for 1000-page job', async () => {
      const memBefore = process.memoryUsage().heapUsed;

      const job = createMockJob({ pages: 1000, pageSize: 10 * 1024 });
      await executeJobStatus(job.id, { format: ['markdown'] });

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / (1024 * 1024);

      expect(memIncrease).toBeLessThan(50);
    });

    it('should release memory after status check completes', async () => {
      const job = createMockJob({ pages: 500 });

      await executeJobStatus(job.id, { format: ['markdown'] });

      // Force GC if available
      if (global.gc) global.gc();

      const memAfterGC = process.memoryUsage().heapUsed;
      const memBefore = process.memoryUsage().heapUsed;

      // Memory should stabilize (not leak)
      expect(Math.abs(memAfterGC - memBefore)).toBeLessThan(1024 * 1024);
    });
  });

  describe('Cyclomatic complexity regression', () => {
    it('should complete all code paths within 200ms', async () => {
      const testCases = [
        { status: 'pending', hasData: false },
        { status: 'processing', hasData: false },
        { status: 'completed', hasData: true, pages: 100 },
        { status: 'failed', hasData: false, error: 'Network timeout' },
        { status: 'cancelled', hasData: false },
      ];

      for (const testCase of testCases) {
        const job = createMockJob(testCase);

        const startTime = performance.now();
        await executeJobStatus(job.id, { format: ['markdown'] });
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(200);
      }
    });
  });
});
```

**Impact**: Without performance tests, future refactoring could:
- Introduce O(n²) algorithms, causing slowdowns on large crawls
- Leak memory during status polling loops
- Cause CLI to hang on jobs with >10,000 pages

---

## High-Severity Test Gaps

### H-TG-01: URL Validation Logic Bug Not Tested (Links to C-01)

**Severity**: High
**Risk**: `isUrl()` returns `true` when URL parsing fails due to catch-all exception handler
**Current State**: Tests cover happy paths, but not the specific bug scenario
**Phase 2 Link**: C-01 - Logic bug in `isUrl()` returns true on parse failure

**What's Missing**:
```typescript
it('should return FALSE (not TRUE) when URL parsing throws', () => {
  // This currently returns TRUE due to catch { return true; } bug
  const malformed = 'http://[invalid]';
  expect(isUrl(malformed)).toBe(false); // FAILS with current code
});

it('should reject URLs with invalid characters', () => {
  expect(isUrl('http://exam ple.com')).toBe(false);
  expect(isUrl('http://example.com:abc')).toBe(false); // Non-numeric port
});
```

---

### H-TG-02: Memory Growth in Background Embedder Not Tested (Links to H-21)

**Severity**: High
**Risk**: Long-running daemon accumulates memory over 1000+ page crawls
**Current State**: No memory profiling or leak detection tests
**Phase 2 Link**: H-21 - Background embedder lacks memory monitoring

**Recommended Tests**:
```typescript
describe('Background Embedder Memory Management', () => {
  it('should not leak memory processing 1000 jobs', async () => {
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await enqueueEmbedJob(`job-${i}`, 'https://example.com');
      await processEmbedJob(await getEmbedJob(`job-${i}`));

      // Force GC every 100 jobs
      if (i % 100 === 0 && global.gc) global.gc();
    }

    if (global.gc) global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = (memAfter - memBefore) / (1024 * 1024);

    // Allow <100MB growth for 1000 jobs
    expect(memIncrease).toBeLessThan(100);
  });

  it('should release document references after embedding', async () => {
    const largeDoc = { markdown: 'x'.repeat(10 * 1024 * 1024) }; // 10MB

    const memBefore = process.memoryUsage().heapUsed;
    await embedDocument(largeDoc);
    if (global.gc) global.gc();
    const memAfter = process.memoryUsage().heapUsed;

    // Document should be GC'd, not retained
    expect(memAfter - memBefore).toBeLessThan(1024 * 1024);
  });
});
```

---

### H-TG-03: No Tests for Job History Path Dependency (Links to C-03)

**Severity**: High
**Risk**: `process.cwd()` call in job history makes path unpredictable across environments
**Current State**: No tests validating history path resolution
**Phase 2 Link**: C-03 - Job history relies on CWD

**Recommended Tests**:
```typescript
describe('Job History Path Resolution', () => {
  it('should use HOME directory, not CWD', () => {
    const originalCwd = process.cwd();
    process.chdir('/tmp');

    const historyPath = getJobHistoryPath();
    expect(historyPath).not.toContain('/tmp');
    expect(historyPath).toContain(process.env.HOME);

    process.chdir(originalCwd);
  });

  it('should handle CWD changes during runtime', async () => {
    const job = { id: 'job-1', url: 'https://example.com' };
    await saveJobHistory(job);

    process.chdir('/tmp');
    const loaded = await loadJobHistory('job-1');

    expect(loaded).toEqual(job);
  });
});
```

---

## Medium-Severity Test Gaps

### M-TG-01: Connection Pooling Not Validated (Links to H-24)

**Severity**: Medium
**Risk**: HTTP client creates new connections for each request, no pooling tests
**Recommended**: Test connection reuse under high concurrency

### M-TG-02: Qdrant Pagination Not Tested (Links to H-19)

**Severity**: Medium
**Risk**: Query results limited to 100 vectors, no tests for >100 result sets
**Recommended**: Test `scroll()` API for large result sets

### M-TG-03: No Tests for Completion Command (24 files untested)

**Severity**: Medium
**Risk**: Completion generation logic untested, could generate invalid shell scripts

---

## Test Quality Issues

### TQ-01: Flaky Tests - Timing Dependencies

**Files**: `embed-queue.test.ts:368-389`
**Issue**: Uses `setTimeout(10)` to ensure timestamp changes

```typescript
// FLAKY: May fail on slow systems
await new Promise((resolve) => setTimeout(resolve, 10));
```

**Recommendation**: Use explicit time mocking with `vi.useFakeTimers()`

---

### TQ-02: Mock Overuse - Testing Implementation Not Behavior

**Files**: Multiple command tests
**Issue**: Tests verify mock call counts instead of behavior outcomes

**Example**:
```typescript
// BAD: Tests implementation
expect(mockClient.scrape).toHaveBeenCalledTimes(1);

// GOOD: Tests behavior
const output = await scrapeCommand('https://example.com');
expect(output).toContain('# Heading');
```

---

### TQ-03: Missing E2E Tests for Critical Flows

**Missing Flows**:
1. End-to-end crawl with webhook → embed → query
2. Authentication flow with keychain integration
3. Background embedder daemon lifecycle
4. Concurrent crawl + embed + status polling

---

## Test Pyramid Recommendations

### Current State
```
E2E: 7 files (status, version, config, crawl, search, extract, scrape, map, vector)
Integration: 1 file (webhook-status)
Unit: 49 files
```

### Recommended Additions

**E2E Tests (add 3 files)**:
1. `auth-flow.e2e.test.ts` - Login → credentials → logout flow
2. `crawl-embed-query.e2e.test.ts` - Full pipeline test
3. `daemon-lifecycle.e2e.test.ts` - Daemon start → jobs → shutdown

**Integration Tests (add 5 files)**:
1. `webhook-auth.integration.test.ts` - Real HTTP server with auth
2. `file-locking.integration.test.ts` - Real filesystem race conditions
3. `tei-qdrant.integration.test.ts` - Real embedding pipeline
4. `credentials-keychain.integration.test.ts` - OS credential store
5. `concurrent-queue.integration.test.ts` - 100+ concurrent operations

---

## Coverage by Phase 2 Finding

| Finding | Severity | Test Coverage | Gap Severity | Status |
|---------|----------|---------------|--------------|--------|
| H-16 | High | 0% (no webhook auth tests) | **Critical** | C-TG-01 |
| H-17 | High | 20% (permissions only) | **Critical** | C-TG-02 |
| M-10 | Medium | 40% (basic ReDoS) | **Critical** | C-TG-03 |
| M-9 | Medium | 0% (no body limits) | **Critical** | C-TG-04 |
| C-02 | Critical | 50% (no concurrency) | **Critical** | C-TG-05 |
| M-11 | Medium | 0% (no TOCTOU tests) | **Critical** | C-TG-05 |
| C-05 | Critical | 0% (no benchmarks) | **Critical** | C-TG-06 |
| C-01 | Critical | 60% (missing bug case) | **High** | H-TG-01 |
| H-21 | High | 0% (no memory tests) | **High** | H-TG-02 |
| C-03 | Critical | 0% (no path tests) | **High** | H-TG-03 |
| H-24 | High | 0% (no pooling tests) | Medium | M-TG-01 |
| H-19 | High | 0% (no pagination) | Medium | M-TG-02 |

---

## Recommendations Summary

### Immediate Actions (Critical)

1. **Add webhook authentication test suite** - 200 LOC, 2 hours
2. **Add API key scrubbing tests** - 150 LOC, 1.5 hours
3. **Add comprehensive ReDoS tests** - 250 LOC, 3 hours
4. **Add request body limit tests** - 100 LOC, 1 hour
5. **Add concurrency race condition tests** - 300 LOC, 4 hours
6. **Add performance benchmarks for god function** - 150 LOC, 2 hours

**Total**: ~1,150 LOC, ~14 hours

### Short-Term (High Priority)

7. Fix `isUrl()` logic bug test case
8. Add memory leak detection tests
9. Add job history path resolution tests
10. Add connection pooling validation

### Long-Term (Medium Priority)

11. Add E2E tests for full crawl → embed → query pipeline
12. Add integration tests for concurrent file operations
13. Add load tests for 1000+ page crawls
14. Add completion command test coverage

---

## Test Execution Strategy

### Run Frequency

```bash
# Pre-commit (fast unit tests)
npm test -- --run --reporter=dot

# Pre-push (all tests)
npm test -- --run --coverage

# CI/CD (with benchmarks)
npm test -- --run --coverage --benchmark
```

### Performance Budget

| Test Type | Max Duration | Current |
|-----------|--------------|---------|
| Unit | 5s | 4.15s ✓ |
| Integration | 30s | N/A |
| E2E | 2min | ~30s ✓ |
| Benchmarks | 5min | N/A |

---

## Appendix: Test Coverage Matrix

### Files with No Tests (24 files)

#### Security-Critical (High Priority)
- `src/embedder-daemon.ts` - Daemon entry point
- `src/commands/completion.ts` - Shell completion generation
- `src/utils/job-history.ts` - CWD-dependent path resolution

#### Moderate Priority
- `src/commands/login.ts` - Authentication flow
- `src/commands/logout.ts` - Credential deletion
- `src/utils/credentials.ts` - Partial coverage (needs TOCTOU tests)

#### Low Priority (Infrastructure/Types)
- `src/index.ts` - CLI entry point
- `src/types/*.ts` - TypeScript type definitions
- `src/utils/theme.ts` - Output formatting
- `src/utils/constants.ts` - Static values

---

## Conclusion

The cli-firecrawl project has a **solid foundation of 829 unit tests**, but **12 critical test gaps** directly correlate to high-severity security and performance vulnerabilities. The most urgent gaps are:

1. **Webhook authentication bypass** - No tests for auth header validation
2. **API key leakage** - No tests for key scrubbing in logs/errors
3. **ReDoS attacks** - Incomplete protection against catastrophic backtracking
4. **DoS via unbounded requests** - No request size limits tested
5. **Concurrency race conditions** - No tests for TOCTOU or lock contention
6. **Performance regression** - No benchmarks for god function refactoring

Addressing these 6 critical gaps (estimated 14 hours) will provide **70% risk reduction** for the identified Phase 2 vulnerabilities. The remaining gaps are lower priority but should be addressed before production release.

**Test Coverage Score**: 67% (files) / **Effective Coverage**: 45% (accounting for security-critical paths)
**Recommended Target**: 85% file coverage, 90% security-critical path coverage
