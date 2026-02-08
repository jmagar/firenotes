# Qdrant Inspection Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **📁 Organization Note:** When this plan is fully implemented and verified, move this file to `docs/plans/complete/` to keep the plans folder organized.

**Goal:** Add 6 CLI commands for inspecting and managing the Qdrant vector database: `sources`, `stats`, `domains`, `delete`, `history`, and `info`.

**Architecture:** Each command follows the established pattern: types → service methods → execute function → format functions → handle function → create command. All commands use the DI container for service access, return CommandResult types, and support JSON output.

**Tech Stack:** TypeScript 5.0+, Commander.js v14, Vitest v4, existing IQdrantService interface

---

## Phase 1: Extend IQdrantService (TDD per method)

### Task 1: Add CollectionInfo Type and Interface Stubs

**Files:**
- Modify: `src/container/types.ts`

**Step 1: Add CollectionInfo type and interface method stubs**

Add before IQdrantService interface (around line 66):

```typescript
/**
 * Qdrant collection information
 */
export interface CollectionInfo {
  status: string;
  vectorsCount: number;
  pointsCount: number;
  segmentsCount: number;
  config: {
    dimension: number;
    distance: string;
  };
}
```

Add to IQdrantService interface (after line 193):

```typescript
  /**
   * Get collection information (vector count, config)
   * @param collection Collection name
   */
  getCollectionInfo(collection: string): Promise<CollectionInfo>;

  /**
   * Scroll all points with optional filter, paginating through results
   * @param collection Collection name
   * @param filter Optional payload filter
   */
  scrollAll(
    collection: string,
    filter?: Record<string, unknown>
  ): Promise<QdrantPoint[]>;

  /**
   * Count total points in collection
   * @param collection Collection name
   */
  countPoints(collection: string): Promise<number>;

  /**
   * Count points matching a URL filter
   * @param collection Collection name
   * @param url URL to count
   */
  countByUrl(collection: string, url: string): Promise<number>;

  /**
   * Delete all points in collection
   * @param collection Collection name
   */
  deleteAll(collection: string): Promise<void>;
```

**Step 2: Run type check to verify it fails**

Run: `pnpm type-check`
Expected: FAIL with "Property 'getCollectionInfo' is missing in type 'QdrantService'"

**Step 3: Commit interface changes**

```bash
git add src/container/types.ts
git commit -m "$(cat <<'EOF'
feat(types): add IQdrantService inspection method signatures

Adds interface stubs for:
- getCollectionInfo
- scrollAll
- countPoints
- countByUrl
- deleteAll

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create Test Directory

**Files:**
- Create: `src/__tests__/services/` (directory)

**Step 1: Create directory**

Run: `mkdir -p src/__tests__/services`

**Step 2: Verify directory exists**

Run: `ls -la src/__tests__/services`
Expected: Empty directory listing

---

### Task 3: TDD - getCollectionInfo Method

**Files:**
- Create: `src/__tests__/services/qdrant-service.test.ts`
- Modify: `src/container/services/QdrantService.ts`

**Step 1: Write failing test for getCollectionInfo**

Create `src/__tests__/services/qdrant-service.test.ts`:

```typescript
/**
 * Tests for QdrantService inspection methods
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QdrantService } from '../../container/services/QdrantService';
import type { IHttpClient } from '../../container/types';

describe('QdrantService', () => {
  let service: QdrantService;
  let mockHttpClient: IHttpClient;
  const qdrantUrl = 'http://localhost:53333';

  beforeEach(() => {
    mockHttpClient = {
      fetchWithRetry: vi.fn(),
      fetchWithTimeout: vi.fn(),
    };
    service = new QdrantService(qdrantUrl, mockHttpClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCollectionInfo', () => {
    it('should return collection info', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              status: 'green',
              vectors_count: 1000,
              points_count: 500,
              segments_count: 3,
              config: {
                params: {
                  vectors: {
                    size: 768,
                    distance: 'Cosine',
                  },
                },
              },
            },
          }),
      } as Response);

      const info = await service.getCollectionInfo('test_collection');

      expect(info.status).toBe('green');
      expect(info.vectorsCount).toBe(1000);
      expect(info.pointsCount).toBe(500);
      expect(info.config.dimension).toBe(768);
      expect(info.config.distance).toBe('Cosine');
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(service.getCollectionInfo('missing')).rejects.toThrow(
        'Qdrant getCollectionInfo failed: 404'
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: FAIL with "service.getCollectionInfo is not a function"

**Step 3: Implement getCollectionInfo**

Add to `src/container/services/QdrantService.ts` after `countByDomain` method (line 355):

```typescript
  /**
   * Get collection information
   *
   * @param collection Collection name
   * @returns Collection info including vector count and config
   */
  async getCollectionInfo(collection: string): Promise<CollectionInfo> {
    const response = await this.httpClient.fetchWithRetry(
      `${this.qdrantUrl}/collections/${collection}`,
      undefined,
      { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
    );

    if (!response.ok) {
      throw new Error(`Qdrant getCollectionInfo failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      result?: {
        status?: string;
        vectors_count?: number;
        points_count?: number;
        segments_count?: number;
        config?: {
          params?: {
            vectors?: {
              size?: number;
              distance?: string;
            };
          };
        };
      };
    };

    const result = data.result;
    return {
      status: result?.status ?? 'unknown',
      vectorsCount: result?.vectors_count ?? 0,
      pointsCount: result?.points_count ?? 0,
      segmentsCount: result?.segments_count ?? 0,
      config: {
        dimension: result?.config?.params?.vectors?.size ?? 0,
        distance: result?.config?.params?.vectors?.distance ?? 'unknown',
      },
    };
  }
```

Also add import at top of file:

```typescript
import type { CollectionInfo, IHttpClient, IQdrantService, QdrantPoint } from '../types';
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/__tests__/services/qdrant-service.test.ts src/container/services/QdrantService.ts
git commit -m "$(cat <<'EOF'
feat(qdrant): add getCollectionInfo method with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: TDD - scrollAll Method

**Files:**
- Modify: `src/__tests__/services/qdrant-service.test.ts`
- Modify: `src/container/services/QdrantService.ts`

**Step 1: Write failing tests for scrollAll**

Add to `src/__tests__/services/qdrant-service.test.ts` inside the main describe block:

```typescript
  describe('scrollAll', () => {
    it('should scroll all points without filter', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              points: [
                { id: 'p1', payload: { url: 'https://a.com' } },
                { id: 'p2', payload: { url: 'https://b.com' } },
              ],
              next_page_offset: null,
            },
          }),
      } as Response);

      const points = await service.scrollAll('test_collection');

      expect(points).toHaveLength(2);
      expect(points[0].payload.url).toBe('https://a.com');
    });

    it('should scroll with filter', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              points: [{ id: 'p1', payload: { domain: 'example.com' } }],
              next_page_offset: null,
            },
          }),
      } as Response);

      await service.scrollAll('test_collection', { domain: 'example.com' });

      expect(mockHttpClient.fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"domain"'),
        }),
        expect.any(Object)
      );
    });

    it('should paginate through multiple pages', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                points: [{ id: 'p1', payload: {} }],
                next_page_offset: 'offset1',
              },
            }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                points: [{ id: 'p2', payload: {} }],
                next_page_offset: null,
              },
            }),
        } as Response);

      const points = await service.scrollAll('test_collection');

      expect(points).toHaveLength(2);
      expect(mockHttpClient.fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(service.scrollAll('test_collection')).rejects.toThrow(
        'Qdrant scroll failed: 500'
      );
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: FAIL with "service.scrollAll is not a function"

**Step 3: Implement scrollAll**

Add to `src/container/services/QdrantService.ts` after `getCollectionInfo`:

```typescript
  /**
   * Scroll all points with optional filter
   *
   * @param collection Collection name
   * @param filter Optional payload filter
   * @returns Array of all matching points
   */
  async scrollAll(
    collection: string,
    filter?: Record<string, unknown>
  ): Promise<QdrantPoint[]> {
    const allPoints: QdrantPoint[] = [];
    let offset: string | number | null = null;
    let isFirstPage = true;

    while (isFirstPage || offset !== null) {
      isFirstPage = false;

      const body: Record<string, unknown> = {
        limit: SCROLL_PAGE_SIZE,
        with_payload: true,
        with_vector: false,
      };

      if (filter && Object.keys(filter).length > 0) {
        body.filter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      if (offset !== null) {
        body.offset = offset;
      }

      const response = await this.httpClient.fetchWithRetry(
        `${this.qdrantUrl}/collections/${collection}/points/scroll`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
      );

      if (!response.ok) {
        throw new Error(`Qdrant scroll failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        result?: {
          points?: Array<{
            id: string;
            vector?: number[];
            payload?: Record<string, unknown>;
          }>;
          next_page_offset?: string | number | null;
        };
      };

      const points = data.result?.points || [];

      for (const p of points) {
        allPoints.push({
          id: p.id,
          vector: p.vector || [],
          payload: p.payload || {},
        });
      }

      offset = data.result?.next_page_offset ?? null;
    }

    return allPoints;
  }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/__tests__/services/qdrant-service.test.ts src/container/services/QdrantService.ts
