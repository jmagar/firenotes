/**
 * HttpClient service tests
 * Verifies delegation to centralized utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../../container/services/HttpClient';
import * as httpUtils from '../../../utils/http';

// Spy on centralized utilities
vi.mock('../../../utils/http', () => ({
  fetchWithRetry: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

describe('HttpClient service', () => {
  let httpClient: HttpClient;
  const mockFetchWithRetry = vi.mocked(httpUtils.fetchWithRetry);
  const mockFetchWithTimeout = vi.mocked(httpUtils.fetchWithTimeout);

  beforeEach(() => {
    httpClient = new HttpClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWithRetry', () => {
    it('should delegate to utils/http.fetchWithRetry with correct parameters', async () => {
      const mockResponse = new Response('test', { status: 200 });
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse);

      const url = 'https://example.com';
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      const options = {
        timeoutMs: 5000,
        maxRetries: 2,
        backoffFactor: 1.5,
      };

      const result = await httpClient.fetchWithRetry(url, init, options);

      expect(result).toBe(mockResponse);
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
      expect(mockFetchWithRetry).toHaveBeenCalledWith(url, init, {
        timeoutMs: 5000,
        maxRetries: 2,
      });
    });

    it('should delegate without options', async () => {
      const mockResponse = new Response('test', { status: 200 });
      mockFetchWithRetry.mockResolvedValueOnce(mockResponse);

      const url = 'https://example.com';

      const result = await httpClient.fetchWithRetry(url);

      expect(result).toBe(mockResponse);
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
      expect(mockFetchWithRetry).toHaveBeenCalledWith(url, undefined, {
        timeoutMs: undefined,
        maxRetries: undefined,
      });
    });

    it('should propagate errors from utils/http.fetchWithRetry', async () => {
      const error = new Error('Network error');
      mockFetchWithRetry.mockRejectedValueOnce(error);

      const url = 'https://example.com';

      await expect(httpClient.fetchWithRetry(url)).rejects.toThrow(
        'Network error'
      );
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchWithTimeout', () => {
    it('should delegate to utils/http.fetchWithTimeout with correct parameters', async () => {
      const mockResponse = new Response('test', { status: 200 });
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse);

      const url = 'https://example.com';
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      const timeoutMs = 5000;

      const result = await httpClient.fetchWithTimeout(url, init, timeoutMs);

      expect(result).toBe(mockResponse);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(url, init, timeoutMs);
    });

    it('should delegate without timeout parameter', async () => {
      const mockResponse = new Response('test', { status: 200 });
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse);

      const url = 'https://example.com';

      const result = await httpClient.fetchWithTimeout(url);

      expect(result).toBe(mockResponse);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        url,
        undefined,
        undefined
      );
    });

    it('should propagate errors from utils/http.fetchWithTimeout', async () => {
      const error = new Error('Timeout error');
      mockFetchWithTimeout.mockRejectedValueOnce(error);

      const url = 'https://example.com';

      await expect(httpClient.fetchWithTimeout(url)).rejects.toThrow(
        'Timeout error'
      );
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });
  });
});
