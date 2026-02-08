# CLI Firecrawl - Skill Development Patterns

This document defines the architectural patterns and best practices for creating skills in the CLI Firecrawl project.

## Core Architecture Pattern

All skills in this project follow the **Script-First Agent-Spawning Architecture**:

```
User invokes skill (/skill-name)
  ↓
Skill MUST run executable script FIRST
  ↓
Script performs automated checks
  ↓
Script outputs color-coded results + exit code
  ↓
Exit 0 (success) → Display results, done
Exit 1 (failure) → MUST spawn agent for deep analysis
  ↓
Agent provides detailed diagnostics and remediation
```

### Why This Pattern?

1. **Quick Feedback**: Scripts provide instant automated checks
2. **Reusable Utilities**: Scripts can be run standalone outside Claude
3. **Clear Delegation**: Skills orchestrate, scripts execute, agents diagnose
4. **Consistent UX**: All skills follow the same flow
5. **Efficient Context**: Scripts don't load into context, agents only spawn when needed

---

## Directory Structure

### Required Structure

```
.claude/skills/
└── skill-name/
    ├── SKILL.md (REQUIRED)
    └── scripts/
        └── skill-name.sh (REQUIRED for this project)
```

### Complete Structure

```
.claude/skills/
└── skill-name/
    ├── SKILL.md (REQUIRED)
    ├── scripts/ (REQUIRED)
    │   └── skill-name.sh (executable automation script)
    ├── references/ (OPTIONAL)
    │   └── detailed-implementation.md (deep technical details)
    └── examples/ (OPTIONAL)
        └── real-world-outputs.md (example scenarios)
```

---

## SKILL.md Template

### YAML Frontmatter (Required)

```yaml
---
name: skill-name
description: This skill should be used when the user asks to "trigger phrase 1", "trigger phrase 2", "trigger phrase 3". Include specific phrases users would say. Describes what the skill does and when to use it.
disable-model-invocation: false
---
```

**Critical Requirements:**
- Use third-person: "This skill should be used when..."
- Include 3-5 specific trigger phrases users would actually say
- Be concrete and specific, not vague or generic
- Keep under 300 characters for description

### SKILL.md Body Template

```markdown
# Skill Name

Brief description of what this skill does (1-2 sentences).

## Instructions

### When to Use This Skill

**MUST use when:**
- Specific scenario 1 (be concrete)
- Specific scenario 2 (be concrete)
- Specific scenario 3 (be concrete)

**DO NOT use when:**
- Alternative scenario 1 (when to use something else)
- Alternative scenario 2 (when to use something else)

### Required Execution Method

**MUST run the script FIRST:**

```bash
bash .claude/skills/skill-name/scripts/skill-name.sh [args]
```

**This script automatically:**
- Action 1 (what the script does)
- Action 2 (what the script does)
- Action 3 (what the script does)
- Exits 0 if successful, exits 1 if failed

**Examples:**
```bash
bash .claude/skills/skill-name/scripts/skill-name.sh example1
bash .claude/skills/skill-name/scripts/skill-name.sh example2
```

### When to Spawn [agent-name] Agent

**MUST spawn the agent when:**
- Script exits 1 (operation failed)
- User requests detailed diagnostics or root cause analysis
- Specific condition 1 (be concrete)
- Specific condition 2 (be concrete)

**Example trigger:**
```
Script output: "[failure message]"
→ Spawn [agent-name] agent for deep diagnostics
```

### Manual Execution (Alternative)

If script is unavailable or user needs custom execution, see **`references/implementation.md`** for detailed workflow.

## Edge Cases

1. **Edge case 1**: How to handle it
2. **Edge case 2**: How to handle it
3. **Edge case 3**: How to handle it

## Integration with [Agent Name]

This skill spawns the `[agent-name]` agent for deep analysis when:
- Condition 1
- Condition 2

**Agent capabilities:**
- Capability 1
- Capability 2

**Skill provides quick feedback, agent provides deep investigation.**

## Supporting Files

### Scripts (Required)
- **`scripts/skill-name.sh`** - Executable automation script

### References (Optional)
- **`references/implementation.md`** - Detailed implementation workflow

### Examples (Optional)
- **`examples/outputs.md`** - Real-world output examples
```

**Target Word Count**: 500-1500 words for SKILL.md body

---

## Script Requirements

### Template: scripts/skill-name.sh

