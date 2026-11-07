# YOLO-Web

High-performance, dual-plane browser engine architecture, headless CDP automation mesh, Servo-derived CSS/layout primitives, and Chromium V8 isolate host.

```
                           +-------------------------------------------------------------+
                           |         Plane 1: Host Orchestration & Tooling (Bun/JSC)     |
                           |   Bun v1.4.4+ (Rust Workspace) | Cranelift AoT | WebKit JSC |
                           +------------------------------+------------------------------+
                                                          |
                                      Zero-Copy IPC / Safe Native FFI
                                                          |
                           +------------------------------v------------------------------+
                           |     Plane 2: Guest Execution & Web Platform Engine (V8)      |
                           |  V8 Isolates (rusty_v8) | Stylo (Servo) | Taffy 0.15 Layout  |
                           |       WebRender / WebGPU Hardware Rasterization Pipeline    |
                           +-------------------------------------------------------------+
```

---

## Architecture Overview

YOLO-Web enforces a zero-cost abstraction boundary between host orchestration and sandboxed web execution:

### Plane 1: Host & Tooling Runtime (Native Bun + WebKit/JSC)
- **Runtime**: Upstream Bun (`bun_core`, `bun_sys`, `bun_alloc`) built against Apple WebKit / JavaScriptCore (`WTF`, `bmalloc`, `JavaScriptCore`, Riptide GC, FTL/B3 JIT).
- **Compilation**: Cranelift Ahead-of-Time (AoT) native code generator via `src/aot` (`bun build --compile --aot`).
- **Networking & Server**: PicoHTTPParser SIMD HTTP/1.1 parsing, `uWebSockets` / `uSockets` kernel event loops, and BoringSSL TLS 1.3 / ALPN termination.
- **Orchestration**: Manages headless browser sub-processes, WebSocket CDP framing, and MCP RPC server endpoints.

### Plane 2: Browser Engine & Guest Isolate Execution (Chromium V8 + Servo + Taffy)
- **JS/WASM Isolate Engine**: Chromium V8 isolates via `rusty_v8` and `deno_core` (`crates/obscura-js`, `crates/yolo-browser`). Every context runs with dedicated page-level heaps, Sparkplug/Maglev/TurboFan JIT pipelines, and `Oilpan` GC isolation.
- **CSS Selector & Cascade**: Mozilla/Servo Stylo subsystem (`crates/servo-stylo`, `crates/servo-cssparser`) executing high-throughput parallel selector matching and specificity computation.
- **Layout System**: Taffy 0.15 CSS Flexbox, CSS Grid, and block flow geometry computation integrated into `crates/obscura-render`.
- **Compositing & Rasterization**: WebGPU / Dawn and Servo WebRender pipelines for GPU-accelerated drawing, WebVTT cue rendering, and zero-copy surface blitting.
- **Network Guards**: Brave Shields (`adblock-rust`) ruleset matching, deterministic query sanitization, and client fingerprint defenses.

---

## Workspace Layout

```
yolo-web/
|-- apps/
|   |-- human-browser/          # Bun CDP control server for interactive browsing and screenshot streaming
|   `-- ai-agent-runner/        # Autonomous browser agent execution harness
|-- packages/
|   |-- web-cli/                # Unified "web" binary interface for agents and engineers
|   |-- web-mcp/                # Model Context Protocol (MCP) server exposing tools & prompts
|   |-- cdp-client/             # High-throughput asynchronous CDP client
|   |-- servo-bridge/           # Bindings to Servo Stylo, CSS parser, and XPath translation
|   |-- brave-shields/          # Rust adblock and URL tracking sanitization wrappers
|   |-- bun-v8-bridge/          # Inter-runtime coordination types and memory layouts
|   `-- chromium-tracker/       # Upstream Chromium / CEF channel and milestone tracker
`-- crates/
    |-- yolo-browser/           # Unified browser host bridging Servo, Obscura, and Brave Shields
    |-- yolo-chromium/          # CEF binary distribution runner (Chromium 156 Views framework)
    |-- obscura-*/              # V8 isolate management, CDP domains, rendering, and DOM
    `-- servo-*/                # Servo components (stylo, cssparser, selectors, webrender, taffy)
```

