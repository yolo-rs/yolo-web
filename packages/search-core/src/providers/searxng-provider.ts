import type { SearchProvider, SearchHit, SearchOptions } from '../types.ts';

export class SearXNGProvider implements SearchProvider {
  name = 'searxng' as const;
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || process.env.SEARXNG_URL || 'http://localhost:8080';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/stats`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const url = new URL(`${this.endpoint}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    if (options?.category) {
      url.searchParams.set('categories', options.category);
    }
    if (options?.language) {
      url.searchParams.set('language', options.language);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`SearXNG HTTP error: ${res.status}`);
    }

    const data = await res.json();
    const results = (data.results || []).slice(0, options?.limit ?? 10);

    return results.map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url,
      snippet: r.content || '',
      source: 'searxng',
      score: r.score ?? 0.8,
      publishedDate: r.publishedDate,
      raw: r,
    }));
  }
}