```bash
#!/bin/bash
# Skill Name - Brief description
# Usage: skill-name.sh [args]

set -e

# Colors (only if TTY)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;36m'
  DIM='\033[2m'
  BOLD='\033[1m'
  NC='\033[0m' # No Color
else
  GREEN=''
  RED=''
  YELLOW=''
  BLUE=''
  DIM=''
  BOLD=''
  NC=''
fi

# Parse arguments
ARG="${1:-}"

if [ -z "$ARG" ]; then
  echo -e "${RED}✗ Error: Argument required${NC}"
  echo ""
  echo "Usage: skill-name.sh <arg>"
  exit 1
fi

# Change to project root (4 levels up from scripts/)
# Path: .claude/skills/skill-name/scripts/ → .claude/skills/skill-name/ → .claude/skills/ → .claude/ → project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Validation
echo -e "${BOLD}→ Validating...${NC}"
# Validation logic here
if [ condition ]; then
  echo -e "${GREEN}✓${NC} Validation passed"
else
  echo -e "${RED}✗${NC} Validation failed"
  exit 1
fi

# Step 2: Main Operation
echo ""
echo -e "${BOLD}→ Running main operation...${NC}"
# Main logic here

# Capture exit code
set +e
main_command
EXIT_CODE=$?
set -e

# Step 3: Output Results
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✓ Operation successful${NC}"
  echo ""
  echo -e "${BLUE}Success message${NC}"
  exit 0
else
  echo -e "${RED}✗ Operation failed${NC}"
  echo ""
  echo -e "${YELLOW}Failure message${NC}"
  echo ""
  echo -e "${DIM}For detailed diagnostics, ask Claude to spawn the [agent-name] agent${NC}"
  exit 1
fi
```

### Script Requirements Checklist

- [ ] Shebang: `#!/bin/bash`
- [ ] `set -e` for fail-fast behavior
- [ ] Color codes with TTY detection
- [ ] Argument validation with usage message
- [ ] Project root resolution (4 levels up from scripts/)
- [ ] Step-by-step execution with status messages
- [ ] Color-coded output (green ✓, red ✗, yellow ⚠, blue info)
- [ ] Proper exit codes (0 = success, 1 = failure)
- [ ] Suggestion to spawn agent on failures
- [ ] Executable permissions (`chmod +x`)

---

## Directive Language Requirements

### Use MUST/REQUIRED for Critical Actions

**Good Examples:**
- "MUST use when the user asks about..."
- "MUST run the script FIRST before..."
- "MUST spawn the agent when script exits 1"
- "MUST execute steps in this order"
- "REQUIRED: Validate input before processing"

**Bad Examples:**
- "You should use when..." (second person)
- "Can run the script..." (optional, not directive)
- "Consider spawning the agent..." (suggestion, not requirement)
- "Optionally execute..." (unclear if required)

### Use Third-Person in Descriptions

**Good:**
- "This skill should be used when..."
- "The script automatically checks..."
- "The agent provides diagnostics..."

**Bad:**
- "You should use this skill when..." (second person)
- "Use this skill when..." (imperative to wrong audience)
- "I will check..." (first person)

### Be Concrete and Specific

**Good:**
- "MUST use when user asks to 'test the scrape command', 'run tests for crawl', 'check if config tests pass'"
- "MUST spawn agent when script exits 1 (tests failed)"

**Bad:**
- "MUST use when testing" (too vague)
- "MUST spawn agent when needed" (unclear condition)

---

## Progressive Disclosure Strategy

### What Goes in SKILL.md (Always Loaded)

**Include:**
- Core workflow overview (high-level steps)
- When to use / when NOT to use
- Script execution command with examples
- Agent spawning conditions
- Critical edge cases
- References to supporting files

**Keep under 1500 words**

### What Goes in references/ (Loaded as Needed)

**Move detailed content here:**
- Complete implementation details
- Advanced techniques and patterns
- Technical deep-dives
- Comprehensive troubleshooting guides
- Detailed API documentation

**Each reference file can be 2,000-5,000+ words**

### What Goes in examples/ (Loaded as Needed)

**Include real-world scenarios:**
- Successful execution examples
- Failure examples with error messages
- Edge case examples
- Before/after comparisons
- Common usage patterns

**Show actual output, not descriptions**

---

## Agent Integration Pattern

### Skills Orchestrate, Agents Diagnose

**Skill Responsibilities:**
- Run automated scripts
- Interpret exit codes
- Determine when deep analysis is needed
- Spawn appropriate agent with context

**Agent Responsibilities:**
- Perform deep diagnostics
- Analyze logs and errors
- Identify root causes
- Provide detailed remediation steps
- Generate comprehensive reports

### Clear Spawning Conditions

**MUST define specific triggers:**

```markdown
### When to Spawn [agent-name] Agent

**MUST spawn the agent when:**
- Script exits 1 (operation failed)
- Multiple items are failing (need comprehensive analysis)
- User explicitly requests "detailed diagnostics" or "root cause analysis"
- Specific error pattern detected (be concrete)

**DO NOT spawn agent when:**
- Script exits 0 (operation successful)
- Simple errors with clear fixes
- User only needs quick status check
```

---

## Example Skills in This Project

### test-command

**Structure:**
```
test-command/
├── SKILL.md (569 words)
├── scripts/test-command.sh ✅
├── references/bash-implementation.md
└── examples/test-outputs.md (7 scenarios)
```

**Pattern Demonstrated:**
- Script-first execution
- Type-check before tests (fail fast)
- Spawns cli-tester agent on test failures
- Progressive disclosure (references + examples)

