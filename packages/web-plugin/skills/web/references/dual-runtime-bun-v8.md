# Dual-Runtime Architecture: Host Bun (WebKit/JSC) + Guest Browser (Chromium V8)

## 1. Executive Summary

YOLO-Web pairs the best JavaScript/TypeScript engine for host-side tooling (**Upstream Bun v1.4.4+ in Full Rust + WebKit/JSC**) with the standard engine for web page execution (**Chromium V8**).

```
+-----------------------------------------------------------------------------------+
|                           YOLO-WEB UNIFIED BROWSER ENGINE                         |
+-----------------------------------------+-----------------------------------------+
| PLANE 1: HOST RUNTIME (100% Native Bun) | PLANE 2: GUEST BROWSER (Chromium V8)    |
|                                         |                                         |
| - Runtime: Bun v1.4.4+ (oven-sh/bun)    | - Runtime: Chromium V8 (rusty_v8/deno)  |
| - Implementation: Full Rust (~200       | - Implementation: C++ V8 engine         |
|   crates) + C++ WebKit/JSC + Cranelift  |   embedded via obscura-js & deno_core   |
|   AoT compiler (src/aot)                | - Isolation: Process & Isolate boundary |
| - Zig: 0% (Zero Zig in late 2026)       | - Scope: Web page scripts, DOM events,  |
| - Node.js: 0% (Zero Node.js)            |   React/Next/Vue hydration, CDP eval    |
| - Scope: CLI, Bun.serve, Bun.spawn,     | - Invariant: Zero access to host Bun,   |
|   MCP server, file I/O, build & AoT     |   no process.env, zero secret leakage   |
+-----------------------------------------+-----------------------------------------+
                                      │
                                      ▼
                        [@yolo-web/bun-v8-bridge]
             Watchdog Timers | Argument Sanitization | Watchdog Budgets
```

## 2. Invariants & Security Boundaries

1. **Pure Upstream Bun v1.4.4+**:
   - Upstream Bun is 100% Full Rust in `src/*` with C++ WebKit/JSC glue and Cranelift AoT compiler. It contains **ZERO Zig** in late 2026.
   - All monorepo scripts, test runners, formatters, and compilers use Bun (`bun test`, `bun fmt`, `bun lint`, `bun check`, `bun build --compile`).
2. **Chromium V8 Integrity**:
   - In-page JavaScript (guest code) executes exclusively inside Chromium V8 isolates (`obscura-js`).
   - Guest scripts never observe Host Bun APIs (`Bun.serve`, `Bun.spawn`, `Bun.file`), file system handles, or OS credentials.
3. **Panic Safety**:
   - Cargo release profiles preserve `panic = "unwind"` so V8 FFI ops caught via `std::panic::catch_unwind` do not abort the process.
