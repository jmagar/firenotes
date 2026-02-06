---
name: docker-health
description: This skill should be used when the user asks about Docker service health, infrastructure status, or deployment verification. Trigger phrases include "are services running", "check docker health", "is everything up", "show me service status", "is the embedder working", "check infrastructure", "verify deployment", "why isn't firecrawl responding", "docker status", "health check". Checks all 7 Docker services and displays embedding model information.
disable-model-invocation: false
---

# Docker Health Skill

Verifies all 7 Docker services are healthy with prominent embedding model information display.

## Usage

```bash
/docker-health
```

## Instructions

### When to Use This Skill

**MUST use when:**
- User asks about Docker service health or infrastructure status
- Before starting development (verify infrastructure is ready)
- Embeddings aren't working (check TEI connectivity)
- After `docker compose up` (verify all services started correctly)
- Troubleshooting service failures or connectivity issues

**DO NOT use when:**
- Checking individual application logs (use `docker logs` directly)
- Deploying new containers (use `docker compose up -d`)
- Managing Docker volumes or networks (use Docker CLI directly)

### Required Execution Method

**MUST run the health check script FIRST:**

```bash
bash .claude/skills/docker-health/scripts/health-check.sh
```

**This script automatically:**
- Displays embedding model information banner (ALWAYS shown first)
- Checks all 7 services with color-coded output
- Shows metadata (queue stats, vector counts, response times)
- Provides suggested remediation commands for failures
- Exits 0 if all healthy, exits 1 if any unhealthy

### When to Spawn docker-debugger Agent

**MUST spawn the agent when:**
- Script exits 1 (services are unhealthy)
- User requests detailed diagnostics or root cause analysis
- Multiple services are failing (need comprehensive log analysis)
- Network connectivity issues suspected (remote TEI unreachable)

**Example trigger:**
```
Script output: "Status: Degraded - fix unhealthy services ✗"
→ Spawn docker-debugger agent for deep diagnostics
```

### Manual Service Checks (Alternative)

If script is unavailable or user needs individual service checks, use the detailed commands below.

### Display Embedding Model Information First

