/**
 * Tests for background embedder stale job processing and daemon detection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IContainer } from '../../container/types';

vi.mock('../../utils/embed-queue', () => ({
  getStalePendingJobs: vi.fn(),
  markJobProcessing: vi.fn(),
  markJobCompleted: vi.fn(),
  markJobFailed: vi.fn(),
  updateEmbedJob: vi.fn(),
  cleanupOldJobs: vi.fn().mockReturnValue(0),
}));

vi.mock('../../utils/config', () => ({
  getConfig: vi.fn().mockReturnValue({
    teiUrl: 'http://tei:8080',
    qdrantUrl: 'http://qdrant:6333',
  }),
  initializeConfig: vi.fn(),
}));

vi.mock('../../utils/embedpipeline', () => ({
  createEmbedItems: vi
    .fn()
    .mockReturnValue([
      { content: 'hello', metadata: { url: 'https://example.com' } },
    ]),
  batchEmbed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../container/DaemonContainerFactory', () => ({
  createDaemonContainer: vi.fn(),
}));

describe('processStaleJobsOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process stale pending jobs', async () => {
    const { getStalePendingJobs, markJobProcessing, markJobCompleted } =
      await import('../../utils/embed-queue');
    const { createDaemonContainer } = await import(
      '../../container/DaemonContainerFactory'
    );

    vi.mocked(getStalePendingJobs).mockReturnValue([
      {
        id: 'job-1',
        jobId: 'job-1',
        url: 'https://example.com',
        status: 'pending',
        retries: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const mockClient = {
      getCrawlStatus: vi.fn().mockResolvedValue({
        status: 'completed',
        data: [
          {
            markdown: 'hello',
            metadata: { sourceURL: 'https://example.com' },
          },
        ],
      }),
    };

    const mockContainer: IContainer = {
      config: {
        apiKey: 'test-key',
        teiUrl: 'http://tei:8080',
        qdrantUrl: 'http://qdrant:6333',
      },
      getFirecrawlClient: vi.fn().mockReturnValue(mockClient),
      getHttpClient: vi.fn(),
      getTeiService: vi.fn(),
      getQdrantService: vi.fn(),
      getEmbedPipeline: vi.fn(),
      dispose: vi.fn(),
    };

    vi.mocked(createDaemonContainer).mockReturnValue(mockContainer);

    const { processStaleJobsOnce } = await import(
      '../../utils/background-embedder'
    );

    const processed = await processStaleJobsOnce(mockContainer, 60_000);

    expect(processed).toBe(1);
    expect(markJobProcessing).toHaveBeenCalledWith('job-1');
    expect(markJobCompleted).toHaveBeenCalledWith('job-1');
  });
});

describe('isEmbedderRunning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when daemon responds to health check', async () => {
    // Mock successful health check response
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    });

    const { isEmbedderRunning } = await import(
      '../../utils/background-embedder'
    );

    const result = await isEmbedderRunning();

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/http:\/\/localhost:\d+\/health/),
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('should return true when daemon returns 404 (server running but no health endpoint)', async () => {
    // Mock 404 response (server is running but endpoint doesn't exist)
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });

    const { isEmbedderRunning } = await import(
      '../../utils/background-embedder'
    );

    const result = await isEmbedderRunning();

    expect(result).toBe(true);
  });

  it('should return false when daemon is not running (connection refused)', async () => {
    // Mock connection refused error
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));

    const { isEmbedderRunning } = await import(
      '../../utils/background-embedder'
    );

    const result = await isEmbedderRunning();

    expect(result).toBe(false);
  });

  it('should return false when daemon health check times out', async () => {
    // Mock timeout error
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('The operation was aborted'));

    const { isEmbedderRunning } = await import(
      '../../utils/background-embedder'
    );

    const result = await isEmbedderRunning();

    expect(result).toBe(false);
  });

  it('should handle network errors gracefully', async () => {
    // Mock network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { isEmbedderRunning } = await import(
      '../../utils/background-embedder'
    );

    const result = await isEmbedderRunning();

    expect(result).toBe(false);
  });
});
