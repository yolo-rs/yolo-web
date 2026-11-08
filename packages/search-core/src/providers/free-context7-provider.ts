import type { SearchProvider, SearchHit, SearchOptions } from '../types.ts';
import { FreeContext7Engine, type DocEntry } from '@google-bun/free-context7';

export class FreeContext7Provider implements SearchProvider {
  name = 'free-context7' as const;
  private engine: FreeContext7Engine;

  constructor(dbPath: string = ':memory:') {
    this.engine = new FreeContext7Engine(dbPath);
  }

  async isAvailable(): Promise<boolean> {
    return true; // Local SQLite WAL is always available
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const docs = this.engine.queryDocs({
      query,
      limit: options?.limit ?? 10,
    });
    return docs.map((doc: DocEntry) => ({
      title: `${doc.library}: ${doc.symbol || doc.topic}`,
      url: doc.sourceUri,
      snippet: `${doc.summary}\n${doc.signature}`,
      source: 'free-context7',
      score: 1.0,
      highlights: doc.codeSnippet ? [doc.codeSnippet] : [],
      raw: doc,
    }));
  }

  getEngine(): FreeContext7Engine {
    return this.engine;
  }
}
