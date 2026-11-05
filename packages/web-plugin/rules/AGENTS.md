# AGENTS.md, Unified Web Brain (`web`)

Guidance for AI agents operating inside the **YOLO-Web** monorepo using the unified **`web`** plugin, CLI, and MCP server.

---

## 1. Golden Rules

1. **The Single Unified Entrypoint**:
   - Always prefer the unified **`web`** CLI and **`web`** MCP server over legacy fragmented scripts (`obscura`, `bx`, `servoshell`).
   - Use `web fetch <url>` for rendering and DOM extraction.
   - Use `web search <query>` and `web context <query>` for private Web grounding.
   - Use `web shields <url>` for adblock-rust rule evaluation.
   - Use `web servo <selector>` for Stylo CSS selector specificity and XPath translation.
   - Use `web info` to inspect runtime status.

2. **100% Upstream Bun: Zero Node.js, Zero Zig**:
   - Upstream Bun v1.4.4+ is **Full Rust (~200 crates in `src/*`) + C++ WebKit/JavaScriptCore + Cranelift AoT compiler (`src/aot`)**. It contains **ZERO Zig** in late 2026.
   - Never run or recommend `node`, `npm`, `npx`, `yarn`, `pnpm`, or `package-lock.json`.
   - Always use `bun <file>`, `bun test`, `bun check`, `bun fmt`, `bun lint`, `bun install`, `bun build --compile`.

3. **Dual-Runtime Enforcement**:
   - **Host Plane**: Executes on Native Bun (WebKit/JSC).
   - **Guest Browser Plane**: Executes on isolated Chromium V8 Isolates (`crates/obscura-js` and `crates/yolo-browser`).
   - Never leak host globals, environment variables (`process.env`), or secret credentials into page V8 contexts.

4. **Performance & Compilation Quality Gates**:
   - Cargo releases must maintain `panic = "unwind"`, `lto = "fat"`, `codegen-units = 1`.
   - Packages declare `"sideEffects": false` to maximize Bun AoT dead-code elimination.
