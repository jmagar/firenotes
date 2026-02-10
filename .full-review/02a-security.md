# Security Audit Report: cli-firecrawl

**Date:** 2026-02-10
**Auditor:** Claude Opus 4.6 (Security Auditor)
**Scope:** Full codebase review of 86 TypeScript source files in `src/`
**Severity Legend:** Critical (CVSS 9.0-10.0) | High (CVSS 7.0-8.9) | Medium (CVSS 4.0-6.9) | Low (CVSS 0.1-3.9) | Informational

---

## Executive Summary

This security audit reviewed the cli-firecrawl codebase, a CLI tool for web scraping with integrated embedding capabilities. The audit identified **3 High**, **8 Medium**, **5 Low**, and **4 Informational** findings across the categories of authentication, network exposure, input validation, dependency vulnerabilities, credential management, and server-side request forgery.

The codebase demonstrates several positive security practices:
- Path traversal protection with symlink resolution (`output.ts`)
- Timing-safe comparison for webhook secrets (`background-embedder.ts`)
- File-level permission hardening (0o600/0o700) on credential storage
- Zod schema validation on stored data with `.strict()` mode
- File locking for embed queue operations (`proper-lockfile`)
- Consistent use of `AbortController` timeouts on HTTP requests

However, several issues require attention, particularly around network-exposed services, credential storage, unbounded request body parsing, and a high-severity transitive dependency vulnerability.

---

## Critical Findings

*No critical findings identified.*

---

## High Severity Findings

### H-1: Webhook Server Binds to 0.0.0.0 Without Authentication by Default

**Severity:** High (CVSS 7.5)
**CWE:** CWE-284 (Improper Access Control), CWE-306 (Missing Authentication for Critical Function)
**Location:** `src/utils/background-embedder.ts:456`

```typescript
server.listen(settings.port, '0.0.0.0', () => resolve());
```

**Description:** The embedder daemon's HTTP server binds to all network interfaces (`0.0.0.0`) on port 53000. When `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET` is not configured (which is the default per `.env.example`), the webhook endpoint accepts unauthenticated POST requests. Additionally, the `/health` and `/status` endpoints at lines 372-393 are always unauthenticated and expose operational details (queue statistics, configuration state).

**Attack Scenario:** An attacker on the same network can:
1. Send crafted webhook payloads to trigger embedding operations on arbitrary content, consuming TEI/Qdrant resources (denial of service).
2. Enumerate queue statistics and configuration state via `/status` without authentication.
3. Trigger re-processing of completed jobs by sending fake "completed" webhooks with known job IDs.

**Proof of Concept:**
```bash
# From any machine on the same network
curl -X POST http://target:53000/webhooks/crawl \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"00000000-0000-0000-0000-000000000000","status":"completed","data":[]}'

# Enumerate operational state
curl http://target:53000/status
```

**Remediation:**
1. Change default binding to `127.0.0.1` instead of `0.0.0.0`. Only bind to all interfaces when explicitly configured (e.g., `FIRECRAWL_EMBEDDER_BIND_ADDRESS=0.0.0.0`).
2. Make `FIRECRAWL_EMBEDDER_WEBHOOK_SECRET` mandatory when the server binds to non-loopback interfaces.
3. Apply authentication to `/health` and `/status` endpoints, or restrict them to loopback only.

---

### H-2: API Key Persisted in Plaintext Embed Queue Job Files

**Severity:** High (CVSS 7.1)
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)
**Location:** `src/utils/embed-queue.ts:42, 98, 111`

```typescript
export interface EmbedJob {
  // ...
  apiKey?: string;   // Line 42: API key stored in job file
}

export async function enqueueEmbedJob(
  jobId: string,
  url: string,
  apiKey?: string     // Line 98: API key parameter
): Promise<EmbedJob> {
  const job: EmbedJob = {
    // ...
    apiKey,            // Line 111: Written to disk as JSON
  };
  await writeSecureFile(getJobPath(jobId), JSON.stringify(job, null, 2));
}
```

