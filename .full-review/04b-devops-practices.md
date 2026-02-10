# DevOps Practices Review: cli-firecrawl

**Date:** 2026-02-10
**Reviewer:** DevOps Engineering Analysis
**Scope:** CI/CD pipelines, deployment strategy, infrastructure configuration, monitoring, incident response, environment management
**Infrastructure:** Self-hosted Docker Compose stack with 6 services

---

## Executive Summary

The cli-firecrawl project demonstrates **strong CI/CD foundations** with GitHub Actions workflows for testing, security scanning, and releases, but has **significant operational gaps** in monitoring, incident response, and production readiness. The project prioritizes local development velocity but lacks the observability, backup/recovery procedures, and operational runbooks needed for reliable production deployments.

### Status Overview

| Category | Status | Severity |
|----------|--------|----------|
| **CI/CD Pipeline** | ✅ Implemented | Good |
| **Security Scanning** | ✅ Implemented | Good |
| **Deployment Strategy** | ⚠️ Manual/Basic | Medium |
| **Infrastructure as Code** | ✅ Version Controlled | Good |
| **Monitoring & Observability** | ❌ Missing | **Critical** |
| **Incident Response** | ❌ Missing | **Critical** |
| **Backup/Recovery** | ❌ Missing | **High** |
| **Environment Management** | ⚠️ Partial | Medium |
| **Secret Management** | ⚠️ Insecure | **High** |
| **Operational Runbooks** | ❌ Missing | **Critical** |

### Critical Findings

1. **No monitoring/alerting** - Zero visibility into production health (Critical)
2. **No backup/recovery procedures** - Qdrant data loss risk (High)
3. **No operational runbooks** - No incident response procedures (Critical)
4. **Plaintext secrets in queue files** - API keys stored unencrypted (High - from prior review)
5. **Webhook server exposed on 0.0.0.0** - Unauthenticated by default (High - from prior review)
6. **Console-only logging** - 348 console.* calls, no structured logging (High)
7. **No resource planning guide** - Memory/CPU sizing unknown (Medium)
8. **Embed queue owned by root** - Permission issues (Medium)

---

## 1. CI/CD Pipeline Assessment

### 1.1 GitHub Actions Workflows ✅ GOOD

**Status:** Implemented and functional

The project has **three well-designed workflows**:

#### **ci.yml** - Continuous Integration
```yaml
on:
  push:
    branches: [main, develop, feat/*]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]  # Multi-version testing
    timeout-minutes: 10
    steps:
      - Type check (pnpm type-check)
      - Lint (pnpm lint)
      - Build (pnpm build)
      - Run tests (pnpm test)

  coverage:
    - Run tests with coverage
    - Upload to Codecov
    - Upload coverage artifacts (7 day retention)

  build-quality:
    - Bundle size monitoring (alerts >2MB)
    - Package validation (npm pack --dry-run)
```

**Strengths:**
- ✅ Multi-version Node.js testing (18, 20, 22)
- ✅ Concurrency control prevents duplicate runs
- ✅ Frozen lockfile enforcement (`--frozen-lockfile`)
- ✅ Timeout protection (10 minutes)
- ✅ Bundle size monitoring with threshold alerts
- ✅ Coverage tracking via Codecov

**Improvements Needed:**
- ⚠️ No E2E tests in CI (requires Docker infrastructure)
- ⚠️ No performance regression testing
- ⚠️ No cache invalidation strategy documented

#### **release.yml** - Release Automation
```yaml
on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  validate:
    - Full test suite (pnpm test:all)
    - Version consistency check (package.json vs git tag)

  publish-npm:
    - Build and publish to npm
    - Uses provenance attestation

  create-github-release:
    - Extract changelog from CHANGELOG.md
    - Create GitHub release
```

**Strengths:**
- ✅ Tag-based triggering (semantic versioning)
- ✅ Version validation prevents mismatched releases
- ✅ Provenance attestation for supply chain security
- ✅ Automated npm publish with authentication

**Improvements Needed:**
- ⚠️ No Docker image publishing for embedder daemon
- ⚠️ No rollback procedure documented
- ⚠️ No canary deployment support
- ⚠️ No post-deployment verification

#### **security.yml** - Security Scanning
```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 1'  # Weekly scans

jobs:
  audit:
    - pnpm audit --audit-level=moderate
    - Fail on high/critical vulnerabilities

  secrets-scan:
    - TruffleHog for secrets detection

  codeql:
    - Static analysis with CodeQL
    - Security and quality queries

  shell-check:
    - ShellCheck for shell scripts
```

**Strengths:**
- ✅ Automated dependency scanning
- ✅ Secrets detection (TruffleHog)
- ✅ Weekly scheduled scans
- ✅ Static analysis (CodeQL)
- ✅ Shell script linting

**Improvements Needed:**
- ⚠️ No container image scanning (Trivy/Grype)
- ⚠️ No SBOM (Software Bill of Materials) generation
- ⚠️ No license compliance checking

### 1.2 Pre-commit Hooks ✅ GOOD

**File:** `.husky/pre-commit`
```bash
pnpm exec lint-staged  # Format/lint staged files
pnpm type-check        # TypeScript validation
pnpm test:unit         # Full unit test suite
```

**Strengths:**
- ✅ Automated quality gates before commit
- ✅ Fast (lint-staged only checks changed files)
- ✅ Prevents broken code from entering history

**Concerns:**
- ⚠️ Full test suite on every commit is slow for large changes
- ⚠️ No pre-push hook for long-running tests (E2E)
- ⚠️ No commit message linting (commitlint)

### 1.3 CI/CD Metrics ⚠️ PARTIAL

**Available Metrics:**
- Build time: ~5-10 minutes per workflow run
- Test execution: 326 tests in ~800ms (unit), E2E unknown
- Coverage: 68.37% (below 85% target)
- Bundle size: Monitored, alerts on >2MB

**Missing Metrics:**
- ❌ Build success rate over time
- ❌ Test flakiness detection
- ❌ Deployment frequency
- ❌ Time to production (commit → release)
- ❌ Failed release rate
- ❌ Rollback frequency

**Recommendation:** Implement CI/CD dashboard with:
- Build/test trend analysis
- Coverage trend with quality gates
- Release velocity tracking
- Security scan findings over time

---

## 2. Deployment Strategy

### 2.1 Current Deployment Model ⚠️ BASIC

**Type:** Manual Docker Compose deployment
**Target Environment:** Self-hosted infrastructure

**Deployment Commands:**
```bash
# Start infrastructure
docker compose up -d

# Check service status
docker compose ps

# Restart specific service
docker compose restart firecrawl-embedder

# View logs
docker logs firecrawl-embedder --tail 100
```