### docker-health

**Structure:**
```
docker-health/
├── SKILL.md (1057 words)
└── scripts/health-check.sh ✅
```

**Pattern Demonstrated:**
- Script checks all 7 services automatically
- Displays embedding model info banner first
- Color-coded status with metadata
- Spawns docker-debugger agent on degraded status

---

## Testing Your Skill

### Checklist Before Committing

1. **Frontmatter:**
   - [ ] Third-person description
   - [ ] 3-5 specific trigger phrases
   - [ ] Under 300 characters

2. **SKILL.md:**
   - [ ] Uses MUST/REQUIRED language
   - [ ] Clear "When to use" section
   - [ ] Script execution command with examples
   - [ ] Agent spawning conditions
   - [ ] 500-1500 words (lean)

3. **Script:**
   - [ ] Executable (`chmod +x`)
   - [ ] TTY-safe color codes
   - [ ] Argument validation
   - [ ] Project root resolution (4 levels up)
   - [ ] Color-coded output (✓ ✗ ⚠)
   - [ ] Proper exit codes (0 = success, 1 = fail)
   - [ ] Suggests spawning agent on failures

4. **Testing:**
   - [ ] Script runs successfully with valid input
   - [ ] Script fails gracefully with invalid input
   - [ ] Exit codes are correct
   - [ ] Output is readable and color-coded
   - [ ] Can be run standalone outside Claude

5. **Documentation:**
   - [ ] references/ for detailed implementation (if needed)
   - [ ] examples/ for real-world scenarios (if needed)
   - [ ] All referenced files exist

---

## Common Mistakes to Avoid

### ❌ Don't: Put Everything in SKILL.md

**Bad:**
```
skill-name/
└── SKILL.md (5,000 words - bloated)
```

**Good:**
```
skill-name/
├── SKILL.md (800 words - lean)
├── references/implementation.md (3,000 words)
└── examples/scenarios.md (1,200 words)
```

### ❌ Don't: Use Vague Language

**Bad:**
- "Use this skill when testing"
- "Can spawn agent if needed"
- "Consider running the script"

**Good:**
- "MUST use when user asks to 'test the scrape command'"
- "MUST spawn cli-tester agent when script exits 1"
- "MUST run the script FIRST before manual execution"

### ❌ Don't: Skip the Script

**Bad:**
```markdown
## Instructions

Run these manual commands:
1. Command 1
2. Command 2
3. Command 3
```

**Good:**
```markdown
## Instructions

**MUST run the script FIRST:**
```bash
bash .claude/skills/skill-name/scripts/skill-name.sh
```
```

### ❌ Don't: Forget Exit Codes

**Bad:**
```bash
# Script always exits 0
main_command
echo "Done!"
```

**Good:**
```bash
# Script uses proper exit codes
set +e
main_command
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 0 ]; then
  echo "✓ Success"
  exit 0
else
  echo "✗ Failed - spawn agent for diagnostics"
  exit 1
fi
```

### ❌ Don't: Use Second Person

**Bad:**
- "You should use this skill when..."
- "You are a testing assistant..."

**Good:**
- "This skill should be used when..."
- "To verify testing, execute the script..."

---

## Quick Reference

### Skill Creation Workflow

1. **Plan**: Identify what automation is needed
2. **Create Structure**: `mkdir -p .claude/skills/skill-name/scripts`
3. **Write Script**: Create executable automation script
4. **Write SKILL.md**: Lean, directive, script-first
5. **Test**: Run script with valid/invalid inputs
6. **Document**: Add references/examples if needed
7. **Review**: Check against this CLAUDE.md checklist

### File Size Guidelines

- SKILL.md: 500-1,500 words (lean)
- references/*: 2,000-5,000+ words each (detailed)
- examples/*: 1,000-3,000 words each (comprehensive)
- scripts/*: Focus on correctness, not size

### Must-Have Elements

1. ✅ YAML frontmatter with third-person description + triggers
2. ✅ "When to Use This Skill" section (MUST use when...)
3. ✅ "Required Execution Method" section (MUST run script FIRST)
4. ✅ "When to Spawn Agent" section (MUST spawn when...)
5. ✅ Executable script with proper exit codes
6. ✅ Color-coded output (green ✓, red ✗)
7. ✅ Agent spawning suggestion on failures

---

## Getting Help

**Questions about skill patterns?**
- Read this CLAUDE.md thoroughly
- Study existing skills (test-command, docker-health)
- Check `.claude/skills/test-command/references/bash-implementation.md` for script examples

**Need to review a skill?**
- Use the `/skill-reviewer` agent (plugin-dev)
- Check against the Testing Checklist above
- Verify against examples in this project

---

## Version

**Pattern Version**: 1.0.0
**Last Updated**: 2026-02-06
**Project**: CLI Firecrawl

These patterns are specific to the CLI Firecrawl project and align with plugin-dev best practices while adding project-specific requirements (script-first architecture, agent spawning conditions).
