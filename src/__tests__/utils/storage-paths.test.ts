import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

describe('storage-paths', () => {
  let originalAxonHome: string | undefined;
  let originalEmbedQueueDir: string | undefined;

  beforeEach(() => {
    originalAxonHome = process.env.AXON_HOME;
    originalEmbedQueueDir = process.env.AXON_EMBEDDER_QUEUE_DIR;
    vi.clearAllMocks();
    // Required: module reads process.env during import.
    vi.resetModules();
    delete process.env.AXON_HOME;
    delete process.env.AXON_EMBEDDER_QUEUE_DIR;
  });

  afterEach(() => {
    if (originalAxonHome === undefined) {
      delete process.env.AXON_HOME;
    } else {
      process.env.AXON_HOME = originalAxonHome;
    }
    if (originalEmbedQueueDir === undefined) {
      delete process.env.AXON_EMBEDDER_QUEUE_DIR;
    } else {
      process.env.AXON_EMBEDDER_QUEUE_DIR = originalEmbedQueueDir;
    }
  });

  it('should default to ~/.axon', async () => {
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/home/testuser/.axon');
  });

  it('should use AXON_HOME override', async () => {
    process.env.AXON_HOME = '/tmp/custom-axon-home';
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/tmp/custom-axon-home');
  });

  it('should expand leading tilde in AXON_HOME', async () => {
    process.env.AXON_HOME = '~/.axon';
    const { getStorageRoot } = await import('../../utils/storage-paths');
    expect(getStorageRoot()).toBe('/home/testuser/.axon');
  });

  it('should use trimmed AXON_EMBEDDER_QUEUE_DIR when absolute', async () => {
    process.env.AXON_EMBEDDER_QUEUE_DIR = '  /tmp/embed-queue  ';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe('/tmp/embed-queue');
  });

  it('should resolve relative AXON_EMBEDDER_QUEUE_DIR from cwd', async () => {
    process.env.AXON_EMBEDDER_QUEUE_DIR = 'relative/queue-dir';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe(join(process.cwd(), 'relative/queue-dir'));
  });

  it('should ignore whitespace-only AXON_EMBEDDER_QUEUE_DIR', async () => {
    process.env.AXON_EMBEDDER_QUEUE_DIR = '   ';
    const { getEmbedQueueDir } = await import('../../utils/storage-paths');
    expect(getEmbedQueueDir()).toBe('/home/testuser/.axon/embed-queue');
  });
});