git commit -m "$(cat <<'EOF'
feat(qdrant): add scrollAll method with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: TDD - countPoints Method

**Files:**
- Modify: `src/__tests__/services/qdrant-service.test.ts`
- Modify: `src/container/services/QdrantService.ts`

**Step 1: Write failing test for countPoints**

Add to `src/__tests__/services/qdrant-service.test.ts`:

```typescript
  describe('countPoints', () => {
    it('should return total point count', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 1234 } }),
      } as Response);

      const count = await service.countPoints('test_collection');

      expect(count).toBe(1234);
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(service.countPoints('test_collection')).rejects.toThrow(
        'Qdrant count failed: 500'
      );
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: FAIL with "service.countPoints is not a function"

**Step 3: Implement countPoints**

Add to `src/container/services/QdrantService.ts`:

```typescript
  /**
   * Count total points in collection
   *
   * @param collection Collection name
   * @returns Total point count
   */
  async countPoints(collection: string): Promise<number> {
    const response = await this.httpClient.fetchWithRetry(
      `${this.qdrantUrl}/collections/${collection}/points/count`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exact: true }),
      },
      { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
    );

    if (!response.ok) {
      throw new Error(`Qdrant count failed: ${response.status}`);
    }

    const data = (await response.json()) as { result?: { count?: number } };
    return data.result?.count ?? 0;
  }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/__tests__/services/qdrant-service.test.ts src/container/services/QdrantService.ts
git commit -m "$(cat <<'EOF'
feat(qdrant): add countPoints method with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: TDD - countByUrl Method

**Files:**
- Modify: `src/__tests__/services/qdrant-service.test.ts`
- Modify: `src/container/services/QdrantService.ts`

**Step 1: Write failing test for countByUrl**

Add to `src/__tests__/services/qdrant-service.test.ts`:

```typescript
  describe('countByUrl', () => {
    it('should return count for URL', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 5 } }),
      } as Response);

      const count = await service.countByUrl('test_collection', 'https://a.com');

      expect(count).toBe(5);
      expect(mockHttpClient.fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('https://a.com'),
        }),
        expect.any(Object)
      );
    });

    it('should throw on non-ok response', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        service.countByUrl('test_collection', 'https://a.com')
      ).rejects.toThrow('Qdrant count failed: 500');
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: FAIL with "service.countByUrl is not a function"

**Step 3: Implement countByUrl**

Add to `src/container/services/QdrantService.ts`:

```typescript
  /**
   * Count points matching a URL filter
   *
   * @param collection Collection name
   * @param url URL to count
   */
  async countByUrl(collection: string, url: string): Promise<number> {
    const response = await this.httpClient.fetchWithRetry(
      `${this.qdrantUrl}/collections/${collection}/points/count`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [{ key: 'url', match: { value: url } }],
          },
          exact: true,
        }),
      },
      { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
    );

    if (!response.ok) {
      throw new Error(`Qdrant count failed: ${response.status}`);
    }

    const data = (await response.json()) as { result?: { count?: number } };
    return data.result?.count ?? 0;
  }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/__tests__/services/qdrant-service.test.ts src/container/services/QdrantService.ts
git commit -m "$(cat <<'EOF'
feat(qdrant): add countByUrl method with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: TDD - deleteAll Method

**Files:**
- Modify: `src/__tests__/services/qdrant-service.test.ts`
- Modify: `src/container/services/QdrantService.ts`

**Step 1: Write failing test for deleteAll**

Add to `src/__tests__/services/qdrant-service.test.ts`:

