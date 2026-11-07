# yolo-web

**High-performance dual-plane browser engine, headless Chrome DevTools Protocol (CDP) orchestration mesh, Servo-derived CSS3/layout subsystem, and Chromium V8 isolate host.**

| Property | Value |
| :--- | :--- |
| **Package / Workspace** | `yolo-web` (`https://github.com/yolo-rs/yolo-web`) |
| **Version** | `0.3.0` |
| **Rust Toolchain** | `Edition 2024 / MSRV 1.85.0+` (`lto = "fat"`, `codegen-units = 1`, `opt-level = 3`) |
| **Host Runtime & Compiler** | `Upstream Bun v1.4.4+` (`src/aot` Cranelift AoT + Bytecode compilation, Apple WebKit / JavaScriptCore) |
| **Guest Browser Runtime** | `Chromium V8` (`rusty_v8` + `deno_core` `#[op2]`) + `CEF 156 Views` (`yolo-chromium`) |
| **Layout & Styling Engine** | `Mozilla/Servo Stylo` (`cssparser 0.34`, `selectors 0.26`) + `Taffy 0.15` (Flexbox / CSS Grid) + `WebGPU / WGPU` |
| **Privacy & Network Guards** | `Brave Shields` (`adblock-rust`, `sta-rs` STAR privacy, `kuchikiki`, SSRF-hardened `obscura-net`) |
| **License** | `Apache-2.0 OR MPL-2.0` |
| **Fleet Topology** | Load-Balanced 3-VPS Mesh (`vps` `10.200.77.1` \| `bunos` `10.200.77.3` \| `prod` `10.200.77.5`) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Dual-Plane Process & Sandbox Architecture](#2-dual-plane-process--sandbox-architecture)
3. [Complete Rust Crate Matrix (65+ Crates)](#3-complete-rust-crate-matrix-65-crates)
4. [Complete Bun Package & Application Matrix (29 Packages + 3 Apps)](#4-complete-bun-package--application-matrix-29-packages--3-apps)
5. [Command-Line Interface (`web` & `yolo-web`)](#5-command-line-interface-web--yolo-web)
6. [Model Context Protocol Server (`web-mcp` — 42 Tools)](#6-model-context-protocol-server-web-mcp--42-tools)
7. [Aphrody.com & `*.aphrody.app` Ecosystem Integration](#7-aphrodycom--aphrodyapp-ecosystem-integration)
8. [3-VPS Load-Balanced ("Charge Repartie") Build & Global Deployment](#8-3-vps-load-balanced-charge-repartie-build--global-deployment)
9. [Development, Verification & Release Hygiene](#9-development-verification--release-hygiene)

---

## 1. Executive Summary

`yolo-web` is a multi-engine browser research, automation, and web-platform execution monorepo engineered following Chromium's multi-process design documents and Upstream Bun (`oven-sh/bun`) native compilation architecture.

Rather than conflating host CLI/server orchestration with untrusted guest page execution, `yolo-web` enforces a strict hardware and process isolation boundary between two specialized execution planes:

- **Plane 1 (Host Orchestration & AoT Tooling)**: Runs 100% natively on **Upstream Bun v1.4.4+** (backed by Bun's ~145 Rust crates and Apple WebKit / JavaScriptCore with Riptide GC and B3/FTL JIT), compiling the `web`, `web-mcp`, `yolo-human-browser`, and `yolo-agent-runner` entrypoints into standalone native binaries (`bun build --compile --bytecode --minify`).
- **Plane 2 (Guest Web Platform, Rendering & V8 Isolates)**: Executes untrusted web pages, SPAs, and DOM mutations inside isolated **Chromium V8** heaps (`crates/obscura-js` via `rusty_v8` and `deno_core`), paired with **Servo Stylo** CSS3 selector matching, **Taffy 0.15** Flexbox/Grid layout computation, **WebGPU / WebRender** hardware rasterization, **Brave Shields** (`adblock-rust`) network filtering, and an upstream **Chromium Embedded Framework (CEF 156 Views)** native shell (`crates/yolo-chromium`).

---

## 2. Dual-Plane Process & Sandbox Architecture

```
+=============================================================================================+
|                     PLANE 1: HOST ORCHESTRATION & TOOLING (BUN / WEBKIT JSC)                |
|                                                                                             |
|  +-----------------------+  +-----------------------+  +---------------------------------+  |
|  |   dist/web (CLI)      |  | dist/web-mcp (MCP)    |  | dist/yolo-human-browser &       |  |
|  | @yolo-web/web-cli     |  | 42 JSON-RPC Tools     |  | dist/yolo-agent-runner          |  |
|  +-----------+-----------+  +-----------+-----------+  +----------------+----------------+  |
|              |                          |                               |                   |
|              +--------------------------+-------------------------------+                   |
|                                         |                                                   |
|   Upstream Bun v1.4.4+ Runtime (bun_core, bun_sys, uWebSockets, BoringSSL, bun:sqlite)      |
|   Apple WebKit / JavaScriptCore (LLInt -> Baseline -> DFG -> B3/FTL JIT + Riptide GC)       |
+=========================================+===================================================+
                                          |
                     Zero-Copy IPC / FastWebSockets / CDP / Safe C-ABI FFI
                                          |
+=========================================v===================================================+
|               PLANE 2: GUEST EXECUTION & WEB PLATFORM ENGINE (CHROMIUM V8 / SERVO)          |
|                                                                                             |
|  +---------------------------------------------------------------------------------------+  |
|  |                         crates/yolo-browser & crates/obscura                          |  |
|  |     SSRF Guard (obscura-ssrf) | Brave Shields (brave-adblock) | CDP (obscura-cdp)     |  |
|  +-------------------+-------------------------------+-----------------------------------+  |
|                      |                               |                                      |
|                      v                               v                                      |
|  +---------------------------------------+  +--------------------------------------------+  |
|  |   Guest JS Isolate (obscura-js)       |  |   HTML5 / CSS3 / Layout / GPU Pipeline     |  |
|  | - Chromium V8 (rusty_v8 / deno_core)  |  | - Parser: html5ever 0.39 / xml5ever        |  |
|  | - Ignition -> Sparkplug -> Maglev     |  | - Cascade: Servo Stylo + selectors 0.26    |  |
|  |   -> TurboFan Optimizing JIT          |  | - Layout: Taffy 0.15 (Flexbox / CSS Grid)  |  |
|  | - 32 MiB FIFO V8 Bytecode Cache       |  | - GPU: WebRender / Pathfinder / WGPU       |  |
|  | - O(1) Condvar Watchdog Preemption    |  | - Native Shell: yolo-chromium (CEF 156)    |  |
|  +---------------------------------------+  +--------------------------------------------+  |
+=============================================================================================+
```

### 2.1 Plane 1 Design Invariants (Bun / WebKit JSC)
1. **Zero Node.js Legacy Overhead**: All CLI parsing (`@yolo-web/cli-native`), MCP framing (`@yolo-web/mcp-native`), SQLite persistence (`bun:sqlite` WAL), and HTTP/WebSocket servers (`Bun.serve`) execute directly on Bun's native Rust/C++ primitives.
2. **Ahead-of-Time & Bytecode Compilation**: Production binaries (`dist/web`, `dist/web-mcp`, `dist/yolo-human-browser`, `dist/yolo-agent-runner`) are pre-compiled with `--compile --bytecode --minify` for sub-10ms cold start across Windows x64 and Linux x64 fleet nodes.
3. **Strict Memory Isolation**: Host JSC heaps never share raw pointers with guest V8 isolates; inter-plane payloads cross structured CDP WebSocket frames (`crates/deno-fastwebsockets`) or explicit shared-memory descriptors (`crates/servo-stylo/to_shmem`).

### 2.2 Plane 2 Design Invariants (Chromium V8 + Servo + CEF)
1. **True Chromium V8 Semantics**: Every guest page context runs inside an isolated `v8::Isolate` with `Error.captureStackTrace`, V8 `CachedData` bytecode caching (32 MiB bounded FIFO), deterministic microtask checkpoints, and `std::panic::catch_unwind` across all `#[op2]` FFI boundaries (`panic = "unwind"` enforced in `Cargo.toml`).
2. **Preemptive Isolate Watchdog**: Runaway guest scripts (`while(true){}`) are terminated deterministically via an `O(1)` `Condvar` watchdog thread invoking `v8::IsolateHandle::terminate_execution()`.
3. **Defense-in-Depth Network & Sandbox Policy**: All guest subresource fetches pass through `crates/obscura-ssrf` (blocking RFC 1918, loopback, link-local `169.254.169.254`, and CGNAT ranges) and `crates/brave-adblock` before touching TLS sockets.

---

## 3. Complete Rust Crate Matrix (65+ Crates)

The Cargo workspace (`Cargo.toml`) consolidates over 60 specialized Rust crates organized into five subsystem families:

### 3.1 Top-Level Browser Engines & Binaries

| Crate | Path | Binary / Library Target | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| `yolo-browser` | `crates/yolo-browser` | `lib` | Unified Rust browser engine facade integrating Servo HTML5/CSS3, Obscura V8/DOM/CDP, and Brave Shields. |
| `yolo-chromium` | `crates/yolo-chromium` | `bin` (`yolo-chromium`) | Upstream Chromium browser shell built over the official pinned CEF 156 Views binary distribution. |
| `agent-browser` | `crates/agent-browser` | `bin` (`yolo-web`) | Native Rust headless automation and DOM snapshot CLI (`cargo run -p agent-browser --bin yolo-web`). |
| `yolo-web-standards` | `crates/yolo-web-standards` | `lib` | Strongly-typed W3C, WHATWG, TC39, WebAssembly, and MCP specification data structures. |
| `yolo-browser-cli` | `apps/yolo-browser-cli` | `bin` | Standalone Rust CLI harness for direct `yolo-browser` engine invocation and benchmarking. |

### 3.2 Consolidated Obscura Engine Crates (`crates/obscura-*`)

| Crate | Path | Architectural Responsibility |
| :--- | :--- | :--- |
| `obscura` | `crates/obscura` | Top-level Obscura engine coordinator, session pool, and lifecycle supervisor. |
| `obscura-browser` | `crates/obscura-browser` | Multi-tab browser context state machine, navigation history, cookie jar, and storage partitions. |
| `obscura-cdp` | `crates/obscura-cdp` | Chrome DevTools Protocol server implementing `Page.*`, `Runtime.*`, `DOM.*`, `Network.*`, and `Input.*` domains. |
| `obscura-cli` | `crates/obscura-cli` | Command-line interface for launching headless Obscura CDP and MCP server daemons. |
| `obscura-dom` | `crates/obscura-dom` | Arena-backed HTML5 DOM tree, live mutation observers, accessibility tree projection, and selector queries. |
| `obscura-js` | `crates/obscura-js` | Chromium V8 isolate runtime (`rusty_v8` + `deno_core`), snapshot loader, 32 MiB bytecode cache, and DOM bindings. |
| `obscura-mcp` | `crates/obscura-mcp` | Native Rust Model Context Protocol server exposing low-latency DOM and V8 inspection tools. |
| `obscura-net` | `crates/obscura-net` | Asynchronous HTTP/1.1, HTTP/2, and SOCKS5 client (`reqwest` + `rustls`) with stealth TLS fingerprint profiles. |
| `obscura-render` | `crates/obscura-render` | Taffy 0.15 Flexbox/Grid layout solver coupled with `tiny-skia` and `ab_glyph` rasterization for viewport capture. |
| `obscura-ssrf` | `crates/obscura-ssrf` | DNS-rebinding and Server-Side Request Forgery (SSRF) verifier blocking private, loopback, and metadata IPs. |

### 3.3 Consolidated Mozilla/Servo Crates (`crates/servo-*`)

| Crate | Path | Architectural Responsibility |
| :--- | :--- | :--- |
| `servo-html5ever` | `crates/servo-html5ever` | Spec-compliant WHATWG HTML5 tokenizer and tree builder (`html5ever 0.39`). |
| `servo-xml5ever` | `crates/servo-xml5ever` | Spec-compliant XML5 tokenizer and tree builder for XHTML and SVG documents. |
| `servo-markup5ever` | `crates/servo-markup5ever` | Shared DOM tree sink traits, namespace tables, and entity decoders for `html5ever` and `xml5ever`. |
| `servo-cssparser` | `crates/servo-cssparser` | CSS Syntax Level 3 tokenizer and parser (`cssparser`, `cssparser-macros`, `cssparser-color`). |
| `servo-stylo` | `crates/servo-stylo/*` | Servo parallel CSS cascade and selector engine (`selectors`, `servo_arc`, `to_shmem`, `malloc_size_of`, `style`). |
| `servo-euclid` | `crates/servo-euclid` | Strongly-typed 2D/3D geometric primitives (points, vectors, rects, rigid transforms, scale factors). |
| `servo-webrender` | `crates/servo-webrender` | GPU-accelerated 2D display-list compositor and tile rasterizer for web content. |
| `servo-pathfinder` | `crates/servo-pathfinder/*` | GPU vector graphics and font outline rasterizer (`simd`, `geometry`, `color`). |
| `servo-font-kit` | `crates/servo-font-kit` | Cross-platform system font discovery (`DirectWrite`, `CoreText`, `Fontconfig`) and glyph metric loader. |
| `servo-surfman` | `crates/servo-surfman` | Low-level cross-platform GPU surface and hardware context management (`EGL`, `WGL`, `CGL`). |
| `servo-ipc-channel` | `crates/servo-ipc-channel` | Multi-process OS shared-memory and Mach/socket IPC channels matching Rust `std::sync::mpsc` semantics. |
| `servo-string-cache` | `crates/servo-string-cache` | Compile-time and runtime interned atom tables (`web_atoms`, `string-cache-codegen`). |
| `servo-tendril` | `crates/servo-tendril` | Zero-copy reference-counted compact string/byte buffers optimized for streaming HTML/CSS parsers. |
| `servo-uluru` | `crates/servo-uluru` | Fast fixed-capacity stack-allocated LRU cache used in Stylo selector matching. |
| `servo-fnv` | `crates/servo-fnv` | Fowler-Noll-Vo non-cryptographic hasher for short DOM/CSS identifier keys. |
| `servo-svg` | `crates/servo-svg` | SVG path data, viewBox, and presentation attribute parser. |
| `servo-xpath` | `crates/servo-xpath` | XPath 1.0 lexer, AST parser, and CSS3 selector translation engine. |
| `servo-webvtt` | `crates/servo-webvtt` | W3C WebVTT media caption and cue timing parser. |
| `servo-url` | `crates/servo-url` | WHATWG URL Standard parser, origin tuple computation, and host canonicalization. |
| `servo-gaol` | `crates/servo-gaol` | Cross-platform OS application sandboxing (`seccomp-bpf`, Windows Job/Token restrictions, macOS Seatbelt). |
| `servo-allocator` | `crates/servo-allocator` | Heap allocation tracking and `jemalloc` / system allocator integration. |
| `servo-timers` | `crates/servo-timers` | Hierarchical timer wheels and task scheduling primitives for DOM event loops. |
| `servo-tracing` | `crates/servo-tracing` | Structured profiling spans and performance timeline instrumentation. |
| `servo-dom-struct` | `crates/servo-dom-struct` | Procedural macros enforcing safe GC-traceable DOM struct memory layouts (`servo-deny-public-fields`). |
| `servo-hyper-serde` | `crates/servo-hyper-serde` | Serde serialization adapters for HTTP headers, cookies, and status codes. |

### 3.4 Consolidated Brave Privacy & Security Crates (`crates/brave-*`)

| Crate | Path | Architectural Responsibility |
| :--- | :--- | :--- |
| `brave-adblock` | `crates/brave-adblock` | Brave Shields `adblock-rust` engine: EasyList/uBlock filter parsing, cosmetic filtering, and scriptlet injection. |
| `brave-kuchikiki` | `crates/brave-kuchikiki` | CSS selector query and DOM tree traversal library built over `html5ever`. |
| `brave-search-cli` | `crates/brave-search-cli` | Native Rust client for Brave Web Search, LLM Context grounding, Summarizer, and News APIs. |
| `brave-star` | `crates/brave-star/*` | Cryptographic STAR (Secret-shared Threshold Aggregation for Reporting) privacy protocol (`adss`, `ppoprf`, `sharks`). |
| `brave-bot` | `crates/brave-bot` | Security-hardened autonomous bot execution primitives and sandboxing guards. |

### 3.5 Consolidated Deno & V8 Runtime Crates (`crates/deno-*`)

| Crate | Path | Architectural Responsibility |
| :--- | :--- | :--- |
| `deno-core` | `crates/deno-core/*` | V8 isolate reactor primitives (`unsync`, `unsafecell`, `parking_lot`, `core`, `ops`, `serde_v8`). |
| `deno-fastwebsockets` | `crates/deno-fastwebsockets` | RFC 6455 compliant SIMD-accelerated WebSocket frame parser and client/server transport. |
| `deno-import-map` | `crates/deno-import-map` | WICG Import Maps specification parser and module specifier resolver. |
| `deno-media-type` | `crates/deno-media-type` | MIME type classification and TypeScript/JSX/WASM content-type mapping. |
| `deno-error` | `crates/deno-error` | Structured JS/DOM error code binding across Rust and V8 (`deno_error_macro`). |

---

## 4. Complete Bun Package & Application Matrix (29 Packages + 3 Apps)

All TypeScript packages under `packages/*` and `apps/*` target Upstream Bun v1.4.4+ and pass strict `bun check` validation:

### 4.1 Applications (`apps/*`)

| Application | Path | Binary Output | Description |
| :--- | :--- | :--- | :--- |
| `human-browser` | `apps/human-browser` | `dist/yolo-human-browser` | Interactive CDP browser control server, live viewport streaming, and session recorder. |
| `ai-agent-runner` | `apps/ai-agent-runner` | `dist/yolo-agent-runner` | Autonomous multi-step AI browser agent runner with MCP tool dispatch and trace receipts. |
| `yolo-browser-cli` | `apps/yolo-browser-cli` | `target/release/yolo-browser-cli` | Native Rust CLI wrapper over `crates/yolo-browser`. |

### 4.2 Workspace Packages (`packages/*`)

| # | Package Name | Directory | Responsibility |
|---:|:---|:---|:---|
| 1 | `@yolo-web/agent-browser-skills` | `packages/agent-browser-skills` | Agent skills definitions (`SKILL.md`) for headless browser navigation, extraction, and verification. |
| 2 | `@yolo-web/api-contract` | `packages/api-contract` | Shared Zod/JSON-Schema RPC contracts for browser sessions, CDP events, and cloud telemetry. |
| 3 | `@yolo-web/auth` | `packages/auth` | Zero-trust vault (`YoloSecureVault`), WebAuthn Passkeys, RFC 6238 TOTP, QR SVG generation, and Postgres schema. |
| 4 | `@yolo-web/brave-search-mcp` | `packages/brave-search-mcp` | Standalone Model Context Protocol server for Brave Search, Answers, and LLM Context APIs. |
| 5 | `@yolo-web/brave-shields` | `packages/brave-shields` | Bun bindings to Brave Shields URL sanitization, tracker blocking, and fingerprint randomization. |
| 6 | `@yolo-web/browser-sdk` | `packages/browser-sdk` | High-level `YoloBrowser` SDK for managing multi-tab CDP sessions, stealth profiles, and snapshots. |
| 7 | `@yolo-web/bun-plugin` | `packages/bun-plugin` | Native `Bun.plugin` loaders for `.wgsl` shaders, `.vtt` tracks, and browser standard schemas. |
| 8 | `@yolo-web/bun-v8-bridge` | `packages/bun-v8-bridge` | Dual-plane coordinator linking Plane 1 (Bun/JSC) with Plane 2 (Chromium V8 isolates). |
| 9 | `@yolo-web/cdp-client` | `packages/cdp-client` | High-throughput multiplexed Chrome DevTools Protocol WebSocket client with domain event streams. |
| 10 | `@yolo-web/challenge-solver` | `packages/challenge-solver` | Legitimate Chromium 2026 fingerprint alignment, User-Agent Client Hints (`Sec-CH-UA`), and session attestation. |
| 11 | `@yolo-web/chrome-extension-yolo` | `packages/chrome-extension-yolo` | Manifest V3 Chromium extension for DOM inspection, MCP bridging, and live agent handoff. |
| 12 | `@yolo-web/chromium` | `packages/chromium` | TypeScript controller for `crates/yolo-chromium` (CEF 156 runtime provisioning, flags, and health probes). |
| 13 | `@yolo-web/chromium-tracker` | `packages/chromium-tracker` | Upstream Chromium, ChromiumOS, AOSP, Google OSS, and DeepMind release channel & Gitiles tracker (`bun:sqlite`). |
| 14 | `@yolo-web/cli-native` | `packages/cli-native` | Zero-dependency native Bun command-line parser replacing external `commander` packages. |
| 15 | `@yolo-web/google` | `packages/google` | Google Cloud, Vertex AI / Gemini, Google Drive/Docs sync, Font/Edge proxies, and `gws` CLI. |
| 16 | `@yolo-web/knowledge-indexer` | `packages/knowledge-indexer` | SQLite FTS5 / BM25 document indexer for crawled web pages and technical documentation. |
| 17 | `@yolo-web/mcp-client` | `packages/mcp-client` | Streamable HTTP and `stdio` MCP client for orchestrating multi-server tool invocations. |
| 18 | `@yolo-web/mcp-native` | `packages/mcp-native` | Zero-dependency JSON-RPC 2.0 Model Context Protocol server engine built natively for `Bun.serve`. |
| 19 | `@yolo-web/obscura-chrome` | `packages/obscura-chrome` | Obscura-to-Chromium headless pipeline for automated UI crawling and visual regression capture. |
| 20 | `@yolo-web/posix-bun` | `packages/posix-bun` | POSIX `Errno`, signal constants, and system error formatting for cross-platform process supervision. |
| 21 | `@yolo-web/servo-bridge` | `packages/servo-bridge` | CSS3 specificity calculator, selector validator, XPath-to-CSS compiler, and WebVTT parser. |
| 22 | `@yolo-web/shared` | `packages/shared` | Common ring-buffers, structured loggers, retry policies, and deterministic hashing utilities. |
| 23 | `@yolo-web/web-cli` | `packages/web-cli` | Unified `web` CLI binary (`dist/web`) exposing crawl, search, shields, servo, auth, and engine commands. |
| 24 | `@yolo-web/web-cluster` | `packages/web-cluster` | Distributed browser worker pool and load balancer across the 3-VPS WireGuard mesh. |
| 25 | `@yolo-web/web-crawler` | `packages/web-crawler` | Provenance-first robots-aware web crawler, Markdown synthesizer, and 5-registry package catalog. |
| 26 | `@yolo-web/web-mcp` | `packages/web-mcp` | Unified `web-mcp` binary (`dist/web-mcp`) exposing 42 MCP tools, 4 prompts, and 8 standard resources. |
| 27 | `@yolo-web/web-plugin` | `packages/web-plugin` | Plugin manifest and hook lifecycle for extending `yolo-web` with custom extractors. |
| 28 | `@yolo-web/standards` | `packages/web-standards` | Curated W3C, WebAssembly, TC39, MDN compatibility, and MCP 2026 specification loader. |
| 29 | `@yolo-web/yolo-agent` | `packages/yolo-agent` | High-level autonomous web research agent combining Brave Search grounding with CDP verification. |

---

## 5. Command-Line Interface (`web` & `yolo-web`)

The compiled `dist/web` (`@yolo-web/web-cli`) binary provides a single unified entrypoint for developers, CI pipelines, and AI agents:

```bash
# 1. Provenance-first web crawling with Markdown synthesis
web crawl https://aphrody.com --depth 1 --max-pages 20 --output crawl.json --markdown crawl.md

# 2. Brave Search & LLM Context Grounding
web search "rust wgpu compute pipeline bind group layout" --count 5
web context "chromium v8 maglev compiler tier" --count 5

# 3. Brave Shields Adblock, Query Sanitization & Fingerprint Defense
web shields check https://tracker.example.com/pixel.js --source https://aphrody.com --type script
web shields sanitize "https://example.com/page?id=42&fbclid=IwAR123&utm_source=twitter"

# 4. Servo CSS3 Specificity, XPath-to-CSS Translation & WebVTT Parsing
web servo specificity "main#content > article.post:not(.draft):first-child"
web servo xpath "//div[@id='app']//button[contains(@class, 'primary')]"

# 5. Upstream Engine & Multi-Registry Package Inspection
web engine list
web engine status chromium
web pkg resolve serde --registry crates

# 6. Zero-Trust Auth Vault, Passkeys & TOTP
web auth totp-generate --issuer "Aphrody" --account "ops@aphrody.com"
```

---

## 6. Model Context Protocol Server (`web-mcp` — 42 Tools)

`packages/web-mcp` (`dist/web-mcp`) implements a production Model Context Protocol server over both `stdio` and Streamable HTTP (`GET /health`, `POST /mcp`).

### 6.1 Complete 42-Tool Inventory

| Domain | Count | Tool Names |
| :--- | :---: | :--- |
| **Browser Navigation & Lifecycle** | 7 | `browser_navigate`, `browser_back`, `browser_forward`, `browser_reload`, `browser_close`, `browser_wait_for`, `browser_wait_for_text` |
| **DOM Interaction & Forms** | 8 | `browser_click`, `browser_fill`, `browser_type`, `browser_press_key`, `browser_select_option`, `browser_scroll`, `browser_detect_forms`, `browser_fill_form` |
| **DOM Inspection & Extraction** | 7 | `browser_snapshot`, `browser_markdown`, `browser_links`, `browser_interactive_elements`, `browser_get_attribute`, `browser_count`, `browser_extract` |
| **Tabs, Storage & Media Capture** | 8 | `browser_tab_new`, `browser_tab_list`, `browser_tab_switch`, `browser_tab_close`, `browser_get_cookies`, `browser_set_cookie`, `browser_clear_cookies`, `browser_storage_state`, `browser_set_storage_state`, `browser_screenshot`, `browser_pdf` *(11 combined with evaluation)* |
| **JS Evaluation & Network Telemetry** | 4 | `browser_evaluate`, `browser_wait_for_function`, `browser_network_requests`, `browser_console_messages` |
| **Brave Search & Privacy Intelligence** | 8 | `brave_web_search`, `brave_llm_context`, `brave_image_search`, `brave_video_search`, `brave_news_search`, `brave_summarizer`, `brave_shields_check`, `brave_answers`, `brave_suggest`, `browser_search` |
| **Servo CSS3 & Media Standards** | 3 | `servo_css_specificity`, `servo_xpath_to_css`, `servo_parse_webvtt` |
| **V8 Isolate & Chromium Qualification** | 6 | `v8_runtime_info`, `v8_evaluate_safe`, `web_engine_status`, `browser_resolve_challenge`, `browser_chromium_legitimacy_script`, `chromium_upstream_status`, `chromium_managed_patches` |

### 6.2 MCP Client Configuration

```json
{
  "mcpServers": {
    "yolo-web": {
      "command": "/usr/local/bin/web-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "YOLO_CDP_ENDPOINT": "http://127.0.0.1:9222"
      }
    }
  }
}
```

---

## 7. Aphrody.com & `*.aphrody.app` Top-1 Rust/Bun/WebGPU/Bevy Ecosystem Integration

`yolo-web` serves as the foundational web automation, crawling, authentication (`@yolo-web/auth`), and edge rendering engine for the **Aphrody** production ecosystem hosted on `prod` (`10.200.77.5`) and defined in `@yolo-web/google` (`packages/google/src/aphrody-apps-catalog.ts` & `search-server.ts`):

| Domain / Subdomain | Stack & Engine Integration | Role in the Aphrody & YOLO Ecosystem |
| :--- | :--- | :--- |
| **`aphrody.com` / `aphrody.app`** | Bun v1.4.4+ / Rust / `@yolo-web/auth` / Material Design 3 | Primary production origin, unified Passkey/TOTP identity vault, FTS5 search engine, and AI platform gateway. |
| **`craft.aphrody.app` & `bevy.aphrody.app`** | Rust + **Bevy 0.16+ ECS** + **WGPU 24 / WebGPU** + **60GB CRIWARE CPK** | Unreal-grade browser & headless Vulkan 3D engine with 60GB `.cpk` streaming (`yolo-re`) and AI procedural WGSL/ECS scene generation. |
| **`zed.aphrody.app` & `gpui.aphrody.app`** | Rust + **GPUI** (`yolo-gpui`) + **WGPU Analytical SDF** + Tree-sitter | Multiplayer GPU-accelerated IDE and 120 FPS hybrid UI workbench integrated with Local Uncensored AI. |
| **`rio.aphrody.app` & `nushell.aphrody.app`** | Rust + **SugarLoaf WGPU** + **Nushell** + `Bun.spawn` PTY | Hardware-accelerated WebGPU terminal and structured data shell bridged natively with Upstream Bun v1.4.4+. |
| **`uncensored.aphrody.app`** | Rust + **llama.cpp** + **WebGPU WGSL** + `@yolo-web/auth` | Sovereign GGUF & WebGPU local inference cluster (Chat `:8081`, Coder `:8082/:8084`, Embeddings `:8090`). |
| **`spacedrive.aphrody.app` & `cosmic.aphrody.app`** | Rust + **Spacedrive VDFS** (Iroh QUIC) + **COSMIC Epoch** (`libcosmic`) | Virtual Distributed File System and complete Wayland/WebGPU desktop environment. |
| **`egui.aphrody.app`, `iced.aphrody.app`, `leptos.aphrody.app`, `taffy.aphrody.app`, `wgpu.aphrody.app`** | Rust + **egui 0.31** / **Iced 0.14** / **Leptos 0.8** / **Taffy 0.15** / **WGPU 24** | Interactive UI, layout solver, fullstack SSR islands, and Naga WGSL compute/render laboratories. |
| **`tiny-glade.aphrody.app`, `veloren.aphrody.app`, `tunnet.aphrody.app`** | Rust + **Bevy / WGPU** + SDF Global Illumination + Rapier3D | Browser WebGPU and headless Vulkan game showcases streaming assets from 60GB CPK archives. |
| **`awesome.aphrody.app`, `showcase.aphrody.app`, `templates.aphrody.app`, `docs.aphrody.app`** | `bun:sqlite` WAL FTS5 + `Bun.redis` + W3C DTCG Tokens | Live ecosystem index, 8-preset HCT/CAM16 showcase, shared monorepo templates, and engineering documentation. |

---

## 8. 3-VPS Load-Balanced ("Charge Repartie") Build & Global Deployment

To prevent CPU/RAM saturation on any single machine, `scripts/fleet-release-deploy.ts` distributes build, verification, caching, and deployment across all three WireGuard fleet nodes in parallel:

```
+---------------------------------------------------------------------------------------------------+
|                        WIRE-GUARD MESH (10.200.77.0/24) — CHARGE REPARTIE                         |
+---------------------------------+---------------------------------+-------------------------------+
|   NODE 1: vps (10.200.77.1)     |   NODE 2: bunos (10.200.77.3)   |   NODE 3: prod (10.200.77.5)  |
|   OVH Ubuntu 24.04              |   OVH Ubuntu 24.04              |   Hostinger Arch Linux        |
|   Role: Heavy Build Factory     |   Role: Lint, Test & Cache      |   Role: Production Origin     |
+---------------------------------+---------------------------------+-------------------------------+
| 1. Sync /srv/yolo-web @ main    | 1. Sync /srv/yolo-web @ main    | 1. Sync /srv/yolo-web @ main  |
| 2. Compile all 4 Bun AoT bins:  | 2. Run `bun check` across all   | 2. Receive / compile verified |
|    - dist/web                   |    29 workspace packages        |    AoT binaries               |
|    - dist/web-mcp               | 3. Run `bun test` suites:       | 3. Global install into        |
|    - dist/yolo-human-browser    |    - packages/auth              |    /usr/local/bin/{web,       |
|    - dist/yolo-agent-runner     |    - packages/web-cli           |    web-mcp,yolo-web,...}      |
| 3. Build Rust `agent-browser`   | 4. Cache AoT artifacts into     | 4. Serve aphrody.com &        |
|    (`yolo-web` native binary)   |    /srv/yolo_build_cache        |    *.aphrody.app edge routes  |
| 4. Install to /usr/local/bin/*  | 5. Install to /usr/local/bin/*  | 5. Verify `web --help`        |
+---------------------------------+---------------------------------+-------------------------------+
```

### Global Binaries Installed on All 3 VPS (`/usr/local/bin/`)
- `/usr/local/bin/web` — Compiled Bun AoT unified CLI (`dist/web`)
- `/usr/local/bin/web-mcp` — Compiled Bun AoT MCP server (`dist/web-mcp`)
- `/usr/local/bin/yolo-human-browser` — Compiled Bun AoT human browser server (`dist/yolo-human-browser`)
- `/usr/local/bin/yolo-agent-runner` — Compiled Bun AoT autonomous agent runner (`dist/yolo-agent-runner`)
- `/usr/local/bin/yolo-web` — Native Rust `agent-browser` binary (or high-speed dispatcher to `/usr/local/bin/web`)

Execute the full load-balanced pipeline from any workstation:

```bash
bun scripts/fleet-release-deploy.ts
```

---

## 9. Development, Verification & Release Hygiene

```bash
# Install all 29 workspace packages & 3 apps via Upstream Bun v1.4.4+
bun install

# Type-check all workspace packages in parallel
bun run check

# Run deterministic unit & integration test suites
bun test packages/auth/test/auth.test.ts packages/web-cli/src/index.test.ts

# Compile standalone AoT + Bytecode binaries into dist/
bun run aot:all

# Run Rust workspace unit tests (Obscura, Servo, Brave, Deno crates)
bun run rust:test

# Deploy and verify across all 3 VPS nodes (vps, bunos, prod)
bun scripts/fleet-release-deploy.ts
```
