# yolo-chromium

Upstream Chromium browser shell for YOLO-Web: a Rust control plane over the
official CEF (Chromium Embedded Framework) binary distribution.

Status: current on Windows x64. Linux x64 is supported by the same crates but
has not been qualified in this repository. The ownership boundary with yolo-ui
and the integration gate are defined in
[`docs/CEF_ADAPTER_BOUNDARY.mdx`](../../docs/CEF_ADAPTER_BOUNDARY.mdx).

## What it is and is not

- It runs upstream Chromium `156.0.8078.80` as packaged by CEF
  `156.0.15+gcf671c0+chromium-156.0.8078.80`. The engine is downloaded at build
  time; nothing in this crate builds Chromium from source.
- The separately pinned Chromium `159.0.8143.0` source checkout recorded in
  [`engines/chromium.lock.json`](../../engines/chromium.lock.json) is not what
  runs. Producing a CEF build from that checkout (CEF `automate-git.py`) is
  future work.
- It is not a `content/` embedder. The window, toolbar, omnibox, DevTools, and
  popup windows come from CEF's Chrome runtime style and the Views framework.
- Chromium's sandbox stays enabled. On Windows that is why the shell is a DLL
  loaded by CEF's bootstrap executable (see "Runtime model").

## Layout

| Path          | Role                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cargo.toml`  | Package `yolo-chromium`; library `yolo_chromium` built as `lib` and `cdylib`; binary `yolo-chromium`; default feature `sandbox` maps to `cef/sandbox`.      |
| `src/lib.rs`  | Shell library root; modules: `entry` (process entry points, `RunWinMain` / `RunConsoleMain` exports on Windows), `shell` (CEF app, client handlers, Views delegates, smoke mode), `config`, `version`, `receipt`, `cdp`, `engine_info`. |
| `src/main.rs` | Launcher binary (`src/launcher/`): prepares the runtime directory, copies the host executable and the DLL, spawns the host with the forwarded switches, and probes DevTools for the receipt.                                      |

Dependencies: `cef = "156.3.0"` (crates.io, from
[`tauri-apps/cef-rs`](https://github.com/tauri-apps/cef-rs)) with its
`cef-dll-sys` build script, `serde`, `serde_json`, and `windows-sys` on
Windows. No Tauri or windowing crate is in the graph.

## Prerequisites

- The workspace Rust toolchain.
- CMake and Ninja on `PATH`. `cef-dll-sys` configures CEF's
  `libcef_dll_wrapper` with the Ninja generator, the `RelWithDebInfo` profile,
  `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`, and `USE_SANDBOX=ON` while the
  default `sandbox` feature is enabled.
- Windows: MSVC Build Tools with the C++ desktop workload and a Windows SDK.
  The compiler is discovered through the standard Visual Studio locator; a
  Developer PowerShell is the simplest way to guarantee that `cl.exe` and
  `link.exe` are found.
- Network access on the first build to download the CEF archive (about
  175 MB) from the official CEF index.

## Build, run, smoke

```sh
cargo build -p yolo-chromium
cargo run -p yolo-chromium -- --url=https://example.com
cargo run -p yolo-chromium -- --smoke --url=chrome://version/ --receipt=engines/cef.lock.json
```

Repository shortcuts: `just chromium-build`, `just chromium-run <url>` (the
URL is a positional argument defaulting to `https://example.com`),
`just chromium-smoke`, and `bun run chromium:build`, `bun run chromium:run`,
`bun run chromium:smoke`.

The first build downloads the archive into `.cef/` and compiles the wrapper;
expect about four minutes on a development workstation. Later builds reuse the
cache. `--engine-version` prints the build-time engine description as JSON
without initializing CEF.

## Launcher flags

The Rust binary `yolo-chromium` is the launcher. It understands these flags and
forwards everything else to the host.