**Strengths:**
- ✅ Simple, repeatable via docker-compose.yaml
- ✅ Version-controlled infrastructure configuration
- ✅ All services defined in single file

**Critical Gaps:**
- ❌ No zero-downtime deployment strategy
- ❌ No rollback procedure documented
- ❌ No blue-green or canary deployment support
- ❌ No health check validation post-deployment
- ❌ No deployment checklist or runbook
- ❌ No automated deployment pipeline

### 2.2 Service Health Checks ⚠️ PARTIAL

**docker-compose.yaml analysis:**

```yaml
# ONLY RabbitMQ has health check configured
firecrawl-rabbitmq:
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "-q", "check_running"]
    interval: 5s
    timeout: 5s
    retries: 3
    start_period: 5s
```

**Missing Health Checks:**
- ❌ **firecrawl** - No health check (port 53002)
- ❌ **firecrawl-embedder** - No health check (port 53000)
- ❌ **firecrawl-playwright** - No health check (port 53006)
- ❌ **firecrawl-qdrant** - No health check (ports 53333, 53334)
- ❌ **firecrawl-redis** - No health check (port 53379)
- ❌ **nuq-postgres** - No health check (port 53432)

**Operational Impact:**
- Docker Compose doesn't know if services are actually ready
- Dependent services may start before dependencies are available
- No automatic restart on service failure detection
- Manual intervention required to detect unhealthy services

**Recommended Health Checks:**

```yaml
firecrawl:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:53002/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 30s

firecrawl-embedder:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:53000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s

firecrawl-qdrant:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:6333/"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 15s

firecrawl-redis:
  healthcheck:
    test: ["CMD", "redis-cli", "-p", "53379", "ping"]
    interval: 5s
    timeout: 3s
    retries: 3
    start_period: 5s

nuq-postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -p 53432 -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
```

### 2.3 Graceful Shutdown Handling ✅ GOOD

**Signal Handling in CLI:**
```typescript
// src/index.ts:114-115
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

function handleShutdown(signal: string): void {
  // Double signal detection for force exit
  if (shutdownInProgress) {
    process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
  }
  shutdownInProgress = true;
  console.log(`\n${fmt.dim(`${signal} received.`)} Shutting down gracefully...`);
  process.exit(signal === 'SIGINT' ? 130 : 143);
}
```

**Signal Handling in Embedder Daemon:**
```typescript
// src/embedder-daemon.ts:40-83
const CLEANUP_TIMEOUT_MS = 5000;

async function gracefulShutdown(signal: string): Promise<void> {
  console.error(fmt.dim(`[Embedder] Received ${signal}, shutting down gracefully`));

  try {
    // Race cleanup against timeout
    await Promise.race([
      cleanup(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Cleanup timed out after ${CLEANUP_TIMEOUT_MS}ms`)), CLEANUP_TIMEOUT_MS)
      ),
    ]);
    await container.dispose();
    process.exit(0);
  } catch (error) {
    console.error(fmt.error(`[Embedder] Cleanup error: ${error}`));
    process.exit(1);
  }
}

process.on('SIGTERM', async () => await gracefulShutdown('SIGTERM'));
process.on('SIGINT', async () => await gracefulShutdown('SIGINT'));
```

**Strengths:**
- ✅ Proper SIGTERM/SIGINT handling in both CLI and daemon
- ✅ Cleanup timeout prevents hanging shutdown (5 seconds)
- ✅ Double-signal force exit in CLI
- ✅ Container disposal on shutdown

**Docker Compose Restart Policy:**
```yaml
x-common-service: &common-service
  restart: unless-stopped  # Automatic restart on crash
```

### 2.4 Zero-Downtime Updates ❌ MISSING

**Current State:** No support for rolling updates or blue-green deployments

**Recommendation:** Implement rolling update strategy

```yaml
# Example: Blue-Green deployment script
#!/bin/bash
# deploy-zero-downtime.sh

set -euo pipefail

SERVICE="firecrawl-embedder"
HEALTH_URL="http://localhost:53000/health"
MAX_WAIT=30

echo "Starting blue-green deployment for $SERVICE..."

# 1. Start new version with temporary name
docker compose up -d --no-deps --scale $SERVICE=2 $SERVICE

# 2. Wait for new instance to be healthy
WAIT=0
until curl -sf $HEALTH_URL > /dev/null; do
  sleep 1
  WAIT=$((WAIT + 1))
  if [ $WAIT -ge $MAX_WAIT ]; then
    echo "Health check timeout - rolling back"
    docker compose up -d --no-deps --scale $SERVICE=1 $SERVICE
    exit 1
  fi
done

# 3. Stop old instance
docker compose stop $SERVICE

# 4. Start new instance as primary
docker compose up -d --no-deps $SERVICE

echo "Deployment complete. Service is healthy."
```

---

## 3. Infrastructure as Code

### 3.1 Docker Compose Configuration ✅ GOOD

**File:** `docker-compose.yaml`

**Strengths:**
- ✅ All services defined in single file
- ✅ Version controlled in git
- ✅ Shared configuration via YAML anchors (`x-common-service`)
- ✅ Environment variable templating (`${VAR:-default}`)
- ✅ Explicit container names for easy management
- ✅ Network isolation (`jakenet` bridge network)
- ✅ Log rotation configured (10MB max, 3 files, compressed)
- ✅ File descriptor limits set (`ulimits: nofile: 65535`)

**Configuration Quality:**

```yaml
x-common-service: &common-service
  ulimits:
    nofile:
      soft: 65535
      hard: 65535
  restart: unless-stopped
  networks:
    - jakenet
  extra_hosts:
    - "host.docker.internal:host-gateway"  # Docker host access
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
      compress: "true"
  env_file:
    - .env
```

**Improvements Needed:**
- ⚠️ No resource limits (CPU/memory) defined
- ⚠️ No dependency ordering beyond `depends_on`
- ⚠️ Volume mounts use relative paths (fragile)
- ⚠️ No backup strategy for persistent volumes

### 3.2 Volume Management ⚠️ RISKY

**Persistent Volumes:**

```yaml
firecrawl-embedder:
  volumes:
    - .:/app  # Entire project directory (development-only!)
    - ${EMBEDDER_QUEUE_DIR:-./data/embed-queue}:/app/.cache/embed-queue

firecrawl-qdrant:
  volumes:
    - ${QDRANT_DATA_DIR:-./data/qdrant}:/qdrant/storage  # Vector database
