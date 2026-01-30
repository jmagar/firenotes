/**
 * Test utilities for mocking the Firecrawl client
 */

import type { Mock } from 'vitest';
import { resetClient } from '../../utils/client';
import { resetConfig } from '../../utils/config';

/**
 * Mock Firecrawl client methods
 * Uses Vitest Mock type for proper type safety
 * All properties are optional to allow flexible test setup
 */
export interface MockFirecrawlClient {
  scrape?: Mock;
  crawl?: Mock;
  map?: Mock;
  extract?: Mock;
  agent?: Mock;
  search?: Mock;
  startCrawl?: Mock;
  getCrawlStatus?: Mock;
}

/**
 * Setup test environment - reset client and config
 */
export function setupTest(): void {
  resetClient();
  resetConfig();
}

/**
 * Teardown test environment
 */
export function teardownTest(): void {
  resetClient();
  resetConfig();
}
