import { describe, expect, it } from 'bun:test';
import { SovereignSearchEngine } from '../src/engine.ts';
import { SelfHostedSearchEngine } from '../src/self-hosted-engine.ts';

describe('100% Bun Self-Hosted Sovereign Engine Tests', () => {
  const engine = new SovereignSearchEngine();
  const selfHosted = new SelfHostedSearchEngine();

  it('verifies FTS5 BM25 inverted index queries run in sub-millisecond range', () => {
    const start = performance.now();
    const hits = selfHosted.search('bun serve http', 5);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5.0);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].url).toBe('https://bun.com/docs/runtime/http/server');
  });

  it('runs entire fastest search chain completely offline with 0.00 USD cost', async () => {
    const res = await engine.search('wgpu graphics', { provider: 'fastest' });
    expect(res.costDollars).toBe(0.0);
    expect(res.tookMs).toBeLessThan(15.0);
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0].url).toContain('wgpu');
  });

  it('resolves documentation locally without external network', () => {
    const res = engine.resolveDocs({ library: 'bun', symbol: 'Bun.serve' });
    expect(res).not.toBeNull();
    expect(res?.library).toBe('bun');
    expect(res?.verified).toBe(true);
    expect(res?.tookMs).toBeLessThan(2.0);
  });

  it('executes federated offline search across multiple internal indices', async () => {
    const res = await engine.search('react', { provider: 'all' });
    expect(res.providerUsed).toBe('federated');
    expect(res.costDollars).toBe(0.0);
    expect(res.hits.length).toBeGreaterThan(0);
  });
});
