/**
 * Delete command types
 * Defines interfaces for vector deletion operations
 */

export interface DeleteOptions {
  url?: string;
  domain?: string;
  all?: boolean;
  yes?: boolean;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface DeleteResult {
  success: boolean;
  data?: {
    deleted: number;
    target: string;
    targetType: 'url' | 'domain' | 'all';
  };
  error?: string;
}
