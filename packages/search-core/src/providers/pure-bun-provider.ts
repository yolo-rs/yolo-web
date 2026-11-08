import type { SearchProvider, SearchHit, SearchOptions } from '../types.ts';
import { SelfHostedSearchEngine } from '../self-hosted-engine.ts';

export class PureBunSelfHostedProvider implements SearchProvider {
  name = 'searxng' as const;
  private engine: SelfHostedSearchEngine;

  constructor(dbPath: string = ':memory:') {
    this.engine = new SelfHostedSearchEngine(dbPath);
  }

  async isAvailable(): Promise<boolean> {
    return true; // 100% self-hosted, always up
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const results = this.engine.search(query, options?.limit ?? 10);
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: 'searxng',
      score: r.score,
      raw: r,
    }));
  }

  getEngine(): SelfHostedSearchEngine {
    return this.engine;
  }
}
