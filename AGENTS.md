# AGENTS.md — YOLO-Web (`yolo-rs/yolo-web`)

Guidance for AI coding agents and human contributors working in the **YOLO-Web** Cargo + Bun monorepo.

YOLO-Web is a cross-platform browser research and orchestration monorepo. It contains Bun applications and packages, a Rust workspace with Servo-derived/Obscura/Brave/Deno-derived crates, and a CDP workbench. The native Chromium `content/` embedder is planned work; the actual Chromium source checkout is managed separately with `depot_tools`.

## Toolchain Rules

1. **100% Bun — Zero Node.js**:
   - Always use `bun`, `bun test`, `bun check`, `bun fmt`, `bun lint`, `bun install`, `bunx`.
   - Never introduce `node`, `npm`, `npx`, `pnpm`, `yarn`, `package-lock.json`, `node:http`, or `node:child_process`.
   - Use `Bun.serve` for HTTP/WebSocket/SSE servers and `Bun.spawn` for subprocess management.

2. **Cargo Workspace (`crates/*` & `apps/yolo-browser-cli`)**:
   - Scope incremental Rust builds and tests to the target crate (`cargo test -p yolo-browser`, `cargo build -p yolo-browser-cli`, `cargo build --release -p obscura-cli --bins --features render`).
   - Keep `panic = "unwind"` in `[profile.release]` so V8 FFI ops remain panic-safe via `std::panic::catch_unwind`.
   - For crates that instantiate V8 isolates (`obscura-js`, `obscura-browser`, `obscura-cdp`), run multi-test suites via `cargo nextest run` so each test executes in its own process.
   - Build the Chromium browser shell with `cargo build -p yolo-chromium`. The first build downloads the pinned CEF binary distribution (about 175 MB) into `.cef/` through `CEF_PATH` in `.cargo/config.toml` and compiles `libcef_dll_wrapper` with CMake, Ninja, and MSVC; the cache is git-ignored. Never vendor or commit the CEF distribution.

## Catalogs & Architectural Specifications

- See [`docs/ARCHITECTURE.mdx`](docs/ARCHITECTURE.mdx) for the current/target boundaries between Chromium, Rust crates, Bun applications/packages, C++, and third-party sources.
- See [`docs/STYLE_GUIDE.mdx`](docs/STYLE_GUIDE.mdx) for local language, naming, licensing, and cross-platform conventions.
- See [`crates/SERVO_CRATES.md`](crates/SERVO_CRATES.md) for all 31 consolidated Servo crates.
- See [`crates/BRAVE_CRATES.md`](crates/BRAVE_CRATES.md) for all consolidated Brave Rust crates and Shield packages.
- See [`crates/DENO_V8_CRATES.md`](crates/DENO_V8_CRATES.md) for all consolidated Deno & V8 runtime crates.
- `crates/BUN_WEBKIT_V8_ARCHITECTURE.md` and `docs/ULTIMATE_2026_STACK.md` are legacy/aspirational references. Verify their claims against code and upstream sources; they do not define current engine capabilities.

## Platform and source boundaries

- Windows 11 and Linux x64 are first-class development hosts. Do not hardcode a user's workspace, home, drive, or tool install path.
- Resolve Chromium and depot_tools roots from explicit CLI arguments or `CHROMIUM_ROOT` / `DEPOT_TOOLS_ROOT`.
- Keep Chromium source and `src/third_party` in the separate official `depot_tools` checkout. Do not manually vendor Chromium's dependency tree into this repository.
- Apply the Bun-only rule to YOLO-Web-owned JavaScript/TypeScript. Imported upstream tooling keeps the upstream build/runtime it requires unless it is deliberately ported with provenance.

---

## Autonomous NHITL Agent & Context / Token Optimization Best Practices (24/7 Operations)

### 1. Context Window & Token Optimization
- **High-Precision Targeting**: Never dump large raw files into the model context. Use exact byte/line range reads or AST/symbol lookups.
- **Zero-Polling Reactive Wakeup**: When launching background tasks or subagents, do not poll in loops. Yield execution immediately and wait for reactive system events.
- **Compact & High Information Density**: Output concise, fact-based reports with clickable markdown file links (`[file.ext](file:///path/to/file)`). Do not narrate obvious actions.
- **Strict Zero-Emoji Policy**: Zero emojis in all code, comments, commit messages, PRs, logs, and agent communications.

### 2. Autonomous Execution (NHITL - No Human In The Loop)
- **Continuous Grind & Auto-Goal**: Independently identify objectives, resolve compile errors, apply fixes, format (`bun fmt`), lint (`bun lint`), typecheck (`bun check`), test (`bun test` / `cargo test`), commit, and push.
- **Pure Tech Stack**: 100% Upstream Bun v1.4.4+, Rust 2024, Python uv v0.13.7+, Go 1.27+. Zero Node.js, npm, yarn, or pnpm.
- **Strict Isolation & Safe Execution**: Heavy Rust builds run on vps (12 cores) with sccache under shared lock; web and fast tests run on bunos or local Bun.
