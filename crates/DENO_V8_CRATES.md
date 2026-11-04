# Consolidated Deno & V8 Browser Runtime Crates (`crates/deno-*`)

This document catalogs the upstream **Deno (`github.com/denoland`) & Chromium V8 (`rusty_v8`)** repositories forked into [`yolo-rs`](https://github.com/orgs/yolo-rs/repositories), the complete V8 + `deno_core` dependency graph powering `obscura-js` and `yolo-browser`, and the consolidated standalone crates under `crates/deno-*`.

> **Toolchain Purity Guarantee**: Zero Node.js artifacts (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `node_modules`), zero nested `.git` directories, and zero conflicting `[workspace]` or `[profile.*]` tables exist anywhere inside `crates/deno-*`.

---

## 1. Upstream GitHub Forks in `yolo-rs/*`

All 13 essential `denoland/*` & V8 repositories for our browser engine have been forked and verified under the `yolo-rs` organization:

| #   | Upstream Repository                                                       | Stars       | `yolo-rs` Fork URL                                                                         | Monorepo Target / Role                                                                                                                                                                               |
| :-- | :------------------------------------------------------------------------ | :---------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [`denoland/deno`](https://github.com/denoland/deno)                       | ~108,800 ⭐ | [`https://github.com/yolo-rs/deno`](https://github.com/yolo-rs/deno)                       | Reference W3C Web API extensions (`ext/web`, `ext/webidl`, `ext/fetch`, `ext/crypto`, `ext/webgpu`, `ext/canvas`, `ext/websocket`, `ext/webstorage`, `ext/url`, `ext/console`, `ext/net`, `ext/tls`) |
| 2   | [`denoland/rusty_v8`](https://github.com/denoland/rusty_v8)               | ~4,033 ⭐   | [`https://github.com/yolo-rs/rusty_v8`](https://github.com/yolo-rs/rusty_v8)               | `v8` (`v150.4.0`) + `deno_v8` (`v0.4.0`) — Rust bindings to Chromium's V8 JavaScript & WebAssembly engine                                                                                            |
| 3   | [`denoland/fastwebsockets`](https://github.com/denoland/fastwebsockets)   | ~1,138 ⭐   | [`https://github.com/yolo-rs/fastwebsockets`](https://github.com/yolo-rs/fastwebsockets)   | `crates/deno-fastwebsockets` (`fastwebsockets` v0.10.0) — SIMD-accelerated RFC 6455 WebSocket engine for browser `WebSocket` & CDP transport                                                         |
| 4   | [`denoland/deno_core`](https://github.com/denoland/deno_core)             | ~472 ⭐     | [`https://github.com/yolo-rs/deno_core`](https://github.com/yolo-rs/deno_core)             | `crates/deno-core` (`deno_core`, `serde_v8`, `deno_ops`, `deno_unsafecell`, `deno_core_parking_lot`)                                                                                                 |
| 5   | [`denoland/deno_ast`](https://github.com/denoland/deno_ast)               | ~183 ⭐     | [`https://github.com/yolo-rs/deno_ast`](https://github.com/yolo-rs/deno_ast)               | SWC-based JavaScript/TypeScript lexer, AST parser, scope analyzer, and transpiler                                                                                                                    |
| 6   | [`denoland/deno_graph`](https://github.com/denoland/deno_graph)           | ~139 ⭐     | [`https://github.com/yolo-rs/deno_graph`](https://github.com/yolo-rs/deno_graph)           | ES module dependency graph analyzer, dynamic import scanner, and loader                                                                                                                              |
| 7   | [`denoland/import_map`](https://github.com/denoland/import_map)           | ~78 ⭐      | [`https://github.com/yolo-rs/import_map`](https://github.com/yolo-rs/import_map)           | `crates/deno-import-map` (`import_map` v0.25.0) — WICG Import Maps specification for `<script type="importmap">`                                                                                     |
| 8   | [`denoland/deno_error`](https://github.com/denoland/deno_error)           | ~40 ⭐      | [`https://github.com/yolo-rs/deno_error`](https://github.com/yolo-rs/deno_error)           | `crates/deno-error` (`deno_error` v0.7.3 & `deno_error_macro`) — Typed JS/DOM `Error` & `DOMException` mapping across V8 FFI                                                                         |
| 9   | [`denoland/deno_semver`](https://github.com/denoland/deno_semver)         | ~31 ⭐      | [`https://github.com/yolo-rs/deno_semver`](https://github.com/yolo-rs/deno_semver)         | Semantic version parser and range resolver for package & module specifiers                                                                                                                           |
| 10  | [`denoland/deno_media_type`](https://github.com/denoland/deno_media_type) | ~26 ⭐      | [`https://github.com/yolo-rs/deno_media_type`](https://github.com/yolo-rs/deno_media_type) | `crates/deno-media-type` (`deno_media_type` v0.4.0) — MIME & `Content-Type` resolution for `<script>`, `fetch()`, and `data:` URLs                                                                   |
| 11  | [`denoland/deno_unsync`](https://github.com/denoland/deno_unsync)         | ~18 ⭐      | [`https://github.com/yolo-rs/deno_unsync`](https://github.com/yolo-rs/deno_unsync)         | `crates/deno-core/unsync` (`deno_unsync` v0.4.4) — Single-threaded Tokio task queues, `JoinSet`, and unsynchronized primitives for V8 event loops                                                    |
| 12  | [`denoland/deno_path_util`](https://github.com/denoland/deno_path_util)   | ~12 ⭐      | [`https://github.com/yolo-rs/deno_path_util`](https://github.com/yolo-rs/deno_path_util)   | `deno_path_util` (`v0.6.4`) — Cross-platform URL-to-file-path resolution used by `deno_core`                                                                                                         |
| 13  | [`denoland/boxed_error`](https://github.com/denoland/boxed_error)         | ~9 ⭐       | [`https://github.com/yolo-rs/boxed_error`](https://github.com/yolo-rs/boxed_error)         | `boxed_error` (`v0.2.3`) — `#[boxed]` procedural macro keeping error `Result` stack frames pointer-sized in hot V8 op paths                                                                          |

---

## 2. Consolidated Rust Crates in `crates/deno-*`

| #   | Directory (`crates/deno-*`)  | Sub-Crates / Packages                                                                                                                                                                                                                                                                                                             | Version                                                               | Purpose in `yolo-web`                                                                                                                                                                                                                                                                                                         |
| :-- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `crates/deno-core`           | <ul><li>`crates/deno-core/core` (`deno_core`)</li><li>`crates/deno-core/ops` (`deno_ops`)</li><li>`crates/deno-core/serde_v8` (`serde_v8`)</li><li>`crates/deno-core/unsync` (`deno_unsync`)</li><li>`crates/deno-core/unsafecell` (`deno_unsafecell`)</li><li>`crates/deno-core/parking_lot` (`deno_core_parking_lot`)</li></ul> | `0.412.0`<br>`0.288.0`<br>`0.321.0`<br>`0.4.4`<br>`0.2.0`<br>`0.12.5` | Core V8 `JsRuntime` & isolate lifecycle manager, `#[op2]` zero-overhead FFI binding generator, bidirectional Rust↔V8 `serde_v8` serializer, `OpState` resource table, single-threaded Tokio reactor (`deno_unsync`), `RcRef` `UnsafeCell` wrapper, and V8 startup snapshot compiler (`deno_core::snapshot::create_snapshot`). |
| 2   | `crates/deno-error`          | <ul><li>`crates/deno-error` (`deno_error`)</li><li>`crates/deno-error/macros` (`deno_error_macro`)</li></ul>                                                                                                                                                                                                                      | `0.7.3`<br>`0.7.3`                                                    | Maps Rust error enums and structs (`#[derive(JsError)]`) into V8 JavaScript error classes (`TypeError`, `RangeError`, `SyntaxError`, `URIError`, `DOMException`) with `code` and property preservation across `#[op2]` boundaries.                                                                                            |
| 3   | `crates/deno-import-map`     | `crates/deno-import-map` (`import_map`)                                                                                                                                                                                                                                                                                           | `0.25.0`                                                              | Full WICG Import Maps specification (`imports` & `scopes` tables, specifier resolution, prefix matching, and integrity metadata) for browser `<script type="importmap">` in `obscura-js`.                                                                                                                                     |
| 4   | `crates/deno-fastwebsockets` | `crates/deno-fastwebsockets` (`fastwebsockets`)                                                                                                                                                                                                                                                                                   | `0.10.0`                                                              | Autobahn-compliant, SIMD-accelerated (`simdutf8` + AVX2/NEON frame unmasking) RFC 6455 WebSocket protocol engine powering browser `new WebSocket()` and Chrome DevTools Protocol (CDP) frames.                                                                                                                                |
| 5   | `crates/deno-media-type`     | `crates/deno-media-type` (`deno_media_type`)                                                                                                                                                                                                                                                                                      | `0.4.0`                                                               | Fast MIME type (`Content-Type`), `data:` URL, and file extension classification (`JavaScript`, `Mjs`, `TypeScript`, `Wasm`, `Json`, `Css`, `Html`, `SourceMap`) for module loading and `fetch()`.                                                                                                                             |

---

## 3. Complete `obscura-js` V8 + `deno_core` Dependency Graph

From `crates/obscura-js/Cargo.toml` and `Cargo.lock`, `obscura-js` links the following V8 and Deno runtime stack:

```text
obscura-js v0.2.0 (crates/obscura-js)
├── deno_core v0.412.0 (also in [build-dependencies] for OBSCURA_SNAPSHOT.bin generation)
│   ├── deno_v8 v0.4.0
│   │   └── v8 v150.4.0 (rusty_v8 — Chromium V8 15.0 JavaScript & WebAssembly Engine)
│   ├── serde_v8 v0.321.0
│   │   ├── deno_error v0.7.1
│   │   ├── deno_v8 v0.4.0 -> v8 v150.4.0
│   │   ├── num-bigint v0.4.8
│   │   ├── serde v1.0.229
│   │   └── smallvec v1.16.4
│   ├── deno_ops v0.288.0 (proc-macro: #[op2], #[op2(fast)], #[smi], #[string], #[buffer])
│   │   ├── syn v2.0.119 / quote v1.0.47 / proc-macro2 v1.0.107
│   │   ├── syn-match v0.3.1
│   │   └── strum v0.27.2 / strum_macros v0.27.2
│   ├── deno_error v0.7.1
│   │   └── deno_error_macro v0.7.1 (proc-macro: #[derive(JsError)])
│   ├── deno_unsync v0.4.4
│   │   ├── futures-util v0.3.34
│   │   ├── parking_lot v0.12.5
│   │   └── tokio v1.54.1
│   ├── deno_path_util v0.6.4
│   │   └── sys_traits v0.1.29
│   ├── boxed_error v0.2.3 (proc-macro: #[boxed])
│   ├── sourcemap v9.3.2
│   ├── wasm_dep_analyzer v0.4.0
│   ├── cooked-waker v5.0.0
│   └── inventory v0.3.25
└── deno_error v0.7.1
```

### Complementary `denoland/deno` Web API Crates (`yolo-rs/deno/ext/*`)

In [`yolo-rs/deno`](https://github.com/yolo-rs/deno), the `ext/*` workspace crates provide reference WHATWG/W3C implementations built on `deno_core` + `#[op2]`:

| `denoland/deno` Extension | Crate Name             | Spec Coverage & Relationship to `obscura-js`                                                                                                                                                                                              |
| :------------------------ | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ext/webidl`              | `deno_webidl`          | WebIDL type conversions, dictionary coercions, and interface brand checks.                                                                                                                                                                |
| `ext/web`                 | `deno_web`             | `Event`, `EventTarget`, `AbortController`, `TextEncoder`/`TextDecoder`, `Blob`, `File`, `FileReader`, `MessageChannel`, `CompressionStream`, `timers`, ` structuredClone`.                                                                |
| `ext/fetch`               | `deno_fetch`           | WHATWG `fetch()`, `Request`, `Response`, `Headers`, `FormData`. In `obscura-js`, routed through `obscura-net` (with optional `stealth` Chrome TLS/HTTP2 fingerprinting).                                                                  |
| `ext/url`                 | `deno_url`             | WHATWG `URL`, `URLSearchParams`, and `URLPattern`.                                                                                                                                                                                        |
| `ext/console`             | `deno_console`         | WHATWG `console.*` formatting, object inspection, and CDP `Runtime.consoleAPICalled` forwarding.                                                                                                                                          |
| `ext/crypto`              | `deno_crypto`          | W3C Web Cryptography API (`crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID`). Implemented in `obscura-js` using pure-Rust `RustCrypto` (`aes`, `aes-gcm`, `aes-kw`, `cbc`, `ctr`, `hmac`, `hkdf`, `pbkdf2`, `sha1`, `sha2`). |
| `ext/webstorage`          | `deno_webstorage`      | `localStorage` and `sessionStorage` origin-partitioned DOM storage (`obscura-js` also provides full `IndexedDB` in `src/indexed_db.rs` + `js/indexed_db.js`).                                                                             |
| `ext/websocket`           | `deno_websocket`       | Browser `WebSocket` client powered by `fastwebsockets` (`crates/deno-fastwebsockets`).                                                                                                                                                    |
| `ext/canvas`              | `deno_canvas`          | `OffscreenCanvas` and 2D context image decoding (`obscura-js` pairs with `obscura-render` for real layout geometry & PNG rasterization).                                                                                                  |
| `ext/webgpu`              | `deno_webgpu`          | W3C WebGPU (`navigator.gpu`, `GPUAdapter`, `GPUDevice`, WGSL compute/render pipelines via `wgpu`).                                                                                                                                        |
| `ext/net` & `ext/tls`     | `deno_net`, `deno_tls` | TCP/UDP/Unix sockets, DNS resolution, and `rustls` TLS session management.                                                                                                                                                                |

---

## 4. How `rusty_v8` + `deno_core` + `serde_v8` + `deno_ops` Power `yolo-web`

### 4.1 V8 Isolate Lifecycle & Multi-Frame Realms (`crates/obscura-js/src/runtime.rs` & `frame.rs`)

- Each browser page or frame creates a single-threaded `deno_core::JsRuntime` backed by an isolated `v8::Isolate` from `rusty_v8` (`v8 v150.4.0`).
- `crates/obscura-js/src/v8_flags.rs` configures V8 engine flags before platform initialization, while `crates/obscura-js/src/cdp_watchdog.rs` attaches a V8 `IsolateHandle` watchdog timer that safely terminates runaway script execution (` IsolateHandle::terminate_execution()`) without corrupting the host process.
- `[profile.release]` in root `Cargo.toml` enforces `panic = "unwind"` so any Rust panic inside an `#[op2]` callback is caught via `std::panic::catch_unwind` before crossing the C++ V8 FFI stack frame.

### 4.2 Build-Time V8 Heap Snapshots (`crates/obscura-js/build.rs`)

- During compilation, `crates/obscura-js/build.rs` executes `deno_core::snapshot::create_snapshot` over `js/bootstrap.js` and `js/indexed_db.js`.
- It pre-compiles DOM prototypes (`Node`, `Element`, `Document`, `HTMLImageElement`, `Response`, `Headers`, `URL`) and warms V8 inline caches (`%EnsureFeedbackVectorForFunction`) into `OBSCURA_SNAPSHOT.bin`.
- For cross-compilation (e.g., `x86_64` host targeting `aarch64` Android/Linux), `build.rs` extracts the architecture-independent `deno_core` snapshot sidecar from the host snapshot and combines it with the target-architecture V8 heap blob emitted by `cross-mksnapshot`.

### 4.3 Zero-Overhead `#[op2]` FFI & `serde_v8` (`crates/obscura-js/src/ops.rs`)

- `deno_ops` (`#[op2]` / `#[op2(fast)]`) generates V8 C-Call (`v8::fast_api`) and standard FFI bindings connecting JavaScript DOM/Web API calls in `js/bootstrap.js` directly to `obscura-dom` (`Arena`, `NodeId`), `obscura-net`, and `obscura-render`.
- Primitive arguments (`#[smi]`, `#[number]`, `#[string]`, `#[buffer]`) bypass heap serialization completely via V8 Fast API calls; structured payloads (`fetch` options, IndexedDB records, CSS box geometry) serialize directly between Rust structs and `v8::Local<v8::Value>` via `serde_v8` without intermediate JSON string allocation.
- `deno_error` (`#[derive(JsError)]`) translates Rust errors into standard browser `DOMException` and `TypeError` instances on the V8 stack.

### 4.4 ES Modules & WICG Import Maps (`crates/obscura-js/src/module_loader.rs` & `import_map.rs`)

- `deno_core::ModuleLoader` drives asynchronous `<script type="module">` and dynamic `import()` fetching through `obscura-net`, validating MIME types (`deno-media-type`) and resolving bare specifiers through WICG Import Maps (`deno-import-map`).
