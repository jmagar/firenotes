/**
 * Embed command types
 */

export interface EmbedOptions {
  input: string; // URL, file path, or '-' for stdin
  url?: string; // explicit URL for metadata (required for file/stdin)
  collection?: string;
  noChunk?: boolean;
  apiKey?: string;
  output?: string;
  json?: boolean;
}

export interface EmbedResult {
  success: boolean;
  data?: {
    url: string;
    chunksEmbedded: number;
    collection: string;
  };
  error?: string;
}