| Flag                           | Meaning                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--engine-version`             | Print the build-time engine description as JSON and exit without initializing CEF.                                                                               |
| `--prepare-runtime`            | Prepare the runtime directory and exit without launching the host.                                                                                               |
| `--runtime-dir=<dir>`          | Runtime directory to prepare and launch from. Default: `<target>/debug/yolo-chromium-runtime/` for a debug build.                                                |
| `--cef-dir=<dir>`              | CEF distribution directory to copy the runtime files from.                                                                                                       |
| `--host=bootstrapc\|bootstrap` | Which CEF bootstrap executable to copy as `yolo-chromium.exe`: console (`bootstrapc`, exports `RunConsoleMain`) or windowed (`bootstrap`, exports `RunWinMain`). |
| `--launcher-timeout-ms=<n>`    | Maximum time the launcher waits for the host process.                                                                                                            |
| `--help`                       | Print launcher and shell usage.                                                                                                                                  |

## Shell and host flags

These flags are consumed by the shell inside the host process. Any other
switch is passed to Chromium unchanged.

| Flag                                                | Meaning                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `--url=<url>`                                       | Initial URL.                                                                                        |
| `--cache-path=<dir>`                                | Profile directory. Empty or absent: in-memory profile.                                              |
| `--remote-debugging-port=<n>`                       | Expose the Chrome DevTools Protocol endpoint on this port.                                          |
| `--log-file=<path>`, `--log-severity=<level>`       | CEF log destination and verbosity.                                                                  |
| `--lang=<tag>`                                      | UI locale.                                                                                          |
| `--use-alloy-style`                                 | Use CEF's Alloy runtime style instead of the default Chrome style.                                  |
| `--use-native`                                      | Use native parent windows instead of Views windows.                                                 |
| `--window-size=WxH`                                 | Initial window size.                                                                                |
| `--initial-show-state=normal\|minimized\|maximized` | Initial window show state.                                                                          |
| `--no-sandbox`                                      | Disable Chromium's sandbox. Diagnostics only; the receipt records `shell.sandbox`.                  |
| `--smoke`                                           | Load the page, write the receipt, close the browser, and exit: `0` ok, `2` load error, `3` timeout. |
| `--smoke-timeout-ms=<n>`                            | Smoke timeout. Default `30000`.                                                                     |
| `--smoke-hold-ms=<n>`                               | Keep the page open `n` ms after it loaded so external probes can observe it. The launcher sets `1500` automatically when `--smoke` and `--remote-debugging-port` are both given; the DevTools probe result is recorded under `cdp` in the receipt. |
| `--receipt=<path>`                                  | Receipt path, for example `engines/cef.lock.json`.                                                  |

## Themes and managed policies

Chromium's own Google/Material defaults stay in place unless a theme is selected.
`--theme=<preset|file.json>` applies a brand preset through CEF's Views theme
color API (`CefWindow::SetThemeColor`, ids from `include/cef_color_ids.h`) to
every top-level and popup window; presets are `neutral` (no override), `m3`,
`fluent`, `apple`, `omarchy`, `hyprland`, and `aphrody`. A JSON file maps token
keys (`frameActive`, `toolbar`, `toolbarText`, `locationBarBackground`,
`newTabPageBackground`, `windowBackground`, and the others listed in
`src/theme.rs`) to `#RRGGBB` or `#AARRGGBB` strings and may name a `base`
preset to start from. Page content is never restyled; only the browser UI is.

Search engine, new tab, homepage, and startup pages are configured as managed
Chromium policies, which is the mechanism Chromium itself uses for enterprise
defaults. The shell sets `chrome_policy_id` to
`SOFTWARE\Policies\YOLO-Web\Chromium` (override with `--policy-id`, disable
with `--no-policies`), and on Windows the launcher writes the user-level key
`HKCU\SOFTWARE\Policies\YOLO-Web\Chromium` with `reg.exe` before the host
starts:

