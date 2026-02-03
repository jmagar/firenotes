/**
 * Tests for delete command
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDelete } from '../../commands/delete';
import type { IContainer } from '../../container/types';
import type { DeleteOptions } from '../../types/delete';

describe('delete command', () => {
  let mockContainer: IContainer;
  let mockQdrantService: {
    countByUrl: ReturnType<typeof vi.fn>;
    deleteByUrl: ReturnType<typeof vi.fn>;
    countByDomain: ReturnType<typeof vi.fn>;
    deleteByDomain: ReturnType<typeof vi.fn>;
    countPoints: ReturnType<typeof vi.fn>;
    deleteAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockQdrantService = {
      countByUrl: vi.fn(),
      deleteByUrl: vi.fn(),
      countByDomain: vi.fn(),
      deleteByDomain: vi.fn(),
      countPoints: vi.fn(),
      deleteAll: vi.fn(),
    };

    mockContainer = {
      config: {
        qdrantUrl: 'http://localhost:53333',
        qdrantCollection: 'test_collection',
      },
      getQdrantService: () => mockQdrantService as any,
    } as IContainer;
  });

  describe('validation', () => {
    it('should fail when QDRANT_URL is not configured', async () => {
      const container = {
        config: {},
        getQdrantService: () => mockQdrantService as any,
      } as IContainer;

      const options: DeleteOptions = {
        url: 'https://example.com',
        yes: true,
      };

      const result = await executeDelete(container, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'QDRANT_URL must be set in .env for the delete command.'
      );
    });

    it('should fail when no target is specified', async () => {
      const options: DeleteOptions = {
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Must specify exactly one target: --url, --domain, or --all'
      );
    });

    it('should fail when multiple targets are specified', async () => {
      const options: DeleteOptions = {
        url: 'https://example.com',
        domain: 'example.com',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Must specify exactly one target: --url, --domain, or --all'
      );
    });

    it('should fail when --yes flag is not provided', async () => {
      const options: DeleteOptions = {
        url: 'https://example.com',
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Delete operation requires explicit confirmation with --yes flag'
      );
    });
  });

  describe('delete by URL', () => {
    it('should delete vectors for a specific URL', async () => {
      mockQdrantService.countByUrl.mockResolvedValue(42);
      mockQdrantService.deleteByUrl.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        url: 'https://example.com/page',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        deleted: 42,
        target: 'https://example.com/page',
        targetType: 'url',
      });
      expect(mockQdrantService.countByUrl).toHaveBeenCalledWith(
        'test_collection',
        'https://example.com/page'
      );
      expect(mockQdrantService.deleteByUrl).toHaveBeenCalledWith(
        'test_collection',
        'https://example.com/page'
      );
    });

    it('should handle URL with no vectors', async () => {
      mockQdrantService.countByUrl.mockResolvedValue(0);
      mockQdrantService.deleteByUrl.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        url: 'https://example.com/nonexistent',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(0);
    });
  });

  describe('delete by domain', () => {
    it('should delete vectors for a specific domain', async () => {
      mockQdrantService.countByDomain.mockResolvedValue(100);
      mockQdrantService.deleteByDomain.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        domain: 'example.com',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        deleted: 100,
        target: 'example.com',
        targetType: 'domain',
      });
      expect(mockQdrantService.countByDomain).toHaveBeenCalledWith(
        'test_collection',
        'example.com'
      );
      expect(mockQdrantService.deleteByDomain).toHaveBeenCalledWith(
        'test_collection',
        'example.com'
      );
    });

    it('should handle domain with no vectors', async () => {
      mockQdrantService.countByDomain.mockResolvedValue(0);
      mockQdrantService.deleteByDomain.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        domain: 'empty.com',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(0);
    });
  });

  describe('delete all', () => {
    it('should delete all vectors in collection', async () => {
      mockQdrantService.countPoints.mockResolvedValue(500);
      mockQdrantService.deleteAll.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        all: true,
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        deleted: 500,
        target: 'all vectors',
        targetType: 'all',
      });
      expect(mockQdrantService.countPoints).toHaveBeenCalledWith(
        'test_collection'
      );
      expect(mockQdrantService.deleteAll).toHaveBeenCalledWith(
        'test_collection'
      );
    });

    it('should handle empty collection', async () => {
      mockQdrantService.countPoints.mockResolvedValue(0);
      mockQdrantService.deleteAll.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        all: true,
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockQdrantService.countByUrl.mockRejectedValue(
        new Error('Qdrant connection failed')
      );

      const options: DeleteOptions = {
        url: 'https://example.com',
        yes: true,
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Qdrant connection failed');
    });
  });

  describe('custom collection', () => {
    it('should use custom collection when specified', async () => {
      mockQdrantService.countByUrl.mockResolvedValue(10);
      mockQdrantService.deleteByUrl.mockResolvedValue(undefined);

      const options: DeleteOptions = {
        url: 'https://example.com',
        yes: true,
        collection: 'custom_collection',
      };

      const result = await executeDelete(mockContainer, options);

      expect(result.success).toBe(true);
      expect(mockQdrantService.countByUrl).toHaveBeenCalledWith(
        'custom_collection',
        'https://example.com'
      );
      expect(mockQdrantService.deleteByUrl).toHaveBeenCalledWith(
        'custom_collection',
        'https://example.com'
      );
    });
  });
});
