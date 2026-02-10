#!/bin/bash
# Test Command - Run unit tests for a specific CLI command
# Usage: test-command.sh <command-name>

set -e

COMMAND="${1:-}"

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

# Validate usage
if [ -z "$COMMAND" ]; then
  echo -e "${RED}✗ Error: Command name required${NC}"
  echo ""
  echo "Usage: test-command.sh <command-name>"
  echo ""
  echo "Examples:"
  echo "  test-command.sh scrape"
  echo "  test-command.sh crawl"
  echo "  test-command.sh config"
  exit 1
fi

# Change to project root (4 levels up from scripts/)
# Path: .claude/skills/test-command/scripts/ → .claude/skills/test-command/ → .claude/skills/ → .claude/ → project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Validate Command
echo -e "${BOLD}→ Validating command '${COMMAND}'...${NC}"

if [ -f "src/commands/${COMMAND}.ts" ]; then
  echo -e "${GREEN}✓${NC} Found command: src/commands/${COMMAND}.ts"
elif [ -d "src/commands/${COMMAND}" ]; then
  echo -e "${GREEN}✓${NC} Found command directory: src/commands/${COMMAND}/"
else
  echo -e "${RED}✗${NC} Command '${COMMAND}' not found"
  echo ""
  echo "Available commands:"
  (ls -1 src/commands/*.ts 2>/dev/null | xargs -I{} basename {} .ts | sed 's/^/  - /') || true
  (ls -1d src/commands/*/ 2>/dev/null | xargs -I{} basename {} | sed 's/^/  - /') || true
  exit 1
fi

# Step 2: Type Check
echo ""
echo -e "${BOLD}→ Running type check...${NC}"

if pnpm type-check 2>&1 | grep -E "error TS|Found [0-9]+ error" > /dev/null; then
  echo -e "${RED}✗ Type check failed${NC}"
  echo ""
  pnpm type-check
  echo ""
  echo -e "${RED}Fix type errors before running tests${NC}"
  exit 1
else
  echo -e "${GREEN}✓ Type check passed${NC}"
fi

# Step 3: Run Tests
echo ""
echo -e "${BOLD}→ Running tests for '${COMMAND}'...${NC}"
echo ""

# Run tests and capture exit code
set +e
pnpm test:unit -- --run src/__tests__/commands/${COMMAND}
TEST_EXIT=$?
set -e

# Step 4: Format Output
echo ""
if [ $TEST_EXIT -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed${NC}"
  echo ""
  echo -e "${BLUE}Ready to commit!${NC}"
  exit 0
else
  echo -e "${RED}✗ Tests failed${NC}"
  echo ""
  echo -e "${YELLOW}Fix failing tests before committing${NC}"
  echo ""
  echo -e "${DIM}For detailed analysis, ask Claude to spawn the cli-tester agent${NC}"
  exit 1
fi
