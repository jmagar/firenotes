# Claude Code Automations - Quick Reference

## Skills (Type to Use)

### `/test-command <command>`
Run tests for a specific CLI command with type-checking.
```bash
/test-command scrape
/test-command crawl
```

### `/docker-health`
Check all 7 Docker services + embedding model info.
```bash
/docker-health
```

---

## Hooks (Automatic)

### Auto-Format
✓ Runs Biome on `.ts`, `.json`, `.md` files after edit
✓ Immediate feedback, continues on warnings

### Auto-Rebuild
✓ Runs `pnpm build` after editing `src/**/*.ts` (non-test)
✓ Keeps `dist/` in sync, blocks on build errors

### Block Critical Files
✗ Prevents editing `docker-compose.yaml`, `pnpm-lock.yaml`, `.env`
✗ Requires explicit permission

---

## Agents (Spawned by Skills)

### `cli-tester`
Deep test failure analysis:
- Identifies root causes (mock leaks, env leaks, timeouts)
- Provides code snippet fixes
- Reports coverage gaps

### `docker-debugger`
Deep infrastructure diagnostics:
- Analyzes logs for errors and crash loops
- Validates configuration
- Network diagnostics (remote TEI connectivity)
- Provides remediation steps

---

## Common Commands

```bash
# Quick test run
/test-command scrape

# Infrastructure check
/docker-health

# Deep test analysis (after failures)
"Can you analyze the test failures?"
→ Spawns cli-tester agent

# Deep Docker diagnostics (after service failures)
"Can you diagnose the embedder issue?"
→ Spawns docker-debugger agent

# Manual commands (if needed)
pnpm test:unit                    # All unit tests
pnpm test:e2e                     # All E2E tests
docker compose ps                 # Service status
docker logs firecrawl-embedder    # Service logs
```

---

## File Locations

```
.claude/
├── skills/
│   ├── test-command/SKILL.md     # Test command skill
│   └── docker-health/SKILL.md    # Docker health skill
├── agents/
│   ├── cli-tester.md             # Testing specialist
│   └── docker-debugger.md        # Docker diagnostics
└── settings.local.json           # Hooks configuration
```

---

## When to Use What

| Situation | Use |
|-----------|-----|
| Just edited a command | `/test-command <name>` |
| Tests failing, need analysis | Spawn `cli-tester` agent |
| Starting development | `/docker-health` |
| Embeddings not working | `/docker-health` + spawn `docker-debugger` |
| Service unhealthy | Spawn `docker-debugger` agent |
| Editing blocked files | Ask permission first |
| Need to format manually | `pnpm biome check --write <file>` |
| Need to rebuild manually | `pnpm build` |

---

## Tips

💡 Skills provide **quick feedback** (5-10s)
💡 Agents provide **deep analysis** (30-60s)
💡 Hooks run **automatically** (no need to invoke)
💡 `/docker-health` **always shows embedding model** first
💡 Blocked files require **explicit permission**

---

## Troubleshooting

**Hooks not working?**
- Check `.claude/settings.local.json` syntax
- Restart Claude Code session

**Skills not found?**
- Type `/` to see available skills
- Check `.claude/skills/*/SKILL.md` files exist

**Agent not spawning?**
- Skills don't auto-spawn agents
- Explicitly ask Claude to analyze/diagnose

**Build failing on every edit?**
- Fix TypeScript errors first
- Hook blocks until build passes
