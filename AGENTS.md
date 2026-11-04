# AGENTS.md — YOLO-Web (`yolo-rs/yolo-web`)

Guidance for AI coding agents and human contributors working in the **YOLO-Web** Cargo + Bun monorepo.

YOLO-Web is a unified Chromium-compatible browser engine in full Rust + Bun for AI Agents and Humans, consolidating **Servo** (`crates/servo-*`), **Obscura** (`crates/obscura*`), and **Brave** (`crates/brave-*`) under the [`yolo-rs`](https://github.com/orgs/yolo-rs/repositories) organization.

## Toolchain Rules

1. **100% Bun — Zero Node.js**:
   - Always use `bun`, `bun test`, `bun check`, `bun fmt`, `bun lint`, `bun install`, `bunx`.
   - Never introduce `node`, `npm`, `npx`, `pnpm`, `yarn`, `package-lock.json`, `node:http`, or `node:child_process`.
   - Use `Bun.serve` for HTTP/WebSocket/SSE servers and `Bun.spawn` for subprocess management.

2. **Cargo Workspace (`crates/*` & `apps/yolo-browser-cli`)**:
   - Scope incremental Rust builds and tests to the target crate (`cargo test -p yolo-browser`, `cargo build -p yolo-browser-cli`, `cargo build --release -p obscura-cli --bins --features render`).
   - Keep `panic = "unwind"` in `[profile.release]` so V8 FFI ops remain panic-safe via `std::panic::catch_unwind`.
   - For crates that instantiate V8 isolates (`obscura-js`, `obscura-browser`, `obscura-cdp`), run multi-test suites via `cargo nextest run` so each test executes in its own process.

## Catalogs & Architectural Specifications

- See [`crates/SERVO_CRATES.md`](crates/SERVO_CRATES.md) for all 31 consolidated Servo crates.
- See [`crates/BRAVE_CRATES.md`](crates/BRAVE_CRATES.md) for all consolidated Brave Rust crates and Shield packages.
- See [`crates/DENO_V8_CRATES.md`](crates/DENO_V8_CRATES.md) for all consolidated Deno & V8 runtime crates.
- See [`crates/BUN_WEBKIT_V8_ARCHITECTURE.md`](crates/BUN_WEBKIT_V8_ARCHITECTURE.md) for the Dual-Runtime Architecture (Plane 1: 100% Native Bun v1.4.4+ Full Rust ~200 crates + C++ WebKit/JSC + Cranelift AoT with zero Zig; Plane 2: 100% Chromium V8 for browser web rendering).
- See [`docs/ULTIMATE_2026_STACK.md`](docs/ULTIMATE_2026_STACK.md) for the 2026 Scraper, Crawler, Browser & AoT/LTO Performance Blueprint.
