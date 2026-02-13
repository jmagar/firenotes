import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatCrawlStatus } from '../../../commands/crawl/format';
import type { CrawlStatusResult } from '../../../types/crawl';

describe('formatCrawlStatus', () => {
  let originalLang: string | undefined;

  beforeEach(() => {
    originalLang = process.env.LANG;
  });

  afterEach(() => {
    if (originalLang === undefined) {
      delete process.env.LANG;
    } else {
      process.env.LANG = originalLang;
    }
  });
  it('should format complete crawl status', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-123',
      status: 'completed',
      total: 50,
      completed: 50,
      creditsUsed: 100,
      expiresAt: '2026-02-15T10:30:00.000Z',
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Crawl Status for test-job-123');
    expect(result).toContain('Status: completed | Progress: 50/50 pages');
    expect(result).toContain('Filters: jobId=test-job-123');
    expect(result).toMatch(
      /As of \(EST\): \d{2}:\d{2}:\d{2} \| \d{2}\/\d{2}\/\d{4}/
    );
    expect(result).toContain('Job ID: test-job-123');
    expect(result).toContain('Status: completed');
    expect(result).toContain('Progress: 50/50 pages');
    expect(result).toContain('Credits Used: 100');
    expect(result).toContain('Expires:');
    expect(result).toMatch(/Feb.*2026/);
  });

  it('should format in-progress crawl status', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-456',
      status: 'scraping',
      total: 100,
      completed: 25,
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Job ID: test-job-456');
    expect(result).toContain('Status: scraping');
    expect(result).toContain('Progress: 25/100 pages');
    expect(result).not.toContain('Credits Used');
    expect(result).not.toContain('Expires');
  });

  it('should handle status without credits', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-789',
      status: 'completed',
      total: 10,
      completed: 10,
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Job ID: test-job-789');
    expect(result).not.toContain('Credits Used');
  });

  it('should handle status without expiration', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-000',
      status: 'scraping',
      total: 5,
      completed: 2,
      creditsUsed: 10,
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Job ID: test-job-000');
    expect(result).toContain('Credits Used: 10');
    expect(result).not.toContain('Expires');
  });

  it('should return empty string for null data', () => {
    const result = formatCrawlStatus(
      null as unknown as CrawlStatusResult['data']
    );
    expect(result).toBe('');
  });

  it('should return empty string for undefined data', () => {
    const result = formatCrawlStatus(
      undefined as unknown as CrawlStatusResult['data']
    );
    expect(result).toBe('');
  });

  it('should handle zero credits', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-111',
      status: 'completed',
      total: 1,
      completed: 1,
      creditsUsed: 0,
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Credits Used: 0');
  });

  it('should format dates in en-US locale', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-222',
      status: 'completed',
      total: 1,
      completed: 1,
      expiresAt: '2026-12-25T15:45:30.000Z',
    };

    const result = formatCrawlStatus(data);

    // Should contain month name, not number
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/\d{1,2}:\d{2}/); // Time format
  });

  it('should end with newline', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-333',
      status: 'completed',
      total: 1,
      completed: 1,
    };

    const result = formatCrawlStatus(data);

    expect(result).toMatch(/\n$/);
  });

  it('should handle failed status', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-444',
      status: 'failed',
      total: 100,
      completed: 50,
      creditsUsed: 50,
    };

    const result = formatCrawlStatus(data);

    expect(result).toContain('Status: failed');
    expect(result).toContain('Progress: 50/100 pages');
  });

  it('should fallback to en-US for invalid locale', () => {
    // Set invalid locale
    process.env.LANG = 'invalid_locale.UTF-8';

    const data: CrawlStatusResult['data'] = {
      id: 'test-job-555',
      status: 'completed',
      total: 1,
      completed: 1,
      expiresAt: '2026-12-25T15:45:30.000Z',
    };

    const result = formatCrawlStatus(data);

    // Should still format successfully (fallback to en-US)
    expect(result).toContain('Expires:');
    expect(result).toMatch(/Dec/);
  });

  it('should handle locale from LANG environment variable', () => {
    // Set valid locale (de_DE = German)
    process.env.LANG = 'de_DE.UTF-8';

    const data: CrawlStatusResult['data'] = {
      id: 'test-job-666',
      status: 'completed',
      total: 1,
      completed: 1,
      expiresAt: '2026-12-25T15:45:30.000Z',
    };

    const result = formatCrawlStatus(data);

    // Should format successfully
    expect(result).toContain('Expires:');
  });

  it('should fallback to ISO string if toLocaleString throws', () => {
    const data: CrawlStatusResult['data'] = {
      id: 'test-job-777',
      status: 'completed',
      total: 1,
      completed: 1,
      expiresAt: 'invalid-date',
    };

    const result = formatCrawlStatus(data);

    // Should still contain Expires line (fallback to ISO)
    expect(result).toContain('Expires:');
  });

  it('should handle C locale gracefully', () => {
    // Set C locale (no locale preferences)
    process.env.LANG = 'C';

    const data: CrawlStatusResult['data'] = {
      id: 'test-job-888',
      status: 'completed',
      total: 1,
      completed: 1,
      expiresAt: '2026-12-25T15:45:30.000Z',
    };

    const result = formatCrawlStatus(data);

    // Should use default en-US locale
    expect(result).toContain('Expires:');
    expect(result).toMatch(/Dec/);
  });
});
