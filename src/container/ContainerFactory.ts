/**
 * Container Factory
 * Creates DI containers with configuration priority resolution
 */

import { loadCredentials } from '../utils/credentials';
import { Container } from './Container';
import type { ConfigOptions, IContainer, ImmutableConfig } from './types';

/** Default API URL */
const DEFAULT_API_URL = 'https://api.firecrawl.dev';

/** Default User Agent */
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Default Qdrant collection name */
const DEFAULT_QDRANT_COLLECTION = 'firecrawl_collection';

/**
 * Create a new container with configuration priority resolution
 *
 * Priority order:
 * 1. Provided options (highest)
 * 2. Environment variables
 * 3. OS credential store
 * 4. Defaults (lowest)
 *
 * @param options Configuration options
 * @returns New container instance with immutable config
 */
export function createContainer(options: ConfigOptions = {}): IContainer {
  // Load stored credentials from OS keychain/file
  const storedCredentials = loadCredentials();

  // Parse and validate embedder webhook port from environment variable
  let embedderWebhookPortFromEnv: number | undefined;
  if (process.env.FIRECRAWL_EMBEDDER_WEBHOOK_PORT) {
    const parsed = Number.parseInt(
      process.env.FIRECRAWL_EMBEDDER_WEBHOOK_PORT,
      10
    );
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
      embedderWebhookPortFromEnv = parsed;
    } else {
      console.warn(
        `[Container] Invalid FIRECRAWL_EMBEDDER_WEBHOOK_PORT: ${process.env.FIRECRAWL_EMBEDDER_WEBHOOK_PORT} (must be 1-65535)`
      );
    }
  }

  // Validate embedder webhook port from options
  let embedderWebhookPort: number | undefined = options.embedderWebhookPort;
  if (embedderWebhookPort !== undefined) {
    if (
      !Number.isFinite(embedderWebhookPort) ||
      embedderWebhookPort <= 0 ||
      embedderWebhookPort >= 65536
    ) {
      console.warn(
        `[Container] Invalid embedderWebhookPort option: ${embedderWebhookPort} (must be 1-65535), clearing invalid value`
      );
      embedderWebhookPort = undefined;
    }
  }

  // Use validated option if available, otherwise use validated env var
  embedderWebhookPort = embedderWebhookPort || embedderWebhookPortFromEnv;

  // Resolve configuration with priority: options > env > stored > defaults
  const config: ImmutableConfig = {
    // Firecrawl API
    apiKey:
      options.apiKey ||
      process.env.FIRECRAWL_API_KEY ||
      storedCredentials?.apiKey,
    apiUrl:
      options.apiUrl ||
      process.env.FIRECRAWL_API_URL ||
      storedCredentials?.apiUrl ||
      DEFAULT_API_URL,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    backoffFactor: options.backoffFactor,
    userAgent:
      options.userAgent ||
      process.env.FIRECRAWL_USER_AGENT ||
      DEFAULT_USER_AGENT,

    // Embeddings
    teiUrl: options.teiUrl || process.env.TEI_URL,
    qdrantUrl: options.qdrantUrl || process.env.QDRANT_URL,
    qdrantCollection:
      options.qdrantCollection ||
      process.env.QDRANT_COLLECTION ||
      DEFAULT_QDRANT_COLLECTION,

    // Webhook
    embedderWebhookUrl:
      options.embedderWebhookUrl || process.env.FIRECRAWL_EMBEDDER_WEBHOOK_URL,
    embedderWebhookSecret:
      options.embedderWebhookSecret ||
      process.env.FIRECRAWL_EMBEDDER_WEBHOOK_SECRET,
    embedderWebhookPort,
    embedderWebhookPath:
      options.embedderWebhookPath ||
      process.env.FIRECRAWL_EMBEDDER_WEBHOOK_PATH,
  };

  return new Container(config);
}

/**
 * Create a new container with config override
 * Merges base container config with provided overrides
 *
 * Use case: Command-specific overrides (e.g., --api-key flag)
 * Creates a NEW container rather than mutating global state
 *
 * @param baseContainer Base container to inherit config from
 * @param overrides Configuration overrides
 * @returns New container instance with merged config
 */
export function createContainerWithOverride(
  baseContainer: IContainer,
  overrides: ConfigOptions
): IContainer {
  // Merge base config with overrides
  const mergedConfig: ImmutableConfig = {
    ...baseContainer.config,
    ...overrides,
  };

  return new Container(mergedConfig);
}
