# CLI Firecrawl Plugin

Claude Code plugin providing Firecrawl CLI automation skills and diagnostic agents for web scraping with semantic search capabilities.

## Components

### Skills
- **docker-health** - Docker service health checking with embedding model info and container status
- **test-command** - Individual CLI command testing with type-checking and validation
- **firecrawl** - Complete Firecrawl web scraping suite with 10 specialized commands:
  - `/firecrawl:scrape` - Single URL scraping
  - `/firecrawl:crawl` - Multi-page crawling
  - `/firecrawl:map` - URL discovery
  - `/firecrawl:search` - Web search with scraping
  - `/firecrawl:extract` - Structured data extraction
  - `/firecrawl:batch` - Batch operations
  - `/firecrawl:query` - Semantic search
  - `/firecrawl:retrieve` - Document retrieval
  - `/firecrawl:ask` - AI-powered Q&A
  - `/firecrawl:status` - Job status checking

### Agents
- **cli-tester** - Automated test failure analysis and diagnostics
- **docker-debugger** - Docker infrastructure diagnostics and troubleshooting

## Installation

### From GitHub (Recommended)
```bash
/plugin install https://github.com/jmagar/cli-firecrawl.git
```

### Via Marketplace
```bash
/plugin marketplace add jmagar/cli-firecrawl
/plugin install cli-firecrawl @cli-firecrawl-marketplace
```

## Requirements

- Docker 20.10+
- Node.js 18+
- pnpm package manager
- Self-hosted Firecrawl stack (included via docker-compose)

## Infrastructure

This plugin includes a complete self-hosted web scraping stack:

- **Firecrawl API** (port 53002) - Main scraping service
- **TEI Embeddings** (remote on steamy-wsl:52000) - GPU-accelerated embeddings
- **Qdrant** (port 53333) - Vector database for semantic search
- **Embedder Daemon** (port 53000) - Background embedding processor
- **Patchright** - Patched Playwright for anti-bot detection

## Quick Start

1. Start infrastructure:
   ```bash
   docker compose up -d
   ```

2. Build and test:
   ```bash
   pnpm install
   pnpm build
   pnpm local status
   ```

3. Use skills in Claude Code:
   ```
   /docker-health
   /firecrawl:search "Claude Code documentation"
   /firecrawl:ask "How do I create a plugin?"
   ```

## Usage Examples

### Web Scraping
```bash
firecrawl scrape https://example.com
firecrawl crawl https://docs.example.com --wait --progress
firecrawl map https://example.com
```

### Semantic Search
```bash
firecrawl search "AI documentation"
firecrawl query "embedding strategies"
firecrawl ask "What are vector databases?"
```

### Health Monitoring
```bash
/docker-health           # Check all services
/test-command scrape     # Test specific command
```

## Development

- **Build**: `pnpm build`
- **Test**: `pnpm test`
- **Type Check**: `pnpm type-check`
- **Lint**: `pnpm lint`

## Architecture

The plugin provides a complete RAG (Retrieval-Augmented Generation) workflow:

1. **Scrape** → Extract web content (Firecrawl + Patchright)
2. **Chunk** → Markdown-aware text chunking
3. **Embed** → Generate vectors (TEI with Qwen3-Embedding-0.6B)
4. **Store** → Save to Qdrant vector database
5. **Query** → Semantic search over indexed content
6. **Ask** → AI-powered Q&A using Claude CLI

All operations automatically index content for future semantic search.

## License

MIT
