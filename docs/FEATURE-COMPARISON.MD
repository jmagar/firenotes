# Axon Capability Snapshot (Compared to Core Firecrawl CLI)

**Last Updated**: 2026-02-16
**Axon Version**: `@jmagar/axon` v1.1.1

This document is a current-state snapshot of Axon capabilities from this repo’s codebase.

## Executive Summary

Axon provides the core Firecrawl web operations plus additional local-RAG features:
- Vector indexing/search over Qdrant (`embed`, `query`, `retrieve`, `ask`)
- Crawl reconciliation safety controls (`reconcile`)
- Rich local diagnostics and job visibility (`status`, `doctor`)
- Local file/stdin embedding with repo-scoped collection routing

## Current Top-Level Commands in Axon

Axon currently exposes 26 top-level commands:

- `scrape`
- `crawl`
- `map`
- `search`
- `extract`
- `batch`
- `embed`
- `query`
- `retrieve`
- `ask`
- `reconcile`
- `sources`
- `domains`
- `stats`
- `history`
- `info`
- `delete`
- `list`
- `status`
- `doctor`
- `config`
- `view-config`
- `login`
- `logout`
- `version`
- `completion`

## Core Web Operations

Available and supported:
- `scrape`
- `crawl`
- `map`
- `search`
- `extract`
- `batch`

## RAG / Vector Capabilities Added in Axon

- `embed`: embed URL, file, directory, or stdin into Qdrant
- `query`: semantic vector search
- `retrieve`: reconstruct full source document from chunks
- `ask`: answer generation over retrieved context

Notable current behavior:
- `ask` supports `--full-docs` and `--backfill-chunks` hybrid context assembly
- Temporal intent handling in `ask` for phrases like `today`/`yesterday`/`this week`/`this month`
- `today`/`yesterday` behave in strict scoped mode

## Crawl Reconciliation (Safety)

- `reconcile status [domain]`
- `reconcile run <domain> [--apply] [--collection <name>]`
- `reconcile reset [domain] --yes`

Purpose:
- Track crawl-discovered URLs over time
- Preview or apply stale URL cleanup safely
- Keep deletion scope constrained to crawl-sourced vectors

## Storage and Operational Features

- Unified storage root: `AXON_HOME` (default `~/.axon`)
- Persistent queue/history/settings/credentials under storage root
- Background embedding queue with status/cleanup controls
- `status` supports watch/filters and embed queue visibility
- `doctor` provides service/config diagnostics

## Collection Routing Notes

- Default resolved collection is environment/config driven (`QDRANT_COLLECTION` when set)
- `embed` local inputs (file/stdin/directory) default to repo-name collection unless overridden
- URL embeds use resolved runtime collection unless overridden

## Architecture (Current)

Default local stack in this repo:
- Firecrawl API (self-hosted)
- Patchright browser backend
- Qdrant vector database
- Axon embedder daemon

TEI:
- Can be external (commonly remote GPU host), or deployed via optional compose profiles in `docker/`

## Notes on “Official Firecrawl CLI” Comparison

This file focuses on **Axon current-state accuracy** from this repository.
If you need a strict command-by-command parity audit against the latest upstream Firecrawl CLI release, run a separate version-pinned comparison at audit time.
