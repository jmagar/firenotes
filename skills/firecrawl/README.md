# Firecrawl Skill

Extract LLM-ready data from websites using Firecrawl's Web Data API. Scrape single pages, crawl entire websites, search the internet, and map URL structures.

## What It Does

- **Scrape** — Extract single page content in multiple formats (markdown, HTML, links, screenshots)
- **Search** — Query the web with optional content scraping from results
- **Map** — Discover all URLs on a website without content extraction
- **Crawl** — Systematically traverse websites with depth and path controls
- **Multi-Format Output** — Markdown (LLM-ready), HTML, raw HTML, links, screenshots
- **JavaScript Support** — Wait for dynamic content rendering
- **Rate Limiting** — Built-in controls for polite scraping
- **Self-Hosted** — Works with cloud API or your own Firecrawl instance

All operations are read-only and extract data without modifying source websites.

## Setup

Firecrawl works with both the official cloud API (recommended) and self-hosted instances.

### Option 1: Cloud API Setup (Recommended)

#### 1. Get Your Firecrawl API Key

1. Visit https://firecrawl.dev/
2. Sign up or log in to your account
3. Navigate to **Account → API Keys**
4. Click **Generate New Key**
5. Copy your API key (starts with `fc-`)

#### 2. Add Credentials to .env File

Add your Firecrawl configuration to `~/.claude-homelab/.env`:

```bash
FIRECRAWL_API_KEY="fc-your-api-key-here"
FIRECRAWL_API_URL="https://api.firecrawl.dev"  # Optional, defaults to cloud
```

**Important:**
- The `.env` file must be located at `~/.claude-homelab/.env`
- This file is gitignored (never committed to version control)
- Set file permissions: `chmod 600 ~/.claude-homelab/.env`

**Configuration options:**
- `FIRECRAWL_API_KEY`: Your Firecrawl API key (required for cloud API)
- `FIRECRAWL_API_URL`: API endpoint (optional, defaults to cloud)

### Option 2: Self-Hosted Instance Setup

For self-hosted Firecrawl instances:

```bash
FIRECRAWL_API_KEY=""  # Empty or omitted for self-hosted
FIRECRAWL_API_URL="http://localhost:3002"
```

**Note:** Self-hosted instances automatically skip authentication.

#### 3. Install Firecrawl CLI (Required)

The CLI should be installed globally:

```bash
# Global installation (required)
npm install -g @firecrawl/cli

# Verify installation
firecrawl --version
```

#### 4. Test It

```bash
cd ~/claude-homelab/skills/firecrawl
firecrawl https://example.com --only-main-content
```

## Usage Examples

All examples use the Firecrawl CLI directly or through wrapper scripts in the `scripts/` directory.

### Scrape Single Pages

Extract content from a single webpage:

```bash
# Basic scrape (markdown by default)
firecrawl https://example.com

# Only main content (removes navigation, footers, ads)
firecrawl https://example.com --only-main-content

# Multiple formats (returns JSON)
firecrawl https://example.com --format markdown,html,links

# Wait for JavaScript to render (5 seconds)
firecrawl https://example.com --wait-for 5000

# Take screenshot of page
firecrawl https://example.com --screenshot

# Filter HTML tags
firecrawl https://example.com --include-tags "article,main,p"
firecrawl https://example.com --exclude-tags "nav,footer,aside"

# Save to file
firecrawl https://example.com --only-main-content -o output.md

# Pretty JSON output
firecrawl https://example.com --format markdown,links --pretty -o output.json
```

**Using wrapper script:**

```bash
./scripts/scrape.sh https://example.com
```

### Search the Web

Query the internet with optional scraping:

```bash
# Basic search
firecrawl search "AI agent benchmarks"

# Limit results
firecrawl search "web scraping tutorials" --limit 10

# Search and scrape results (extracts content)
firecrawl search "AI benchmarks 2026" --scrape --limit 5

# Filter by source type
firecrawl search "AI news" --sources web,news
firecrawl search "AI diagrams" --sources images

# Category filtering
firecrawl search "machine learning" --categories github,research

# Time-based filtering
firecrawl search "latest AI research" --tbs qdr:d  # Last day
firecrawl search "this week AI" --tbs qdr:w        # Last week
firecrawl search "this month AI" --tbs qdr:m       # Last month
firecrawl search "this year AI" --tbs qdr:y        # Last year

# Geographic filtering
firecrawl search "local events" --location "San Francisco" --country US

# Save results to directory
firecrawl search "AI agents" --scrape --limit 5 -o results/
```

**Using wrapper script:**

```bash
./scripts/search-scrape.sh "AI benchmarks" 5
```

### Map Website URLs

Discover all URLs on a website without scraping content:

```bash
# Basic mapping
firecrawl map https://example.com

# Limit results
firecrawl map https://example.com --limit 500

# Search for specific paths
firecrawl map https://example.com --search "blog"
firecrawl map https://example.com --search "/docs/"

# Include subdomains
firecrawl map https://example.com --include-subdomains

# Sitemap handling
firecrawl map https://example.com --sitemap include  # Use sitemap + crawl
firecrawl map https://example.com --sitemap only     # Only use sitemap
firecrawl map https://example.com --sitemap skip     # Ignore sitemap

# Remove query parameters for deduplication
firecrawl map https://example.com --ignore-query-parameters

# Output as JSON to file
firecrawl map https://example.com --json -o sitemap.json
```

**Using wrapper script:**

```bash
./scripts/map-site.sh https://example.com sitemap.json
```

### Crawl Entire Websites

Systematically crawl websites with depth and path controls:

```bash
# Basic crawl with waiting and progress
firecrawl crawl https://example.com --wait --progress

# Limit pages and depth
firecrawl crawl https://example.com --limit 100 --max-depth 3 --wait

# Path filtering (include specific paths)
firecrawl crawl https://example.com --include-paths "/blog/*" --wait
firecrawl crawl https://example.com --include-paths "/docs/*,/api/*" --wait

# Path filtering (exclude specific paths)
firecrawl crawl https://example.com --exclude-paths "/admin/*,/api/*" --wait

# Rate limiting (polite crawling)
firecrawl crawl https://example.com --delay 1000 --max-concurrency 5 --wait

# Crawl entire domain (no scope restrictions)
firecrawl crawl https://example.com --crawl-entire-domain --wait

# Async crawl (returns job ID for later status checks)
firecrawl crawl https://example.com --limit 50
# Job ID: abc123def456 (check status later)

# Custom poll interval for async mode
firecrawl crawl https://example.com --poll-interval 5000
```

**Using wrapper script:**

```bash
./scripts/crawl-site.sh https://example.com 100 3
```

### Check Status & Credits

```bash
# Check authentication status, concurrency, and credits
firecrawl --status

# Check credit usage (cloud API only)
firecrawl credit-usage

# View configuration
firecrawl config
```

## API Reference

Detailed API documentation is available in the `references/` directory:

- **[API Endpoints](./references/api-endpoints.md)** - Complete endpoint reference with parameters
- **[Quick Reference](./references/quick-reference.md)** - Common operations with copy-paste examples
- **[Troubleshooting](./references/troubleshooting.md)** - Authentication, connection, and error solutions

## Workflow

When extracting web data:

1. **Choose extraction method:**
   - Single page → Use `scrape`
   - Search web → Use `search`
   - Discover URLs → Use `map`
   - Full website → Use `crawl`

2. **Select output format:**
   - LLM processing → Use markdown (`--format markdown`)
   - Preserve structure → Use HTML (`--format html`)
   - Extract links → Use links (`--format links`)
   - Visual reference → Use screenshot (`--screenshot`)

3. **Configure options:**
   - JavaScript sites → Add `--wait-for <ms>`
   - Clean content → Add `--only-main-content`
   - Rate limiting → Add `--delay <ms>`
   - Path filtering → Add `--include-paths` or `--exclude-paths`

4. **Execute and save:**
   - Output to file → Add `-o <path>`
   - Pretty JSON → Add `--pretty`
   - Progress tracking → Add `--progress` (crawl only)

5. **Process results:**
   - Single format returns raw content
   - Multiple formats return JSON object
   - Pipe to other tools or save to file

## Format Options

| Format | Description | Best For | Output |
|--------|-------------|----------|--------|
| `markdown` | Clean markdown text | LLM processing, AI training | Raw markdown (single format) or JSON |
| `html` | Cleaned HTML | Preserving structure, styling | Raw HTML (single format) or JSON |
| `rawHtml` | Original HTML | Full page preservation | Raw HTML (single format) or JSON |
| `links` | All URLs from page | Link analysis, sitemap building | JSON array of URLs |
| `screenshot` | Page screenshot | Visual reference, archiving | Base64-encoded image in JSON |

**Output behavior:**
- **Single format** (e.g., `--format markdown`) → Raw content output (pipe-friendly)
- **Multiple formats** (e.g., `--format markdown,html,links`) → JSON object with all formats
- Add `--pretty` flag for human-readable JSON

## Search Filters

### Time-Based Filters (`--tbs`)

- `qdr:h` — Last hour
- `qdr:d` — Last day (24 hours)
- `qdr:w` — Last week
- `qdr:m` — Last month
- `qdr:y` — Last year

### Source Filters (`--sources`)

- `web` — Web pages (default)
- `news` — News articles
- `images` — Image results

### Category Filters (`--categories`)

- `github` — GitHub repositories
- `research` — Research papers
- `pdf` — PDF documents

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `FIRECRAWL_API_KEY` | API key for authentication | Yes (cloud), No (self-hosted) | None |
| `FIRECRAWL_API_URL` | API endpoint URL | No | `https://api.firecrawl.dev` |
| `FIRECRAWL_NO_TELEMETRY` | Disable usage analytics | No | None |

**Note:** Set `FIRECRAWL_NO_TELEMETRY=1` to disable anonymous telemetry (version, OS, Node.js only).

## Troubleshooting