```

**Critical Issues:**

1. **Embed Queue Directory Owned by Root:**
   ```bash
   $ ls -la .cache/embed-queue/
   drwxr-xr-x  2 root   root    2 Feb  2 23:51 .
   ```
   - Files created by Docker container are root-owned
   - Local user cannot write to queue directory
   - **Permission errors** when CLI tries to enqueue jobs

2. **No Backup Strategy:**
   - Qdrant storage in `./data/qdrant` (not gitignored)
   - **Data loss risk** on accidental `docker compose down -v`
   - No automated backups configured
   - No restore procedure documented

3. **Relative Paths:**
   - Volumes use relative paths (`./data/qdrant`)
   - Breaks if `docker compose` run from different directory
   - Should use absolute paths or named volumes

**Recommended Volume Strategy:**

```yaml
volumes:
  qdrant_storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/firecrawl/qdrant
  embed_queue:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/firecrawl/embed-queue

services:
  firecrawl-qdrant:
    volumes:
      - qdrant_storage:/qdrant/storage

  firecrawl-embedder:
    volumes:
      - embed_queue:/app/.cache/embed-queue
    user: "${UID}:${GID}"  # Run as host user to fix permissions
```

### 3.3 Network Configuration ✅ ADEQUATE

```yaml
networks:
  jakenet:
    driver: bridge
```

**Strengths:**
- ✅ Isolated network for service-to-service communication
- ✅ Services reference each other by container name

**Improvements:**
- ⚠️ No network policies or firewall rules
- ⚠️ No ingress controller for external access
- ⚠️ No TLS between services

### 3.4 Resource Limits ❌ MISSING

**Critical Gap:** No CPU/memory limits defined

**Recommendation:**

```yaml
x-resource-limits: &resource-limits
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M

services:
  firecrawl:
    <<: *common-service
    <<: *resource-limits
    deploy:
      resources:
        limits:
          memory: 4G  # Override for high memory service

  firecrawl-embedder:
    <<: *common-service
    <<: *resource-limits

  firecrawl-qdrant:
    <<: *common-service
    deploy:
      resources:
        limits:
          memory: 8G  # Vector database needs more RAM
          cpus: '4.0'
```

---

## 4. Monitoring & Observability

### 4.1 Current State ❌ CRITICAL GAP

**Logging:**
- **Type:** Console-only logging (348 `console.*` calls across codebase)
- **Format:** Unstructured text output
- **Aggregation:** None (only Docker JSON logs)
- **Retention:** 3 files × 10MB = 30MB per service
- **Searching:** Manual `docker logs` or log file inspection

**Metrics:**
- ❌ No metrics collection (no Prometheus, StatsD, etc.)
- ❌ No performance monitoring
- ❌ No resource utilization tracking
- ❌ No SLA/SLO tracking

**Alerting:**
- ❌ No alerting system
- ❌ No health check monitoring
- ❌ No error rate alerts
- ❌ No capacity alerts

**Dashboards:**
- ❌ No Grafana or similar
- ❌ No real-time visibility into system health

### 4.2 Logging Assessment ⚠️ INADEQUATE

**Console Usage Analysis:**
```bash
$ grep -r "console\." src/ --include="*.ts" | wc -l
348
```

**Logging Patterns Found:**

1. **Debug logging in production:**
   ```typescript
   // src/utils/background-embedder.ts
   console.error(fmt.dim(`[Embedder] Received ${signal}, shutting down gracefully`));
   console.error(fmt.warning('[Embedder] Cleanup function not yet initialized'));
   console.error(fmt.error(`[Embedder] Cleanup error: ${error}`));
   ```

2. **No log levels beyond console methods:**
   - `console.log` - 120+ occurrences
   - `console.error` - 180+ occurrences
   - `console.warn` - 30+ occurrences
   - No DEBUG, INFO, WARNING, ERROR, CRITICAL distinction

3. **No structured logging:**
   ```typescript
   // Current: Unstructured
   console.error(`[Embedder] Fatal error: ${error.message}`);

   // Desired: Structured JSON
   logger.error({
     component: 'embedder',
     event: 'fatal_error',
     error: error.message,
     stack: error.stack,
     jobId: job.id,
     timestamp: new Date().toISOString()
   });
   ```

4. **No request correlation:**
   - No request IDs to trace operations across services
   - Cannot correlate embedder webhook with original scrape command

**Recommendation:** Implement structured logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

// Usage
logger.info({ component: 'embedder', event: 'job_started', jobId }, 'Starting embed job');
logger.error({ component: 'embedder', event: 'job_failed', jobId, error }, 'Job failed');
```

### 4.3 Health Check Endpoints ⚠️ PARTIAL

**Embedder Daemon Endpoints:**

```typescript
// src/utils/background-embedder.ts:372-393

// GET /health
{
  "status": "healthy",
  "timestamp": "2026-02-10T12:00:00.000Z",
  "queueSize": 5
}

// GET /status
{
  "webhooksEnabled": true,
  "port": 53000,
  "version": "1.1.1",
  "embedder": {
    "concurrency": 10,
    "autoEmbed": true
  },
  "services": {
    "tei": "connected",
    "qdrant": "connected"
  }
}
```

**Issues:**
- ⚠️ `/health` doesn't check TEI/Qdrant connectivity
- ⚠️ `/status` exposes too much internal configuration (security risk)
- ⚠️ No health check for main Firecrawl service
- ⚠️ No readiness vs liveness distinction

**Recommended Health Check Specification:**

```typescript
// GET /health (Liveness - is process alive?)
{
  "status": "ok",
  "timestamp": "2026-02-10T12:00:00.000Z"
}

// GET /ready (Readiness - can accept traffic?)
{
  "status": "ready",
  "timestamp": "2026-02-10T12:00:00.000Z",
  "checks": {
    "tei": { "status": "ok", "latency_ms": 45 },
    "qdrant": { "status": "ok", "latency_ms": 12 },
    "queue": { "status": "ok", "size": 5 }
  }
}

// GET /metrics (Prometheus format)
# HELP firecrawl_embedder_queue_size Number of jobs in embed queue
# TYPE firecrawl_embedder_queue_size gauge
firecrawl_embedder_queue_size 5

# HELP firecrawl_embedder_jobs_total Total embed jobs processed
# TYPE firecrawl_embedder_jobs_total counter
firecrawl_embedder_jobs_total{status="completed"} 1234
firecrawl_embedder_jobs_total{status="failed"} 56
```

### 4.4 Recommended Monitoring Stack

**Option 1: Minimal (Self-Hosted)**
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "53090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "53000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
```

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'firecrawl-embedder'
    static_configs:
      - targets: ['firecrawl-embedder:53000']
    metrics_path: '/metrics'

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']  # Docker metrics
```

**Key Metrics to Track:**
- **Embedder Queue:**
  - Queue size (gauge)
  - Jobs processed (counter)
  - Job duration (histogram)
  - Failure rate (counter)
