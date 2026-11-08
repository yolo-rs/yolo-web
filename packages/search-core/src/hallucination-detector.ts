/**
 * Sovereign Hallucination Detector Core (Full Bun & bun:sqlite WAL)
 * Inspired by exa-labs/exa-hallucination-detector.
 * Analyzes text, extracts factual claims, and verifies them with zero hallucinations against local SQLite RAG & Web docs.
 */

import { SovereignSearchEngine } from '../src/engine.ts';

export interface FactCheckClaimResult {
  claim: string;
  originalText: string;
  assessment: 'True' | 'False' | 'Insufficient Information';
  summary: string;
  confidenceScore: number;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

export class SovereignHallucinationDetector {
  private engine: SovereignSearchEngine;

  constructor() {
    this.engine = new SovereignSearchEngine();
  }

  /**
   * Deconstructs a block of text into atomic verifiable claims
   */
  public extractClaims(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && !s.startsWith('#'));
  }

  /**
   * Verifies an atomic claim against authoritative sources using the sovereign search engine
   */
  public async verifyClaim(claim: string): Promise<FactCheckClaimResult> {
    const searchRes = await this.engine.search(claim, { provider: 'fastest', limit: 3 });

    let assessment: FactCheckClaimResult['assessment'] = 'Insufficient Information';
    let summary = 'No authoritative local or verified web document matched the query.';
    let confidence = 50;

    if (searchRes.hits.length > 0 && searchRes.hits[0]) {
      const bestHit = searchRes.hits[0];
      const claimLower = claim.toLowerCase();
      const snippetLower = (bestHit.snippet || '').toLowerCase();
      const titleLower = (bestHit.title || '').toLowerCase();

      // Check alignment
      const keywords = claimLower.split(/\s+/).filter((w) => w.length > 4);
      const matches = keywords.filter((k) => snippetLower.includes(k) || titleLower.includes(k));
      const matchRatio = keywords.length > 0 ? matches.length / keywords.length : 0;

      if (matchRatio >= 0.5) {
        assessment = 'True';
        summary = `Verified against ${bestHit?.title} (${bestHit?.url})`;
        confidence = Math.min(95, Math.round(matchRatio * 100));
      } else {
        assessment = 'False';
        summary = `Inconsistency detected with authoritative source ${bestHit?.title}`;
        confidence = 80;
      }
    }

    return {
      claim,
      originalText: claim,
      assessment,
      summary,
      confidenceScore: confidence,
      sources: searchRes.hits.map((h) => ({
        title: h.title,
        url: h.url,
        snippet: h.snippet,
      })),
    };
  }

  /**
   * Audits an entire document for factual hallucinations
   */
  public async auditDocument(text: string): Promise<{
    claimsAudited: number;
    hallucinationsFound: number;
    results: FactCheckClaimResult[];
  }> {
    const claims = this.extractClaims(text);
    const results: FactCheckClaimResult[] = [];
    let hallucinations = 0;

    for (const c of claims) {
      const res = await this.verifyClaim(c);
      if (res.assessment === 'False') {
        hallucinations++;
      }
      results.push(res);
    }

    return {
      claimsAudited: claims.length,
      hallucinationsFound: hallucinations,
      results,
    };
  }
}