### Authentication Errors

**"401 Unauthorized"**
- **Cause:** Invalid or missing API key
- **Solution:** Check `FIRECRAWL_API_KEY` in `.env` file, verify key is correct

**"API key required"**
- **Cause:** `FIRECRAWL_API_KEY` not set for cloud API
- **Solution:** Add API key to `~/.claude-homelab/.env`

### Connection Errors

**"Connection refused"**
- **Cause:** Service not running (self-hosted) or incorrect URL
- **Solution:** Check `FIRECRAWL_API_URL` in `.env`, verify service is running

**"Timeout"**
- **Cause:** Website not responding or slow to load
- **Solution:** Increase `--wait-for` value for JavaScript-heavy sites

### Rate Limiting

**"429 Too Many Requests"**
- **Cause:** Rate limit exceeded
- **Solution:** Add `--delay` to crawl commands, reduce `--max-concurrency`

**"Concurrency limit reached"**
- **Cause:** Too many concurrent jobs running
- **Solution:** Wait for existing jobs to complete, check status with `--status`

### Data Extraction Issues

**"No content extracted"**
- **Cause:** JavaScript-rendered content not loaded
- **Solution:** Add `--wait-for 3000` or higher to allow rendering

**"Too much clutter in output"**
- **Cause:** Navigation, ads, footers included
- **Solution:** Use `--only-main-content` flag

**"Missing specific elements"**
- **Cause:** Tag filtering too strict
- **Solution:** Adjust `--include-tags` or `--exclude-tags` parameters

### Crawl Issues

**"Crawl stopped early"**
- **Cause:** Hit page limit or max depth
- **Solution:** Increase `--limit` or `--max-depth` values

**"Crawl too slow"**
- **Cause:** Rate limiting active
- **Solution:** Adjust `--delay` and `--max-concurrency` for balance

**"Paths not included"**
- **Cause:** Path filtering too restrictive
- **Solution:** Check `--include-paths` and `--exclude-paths` patterns

## Notes

### Cloud API vs Self-Hosted

**Cloud API (Recommended):**
- ✅ No infrastructure management
- ✅ Automatic scaling and updates
- ✅ High availability and reliability
- ❌ Requires API key and has quotas
- ❌ Per-request pricing

**Self-Hosted:**
- ✅ No quotas or per-request costs
- ✅ Full control and privacy
- ✅ No authentication required
- ❌ Requires infrastructure setup
- ❌ Manual scaling and maintenance

### Performance Optimization

- **Use `--only-main-content`** to reduce data size by 50-80%
- **Set appropriate `--delay`** to avoid rate limiting (1000ms recommended)
- **Limit concurrency** with `--max-concurrency` for polite scraping
- **Filter paths early** with `--include-paths` to reduce crawl scope
- **Use `--max-depth`** to control crawl depth and time
- **Map first** to understand site structure before full crawl

### Data Processing Tips

- **LLM training:** Use markdown format with `--only-main-content`
- **Archiving:** Use multiple formats for comprehensive capture
- **Link analysis:** Use `map` command instead of crawl for speed
- **Content monitoring:** Schedule regular scrapes with cron
- **Competitor research:** Use search with `--scrape` for targeted extraction

### Quota Management

For cloud API users:
- Check remaining credits: `firecrawl credit-usage`
- Monitor concurrent jobs: `firecrawl --status`
- Use async crawls to manage concurrency
- Consider self-hosting for high-volume use cases

## Wrapper Scripts Reference

The `scripts/` directory provides convenience wrappers:

| Script | Purpose | Usage |
|--------|---------|-------|
| `scrape.sh` | Scrape single URL with standard settings | `./scripts/scrape.sh <url>` |
| `search-scrape.sh` | Search and scrape top results | `./scripts/search-scrape.sh <query> <limit>` |
| `map-site.sh` | Map website URLs to file | `./scripts/map-site.sh <url> <output>` |
| `crawl-site.sh` | Crawl with progress tracking | `./scripts/crawl-site.sh <url> <limit> <depth>` |

All scripts source credentials from `~/.claude-homelab/.env`.

## Dependencies

- Node.js 18+ (for built-in fetch support)
- npx (comes with npm)
- Optional: jq (for JSON processing in bash scripts)

## Security

- Never commit `.env` file or expose API keys
- Use environment variables for credentials
- Keep API keys secure — they grant full account access
- Consider separate API keys for different use cases
- Monitor credit usage to detect unauthorized access
- Set restrictive file permissions: `chmod 600 ~/.claude-homelab/.env`

## Resources

- [Official Documentation](https://docs.firecrawl.dev/)
- [CLI Documentation](https://docs.firecrawl.dev/sdks/cli)
- [GitHub Repository](https://github.com/firecrawl/firecrawl)
- [CLI GitHub](https://github.com/firecrawl/cli)
- [API Endpoints Reference](./references/api-endpoints.md)
- [Quick Reference](./references/quick-reference.md)
- [Troubleshooting Guide](./references/troubleshooting.md)

## License

MIT
