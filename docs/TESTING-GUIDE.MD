# Axon CLI Testing Guide

**Last Updated**: 2026-02-16

This guide reflects the current test workflow in this repository.

## Test Commands

From `package.json`:

```bash
# Unit-only (excludes *.integration.test.ts)
pnpm test:unit

# Full default Vitest run
pnpm test

# E2E suite
pnpm test:e2e

# E2E suite with strict prerequisite enforcement
pnpm test:e2e:strict

# Unit + strict e2e
pnpm test:all

# Unit + lenient e2e
pnpm test:all:lenient

# Watch modes
pnpm test:watch
pnpm test:e2e:watch
```

## Build Requirement for E2E

E2E tests execute the built CLI (`dist/index.js`), so build first:

```bash
pnpm build
```

## Environment and Services

Most e2e scenarios need:
- Firecrawl API (`FIRECRAWL_API_URL`, `FIRECRAWL_API_KEY`)
- Qdrant (`QDRANT_URL`) for vector flows
- TEI (`TEI_URL`) for embedding/query/ask vector preparation

Typical local setup:

```bash
docker compose up -d
```

Run e2e with explicit environment variables:

```bash
FIRECRAWL_API_KEY=local-dev \
FIRECRAWL_API_URL=http://localhost:53002 \
QDRANT_URL=http://localhost:53333 \
TEI_URL=http://100.74.16.82:52000 \
pnpm test:e2e
```

## Strict Prerequisite Policy

Strict mode fails instead of silently skipping tests when prerequisites are missing:

- `AXON_E2E_STRICT_PREREQS=1` enables strict behavior
- `AXON_E2E_ALLOW_SKIPS=1` allows skip behavior even in CI flows
- `pnpm test:e2e:strict` sets strict mode via script

## Current Scope (How to Check)

Test totals change frequently. Use these commands for live counts:

```bash
# Run unit suite and see exact totals
pnpm test:unit

# Run e2e suite and see exact totals
pnpm test:e2e
```

## Useful Focused Runs

```bash
# Single file
pnpm test src/__tests__/commands/ask.test.ts

# Pattern match
pnpm test ask

# E2E single file
pnpm test:e2e src/__tests__/e2e/vector.e2e.test.ts
```

## Troubleshooting

- If e2e tests fail immediately, verify required services are reachable.
- If vector tests fail, confirm both `TEI_URL` and `QDRANT_URL` are set.
- If command execution tests fail in e2e, rebuild with `pnpm build`.
- If tests are unexpectedly skipped, use `pnpm test:e2e:strict` to surface missing prerequisites as failures.
