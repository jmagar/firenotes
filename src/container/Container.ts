/**
 * Dependency Injection Container Implementation
 * Provides lazy initialization of services with immutable configuration
 */

import Firecrawl from '@mendable/firecrawl-js';
import type {
  IContainer,
  IEmbedPipeline,
  IHttpClient,
  ImmutableConfig,
  IQdrantService,
  ITeiService,
} from './types';

/**
 * Container implementation with lazy service initialization
 * All services are created on first access and memoized per container instance
 */
export class Container implements IContainer {
  public readonly config: ImmutableConfig;

  // Lazy-initialized services (memoized)
  private firecrawlClient: Firecrawl | undefined;
  private httpClient: IHttpClient | undefined;
  private teiService: ITeiService | undefined;
  private qdrantService: IQdrantService | undefined;
  private embedPipeline: IEmbedPipeline | undefined;

  /**
   * Create a new container with immutable configuration
   * @param config Configuration options (will be frozen)
   *
   * Note: Uses shallow freeze via Object.freeze(). This is sufficient since
   * ImmutableConfig contains only primitive types (string, number, undefined).
   * If nested objects are added to config in the future, consider deep freeze.
   */
  constructor(config: ImmutableConfig) {
    // Freeze config to ensure immutability (shallow freeze is sufficient)
    this.config = Object.freeze({ ...config });
  }

  /**
   * Get or create Firecrawl SDK client
   * Lazy initialization with memoization
   * @throws Error if API key is not configured
   */
  getFirecrawlClient(): Firecrawl {
    if (!this.firecrawlClient) {
      if (!this.config.apiKey) {
        throw new Error(
          'API key is required. Set FIRECRAWL_API_KEY environment variable, ' +
            'use --api-key flag, or run "firecrawl config" to set the API key.'
        );
      }

      this.firecrawlClient = new Firecrawl({
        apiKey: this.config.apiKey,
        apiUrl: this.config.apiUrl ?? undefined,
        timeoutMs: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        backoffFactor: this.config.backoffFactor,
      });
    }
    return this.firecrawlClient;
  }

  /**
   * Get or create HTTP client
   * Lazy initialization with memoization
   */
  getHttpClient(): IHttpClient {
    if (this.httpClient) {
      return this.httpClient;
    }

    // Import and create HttpClient service
    // This will be implemented in the services/ directory
    const { HttpClient } = require('./services/HttpClient');
    this.httpClient = new HttpClient() as IHttpClient;
    return this.httpClient;
  }

  /**
   * Get or create TEI service
   * Lazy initialization with memoization
   * @throws Error if TEI URL is not configured
   */
  getTeiService(): ITeiService {
    if (this.teiService) {
      return this.teiService;
    }

    if (!this.config.teiUrl) {
      throw new Error(
        'TEI_URL not configured. Set TEI_URL environment variable to enable embeddings.'
      );
    }

    // Import and create TeiService
    const { TeiService } = require('./services/TeiService');
    this.teiService = new TeiService(
      this.config.teiUrl,
      this.getHttpClient()
    ) as ITeiService;
    return this.teiService;
  }

  /**
   * Get or create Qdrant service
   * Lazy initialization with memoization
   * @throws Error if Qdrant URL is not configured
   */
  getQdrantService(): IQdrantService {
    if (this.qdrantService) {
      return this.qdrantService;
    }

    if (!this.config.qdrantUrl) {
      throw new Error(
        'QDRANT_URL not configured. Set QDRANT_URL environment variable to enable vector storage.'
      );
    }

    // Import and create QdrantService
    const { QdrantService } = require('./services/QdrantService');
    this.qdrantService = new QdrantService(
      this.config.qdrantUrl,
      this.getHttpClient()
    ) as IQdrantService;
    return this.qdrantService;
  }

  /**
   * Get or create embedding pipeline
   * Lazy initialization with memoization
   * Composes TEI and Qdrant services
   */
  getEmbedPipeline(): IEmbedPipeline {
    if (this.embedPipeline) {
      return this.embedPipeline;
    }

    // Import and create EmbedPipeline service
    const { EmbedPipeline } = require('./services/EmbedPipeline');
    this.embedPipeline = new EmbedPipeline(
      this.getTeiService(),
      this.getQdrantService(),
      this.config.qdrantCollection || 'firecrawl_collection'
    ) as IEmbedPipeline;
    return this.embedPipeline;
  }

  /**
   * Cleanup resources
   * Resets all service instances
   */
  async dispose(): Promise<void> {
    // Clear all service references
    this.firecrawlClient = undefined;
    this.httpClient = undefined;
    this.teiService = undefined;
    this.qdrantService = undefined;
    this.embedPipeline = undefined;
  }
}