Display embedding model information at the top of output to provide immediate context about the TEI service configuration. Use this banner format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EMBEDDING MODEL INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Model: Qwen/Qwen3-Embedding-0.6B
✓ Service: Hugging Face Text Embeddings Inference (TEI)
✓ Location: steamy-wsl (100.74.16.82:52000)
✓ Hardware: RTX 4070 GPU
✓ Vector Dimension: 1024
✓ Endpoints: /embed (native), /v1 (OpenAI-compatible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Services to Check (7 total)

Check these services in order:

#### 1. Firecrawl API (Port 53002)
```bash
STATUS=$(curl -s --max-time 5 http://localhost:53002/health || echo "ERROR")
if [ "$STATUS" != "ERROR" ]; then
  echo "✓ firecrawl (53002) - healthy"
else
  echo "✗ firecrawl (53002) - unhealthy [Connection refused]"
  echo "  → docker restart firecrawl"
  echo "  → docker logs firecrawl --tail 50"
fi
```

#### 2. Embedder Daemon (Port 53000)
```bash
# Health check
HEALTH=$(curl -s --max-time 5 http://localhost:53000/health || echo "ERROR")

# Queue status
STATUS=$(curl -s --max-time 5 http://localhost:53000/status || echo "ERROR")

if [ "$HEALTH" != "ERROR" ]; then
  # Extract queue stats from JSON response
  PENDING=$(echo "$STATUS" | jq -r '.pending // 0')
  PROCESSING=$(echo "$STATUS" | jq -r '.processing // 0')
  echo "✓ embedder (53000) - healthy [${PENDING} pending, ${PROCESSING} processing]"
else
  echo "✗ embedder (53000) - unhealthy [Connection refused]"
  echo "  → docker restart firecrawl-embedder"
  echo "  → docker logs firecrawl-embedder --tail 50"
fi
```

#### 3. Patchright (Port 53006 - Internal)
```bash
STATUS=$(docker inspect firecrawl-playwright --format '{{.State.Status}}' 2>/dev/null || echo "ERROR")
if [ "$STATUS" = "running" ]; then
  echo "✓ patchright (53006) - running"
else
  echo "✗ patchright (53006) - $STATUS"
  echo "  → docker restart firecrawl-playwright"
  echo "  → docker logs firecrawl-playwright --tail 50"
fi
```

#### 4. Qdrant (Port 53333)
```bash
# Health check
HEALTH=$(curl -s --max-time 5 http://localhost:53333/health || echo "ERROR")

# Collection stats
COLLECTION=$(curl -s --max-time 5 http://localhost:53333/collections/firecrawl 2>/dev/null || echo "ERROR")

if [ "$HEALTH" != "ERROR" ]; then
  if [ "$COLLECTION" != "ERROR" ]; then
    VECTORS=$(echo "$COLLECTION" | jq -r '.result.vectors_count // 0')
    echo "✓ qdrant (53333) - healthy [${VECTORS} vectors]"
  else
    echo "✓ qdrant (53333) - healthy [no collections yet]"
  fi
else
  echo "✗ qdrant (53333) - unhealthy [Connection refused]"
  echo "  → docker restart firecrawl-qdrant"
  echo "  → docker logs firecrawl-qdrant --tail 50"
fi
```

#### 5. Redis (Port 53379 - Internal)
```bash
PING=$(docker exec firecrawl-redis redis-cli -p 53379 PING 2>/dev/null || echo "ERROR")
if [ "$PING" = "PONG" ]; then
  echo "✓ redis (53379) - healthy"
else
  echo "✗ redis (53379) - unhealthy"
  echo "  → docker restart firecrawl-redis"
  echo "  → docker logs firecrawl-redis --tail 50"
fi
```

#### 6. RabbitMQ (Internal)
```bash
HEALTH=$(docker inspect firecrawl-rabbitmq --format '{{.State.Health.Status}}' 2>/dev/null || echo "ERROR")
if [ "$HEALTH" = "healthy" ]; then
  echo "✓ rabbitmq - healthy"
elif [ "$HEALTH" = "starting" ]; then
  echo "⚠ rabbitmq - starting (wait 30-60s)"
else
  echo "✗ rabbitmq - $HEALTH"
  echo "  → docker restart firecrawl-rabbitmq"
  echo "  → docker logs firecrawl-rabbitmq --tail 50"
fi
```

#### 7. Remote TEI (100.74.16.82:52000)
```bash
INFO=$(curl -s --max-time 5 http://100.74.16.82:52000/info || echo "ERROR")
if [ "$INFO" != "ERROR" ]; then
  MODEL=$(echo "$INFO" | jq -r '.model_id // "unknown"')
  echo "✓ remote-tei (100.74.16.82:52000) - healthy [${MODEL}]"
else
  echo "✗ remote-tei (100.74.16.82:52000) - unreachable"
  echo "  → Check TEI service on steamy-wsl"
  echo "  → ping -c 3 100.74.16.82"
  echo "  → Verify firewall/Tailscale ACLs"
fi
```

### Summary

Display final summary:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HEALTHY_COUNT=$(grep -c "✓" <<< "$OUTPUT")
TOTAL_COUNT=7
echo "Services: ${HEALTHY_COUNT}/${TOTAL_COUNT} healthy"

if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ]; then
  echo "Status: All systems operational ✓"
else
  echo "Status: Degraded - fix unhealthy services ✗"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Color Coding

- **Green ✓**: Healthy, responding < 1s
- **Yellow ⚠**: Degraded, responding 1-5s or high queue
- **Red ✗**: Unhealthy, not responding or error

## Metadata Display

- **Embedder**: Queue stats `[X pending, Y processing]`
- **Qdrant**: Vector count `[N vectors]`
- **TEI**: Model name `[Qwen3-Embedding-0.6B]`
- **All services**: Response times for HTTP checks

## Integration

This skill can spawn the `docker-debugger` agent for deep diagnostics:

- If services are unhealthy, suggest using the agent for root cause analysis
- Agent provides log analysis, network diagnostics, and remediation steps
- Skill provides quick health overview, agent provides detailed investigation

## Output Format

Uses project's `theme.ts` utilities for consistent styling:

- Green ✓ for healthy services
- Red ✗ for unhealthy services
- Yellow ⚠ for degraded/starting services
- Dim text for suggested commands
