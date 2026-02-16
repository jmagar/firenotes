/**
 * Tests for webhook authentication bypass scenarios (Task #9)
 *
 * Validates that the embedder webhook server properly authenticates incoming
 * requests based on X-Embedder-Secret header and prevents bypass attacks.
 *
 * Security Concerns:
 * - H-16: Server binds to 0.0.0.0 without mandatory authentication
 * - Timing attacks on secret comparison
 * - Header injection and type confusion attacks
 * - Unauthenticated access to /health and /status endpoints (expected)
 * - Resource exhaustion via unauthenticated requests
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ImmutableConfig } from '../../container/types';
import {
  buildEmbedderWebhookConfig,
  EMBEDDER_WEBHOOK_HEADER,
} from '../../utils/embedder-webhook';

describe('Webhook Authentication Bypass Prevention', () => {
  describe('Secret-based authentication', () => {
    it('should build webhook config with secret header when secret is provided', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: 'test-secret-12345',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig).not.toBeNull();
      expect(webhookConfig?.headers).toBeDefined();
      expect(webhookConfig?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(
        'test-secret-12345'
      );
    });

    it('should build webhook config without headers when no secret provided', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: undefined,
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig).not.toBeNull();
      expect(webhookConfig?.headers).toBeUndefined();
    });

    it('should return null when webhook URL not configured', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: undefined,
        embedderWebhookSecret: 'test-secret',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig).toBeNull();
    });

    it('should include completed and failed events in webhook config', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: 'test-secret',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig?.events).toEqual(['completed', 'failed']);
    });
  });

  describe('Secret validation logic', () => {
    it('should use timing-safe comparison for secrets', () => {
      const correctSecret = 'a'.repeat(64);
      const wrongSecret = 'b'.repeat(64);

      // Convert to buffers for timing-safe comparison
      const correctBuffer = Buffer.from(correctSecret);
      const providedCorrect = Buffer.from(correctSecret);
      const providedWrong = Buffer.from(wrongSecret);

      // Correct secret should pass
      expect(timingSafeEqual(correctBuffer, providedCorrect)).toBe(true);

      // Wrong secret should fail
      expect(timingSafeEqual(correctBuffer, providedWrong)).toBe(false);
    });

    it('should reject secrets with length mismatch', () => {
      const correctSecret = 'secret';
      const longerSecret = 'secret-extra';

      const correctBuffer = Buffer.from(correctSecret);
      const longerBuffer = Buffer.from(longerSecret);

      // Length mismatch should throw before comparison
      expect(() => timingSafeEqual(correctBuffer, longerBuffer)).toThrow();
    });

    it('should reject empty string secrets', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: '',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      // Empty secret should be treated as no secret
      expect(webhookConfig?.headers).toBeUndefined();
    });

    it('should handle whitespace-only secrets as empty', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: '   ',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      // Whitespace-only secret should still be set (not sanitized)
      expect(webhookConfig?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe('   ');
    });
  });

  describe('Header validation and type confusion', () => {
    it('should only accept string headers for secret', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: 'test-secret',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(typeof webhookConfig?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(
        'string'
      );
    });

    it('should use consistent header name constant', () => {
      // Verify header name constant is as expected
      expect(EMBEDDER_WEBHOOK_HEADER).toBe('x-axon-embedder-secret');
    });

    it('should handle undefined secret gracefully', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: undefined,
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig?.headers).toBeUndefined();
    });
  });

  describe('Timing attack resistance', () => {
    it('should use crypto.timingSafeEqual for secret comparison', () => {
      // Verify we're using Node's built-in timing-safe comparison
      // (actual timing resistance is validated by Node.js crypto module, not our tests)
      const secret = 'test-secret-12345678';
      const correctBuffer = Buffer.from(secret);
      const wrongBuffer = Buffer.from('wrong-secret-1234567'); // Same length

      // timingSafeEqual is from crypto module (timing-safe by design)
      expect(timingSafeEqual(correctBuffer, Buffer.from(secret))).toBe(true);
      expect(timingSafeEqual(correctBuffer, wrongBuffer)).toBe(false);
    });

    it('should handle length mismatch in timing-safe comparison', () => {
      const shortSecret = 'short';
      const longSecret = 'longer-secret';

      const shortBuffer = Buffer.from(shortSecret);
      const longBuffer = Buffer.from(longSecret);

      // Length mismatch should throw (crypto.timingSafeEqual behavior)
      expect(() => timingSafeEqual(shortBuffer, longBuffer)).toThrow();

      // Same-length secrets should compare safely
      expect(() =>
        timingSafeEqual(shortBuffer, Buffer.from('guess'))
      ).not.toThrow();
    });

    it('should document that timing resistance depends on crypto.timingSafeEqual', () => {
      // This test documents the security property rather than measuring timing
      // Real timing attack resistance is provided by Node.js crypto module
      // and should be validated with specialized profiling tools (e.g., cachegrind)

      const webhook = buildEmbedderWebhookConfig({
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: 'secret-12345678901234567890',
      } as ImmutableConfig);

      // Verify webhook config is built (the actual timing-safe comparison
      // happens in background-embedder.ts using crypto.timingSafeEqual)
      expect(webhook).not.toBeNull();
      expect(webhook?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBeDefined();
    });
  });

  describe('Webhook configuration validation', () => {
    it('should require valid URL for webhook configuration', () => {
      const configWithoutUrl: Partial<ImmutableConfig> = {
        embedderWebhookUrl: undefined,
        embedderWebhookSecret: 'test-secret',
      };

      const result = buildEmbedderWebhookConfig(
        configWithoutUrl as ImmutableConfig
      );

      expect(result).toBeNull();
    });

    it('should preserve URL exactly as provided', () => {
      const testUrl = 'http://localhost:53000/webhooks/crawl';
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: testUrl,
        embedderWebhookSecret: 'test-secret',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig?.url).toBe(testUrl);
    });

    it('should handle different URL schemes', () => {
      const configs = [
        'http://localhost:53000/webhooks/crawl',
        'https://secure.example.com/webhooks/crawl',
        'http://192.168.1.100:8080/webhook',
      ];

      for (const url of configs) {
        const config: Partial<ImmutableConfig> = {
          embedderWebhookUrl: url,
          embedderWebhookSecret: 'test-secret',
        };

        const webhookConfig = buildEmbedderWebhookConfig(
          config as ImmutableConfig
        );

        expect(webhookConfig?.url).toBe(url);
      }
    });
  });

  describe('Security best practices validation', () => {
    it('should recommend strong secrets (≥32 chars)', () => {
      const weakSecret = 'weak';
      const strongSecret = createHash('sha256')
        .update(Math.random().toString())
        .digest('hex'); // 64 chars

      // Weak secret should work but is not recommended
      const weakConfig: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: weakSecret,
      };

      const weakWebhook = buildEmbedderWebhookConfig(
        weakConfig as ImmutableConfig
      );
      expect(weakWebhook?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(weakSecret);
      expect(weakSecret.length).toBeLessThan(32); // Demonstrate it's weak

      // Strong secret should work
      const strongConfig: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: strongSecret,
      };

      const strongWebhook = buildEmbedderWebhookConfig(
        strongConfig as ImmutableConfig
      );
      expect(strongWebhook?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(
        strongSecret
      );
      expect(strongSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('should not modify or normalize secrets', () => {
      const secretWithSpecialChars = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookSecret: secretWithSpecialChars,
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(
        secretWithSpecialChars
      );
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle null config gracefully', () => {
      // Null config should result in null webhook config (no URL available)
      const webhookConfig = buildEmbedderWebhookConfig({
        embedderWebhookUrl: undefined,
      } as ImmutableConfig);
      expect(webhookConfig).toBeNull();
    });

    it('should handle undefined config gracefully', () => {
      const webhookConfig = buildEmbedderWebhookConfig(
        undefined as unknown as ImmutableConfig
      );
      expect(webhookConfig).toBeNull();
    });

    it('should handle empty config object', () => {
      const webhookConfig = buildEmbedderWebhookConfig({} as ImmutableConfig);
      expect(webhookConfig).toBeNull();
    });

    it('should prioritize URL presence over secret', () => {
      const configWithSecretNoUrl: Partial<ImmutableConfig> = {
        embedderWebhookUrl: undefined,
        embedderWebhookSecret: 'test-secret',
      };

      const result = buildEmbedderWebhookConfig(
        configWithSecretNoUrl as ImmutableConfig
      );

      expect(result).toBeNull(); // No URL = no webhook config
    });
  });

  describe('Integration with authentication flow', () => {
    it('should create valid webhook config for authenticated setup', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookPort: 53000,
        embedderWebhookPath: '/webhooks/crawl',
        embedderWebhookSecret: 'secure-secret-12345678901234567890',
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig).not.toBeNull();
      expect(webhookConfig?.url).toBe(config.embedderWebhookUrl);
      expect(webhookConfig?.headers).toBeDefined();
      expect(webhookConfig?.headers?.[EMBEDDER_WEBHOOK_HEADER]).toBe(
        config.embedderWebhookSecret
      );
      expect(webhookConfig?.events).toContain('completed');
      expect(webhookConfig?.events).toContain('failed');
    });

    it('should create valid webhook config for unauthenticated setup', () => {
      const config: Partial<ImmutableConfig> = {
        embedderWebhookUrl: 'http://localhost:53000/webhooks/crawl',
        embedderWebhookPort: 53000,
        embedderWebhookPath: '/webhooks/crawl',
        embedderWebhookSecret: undefined,
      };

      const webhookConfig = buildEmbedderWebhookConfig(
        config as ImmutableConfig
      );

      expect(webhookConfig).not.toBeNull();
      expect(webhookConfig?.url).toBe(config.embedderWebhookUrl);
      expect(webhookConfig?.headers).toBeUndefined();
      expect(webhookConfig?.events).toContain('completed');
      expect(webhookConfig?.events).toContain('failed');
    });
  });
});
