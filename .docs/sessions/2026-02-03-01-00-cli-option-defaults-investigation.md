# CLI Option Defaults Investigation Session

**Date**: 2026-02-03 01:00 EST
**Branch**: feat/phase-3-legacy-cleanup
**Duration**: ~45 minutes

## Session Overview

Investigated how the CLI handles default option values when users attempt to override them at runtime. Discovered and fixed a critical bug where `parseInt` used as a Commander.js parser function with a default value caused incorrect parsing due to JavaScript's radix parameter.

## Timeline

1. **01:00** - Received request to investigate option override behavior
2. **01:05** - Read command implementations (map.ts, search.ts, crawl/command.ts, crawl/options.ts)
3. **01:15** - Created test harness to verify Commander.js option handling
4. **01:25** - Discovered parseInt radix bug through testing
5. **01:35** - Verified bug exists in actual CLI with real command execution
6. **01:40** - Applied fix and verified all test cases pass
7. **01:45** - Ran test suite, cleaned up test files

## Key Findings

### Critical Bug: parseInt Radix Issue

**Location**: `src/commands/crawl/command.ts:344`

**Problem**: When using `parseInt` directly as a Commander.js parser function with a default value, Commander passes the default value as the second argument. JavaScript's `parseInt(string, radix)` interprets this as the number base.

```typescript
// BROKEN: Commander calls parseInt('5', 3) when user runs --max-depth 5
.option('--max-depth <number>', 'desc', parseInt, 3)
```

**Impact**:
| Command | Expected | Actual (Before Fix) |
|---------|----------|---------------------|
| `--max-depth 5` | 5 | NaN ('5' invalid in base 3) |
| `--max-depth 10` | 10 | 3 ('10' in base 3 = 3) |
| `--max-depth 1` | 1 | 1 ('1' valid in base 3) |

### Other Defaults Verified Working

1. **Boolean options with `--no-*` negation**: Work correctly
   - `--only-main-content` defaults to `true`
   - `--no-only-main-content` correctly sets to `false`

2. **String options with defaults**: Work correctly
   - `--exclude-tags` defaults to `"nav,footer"`
   - Can be overridden with custom value

3. **`parseFloat` options**: Work correctly (only takes one argument)

### Safe parseInt Uses (No Bug)

These uses don't have default values, so they're safe:
- `src/commands/map.ts:260` - `--limit` option
- `src/commands/crawl/command.ts:340` - `--limit` option
- `src/commands/crawl/command.ts:388` - `--delay` option

## Technical Decisions

### Fix Choice: Arrow Function Wrapper

Selected approach:
```typescript
(value: string) => parseInt(value, 10)
```

**Rationale**:
- Explicitly specifies base-10 parsing
- Ignores Commander's second argument (default value)
- Type-safe with explicit parameter type
- Minimal change with maximum clarity

**Alternatives Considered**:
- `Number()` constructor - less explicit about integer parsing
- Custom parsing utility - over-engineering for single use case

## Files Modified

| File | Change |
|------|--------|
| `src/commands/crawl/command.ts:344` | Fixed parseInt parser to use arrow function wrapper |

## Commands Executed

```bash
# Build verification
pnpm build  # Succeeded

# Test option parsing behavior (created temporary test files)
node test-commander-behavior.mjs
node test-option-override.mjs

# Actual CLI verification showing bug
node dist/index.js crawl http://example.com --max-depth 5
# Output: maxDepth=NaN (before fix)
# Output: maxDepth=5 (after fix)

# Full test suite
pnpm test  # 617 passed, 4 failed (unrelated to this fix)

# Cleanup
rm test-commander-behavior.mjs test-option-override.mjs
```

## Test Results

### Before Fix
```
--max-depth 5:  maxDepth=NaN
--max-depth 10: maxDepth=3
--max-depth 1:  maxDepth=1
```

### After Fix
```
--max-depth 5:  maxDepth=5  ✓
--max-depth 10: maxDepth=10 ✓
--max-depth 1:  maxDepth=1  ✓
```

## Next Steps

1. **Test the 4 failing embedpipeline tests** - These appear to be pre-existing failures unrelated to this fix
2. **Consider adding unit tests** for option parsing with explicit override scenarios
3. **Audit other CLI projects** using Commander.js for the same parseInt pattern
4. **Document this gotcha** in project CLAUDE.md for future reference

## Lessons Learned

1. **JavaScript's parseInt radix gotcha** - Always wrap parseInt in arrow function when using as callback
2. **Commander.js parser signature** - Parser functions receive `(value, previousValue)` where previousValue can be the default
3. **Test actual CLI execution** - Unit tests may not catch integration issues with CLI frameworks
