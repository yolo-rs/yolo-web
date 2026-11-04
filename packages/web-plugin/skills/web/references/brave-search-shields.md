# Brave Search & Shields Architectural Reference

Brave Search is the only independent, non-big-tech web index operating at scale. Brave Shields provides high-performance tracking and ad protection written in native Rust (`adblock-rust`) with cosmetic element-hiding rules.

## Core Capabilities

1. **Independent Web Indexing**:
   - Zero reliance on Google or Bing indexes.
   - Complete privacy: queries are not logged or tied to user IDs.
2. **LLM / RAG Grounding (`bx context` / `web context`)**:
   - Designed specifically for AI agents.
   - Replaces manual `search -> scrape -> extract` loops with a single call.
   - Returns structured snippets with relevance scoring and token budgeting.
3. **Brave Shields (`adblock-rust`)**:
   - Compiles EasyList, EasyPrivacy, and custom adblock rules into optimized FlatBuffers.
   - Matches URLs in sub-microsecond time.
   - Integrates CookieCrumbler to strip cookie consent banners and overlays.
4. **Fingerprint Protection**:
   - Strips tracking query parameters (`fbclid`, `gclid`, `utm_source`, `mc_eid`, `msclkid`).
   - Normalizes HTTP headers (`Sec-GPC: 1`, `DNT: 1`).
   - Trims cross-origin referrers to base origin.
