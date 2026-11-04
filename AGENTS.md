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

3. **Catalogs**:
   - See [`crates/SERVO_CRATES.md`](crates/SERVO_CRATES.md) for all 31 consolidated Servo crates.
   - See [`crates/BRAVE_CRATES.md`](crates/BRAVE_CRATES.md) for all consolidated Brave Rust crates and Shield packages.