- **TEI Service:**
  - Request latency (histogram)
  - Error rate (counter)
  - Concurrent requests (gauge)
- **Qdrant:**
  - Vector count (gauge)
  - Query latency (histogram)
  - Disk usage (gauge)
- **Docker Containers:**
  - CPU usage (%)
  - Memory usage (%)
  - Network I/O (bytes)
  - Restart count (counter)

**Option 2: Cloud-Based (If Acceptable)**
- **Datadog**: Full observability platform
- **New Relic**: APM + infrastructure monitoring
- **Sentry**: Error tracking and performance

*(Note: Project guidelines prefer self-hosted solutions)*

---

## 5. Incident Response & Runbooks

### 5.1 Current State ❌ CRITICAL GAP

**Existing Documentation:**
- ❌ No operational runbook
- ❌ No incident response procedures
- ❌ No troubleshooting guides
- ❌ No escalation procedures
- ❌ No on-call rotation

**Impact:**
- **MTTR (Mean Time To Recovery):** Unknown, likely hours
- **Incident handling:** Ad-hoc, manual investigation
- **Knowledge transfer:** Dependent on individual memory

### 5.2 Required Operational Runbooks

#### **Runbook 1: Service Failure Recovery**

**File:** `docs/runbooks/service-failure.md`

```markdown
# Service Failure Recovery

## Symptoms
- Service not responding to health checks
- Docker container in "Restarting" status
- HTTP 502/503 errors from service

## Diagnosis
1. Check container status: `docker compose ps`
2. Check logs: `docker logs <container> --tail 100`
3. Check resource usage: `docker stats --no-stream`
4. Check network: `docker network inspect jakenet`

## Recovery Procedures

### Firecrawl Service Down
1. Check logs for errors:
   ```bash
   docker logs firecrawl --tail 200
   ```
2. Check RabbitMQ dependency:
   ```bash
   docker logs firecrawl-rabbitmq --tail 100
   ```
3. Restart service:
   ```bash
   docker compose restart firecrawl
   ```
4. Verify health:
   ```bash
   curl http://localhost:53002/health
   ```

### Embedder Daemon Down
1. Check queue directory permissions:
   ```bash
   ls -la .cache/embed-queue/
   # If owned by root, fix permissions:
   sudo chown -R $(whoami):$(whoami) .cache/embed-queue/
   ```
2. Check TEI connectivity:
   ```bash
   curl http://100.74.16.82:52000/health
   ```
3. Check Qdrant connectivity:
   ```bash
   curl http://localhost:53333/
   ```
4. Restart daemon:
   ```bash
   docker compose restart firecrawl-embedder
   ```
5. Verify health:
   ```bash
   curl http://localhost:53000/health
   ```

### Qdrant Database Down
1. Check disk space:
   ```bash
   df -h ./data/qdrant
   ```
2. Check permissions:
   ```bash
   ls -la ./data/qdrant
   ```
3. Check logs:
   ```bash
   docker logs firecrawl-qdrant --tail 200
   ```
4. Restart Qdrant:
   ```bash
   docker compose restart firecrawl-qdrant
   ```
5. Verify health:
   ```bash
   curl http://localhost:53333/
   ```

## Escalation
- If service fails to restart after 3 attempts: Check resource limits
- If data corruption suspected: Restore from backup (see backup runbook)
- If issue persists >30 minutes: Escalate to senior engineer
```

#### **Runbook 2: Embed Queue Recovery**

```markdown
# Embed Queue Recovery

## Symptoms
- Jobs stuck in pending state
- Queue size growing unbounded
- Embedder daemon not processing jobs

## Diagnosis
1. Check queue status:
   ```bash
   firecrawl status
   ```
2. Check embedder logs:
   ```bash
   docker logs firecrawl-embedder --tail 200
   ```
3. Check queue directory:
   ```bash
   ls -la .cache/embed-queue/
   cat .cache/embed-queue/queue.json
   ```

## Recovery Procedures

### Queue Processing Stalled
1. Check embedder health:
   ```bash
   curl http://localhost:53000/health
   ```
2. Check for file lock contention:
   ```bash
   lsof .cache/embed-queue/queue.json
   ```
3. Restart embedder:
   ```bash
   docker compose restart firecrawl-embedder
   ```

### Queue Corruption
1. Backup current queue:
   ```bash
   cp -r .cache/embed-queue .cache/embed-queue.backup.$(date +%Y%m%d-%H%M%S)
   ```
2. Validate queue JSON:
   ```bash
   jq . .cache/embed-queue/queue.json
   ```
3. If invalid, restore from backup or recreate:
   ```bash
   echo '{"jobs":[]}' > .cache/embed-queue/queue.json
   ```

### Manual Queue Cleanup
1. Remove stale jobs (>24 hours old):
   ```bash
   firecrawl embed --cleanup
   ```
2. Or manually:
   ```bash
   find .cache/embed-queue -name "*.json" -mtime +1 -delete
   ```

## Prevention
- Monitor queue size: Alert if >100 jobs
- Monitor job age: Alert if oldest job >1 hour
- Implement automatic cleanup in cron job
```

#### **Runbook 3: Database Backup & Recovery**

