# Engine matrix

Status date: 2026-11-05. Every number is tagged **measured** (receipt in `docs/receipts/`), **quoted** (upstream URL, retrieved the same day) or **missing**. Host: Windows 11 x64 PC unless stated. Reproduction scripts live in `C:\src\yolo-ai\scripts\browser\` and `scripts\cluster\`.

## What runs

| Engine | Version | Endpoint | Protocol | How it is built or obtained | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome (system) | 157.0.8103.38 | 9222 | CDP | vendor binary | runs, recon OK, web-mcp OK | measured: `cluster-20261105.txt`, `obscura-mcp-2026-11-05.txt` (engines-check) |
| Edge Canary | 159.0.4382.0 | 9223 | CDP | vendor binary | runs, recon OK | measured: same |
| CEF shell (`crates/yolo-chromium`) | CEF 156.0.15, Chromium 156.0.8078.80, V8 15.6.75.27 | 9333 | CDP | `cargo build -p yolo-chromium` against pinned binary distribution | built and ran on 2026-11-04 | measured: `engines/cef.lock.json` |
| Obscura | 0.2.0-dev (reports Chrome/145 UA) | 9225 | CDP | `cargo build --release -p obscura-cli --features render`, workspace `release` profile, sccache bypassed | runs; web-mcp navigate, evaluate, markdown, links verified after the attach fix | measured: `obscura-mcp-2026-11-05.txt` |
| Lightpanda | 1.1.0-nightly | 9226 (vps, ssh-tunnelled) | CDP | upstream binary on vps (no Windows build) | ran on 2026-11-05; tunnel was down at last check | measured: `cluster-20261105.txt`; down at `obscura-mcp-2026-11-05.txt` |
| Firefox Nightly | 161.0a1 | 9224 | WebDriver BiDi only (no CDP) | vendor binary | `session.status` ready on 2026-11-05; down at last check | measured: `cluster-20261105.txt` |
| Servo | 0.7.0 (UA `Servo/0.7.0 Firefox/153.0`) | 7002 | W3C WebDriver (no CDP) | **upstream release binary** `servo-x86_64-windows-msvc.zip`, sha256 verified, not built by YOLO | runs headless; session, navigate, title, execute verified | measured: `servo-webdriver-2026-11-05.txt` |

Servo has no CDP server. `packages/servo-bridge/src/webdriver.ts` (`ServoWebDriver`) drives it; web-mcp is CDP-only and is not wired to Servo. Servo service: `scripts/cluster/service.ps1 servo` (`yolo-servo` scheduled task).

## Servo build state

- yolo-web `crates/servo-*` are library components only; there is no `servoshell` crate in this workspace.
- Local source build on this PC: **not attempted**. Upstream needs the vendored source (378 MB quoted from the v0.7.0 release assets), MozJS/SpiderMonkey, clang and a `production` profile with fat LTO and `codegen-units = 1` (quoted: servo `Cargo.toml` v0.7.0), which risks freezing the PC. Blocker: time and memory, not a known incompatibility.
- Remote build: started 2026-11-05T03:11Z on vps (12 cores, 45 GB, rustc 1.97.1 as pinned by `rust-toolchain.toml`) by `scripts/browser/servo-vps-build.sh`: `nice -n 19 ionice -c3 cargo +1.97.1 build -p servoshell --profile production`, `CARGO_BUILD_JOBS=4`, user level, no sudo or apt. Log: `~/yolo-build/servo-v0.7.0.log` on vps; check with `servo-vps-status.sh`. Result: **missing** until that log shows `Finished`. Possible failure: `libunwind` development files are absent (`libunwind-dev`), and installing them needs apt, which was deliberately not done on the shared host.
- Do not use the VPS build output as a Windows artifact; it is a Linux x86_64 binary.

## Build flags

| Component | LTO | codegen-units | opt-level | panic | strip |
| --- | --- | --- | --- | --- | --- |
| yolo-web workspace `release` | fat | 1 | 3 | `unwind` (required: V8 `#[op2]` FFI uses `catch_unwind`) | no |
| `release-fast` | thin | 4 | 3 | unwind | no |
| `release-dist` | fat | 1 | 3 | unwind | symbols |
| Servo upstream `production` (quoted) | fat | 1 | `s` | upstream default | no (`production-stripped` strips) |
| Bun 1.4 runtime (yolo-bun docs, quoted) | ThinLTO | n/a | n/a | n/a | n/a |