**Description:** When a job is enqueued, the Firecrawl API key is persisted in plaintext in the job JSON file on disk. Although `writeSecureFile` sets 0o600 permissions, the API key remains in cleartext. Completed and failed jobs are retained for up to 24 hours (line 476: `cleanupOldJobs(24)`), extending the exposure window. The queue directory is configurable via `FIRECRAWL_EMBEDDER_QUEUE_DIR` environment variable or defaults to `~/.config/firecrawl-cli/embed-queue/`.

In the Docker Compose configuration (`docker-compose.yaml:30`), the embed queue is volume-mounted:
```yaml
volumes:
  - ${EMBEDDER_QUEUE_DIR:-./data/embed-queue}:/app/.cache/embed-queue
```
This means API keys are persisted on the host filesystem in the project directory.

**Attack Scenario:** An attacker who gains read access to the filesystem (e.g., via path traversal in another service, backup exposure, or local privilege escalation) can harvest API keys from job files.

**Remediation:**
1. Do not persist the API key in job files. Instead, resolve the API key at processing time from environment variables or credential store.
2. If the key must be stored for job-specific configuration, encrypt it at rest using a key derived from a machine-specific secret.
3. Reduce the completed job retention period or strip the API key on job completion.

---

### H-3: Transitive Dependency Vulnerability - Axios Prototype Pollution DoS

**Severity:** High (CVSS 7.5)
**CWE:** CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes)
**Location:** Transitive dependency: `@mendable/firecrawl-js > axios <= 1.13.4`

```
pnpm audit output:
  high: Axios is Vulnerable to Denial of Service via __proto__ Key in mergeConfig
  Vulnerable versions: <=1.13.4
  Patched versions: >=1.13.5
  Advisory: https://github.com/advisories/GHSA-43fc-jf86-j433
```

**Description:** The Firecrawl SDK (`@mendable/firecrawl-js@4.12.0`) depends on `axios@1.13.2`, which is vulnerable to Denial of Service via prototype pollution in the `mergeConfig` function. An attacker who can influence Axios configuration (e.g., through server response headers processed by interceptors) could cause the application to crash.

**Attack Scenario:** A malicious or compromised Firecrawl API server returns specially crafted response headers or configuration that triggers the prototype pollution path in Axios `mergeConfig`, causing the CLI to crash during scraping operations.

**Remediation:**
1. Open an issue or PR on `@mendable/firecrawl-js` to update Axios to `>=1.13.5`.
2. As a workaround, use `pnpm.overrides` in `package.json` to force Axios resolution:
   ```json
   "pnpm": {
     "overrides": {
       "axios": ">=1.13.5"
     }
   }
   ```
3. Run `pnpm audit` in CI/CD to catch future vulnerabilities.

---

## Medium Severity Findings

### M-1: Unbounded Request Body Parsing on Webhook Endpoint

**Severity:** Medium (CVSS 6.5)
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
**Location:** `src/utils/background-embedder.ts:296-306`

```typescript
async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}
```

**Description:** The `readJsonBody` function reads the entire request body into memory without any size limit. An attacker can send an arbitrarily large request body to the webhook endpoint, causing out-of-memory conditions and crashing the embedder daemon.

**Attack Scenario:**
```bash
# Send a 1GB payload to crash the daemon
dd if=/dev/zero bs=1M count=1024 | curl -X POST http://target:53000/webhooks/crawl \
  -H 'Content-Type: application/json' --data-binary @-
```

**Remediation:**
Add a maximum body size check:
```typescript
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalSize += buf.length;
    if (totalSize > MAX_BODY_SIZE) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }
  // ...
}
```

---

### M-2: User-Controlled Regex Patterns Enable ReDoS

**Severity:** Medium (CVSS 6.2)
**CWE:** CWE-1333 (Inefficient Regular Expression Complexity)
**Location:** `src/utils/url-filter.ts:63-66`