```markdown
# Database Backup & Recovery

## Qdrant Vector Database

### Backup Procedure (Manual)
1. Create snapshot:
   ```bash
   curl -X POST http://localhost:53333/collections/firecrawl/snapshots
   ```
2. Download snapshot:
   ```bash
   SNAPSHOT_NAME=$(curl http://localhost:53333/collections/firecrawl/snapshots | jq -r '.[0].name')
   curl -o "qdrant-backup-$(date +%Y%m%d).snapshot" \
     http://localhost:53333/collections/firecrawl/snapshots/$SNAPSHOT_NAME
   ```
3. Store offsite:
   ```bash
   rclone copy qdrant-backup-*.snapshot remote:backups/qdrant/
   ```

### Automated Backup (Cron)
```bash
# /etc/cron.daily/qdrant-backup.sh
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/qdrant"
RETENTION_DAYS=30

# Create snapshot
SNAPSHOT_NAME=$(curl -X POST http://localhost:53333/collections/firecrawl/snapshots | jq -r '.snapshot_name')

# Download
curl -o "$BACKUP_DIR/qdrant-$(date +%Y%m%d).snapshot" \
  http://localhost:53333/collections/firecrawl/snapshots/$SNAPSHOT_NAME

# Cleanup old backups
find $BACKUP_DIR -name "qdrant-*.snapshot" -mtime +$RETENTION_DAYS -delete

# Upload to remote storage
rclone copy $BACKUP_DIR remote:backups/qdrant/
```

### Restore Procedure
1. Stop Qdrant:
   ```bash
   docker compose stop firecrawl-qdrant
   ```
2. Clear current data:
   ```bash
   sudo rm -rf ./data/qdrant/*
   ```
3. Extract snapshot:
   ```bash
   sudo tar -xzf qdrant-backup-20260210.snapshot -C ./data/qdrant/
   ```
4. Fix permissions:
   ```bash
   sudo chown -R 1000:1000 ./data/qdrant/
   ```
5. Start Qdrant:
   ```bash
   docker compose up -d firecrawl-qdrant
   ```
6. Verify data:
   ```bash
   curl http://localhost:53333/collections/firecrawl
   ```

## PostgreSQL Database (nuq-postgres)

### Backup Procedure
```bash
docker exec nuq-postgres pg_dump -U postgres -Fc -f /tmp/postgres-$(date +%Y%m%d).dump
docker cp nuq-postgres:/tmp/postgres-$(date +%Y%m%d).dump ./backups/
```

### Restore Procedure
```bash
docker cp ./backups/postgres-20260210.dump nuq-postgres:/tmp/restore.dump
docker exec nuq-postgres pg_restore -U postgres -d postgres -c /tmp/restore.dump
```

## Embed Queue Backup
```bash
# Backup
tar -czf embed-queue-$(date +%Y%m%d).tar.gz .cache/embed-queue/

# Restore
tar -xzf embed-queue-20260210.tar.gz -C .cache/
```
```

#### **Runbook 4: Performance Degradation**

```markdown
# Performance Degradation Response

## Symptoms
- Scraping/crawling operations taking >2x normal time
- Embedder queue growing faster than processing
- High CPU/memory usage

## Diagnosis
1. Check resource utilization:
   ```bash
   docker stats --no-stream
   ```
2. Check service logs for errors:
   ```bash
   docker logs firecrawl --tail 200
   docker logs firecrawl-embedder --tail 200
   ```
3. Check TEI service:
   ```bash
   curl http://100.74.16.82:52000/health
   ```
4. Check Qdrant performance:
   ```bash
   curl http://localhost:53333/metrics
   ```

## Resolution Steps

### High Memory Usage (Embedder)
1. Check queue size:
   ```bash
   firecrawl status
   ```
2. If >100 jobs, reduce concurrency:
   ```bash
   # Edit docker-compose.yaml
   environment:
     EMBEDDER_CONCURRENCY: 5  # Reduce from 10
   docker compose up -d firecrawl-embedder
   ```

### High CPU Usage (Qdrant)
1. Check collection size:
   ```bash
   curl http://localhost:53333/collections/firecrawl
   ```
2. If >1M vectors, consider:
   - Increasing memory allocation
   - Optimizing index parameters
   - Archiving old data

### TEI Service Slow
1. Check remote service health:
   ```bash
   ssh steamy-wsl "nvidia-smi"
   ```
2. Check network latency:
   ```bash
   ping -c 10 100.74.16.82
   ```
3. If TEI is overloaded, reduce embedder concurrency

## Prevention
- Monitor resource usage continuously
- Set up alerts for >80% CPU/memory
- Implement queue size limits
- Regular database maintenance (vacuum, reindex)
```

### 5.3 Incident Response Checklist

**File:** `docs/incident-response.md`

```markdown
# Incident Response Checklist

## Severity Levels

### SEV-1: Critical (Production Down)
- All services unavailable
- Data loss risk
- Response: Immediate (24/7)
- MTTR Target: <30 minutes

### SEV-2: High (Degraded Service)
- Some services unavailable
- Performance severely degraded
- Response: <2 hours (business hours)
- MTTR Target: <2 hours

### SEV-3: Medium (Minor Issue)
- Non-critical feature unavailable
- Minor performance degradation
- Response: <4 hours (business hours)
- MTTR Target: <1 day

### SEV-4: Low (Cosmetic)
- UI issue, documentation error
- Response: Next sprint
- MTTR Target: <1 week

## Response Procedure

### 1. Detection
- [ ] Alert received (automated) OR user report
- [ ] Incident logged in tracking system
- [ ] Severity assigned

### 2. Triage (First 5 minutes)
- [ ] Check service status: `docker compose ps`
- [ ] Check recent logs: `docker logs <service> --since 15m`
- [ ] Check resource usage: `docker stats --no-stream`
- [ ] Identify affected services

### 3. Communication
- [ ] Notify stakeholders (SEV-1/SEV-2 only)
- [ ] Create incident channel (Slack/Discord)
- [ ] Post initial status update

### 4. Investigation
- [ ] Consult relevant runbook
- [ ] Check recent changes (git log, deployments)
- [ ] Review error logs in detail
- [ ] Reproduce issue if possible

### 5. Resolution
- [ ] Execute recovery procedure
- [ ] Verify service health
- [ ] Monitor for 15 minutes post-recovery

### 6. Post-Mortem (SEV-1/SEV-2 only)
- [ ] Document timeline
- [ ] Identify root cause
- [ ] List contributing factors
- [ ] Create action items (prevention)
- [ ] Schedule follow-up review

## Contact Information
- **On-Call Engineer**: [NAME] - [PHONE]
- **Escalation**: [MANAGER] - [PHONE]
- **Infrastructure Owner**: [DEVOPS LEAD]
```

### 5.4 Monitoring Gaps → Incident Detection

**Current State:** Incidents discovered manually (user reports, periodic checks)

**Recommended Alerting Rules:**

```yaml
# prometheus/alerts.yml
groups:
  - name: firecrawl_critical
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up{job=~"firecrawl.*"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} is down"
          description: "{{ $labels.job }} has been down for 2 minutes"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Container {{ $labels.name }} high memory usage"
          description: "Memory usage above 90% for 5 minutes"

      - alert: EmbedQueueBacklog
        expr: firecrawl_embedder_queue_size > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Embed queue backlog"
          description: "Queue size {{ $value }} exceeds threshold"

      - alert: HighErrorRate
        expr: rate(firecrawl_embedder_jobs_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High embed job failure rate"
          description: "Failure rate {{ $value | humanizePercentage }} over 5 minutes"
```

---

## 6. Environment Management

### 6.1 Configuration Management ⚠️ PARTIAL

**Files:**
- `.env` - Local environment (gitignored)
- `.env.example` - Template (committed)
- `docker-compose.yaml` - Service configuration

**Strengths:**
- ✅ `.env` file gitignored
- ✅ `.env.example` provides template
- ✅ Environment variable templating in compose file

**Issues:**

1. **No environment separation:**
   - No dev/staging/prod configuration separation
   - Same `.env` file used for all environments
   - No environment-specific overrides

2. **Default values scattered:**
   - Defaults in code (TypeScript files)
   - Defaults in docker-compose (`${VAR:-default}`)
   - Defaults in .env.example comments
   - No single source of truth

3. **Missing critical variables:**
   ```bash
   # .env.example - TEI_URL is commented out!
   # TEI_URL=http://your-tei-host:52000
   ```
   - User must manually uncomment
   - Error-prone setup

**Recommended Structure:**

```
config/
├── .env.development    # Local development
├── .env.staging        # Staging environment
├── .env.production     # Production (template only, actual in secrets manager)
└── defaults.json       # All default values

docker-compose.dev.yaml
docker-compose.prod.yaml
```

### 6.2 Secret Management ❌ HIGH RISK

**Current State:**

1. **API Keys in Plaintext:**
   - Stored in `.env` file (gitignored, but insecure)
   - Stored in embed queue job files (from Security Review H-2)
   - No encryption at rest

2. **No Secret Rotation:**
   - No procedure for rotating API keys
   - No expiration tracking

3. **No Secrets Manager:**
   - No integration with HashiCorp Vault, AWS Secrets Manager, etc.
   - Secrets managed manually

**Security Finding (from prior review):**
> **H-2: API Key Persisted in Plaintext Embed Queue Job Files**
> Severity: High (CVSS 7.1)
> Location: `src/utils/embed-queue.ts:42, 98, 111`

**Recommendation:** Implement secrets management

```yaml
# docker-compose.yaml with Docker secrets
services:
  firecrawl:
    secrets:
      - firecrawl_api_key
    environment:
      FIRECRAWL_API_KEY: /run/secrets/firecrawl_api_key

secrets:
  firecrawl_api_key:
    file: ./secrets/firecrawl_api_key.txt  # Never committed
```

Or use environment-based secret injection:

```bash
# CI/CD pipeline
export FIRECRAWL_API_KEY=$(vault kv get -field=api_key secret/firecrawl)
docker compose up -d
```

### 6.3 Environment Validation ⚠️ MISSING

**No startup validation:**
- Services start even with missing critical env vars
- Errors discovered at runtime, not startup

**Recommended Validation:**

```typescript
// src/utils/env-validator.ts
import { z } from 'zod';

const envSchema = z.object({
  FIRECRAWL_API_KEY: z.string().min(1, 'API key required'),
  FIRECRAWL_API_URL: z.string().url('Must be valid URL'),
  TEI_URL: z.string().url('Must be valid URL'),
  QDRANT_URL: z.string().url('Must be valid URL'),
  QDRANT_COLLECTION: z.string().default('firecrawl'),
  EMBEDDER_CONCURRENCY: z.coerce.number().min(1).max(50).default(10),
});

export function validateEnv(): void {
  try {
    envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:');
    console.error(error.errors);
    process.exit(1);
  }
}

// In embedder-daemon.ts
validateEnv();  // Fail fast on startup
```

---

## 7. Security & Compliance

### 7.1 Security Findings from Prior Reviews

**High Severity (from Security Audit):**

1. **H-1: Webhook Server Binds to 0.0.0.0 Without Authentication**
   - **Risk:** Network-accessible unauthenticated endpoint
   - **Operational Impact:** Potential DoS via webhook spam
   - **Mitigation:** Change default bind to `127.0.0.1`

2. **H-2: API Key Persisted in Plaintext Embed Queue Files**
   - **Risk:** Credential exposure via filesystem access
   - **Operational Impact:** API key theft → unauthorized Firecrawl usage
   - **Mitigation:** Remove API key from job files, resolve at runtime

3. **H-3: Transitive Dependency Vulnerability - Axios Prototype Pollution**
   - **Risk:** DoS via prototype pollution
   - **Operational Impact:** Service crashes during scraping
   - **Mitigation:** Override Axios version or update upstream dependency

**Medium Severity:**

4. **M-1: Unbounded Request Body Parsing on Webhook**
   - **Risk:** Memory exhaustion DoS
   - **Operational Impact:** Embedder daemon crash
   - **Mitigation:** Add request body size limit (10MB)

### 7.2 Security Scanning in CI/CD ✅ IMPLEMENTED

**security.yml workflow covers:**
- ✅ Dependency vulnerabilities (`pnpm audit`)
- ✅ Secrets scanning (TruffleHog)
- ✅ Static analysis (CodeQL)
- ✅ Shell script linting (ShellCheck)

**Gaps:**
- ❌ Container image scanning (Trivy/Grype)
- ❌ SBOM generation
- ❌ License compliance checking

**Recommendation: Add container scanning**

```yaml
# .github/workflows/security.yml
jobs:
  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Build embedder image
        run: docker build -t firecrawl-embedder:${{ github.sha }} .

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'firecrawl-embedder:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## 8. Operational Metrics & SLOs

### 8.1 Recommended Service Level Objectives (SLOs)

**Availability:**
- **Target:** 99.5% uptime (monthly)
- **Measurement:** Health check success rate
- **Alert Threshold:** <99.0% (error budget consumed)

**Latency:**
- **P50 (median):** <500ms for scrape operations
- **P95:** <2 seconds for scrape operations
- **P99:** <5 seconds for scrape operations
- **Alert Threshold:** P95 >3s for 5 minutes

**Error Rate:**
- **Target:** <1% failed scrape/embed jobs
- **Measurement:** Failed job count / total job count
- **Alert Threshold:** >2% over 15 minutes

**Queue Processing:**
- **Target:** Queue size <50 jobs (steady state)
- **Target:** Max job age <5 minutes
- **Alert Threshold:** Queue size >100 or oldest job >15 minutes

**Resource Utilization:**
- **Target:** <70% CPU, <80% memory (peak)
- **Alert Threshold:** >90% for 10 minutes

### 8.2 Operational Dashboard (Recommended)

**Grafana Dashboard Panels:**

1. **Service Health Overview**
   - Service uptime (%) - last 24h
   - Current service status (up/down)
   - Container restart count

2. **Request Volume**
   - Scrapes per minute
   - Crawls per hour
   - Embed jobs per minute

3. **Performance**
   - Request latency (P50, P95, P99)
   - Job duration distribution
   - TEI response time

4. **Queue Status**
   - Current queue size
   - Jobs by status (pending/processing/completed/failed)
   - Oldest job age

5. **Resource Utilization**
   - CPU usage by container
   - Memory usage by container
   - Disk usage (Qdrant storage)
   - Network I/O

6. **Error Tracking**
   - Error rate (%)
   - Top errors by type
   - Failed jobs by service

---

## 9. Backup & Disaster Recovery

### 9.1 Current State ❌ CRITICAL GAP

**Backup Strategy:** None documented

**Data at Risk:**
1. **Qdrant Vector Database:**
   - Location: `./data/qdrant/` (default, not gitignored!)
   - Size: Unknown (grows with usage)
   - **No automated backups**
   - **Data loss on `docker compose down -v`**

2. **Embed Queue:**
   - Location: `.cache/embed-queue/`
   - Contains job metadata (including API keys - security risk)
   - **No automated cleanup beyond 24-hour retention**

3. **Job History:**
   - Location: `.cache/job-history.json`
   - **No backup, no rotation**

**Recovery Time Objective (RTO):** Unknown
**Recovery Point Objective (RPO):** Unknown

### 9.2 Recommended Backup Strategy

#### **Automated Daily Backups**

**Cron Job:** `/etc/cron.daily/firecrawl-backup.sh`

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/firecrawl"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# 1. Qdrant Snapshot
echo "Creating Qdrant snapshot..."
SNAPSHOT=$(curl -sX POST http://localhost:53333/collections/firecrawl/snapshots | jq -r '.snapshot_name')
curl -s "http://localhost:53333/collections/firecrawl/snapshots/$SNAPSHOT" \
  > "$BACKUP_DIR/qdrant-$DATE.snapshot"

# 2. Embed Queue (if contains critical data)
echo "Backing up embed queue..."
tar -czf "$BACKUP_DIR/embed-queue-$DATE.tar.gz" .cache/embed-queue/ 2>/dev/null || true

# 3. Job History
echo "Backing up job history..."
cp .cache/job-history.json "$BACKUP_DIR/job-history-$DATE.json" 2>/dev/null || true

# 4. Upload to remote storage (rclone, rsync, S3, etc.)
if command -v rclone &>/dev/null; then
  echo "Uploading to remote storage..."
  rclone copy "$BACKUP_DIR" remote:backups/firecrawl/
fi

# 5. Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.snapshot" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.json" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

#### **Restore Procedures** (See Runbook 3 above)

### 9.3 Disaster Recovery Plan

**Scenarios:**

1. **Catastrophic Server Failure**
   - RTO: 4 hours
   - RPO: 24 hours (daily backups)
   - Procedure:
     1. Provision new server
     2. Install Docker + Docker Compose
     3. Clone repository
     4. Restore Qdrant from latest snapshot
     5. Start services: `docker compose up -d`
     6. Verify health checks

2. **Data Corruption (Qdrant)**
   - RTO: 1 hour
   - RPO: 24 hours
   - Procedure:
     1. Stop Qdrant: `docker compose stop firecrawl-qdrant`
     2. Clear corrupt data: `rm -rf ./data/qdrant/*`
     3. Restore from backup (see Runbook 3)
     4. Restart Qdrant
     5. Verify collection: `curl http://localhost:53333/collections/firecrawl`

3. **Accidental `docker compose down -v`**
   - RTO: 30 minutes
   - RPO: 24 hours
   - Procedure:
     1. Immediately stop any running backups
     2. Restore Qdrant from latest snapshot
     3. Recreate volumes: `docker volume create qdrant_storage`
     4. Start services: `docker compose up -d`

---

## 10. Cost-Benefit Analysis

### 10.1 Implementation Effort Estimate

| Category | Task | Effort | Priority |
|----------|------|--------|----------|
| **Monitoring** | Prometheus + Grafana setup | 8h | **Critical** |
| **Monitoring** | Structured logging (Pino) | 6h | High |
| **Monitoring** | Health check endpoints | 4h | High |
| **Monitoring** | Alerting rules | 4h | High |
| **Runbooks** | Create 4 operational runbooks | 12h | **Critical** |
| **Runbooks** | Incident response procedures | 4h | **Critical** |
| **Backup** | Automated backup scripts | 6h | High |
| **Backup** | Restore testing | 4h | High |
| **Security** | Fix H-1 (webhook binding) | 2h | **Critical** |
| **Security** | Fix H-2 (API key storage) | 6h | **Critical** |
| **Security** | Add container scanning | 3h | Medium |
| **Infrastructure** | Add health checks to compose | 3h | High |
| **Infrastructure** | Resource limits | 2h | Medium |
| **Infrastructure** | Volume management fix | 4h | High |
| **Environment** | Secrets management | 8h | High |
| **Environment** | Environment validation | 3h | Medium |
| **TOTAL** | | **79 hours** | |

### 10.2 Resource Requirements

**Human Resources:**
- DevOps Engineer: 2 weeks full-time
- Backend Engineer (security fixes): 1 week part-time
- Technical Writer (runbooks): 3 days

**Infrastructure:**
- Prometheus: 2 CPU, 4GB RAM, 50GB storage
- Grafana: 1 CPU, 2GB RAM, 10GB storage
- Backup storage: 100GB (remote, offsite)

**Recurring Costs:**
- Backup storage: $5-10/month (cloud storage)
- Monitoring retention: $0 (self-hosted)

### 10.3 Risk vs Investment

**Without Investment:**
- **MTTR:** 2-8 hours (manual investigation)
- **Data Loss Risk:** High (no backups)
- **Security Risk:** High (H-1, H-2 unresolved)
- **Operational Burden:** High (no runbooks)

**With Investment:**
- **MTTR:** 15-30 minutes (automated alerts + runbooks)
- **Data Loss Risk:** Low (daily backups, 24h RPO)
- **Security Risk:** Medium (high-severity issues resolved)
- **Operational Burden:** Low (documented procedures)

**ROI:**
- **First incident avoided:** Saves 4-8 hours of engineering time
- **Break-even:** After 2-3 incidents
- **Long-term:** Faster onboarding, reduced toil, improved reliability

---

## 11. Prioritized Remediation Roadmap

### Phase 1: Critical (Week 1) - 32 hours

**Goal:** Eliminate critical operational blind spots

- [ ] **Monitoring Foundation** (12h)
  - Deploy Prometheus + Grafana
  - Configure basic service metrics
  - Create initial dashboard (services, resources, errors)

- [ ] **Operational Runbooks** (12h)
  - Service failure recovery runbook
  - Embed queue recovery runbook
  - Performance degradation runbook

- [ ] **Security Fixes** (8h)
  - Fix H-1: Change webhook binding to `127.0.0.1`
  - Fix H-2: Remove API keys from queue files
  - Add request body size limit (M-1)

**Success Criteria:**
- Real-time visibility into service health
- Documented recovery procedures for common failures
- High-severity security issues resolved

### Phase 2: High Priority (Week 2-3) - 31 hours

**Goal:** Establish production-grade operations

- [ ] **Backup & Recovery** (10h)
  - Automated daily backup script
  - Restore procedure documentation
  - Backup verification testing

- [ ] **Infrastructure Hardening** (9h)
  - Add health checks to all services
  - Configure resource limits (CPU/memory)
  - Fix volume management (permissions, paths)

- [ ] **Structured Logging** (6h)
  - Implement Pino structured logging
  - Replace 348 console.* calls
  - Add request correlation IDs

- [ ] **Alerting** (4h)
  - Configure Prometheus alert rules
  - Set up notification channels (email/Slack)
  - Define on-call rotation

- [ ] **Incident Response** (2h)
  - Create incident response checklist
  - Define severity levels
  - Document escalation procedures

**Success Criteria:**
- Automated backups with tested restore
- Proactive alerting on service issues
- Complete incident response procedures

### Phase 3: Medium Priority (Week 4-5) - 16 hours

**Goal:** Improve observability and automation

- [ ] **Advanced Monitoring** (6h)
  - Queue metrics endpoint
  - Custom Grafana dashboards
  - SLO tracking

- [ ] **Environment Management** (5h)
  - Secrets management implementation
  - Environment validation on startup
  - Multi-environment support (dev/staging/prod)

- [ ] **Security Enhancements** (3h)
  - Container image scanning (Trivy)
  - SBOM generation
  - License compliance checking

- [ ] **Documentation** (2h)
  - Resource planning guide
  - Capacity planning procedures
  - Performance tuning guide

**Success Criteria:**
- Comprehensive observability
- Secure secrets management
- Complete operational documentation

### Phase 4: Low Priority (Week 6+) - Ongoing

**Goal:** Continuous improvement

- [ ] **Performance Optimization**
  - Implement performance regression tests
  - Add load testing to CI/CD
  - Optimize resource usage

- [ ] **Automation**
  - Automated deployment scripts
  - Self-healing services
  - Capacity auto-scaling

- [ ] **Advanced Features**
  - Blue-green deployment support
  - Canary release automation
  - Chaos engineering tests

---

## 12. Comparison: Current vs Target State

| Aspect | Current | Target | Gap Severity |
|--------|---------|--------|--------------|
| **CI/CD Pipeline** | ✅ GitHub Actions (3 workflows) | ✅ Same + E2E tests | Low |
| **Security Scanning** | ✅ Automated (weekly) | ✅ Same + container scan | Low |
| **Deployment** | ⚠️ Manual docker-compose | Zero-downtime automation | **High** |
| **Health Checks** | ⚠️ 1/6 services | All services | **High** |
| **Monitoring** | ❌ None | Prometheus + Grafana | **Critical** |
| **Alerting** | ❌ None | Automated alerts | **Critical** |
| **Logging** | ⚠️ Console-only (348 calls) | Structured (Pino) | **High** |
| **Incident Response** | ❌ None | Runbooks + procedures | **Critical** |
| **Backup/Recovery** | ❌ None | Automated daily backups | **High** |
| **Secret Management** | ⚠️ Plaintext .env | Secrets manager | **High** |
| **Resource Limits** | ❌ None | CPU/memory limits | Medium |
| **Operational Docs** | ⚠️ Basic README | Runbooks + guides | **Critical** |

**Overall Maturity:** **Level 2/5 (Basic)**

- **Level 1:** Manual, ad-hoc operations
- **Level 2:** Basic CI/CD, manual deployments ← **Current**
- **Level 3:** Automated deployments, monitoring, runbooks ← **Target (Phase 2)**
- **Level 4:** Self-healing, auto-scaling, SLO tracking
- **Level 5:** Chaos engineering, zero-touch operations

---

## 13. Key Recommendations Summary

### Immediate Actions (This Week)

1. **Add health checks to docker-compose.yaml** (3h)
   - Prevents cascade failures
   - Enables automated recovery

2. **Fix embed queue permissions** (1h)
   - Change Docker user to non-root
   - Prevents permission errors

3. **Deploy basic monitoring** (8h)
   - Prometheus + Grafana
   - Immediate visibility into issues

4. **Create service failure runbook** (4h)
   - Reduces MTTR by 80%
   - Enables junior engineers to respond

### Short-Term (Next 2 Weeks)

5. **Implement automated backups** (10h)
   - Eliminates data loss risk
   - 24-hour RPO acceptable for non-critical system

6. **Fix security issues H-1, H-2** (8h)
   - Prevents unauthorized access
   - Protects API credentials

7. **Add structured logging** (6h)
   - Enables log aggregation
   - Improves debugging efficiency

### Medium-Term (Next Month)

8. **Configure alerting** (4h)
   - Proactive issue detection
   - Reduces incident discovery time

9. **Implement secrets management** (8h)
   - Eliminates plaintext credentials
   - Enables secret rotation

10. **Document all runbooks** (12h)
    - Complete incident response coverage
    - Knowledge transfer to team

---

## 14. Conclusion

The cli-firecrawl project has **strong CI/CD foundations** with GitHub Actions for testing, security scanning, and releases. However, it suffers from **critical operational gaps** in monitoring, incident response, and production readiness that must be addressed before any production deployment.

### Strengths

- ✅ Comprehensive CI/CD workflows (ci.yml, release.yml, security.yml)
- ✅ Automated dependency scanning and secrets detection
- ✅ Pre-commit hooks with lint-staged integration
- ✅ Graceful shutdown handling in services
- ✅ Version-controlled infrastructure (docker-compose.yaml)
- ✅ Log rotation configured

### Critical Gaps

1. **Zero monitoring/observability** - No Prometheus, Grafana, or metrics
2. **No operational runbooks** - MTTR unknown, likely hours
3. **No backup/recovery** - Data loss risk on failure
4. **Incomplete health checks** - Only 1/6 services monitored
5. **Console-only logging** - 348 console.* calls, no structure
6. **Security issues unresolved** - H-1, H-2 from prior audit

### Recommended Next Steps

**Week 1 (32 hours):**
1. Deploy Prometheus + Grafana
2. Create 3 critical runbooks
3. Fix high-severity security issues (H-1, H-2)

**Week 2-3 (31 hours):**
1. Implement automated backups
2. Add health checks to all services
3. Set up structured logging
4. Configure alerting

**Total Investment:** ~79 hours over 3-4 weeks to reach production-ready state

**ROI:** First major incident avoided will save 4-8 hours of engineering time, breaking even after 2-3 incidents

---

## 15. References

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Docker Compose Health Checks](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [Incident Response Best Practices (PagerDuty)](https://response.pagerduty.com/)
- [Google SRE Book - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [The Twelve-Factor App - Config](https://12factor.net/config)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

**Document Version:** 1.0
**Author:** DevOps Engineering Analysis
**Review Status:** Draft
**Next Review:** After Phase 1 implementation (monitoring + runbooks)
