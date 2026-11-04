---
name: web
description: Unified Web Intelligence, Automation & Browsing Skill fusing Obscura (CDP/V8 headless browsing, stealth, visual comparison, PDF/screenshot, markdown extraction), Brave Search & Shields (independent web search, LLM context grounding, adblock-rust, tracker stripping), Servo (Stylo CSS3 engine, html5ever, XPath translation, Euclid geometry, WebVTT), Upstream Bun v1.4.4+ (Full Rust ~200 crates + WebKit/JSC + Cranelift AoT host runtime), Deno/V8 (deno_core, rusty_v8, V8 isolates), and Chromium DevTools Protocol into a single cohesive interface. Use whenever searching, scraping, navigating, testing selectors, checking tracker rules, auditing a11y/LCP, executing CDP commands, or inspecting web engine runtime status.
---

# Unified Web (`web`) Skill

The **`web`** skill provides a single, omni-capable entrypoint to all web browser, search, scraping, rendering, and runtime tools across the **YOLO-Web** engine (`yolo-rs/yolo-web`).

It consolidates what used to be fragmented across:

- **Obscura**: Headless Chromium V8 automation, CDP, stealth anti-fingerprinting, DOM snapshots, refs (`e1`), interactive filling, PDF/PNG export.
- **Brave**: Private Web index search (`brave_web_search`), RAG/LLM context extraction (`brave_llm_context`), adblock-rust network rules, and CookieCrumbler consent banner removal.
- **Servo**: Stylo selector matching & 30-bit specificity calculations, html5ever parser, XPath-to-CSS translation, WebVTT subtitles, and Euclid 2D/3D geometry.
- **Upstream Bun**: Pure Bun v1.4.4+ Host Runtime (**Full Rust ~200 crates + WebKit/JSC + Cranelift AoT — zero Node.js, zero Zig**).
- **Deno & V8**: Isolated guest Chromium V8 runtime (`deno_core`, `rusty_v8`) executing guest JS within individual page contexts.

---

## 1. The Unified `web` Command-Line Interface (CLI)

The `web` CLI is available globally or via `bun run web`:

```bash
# Fetch and render with Obscura headless engine + Brave Shields protection
web fetch https://example.com --markdown
web fetch https://example.com --screenshot page.png --stealth
web fetch https://example.com --eval "document.title"

# Search the Web with Brave's private, independent index
web search "tokio async runtime" --count 10

# AI / LLM Grounding Context (token-budgeted pre-extracted clean text)
web context "Rust borrow checker lifetime explanation" --max-tokens 4096

# Brave Shields & Tracker Testing
web shields "https://ad.doubleclick.net/ddm/adj/N1234?fbclid=abc" --type script

# Servo CSS Stylo Specificity & XPath Translation
web servo "div.container > article#main:hover"
web servo "//div[@id='content']//button[@type='submit']" --xpath

# Launch Chrome DevTools Protocol (CDP) WebSocket Server
web serve --port 9222

# Launch Unified MCP Server over stdio
web mcp --transport stdio

# Inspect Complete Monorepo Engine & Dual-Runtime Architecture
web info --json
```

---

## 2. The Unified `web` Model Context Protocol (MCP) Server

The unified MCP server (`packages/web-mcp`) exposes **53 tools** across four primary pillars:

| Category                 | Tool Prefix / Name                                                                                                                                                                                                                                                                          | Source Engine          | Capabilities                                                                                                                             |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser Automation**   | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill`, `browser_type`, `browser_evaluate`, `browser_screenshot`, `browser_pdf`, `browser_markdown`, `browser_links`, `browser_interactive_elements`, `browser_tab_*`, `browser_cookies_*`, `browser_storage_*` (38 tools) | Obscura + Chromium V8  | Navigate, capture DOM with element refs (`e1`), click, fill forms, evaluate guest JS in V8 isolate, export full-page screenshots & PDFs. |
| **Search Intelligence**  | `brave_web_search`, `brave_llm_context`, `brave_image_search`, `brave_video_search`, `brave_news_search`, `brave_summarizer`, `brave_shields_check`, `brave_answers`, `brave_suggest` (9 tools)                                                                                             | Brave Search + Shields | Private web query, pre-tokenized LLM grounding, news/images/video, adblock rule evaluation, and URL sanitization.                        |
| **Servo DOM & Layout**   | `servo_css_specificity`, `servo_xpath_to_css`, `servo_parse_webvtt` (3 tools)                                                                                                                                                                                                               | Servo Stylo & XPath    | Exact Stylo specificity tuples `(a, b, c)` & 30-bit packed integer, XPath 1.0 to CSS3 compilation, WebVTT parser.                        |
| **V8 & Chromium Engine** | `v8_runtime_info`, `v8_evaluate_safe`, `web_engine_status` (3 tools)                                                                                                                                                                                                                        | Bun + V8 Bridge        | Inspect Host Bun (WebKit/JSC) vs Guest Browser (Chromium V8) runtime planes, sanitize V8 evaluate commands.                              |

### Configuration for Claude Code / Antigravity

In `.agents/mcp_config.json` or `~/.gemini/config/plugins/web/mcp_config.json`:

```json
{
  "mcpServers": {
    "web": {
      "command": "bun",
      "args": ["run", "packages/web-mcp/src/index.ts", "--transport", "stdio"]
    }
  }
}
```

---

## 3. Dual-Runtime Architecture: Host Bun (WebKit/JSC) + Guest Chromium V8

The engine is strictly partitioned into two operational planes:

1. **Plane 1: Host Runtime Plane (100% Native Upstream Bun v1.4.4+)**
   - **Language**: Full Rust (~200 crates in `src/*`) + C++ WebKit/JavaScriptCore (`src/jsc/bindings/`) + Cranelift native AoT compiler (`src/aot`).
   - **Properties**: **Zero Zig**, zero Node.js.
   - **Duties**: CLI entrypoint, HTTP/WebSocket servers (`Bun.serve`), file and streaming I/O (`Bun.file`, `Bun.write`), sub-process coordination (`Bun.spawn`), bundle & AoT compilation (`bun compile`), MCP JSON-RPC protocol parsing.
2. **Plane 2: Guest Browser Plane (100% Chromium V8)**
   - **Language**: Chromium V8 isolates wrapped via `crates/obscura-js`, `rusty_v8`, and `deno_core`.
   - **Duties**: Web page execution, React/Next/Vue hydration, DOM script evaluation, Chrome DevTools Protocol (`Runtime.evaluate`, `Page.navigate`, `DOM.getDocument`).
   - **Isolation Invariant**: No Host Bun objects, Node globals, or host environment variables (`process.env`) ever cross into the guest Chromium V8 isolate without explicit argument sanitization.

---

## 4. Workflows & Playbooks

### Workflow A: Autonomous Deep Research (Search + Scrape + Ground)

1. Call `brave_llm_context` with the research question to fetch top clean snippets.
2. If primary source verification is required, call `browser_navigate` on the candidate URL.
3. Call `browser_snapshot` to extract DOM elements and stable interactive refs.
4. Call `browser_markdown` to extract article text without cookie banners or navigation clutter.
5. Synthesize findings citing source URLs and publication dates.

### Workflow B: Visual Quality & Accessibility Audit

1. Call `brave_shields_check` on the target URL to ensure tracking scripts are blocked.
2. Call `browser_navigate` to render the page inside the Obscura/V8 viewport.
3. Call `browser_screenshot` with `fullPage: true` to generate PNG raster image.
4. Call `browser_pdf` to export vector/print layout.
5. Call `servo_css_specificity` on key stylesheet selectors to diagnose cascade order conflicts.

---

## 5. References

- [CLI Reference](./references/cli-reference.md)
- [MCP Tools & Schemas](./references/mcp-tools.md)
- [Brave Search & Shields Reference](./references/brave-search-shields.md)
- [Servo Stylo & Euclid Reference](./references/servo-stylo-geometry.md)
- [Dual-Runtime Bun + V8 Specification](./references/dual-runtime-bun-v8.md)
- [2026 Scraper, Crawler & Performance Blueprint](./references/ultimate-2026-stack.md)
