---
description: Search the web and auto-scrape/index results
argument-hint: "<search query>" [--limit N] [--scrapeOptions]
allowed-tools: Bash(firecrawl *)
---

# Web Search with Auto-Indexing

Execute the Firecrawl search command with the provided arguments:

```bash
firecrawl search $ARGUMENTS
```

## Instructions

1. **Execute the command** using the Bash tool with the arguments provided
2. **Parse the response** to extract:
   - Search results with URLs
   - Scraped content for each result
   - Embedding confirmation
3. **Present the results** including:
   - Top N results with titles and descriptions
   - Scraped content snippets
   - Source URLs
   - Confirmation of Qdrant embedding
4. **Confirm auto-indexing**:
   - All results have been scraped
   - All content has been embedded into Qdrant
   - Results are now searchable via `/firecrawl:query`

## Expected Output

The command returns JSON containing:
- `results`: Array of search results with:
  - `title`: Page title
  - `url`: Source URL
  - `description`: Meta description
  - `content`: Scraped markdown content
  - `metadata`: Page metadata
- `embedded`: Confirmation of Qdrant embedding
- `query`: Original search query
- `total`: Total results found and indexed

Present search results with scraped content and confirm successful auto-indexing.

## Key Differences from /firecrawl:query

- **`/firecrawl:search`**: Searches the **web** and auto-scrapes/indexes results (adds to knowledge base)
- **`/firecrawl:query`**: Searches your **existing knowledge base** in Qdrant (semantic search)

Use `/firecrawl:search` when you need new information from the web.
Use `/firecrawl:query` to search what you've already indexed.