```typescript
  describe('deleteAll', () => {
    it('should delete all points', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: true,
      } as Response);

      await service.deleteAll('test_collection');

      expect(mockHttpClient.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/points/delete'),
        expect.objectContaining({ method: 'POST' }),
        expect.any(Object)
      );
    });

    it('should throw on failure', async () => {
      vi.mocked(mockHttpClient.fetchWithRetry).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(service.deleteAll('test_collection')).rejects.toThrow(
        'Qdrant delete all failed: 500'
      );
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: FAIL with "service.deleteAll is not a function"

**Step 3: Implement deleteAll**

Add to `src/container/services/QdrantService.ts`:

```typescript
  /**
   * Delete all points in collection
   *
   * @param collection Collection name
   */
  async deleteAll(collection: string): Promise<void> {
    const response = await this.httpClient.fetchWithRetry(
      `${this.qdrantUrl}/collections/${collection}/points/delete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [],
          },
        }),
      },
      { timeoutMs: QDRANT_TIMEOUT_MS, maxRetries: QDRANT_MAX_RETRIES }
    );

    if (!response.ok) {
      throw new Error(`Qdrant delete all failed: ${response.status}`);
    }
  }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/services/qdrant-service.test.ts`
Expected: PASS

**Step 5: Run type check to verify all interface methods implemented**

Run: `pnpm type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/__tests__/services/qdrant-service.test.ts src/container/services/QdrantService.ts
git commit -m "$(cat <<'EOF'
feat(qdrant): add deleteAll method with tests

All IQdrantService inspection methods now implemented:
- getCollectionInfo
- scrollAll
- countPoints
- countByUrl
- deleteAll

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Command Implementation (TDD per command)

### Task 8: TDD - Sources Command

**Files:**
- Create: `src/types/sources.ts`
- Create: `src/commands/sources.ts`
- Create: `src/__tests__/commands/sources.test.ts`

**Step 1: Create type definitions**

Create `src/types/sources.ts`:

```typescript
/**
 * Sources command types
 */

export interface SourceInfo {
  url: string;
  domain: string;
  title: string;
  totalChunks: number;
  sourceCommand: string;
  scrapedAt: string;
}

export interface SourcesOptions {
  domain?: string;
  source?: string;
  limit?: number;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface SourcesResult {
  success: boolean;
  data?: {
    sources: SourceInfo[];
    totalSources: number;
    totalChunks: number;
    uniqueDomains: number;
  };
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/sources.test.ts`:

```typescript
/**
 * Tests for sources command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSources } from '../../commands/sources';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeSources', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn(),
      deleteByDomain: vi.fn(),
      countByDomain: vi.fn(),
      countByUrl: vi.fn().mockResolvedValue(0),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn(),
      scrollAll: vi.fn().mockResolvedValue([]),
      getCollectionInfo: vi.fn(),
      countPoints: vi.fn(),
      deleteAll: vi.fn(),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should list all sources', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      {
        id: 'p1',
        vector: [],
        payload: {
          url: 'https://example.com/docs',
          domain: 'example.com',
          title: 'Docs',
          total_chunks: 5,
          source_command: 'crawl',
          scraped_at: '2025-01-15T10:00:00Z',
          chunk_index: 0,
        },
      },
      {
        id: 'p2',
        vector: [],
        payload: {
          url: 'https://example.com/docs',
          domain: 'example.com',
          title: 'Docs',
          total_chunks: 5,
          source_command: 'crawl',
          scraped_at: '2025-01-15T10:00:00Z',
          chunk_index: 1,
        },
      },
      {
        id: 'p3',
        vector: [],
        payload: {
          url: 'https://other.com/api',
          domain: 'other.com',
          title: 'API',
          total_chunks: 3,
          source_command: 'scrape',
          scraped_at: '2025-01-14T09:00:00Z',
          chunk_index: 0,
        },
      },
    ]);

    const result = await executeSources(container, {});

    expect(result.success).toBe(true);
    expect(result.data?.sources).toHaveLength(2);
    expect(result.data?.totalSources).toBe(2);
    expect(result.data?.totalChunks).toBe(3);
    expect(result.data?.uniqueDomains).toBe(2);
  });

  it('should filter by domain', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([]);

    await executeSources(container, { domain: 'example.com' });

    expect(mockQdrantService.scrollAll).toHaveBeenCalledWith('test_col', {
      domain: 'example.com',
    });
  });

  it('should filter by source command', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([]);

    await executeSources(container, { source: 'crawl' });

    expect(mockQdrantService.scrollAll).toHaveBeenCalledWith('test_col', {
      source_command: 'crawl',
    });
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeSources(badContainer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });

  it('should respect limit option', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      { id: 'p1', vector: [], payload: { url: 'https://a.com', domain: 'a.com', chunk_index: 0 } },
      { id: 'p2', vector: [], payload: { url: 'https://b.com', domain: 'b.com', chunk_index: 0 } },
      { id: 'p3', vector: [], payload: { url: 'https://c.com', domain: 'c.com', chunk_index: 0 } },
    ]);

    const result = await executeSources(container, { limit: 2 });

    expect(result.data?.sources).toHaveLength(2);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/sources.test.ts`
Expected: FAIL with "Cannot find module '../../commands/sources'"

**Step 4: Implement sources command**

Create `src/commands/sources.ts`:

```typescript
/**
 * Sources command implementation
 * Lists all unique source URLs indexed in Qdrant
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { SourceInfo, SourcesOptions, SourcesResult } from '../types/sources';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';

/**
 * Execute sources command
 * Scrolls all points and aggregates unique URLs
 *
 * @param container DI container with services
 * @param options Sources options including filters
 * @returns SourcesResult with source list or error
 */
export async function executeSources(
  container: IContainer,
  options: SourcesOptions
): Promise<SourcesResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the sources command.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Build filter
    const filter: Record<string, unknown> = {};
    if (options.domain) {
      filter.domain = options.domain;
    }
    if (options.source) {
      filter.source_command = options.source;
    }

    // Scroll all points (with optional filter)
    const points = await qdrantService.scrollAll(
      collection,
      Object.keys(filter).length > 0 ? filter : undefined
    );

    // Aggregate by URL
    const sourcesMap = new Map<string, SourceInfo>();

    for (const point of points) {
      const url = String(point.payload.url || '');
      if (!url) continue;

      if (!sourcesMap.has(url)) {
        sourcesMap.set(url, {
          url,
          domain: String(point.payload.domain || ''),
          title: String(point.payload.title || ''),
          totalChunks: Number(point.payload.total_chunks || 1),
          sourceCommand: String(point.payload.source_command || ''),
          scrapedAt: String(point.payload.scraped_at || ''),
        });
      }
    }

    // Convert to array and sort by scrapedAt descending
    let sources = Array.from(sourcesMap.values()).sort((a, b) =>
      b.scrapedAt.localeCompare(a.scrapedAt)
    );

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      sources = sources.slice(0, options.limit);
    }

    // Calculate aggregates
    const uniqueDomains = new Set(sources.map((s) => s.domain)).size;

    return {
      success: true,
      data: {
        sources,
        totalSources: sources.length,
        totalChunks: points.length,
        uniqueDomains,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format sources as table
 */
function formatTable(sources: SourceInfo[]): string {
  if (sources.length === 0) {
    return 'No sources found in vector database.';
  }

  const lines: string[] = [];

  // Header
  const header = [
    'Domain'.padEnd(25),
    'URL'.padEnd(50),
    'Chunks'.padStart(6),
    'Source'.padEnd(8),
    'Added',
  ].join('  ');
  lines.push(header);
  lines.push('─'.repeat(header.length));

  // Rows
  for (const source of sources) {
    const domain =
      source.domain.length > 24
        ? source.domain.slice(0, 22) + '..'
        : source.domain.padEnd(25);
    const url =
      source.url.length > 49 ? source.url.slice(0, 47) + '..' : source.url.padEnd(50);
    const chunks = String(source.totalChunks).padStart(6);
    const cmd = source.sourceCommand.padEnd(8);
    const added = source.scrapedAt
      ? source.scrapedAt.split('T')[0]
      : 'unknown';

    lines.push([domain, url, chunks, cmd, added].join('  '));
  }

  return lines.join('\n');
}

/**
 * Format sources summary
 */
function formatSummary(data: NonNullable<SourcesResult['data']>): string {
  return `\nTotal: ${data.totalSources} sources, ${data.totalChunks} chunks across ${data.uniqueDomains} domains`;
}

/**
 * Handle sources command output
 */
export async function handleSourcesCommand(
  container: IContainer,
  options: SourcesOptions
): Promise<void> {
  const result = await executeSources(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatTable(result.data.sources) + formatSummary(result.data);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the sources command
 */
export function createSourcesCommand(): Command {
  const sourcesCmd = new Command('sources')
    .description('List all source URLs indexed in the vector database')
    .option('--domain <domain>', 'Filter by domain')
    .option(
      '--source <command>',
      'Filter by source command (scrape, crawl, embed, search, extract)'
    )
    .option('--limit <number>', 'Maximum sources to show', parseInt)
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleSourcesCommand(container, {
        domain: options.domain,
        source: options.source,
        limit: options.limit,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return sourcesCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/sources.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/sources.ts src/commands/sources.ts src/__tests__/commands/sources.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add sources command to list indexed URLs

Lists all unique source URLs in the vector database with:
- Filtering by domain and source command
- Table and JSON output formats
- Aggregate statistics

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: TDD - Stats Command

**Files:**
- Create: `src/types/stats.ts`
- Create: `src/commands/stats.ts`
- Create: `src/__tests__/commands/stats.test.ts`

**Step 1: Create type definitions**

Create `src/types/stats.ts`:

```typescript
/**
 * Stats command types
 */

export interface DomainStats {
  domain: string;
  vectorCount: number;
  sourceCount: number;
}

export interface SourceCommandStats {
  command: string;
  vectorCount: number;
}

export interface StatsData {
  collection: string;
  status: string;
  vectorsCount: number;
  pointsCount: number;
  segmentsCount: number;
  dimension: number;
  distance: string;
  byDomain: DomainStats[];
  bySourceCommand: SourceCommandStats[];
}

export interface StatsOptions {
  verbose?: boolean;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface StatsResult {
  success: boolean;
  data?: StatsData;
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/stats.test.ts`:

```typescript
/**
 * Tests for stats command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStats } from '../../commands/stats';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeStats', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn(),
      deleteByDomain: vi.fn(),
      countByDomain: vi.fn(),
      countByUrl: vi.fn(),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn(),
      scrollAll: vi.fn().mockResolvedValue([]),
      getCollectionInfo: vi.fn().mockResolvedValue({
        status: 'green',
        vectorsCount: 1000,
        pointsCount: 500,
        segmentsCount: 3,
        config: { dimension: 768, distance: 'Cosine' },
      }),
      countPoints: vi.fn().mockResolvedValue(1000),
      deleteAll: vi.fn(),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should return collection stats', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      {
        id: 'p1',
        vector: [],
        payload: { domain: 'example.com', source_command: 'crawl', url: 'https://a.com' },
      },
      {
        id: 'p2',
        vector: [],
        payload: { domain: 'example.com', source_command: 'crawl', url: 'https://a.com' },
      },
      {
        id: 'p3',
        vector: [],
        payload: { domain: 'other.com', source_command: 'scrape', url: 'https://b.com' },
      },
    ]);

    const result = await executeStats(container, {});

    expect(result.success).toBe(true);
    expect(result.data?.collection).toBe('test_col');
    expect(result.data?.status).toBe('green');
    expect(result.data?.dimension).toBe(768);
    expect(result.data?.byDomain).toHaveLength(2);
    expect(result.data?.bySourceCommand).toHaveLength(2);
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeStats(badContainer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });

  it('should aggregate by domain correctly', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      { id: 'p1', vector: [], payload: { domain: 'a.com', source_command: 'crawl', url: 'https://a.com/1' } },
      { id: 'p2', vector: [], payload: { domain: 'a.com', source_command: 'crawl', url: 'https://a.com/2' } },
      { id: 'p3', vector: [], payload: { domain: 'b.com', source_command: 'scrape', url: 'https://b.com/1' } },
    ]);

    const result = await executeStats(container, {});

    const aDomain = result.data?.byDomain.find((d) => d.domain === 'a.com');
    expect(aDomain?.vectorCount).toBe(2);
    expect(aDomain?.sourceCount).toBe(2);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/stats.test.ts`
Expected: FAIL with "Cannot find module '../../commands/stats'"

**Step 4: Implement stats command**

Create `src/commands/stats.ts`:

```typescript
/**
 * Stats command implementation
 * Shows vector database statistics
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type {
  DomainStats,
  SourceCommandStats,
  StatsData,
  StatsOptions,
  StatsResult,
} from '../types/stats';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';

/**
 * Execute stats command
 *
 * @param container DI container with services
 * @param options Stats options
 * @returns StatsResult with statistics or error
 */
export async function executeStats(
  container: IContainer,
  options: StatsOptions
): Promise<StatsResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the stats command.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Get collection info
    const collectionInfo = await qdrantService.getCollectionInfo(collection);

    // Scroll all points for aggregation
    const points = await qdrantService.scrollAll(collection);

    // Aggregate by domain
    const domainMap = new Map<string, { vectors: number; urls: Set<string> }>();
    for (const point of points) {
      const domain = String(point.payload.domain || 'unknown');
      const url = String(point.payload.url || '');

      if (!domainMap.has(domain)) {
        domainMap.set(domain, { vectors: 0, urls: new Set() });
      }
      const entry = domainMap.get(domain)!;
      entry.vectors++;
      if (url) entry.urls.add(url);
    }

    const byDomain: DomainStats[] = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        vectorCount: data.vectors,
        sourceCount: data.urls.size,
      }))
      .sort((a, b) => b.vectorCount - a.vectorCount);

    // Aggregate by source command
    const commandMap = new Map<string, number>();
    for (const point of points) {
      const cmd = String(point.payload.source_command || 'unknown');
      commandMap.set(cmd, (commandMap.get(cmd) || 0) + 1);
    }

    const bySourceCommand: SourceCommandStats[] = Array.from(
      commandMap.entries()
    )
      .map(([command, vectorCount]) => ({ command, vectorCount }))
      .sort((a, b) => b.vectorCount - a.vectorCount);

    return {
      success: true,
      data: {
        collection,
        status: collectionInfo.status,
        vectorsCount: collectionInfo.vectorsCount,
        pointsCount: collectionInfo.pointsCount,
        segmentsCount: collectionInfo.segmentsCount,
        dimension: collectionInfo.config.dimension,
        distance: collectionInfo.config.distance,
        byDomain,
        bySourceCommand,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format stats for human display
 */
function formatHuman(data: StatsData, verbose: boolean): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Vector Database Statistics');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`Collection:     ${data.collection}`);
  lines.push(`Status:         ${data.status}`);
  lines.push(`Vectors:        ${data.vectorsCount.toLocaleString()}`);
  lines.push(`Dimension:      ${data.dimension}`);
  lines.push(`Distance:       ${data.distance}`);

  if (verbose) {
    lines.push(`Points:         ${data.pointsCount.toLocaleString()}`);
    lines.push(`Segments:       ${data.segmentsCount}`);
  }

  if (data.byDomain.length > 0) {
    lines.push('');
    lines.push('By Domain:');
    for (const d of data.byDomain.slice(0, 10)) {
      const sources = d.sourceCount > 1 ? ` (${d.sourceCount} sources)` : '';
      lines.push(`  ${d.domain.padEnd(30)} ${d.vectorCount.toLocaleString().padStart(8)} vectors${sources}`);
    }
    if (data.byDomain.length > 10) {
      lines.push(`  ... and ${data.byDomain.length - 10} more domains`);
    }
  }

  if (data.bySourceCommand.length > 0) {
    lines.push('');
    lines.push('By Source Command:');
    for (const c of data.bySourceCommand) {
      lines.push(`  ${c.command.padEnd(15)} ${c.vectorCount.toLocaleString().padStart(8)} vectors`);
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Handle stats command output
 */
export async function handleStatsCommand(
  container: IContainer,
  options: StatsOptions
): Promise<void> {
  const result = await executeStats(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatHuman(result.data, !!options.verbose);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the stats command
 */
export function createStatsCommand(): Command {
  const statsCmd = new Command('stats')
    .description('Show vector database statistics')
    .option('--verbose', 'Include additional details', false)
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleStatsCommand(container, {
        verbose: options.verbose,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return statsCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/stats.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/stats.ts src/commands/stats.ts src/__tests__/commands/stats.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add stats command for vector DB statistics

Shows collection info, vector counts, and breakdowns by:
- Domain (with source counts)
- Source command (scrape, crawl, embed, etc.)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: TDD - Domains Command

**Files:**
- Create: `src/types/domains.ts`
- Create: `src/commands/domains.ts`
- Create: `src/__tests__/commands/domains.test.ts`

**Step 1: Create type definitions**

Create `src/types/domains.ts`:

```typescript
/**
 * Domains command types
 */

export interface DomainInfo {
  domain: string;
  urlCount: number;
  vectorCount: number;
  lastUpdated: string;
}

export interface DomainsOptions {
  limit?: number;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface DomainsResult {
  success: boolean;
  data?: {
    domains: DomainInfo[];
    totalDomains: number;
    totalUrls: number;
    totalVectors: number;
  };
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/domains.test.ts`:

```typescript
/**
 * Tests for domains command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDomains } from '../../commands/domains';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeDomains', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn(),
      deleteByDomain: vi.fn(),
      countByDomain: vi.fn(),
      countByUrl: vi.fn(),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn(),
      scrollAll: vi.fn().mockResolvedValue([]),
      getCollectionInfo: vi.fn(),
      countPoints: vi.fn(),
      deleteAll: vi.fn(),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should list domains with aggregates', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      { id: 'p1', vector: [], payload: { domain: 'a.com', url: 'https://a.com/1', scraped_at: '2025-01-15T10:00:00Z' } },
      { id: 'p2', vector: [], payload: { domain: 'a.com', url: 'https://a.com/2', scraped_at: '2025-01-16T10:00:00Z' } },
      { id: 'p3', vector: [], payload: { domain: 'b.com', url: 'https://b.com/1', scraped_at: '2025-01-14T10:00:00Z' } },
    ]);

    const result = await executeDomains(container, {});

    expect(result.success).toBe(true);
    expect(result.data?.domains).toHaveLength(2);
    expect(result.data?.totalDomains).toBe(2);
    expect(result.data?.totalUrls).toBe(3);
    expect(result.data?.totalVectors).toBe(3);

    const aDomain = result.data?.domains.find((d) => d.domain === 'a.com');
    expect(aDomain?.urlCount).toBe(2);
    expect(aDomain?.vectorCount).toBe(2);
  });

  it('should respect limit option', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      { id: 'p1', vector: [], payload: { domain: 'a.com', url: 'https://a.com/1' } },
      { id: 'p2', vector: [], payload: { domain: 'b.com', url: 'https://b.com/1' } },
      { id: 'p3', vector: [], payload: { domain: 'c.com', url: 'https://c.com/1' } },
    ]);

    const result = await executeDomains(container, { limit: 2 });

    expect(result.data?.domains).toHaveLength(2);
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeDomains(badContainer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/domains.test.ts`
Expected: FAIL with "Cannot find module '../../commands/domains'"

**Step 4: Implement domains command**

Create `src/commands/domains.ts`:

```typescript
/**
 * Domains command implementation
 * Lists unique domains with aggregate statistics
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { DomainInfo, DomainsOptions, DomainsResult } from '../types/domains';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';

/**
 * Execute domains command
 *
 * @param container DI container with services
 * @param options Domains options
 * @returns DomainsResult with domain list or error
 */
export async function executeDomains(
  container: IContainer,
  options: DomainsOptions
): Promise<DomainsResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the domains command.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Scroll all points
    const points = await qdrantService.scrollAll(collection);

    // Aggregate by domain
    const domainMap = new Map<
      string,
      { urls: Set<string>; vectors: number; lastUpdated: string }
    >();

    for (const point of points) {
      const domain = String(point.payload.domain || 'unknown');
      const url = String(point.payload.url || '');
      const scrapedAt = String(point.payload.scraped_at || '');

      if (!domainMap.has(domain)) {
        domainMap.set(domain, { urls: new Set(), vectors: 0, lastUpdated: '' });
      }

      const entry = domainMap.get(domain)!;
      if (url) entry.urls.add(url);
      entry.vectors++;
      if (scrapedAt > entry.lastUpdated) {
        entry.lastUpdated = scrapedAt;
      }
    }

    // Convert to array and sort by vector count descending
    let domains: DomainInfo[] = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        urlCount: data.urls.size,
        vectorCount: data.vectors,
        lastUpdated: data.lastUpdated,
      }))
      .sort((a, b) => b.vectorCount - a.vectorCount);

    // Calculate totals before limiting
    const totalUrls = domains.reduce((sum, d) => sum + d.urlCount, 0);
    const totalVectors = domains.reduce((sum, d) => sum + d.vectorCount, 0);

    // Apply limit
    if (options.limit && options.limit > 0) {
      domains = domains.slice(0, options.limit);
    }

    return {
      success: true,
      data: {
        domains,
        totalDomains: domainMap.size,
        totalUrls,
        totalVectors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format domains as table
 */
function formatTable(domains: DomainInfo[]): string {
  if (domains.length === 0) {
    return 'No domains found in vector database.';
  }

  const lines: string[] = [];

  const header = [
    'Domain'.padEnd(35),
    'URLs'.padStart(6),
    'Vectors'.padStart(8),
    'Last Updated',
  ].join('  ');
  lines.push(header);
  lines.push('─'.repeat(header.length));

  for (const domain of domains) {
    const name =
      domain.domain.length > 34
        ? domain.domain.slice(0, 32) + '..'
        : domain.domain.padEnd(35);
    const urls = String(domain.urlCount).padStart(6);
    const vectors = String(domain.vectorCount).padStart(8);
    const lastUpdated = domain.lastUpdated
      ? domain.lastUpdated.split('T')[0]
      : 'unknown';

    lines.push([name, urls, vectors, lastUpdated].join('  '));
  }

  return lines.join('\n');
}

/**
 * Format domains summary
 */
function formatSummary(data: NonNullable<DomainsResult['data']>): string {
  return `\nTotal: ${data.totalDomains} domains, ${data.totalUrls} URLs, ${data.totalVectors} vectors`;
}

/**
 * Handle domains command output
 */
export async function handleDomainsCommand(
  container: IContainer,
  options: DomainsOptions
): Promise<void> {
  const result = await executeDomains(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatTable(result.data.domains) + formatSummary(result.data);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the domains command
 */
export function createDomainsCommand(): Command {
  const domainsCmd = new Command('domains')
    .description('List unique domains in the vector database')
    .option('--limit <number>', 'Maximum domains to show', parseInt)
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleDomainsCommand(container, {
        limit: options.limit,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return domainsCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/domains.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/domains.ts src/commands/domains.ts src/__tests__/commands/domains.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add domains command for domain aggregation

Lists unique domains with:
- URL count per domain
- Vector count per domain
- Last updated timestamp

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: TDD - Delete Command

**Files:**
- Create: `src/types/delete.ts`
- Create: `src/commands/delete.ts`
- Create: `src/__tests__/commands/delete.test.ts`

**Step 1: Create type definitions**

Create `src/types/delete.ts`:

```typescript
/**
 * Delete command types
 */

export interface DeleteOptions {
  url?: string;
  domain?: string;
  all?: boolean;
  yes?: boolean;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface DeleteResult {
  success: boolean;
  data?: {
    deleted: number;
    target: string;
    targetType: 'url' | 'domain' | 'all';
  };
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/delete.test.ts`:

```typescript
/**
 * Tests for delete command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDelete } from '../../commands/delete';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeDelete', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn().mockResolvedValue(undefined),
      deleteByDomain: vi.fn().mockResolvedValue(undefined),
      countByDomain: vi.fn().mockResolvedValue(10),
      countByUrl: vi.fn().mockResolvedValue(5),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn(),
      scrollAll: vi.fn(),
      getCollectionInfo: vi.fn(),
      countPoints: vi.fn().mockResolvedValue(100),
      deleteAll: vi.fn().mockResolvedValue(undefined),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should delete by URL with --yes flag', async () => {
    const result = await executeDelete(container, {
      url: 'https://example.com/docs',
      yes: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.targetType).toBe('url');
    expect(result.data?.deleted).toBe(5);
    expect(mockQdrantService.deleteByUrl).toHaveBeenCalledWith(
      'test_col',
      'https://example.com/docs'
    );
  });

  it('should delete by domain with --yes flag', async () => {
    const result = await executeDelete(container, {
      domain: 'example.com',
      yes: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.targetType).toBe('domain');
    expect(result.data?.deleted).toBe(10);
    expect(mockQdrantService.deleteByDomain).toHaveBeenCalledWith(
      'test_col',
      'example.com'
    );
  });

  it('should delete all with --yes flag', async () => {
    const result = await executeDelete(container, {
      all: true,
      yes: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.targetType).toBe('all');
    expect(result.data?.deleted).toBe(100);
    expect(mockQdrantService.deleteAll).toHaveBeenCalledWith('test_col');
  });

  it('should fail without confirmation', async () => {
    const result = await executeDelete(container, {
      url: 'https://example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('--yes');
  });

  it('should fail without target', async () => {
    const result = await executeDelete(container, { yes: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('--url, --domain, or --all');
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeDelete(badContainer, {
      url: 'https://example.com',
      yes: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/delete.test.ts`
Expected: FAIL with "Cannot find module '../../commands/delete'"

**Step 4: Implement delete command**

Create `src/commands/delete.ts`:

```typescript
/**
 * Delete command implementation
 * Deletes vectors from Qdrant by URL, domain, or all
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { DeleteOptions, DeleteResult } from '../types/delete';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';

/**
 * Execute delete command
 *
 * @param container DI container with services
 * @param options Delete options
 * @returns DeleteResult with deletion count or error
 */
export async function executeDelete(
  container: IContainer,
  options: DeleteOptions
): Promise<DeleteResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the delete command.',
      };
    }

    // Validate target
    const targets = [options.url, options.domain, options.all].filter(Boolean);
    if (targets.length === 0) {
      return {
        success: false,
        error: 'Must specify --url, --domain, or --all to delete.',
      };
    }
    if (targets.length > 1) {
      return {
        success: false,
        error: 'Only one of --url, --domain, or --all can be specified.',
      };
    }

    // Require confirmation
    if (!options.yes) {
      return {
        success: false,
        error:
          'Deletion requires confirmation. Use --yes flag to confirm deletion.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Execute deletion based on target
    if (options.url) {
      const count = await qdrantService.countByUrl(collection, options.url);
      await qdrantService.deleteByUrl(collection, options.url);
      return {
        success: true,
        data: {
          deleted: count,
          target: options.url,
          targetType: 'url',
        },
      };
    }

    if (options.domain) {
      const count = await qdrantService.countByDomain(collection, options.domain);
      await qdrantService.deleteByDomain(collection, options.domain);
      return {
        success: true,
        data: {
          deleted: count,
          target: options.domain,
          targetType: 'domain',
        },
      };
    }

    if (options.all) {
      const count = await qdrantService.countPoints(collection);
      await qdrantService.deleteAll(collection);
      return {
        success: true,
        data: {
          deleted: count,
          target: 'all',
          targetType: 'all',
        },
      };
    }

    return {
      success: false,
      error: 'Unexpected state: no deletion target.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format deletion result for human display
 */
function formatHuman(data: NonNullable<DeleteResult['data']>): string {
  const typeLabel =
    data.targetType === 'url'
      ? `URL: ${data.target}`
      : data.targetType === 'domain'
        ? `Domain: ${data.target}`
        : 'all vectors';

  return `Deleted ${data.deleted} vectors for ${typeLabel}`;
}

/**
 * Handle delete command output
 */
export async function handleDeleteCommand(
  container: IContainer,
  options: DeleteOptions
): Promise<void> {
  const result = await executeDelete(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatHuman(result.data);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the delete command
 */
export function createDeleteCommand(): Command {
  const deleteCmd = new Command('delete')
    .description('Delete vectors from the database')
    .option('--url <url>', 'Delete all vectors for a specific URL')
    .option('--domain <domain>', 'Delete all vectors for a domain')
    .option('--all', 'Delete all vectors in the collection')
    .option('--yes', 'Confirm deletion (required)')
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleDeleteCommand(container, {
        url: options.url,
        domain: options.domain,
        all: options.all,
        yes: options.yes,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return deleteCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/delete.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/delete.ts src/commands/delete.ts src/__tests__/commands/delete.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add delete command for vector removal

Standalone delete command with:
- Delete by URL (--url)
- Delete by domain (--domain)
- Delete all (--all)
- Requires --yes confirmation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: TDD - History Command

**Files:**
- Create: `src/types/history.ts`
- Create: `src/commands/history.ts`
- Create: `src/__tests__/commands/history.test.ts`

**Step 1: Create type definitions**

Create `src/types/history.ts`:

```typescript
/**
 * History command types
 */

export interface HistoryEntry {
  date: string;
  url: string;
  domain: string;
  sourceCommand: string;
  chunks: number;
}

export interface HistoryOptions {
  days?: number;
  domain?: string;
  source?: string;
  limit?: number;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface HistoryResult {
  success: boolean;
  data?: {
    entries: HistoryEntry[];
    totalEntries: number;
    dateRange: { from: string; to: string };
  };
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/history.test.ts`:

```typescript
/**
 * Tests for history command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeHistory } from '../../commands/history';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeHistory', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn(),
      deleteByDomain: vi.fn(),
      countByDomain: vi.fn(),
      countByUrl: vi.fn(),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn(),
      scrollAll: vi.fn().mockResolvedValue([]),
      getCollectionInfo: vi.fn(),
      countPoints: vi.fn(),
      deleteAll: vi.fn(),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should list history entries sorted by date', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      {
        id: 'p1',
        vector: [],
        payload: {
          url: 'https://a.com/1',
          domain: 'a.com',
          source_command: 'crawl',
          scraped_at: '2025-01-15T10:00:00Z',
          total_chunks: 5,
          chunk_index: 0,
        },
      },
      {
        id: 'p2',
        vector: [],
        payload: {
          url: 'https://b.com/1',
          domain: 'b.com',
          source_command: 'scrape',
          scraped_at: '2025-01-16T10:00:00Z',
          total_chunks: 3,
          chunk_index: 0,
        },
      },
    ]);

    const result = await executeHistory(container, {});

    expect(result.success).toBe(true);
    expect(result.data?.entries).toHaveLength(2);
    // Should be sorted by date descending (most recent first)
    expect(result.data?.entries[0].url).toBe('https://b.com/1');
  });

  it('should filter by domain', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([]);

    await executeHistory(container, { domain: 'example.com' });

    expect(mockQdrantService.scrollAll).toHaveBeenCalledWith('test_col', {
      domain: 'example.com',
    });
  });

  it('should filter by source command', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([]);

    await executeHistory(container, { source: 'crawl' });

    expect(mockQdrantService.scrollAll).toHaveBeenCalledWith('test_col', {
      source_command: 'crawl',
    });
  });

  it('should respect limit option', async () => {
    vi.mocked(mockQdrantService.scrollAll).mockResolvedValue([
      { id: 'p1', vector: [], payload: { url: 'https://a.com', scraped_at: '2025-01-15', chunk_index: 0 } },
      { id: 'p2', vector: [], payload: { url: 'https://b.com', scraped_at: '2025-01-14', chunk_index: 0 } },
      { id: 'p3', vector: [], payload: { url: 'https://c.com', scraped_at: '2025-01-13', chunk_index: 0 } },
    ]);

    const result = await executeHistory(container, { limit: 2 });

    expect(result.data?.entries).toHaveLength(2);
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeHistory(badContainer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/history.test.ts`
Expected: FAIL with "Cannot find module '../../commands/history'"

**Step 4: Implement history command**

Create `src/commands/history.ts`:

```typescript
/**
 * History command implementation
 * Shows time-based view of indexed content
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { HistoryEntry, HistoryOptions, HistoryResult } from '../types/history';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';

/**
 * Execute history command
 *
 * @param container DI container with services
 * @param options History options
 * @returns HistoryResult with entries or error
 */
export async function executeHistory(
  container: IContainer,
  options: HistoryOptions
): Promise<HistoryResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the history command.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Build filter
    const filter: Record<string, unknown> = {};
    if (options.domain) {
      filter.domain = options.domain;
    }
    if (options.source) {
      filter.source_command = options.source;
    }

    // Scroll all points
    const points = await qdrantService.scrollAll(
      collection,
      Object.keys(filter).length > 0 ? filter : undefined
    );

    // Aggregate by URL (take first chunk's data)
    const urlMap = new Map<string, HistoryEntry>();

    for (const point of points) {
      const url = String(point.payload.url || '');
      if (!url) continue;

      // Only process first chunk (chunk_index === 0) to avoid duplicates
      const chunkIndex = Number(point.payload.chunk_index || 0);
      if (chunkIndex !== 0) continue;

      const scrapedAt = String(point.payload.scraped_at || '');

      // Filter by days if specified
      if (options.days && options.days > 0 && scrapedAt) {
        const entryDate = new Date(scrapedAt);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - options.days);
        if (entryDate < cutoff) continue;
      }

      urlMap.set(url, {
        date: scrapedAt,
        url,
        domain: String(point.payload.domain || ''),
        sourceCommand: String(point.payload.source_command || ''),
        chunks: Number(point.payload.total_chunks || 1),
      });
    }

    // Convert to array and sort by date descending
    let entries = Array.from(urlMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    // Calculate date range
    const dates = entries.map((e) => e.date).filter(Boolean);
    const dateRange = {
      from: dates.length > 0 ? dates[dates.length - 1] : '',
      to: dates.length > 0 ? dates[0] : '',
    };

    // Apply limit
    if (options.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    return {
      success: true,
      data: {
        entries,
        totalEntries: urlMap.size,
        dateRange,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format history as table
 */
function formatTable(entries: HistoryEntry[]): string {
  if (entries.length === 0) {
    return 'No history entries found.';
  }

  const lines: string[] = [];

  const header = [
    'Date'.padEnd(12),
    'Source'.padEnd(8),
    'Chunks'.padStart(6),
    'URL',
  ].join('  ');
  lines.push(header);
  lines.push('─'.repeat(80));

  for (const entry of entries) {
    const date = entry.date ? entry.date.split('T')[0] : 'unknown';
    const source = entry.sourceCommand.padEnd(8);
    const chunks = String(entry.chunks).padStart(6);
    const url = entry.url.length > 45 ? entry.url.slice(0, 43) + '..' : entry.url;

    lines.push([date.padEnd(12), source, chunks, url].join('  '));
  }

  return lines.join('\n');
}

/**
 * Format history summary
 */
function formatSummary(data: NonNullable<HistoryResult['data']>): string {
  const range =
    data.dateRange.from && data.dateRange.to
      ? ` (${data.dateRange.from.split('T')[0]} to ${data.dateRange.to.split('T')[0]})`
      : '';
  return `\nTotal: ${data.totalEntries} entries${range}`;
}

/**
 * Handle history command output
 */
export async function handleHistoryCommand(
  container: IContainer,
  options: HistoryOptions
): Promise<void> {
  const result = await executeHistory(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatTable(result.data.entries) + formatSummary(result.data);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the history command
 */
export function createHistoryCommand(): Command {
  const historyCmd = new Command('history')
    .description('Show time-based view of indexed content')
    .option('--days <number>', 'Show entries from last N days', parseInt)
    .option('--domain <domain>', 'Filter by domain')
    .option(
      '--source <command>',
      'Filter by source command (scrape, crawl, embed, etc.)'
    )
    .option('--limit <number>', 'Maximum entries to show', parseInt)
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleHistoryCommand(container, {
        days: options.days,
        domain: options.domain,
        source: options.source,
        limit: options.limit,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return historyCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/history.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/history.ts src/commands/history.ts src/__tests__/commands/history.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add history command for time-based view

Shows chronological view of indexed content with:
- Filtering by days, domain, source command
- Date range display
- Table and JSON output

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: TDD - Info Command

**Files:**
- Create: `src/types/info.ts`
- Create: `src/commands/info.ts`
- Create: `src/__tests__/commands/info.test.ts`

**Step 1: Create type definitions**

Create `src/types/info.ts`:

```typescript
/**
 * Info command types
 */

export interface UrlInfo {
  url: string;
  domain: string;
  title: string;
  totalChunks: number;
  sourceCommand: string;
  contentType: string;
  scrapedAt: string;
  chunks: Array<{
    index: number;
    header: string | null;
    textPreview: string;
  }>;
}

export interface InfoOptions {
  url: string;
  full?: boolean;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface InfoResult {
  success: boolean;
  data?: UrlInfo;
  error?: string;
}
```

**Step 2: Write failing test**

Create `src/__tests__/commands/info.test.ts`:

```typescript
/**
 * Tests for info command
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInfo } from '../../commands/info';
import type { IContainer, IQdrantService } from '../../container/types';
import { setupTest, teardownTest } from '../utils/mock-client';
import { createTestContainer } from '../utils/test-container';

describe('executeInfo', () => {
  let container: IContainer;
  let mockQdrantService: IQdrantService;

  beforeEach(() => {
    setupTest();

    mockQdrantService = {
      ensureCollection: vi.fn(),
      deleteByUrl: vi.fn(),
      deleteByDomain: vi.fn(),
      countByDomain: vi.fn(),
      countByUrl: vi.fn(),
      upsertPoints: vi.fn(),
      queryPoints: vi.fn(),
      scrollByUrl: vi.fn().mockResolvedValue([]),
      scrollAll: vi.fn(),
      getCollectionInfo: vi.fn(),
      countPoints: vi.fn(),
      deleteAll: vi.fn(),
    };

    container = createTestContainer(undefined, {
      qdrantUrl: 'http://localhost:53333',
      qdrantCollection: 'test_col',
    });

    vi.spyOn(container, 'getQdrantService').mockReturnValue(mockQdrantService);
  });

  afterEach(() => {
    teardownTest();
    vi.clearAllMocks();
  });

  it('should return info for a URL', async () => {
    vi.mocked(mockQdrantService.scrollByUrl).mockResolvedValue([
      {
        id: 'p1',
        vector: [],
        payload: {
          url: 'https://example.com/docs',
          domain: 'example.com',
          title: 'Documentation',
          total_chunks: 3,
          source_command: 'crawl',
          content_type: 'markdown',
          scraped_at: '2025-01-15T10:00:00Z',
          chunk_index: 0,
          chunk_header: 'Introduction',
          chunk_text: 'This is the introduction section...',
        },
      },
      {
        id: 'p2',
        vector: [],
        payload: {
          url: 'https://example.com/docs',
          chunk_index: 1,
          chunk_header: 'Getting Started',
          chunk_text: 'To get started, first install...',
        },
      },
      {
        id: 'p3',
        vector: [],
        payload: {
          url: 'https://example.com/docs',
          chunk_index: 2,
          chunk_header: null,
          chunk_text: 'Additional notes about configuration...',
        },
      },
    ]);

    const result = await executeInfo(container, {
      url: 'https://example.com/docs',
    });

    expect(result.success).toBe(true);
    expect(result.data?.url).toBe('https://example.com/docs');
    expect(result.data?.domain).toBe('example.com');
    expect(result.data?.title).toBe('Documentation');
    expect(result.data?.totalChunks).toBe(3);
    expect(result.data?.sourceCommand).toBe('crawl');
    expect(result.data?.chunks).toHaveLength(3);
  });

  it('should return error when URL not found', async () => {
    vi.mocked(mockQdrantService.scrollByUrl).mockResolvedValue([]);

    const result = await executeInfo(container, {
      url: 'https://nonexistent.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail when QDRANT_URL not configured', async () => {
    const badContainer = createTestContainer(undefined, {
      qdrantUrl: undefined,
    });

    const result = await executeInfo(badContainer, {
      url: 'https://example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('QDRANT_URL');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/__tests__/commands/info.test.ts`
Expected: FAIL with "Cannot find module '../../commands/info'"

**Step 4: Implement info command**

Create `src/commands/info.ts`:

```typescript
/**
 * Info command implementation
 * Shows detailed information for a specific URL
 */

import { Command } from 'commander';
import type { IContainer } from '../container/types';
import type { InfoOptions, InfoResult, UrlInfo } from '../types/info';
import { formatJson, handleCommandError } from '../utils/command';
import { validateOutputPath, writeOutput } from '../utils/output';
import { normalizeUrl } from '../utils/url';

/**
 * Execute info command
 *
 * @param container DI container with services
 * @param options Info options
 * @returns InfoResult with URL info or error
 */
export async function executeInfo(
  container: IContainer,
  options: InfoOptions
): Promise<InfoResult> {
  try {
    const config = container.config;
    const qdrantUrl = config.qdrantUrl;
    const collection =
      options.collection || config.qdrantCollection || 'firecrawl_collection';

    if (!qdrantUrl) {
      return {
        success: false,
        error: 'QDRANT_URL must be set in .env for the info command.',
      };
    }

    const qdrantService = container.getQdrantService();

    // Get all chunks for the URL
    const points = await qdrantService.scrollByUrl(collection, options.url);

    if (points.length === 0) {
      return {
        success: false,
        error: `URL not found in vector database: ${options.url}`,
      };
    }

    // Extract metadata from first point
    const firstPoint = points[0];
    const payload = firstPoint.payload;

    const info: UrlInfo = {
      url: String(payload.url || options.url),
      domain: String(payload.domain || ''),
      title: String(payload.title || ''),
      totalChunks: Number(payload.total_chunks || points.length),
      sourceCommand: String(payload.source_command || ''),
      contentType: String(payload.content_type || ''),
      scrapedAt: String(payload.scraped_at || ''),
      chunks: points.map((p) => ({
        index: Number(p.payload.chunk_index || 0),
        header:
          typeof p.payload.chunk_header === 'string'
            ? p.payload.chunk_header
            : null,
        textPreview: options.full
          ? String(p.payload.chunk_text || '')
          : String(p.payload.chunk_text || '').slice(0, 100) +
            (String(p.payload.chunk_text || '').length > 100 ? '...' : ''),
      })),
    };

    return {
      success: true,
      data: info,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format info for human display
 */
function formatHuman(info: UrlInfo, full: boolean): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('URL Information');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`URL:          ${info.url}`);
  lines.push(`Domain:       ${info.domain}`);
  if (info.title) {
    lines.push(`Title:        ${info.title}`);
  }
  lines.push(`Chunks:       ${info.totalChunks}`);
  lines.push(`Source:       ${info.sourceCommand}`);
  if (info.contentType) {
    lines.push(`Content Type: ${info.contentType}`);
  }
  if (info.scrapedAt) {
    lines.push(`Scraped At:   ${info.scrapedAt}`);
  }

  lines.push('');
  lines.push('Chunks:');
  lines.push('─'.repeat(50));

  for (const chunk of info.chunks) {
    const header = chunk.header ? ` [${chunk.header}]` : '';
    lines.push(`  #${chunk.index}${header}`);
    if (full) {
      lines.push(`    ${chunk.textPreview}`);
    } else {
      lines.push(`    ${chunk.textPreview}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Handle info command output
 */
export async function handleInfoCommand(
  container: IContainer,
  options: InfoOptions
): Promise<void> {
  const result = await executeInfo(container, options);

  if (!handleCommandError(result)) {
    return;
  }

  if (!result.data) return;

  if (options.output) {
    validateOutputPath(options.output);
  }

  let outputContent: string;

  if (options.json) {
    outputContent = formatJson({ success: true, data: result.data });
  } else {
    outputContent = formatHuman(result.data, !!options.full);
  }

  writeOutput(outputContent, options.output, !!options.output);
}

/**
 * Create and configure the info command
 */
export function createInfoCommand(): Command {
  const infoCmd = new Command('info')
    .description('Show detailed information for a specific URL')
    .argument('<url>', 'URL to get information for')
    .option('--full', 'Show full chunk text instead of preview', false)
    .option('--collection <name>', 'Qdrant collection name')
    .option('-o, --output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .action(async (url: string, options, command: Command) => {
      const container = command._container;
      if (!container) {
        throw new Error('Container not initialized');
      }

      await handleInfoCommand(container, {
        url: normalizeUrl(url),
        full: options.full,
        collection: options.collection,
        output: options.output,
        json: options.json,
      });
    });

  return infoCmd;
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/commands/info.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/info.ts src/commands/info.ts src/__tests__/commands/info.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add info command for URL details

Shows detailed information for a specific URL:
- Metadata (domain, title, source, timestamp)
- Chunk listing with headers and previews
- Full text option

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Integration

### Task 14: Register All Commands in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add imports**

Add after existing command imports (around line 34):

```typescript
import { createSourcesCommand } from './commands/sources';
import { createStatsCommand } from './commands/stats';
import { createDomainsCommand } from './commands/domains';
import { createDeleteCommand } from './commands/delete';
import { createHistoryCommand } from './commands/history';
import { createInfoCommand } from './commands/info';
```

**Step 2: Register commands**

Add after existing command registrations (around line 167):

```typescript
program.addCommand(createSourcesCommand());
program.addCommand(createStatsCommand());
program.addCommand(createDomainsCommand());
program.addCommand(createDeleteCommand());
program.addCommand(createHistoryCommand());
program.addCommand(createInfoCommand());
```

**Step 3: Run type check**

Run: `pnpm type-check`
Expected: PASS

**Step 4: Run full test suite**

Run: `pnpm test`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat(cli): register all Qdrant inspection commands

- firecrawl sources - list indexed URLs
- firecrawl stats - vector DB statistics
- firecrawl domains - domain aggregation
- firecrawl delete - remove vectors
- firecrawl history - time-based view
- firecrawl info <url> - URL details

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Final Verification

**Step 1: Type check**

Run: `pnpm type-check`
Expected: PASS

**Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (or warnings only)

**Step 3: Full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Build**

Run: `pnpm build`
Expected: PASS

**Step 5: Manual verification**

```bash
# Test help output
./dist/index.js sources --help
./dist/index.js stats --help
./dist/index.js domains --help
./dist/index.js delete --help
./dist/index.js history --help
./dist/index.js info --help

# Test with real data (requires Qdrant running at localhost:53333)
./dist/index.js stats
./dist/index.js sources --limit 5
./dist/index.js domains
./dist/index.js history --days 7
./dist/index.js info https://example.com
```

Expected: All commands display help correctly and execute without errors

---

## Verification Checklist

- [ ] All type definitions created (6 files in src/types/)
- [ ] IQdrantService extended with 5 new methods
- [ ] QdrantService implements all 5 new methods
- [ ] QdrantService methods have TDD tests
- [ ] All 6 commands implemented following TDD:
  - [ ] sources
  - [ ] stats
  - [ ] domains
  - [ ] delete
  - [ ] history
  - [ ] info
- [ ] Each command has:
  - [ ] Types file
  - [ ] Execute function
  - [ ] Handle function
  - [ ] Create command function
  - [ ] Unit tests with RED-GREEN cycle
- [ ] Commands registered in index.ts
- [ ] Type check passes
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Help text displays correctly