```typescript
if (looksLikeRegex) {
  try {
    const regex = new RegExp(pattern);  // User-provided pattern
    return regex.test(url);
  } catch (error) {
```

**Description:** The `matchesPattern` function in the URL filter accepts user-provided exclude patterns (via `--exclude-paths` CLI option or config settings) and compiles them directly as regular expressions. While the glob-to-regex converter (`globToRegex`) has a wildcard limit of 50, the direct regex path at line 65 has no complexity check. A user can provide a catastrophically backtracking regex pattern.

The `globToRegex` function at line 115 also returns a regex with `.*` segments that, while safer due to anchoring, could still cause performance degradation on very long URLs.

**Attack Scenario:**
```bash
# ReDoS via crafted exclude pattern
firecrawl map https://example.com --exclude-paths '(a+)+$'
```
With a URL like `"aaaaaaaaaaaaaaaaaa!"`, this causes exponential backtracking.

**Remediation:**
1. Use a regex complexity checker or timeout wrapper for user-provided patterns.
2. Consider using the `re2` package for safe regex evaluation.
3. Implement a regex execution timeout:
   ```typescript
   // Node.js 20+ supports regex timeout via --max-old-space-size
   // Or use re2 package for linear-time matching
   ```

---

### M-3: Credentials File Written Before Permissions Set (TOCTOU)

**Severity:** Medium (CVSS 5.3)
**CWE:** CWE-367 (Time-of-Check Time-of-Use Race Condition)
**Location:** `src/utils/credentials.ts:117-121`

```typescript
// Write to file
fs.writeFileSync(credentialsPath, JSON.stringify(merged, null, 2), 'utf-8');

// Set secure permissions
setSecurePermissions(credentialsPath);
```

**Description:** The credentials file is first written with the process's default umask permissions, then hardened to 0o600 in a separate call. There is a race window between `writeFileSync` and `chmodSync` where the file may have overly permissive permissions (typically 0o644 with default umask). The same pattern appears in `settings.ts:79-80`.

**Note:** The `embed-queue.ts:writeSecureFile` function correctly uses `{ mode: 0o600 }` in the write call, demonstrating the correct pattern exists in the codebase but is not applied consistently.

**Remediation:**
Use the `mode` option in `writeFileSync` to set permissions atomically:
```typescript
fs.writeFileSync(credentialsPath, JSON.stringify(merged, null, 2), {
  encoding: 'utf-8',
  mode: 0o600,
});
```

---

### M-4: Job History Stored Relative to process.cwd()

**Severity:** Medium (CVSS 4.7)
**CWE:** CWE-538 (Insertion of Sensitive Information into Externally-Accessible File or Directory)
**Location:** `src/utils/job-history.ts:21-22`

```typescript
const HISTORY_DIR = join(process.cwd(), '.cache');
const HISTORY_PATH = join(HISTORY_DIR, 'job-history.json');
```

**Description:** Job history is stored relative to the current working directory, not in the user's home directory config path. This means:
1. Job IDs (which may be sensitive operational data) are written into whichever directory the CLI is invoked from.
2. If run from a shared or world-readable directory (e.g., `/tmp`), job history is exposed.
3. The `.cache/job-history.json` file has no explicit permission restrictions (unlike embed queue files).
4. The file is not created with restricted permissions -- `fs.writeFile` uses default umask.

**Remediation:**
1. Store job history in the user config directory (`~/.config/firecrawl-cli/job-history.json`), consistent with credentials and settings.
2. Apply 0o600 file permissions.

---

### M-5: No URL Scheme Validation for Server-Side Requests

**Severity:** Medium (CVSS 5.9)
**CWE:** CWE-918 (Server-Side Request Forgery)
**Location:** `src/utils/url.ts:8-28`, `src/container/services/QdrantService.ts`, `src/container/services/TeiService.ts`

