/**
 * Domains command types
 */

export interface DomainInfo {
  domain: string;
  urlCount: number;
  vectorCount: number;
  lastUpdated: string;
}

export interface DomainsOptions {
  limit?: number;
  collection?: string;
  output?: string;
  json?: boolean;
}

export interface DomainsResult {
  success: boolean;
  data?: {
    domains: DomainInfo[];
    totalDomains: number;
    totalUrls: number;
    totalVectors: number;
  };
  error?: string;
}
