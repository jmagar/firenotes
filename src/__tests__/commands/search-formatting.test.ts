import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSearchCommand } from '../../commands/search';
import type { IContainer } from '../../container/types';

describe('search output formatting', () => {
  let _stdoutSpy: MockInstance;
  let _stderrSpy: MockInstance;
  let writes: string[];
  let container: IContainer;

  beforeEach(() => {
    writes = [];
    _stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        writes.push(String(chunk));
        return true;
      });
    _stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockClient = {
      search: vi.fn().mockResolvedValue({
        web: [
          {
            url: 'https://example.com/docs',
            title:
              'Very long title that should be truncated because it exceeds the configured display width for readability in terminal output rendering',
            description:
              'This description is intentionally long to ensure truncation uses the canonical continuation marker and keeps the output compact.',
          },
        ],
        news: [
          {
            url: 'https://news.example.com/item',
            title: 'Breaking update',
            snippet: 'A short snippet for news results.',
            date: '2026-02-13',
          },
        ],
      }),
      scrape: vi.fn(),
    };

    container = {
      config: {
        apiKey: 'test-api-key',
        apiUrl: 'https://api.axon.dev',
        teiUrl: 'http://localhost:53001',
        qdrantUrl: 'http://localhost:53002',
        collectionName: 'axon',
      },
      getAxonClient: vi.fn().mockReturnValue(mockClient),
      getEmbedPipeline: vi.fn().mockReturnValue({ autoEmbed: vi.fn() }),
      getHttpClient: vi.fn(),
      getTeiService: vi.fn(),
      getQdrantService: vi.fn(),
      dispose: vi.fn(),
    } as unknown as IContainer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders style header structure for readable output', async () => {
    await handleSearchCommand(container, {
      query: 'agent orchestration',
      limit: 5,
      sources: ['web', 'news'],
      scrape: false,
    });

    const output = writes.join('');
    expect(output).toContain('Search Results for "agent orchestration"');
    expect(output).toContain(
      'Showing 2 results | web: 1 | images: 0 | news: 1'
    );
    expect(output).toContain('Legend: ● web  ◐ news  ○ images');
    expect(output).toContain(
      'Filters: limit=5, sources=[web,news], scrape=false'
    );
    expect(output).toContain('As of (ET):');
    expect(output).toContain('…');
  });

  it('keeps json output machine-friendly', async () => {
    await handleSearchCommand(container, {
      query: 'agent orchestration',
      json: true,
      scrape: false,
    });

    const output = writes.join('');
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain('Search Results for');
    expect(output).not.toContain('Legend:');
    expect(output).not.toContain('Filters:');
  });
});