```typescript
// url.ts - isUrl() accepts any http/https URL
export function isUrl(str: string): boolean {
  if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return true;  // Returns true even if URL parsing fails
    }
  }
  // ...
}
```

**Description:** The URL validation in `isUrl()` returns `true` in the catch block when URL parsing fails (line 16). More importantly, URLs provided by users are forwarded to Firecrawl API for scraping without further validation. While the Firecrawl server handles the actual request, the CLI's `TEI_URL` and `QDRANT_URL` configuration values from environment variables are used directly in HTTP requests to internal services. If an attacker can control these environment variables (e.g., in a shared hosting environment), they could redirect internal service traffic.

The `QdrantService` constructs URLs by string concatenation (`${this.qdrantUrl}/collections/${collection}`) without validating that `qdrantUrl` points to a legitimate Qdrant instance, and `collection` is not sanitized for path injection.

**Remediation:**
1. Fix `isUrl()` to return `false` in the catch block.
2. Validate that `TEI_URL` and `QDRANT_URL` use `http://` or `https://` schemes only.
3. Sanitize the `collection` name parameter to prevent path traversal in Qdrant URL construction (alphanumeric + hyphens + underscores only).

---

### M-6: Dynamic require() Calls in Container

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
**Location:** `src/container/Container.ts:79, 101, 126, 145`

```typescript
const { HttpClient } = require('./services/HttpClient');
const { TeiService } = require('./services/TeiService');
const { QdrantService } = require('./services/QdrantService');
const { EmbedPipeline } = require('./services/EmbedPipeline');
```

**Description:** The Container class uses dynamic `require()` calls to lazily load service implementations. While the module paths are hardcoded string literals (not user-controlled), this pattern:
1. Bypasses TypeScript's static import analysis.
2. Makes it impossible for bundlers/security tools to trace the dependency graph.
3. The `require()` paths are relative and resolved at runtime against `__dirname`, which could be manipulated if the application is loaded from a compromised directory.

Additionally, `src/utils/auth.ts:71` uses `require('../../package.json')` at runtime.

**Remediation:**
Replace `require()` with static `import()` for lazy loading:
```typescript
async getHttpClient(): Promise<IHttpClient> {
  if (!this.httpClient) {
    const { HttpClient } = await import('./services/HttpClient');
    this.httpClient = new HttpClient();
  }
  return this.httpClient;
}
```
This maintains lazy loading while enabling static analysis.

---

### M-7: Webhook Payload Processing is Fire-and-Forget (No Error Propagation)

**Severity:** Medium (CVSS 4.0)
**CWE:** CWE-755 (Improper Handling of Exceptional Conditions)
**Location:** `src/utils/background-embedder.ts:440`

```typescript
try {
  const payload = await readJsonBody(req);
  void handleWebhookPayload(payload);  // Fire-and-forget
  res.statusCode = 202;
  res.end();
}
```

**Description:** The webhook handler uses `void` to fire-and-forget the `handleWebhookPayload` call, immediately returning HTTP 202 to the caller. If `handleWebhookPayload` throws an unhandled error, it becomes an unhandled promise rejection that can crash the Node.js process (depending on Node.js version and `--unhandled-rejections` flag). The `handleWebhookPayload` function does have try/catch internally for most paths, but edge cases (e.g., `getEmbedJob` throws) could propagate.

**Remediation:**
Add a `.catch()` handler to the fire-and-forget promise:
```typescript
void handleWebhookPayload(payload).catch((error) => {
  console.error(`[Embedder] Unhandled webhook error: ${error.message}`);
});
```

---

### M-8: .env Auto-Loading from Project Directory

**Severity:** Medium (CVSS 4.8)
**CWE:** CWE-427 (Uncontrolled Search Path Element)
**Location:** `src/index.ts:14-17`

```typescript
if (process.env.FIRECRAWL_CLI_DISABLE_LOCAL_ENV !== '1') {
  const envPath = resolve(__dirname, '..', '.env');
  loadDotenv({ path: envPath, quiet: true });
}
```

