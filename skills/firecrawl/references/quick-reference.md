# Firecrawl Quick Reference

Quick command examples for common Firecrawl operations.

## Authentication

```bash
# Set API key (cloud)
export FIRECRAWL_API_KEY="fc-your-api-key"

# Set custom API URL (self-hosted)
export FIRECRAWL_API_URL="http://localhost:3002"

# Check status
firecrawl --status
```

## Scrape Single Pages

```bash
# Basic scrape
firecrawl https://example.com

# Only main content (recommended)
firecrawl https://example.com --only-main-content

# Multiple formats
firecrawl https://example.com --format markdown,html,links

# Wait for JavaScript
firecrawl https://example.com --wait-for 5000

# Take screenshot
firecrawl https://example.com --screenshot

# Save to file
firecrawl https://example.com --only-main-content -o output.md

# Pretty JSON output
firecrawl https://example.com --format markdown,html --pretty -o output.json

# Wrapper script
./scripts/scrape.sh https://example.com output.md
```

## Search the Web

```bash
# Basic search
firecrawl search "AI agent benchmarks"

# Search and scrape results
firecrawl search "web scraping tutorials" --scrape --limit 5

# Filter by source
firecrawl search "AI news" --sources news
firecrawl search "AI diagrams" --sources images

# Time-based filtering
firecrawl search "latest AI" --tbs qdr:d   # Last day
firecrawl search "this week" --tbs qdr:w   # Last week
firecrawl search "this month" --tbs qdr:m  # Last month

# Category filtering
firecrawl search "machine learning" --categories github,research

# Geographic search
firecrawl search "local events" --location "San Francisco" --country US

# Save results
firecrawl search "AI agents" --scrape -o results/

# Wrapper script
./scripts/search-scrape.sh "AI benchmarks" 5
```

## Map Website URLs

```bash
# Basic mapping
firecrawl map https://example.com

# Limit results
firecrawl map https://example.com --limit 1000

# Search for paths
firecrawl map https://example.com --search "blog"

# Include subdomains
firecrawl map https://example.com --include-subdomains

# Only use sitemap
firecrawl map https://example.com --sitemap only

# Ignore query parameters
firecrawl map https://example.com --ignore-query-parameters

# Save as JSON
firecrawl map https://example.com --json -o sitemap.json

# Wrapper script
./scripts/map-site.sh https://example.com sitemap.json
```

## Crawl Websites

```bash
# Basic crawl with progress
firecrawl crawl https://example.com --wait --progress

# Limit pages and depth
firecrawl crawl https://example.com --limit 50 --max-depth 3 --wait

# Include specific paths
firecrawl crawl https://example.com --include-paths "/blog/*" --wait
firecrawl crawl https://example.com --include-paths "/docs/*,/api/*" --wait

# Exclude paths
firecrawl crawl https://example.com --exclude-paths "/admin/*" --wait

# Rate limiting (polite crawling)
firecrawl crawl https://example.com --delay 1000 --max-concurrency 3 --wait

# Crawl entire domain
firecrawl crawl https://example.com --crawl-entire-domain --wait

# Async crawl (returns job ID)
firecrawl crawl https://example.com --limit 100

# Wrapper script
./scripts/crawl-site.sh https://example.com 100 3
```

## Utility Commands

```bash
# Check authentication and credits
firecrawl --status

# View credit usage (cloud only)
firecrawl credit-usage

# Login
firecrawl login --browser
firecrawl login --api-key fc-YOUR-KEY

# View configuration
firecrawl config

# Logout
firecrawl logout

# Check version
firecrawl --version

# Command help
firecrawl --help
firecrawl <command> --help
```

## Output Formatting

```bash
# Single format (raw output, pipe-friendly)
firecrawl https://example.com --format markdown

# Multiple formats (JSON output)
firecrawl https://example.com --format markdown,html,links

# Pretty-print JSON
firecrawl https://example.com --format markdown,html --pretty

# Save to file
firecrawl https://example.com --format markdown -o output.md
firecrawl https://example.com --format markdown,html --pretty -o output.json
```

## Filtering Content

```bash
# Only main content (removes navigation, footers)
firecrawl https://example.com --only-main-content

# Include specific HTML tags
firecrawl https://example.com --include-tags "article,main,p"

# Exclude specific HTML tags
firecrawl https://example.com --exclude-tags "nav,footer,aside"

# Wait for JavaScript rendering
firecrawl https://example.com --wait-for 3000
```

## Time-Based Search Filters

```bash
# Last hour
firecrawl search "breaking news" --tbs qdr:h

# Last day
firecrawl search "latest updates" --tbs qdr:d

# Last week
firecrawl search "this week's news" --tbs qdr:w

# Last month
firecrawl search "monthly report" --tbs qdr:m

# Last year
firecrawl search "annual review" --tbs qdr:y
```

## Common Workflows

### Extract Article Content for AI

```bash
firecrawl https://blog.example.com/article --only-main-content --format markdown
```

### Research Competitor Websites