The yolo-web `release` profile already matches the fat LTO, single codegen unit, unwind combination. No profile change was made: there is no measured receipt that thin LTO or a different `opt-level` improves or preserves Obscura, so changing it would be a guess. Add a benchmark receipt before touching it.

### Bun AOT (measured: `bun-aot-2026-11-05.txt`)

`bun build --compile --aot` (Bun 1.4.4-canary.1) built both entry points:

| Entry | Result |
| --- | --- |
| `packages/web-mcp/src/index.ts` | AOT build OK, 82.3 MiB; `initialize` over stdio returns server info. 5 type errors in `@yolo-web/brave-shields` make that package compile without types (slower, still correct). Regex warnings from `ajv` mean those run in the interpreter. |
| `packages/web-cluster/src/coordinator.ts` | AOT build OK after typing `Bun.serve<{ role: string }>`; the coordinator executable was **not** run in a smoke test. |

No AOT-versus-JIT speed claim is made; no benchmark exists. Outputs go to `.aot/` (git-ignored).

## Version alignment with Chrome upstream (receipt: `chrome-cef-versions-2026-11-05.json`)

- Chrome for Testing stable: 157.0.8103.38 (quoted, `last-known-good-versions.json`, retrieved 2026-11-05). Beta 158.0.8127.18, Canary 159.0.8143.0.
- Newest CEF Windows x64 **stable** in the CEF builds index: 156.0.15 (Chromium 156.0.8078.80); newest **beta**: 156.0.7. The index has no 157 build. The pin in `engines/cef.lock.json` is therefore already the newest CEF that exists; it trails Chrome stable by one milestone and cannot be advanced until Spotify's CEF index publishes 157. Nothing was downloaded.
- The local Chromium checkout is 159.0.8143.0 (see [ENGINE_COMPONENT_ALIGNMENT](ENGINE_COMPONENT_ALIGNMENT.mdx)).

## Skia, V8, Blink, CEF status

| Component | Vendored or referenced | Version | Notes |
| --- | --- | --- | --- |
| Blink, Skia, V8 (Chromium product) | referenced: separate depot_tools checkout via `CHROMIUM_ROOT` | Chromium 159.0.8143.0; V8 `5e87028b`, Skia `d65f91e3` (quoted from the checkout's `DEPS`, per ENGINE_COMPONENT_ALIGNMENT, not re-verified today) | Not built by this repository. |
| V8 inside CEF | prebuilt in the CEF distribution | 15.6.75.27 | measured from `/json/version` in `cef.lock.json`. |
| V8 inside Obscura | vendored `crates/deno-core`, `v8` crate | 14.5 reported by `/json/version`; `v8 = 150.4.0` crate per alignment doc | Different V8 from Chromium and CEF. |
| Skia in Rust | `tiny-skia` in `obscura-render`; no `skia-safe` | n/a | CPU raster only; no Chromium canvas parity. |
| Blink | not vendored | n/a | Only through Chrome/Edge/CEF. |
| Servo stack | `crates/servo-*` libraries (WebRender, Stylo, html5ever...) | pinned per crate | Libraries only; runnable Servo is the upstream release binary. |

## What is not achievable here (honest)

- "Full Chromium in Rust": Chromium (Blink, V8, Skia) is C++; the Rust surface is the CEF binding (`cef` crate) and Obscura/Servo are different engines. No Rust reimplementation exists.
- Chrome 157 via CEF: blocked on CEF publishing it.
- Servo with CDP: Servo exposes WebDriver and a devtools (Firefox RDP) port, not CDP.
- Locally built Servo with LTO: pending the VPS build (Linux only) or a Windows build not attempted.