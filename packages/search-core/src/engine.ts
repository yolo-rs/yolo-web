import type {
  SearchHit,
  SearchOptions,
  SearchProvider,
  SearchProviderType,
  SearchResponse,
  DocLookupOptions,
  DocLookupResult,
} from './types.ts';
import { FreeContext7Provider } from './providers/free-context7-provider.ts';
import { PureBunSelfHostedProvider } from './providers/pure-bun-provider.ts';
import { GoogleSovereignProvider } from './providers/google-provider.ts';
import { NativeUpstreamExaProvider } from './providers/native-upstream-providers.ts';

export type { SearchProviderType } from './types.ts';

export class SovereignSearchEngine {
  private providers: Map<SearchProviderType, SearchProvider> = new Map();
  private freeContext7: FreeContext7Provider;
  private pureSelfHosted: PureBunSelfHostedProvider;
  private google: GoogleSovereignProvider;
  private exaNative: NativeUpstreamExaProvider;

  constructor() {
    this.freeContext7 = new FreeContext7Provider();
    this.pureSelfHosted = new PureBunSelfHostedProvider();
    this.google = new GoogleSovereignProvider();
    this.exaNative = new NativeUpstreamExaProvider();

    this.providers.set('free-context7', this.freeContext7);
    this.providers.set('searxng', this.pureSelfHosted);
    this.providers.set('google-sovereign', this.google);
    this.providers.set('exa', this.exaNative);
  }

  /**
   * Unified 100% Bun Self-Hosted Multi-Provider Engine
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const start = performance.now();
    const targetProvider = options.provider || 'fastest';

    // 1. Direct Single-Provider Route
    if (targetProvider !== 'all' && targetProvider !== 'fastest') {
      const p = this.providers.get(targetProvider);
      if (!p) throw new Error(`Provider '${targetProvider}' not found`);

      const hits = await p.search(query, options);
      return {
        query,
        providerUsed: targetProvider,
        totalHits: hits.length,
        tookMs: performance.now() - start,
        costDollars: 0.0,
        hits,
      };
    }

    // 2. Fastest Sovereign Self-Hosted Route (FreeContext7 -> Pure Bun FTS5 BM25 -> Sovereign Google)
    if (targetProvider === 'fastest') {
      // Step A: Local doc/code lookup via FreeContext7 SQLite WAL
      const docHits = await this.freeContext7.search(query, options);
      if (docHits.length > 0) {
        return {
          query,
          providerUsed: 'free-context7',
          totalHits: docHits.length,
          tookMs: performance.now() - start,
          costDollars: 0.0,
          hits: docHits,
        };
      }

      // Step B: Pure Bun Self-Hosted FTS5 Inverted Index & BM25
      const ftsHits = await this.pureSelfHosted.search(query, options);
      if (ftsHits.length > 0) {
        return {
          query,
          providerUsed: 'searxng',
          totalHits: ftsHits.length,
          tookMs: performance.now() - start,
          costDollars: 0.0,
          hits: ftsHits,
        };
      }

      // Step C: Sovereign Google Knowledge Synthesizer
      const googleHits = await this.google.search(query, options);
      return {
        query,
        providerUsed: 'google-sovereign',
        totalHits: googleHits.length,
        tookMs: performance.now() - start,
        costDollars: 0.0,
        hits: googleHits,
      };
    }

    // 3. Federated Local Search
    const results = await Promise.all([
      this.freeContext7.search(query, options),
      this.pureSelfHosted.search(query, options),
      this.google.search(query, options),
    ]);

    const combinedHits = results.flat();
    const seen = new Set<string>();
    const deduplicatedHits: SearchHit[] = [];

    for (const hit of combinedHits) {
      if (!seen.has(hit.url)) {
        seen.add(hit.url);
        deduplicatedHits.push(hit);
      }
    }

    return {
      query,
      providerUsed: 'federated',
      totalHits: deduplicatedHits.length,
      tookMs: performance.now() - start,
      costDollars: 0.0,
      hits: deduplicatedHits.slice(0, options.limit ?? 20),
    };
  }

  /**
   * Sub-millisecond doc resolver
   */
  resolveDocs(options: DocLookupOptions): DocLookupResult | null {
    const start = performance.now();
    const docs = this.freeContext7.getEngine().queryDocs({
      library: options.library,
      query: options.symbol || options.topic || '',
      limit: 1,
    });
    const doc = docs[0];
    if (!doc) return null;

    return {
      library: doc.library,
      symbol: doc.symbol,
      signature: doc.signature,
      summary: doc.summary,
      codeSnippet: doc.codeSnippet,
      sourceUri: doc.sourceUri,
      verified: doc.verified,
      tookMs: performance.now() - start,
    };
  }
}
