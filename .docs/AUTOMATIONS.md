# CLI Firecrawl - Claude Code Automations

## Overview

This project includes custom Claude Code skills, agents, and hooks to streamline development workflows.

## Skills (User-Invocable)

### `/test-command <command-name>`

Run unit tests for a specific CLI command with type-checking.

**Usage**:
```bash
/test-command scrape    # Test the scrape command
/test-command crawl     # Test all crawl-related tests
/test-command config    # Test the config command
```

**What it does**:
1. Validates command exists in `src/commands/`
2. Runs TypeScript type-check first (fail fast)
3. Executes Vitest on command's test files
4. Shows styled output with pass/fail summary
5. Can spawn `cli-tester` agent for deep analysis if tests fail

**When to use**:
- During TDD workflow when editing command implementations
- Before committing changes to verify tests still pass
- Quick feedback loop for specific command changes

---

### `/docker-health`

Check health of all 7 Docker services with embedding model information.

**Usage**:
```bash
/docker-health
```

**What it does**:
1. **Displays embedding model info banner** (always first):
   - Model: Qwen/Qwen3-Embedding-0.6B
   - Service: TEI (Text Embeddings Inference)
   - Location: steamy-wsl (100.74.16.82:52000)
   - Hardware: RTX 4070 GPU
2. Checks health of all 7 services:
   - firecrawl (53002) - Main API
   - embedder (53000) - Async embedding daemon
   - patchright (53006) - Browser scraping
   - qdrant (53333) - Vector database
   - redis (53379) - Job queue
   - rabbitmq - Message broker
   - remote-tei (100.74.16.82:52000) - GPU embeddings
3. Shows metadata (queue stats, vector counts, response times)
4. Provides suggested fixes for unhealthy services
5. Can spawn `docker-debugger` agent for deep diagnostics

**When to use**:
- Before starting development (verify infrastructure is ready)
- When embeddings aren't working (check TEI connectivity)
- After `docker compose up` (verify all services started correctly)
- When troubleshooting service failures

---

## Agents (Deep Analysis)

### `cli-tester`

Testing specialist for comprehensive test diagnostics.

**Spawned by**: `/test-command` skill when tests fail or user requests deep analysis

**Capabilities**:
- Execute tests with Vitest (unit, E2E, integration)
- Parse JSON output for structured analysis
- Identify common failure patterns:
  - Mock reset issues (missing `resetTeiCache()` or `resetQdrantCache()`)
  - Environment leaks (missing `vi.stubEnv()`)
  - Docker dependencies (services not running)
  - Timeouts (async operations, slow services)
- Provide code snippets for fixes
- Report coverage gaps and recommend new test cases

**Typical Output**:
```
🔍 Analyzing test failures for crawl command...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FAILURE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Assertion Failures (2)
  1. src/__tests__/commands/crawl/command.test.ts:67
     Root Cause: Mock state leaked from previous test
     Fix: Add resetQdrantCache() to afterEach hook

✗ Timeout Failures (1)
  3. src/__tests__/commands/crawl/polling.test.ts:89
     Root Cause: Polling interval set to 10s, test timeout 5s
     Fix: Increase test timeout or reduce poll interval

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RECOMMENDED ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Add cache reset to afterEach:
   [code snippet provided]

2. Increase timeout for polling test:
   [code snippet provided]
```

---

### `docker-debugger`

Docker infrastructure diagnostics specialist for the 7-service stack.

**Spawned by**: `/docker-health` skill when services are unhealthy or user requests diagnostics

**Capabilities**:
- Check service health (container status, HTTP endpoints, dependencies)
- Analyze logs (extract errors, identify crash loops, trace request flows)
- Validate configuration (.env, docker-compose.yaml, volume mounts)
- Network diagnostics (internal connectivity, remote TEI, port conflicts)
- Provide remediation steps with exact commands

**Common Failure Patterns**:
- Embedder not running (TEI connection issues)
- Remote TEI unreachable (network/Tailscale issues)
- Qdrant collections not found (fresh install, auto-created on first embed)
- RabbitMQ unhealthy (startup delays, 30-60s to become healthy)
- Patchright timeout bug (missing patchright-app.py mount)
- Port conflicts (services using same port)

**Typical Output**:
```
🔍 Diagnosing embedding infrastructure...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SERVICE HEALTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ firecrawl (53002) - running
✗ embedder (53000) - unhealthy [Connection refused]
✓ qdrant (53333) - healthy [1245 vectors]
✗ remote-tei (100.74.16.82:52000) - unreachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ROOT CAUSE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary Issue: Remote TEI service unreachable
- Embedder daemon can't connect to steamy-wsl:52000
- Network connectivity issue or TEI service down

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REMEDIATION STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Check network connectivity: ping -c 3 100.74.16.82
2. Verify TEI service on steamy-wsl: [commands provided]
3. Restart embedder: docker compose restart firecrawl-embedder
```

