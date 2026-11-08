/**
 * Unified Search Core Types
 */

export type SearchProviderType = 'free-context7' | 'searxng' | 'exa' | 'google-sovereign' | 'brave';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  source: SearchProviderType;
  score?: number;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  raw?: any;
}

export interface SearchOptions {
  limit?: number;
  provider?: SearchProviderType | 'all' | 'fastest';
  safeSearch?: 'strict' | 'moderate' | 'off';
  language?: string;
  category?: 'general' | 'code' | 'science' | 'news' | 'it';
  includeHighlights?: boolean;
}

export interface SearchResponse {
  query: string;
  providerUsed: SearchProviderType | 'federated';
  totalHits: number;
  tookMs: number;
  costDollars: number;
  hits: SearchHit[];
}

export interface DocLookupOptions {
  library: string;
  topic?: string;
  symbol?: string;
}

export interface DocLookupResult {
  library: string;
  symbol: string;
  signature: string;
  summary: string;
  codeSnippet: string;
  sourceUri: string;
  verified: boolean;
  tookMs: number;
}

export interface SearchProvider {
  name: SearchProviderType;
  search(query: string, options?: SearchOptions): Promise<SearchHit[]>;
  isAvailable(): Promise<boolean>;
}
