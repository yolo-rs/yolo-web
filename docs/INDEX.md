# YOLO-Web Documentation Manifest & Wiki Index (MDX & Bun Docs)

Welcome to the **YOLO-Web Wiki & Knowledge Engine**. This manifest catalogs all architectural documentation, design specifications, and reference guides across the repository.

---

## 1. Core Architecture & Standards

- [`docs/STYLE_GUIDE.md`](STYLE_GUIDE.md) : **Official Google & Chromium Style Guide** (Rust, TS/JS, C++, licensing, safety, conventions).
- [`docs/ULTIMATE_2026_STACK.md`](ULTIMATE_2026_STACK.md) : 2026 Scraper, Crawler, Browser & AoT/LTO Performance Blueprint.
- [`docs/CHROMIUM_TRACKING_AND_AUTOMATION.md`](CHROMIUM_TRACKING_AND_AUTOMATION.md) : Continuous tracking for Chromium 157-159, CEF, Depot Tools, and patch automation.
- [`docs/VERIFIED_TEST_KNOWLEDGE_BASE.md`](VERIFIED_TEST_KNOWLEDGE_BASE.md) : Real-time target verification database and RAG vector store for Google, Cloudflare, and Chromium domains.

---

## 2. Monorepo Crate Architecture

- [`crates/BUN_WEBKIT_V8_ARCHITECTURE.md`](../crates/BUN_WEBKIT_V8_ARCHITECTURE.md) : Dual-Runtime Plane Architecture (Plane 1: Host Bun JSC; Plane 2: Guest Browser V8).
- [`crates/SERVO_CRATES.md`](../crates/SERVO_CRATES.md) : 31 Consolidated Servo Crates (Stylo CSS, Euclid Geometry, WebVTT, html5ever).
- [`crates/BRAVE_CRATES.md`](../crates/BRAVE_CRATES.md) : 5 Consolidated Brave Rust Crates & Shields (adblock-rust, tracker stripping).
- [`crates/DENO_V8_CRATES.md`](../crates/DENO_V8_CRATES.md) : 8 Consolidated Deno & V8 Runtime Crates.

---

## 3. Package & Unified CLI Guides

- [`packages/web-cli/README.md`](../packages/web-cli/README.md) : Unified `web` Command-Line Interface.
- [`packages/web-mcp/README.md`](../packages/web-mcp/README.md) : Unified `web-mcp` Server (57 Tools).
- [`packages/chromium-tracker/README.md`](../packages/chromium-tracker/package.json) : Automated upstream monitoring engine.
- [`packages/challenge-solver/README.md`](../packages/challenge-solver/package.json) : 2026 Chromium legitimacy profile and challenge resolution.
- [`packages/web-plugin/README.md`](../packages/web-plugin/plugin.json) : Antigravity Unified Web Plugin & Skill.

---

## 4. Documentation Generation & MDX Pipeline

To compile or regenerate documentation artifacts:
```bash
# Generate documentation index and verify cross-links
bun run docs:build

# Generate documentation manifest JSON
bun run docs:manifest
```