**Description:** The CLI automatically loads a `.env` file from the project's installation directory (one level above `dist/`). If the CLI is installed globally via npm, `__dirname` resolves to the global npm directory. An attacker who can write a `.env` file to that directory can inject arbitrary environment variables, including:
- `FIRECRAWL_API_KEY` (to exfiltrate data to their server)
- `TEI_URL` / `QDRANT_URL` (to redirect internal traffic)
- `FIRECRAWL_EMBEDDER_QUEUE_DIR` (to control where queue files are written)

The `FIRECRAWL_CLI_DISABLE_LOCAL_ENV=1` escape hatch exists but is not documented in the README or help output.

**Remediation:**
1. Only load `.env` from the user's home config directory or current working directory, not from the installation directory.
2. Document the `FIRECRAWL_CLI_DISABLE_LOCAL_ENV` environment variable.
3. Consider removing auto-loading for globally installed packages.

---

## Low Severity Findings

### L-1: API Key Visible in Process Arguments

**Severity:** Low (CVSS 3.3)
**CWE:** CWE-214 (Invocation of Process Using Visible Sensitive Information)
**Location:** `src/commands/scrape.ts:292-293`, `src/commands/login.ts:83-85`

```typescript
.option('-k, --api-key <key>', 'Firecrawl API key (overrides global --api-key)')
```

**Description:** When users pass the API key via `--api-key` or `-k` flag, the key is visible in the process argument list (`/proc/PID/cmdline` on Linux, `ps aux` on all Unix systems). This exposes the key to other users on the same system.

**Remediation:**
1. Document that environment variables (`FIRECRAWL_API_KEY`) are preferred over command-line flags.
2. Consider reading the API key from stdin when the flag value is `-` (e.g., `--api-key -`).
3. Add a warning when `--api-key` is used in interactive mode.

---

### L-2: API Key Masking Shows First 6 and Last 4 Characters

**Severity:** Low (CVSS 2.4)
**CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)
**Location:** `src/commands/config.ts:53-60`

```typescript
if (key.length >= 16) {
  maskedKey = `${key.substring(0, 6)}...${key.slice(-4)}`;
} else {
  maskedKey = '*'.repeat(Math.min(key.length, 8));
}
```

**Description:** The `view-config` command shows the first 6 and last 4 characters of the API key (10 characters total). For typical API keys (32-64 characters), this reveals a significant portion. While not directly exploitable, this reduces the effective entropy if the masked output is logged or shared (e.g., in screenshots, support requests).

**Remediation:**
Reduce the revealed characters to first 4 and last 2, or show only the key prefix (e.g., `fc-****`):
```typescript
maskedKey = `${key.substring(0, 4)}...${key.slice(-2)}`;
```

---

### L-3: No Rate Limiting on Webhook Endpoint

**Severity:** Low (CVSS 3.7)
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
**Location:** `src/utils/background-embedder.ts:368-452`

**Description:** The webhook HTTP server has no rate limiting. An attacker can flood the endpoint with requests, causing resource exhaustion in the daemon and potentially in downstream TEI/Qdrant services. While the `/health` and `/status` endpoints are lightweight, the webhook endpoint triggers job processing which involves reading from disk, making API calls, and generating embeddings.

**Remediation:**
Implement a simple in-memory rate limiter (e.g., token bucket per client IP) or use Node.js `http` server connection limits.

---

### L-4: Qdrant Data Volume Permissions Not Restricted

**Severity:** Low (CVSS 3.1)
**CWE:** CWE-276 (Incorrect Default Permissions)
**Location:** `docker-compose.yaml:108`

```yaml
volumes:
  - ${QDRANT_DATA_DIR:-./data/qdrant}:/qdrant/storage
```

**Description:** The Qdrant data volume is mounted from the host filesystem with default Docker permissions. Qdrant stores vector embeddings and associated metadata (URLs, page titles, content chunks) in this directory. If the host directory has permissive permissions, any user on the system can read the embedded content.

