/**
 * Status command module
 *
 * Provides job status dashboard with active crawls, batch status,
 * extract status, and embedding queue monitoring.
 *
 * Exports:
 * - createStatusCommand: CLI command definition
 * - handleStatusCommand: Basic status display (auth/version)
 * - handleJobStatusCommand: Full job status dashboard
 * - getStatus: Get status information
 * - getEmbedContext: Get display context for embedding jobs
 */

export {
  createStatusCommand,
  getStatus,
  handleJobStatusCommand,
  handleStatusCommand,
} from './command';
export { getEmbedContext } from './helpers';
