import { describe, expect, it } from 'vitest';
import {
  canonicalSymbols,
  formatFiltersLine,
  formatFreshnessLine,
  formatHeaderBlock,
  formatOverflowCount,
  formatSummaryLine,
  truncateWithMarker,
  truncationMarkers,
} from '../../utils/display';

describe('display helpers', () => {
  it('formats summary segments with canonical separator', () => {
    expect(formatSummaryLine(['one', 'two', 'three'])).toBe(
      'one | two | three'
    );
  });

  it('formats filters and ignores undefined/empty values', () => {
    const line = formatFiltersLine({
      limit: 5,
      domain: 'example.com',
      ignored: undefined,
      empty: [],
      sources: ['web', 'news'],
    });

    expect(line).toBe(
      'Filters: limit=5, domain=example.com, sources=[web,news]'
    );
  });

  it('formats freshness in required EST-labeled shape', () => {
    const line = formatFreshnessLine(new Date('2026-02-13T19:42:10.000Z'));
    expect(line).toMatch(
      /^As of \(EST\): \d{2}:\d{2}:\d{2} \| \d{2}\/\d{2}\/\d{4}$/
    );
  });

  it('uses canonical truncation markers', () => {
    expect(truncateWithMarker('abcdef', 4)).toBe(
      `abc${truncationMarkers.continuation}`
    );
    expect(formatOverflowCount(3)).toBe(`${truncationMarkers.overflowPrefix}3`);
  });

  it('builds full header block with title/summary/legend/filters/freshness', () => {
    const lines = formatHeaderBlock({
      title: 'Query Results for "test"',
      summary: ['Showing 2 of 2 results', 'mode: compact'],
      legend: [
        { symbol: canonicalSymbols.running, label: 'high relevance' },
        { symbol: canonicalSymbols.partial, label: 'medium relevance' },
      ],
      filters: { limit: 2, domain: 'example.com' },
      freshness: true,
      now: new Date('2026-02-13T19:42:10.000Z'),
    });

    const joined = lines.join('\n');
    expect(joined).toContain('Query Results for "test"');
    expect(joined).toContain('Showing 2 of 2 results | mode: compact');
    expect(joined).toContain('Legend: ● high relevance  ◐ medium relevance');
    expect(joined).toContain('Filters: limit=2, domain=example.com');
    expect(joined).toContain('As of (EST):');
  });
});