---

## Hooks (Automatic)

### Auto-Format (PostToolUse)

Automatically runs `pnpm biome check --write` on TypeScript, JSON, and Markdown files after Edit/Write.

**Triggers**: Edit or Write tool on `.ts`, `.json`, `.md` files

**Behavior**:
- Formats and lints the file automatically
- Shows Biome output for visibility
- Continues even if Biome reports warnings (`continueOnFailure: true`)
- Complements Husky pre-commit hook (immediate feedback vs final validation)

**Example**:
```
[Edit tool used on src/commands/scrape.ts]
→ Formatting with Biome...
✓ Formatted 1 file
```

---

### Auto-Rebuild (PostToolUse)

Automatically runs `pnpm build` after non-test TypeScript file changes in `src/`.

**Triggers**: Edit or Write tool on `src/**/*.ts` files (excluding `*.test.ts`)

**Behavior**:
- Rebuilds CLI to keep `dist/` in sync with source
- Skips test files to avoid unnecessary rebuilds
- Blocks if build fails (`continueOnFailure: false`)
- Essential for testing CLI commands via `pnpm local`

**Example**:
```
[Edit tool used on src/commands/scrape.ts]
→ Rebuilding TypeScript...
✓ Built in 1.2s
```

---

### Block Critical Files (PreToolUse)

Prevents accidental edits to critical infrastructure files.

**Triggers**: Edit or Write tool on `docker-compose.yaml`, `pnpm-lock.yaml`, `.env`

**Behavior**:
- Blocks the edit with error message
- Requires explicit user permission
- Prevents accidental modifications to:
  - `docker-compose.yaml` - Controls 7-service stack
  - `pnpm-lock.yaml` - Auto-generated by pnpm
  - `.env` - Contains secrets

**Example**:
```
[Edit tool attempted on docker-compose.yaml]
🚨 BLOCKED: Critical infrastructure file.

- docker-compose.yaml: Controls 7-service stack
- pnpm-lock.yaml: Auto-generated by pnpm
- .env: Contains secrets

Ask user for permission before editing.
```

---

## Workflow Examples

### TDD Workflow
```bash
# 1. Edit command implementation
[Edit src/commands/scrape.ts]
→ Auto-format with Biome ✓
→ Auto-rebuild TypeScript ✓

# 2. Run tests for that command
/test-command scrape
→ Type check ✓
→ Tests run... ✗ 2 failures

# 3. Deep analysis (spawns cli-tester agent)
"Can you analyze the test failures?"
→ Agent identifies mock reset issue
→ Agent provides code snippet fix

# 4. Apply fix and re-test
[Edit test file with suggested fix]
→ Auto-format with Biome ✓

/test-command scrape
→ Tests run... ✓ All pass
```

### Infrastructure Troubleshooting
```bash
# 1. Check service health
/docker-health
→ Embedding model info displayed
→ All services checked
→ Embedder unhealthy ✗

# 2. Deep diagnostics (spawns docker-debugger agent)
"Can you diagnose the embedder issue?"
→ Agent checks logs
→ Agent identifies TEI connection issue
→ Agent provides remediation steps

# 3. Apply fix
docker restart firecrawl-embedder

# 4. Verify
/docker-health
→ All services healthy ✓
```

---

## Configuration

All automations are configured in:
- `.claude/settings.local.json` - Hooks configuration
- `.claude/skills/` - Skill definitions
- `.claude/agents/` - Agent definitions

---

## Tips

1. **Use skills for quick feedback**: `/test-command` and `/docker-health` provide immediate results
2. **Spawn agents for deep analysis**: When skills show failures, ask Claude to investigate using agents
3. **Hooks run automatically**: You don't need to invoke them, they trigger on file edits
4. **Critical file protection**: If you need to edit blocked files, explicitly ask permission first
5. **Embedding model visibility**: `/docker-health` always shows model info to reinforce embeddings are enabled

---

## Troubleshooting

**Hooks not running**:
- Check `.claude/settings.local.json` syntax
- Verify `disableAllHooks` is not set to `true`
- Check file patterns in hook matchers

**Skills not found**:
- Verify `.claude/skills/*/SKILL.md` files exist
- Check YAML frontmatter format
- Restart Claude Code session

**Agents not spawning**:
- Verify `.claude/agents/*.md` files exist
- Check agent markdown format
- Skills must explicitly spawn agents (not automatic)

**Build failures on edit**:
- Check TypeScript compilation errors
- Verify `pnpm build` works manually
- Hook will block further edits until fixed