---

## Command Line Interface (`web`)

The `@yolo-web/web-cli` package delivers low-latency commands for headless operations:

```bash
# Fetch and render URL via Chromium/V8 with Brave Shields ad/tracker filtering
web fetch https://aphrody.com --markdown
web fetch https://craft.aphrody.app --screenshot=viewport.png --dump=html

# Independent private search querying Brave Search API
web search "servo stylo parallel selector matching" --count=5

# LLM grounding snippet extraction with token budget constraints
web context "webgpu compute pass pipeline layout" --max-tokens=2048

# Evaluate CSS selector specificity or translate XPath to CSS using Servo Stylo
web servo "div.container > article#main:first-child"
web servo --xpath "//div[@id='content']/p[contains(@class, 'lead')]"

# Verify URL against Brave Shields Rust engine (adblock, tracker lists, query stripping)
web shields https://tracker.adnetwork.com/beacon.js --source=https://aphrody.com --type=script

# Chromium engine release and local runtime qualification
web chromium check
web chromium launch --url=https://yolo.aphrody.com
```

---

## Model Context Protocol (`yolo-web` Protocol)

`packages/web-mcp` exposes a complete JSON-RPC Model Context Protocol interface over `stdio` and SSE for Claude Desktop, OpenCode, and local AI agent runtimes:

### Exposed Tool Classes

| Category | Tools | Description |
|:---|:---|:---|
| `browser-automation` | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill`, `browser_evaluate`, `browser_screenshot`, `browser_pdf` | CDP-driven headless page manipulation, full-page accessibility snapshots, and viewport capture. |
| `search-intelligence` | `brave_web_search`, `brave_llm_context`, `brave_shields_check`, `brave_news_search` | Real-time grounding queries, snippet aggregation, and adblock filter verification. |
| `servo-dom-geometry` | `servo_css_specificity`, `servo_xpath_to_css`, `servo_parse_webvtt` | Servo Stylo selector analysis, XPath 1.0 to CSS3 translation, and WebVTT timeline parsing. |
| `v8-chromium-engine` | `v8_runtime_info`, `v8_evaluate_safe`, `web_engine_status`, `browser_chromium_legitimacy_script` | Inspection of V8 isolate heap status, sandboxed code evaluation, and CEF/Chromium version validation. |

### Configuration (`mcpServers`)

```json
{
  "mcpServers": {
    "yolo-web": {
      "command": "bun",
      "args": ["run", "C:/src/yolo-web/packages/web-mcp/src/index.ts"],
      "env": {
        "YOLO_CDP_ENDPOINT": "http://127.0.0.1:9222"
      }
    }
  }
}
```

---

## Engine Specifications & IPC Protocol

### Dual-Runtime IPC & Memory Safety
- Host (Bun) and guest (Chromium V8) processes communicate across non-blocking local sockets or named pipes (`FastWebSocket` / `uWebSockets`).
- Buffer allocations for DOM trees, screenshot bitmaps, and PDF exports utilize zero-copy shared memory regions (`SharedArrayBuffer` / memory-mapped backing stores).
- Host orchestrators retain zero direct access to guest V8 heap pointers; all operations traverse strictly validated schema boundaries.

### Layout & Rasterization
- **Taffy 0.15**: Computes layout geometry for mixed Flexbox and Grid models within `crates/obscura-render`. Layout nodes map directly to Servo DOM nodes.
- **WebRender & WebGPU**: Scene display lists translate to hardware textures and GPU command buffers for compositing, eliminating software raster bottlenecks.

---

## Development

```bash
# Install workspace dependencies
bun install

# Run human browser service
bun run dev

# Execute unit and integration test suites
bun test apps/human-browser/src/server.test.ts packages/cdp-client/src/index.test.ts
cargo test -p yolo-browser

# Format codebase
bun fmt
```
