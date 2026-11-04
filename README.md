# YOLO-Web (`yolo-rs/yolo-web`)

## Install as an agent plugin

```
/plugin marketplace add yolo-rs/yolo-web
/plugin install yolo-web --marketplace yolo-rs/yolo-web
```


**Unified Chromium-Compatible Browser Engine & Monorepo in Full Rust + Bun for AI Agents and Humans.**

Consolidated from three open-source browser engines under **[`github.com/orgs/yolo-rs`](https://github.com/orgs/yolo-rs/repositories)**:

1. **[Servo](https://github.com/yolo-rs/servo)** (`crates/servo-*`) — High-performance W3C HTML5/XML5 parsers (`html5ever`, `markup5ever`, `xml5ever`), Stylo CSS3 & selector engine (`cssparser`, `selectors`, `servo_arc`, `stylo`), WebRender & Pathfinder GPU/CPU graphics (`webrender`, `pathfinder`), 2D/3D geometry (`euclid`), IPC (`ipc-channel`), font loading (`font-kit`), GPU surfaces (`surfman`), sandboxing (`gaol`), SVG (`servo-svg`), XPath (`servo-xpath`), WebVTT (`servo-webvtt`), and fast stack collections (`smallvec`, `tendril`, `uluru`, `fnv`, `string_cache`).
2. **[Obscura](https://github.com/yolo-rs/obscura)** (`crates/obscura*`) — Real V8 JavaScript runtime (`deno_core`), high-speed DOM tree, Taffy + Cosmic-Text + Tiny-Skia layout/rasterizer, Chrome DevTools Protocol (CDP) WebSocket server (`obscura-cdp`), Model Context Protocol (MCP) server (`obscura-mcp`), stealth TLS/HTTP2 fingerprint emulation (`obscura-net`), and SSRF protection (`obscura-ssrf`).
3. **[Brave](https://github.com/yolo-rs/adblock-rust)** (`crates/brave-*`) — Native Rust Adblock & Shields engine (`adblock-rust` + `adblock-lists` + `adblock-resources` + `cookiecrumbler`), `kuchikiki` HTML tree manipulation, `brave-search-cli` (`bx`), `sta-rs` privacy-preserving telemetry, and `bravebot-core` prompt-injection resistance.
4. **[Deno & Chromium V8](https://github.com/yolo-rs/deno_core)** (`crates/deno-*`) — `deno_core` V8 isolate runtime & `#[op2(fast)]` FFI bindings, `rusty_v8` (`yolo-rs/v8`), `fastwebsockets` SIMD RFC 6455 engine, `import_map` WICG Import Maps, `deno_media_type`, `deno_error`, and `deno_unsync` single-threaded Tokio reactor.
5. **[Dual-Runtime Bun (WebKit/JSC) + Chromium V8](https://github.com/yolo-rs/bun)** (`crates/BUN_WEBKIT_V8_ARCHITECTURE.md` & `packages/bun-v8-bridge`) —
   - **Plane 1 (Host Runtime)**: **100% Native Upstream Bun v1.4.4+** (`yolo-rs/bun` Full Rust ~200 crates + `yolo-rs/WebKit` C++ JavaScriptCore / Riptide GC + `src/aot` Cranelift AoT compiler — **Zero Zig, Zero Node.js**).
   - **Plane 2 (Browser Guest Engine)**: **100% Chromium V8** (`yolo-rs/v8` + `yolo-rs/rusty_v8` + `yolo-rs/deno_core` in `crates/obscura-js`) for byte-exact Chromium web page rendering, SPA hydration, and CDP compatibility.

---

## Monorepo Architecture

```text
yolo-web/
├── Cargo.toml                  # Unified Rust workspace (60 workspace member crates, Fat LTO, codegen-units=1)
├── package.json                # Unified Bun workspace (apps/* + packages/*, AoT compilation scripts)
├── bunfig.toml                 # Upstream Bun configuration
├── tsconfig.json               # TypeScript 7 (bun check) configuration
├── apps/
│   ├── yolo-browser-cli/       # Unified Rust CLI binary (`yolo-browser`: info, query, shield-check, serve)
│   ├── human-browser/          # Bun.serve Interactive Human + AI Co-Pilot Browser Workbench UI
│   └── ai-agent-runner/        # Bun Autonomous AI Agent Browser Runner (CDP + MCP + Brave Shields)
├── packages/
│   ├── shared/                 # @yolo-web/shared — Protocol schemas, viewport & session models
│   ├── cdp-client/             # @yolo-web/cdp-client — Pure Bun WebSocket Chrome DevTools Protocol client
│   ├── mcp-client/             # @yolo-web/mcp-client — Pure Bun MCP client (HTTP JSON-RPC & stdio)
│   ├── browser-sdk/            # @yolo-web/browser-sdk — Unified AI + Human Co-Pilot Browser SDK
│   ├── servo-bridge/           # @yolo-web/servo-bridge — Servo Euclid geometry, CSS specificity, XPath & WebVTT
│   ├── brave-shields/          # @yolo-web/brave-shields — Brave Shields Adblock, fingerprint & URL hygiene
│   ├── brave-search-mcp/       # @yolo-web/brave-search-mcp — Pure Bun Brave Search MCP server
│   └── bun-v8-bridge/          # @yolo-web/bun-v8-bridge — Host Bun (WebKit/JSC) <-> Guest Browser (Chromium V8) bridge
├── crates/
│   ├── yolo-browser/           # Unified Rust browser engine integrating Servo + Obscura + Brave + Deno/V8
│   ├── obscura*/               # 10 Obscura crates (browser, cdp, cli, dom, js, mcp, net, render, ssrf, sdk)
│   ├── servo-*/                # 31 Servo crates (html5ever, cssparser, stylo, webrender, pathfinder, euclid, ...)
│   ├── brave-*/                # 5 Brave crates (brave-adblock, brave-kuchikiki, brave-search-cli, brave-star, brave-bot)
│   └── deno-*/                 # 8 Deno/V8 crates (deno-core, deno-error, deno-import-map, deno-fastwebsockets, deno-media-type)
├── tools/
│   └── live-view.ts            # Pure Bun (`Bun.serve` + `Bun.spawn`) live CDP viewport streamer
├── skills/
│   ├── obscura/                # AI Agent skill for operating Obscura / YOLO-Web
│   └── brave-search/           # AI Agent skills for Brave Search API
└── docs/                       # Full documentation (100% Bun workflows)
```

---

## Quick Start

### 1. Bun Workspace (`apps/*` & `packages/*`)

```bash
# Install workspace links with Bun
bun install

# Run all Bun unit & integration tests across apps/* and packages/*
bun test

# Start the Human + AI Co-Pilot Browser Workbench (Bun.serve)
bun run dev

# Run the Autonomous AI Agent Browser Runner
bun run agent

# Build standalone AoT / Bytecode-compiled Bun binaries
bun run aot:all
```

### 2. Rust Workspace (`crates/*` & `apps/yolo-browser-cli`)

```bash
# Inspect the consolidated Servo + Obscura + Brave + Deno/V8 engine manifest
cargo run -p yolo-browser-cli -- info

# Query an HTML document using Servo html5ever + Obscura DOM + Uluru LRU cache
cargo run -p yolo-browser-cli -- query --html "<main><button class='cta'>Go</button></main>" --selector ".cta"

# Check a network URL against Brave Shields (adblock-rust) and Obscura SSRF protection
cargo run -p yolo-browser-cli -- shield-check --url "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"

# Build maximum-performance Fat-LTO release binaries with full rendering and stealth support
bun run rust:build:lto
```

---

## Maximum Performance Architecture (AoT + Fat LTO + V8 Snapshots)

- **Bun Ahead-of-Time (AoT) & Bytecode Compilation (`src/aot` Cranelift + JSC Bytecode)**:
  - All workspace packages (`packages/*`) and apps (`apps/*`) set `"sideEffects": false` and annotate factory functions with `/* @__PURE__ */` to maximize dead-code elimination (`--trim`) and SSA IR type specialization in `yolo-rs/bun`'s `src/aot` compiler.
  - Zero-cache ultra-fast typechecking (`bun check`), linting (`bun lint`), formatting (`bun fmt`), and testing (`bun test`).
- **Cargo Fat LTO & Single Codegen Unit (`Cargo.toml`)**:
  - `[profile.release]` and `[profile.release-dist]` enable `opt-level = 3`, `lto = "fat"`, and `codegen-units = 1` across all 60 Rust crates while preserving `panic = "unwind"` for 100% panic-safe V8 `#[op2]` FFI boundaries (`std::panic::catch_unwind`).
- **V8 Startup Heap Snapshots & Fast API Calls (`crates/obscura-js`)**:
  - Pre-baked V8 heap snapshots (`OBSCURA_SNAPSHOT.bin`) yield **~4ms cold tab boot**, paired with a 32 MiB bounded `v8::ScriptCompiler::CachedData` bytecode cache (`CLASSIC_CODE_CACHE`) and zero-allocation `#[op2(fast)]` V8 C-Call DOM bindings.

---

## Architecture Catalogs & Blueprints

- [`crates/SERVO_CRATES.md`](crates/SERVO_CRATES.md) — Catalog of all 31 consolidated Servo crates
- [`crates/BRAVE_CRATES.md`](crates/BRAVE_CRATES.md) — Catalog of all consolidated Brave Rust crates & Shield packages
- [`crates/DENO_V8_CRATES.md`](crates/DENO_V8_CRATES.md) — Catalog of consolidated Deno & V8 runtime crates (`deno_core`, `rusty_v8`, `fastwebsockets`, `import_map`, `deno_media_type`, `deno_error`)
- [`crates/BUN_WEBKIT_V8_ARCHITECTURE.md`](crates/BUN_WEBKIT_V8_ARCHITECTURE.md) — Dual-Runtime Host Bun (Full Rust + WebKit/JSC + Cranelift AoT) + Guest Browser (Chromium V8) specification
- [`docs/ULTIMATE_2026_STACK.md`](docs/ULTIMATE_2026_STACK.md) — 2026 Multi-Language Scraper, Crawler & AI Browser Intelligence Stack Blueprint

---

## `yolo-rs` Organization Repositories

All upstream forks are hosted cleanly under **[`https://github.com/orgs/yolo-rs/repositories`](https://github.com/orgs/yolo-rs/repositories)**:

- **Core Monorepo**: [`yolo-rs/yolo-web`](https://github.com/yolo-rs/yolo-web)
- **Obscura**: [`yolo-rs/obscura`](https://github.com/yolo-rs/obscura)
- **Servo**: [`yolo-rs/servo`](https://github.com/yolo-rs/servo), [`yolo-rs/pathfinder`](https://github.com/yolo-rs/pathfinder), [`yolo-rs/webrender`](https://github.com/yolo-rs/webrender), [`yolo-rs/html5ever`](https://github.com/yolo-rs/html5ever), [`yolo-rs/rust-smallvec`](https://github.com/yolo-rs/rust-smallvec), [`yolo-rs/rust-url`](https://github.com/yolo-rs/rust-url), [`yolo-rs/ipc-channel`](https://github.com/yolo-rs/ipc-channel), [`yolo-rs/rust-cssparser`](https://github.com/yolo-rs/rust-cssparser), [`yolo-rs/font-kit`](https://github.com/yolo-rs/font-kit), [`yolo-rs/euclid`](https://github.com/yolo-rs/euclid), [`yolo-rs/gaol`](https://github.com/yolo-rs/gaol), [`yolo-rs/rust-fnv`](https://github.com/yolo-rs/rust-fnv), [`yolo-rs/stylo`](https://github.com/yolo-rs/stylo), [`yolo-rs/tendril`](https://github.com/yolo-rs/tendril), [`yolo-rs/uluru`](https://github.com/yolo-rs/uluru), [`yolo-rs/string-cache`](https://github.com/yolo-rs/string-cache), [`yolo-rs/surfman`](https://github.com/yolo-rs/surfman)
- **Brave**: [`yolo-rs/brave-browser`](https://github.com/yolo-rs/brave-browser), [`yolo-rs/brave-core`](https://github.com/yolo-rs/brave-core), [`yolo-rs/adblock-rust`](https://github.com/yolo-rs/adblock-rust), [`yolo-rs/brave-search-mcp-server`](https://github.com/yolo-rs/brave-search-mcp-server), [`yolo-rs/adblock-lists`](https://github.com/yolo-rs/adblock-lists), [`yolo-rs/brave-search-skills`](https://github.com/yolo-rs/brave-search-skills), [`yolo-rs/cookiecrumbler`](https://github.com/yolo-rs/cookiecrumbler), [`yolo-rs/adblock-resources`](https://github.com/yolo-rs/adblock-resources), [`yolo-rs/brave-search-cli`](https://github.com/yolo-rs/brave-search-cli), [`yolo-rs/kuchikiki`](https://github.com/yolo-rs/kuchikiki), [`yolo-rs/sta-rs`](https://github.com/yolo-rs/sta-rs), [`yolo-rs/bravebot`](https://github.com/yolo-rs/bravebot)

## License

Apache-2.0 OR MPL-2.0.
