---
description: Discover all URLs on a website without scraping content
argument-hint: <url> [options]
allowed-tools: Bash(firecrawl *)
---

# Map Website URLs

Execute the Firecrawl map command with the provided arguments:

```bash
firecrawl map $ARGUMENTS
```

## Instructions

1. **Execute the command** using the Bash tool with the arguments provided
2. **Parse the response** to extract:
   - List of all discovered URLs
   - URL categorization (pages, assets, external links)
   - Site structure information
3. **Present the results** as:
   - Organized list of URLs (grouped by type or path)
   - Total count of discovered URLs
   - Site structure overview
4. **Suggest next steps**:
   - URLs suitable for `/firecrawl:scrape`
   - URL patterns for `/firecrawl:crawl`
   - Filtering options for targeted scraping

## Expected Output

The command returns JSON containing:
- `urls`: Array of discovered URLs
- `total`: Total number of URLs found
- `categories`: URL categorization (pages, assets, etc.)
- `structure`: Site hierarchy information

Present a comprehensive sitemap and suggest relevant URLs for content extraction.
