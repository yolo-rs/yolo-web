# YOLO-Web (`yolo-rs/yolo-web`)

**Unified Chromium-Compatible Browser Engine & Monorepo in Full Rust + Bun for AI Agents and Humans.**

Consolidated from three open-source browser engines under **[`github.com/orgs/yolo-rs`](https://github.com/orgs/yolo-rs/repositories)**:

1. **[Servo](https://github.com/yolo-rs/servo)** (`crates/servo-*`) — High-performance W3C HTML5/XML5 parsers (`html5ever`, `markup5ever`, `xml5ever`), Stylo CSS3 & selector engine (`cssparser`, `selectors`, `servo_arc`, `stylo`), WebRender & Pathfinder GPU/CPU graphics (`webrender`, `pathfinder`), 2D/3D geometry (`euclid`), IPC (`ipc-channel`), font loading (`font-kit`), GPU surfaces (`surfman`), sandboxing (`gaol`), SVG (`servo-svg`), XPath (`servo-xpath`), WebVTT (`servo-webvtt`), and fast stack collections (`smallvec`, `tendril`, `uluru`, `fnv`, `string_cache`).
2. **[Obscura](https://github.com/yolo-rs/obscura)** (`crates/obscura*`) — Real V8 JavaScript runtime (`deno_core`), high-speed DOM tree, Taffy + Cosmic-Text + Tiny-Skia layout/rasterizer, Chrome DevTools Protocol (CDP) WebSocket server (`obscura-cdp`), Model Context Protocol (MCP) server (`obscura-mcp`), stealth TLS/HTTP2 fingerprint emulation (`obscura-net`), and SSRF protection (`obscura-ssrf`).
3. **[Brave](https://github.com/yolo-rs/adblock-rust)** (`crates/brave-*`) — Native Rust Adblock & Shields engine (`adblock-rust` + `adblock-lists` + `adblock-resources` + `cookiecrumbler`), `kuchikiki` HTML tree manipulation, `brave-search-cli` (`bx`), `sta-rs` privacy-preserving telemetry, and `bravebot-core` prompt-injection resistance.

All JavaScript/TypeScript tooling, SDKs, MCP servers, and interactive human/AI browser applications run on **100% native Upstream Bun (`v1.4.4+`)** with **zero Node.js dependencies**.

---

## Monorepo Architecture

```text
yolo-web/
├── Cargo.toml                  # Unified Rust workspace (52 workspace member crates)
├── package.json                # Unified Bun workspace (apps/* + packages/*)
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
│   └── brave-search-mcp/       # @yolo-web/brave-search-mcp — Pure Bun Brave Search MCP server
├── crates/
│   ├── yolo-browser/           # Unified Rust browser engine integrating Servo + Obscura + Brave
│   ├── obscura*/               # 10 Obscura crates (browser, cdp, cli, dom, js, mcp, net, render, ssrf, sdk)
│   ├── servo-*/                # 31 Servo crates (html5ever, cssparser, stylo, webrender, pathfinder, euclid, ...)
│   └── brave-*/                # 5 Brave crates (brave-adblock, brave-kuchikiki, brave-search-cli, brave-star, brave-bot)
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

# Run the Live CDP Viewport Streamer
bun run live-view
```

### 2. Rust Workspace (`crates/*` & `apps/yolo-browser-cli`)

```bash
# Inspect the consolidated Servo + Obscura + Brave engine manifest
cargo run -p yolo-browser-cli -- info

# Query an HTML document using Servo html5ever + Obscura DOM + Uluru LRU cache
cargo run -p yolo-browser-cli -- query --html "<main><button class='cta'>Go</button></main>" --selector ".cta"

# Check a network URL against Brave Shields (adblock-rust) and Obscura SSRF protection
cargo run -p yolo-browser-cli -- shield-check --url "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"

# Build release binaries with full rendering and stealth support
CARGO_INCREMENTAL=0 CARGO_BUILD_JOBS=2 cargo build --release -p obscura-cli -p yolo-browser-cli --bins --features render,stealth
```

---

## `yolo-rs` Organization Repositories

All upstream forks are hosted cleanly under **[`https://github.com/orgs/yolo-rs/repositories`](https://github.com/orgs/yolo-rs/repositories)**:

- **Core Monorepo**: [`yolo-rs/yolo-web`](https://github.com/yolo-rs/yolo-web)
- **Obscura**: [`yolo-rs/obscura`](https://github.com/yolo-rs/obscura)
- **Servo**: [`yolo-rs/servo`](https://github.com/yolo-rs/servo), [`yolo-rs/pathfinder`](https://github.com/yolo-rs/pathfinder), [`yolo-rs/webrender`](https://github.com/yolo-rs/webrender), [`yolo-rs/html5ever`](https://github.com/yolo-rs/html5ever), [`yolo-rs/rust-smallvec`](https://github.com/yolo-rs/rust-smallvec), [`yolo-rs/rust-url`](https://github.com/yolo-rs/rust-url), [`yolo-rs/ipc-channel`](https://github.com/yolo-rs/ipc-channel), [`yolo-rs/rust-cssparser`](https://github.com/yolo-rs/rust-cssparser), [`yolo-rs/font-kit`](https://github.com/yolo-rs/font-kit), [`yolo-rs/euclid`](https://github.com/yolo-rs/euclid), [`yolo-rs/gaol`](https://github.com/yolo-rs/gaol), [`yolo-rs/rust-fnv`](https://github.com/yolo-rs/rust-fnv), [`yolo-rs/stylo`](https://github.com/yolo-rs/stylo), [`yolo-rs/tendril`](https://github.com/yolo-rs/tendril), [`yolo-rs/uluru`](https://github.com/yolo-rs/uluru), [`yolo-rs/string-cache`](https://github.com/yolo-rs/string-cache), [`yolo-rs/surfman`](https://github.com/yolo-rs/surfman)
- **Brave**: [`yolo-rs/brave-browser`](https://github.com/yolo-rs/brave-browser), [`yolo-rs/brave-core`](https://github.com/yolo-rs/brave-core), [`yolo-rs/adblock-rust`](https://github.com/yolo-rs/adblock-rust), [`yolo-rs/brave-search-mcp-server`](https://github.com/yolo-rs/brave-search-mcp-server), [`yolo-rs/adblock-lists`](https://github.com/yolo-rs/adblock-lists), [`yolo-rs/brave-search-skills`](https://github.com/yolo-rs/brave-search-skills), [`yolo-rs/cookiecrumbler`](https://github.com/yolo-rs/cookiecrumbler), [`yolo-rs/adblock-resources`](https://github.com/yolo-rs/adblock-resources), [`yolo-rs/brave-search-cli`](https://github.com/yolo-rs/brave-search-cli), [`yolo-rs/kuchikiki`](https://github.com/yolo-rs/kuchikiki), [`yolo-rs/sta-rs`](https://github.com/yolo-rs/sta-rs), [`yolo-rs/bravebot`](https://github.com/yolo-rs/bravebot)

## License

Apache-2.0 OR MPL-2.0.
