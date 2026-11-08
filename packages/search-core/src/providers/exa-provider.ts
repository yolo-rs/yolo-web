import type { SearchProvider, SearchHit, SearchOptions } from '../types.ts';

export class ExaProvider implements SearchProvider {
  name = 'exa' as const;
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint = 'https://api.exa.ai') {
    this.apiKey = apiKey || process.env.EXA_API_KEY || '4f757cad-9c99-4bbf-bdf8-281fb4789dee';
    this.endpoint = endpoint;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const res = await fetch(`${this.endpoint}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults: options?.limit ?? 10,
        contents: {
          highlights: options?.includeHighlights ?? true,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Exa API HTTP error: ${res.status}`);
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url,
      snippet: r.highlights?.[0] || r.text?.slice(0, 300) || '',
      source: 'exa',
      score: r.score ?? 0.9,
      publishedDate: r.publishedDate,
      author: r.author,
      highlights: r.highlights || [],
      raw: r,
    }));
  }
}