Similarly, the embedder's project volume mount at line 29 (`- .:/app`) exposes the entire project directory (including `.env` with secrets) inside the container.

**Remediation:**
1. Set explicit ownership/permissions on mounted volumes.
2. Mount only the necessary directories instead of the entire project root:
   ```yaml
   volumes:
     - ./dist:/app/dist:ro
     - ./package.json:/app/package.json:ro
     - ${EMBEDDER_QUEUE_DIR:-./data/embed-queue}:/app/.cache/embed-queue
   ```

---

### L-5: Redis Binds to 0.0.0.0 Without Authentication

**Severity:** Low (CVSS 3.8)
**CWE:** CWE-306 (Missing Authentication for Critical Function)
**Location:** `docker-compose.yaml:71`

```yaml
command: redis-server --bind 0.0.0.0 --port "${REDIS_PORT:-53379}"
```

**Description:** Redis is configured to bind to all interfaces without authentication (`requirepass` not set). While Redis is on a Docker bridge network and not exposed to the host (no `ports:` mapping), any container on the `jakenet` network can access it. If additional containers are added to this network, they inherit access to Redis which stores Firecrawl job state.

**Remediation:**
1. Set `--requirepass` with a generated password.
2. Bind Redis to `127.0.0.1` within the container network, or use Docker network policies.

---

## Informational Findings

### I-1: Collection Name Not Sanitized in Qdrant URLs

**Severity:** Informational
**Location:** `src/container/services/QdrantService.ts:80-82`

```typescript
const checkResponse = await this.httpClient.fetchWithRetry(
  `${this.qdrantUrl}/collections/${collection}`,
```

**Description:** The `collection` parameter is used directly in URL construction via string interpolation. While the collection name typically comes from configuration or hardcoded defaults (`'firecrawl'`), a crafted collection name containing path separators (e.g., `../admin`) could potentially access unintended Qdrant API endpoints. The current code path makes this unlikely to be exploitable since collection names are either from config or hardcoded, but it represents a missing defense layer.

---

### I-2: Incomplete Error Handling in isUrl() Function

**Severity:** Informational
**Location:** `src/utils/url.ts:14-16`

```typescript
try {
  const url = new URL(str);
  return url.protocol === 'http:' || url.protocol === 'https:';
} catch {
  return true;  // Should be false
}
```

**Description:** The `isUrl()` function returns `true` when `new URL()` throws a parsing error for strings that start with `http://` or `https://`. This means malformed URLs like `http://[invalid` are treated as valid, potentially causing unexpected behavior downstream when these strings are used in HTTP requests or URL construction.

---

### I-3: Docker Images Use :latest Tags

**Severity:** Informational
**Location:** `docker-compose.yaml:42, 52, 69, 77, 103`

```yaml
image: loorisr/patchright-scrape-api:latest
image: ghcr.io/firecrawl/firecrawl:latest
image: redis:alpine
image: rabbitmq:3-management
image: qdrant/qdrant:latest
```

**Description:** All Docker images use floating tags (`:latest`, `:alpine`, `:3-management`). This means builds are not reproducible and could pull in compromised or breaking images. Supply chain attacks via Docker image poisoning are a known attack vector.

**Remediation:**
Pin images to specific digest versions:
```yaml
image: qdrant/qdrant:v1.7.4@sha256:abc123...
```

---

### I-4: process.exit() Prevents Cleanup in Multiple Commands

**Severity:** Informational
**Location:** Multiple files including `src/commands/scrape.ts:247`, `src/commands/extract.ts:213`, `src/commands/login.ts:49`

**Description:** Many error paths call `process.exit(1)` directly, bypassing the graceful shutdown handler defined in `src/index.ts:79-112`. This prevents the `baseContainer.dispose()` cleanup from executing, which could leave:
- HTTP connections in flight
- File locks held (embed queue)
- Temporary resources uncleaned

