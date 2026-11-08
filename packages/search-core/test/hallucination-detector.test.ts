import { describe, expect, it } from 'bun:test';
import { SovereignHallucinationDetector } from '../src/hallucination-detector.ts';

describe('Sovereign Hallucination Detector Tests', () => {
  const detector = new SovereignHallucinationDetector();

  it('extracts atomic claims from multi-sentence markdown text', () => {
    const text = 'Bun is a fast JavaScript runtime. WGPU provides safe graphics for Rust based on WebGPU. Electron has been completely eliminated in favor of GPUI.';
    const claims = detector.extractClaims(text);
    expect(claims.length).toBe(3);
    expect(claims[0]).toContain('Bun is a fast JavaScript runtime');
  });

  it('validates a factual claim accurately against the sovereign knowledge base', async () => {
    const claim = 'Bun.serve allows starting high performance HTTP servers with native Web Standards Request and Response APIs.';
    const result = await detector.verifyClaim(claim);

    expect(result.assessment).toBe('True');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].url).toBe('https://bun.com/docs/runtime/http/server');
  });

  it('audits a document and provides structured fact-checking metrics', async () => {
    const doc = 'Bun is a fast JavaScript runtime. React 19 introduces useActionState.';
    const audit = await detector.auditDocument(doc);

    expect(audit.claimsAudited).toBe(2);
    expect(audit.results.length).toBe(2);
  });
});
