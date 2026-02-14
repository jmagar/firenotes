/**
 * Type definitions for the status command
 */

export type AuthSource = 'explicit' | 'env' | 'stored' | 'none';

export interface StatusResult {
  version: string;
  authenticated: boolean;
  authSource: AuthSource;
  apiUrl: string;
}

export interface JobStatusOptions {
  apiKey?: string;
  crawl?: string;
  batch?: string;
  extract?: string;
  embed?: string | boolean;
  output?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  wide?: boolean;
  watch?: boolean;
  intervalSeconds?: number;
}

export interface EmbedQueueSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface EmbedContext {
  message: string;
  metadata?: string;
}

export type RenderStatusOptions = {
  compact: boolean;
  wide: boolean;
  changedKeys: Set<string>;
  filtersEcho?: string;
};

export type EmbedJobBase = {
  jobId: string;
  url: string;
  maxRetries: number;
  updatedAt: string;
  totalDocuments?: number;
  processedDocuments?: number;
  failedDocuments?: number;
};

export type FailedEmbed = EmbedJobBase & {
  retries: number;
  lastError?: string;
};

export type PendingEmbed = EmbedJobBase & {
  retries: number;
};

export type StatusBucket =
  | 'failed'
  | 'warn'
  | 'pending'
  | 'completed'
  | 'other';

/**
 * Raw embed job shape from the queue
 */
export interface RawEmbedJob {
  id: string;
  jobId: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  apiKey?: string;
  totalDocuments?: number;
  processedDocuments?: number;
  failedDocuments?: number;
  progressUpdatedAt?: string;
}

/**
 * Return type of executeJobStatus
 */
export interface JobStatusData {
  activeCrawls: {
    success?: boolean;
    crawls: Array<{ id: string; url: string }>;
  };
  crawls: Array<{
    id?: string;
    status?: string;
    completed?: number;
    total?: number;
    data?: Array<{ metadata?: { sourceURL?: string; url?: string } }>;
    url?: string;
    error?: string;
    updatedAt?: string;
  }>;
  batches: Array<{
    id?: string;
    status?: string;
    completed?: number;
    total?: number;
    url?: string;
    error?: string;
    updatedAt?: string;
  }>;
  extracts: Array<{
    id?: string;
    status?: string;
    url?: string;
    error?: string;
    updatedAt?: string;
  }>;
  resolvedIds: {
    crawls: string[];
    batches: string[];
    extracts: string[];
  };
  embeddings: {
    summary: EmbedQueueSummary;
    job?: RawEmbedJob;
    failed: FailedEmbed[];
    pending: PendingEmbed[];
    completed: EmbedJobBase[];
  };
}