While not a direct security vulnerability, held file locks in the embed queue could create denial-of-service conditions for subsequent CLI invocations.

---

## Positive Security Observations

The following security practices were noted and should be maintained:

1. **Timing-safe secret comparison** (`src/utils/background-embedder.ts:425`): Uses `crypto.timingSafeEqual` for webhook secret validation, preventing timing side-channel attacks.

2. **Symlink-aware path traversal protection** (`src/utils/output.ts:22-66`): Uses `fs.realpathSync` to resolve symlinks before checking path containment, preventing symlink-based directory escape.

3. **Zod schema validation with strict mode** (`src/schemas/storage.ts`): Both `StoredCredentialsSchema` and `UserSettingsSchema` use `.strict()` to reject unknown fields, preventing object injection through stored configuration.

4. **File-level permission hardening** (`src/utils/credentials.ts:52, 61`): Config directories are created with 0o700 and credential files with 0o600 permissions.

5. **Atomic file locking** (`src/utils/embed-queue.ts:177-256`): Uses `proper-lockfile` to prevent TOCTOU race conditions in job claiming, with proper error categorization and lock release in `finally` blocks.

6. **Port validation** (`src/utils/embedder-webhook.ts:30-40`): Validates port numbers reject privileged ports (<1024) and invalid ranges.

7. **Request timeouts** (`src/utils/http.ts`): All HTTP requests use `AbortController` with configurable timeouts, preventing indefinite hanging.

8. **Retry-After header respect** (`src/utils/http.ts:153-176`): Properly handles RFC 9110 Retry-After headers with max delay cap.

9. **Confirmation flag for destructive operations** (`src/commands/delete.ts:54`): The `--yes` flag is required for deletion operations, preventing accidental data loss.

---

## Dependency Analysis

| Package | Version | Direct/Transitive | Known CVEs | Risk |
|---|---|---|---|---|
| `@mendable/firecrawl-js` | 4.12.0 | Direct | Via axios | High |
| `axios` | 1.13.2 | Transitive | GHSA-43fc-jf86-j433 | High |
| `commander` | 14.0.3 | Direct | None | Low |
| `dotenv` | 17.2.3 | Direct | None | Low |
| `lru-cache` | 11.2.5 | Direct | None | Low |
| `p-limit` | 7.2.0 | Direct | None | Low |
| `proper-lockfile` | 4.1.2 | Direct | None | Low |
| `zod` | 4.3.6 | Direct | None | Low |
| `follow-redirects` | 1.15.11 | Transitive | None currently | Medium* |

*`follow-redirects` has historically had SSRF vulnerabilities. Monitor for future advisories.

---

## Summary of Recommendations by Priority

### Immediate Actions (High)
1. **H-1:** Change webhook server default bind to `127.0.0.1`
2. **H-2:** Remove API key from embed queue job files
3. **H-3:** Override axios to `>=1.13.5` via pnpm overrides

### Short-Term Actions (Medium)
4. **M-1:** Add request body size limit to webhook endpoint
5. **M-2:** Add regex complexity protection for user-provided patterns
6. **M-3:** Write credential/settings files with `mode: 0o600` atomically
7. **M-4:** Move job history to user config directory
8. **M-5:** Fix `isUrl()` catch block; validate TEI/Qdrant URL schemes
9. **M-6:** Replace `require()` with `import()` in Container
10. **M-7:** Add `.catch()` to fire-and-forget webhook handler
11. **M-8:** Document and limit `.env` auto-loading scope

### Maintenance Actions (Low/Informational)
12. **L-1:** Document API key environment variable as preferred method
13. **L-2:** Reduce API key masking to show fewer characters
14. **L-3:** Add rate limiting to webhook endpoint
15. **L-4:** Restrict Docker volume mounts to necessary directories
16. **L-5:** Add Redis authentication
17. **I-3:** Pin Docker images to specific digests

---

*Report generated by automated security audit. Manual penetration testing recommended for findings H-1, M-1, and M-2.*
