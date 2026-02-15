# Initial Project Request - v2.0.0 Publishing Preparation

**Date:** 2026-02-15
**Scope:** Prepare CLI Firecrawl for multi-platform publishing with frictionless deployment

---

## Primary Objective

Get everything ready to publish to NPM and make the setup, configuration, and deployment as frictionless as possible.

## Deployment Methods (MUST Support)

1. **NPM/PNPM** - Standard package manager installation
2. **Claude Code Plugin** - Via Claude Code Marketplace setup in repo
3. **One-liner install bash script** - curl | bash installer

## Claude Code Integration

**Copy resources into project:**
- Custom slash commands: `~/claude-home/commands/firecrawl/` → `commands/`
- Skill folder: `~/claude-homelab/skills/firecrawl/` → `skills/`

**Create:**
- Claude Code marketplace configuration
- Claude Code Plugin structure

## Bash Installer

Create one-liner deployment script with:
- Automatic skill/command installation
- Docker stack deployment
- Secret generation
- Port conflict detection

## Multi-CLI Skill Support

**Automatic skill installation for:**
- Claude Code
- Codex
- Gemini
- Opencode

**Installation strategy:**
- Set up symlinks when appropriate
- Automate Claude Code plugin install if Claude is available on install target
- Research slash command differences between CLIs (not an open standard like skills)

## TEI Deployment Configurations

**Two configurations to support:**

1. **NVIDIA-optimized** - Qwen3 model (`docker-compose.tei.yaml`)
2. **Mixed Bread** - Wider hardware compatibility (`docker-compose.tei.mxbai.yaml`)

**Requirements:**
- Auto-detect appropriate TEI configuration during install
- Support hardware detection for optimal config selection

## Docker Infrastructure Reorganization

### Structure
- Move all Docker config to `docker/` directory

### Security
- Auto-generate secure secrets for all services requiring passwords
- No hardcoded credentials

### Isolation
- Namespace all containers to prevent conflicts/collisions
- Detect port conflicts before deployment
- Auto-adjust ports if conflicts found

## Environment Configuration

**Create .env.example templates for:**

1. **RTX 4070** - Copy current .env with secrets stripped
2. **RTX 3050** - 8GB VRAM configuration (mid-range GPU support)

## Firecrawl Cloud Support

**Deployment mode for cloud users:**
- Deploy only: Qdrant + TEI
- Skip self-hosted Firecrawl installation

**Architecture change:**
- Move Qdrant into TEI stack for easier Cloud user deployment

## Documentation Updates

### Required Updates

1. **README.md**
   - Remove references to old `firecrawl-cli` repo
   - Update package references
   - Ensure all installation methods documented

2. **package.json**
   - Remove references to `firecrawl-cli` repo/package
   - Update repository URLs

3. **General Documentation**
   - Full accuracy audit
   - Identify and fill documentation gaps
   - Create new docs as needed

---

## Success Criteria

- ✅ Three deployment methods fully functional (NPM, Plugin, Bash)
- ✅ Multi-CLI skill installation automated
- ✅ Docker infrastructure reorganized and namespaced
- ✅ Hardware auto-detection working
- ✅ Port conflict resolution automated
- ✅ Secret generation secured
- ✅ Documentation complete and accurate
- ✅ Cloud user deployment supported