| Launcher switch                                           | Policies written                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--search-engine=aphrody` (or `google`, `duckduckgo`, `brave`, a URL) | `DefaultSearchProviderEnabled`, `...Name`, `...Keyword`, `...SearchURL` (`https://aphrody.com/search?q={searchTerms}`) |
| `--new-tab-url=<url>`                                     | `NewTabPageLocation`                                                             |
| `--homepage=<url>`                                        | `HomepageLocation`, `HomepageIsNewTabPage=0`, `ShowHomeButton=1`                  |
| `--startup-urls=<a,b>`                                    | `RestoreOnStartup=4`, `RestoreOnStartupURLs`                                     |
| `--reset-policies`                                        | deletes the key first                                                            |

The values persist for the Windows user until `--reset-policies` is run; they
are visible in the browser at `chrome://policy`. On Linux the same policies are
read from JSON files under the `chrome_policy_id` directory
(`/etc/yolo-web/chromium/policies/managed/*.json`), which the launcher does not
write. MV3 extensions load with Chromium's own `--load-extension=<dir>` switch;
see `packages/chrome-extension-yolo` for the Bun-built YOLO-Web extension.

## Runtime model (Windows)

1. `cargo build -p yolo-chromium` produces the launcher executable and the
   `yolo_chromium` cdylib. `cef-dll-sys` has already downloaded the
   distribution into `.cef/` and compiled `libcef_dll_wrapper`.
2. The launcher prepares the runtime directory (default
   `<target>/debug/yolo-chromium-runtime/`): it copies `libcef.dll`,
   `chrome_elf.dll`, the `*.pak` resource files, `icudtl.dat`,
   `v8_context_snapshot.bin`, `locales/`, the Vulkan and SwiftShader DLLs, the
   selected bootstrap executable renamed to `yolo-chromium.exe`, the shell DLL
   as `yolo-chromium.dll`, and a side-by-side manifest.
3. The launcher spawns `yolo-chromium.exe` with all Chromium switches and waits
   for it. CEF's bootstrap loads the DLL with the same base name from its own
   directory and calls `RunWinMain` (`bootstrap.exe`) or `RunConsoleMain`
   (`bootstrapc.exe`). That function initializes CEF, creates the browser
   window, runs the message loop, and shuts CEF down.
4. CEF launches the renderer, GPU, and utility subprocesses from the same host
   executable. Smoke mode writes the receipt before shutdown and maps the load
   outcome to the exit code.

## Sandbox

Since CEF M138 a sandbox-enabled Windows application must be a DLL that is
loaded by CEF's prebuilt bootstrap executable; building the host as an ordinary
Rust executable only works with the sandbox disabled. Keep the default
`sandbox` feature on and run the shell through the launcher. `--no-sandbox`
exists for diagnosing a sandbox problem, not for normal use.

The `bootstrap.exe`, `bootstrapc.exe`, `libcef.dll`, and `chrome_elf.dll`
files in the minimal distribution are not Authenticode-signed (checked with
`Get-AuthenticodeSignature` on 2026-11-04, status `NotSigned`). CEF asks
integrators to code sign all binaries after modification and before
distribution to users; a release pipeline must sign the host, the DLL, and the
CEF binaries itself.

## CEF cache and `CEF_PATH`

`.cargo/config.toml` sets `CEF_PATH` to `.cef`, relative to the workspace root.
On the first build `cef-dll-sys` downloads the pinned archive into
`.cef/156.0.15/` and extracts it to `.cef/156.0.15/cef_windows_x86_64/`, then
writes `archive.json` (`type`, `name`, `sha1`) next to the distribution. The
directory is git-ignored. Never vendor or commit it; delete `.cef/` to force a
fresh download.

Pinned distribution for this crate version:

| Field            | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| CEF version      | `156.0.15+gcf671c0+chromium-156.0.8078.80`                                      |
| Chromium version | `156.0.8078.80`                                                                 |
| CEF API version  | `15600` (hash `6dc09eb2834fe5b61d7d8c42bbb8d8c27a2bb1b6`)                       |
| CEF commit       | `cf671c072925b27823a61181152f4f288e8e4306` (commit number `3660`)               |
| Archive          | `cef_binary_156.0.15+gcf671c0+chromium-156.0.8078.80_windows64_minimal.tar.bz2` |
| Archive SHA-1    | `b690e035689ee20ba9d2500ac8953815bc7ed46a`                                      |
| Source           | [CEF binary distribution index](https://cef-builds.spotifycdn.com/index.json)   |

## Receipt (`engines/cef.lock.json`)

The smoke run writes a camelCase JSON receipt with `schemaVersion: 1` and
`engine: "cef"`. It is the evidence that the shell initialized CEF, loaded a
page, and reported the runtime version; documentation should reference it
rather than restate it.

| Block        | Fields                                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capturedAt` | ISO 8601 timestamp of the run.                                                                                                                                                                                                                                                                                    |
| `host`       | `os`, `arch`, `target` of the machine that ran the smoke.                                                                                                                                                                                                                                                         |
| `build`      | `crateVersion`, `cefCrate`, `target`, `sandbox`, and `cef` with `version`, `major`, `minor`, `patch`, `commitNumber`, `commitHash`, `chromiumVersion`, `apiVersion`, `apiHash`, `sandboxCompatHash`, `distributionDir`, `archiveName`, `archiveSha1` taken from the CEF headers and `archive.json` at build time. |
| `runtime`    | `cefVersion`, `chromiumVersion`, `apiHashPlatform`, `commitHash`, `sandboxCompatHash` reported by the loaded `libcef`, and `matchesBuild` (true when they equal the build block).                                                                                                                                 |
| `shell`      | `runtimeStyle`, `views`, `sandbox`, `cachePath`, `remoteDebuggingPort`, `hostExecutable` as effectively used.                                                                                                                                                                                                     |
| `smoke`      | `url`, `finalUrl`, `title`, `httpStatus`, `loadMs`, `outcome`, `error`, `exitCode`.                                                                                                                                                                                                                               |

## Troubleshooting

- `cmake` or `ninja` not found: install both and put them on `PATH`; the
  `cef-dll-sys` build script needs them to compile `libcef_dll_wrapper`.
- MSVC not found or `cl.exe` errors: install the MSVC Build Tools C++ desktop
  workload and a Windows SDK, then build from a Developer PowerShell.
- First build stalls or fails while downloading: the pinned archive is fetched
  from `cef-builds.spotifycdn.com`. Check connectivity, delete the partial
  `.cef/156.0.15/` directory, and rebuild.
- Host exits immediately or reports a sandbox error: run through the launcher
  (`cargo run -p yolo-chromium -- ...`), which uses the bootstrap executable.
  Use `--no-sandbox` only to confirm that the sandbox is the cause.
- Smoke exit code `2` or `3`: read `smoke.outcome` and `smoke.error` in the
  receipt; raise `--smoke-timeout-ms` for slow networks.
- `runtime.matchesBuild` is `false`: the runtime directory contains a different
  distribution than the one the crate was built against. Delete the runtime
  directory and run `--prepare-runtime` again, or clear `.cef/` and rebuild.
- SmartScreen or antivirus blocks `yolo-chromium.exe`: the bootstrap is
  unsigned in the minimal distribution; sign the runtime binaries for
  distribution.

## References

- [CEF sandbox setup](https://github.com/chromiumembedded/cef/blob/master/docs/sandbox_setup.md)
  (bootstrap executables, `RunWinMain` / `RunConsoleMain`, signing)
- [CEF binary distribution index](https://cef-builds.spotifycdn.com/index.html)
- [`tauri-apps/cef-rs`](https://github.com/tauri-apps/cef-rs) and
  [`cef-dll-sys` on docs.rs](https://docs.rs/crate/cef-dll-sys/156.3.0)
- CEF headers in the distribution: `include/cef_version.h`,
  `include/cef_api_versions.h`, `include/cef_version_info.h`
