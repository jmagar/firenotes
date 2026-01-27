/**
 * Types for the retrieve command
 * Reconstructs full documents from Qdrant chunks
 */

export interface RetrieveOptions {
  url: string;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface RetrieveResult {
  success: boolean;
  data?: {
    url: string;
    totalChunks: number;
    content: string;
    chunks?: Array<{
      index: number;
      header: string | null;
      text: string;
    }>;
  };
  error?: string;
}
