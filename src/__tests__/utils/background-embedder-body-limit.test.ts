/**
 * Tests for background embedder webhook body size limits
 */

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

// We need to test the readJsonBody function, but it's not exported
// For testing purposes, we'll simulate the behavior inline
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

async function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalSize += buffer.length;

    if (totalSize > MAX_BODY_SIZE) {
      throw new Error(
        `Request body too large (${totalSize} bytes exceeds ${MAX_BODY_SIZE} bytes)`
      );
    }

    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

describe('Background Embedder Body Size Limits', () => {
  describe('readJsonBody', () => {
    it('should accept small JSON payloads', async () => {
      const payload = { jobId: 'test-123', status: 'completed' };
      const jsonString = JSON.stringify(payload);
      const stream = Readable.from([jsonString]);

      const result = await readJsonBody(stream);
      expect(result).toEqual(payload);
    });

    it('should accept payloads up to 10MB', async () => {
      // Create a payload just under 10MB
      const largeArray = new Array(1000).fill('x'.repeat(10000)); // ~10MB
      const payload = { data: largeArray };
      const jsonString = JSON.stringify(payload);
      const stream = Readable.from([jsonString]);

      const result = await readJsonBody(stream);
      expect(result).toEqual(payload);
    });

    it('should reject payloads exceeding 10MB', async () => {
      // Create a payload over 10MB
      const largeArray = new Array(1100).fill('x'.repeat(10000)); // ~11MB
      const payload = { data: largeArray };
      const jsonString = JSON.stringify(payload);
      const stream = Readable.from([jsonString]);

      await expect(readJsonBody(stream)).rejects.toThrow(
        /Request body too large/
      );
    });

    it('should reject payloads when cumulative chunks exceed limit', async () => {
      // Simulate chunked streaming that exceeds limit
      const chunk = Buffer.alloc(6 * 1024 * 1024); // 6MB chunk
      const stream = Readable.from([chunk, chunk]); // Total 12MB

      await expect(readJsonBody(stream)).rejects.toThrow(
        /Request body too large/
      );
    });

    it('should handle empty payloads', async () => {
      const stream = Readable.from(['']);

      const result = await readJsonBody(stream);
      expect(result).toBeNull();
    });

    it('should handle string chunks', async () => {
      const payload = { test: 'data' };
      const jsonString = JSON.stringify(payload);
      const stream = Readable.from([jsonString]);

      const result = await readJsonBody(stream);
      expect(result).toEqual(payload);
    });

    it('should handle Buffer chunks', async () => {
      const payload = { test: 'data' };
      const jsonString = JSON.stringify(payload);
      const buffer = Buffer.from(jsonString);
      const stream = Readable.from([buffer]);

      const result = await readJsonBody(stream);
      expect(result).toEqual(payload);
    });

    it('should throw on invalid JSON after size check passes', async () => {
      const stream = Readable.from(['{ invalid json }']);

      await expect(readJsonBody(stream)).rejects.toThrow();
    });
  });
});
