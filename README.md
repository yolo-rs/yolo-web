# YOLO-Web

YOLO-Web owns browser engines, CDP control, browser APIs, media capture, and browser research tools in Rust and Bun. It is **not currently a full Chromium, Blink, WebKit, or Firefox implementation**. The human-browser service controls a separately running browser through the Chrome DevTools Protocol (CDP); its frontend is owned by [yolo-ui](https://github.com/yolo-rs/yolo-ui). The Rust workspace contains Servo-derived components, Obscura/V8 experiments, and browser support libraries; those crates do not add up to Chromium web-platform parity. `crates/yolo-chromium` runs upstream Chromium through the official CEF (Chromium Embedded Framework) binary distribution as a native shell with the sandbox enabled; it is a downloaded Chromium 156 engine with a Rust control plane, not a Chromium source build (see [Chromium browser shell](#chromium-browser-shell-yolo-chromium)).

The canonical ownership map is [ARCHITECTURE.mdx](docs/ARCHITECTURE.mdx), with local conventions in [STYLE_GUIDE.mdx](docs/STYLE_GUIDE.mdx). The long-term engine rewrite and upstream integration strategy is recorded in [ENGINE_REWRITE_PLAN.md](docs/ENGINE_REWRITE_PLAN.md). For the current CDP workbench, see [BROWSER_ENGINE_MANAGER.md](docs/BROWSER_ENGINE_MANAGER.md) and [WINDOWS_BROWSER_TOOLCHAIN.md](docs/WINDOWS_BROWSER_TOOLCHAIN.md). Windows/MSVC qualification and Rust cross-compilation are owned by [yolo-cross](https://github.com/yolo-rs/yolo-cross).

## Current workspace

- `apps/human-browser` — Bun CDP service for navigation, JavaScript evaluation, status, and screenshot streaming. Its UI is `apps/yolo-browser-workbench` in yolo-ui.
- `apps/ai-agent-runner` — browser-agent runner.
- `packages/cdp-client` — Bun WebSocket/HTTP client for CDP.
- `packages/web-cli` and `packages/web-mcp` — browser tooling CLI and MCP server.
- `packages/chromium-tracker` — Chromium release tracking and the initial browser engine catalog.
- `crates/yolo-chromium` — CEF-based Chromium browser shell: launcher, bootstrap host, Chrome-style Views window, and smoke receipt; see [crates/yolo-chromium/README.md](crates/yolo-chromium/README.md).
- `crates/servo-*` — Rust components derived from Servo; feature coverage varies by crate.
- `crates/obscura-*` — Rust/V8 browser experiments and protocol/runtime components.
- `crates/brave-*`, `crates/deno-*` — browser-adjacent libraries and runtime integrations.

The directory names and dependency manifests describe the code present; they do not claim that upstream browser projects have been merged into this repository. Chromium's Blink, V8, Skia, Dawn, `content/`, `chrome/`, `third_party/`, GN build graph, and `DEPS` checkout are not vendored here today. The CEF distribution that `yolo-chromium` runs is downloaded into the git-ignored `.cef/` cache at build time; it is not vendored either.

## Develop

Install workspace dependencies and run the browser service:

```sh
bun install
bun run dev
```

The service expects a CDP-compatible browser endpoint, defaulting to `127.0.0.1:9222`, and listens for its API/media clients on `127.0.0.1:8080`. Configure `YOLO_CDP_PORT` and `YOLO_HTTP_PORT` to change those ports. To run the frontend, set `YOLO_WEB_API_URL=http://127.0.0.1:8080` in the yolo-ui checkout and run `bun --filter @yolo-rs/browser-workbench dev`; it serves the page at `127.0.0.1:8081` and proxies API and media requests to this service.

Run the focused checks for the components you changed:

```sh
bun test apps/human-browser/src/server.test.ts packages/cdp-client/src/index.test.ts
cargo test -p yolo-browser
```

For V8 isolate crates, use `cargo nextest run -p <crate>` so each test suite
gets a separate process. Avoid workspace-wide Rust builds during an incremental
edit loop.

The repo-wide `bun check` currently reports existing TypeScript errors across multiple packages; see the command output before treating it as a passing gate.

## Chromium browser shell (yolo-chromium)

`crates/yolo-chromium` is the YOLO-Web-owned CEF engine adapter and browser shell. It runs the official CEF binary distribution `156.0.15+gcf671c0+chromium-156.0.8078.80` (Chromium `156.0.8078.80`) in the Chrome runtime style with the Views framework: Chrome toolbar, omnibox, DevTools, and popups as new windows. On Windows the shell is a `cdylib` loaded by CEF's `bootstrap.exe`/`bootstrapc.exe`, which keeps Chromium's sandbox enabled; the Rust `yolo-chromium` binary is a launcher that prepares the runtime directory and forwards Chromium switches. The separately pinned Chromium `159.0.8143.0` source checkout in `engines/chromium.lock.json` is not what runs; a source-built CEF from that checkout is future work.

```sh
cargo build -p yolo-chromium   # first build downloads about 175 MB of CEF into .cef/ and compiles the wrapper
cargo run -p yolo-chromium -- --url=https://example.com
cargo run -p yolo-chromium -- --smoke --url=chrome://version/ --receipt=engines/cef.lock.json
```

`just chromium-build`, `just chromium-run <url>` (defaults to `https://example.com`), `just chromium-smoke`, and the `bun run chromium:*` scripts wrap the same commands. CMake, Ninja, and the MSVC Build Tools are required on Windows. The smoke run writes the engine receipt `engines/cef.lock.json` (build and runtime CEF/Chromium versions, API hash, sandbox state, load outcome); that receipt is the evidence for the shell, not this paragraph. Details: [crates/yolo-chromium/README.md](crates/yolo-chromium/README.md), [docs/CEF_ADAPTER_BOUNDARY.mdx](docs/CEF_ADAPTER_BOUNDARY.mdx), and the CEF notes in [WINDOWS_BROWSER_TOOLCHAIN.md](docs/WINDOWS_BROWSER_TOOLCHAIN.md).

## Upstream project references

- [Chromium source and build guide](https://chromium.googlesource.com/chromium/src/+/main/docs/get_the_code.md)
- [Chromium source directory architecture](https://www.chromium.org/developers/how-tos/getting-around-the-chrome-source-code/)
- [Blink](https://www.chromium.org/blink/)
- [Dawn](https://dawn.googlesource.com/dawn)
- [Skia](https://docs.skia.org/docs/user/build/)
- [Servo Book](https://book.servo.org/)
- [WebKit documentation](https://docs.webkit.org/)
- [Firefox source documentation](https://firefox-source-docs.mozilla.org/)
