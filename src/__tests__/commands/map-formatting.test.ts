import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMapCommand } from '../../commands/map';
import type { IContainer } from '../../container/types';
import { createTestContainer } from '../utils/test-container';

describe('map output formatting', () => {
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
      scrape: vi.fn(),
      map: vi.fn().mockResolvedValue({
        links: [
          {
            url: 'https://example.com/docs/very/long/path/that/should/be/truncated/for/style/output/consistency',
            title: 'A very long documentation title that should be truncated',
          },
        ],
      }),
    };

    container = createTestContainer(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders title, summary, scoped filters, freshness, and aligned table', async () => {
    await handleMapCommand(container, {
      urlOrJobId: 'https://example.com',
      limit: 5,
      search: 'docs',
    });

    const output = writes.join('');
    expect(output).toContain('Map Results for https://example.com');
    expect(output).toContain('Showing 1 result | state: discovered');
    expect(output).toContain('Filters: limit=5, search=docs');
    expect(output).toContain('As of (ET):');
    expect(output).toContain('#');
    expect(output).toContain('URL');
    expect(output).toContain('Title');
    expect(output).toContain('…');
  });

  it('uses canonical empty-state wording when no links are returned', async () => {
    const mockClient = {
      scrape: vi.fn(),
      map: vi.fn().mockResolvedValue({ links: [] }),
    };
    container = createTestContainer(mockClient);

    await handleMapCommand(container, {
      urlOrJobId: 'https://example.com',
    });

    const output = writes.join('');
    expect(output).toContain('No results found.');
  });

  it('keeps json output machine-friendly', async () => {
    await handleMapCommand(container, {
      urlOrJobId: 'https://example.com',
      json: true,
    });

    const output = writes.join('');
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain('Map Results for');
    expect(output).not.toContain('Filters:');
  });
});
