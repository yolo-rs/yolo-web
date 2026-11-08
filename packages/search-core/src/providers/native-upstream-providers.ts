/**
 * Native Upstream Provider Bridging for YOLO-Web
 * Directly imports and leverages cloned upstream vendors (upstash/context7 and exa-labs/exa-mcp-server).
 */

import type { SearchProvider, SearchHit, SearchOptions } from '../types.ts';
// @ts-ignore
import Exa from 'C:/src/yolo-web/vendor/exa-js/dist/index.js';

/**
 * Native Upstream Exa Provider backed directly by official exa-js SDK
 */
export class NativeUpstreamExaProvider implements SearchProvider {
  name = 'exa' as const;
  private client: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.EXA_API_KEY || '4f757cad-9c99-4bbf-bdf8-281fb4789dee';
    this.client = new Exa(key);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const response = await this.client.search(query, {
      numResults: options?.limit ?? 5,
      contents: {
        highlights: options?.includeHighlights ?? true,
      },
    });

    return (response.results || []).map((r: any) => ({
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

/**
 * Native Upstream Context7 MCP Client Direct Adapter
 */
export class NativeUpstreamContext7Provider implements SearchProvider {
  name = 'free-context7' as const;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CONTEXT7_API_KEY || 'ctx7sk-b3200192-e98a-478d-954f-a9cf28d4c554';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const res = await fetch('https://mcp.context7.com/mcp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'resolve-library-id',
          arguments: {
            libraryName: query,
            query: 'getting started',
          },
        },
      }),
    });

    if (!res.ok) {
      return [];
    }

    const text = await res.text();
    const match = text.match(/data:\s*(\{.*\})/);
    const jsonStr = match?.[1];
    if (!jsonStr) return [];

    const json = JSON.parse(jsonStr);
    const content = json.result?.content?.[0]?.text || '';

    return [
      {
        title: `Context7 Upstream Resolution: ${query}`,
        url: `https://context7.com`,
        snippet: content.slice(0, 400),
        source: 'free-context7',
        score: 1.0,
      },
    ];
  }
}
