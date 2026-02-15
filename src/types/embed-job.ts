/**
 * Type-safe discriminated union types for embedding job states
 *
 * Using discriminated unions allows TypeScript to narrow types based on the
 * status field, preventing invalid state combinations (e.g., accessing lastError
 * on completed jobs when type guarantees it's defined only on failed jobs).
 */

/** Base properties shared across all job states */
interface EmbedJobBase {
  readonly id: string;
  readonly jobId: string;
  readonly url: string;
  readonly retries: number;
  readonly maxRetries: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly apiKey?: string;
  readonly totalDocuments?: number;
  readonly processedDocuments?: number;
  readonly failedDocuments?: number;
  readonly progressUpdatedAt?: string;
}

/** Pending job: queued for processing, not yet claimed by a worker */
export interface PendingEmbedJob extends EmbedJobBase {
  readonly status: 'pending';
  readonly lastError?: undefined; // Pending jobs don't have errors
}

/** Processing job: currently being processed by the embedder daemon */
export interface ProcessingEmbedJob extends EmbedJobBase {
  readonly status: 'processing';
  readonly lastError?: undefined; // Processing jobs may transition to failed, but don't track errors yet
}

/** Completed job: successfully embedded and stored in Qdrant */
export interface CompletedEmbedJob extends EmbedJobBase {
  readonly status: 'completed';
  readonly lastError?: undefined; // Completed jobs don't have errors
}

/** Failed job: exhausted retries or encountered unrecoverable error */
export interface FailedEmbedJob extends EmbedJobBase {
  readonly status: 'failed';
  readonly lastError?: string; // Failed jobs may have error context
}

/**
 * Union of all possible embedding job states
 *
 * Type narrowing example:
 * ```typescript
 * const job: EmbedJob = getJob(id);
 * if (job.status === 'failed') {
 *   console.log(job.lastError); // TypeScript knows lastError exists
 * }
 * ```
 */
export type EmbedJob =
  | PendingEmbedJob
  | ProcessingEmbedJob
  | CompletedEmbedJob
  | FailedEmbedJob;

/**
 * Type predicate functions for runtime narrowing (when TypeScript narrowing isn't enough)
 */
export function isPendingJob(job: EmbedJob): job is PendingEmbedJob {
  return job.status === 'pending';
}

export function isProcessingJob(job: EmbedJob): job is ProcessingEmbedJob {
  return job.status === 'processing';
}

export function isCompletedJob(job: EmbedJob): job is CompletedEmbedJob {
  return job.status === 'completed';
}

export function isFailedJob(job: EmbedJob): job is FailedEmbedJob {
  return job.status === 'failed';
}

/**
 * Validation functions for numeric invariants
 *
 * Ensures counts stay non-negative and within valid ranges. These validators
 * should be used after parsing untrusted data (e.g., from JSON files).
 */
export function validateNonNegativeCount(value: unknown): boolean {
  return typeof value === 'number' && value >= 0 && Number.isInteger(value);
}

export function validateRetryCount(
  retries: number,
  maxRetries: number
): boolean {
  return (
    validateNonNegativeCount(retries) &&
    validateNonNegativeCount(maxRetries) &&
    retries <= maxRetries
  );
}

export function validateDocumentCounts(
  total: number | undefined,
  processed: number | undefined,
  failed: number | undefined
): boolean {
  // All must be non-negative or undefined
  if (total !== undefined && !validateNonNegativeCount(total)) {
    return false;
  }
  if (processed !== undefined && !validateNonNegativeCount(processed)) {
    return false;
  }
  if (failed !== undefined && !validateNonNegativeCount(failed)) {
    return false;
  }
  // processed + failed should not exceed total (if all are defined)
  if (total !== undefined && processed !== undefined && failed !== undefined) {
    if (processed + failed > total) {
      return false;
    }
  }
  return true;
}
