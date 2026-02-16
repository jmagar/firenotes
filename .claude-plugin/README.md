# Axon Plugin

Claude Code plugin providing Axon CLI automation skills and diagnostic agents for web scraping with semantic search capabilities.

## Components

### Skills
- **docker-health** - Docker service health checking with embedding model info and container status
- **test-command** - Individual CLI command testing with type-checking and validation
- **axon** - Complete Axon web scraping suite with 10 specialized commands:
  - `/axon:scrape` - Single URL scraping
  - `/axon:crawl` - Multi-page crawling
  - `/axon:map` - URL discovery
  - `/axon:search` - Web search with scraping
  - `/axon:extract` - Structured data extraction
  - `/axon:batch` - Batch operations
  - `/axon:query` - Semantic search
  - `/axon:retrieve` - Document retrieval
  - `/axon:ask` - AI-powered Q&A
  - `/axon:status` - Job status checking

### Agents
- **cli-tester** - Automated test failure analysis and diagnostics
- **docker-debugger** - Docker infrastructure diagnostics and troubleshooting

## Installation

### From GitHub (Recommended)
```bash
/plugin install https://github.com/jmagar/axon.git
```

### Via Marketplace
```bash
/plugin marketplace add jmagar/axon
/plugin install axon @axon-marketplace
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
   /axon:search "Claude Code documentation"
   /axon:ask "How do I create a plugin?"
   ```

## Usage Examples

### Web Scraping
```bash
axon scrape https://example.com
axon crawl https://docs.example.com --wait --progress
axon map https://example.com
```

### Semantic Search
```bash
axon search "AI documentation"
axon query "embedding strategies"
axon ask "What are vector databases?"
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