```bash
# Map site structure
firecrawl map https://competitor.com --json -o competitor-urls.json

# Crawl specific sections
firecrawl crawl https://competitor.com --include-paths "/products/*" --wait
```

### Monitor Website Changes

```bash
# Scrape page and save
firecrawl https://example.com/changelog --only-main-content -o changelog-$(date +%Y%m%d).md

# Compare with previous version
diff changelog-20260201.md changelog-20260203.md
```

### Gather Training Data

```bash
# Search and scrape multiple results
firecrawl search "machine learning tutorials" --scrape --limit 20 -o ml-data/

# Crawl documentation sites
firecrawl crawl https://docs.example.com --limit 500 --wait
```

### Build Site Archive

```bash
# Map all URLs first
firecrawl map https://example.com --json -o sitemap.json

# Crawl with full content
firecrawl crawl https://example.com --limit 1000 --format markdown,html --wait
```

## Performance Tips

```bash
# Reduce data size with main content only
firecrawl https://example.com --only-main-content

# Add delay to avoid rate limiting
firecrawl crawl https://example.com --delay 1000 --wait

# Limit concurrency for polite scraping
firecrawl crawl https://example.com --max-concurrency 3 --wait

# Filter paths to reduce scope
firecrawl crawl https://example.com --include-paths "/blog/*" --wait

# Use max depth to control crawl size
firecrawl crawl https://example.com --max-depth 2 --wait

# Map first to understand structure
firecrawl map https://example.com --limit 500
```

## Using with jq (JSON Processing)

```bash
# Extract URLs from search results
firecrawl search "AI" --limit 10 | jq -r '.results[].url'

# Count discovered URLs
firecrawl map https://example.com --json | jq '.urls | length'

# Filter crawl results by status
firecrawl crawl https://example.com --wait | jq '.pages[] | select(.status == 200)'

# Extract markdown content
firecrawl https://example.com --format markdown,html --pretty | jq -r '.markdown'
```

## Piping and Redirecting

```bash
# Pipe to less for viewing
firecrawl https://example.com | less

# Pipe to grep for searching
firecrawl https://example.com | grep "keyword"

# Redirect to file
firecrawl https://example.com > output.md

# Append to file
firecrawl https://example.com >> archive.md

# Error output to file
firecrawl https://example.com 2> errors.log
```

## Environment Variable Overrides

```bash
# Use different API key
FIRECRAWL_API_KEY="fc-other-key" firecrawl https://example.com

# Use self-hosted instance
FIRECRAWL_API_URL="http://localhost:3002" firecrawl https://example.com

# Disable telemetry
FIRECRAWL_NO_TELEMETRY=1 firecrawl https://example.com
```

## Wrapper Script Examples

All wrapper scripts source credentials from `~/claude-homelab/.env`.

```bash
# Scrape single URL
cd ~/claude-homelab/skills/firecrawl
./scripts/scrape.sh https://example.com
./scripts/scrape.sh https://example.com output.md

# Search and scrape
./scripts/search-scrape.sh "AI benchmarks" 5

# Map website
./scripts/map-site.sh https://example.com
./scripts/map-site.sh https://example.com sitemap.json

# Crawl website
./scripts/crawl-site.sh https://example.com
./scripts/crawl-site.sh https://example.com 100 3
```

## Error Handling

```bash
# Check if command succeeded
if firecrawl https://example.com --only-main-content; then
    echo "Success"
else
    echo "Failed"
fi

# Capture output and errors
output=$(firecrawl https://example.com 2>&1)
if [ $? -eq 0 ]; then
    echo "$output"
else
    echo "Error: $output" >&2
fi
```

## Cron Scheduling

```bash
# Daily site scrape
0 2 * * * cd ~/claude-homelab/skills/firecrawl && ./scripts/scrape.sh https://example.com > /tmp/daily-scrape.md

# Weekly site crawl
0 3 * * 0 cd ~/claude-homelab/skills/firecrawl && ./scripts/crawl-site.sh https://example.com 500 5

# Hourly news search
0 * * * * cd ~/claude-homelab/skills/firecrawl && ./scripts/search-scrape.sh "AI news" 10 > ~/news/$(date +\%Y\%m\%d-\%H).json
```

## Quick Comparison

| Task | Command | Use Case |
|------|---------|----------|
| Extract single page | `firecrawl <url>` | Article extraction, content analysis |
| Search web | `firecrawl search <query>` | Research, data gathering |
| Discover URLs | `firecrawl map <url>` | Site structure analysis |
| Crawl website | `firecrawl crawl <url>` | Full site archiving, documentation |

## Format Selection Guide

| Format | Use Case | Output |
|--------|----------|--------|
| `markdown` | LLM processing, AI training | Clean text |
| `html` | Preserve structure, styling | Cleaned HTML |
| `rawHtml` | Full page preservation | Original HTML |
| `links` | Link analysis, sitemap | URL array |
| `screenshot` | Visual reference, archiving | Base64 image |

---

**Need more detail?** See [API Endpoints Reference](./api-endpoints.md) or [Troubleshooting Guide](./troubleshooting.md).
