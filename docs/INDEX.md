# YOLO-Web documentation index

Welcome to the **YOLO-Web Wiki & Knowledge Engine**. This manifest catalogs all architectural documentation, design specifications, and reference guides across the repository.

---

## Architecture and standards

- [`data/standards/web/README.md`](../data/standards/web/README.md) : Shared MDN, TC39, WebAssembly, and MCP snapshot provenance and refresh policy.
- [`docs/CHROMIUM_UI_CATALOG.mdx`](CHROMIUM_UI_CATALOG.mdx) : Crawled Chromium Views/WebUI and ChromeOS Ash/shared UI source inventory.
- [`docs/ARCHITECTURE.mdx`](ARCHITECTURE.mdx) : Current/target ownership boundaries for engines, Rust, Bun, C++, and third-party source.
- [`docs/STYLE_GUIDE.mdx`](STYLE_GUIDE.mdx) : Local Rust, Bun/TypeScript, C++, documentation, and cross-platform conventions.
- [`docs/ULTIMATE_2026_STACK.md`](ULTIMATE_2026_STACK.md) : 2026 Scraper, Crawler, Browser & AoT/LTO Performance Blueprint.
- [`docs/CHROMIUM_TRACKING_AND_AUTOMATION.md`](CHROMIUM_TRACKING_AND_AUTOMATION.md) : Live upstream release tracking and Chromium checkout/build workflow status.
- [`docs/ENGINE_REWRITE_PLAN.md`](ENGINE_REWRITE_PLAN.md) : Evidence-based target architecture, upstream checkout strategy, repository shape, and acceptance milestones for a native Chromium embedder.
- [`docs/CEF_ADAPTER_BOUNDARY.mdx`](CEF_ADAPTER_BOUNDARY.mdx) : YOLO-Web/yolo-ui ownership of the CEF engine adapter, the pinned CEF binary distribution, and the integration gate status for `crates/yolo-chromium`.
- [`docs/BROWSER_ENGINE_MANAGER.md`](BROWSER_ENGINE_MANAGER.md) : Cross-platform engine catalog, Chromium source locks, and upstream workflows.
- [`engines/chromium.lock.json`](../engines/chromium.lock.json) : Captured public Chromium source and active dependency revisions for this workspace.
- `engines/cef.lock.json` : CEF shell smoke receipt (build and runtime CEF/Chromium versions, API hash, sandbox state, load outcome) written by `just chromium-smoke`; generated evidence described in the `yolo-chromium` README.
- [`docs/ENGINE_COMPONENT_ALIGNMENT.mdx`](ENGINE_COMPONENT_ALIGNMENT.mdx) : Chromium m159 alignment for Obscura, Deno/V8, Skia/Canvas, CEF, Electron, Node, Brave, and Helium.
- [`docs/WINDOWS_BROWSER_TOOLCHAIN.md`](WINDOWS_BROWSER_TOOLCHAIN.md) : Chromium, Edge Canary, and WebView2 source/runtime notes; host toolchains belong to yolo-cross.
- [`docs/DEV_SESSION_RESOURCE_PROFILE.md`](DEV_SESSION_RESOURCE_PROFILE.md) : Reversible Windows development-session service profile and WnClean CLI.
- [`docs/WEB_QUALITY_TOOLING.mdx`](WEB_QUALITY_TOOLING.mdx) : Bun-native Chrome/CDP workflow, Lighthouse, Vercel field metrics, accessibility and SEO tools.
- [`docs/WEB_QUALITY_BASELINE_2026-11-04.md`](WEB_QUALITY_BASELINE_2026-11-04.md) : First real Chrome/Lighthouse run for the human-browser workbench, with reproducible setup and measured category scores.
- [`.agents/skills/modern-web-guidance/SKILL.md`](../.agents/skills/modern-web-guidance/SKILL.md) : Google Chrome modern web guidance skill and bundled offline guides, adapted to Bun-only execution.
- [`docs/VERIFIED_TEST_KNOWLEDGE_BASE.md`](VERIFIED_TEST_KNOWLEDGE_BASE.md) : Real-time target verification database and RAG vector store for Google, Cloudflare, and Chromium domains.
- [`src/README.mdx`](../src/README.mdx) : Scope and status for YOLO-Web-owned native C/C++ integration.
- [`third_party/README.mdx`](../third_party/README.mdx) : Direct dependency provenance policy and Chromium dependency boundary.
- [`patches/chromium/README.mdx`](../patches/chromium/README.mdx) : Chromium patch queue contract and current implementation status.
- [`src/yolo-vendor/README.mdx`](../src/yolo-vendor/README.mdx) : Local Electron and Node upstream research clones and revision comparison.

---

## Rust workspace catalogs

- [`crates/yolo-chromium/README.md`](../crates/yolo-chromium/README.md) : CEF-based Chromium browser shell: build, launcher and shell flags, Windows bootstrap runtime model, sandbox, `.cef/` cache, and smoke receipt.
- [`crates/yolo-web-standards/README.md`](../crates/yolo-web-standards/README.md) : Typed Rust API (`yolo-web-standards` crate) over the shared web standards snapshots.
- [`crates/BUN_WEBKIT_V8_ARCHITECTURE.md`](../crates/BUN_WEBKIT_V8_ARCHITECTURE.md) : Legacy/aspirational notes; verify claims against the canonical architecture and upstream sources.
- [`crates/SERVO_CRATES.md`](../crates/SERVO_CRATES.md) : 31 Consolidated Servo Crates (Stylo CSS, Euclid Geometry, WebVTT, html5ever).
- [`crates/BRAVE_CRATES.md`](../crates/BRAVE_CRATES.md) : 5 Consolidated Brave Rust Crates & Shields (adblock-rust, tracker stripping).
- [`crates/DENO_V8_CRATES.md`](../crates/DENO_V8_CRATES.md) : 8 Consolidated Deno & V8 Runtime Crates.

---

## Packages and CLI guides

- [`packages/web-standards/README.md`](../packages/web-standards/README.md) : Bun loader, validators, and updater for shared web standards data.
- [`packages/web-cli/README.md`](../packages/web-cli/README.md) : Unified `web` Command-Line Interface.
- [`packages/posix-bun/README.md`](../packages/posix-bun/README.md) : Integrated POSIX/GNU compatibility helpers sourced from the published yolo-zig package.
- [`packages/web-mcp/README.md`](../packages/web-mcp/README.md) : Unified `web-mcp` Server (57 Tools).
- [`packages/chromium-tracker/README.md`](../packages/chromium-tracker/package.json) : Automated upstream monitoring engine.
- [`packages/challenge-solver/README.md`](../packages/challenge-solver/package.json) : 2026 Chromium legitimacy profile and challenge resolution.
- [`packages/web-plugin/README.md`](../packages/web-plugin/plugin.json) : Antigravity Unified Web Plugin & Skill.

---

## Documentation manifest

To compile or regenerate documentation artifacts:

```bash
# Generate the repository documentation manifest
bun run docs:manifest
```
