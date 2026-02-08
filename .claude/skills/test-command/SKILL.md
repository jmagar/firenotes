---
name: test-command
description: This skill should be used when the user wants to test individual CLI commands before committing code. Trigger phrases include "test the scrape command", "run tests for crawl", "check if config tests pass", "test my changes to extract", "verify command tests". Executes Vitest on a specific command's test file with TypeScript type-checking and styled output for TDD workflow.
disable-model-invocation: false
---

# Test Command Skill

Runs unit tests for a specific CLI command with TypeScript type-checking and styled output.

## Usage

```bash
/test-command <command-name>
```

**Examples:**
- `/test-command scrape` - Test the scrape command
- `/test-command crawl` - Test all crawl-related tests (subdirectory)
- `/test-command config` - Test the config command

## Instructions

### When to Use This Skill

**MUST use when:**
- Working on a specific command implementation (TDD workflow)
- Need quick validation before committing code changes
- Debugging a failing test in isolation
- Following red-green-refactor cycle

**DO NOT use when:**
- Running full CI/CD pipeline (use `pnpm test` instead)
- Need to check for cross-command regressions (use full test suite)
- Running integration or E2E tests across all commands

### Required Execution Method

**MUST run the test script FIRST:**

```bash
bash .claude/skills/test-command/scripts/test-command.sh <command-name>
```

**This script automatically:**
1. Validates command exists in `src/commands/` (handles files and subdirectories)
2. Runs TypeScript type-check FIRST (fails fast on errors)
3. Executes Vitest on command's test files
4. Displays color-coded results (green ✓ or red ✗)
5. Exits 0 if tests pass, exits 1 if tests fail

**Examples:**
```bash
bash .claude/skills/test-command/scripts/test-command.sh scrape
bash .claude/skills/test-command/scripts/test-command.sh crawl
```

### When to Spawn cli-tester Agent

**MUST spawn the agent when:**
- Script exits 1 (tests failed)
- User requests detailed diagnostics or root cause analysis
- Multiple tests are failing (need comprehensive failure analysis)
- Need to identify common patterns (mock leaks, env leaks, timeouts)

**Example trigger:**
```
Script output: "✗ Tests failed - Fix failing tests before committing"
→ Spawn cli-tester agent for deep diagnostics
```

### Manual Test Execution (Alternative)

If script is unavailable or user needs custom test execution, use the detailed workflow in **`references/bash-implementation.md`**.

### Output Examples

For real-world output examples, see **`examples/test-outputs.md`** which includes:
- Successful test runs
- Failed tests with error details
- Type check failures
- Command not found errors
- Subdirectory commands (e.g., crawl with 7 test files)
- E2E test failures when Docker services are down
- Timeout failures

## Edge Cases

1. **Invalid command name**: Shows list of all available commands (both files and directories)
2. **No test file found**: Warns but exits 0 (some commands may not have tests yet)
3. **Subdirectories** (e.g., `crawl/`): Runs all test files in directory (multiple test suites)
4. **Type check failure**: Exits immediately with error before running tests (fail fast)
5. **Docker services down**: E2E tests fail with connection errors (check `docker compose ps`)

## Integration with cli-tester Agent

This skill can spawn the `cli-tester` agent for deep analysis when:
- Tests fail and root cause is unclear
- User requests detailed diagnostics
- Coverage analysis is needed

**Agent capabilities:**
- Parses Vitest JSON output for structured analysis
- Identifies common patterns (mock leaks, env leaks, timeouts)
- Provides code snippet fixes
- Reports coverage gaps

**Skill provides quick feedback, agent provides deep investigation.**

## Supporting Files

### References
- **`references/bash-implementation.md`** - Complete bash implementation with all 4 steps

### Examples
- **`examples/test-outputs.md`** - Real-world output examples for success/failure scenarios
