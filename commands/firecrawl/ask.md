---
description: Ask questions grounded in indexed docs (AI-powered Q&A)
argument-hint: "<question>" [--limit N] [--domain example.com] [--model haiku|sonnet|opus]
allowed-tools: Bash(firecrawl *)
---

# Ask AI-Grounded Questions

Execute the Firecrawl ask command with the provided arguments:

```bash
firecrawl ask $ARGUMENTS
```

## Instructions

1. **Execute the command** using the Bash tool with the arguments provided
2. **Monitor the process** — the AI response streams in real-time
3. **Parse the response** to extract:
   - AI-generated answer (stdout)
   - Source citations with similarity scores (stderr)
   - Number of documents retrieved
4. **Present the results** including:
   - Complete AI-synthesized answer
   - Sources used (URL, title, relevance score)
   - Document count and context size
5. **Follow up** if needed:
   - Suggest refinements to the question
   - Recommend crawling additional sources
   - Point to specific documents for deeper reading

## How It Works

Unlike `/firecrawl:query` which returns raw search results, `ask` implements **RAG (Retrieval-Augmented Generation)**:

1. **Semantic search** — Embeds your question and searches Qdrant
2. **Document retrieval** — Fetches full content of top-matching documents
3. **Context assembly** — Formats documents into structured context
4. **AI reasoning** — Spawns Claude/Gemini CLI with context and question
5. **Streaming answer** — Returns AI-synthesized response with citations

## Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--limit` | number | 10 | Maximum documents to retrieve |
| `--domain` | string | none | Filter results by domain |
| `--collection` | string | firecrawl | Qdrant collection name |
| `--model` | string | haiku | Model: `haiku/sonnet/opus` (Claude) or `gemini-2.5-flash/gemini-2.5-pro` |
| `--max-context` | number | 100000 | Maximum context size in characters |

## Expected Output

**Answer (stdout):**
```
AI-generated response flows here in real-time.
Synthesized from retrieved documents with reasoning.
```

**Sources (stderr):**
```
────────────────────────────────────────────────────
Sources:
  1. [0.92] https://docs.example.com/features
     Features Overview

  2. [0.88] https://docs.example.com/getting-started
     Getting Started Guide

  i Retrieved 5 documents
```

## Model Selection Guide

| Model | When to Use | Speed | Quality |
|-------|-------------|-------|---------|
| **haiku** | Quick factual questions, 3-5 documents | Fast | Good |
| **sonnet** | Complex analysis, 5-10 documents | Medium | Excellent |
| **opus** | Deep research, 10-15+ documents | Slow | Best |
| **gemini-2.5-flash** | Fast alternative to Haiku | Fast | Good |
| **gemini-2.5-pro** | Claude Opus alternative | Medium | Excellent |

## Usage Examples

**Quick factual question:**
```bash
firecrawl ask "What is FastAPI?" --limit 3 --model haiku
```

**Complex analysis:**
```bash
firecrawl ask "Compare authentication approaches in the docs" \
  --limit 10 --model sonnet
```

**Domain-filtered query:**
```bash
firecrawl ask "What are the API endpoints?" \
  --domain api.example.com --limit 5
```

**Deep research with maximum context:**
```bash
firecrawl ask "Analyze the architecture and suggest improvements" \
  --limit 15 --model opus --max-context 200000
```

## Key Differences

| Command | Purpose | Output |
|---------|---------|--------|
| `/firecrawl:query` | Search your knowledge base | Raw results (chunks + scores) |
| `/firecrawl:ask` | **Ask questions about your knowledge** | AI-synthesized answers with reasoning |
| `/firecrawl:retrieve` | Get full document by URL | Complete document content |

**Use `ask` when:** You want AI to synthesize, compare, explain, or analyze indexed content — not just find it.

**Use `query` when:** You need raw search results to review manually or pipe to other tools.

## Context Management

The command automatically:
- Deduplicates documents by URL (keeps highest-scoring)
- Limits concurrent retrievals (prevents service overload)
- Enforces context size limits (truncates if needed)
- Warns if not all documents fit in context

Typical document sizes: 5,000-20,000 characters
Default limit (100,000 chars) fits ~5-15 documents

## Error Handling

**Before execution:**
- Verify TEI_URL and QDRANT_URL are configured
- Check that Claude/Gemini CLI is installed

**During execution:**
- Surface network/timeout errors clearly
- Handle "no documents found" gracefully
- Report AI process failures with context

**After execution:**
- Confirm sources were cited
- Verify answer quality against question
- Suggest follow-up actions if answer is incomplete
