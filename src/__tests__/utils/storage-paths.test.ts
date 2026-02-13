import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

describe('storage-paths', () => {
  let originalFirecrawlHome: string | undefined;
  let originalEmbedQueueDir: string | undefined;

  beforeEach(() => {
    originalFirecrawlHome = process.env.FIRECRAWL_HOME;
    originalEmbedQueueDir = process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR;
    vi.clearAllMocks();
    // Required: module reads process.env during import.
    vi.resetModules();
    delete process.env.FIRECRAWL_HOME;
    delete process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR;
  });

  afterEach(() => {
    if (originalFirecrawlHome === undefined) {
      delete process.env.FIRECRAWL_HOME;
    } else {
      process.env.FIRECRAWL_HOME = originalFirecrawlHome;
    }
    if (originalEmbedQueueDir === undefined) {
      delete process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR;
    } else {
      process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR = originalEmbedQueueDir;
    }
  });

  it('should default to ~/.firecrawl', async () => {
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/home/testuser/.firecrawl');
  });

  it('should use FIRECRAWL_HOME override', async () => {
    process.env.FIRECRAWL_HOME = '/tmp/custom-firecrawl-home';
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/tmp/custom-firecrawl-home');
  });

  it('should expand leading tilde in FIRECRAWL_HOME', async () => {
    process.env.FIRECRAWL_HOME = '~/.firecrawl';
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/home/testuser/.firecrawl');
  });

  it('should use trimmed FIRECRAWL_EMBEDDER_QUEUE_DIR when absolute', async () => {
    process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR = '  /tmp/embed-queue  ';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe('/tmp/embed-queue');
  });

  it('should resolve relative FIRECRAWL_EMBEDDER_QUEUE_DIR from cwd', async () => {
    process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR = 'relative/queue-dir';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe(join(process.cwd(), 'relative/queue-dir'));
  });

  it('should ignore whitespace-only FIRECRAWL_EMBEDDER_QUEUE_DIR', async () => {
    process.env.FIRECRAWL_EMBEDDER_QUEUE_DIR = '   ';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe('/home/testuser/.firecrawl/embed-queue');
  });
});
