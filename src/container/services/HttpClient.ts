/**
 * HTTP Client Service
 * Provides HTTP utilities with timeout and retry support
 *
 * Features:
 * - Configurable timeout using AbortController
 * - Exponential backoff retry for transient errors
 * - Consistent error handling
 * - No global state (instance-based)
 */

import type { IHttpClient } from '../types';

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Error types that should trigger a retry
 */
const RETRYABLE_ERROR_TYPES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'AbortError',
];

/**
 * Default HTTP configuration
 */
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

/**
 * HttpClient service implementation
 * Provides retry and timeout capabilities for HTTP requests
 */
export class HttpClient implements IHttpClient {
  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check error name (AbortError for timeout)
      if (RETRYABLE_ERROR_TYPES.includes(error.name)) {
        return true;
      }
      // Check error code (Node.js system errors)
      const errorWithCode = error as Error & { code?: string };
      if (
        errorWithCode.code &&
        RETRYABLE_ERROR_TYPES.includes(errorWithCode.code)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  private calculateBackoff(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number
  ): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = baseDelayMs * 2 ** attempt;
    // Add jitter (±25% randomization)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = exponentialDelay + jitter;
    // Cap at maximum delay
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch with automatic retry on transient errors
   *
   * Features:
   * - Retries on 408, 429, 500, 502, 503, 504 status codes
   * - Retries on network errors (ECONNRESET, ETIMEDOUT, etc.)
   * - Exponential backoff with jitter
   * - Configurable timeout and retry limits
   *
   * @param url URL to fetch
   * @param init Fetch init options
   * @param options Retry options
   * @returns Fetch Response
   * @throws Error if all retries are exhausted or non-retryable error occurs
   */
  async fetchWithRetry(
    url: string,
    init?: RequestInit,
    options?: {
      timeoutMs?: number;
      maxRetries?: number;
      backoffFactor?: number;
    }
  ): Promise<Response> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const baseDelayMs = DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = DEFAULT_MAX_DELAY_MS;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if we should retry based on status code
        if (
          RETRYABLE_STATUS_CODES.includes(response.status) &&
          attempt < maxRetries
        ) {
          lastError = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          const delay = this.calculateBackoff(attempt, baseDelayMs, maxDelayMs);
          await this.sleep(delay);
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        // Wrap AbortError with more context
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeoutMs}ms`);
          lastError.name = 'TimeoutError';
        } else if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error(String(error));
        }

        // Only retry if it's a retryable error and we have attempts left
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt, baseDelayMs, maxDelayMs);
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error or out of retries
        throw lastError;
      }
    }

    // Should only reach here if all retries exhausted
    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Fetch with timeout but no retry
   *
   * Useful for operations that should not be retried (e.g., POST with side effects)
   *
   * @param url URL to fetch
   * @param init Fetch init options
   * @param timeoutMs Request timeout in milliseconds
   * @returns Fetch Response
   * @throws Error if timeout or network error occurs
   */
  async fetchWithTimeout(
    url: string,
    init?: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    }
  }
}
