/**
 * Test container utilities for creating mock containers in tests
 */

import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { IContainer } from '../../container/types';
import { getDefaultSettings } from '../../utils/default-settings';
import type { MockAxonClient } from './mock-client';

/**
 * Create a test container with mock dependencies
 *
 * @param mockClient - Optional mock Axon client to use
 * @param options - Optional configuration overrides
 * @returns Mock container for testing
 */
export function createTestContainer(
  mockClient?: Partial<MockAxonClient>,
  options?: {
    apiKey?: string;
    apiUrl?: string;
    teiUrl?: string;
    qdrantUrl?: string;
    qdrantCollection?: string;
    userAgent?: string;
    embedderWebhookUrl?: string;
    embedderWebhookSecret?: string;
    embedderWebhookPort?: number;
    embedderWebhookPath?: string;
    mockAutoEmbed?: Mock;
  }
): IContainer {
  const mockAutoEmbed =
    options?.mockAutoEmbed ?? vi.fn().mockResolvedValue(undefined);

  // Ensure scrape is always present (required by MockAxonClient interface)
  const fullMockClient: MockAxonClient = {
    scrape: vi.fn(),
    ...mockClient,
  };

  // Create mock HTTP client that uses injected mock fetch
  // Do NOT delegate to global.fetch to prevent test contamination
  const mockFetch = vi.fn();
  const mockHttpClient = {
    fetchWithTimeout: vi.fn(
      async (url: string, init?: RequestInit, _timeoutMs?: number) => {
        // Use injected mock instead of global fetch
        if (mockFetch.getMockImplementation()) {
          return await mockFetch(url, init);
        }
        throw new Error(
          'No fetch mock configured - use mockFetch.mockResolvedValue() in your test'
        );
      }
    ),
    fetchWithRetry: vi.fn(async (url: string, init?: RequestInit) => {
      // Use injected mock instead of global fetch
      if (mockFetch.getMockImplementation()) {
        return await mockFetch(url, init);
      }
      throw new Error(
        'No fetch mock configured - use mockFetch.mockResolvedValue() in your test'
      );
    }),
    mockFetch, // Expose for test configuration
  };

  // Freeze config to mirror ImmutableConfig behavior
  const config = Object.freeze({
    apiKey: options && 'apiKey' in options ? options.apiKey : 'test-api-key',
    apiUrl:
      options && 'apiUrl' in options ? options.apiUrl : 'https://api.axon.dev',
    teiUrl:
      options && 'teiUrl' in options ? options.teiUrl : 'http://localhost:8080',
    qdrantUrl:
      options && 'qdrantUrl' in options
        ? options.qdrantUrl
        : 'http://localhost:6333',
    qdrantCollection:
      options && 'qdrantCollection' in options
        ? options.qdrantCollection
        : 'test_collection',
    userAgent: options?.userAgent,
    embedderWebhookUrl: options?.embedderWebhookUrl,
    embedderWebhookSecret: options?.embedderWebhookSecret,
    embedderWebhookPort: options?.embedderWebhookPort,
    embedderWebhookPath: options?.embedderWebhookPath,
    settings: getDefaultSettings(),
  });

  return {
    config,
    getAxonClient: vi.fn().mockReturnValue(fullMockClient),
    getEmbedPipeline: vi.fn().mockReturnValue({
      autoEmbed: mockAutoEmbed,
      batchEmbed: vi.fn().mockResolvedValue(undefined),
    }),
    getTeiService: vi.fn(),
    getQdrantService: vi.fn(),
    getHttpClient: vi.fn().mockReturnValue(mockHttpClient),
    dispose: vi.fn().mockResolvedValue(undefined),
  } as unknown as IContainer;
}
