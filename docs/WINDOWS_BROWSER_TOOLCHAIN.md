# Windows browser-engine build notes

`yolo-web` owns browser-engine source workflows. Host toolchain provisioning,
Windows/Linux qualification, MSVC diagnostics, and Rust cross-compilation are
centralized in [`yolo-cross`'s toolchain guide](https://github.com/yolo-rs/yolo-cross/blob/main/docs/windows-toolchains.md).
The local preflight is `bun run windows:chromium:doctor` from the yolo-cross
checkout. It reports host prerequisites; it does not fetch or build Chromium.

## Chromium

Use Chromium's official `depot_tools` workflow with `.gclient` at the workspace
root and Chromium under its `src` child. Chromium's pinned checkout and
`src/docs/windows_build_instructions.md` remain authoritative for the exact
Visual Studio, Windows SDK, MFC/ATL, and Debugging Tools versions. The
`yolo-web` engine manager deliberately refuses to clone `chromium/src` with
plain `git`; use `fetch`/`gclient`, then GN and `autoninja` as specified by the
selected revision.

The checker is not a build gate or reproducibility proof. Preserve the complete
Chromium revision, `DEPS`, depot_tools revision, local patch series, GN args,
host, and generated artifact details for every qualification result.

## CEF (yolo-chromium)

`crates/yolo-chromium` runs the official CEF (Chromium Embedded Framework)
binary distribution instead of a Chromium source build, so it needs neither
`depot_tools`, GN, nor the Chromium checkout. It needs:

- CMake and Ninja on `PATH`. The `cef-dll-sys` build script configures CEF's
  `libcef_dll_wrapper` with the Ninja generator, the `RelWithDebInfo` profile,
  `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`, and `USE_SANDBOX=ON` while the
  crate's default `sandbox` feature is enabled.
- MSVC Build Tools with the C++ desktop workload and a Windows SDK. The
  compiler is discovered through the standard Visual Studio locator; a
  Developer PowerShell guarantees that `cl.exe` and `link.exe` are found.
- Network access on the first build. The pinned archive
  `cef_binary_156.0.15+gcf671c0+chromium-156.0.8078.80_windows64_minimal.tar.bz2`
  (about 175 MB, SHA-1 `b690e035689ee20ba9d2500ac8953815bc7ed46a`) is
  downloaded from the official CEF index into the git-ignored `.cef/` cache
  selected by `CEF_PATH` in `.cargo/config.toml`.
- CEF's bootstrap executables. Since CEF M138 a sandbox-enabled Windows
  application is a DLL that exports `RunWinMain` (windowed, loaded by
  `bootstrap.exe`) or `RunConsoleMain` (console, loaded by `bootstrapc.exe`).
  Both executables ship in the distribution; the launcher copies the selected
  one into the runtime directory as `yolo-chromium.exe` next to
  `yolo-chromium.dll`, `libcef.dll`, `chrome_elf.dll`, the resource and locale
  files, and a side-by-side manifest. The minimal distribution's
  `bootstrap.exe`, `bootstrapc.exe`, `libcef.dll`, and `chrome_elf.dll` are not
  Authenticode-signed (checked with `Get-AuthenticodeSignature` on
  2026-11-04); CEF asks integrators to code sign all binaries after
  modification and before distribution. Pass `--no-sandbox` only to diagnose a
  sandbox problem; the smoke receipt records the sandbox state.

Build and smoke commands are listed in
[`crates/yolo-chromium/README.md`](../crates/yolo-chromium/README.md); the
ownership boundary and gate status are in
[`CEF_ADAPTER_BOUNDARY.mdx`](CEF_ADAPTER_BOUNDARY.mdx).

## Edge and WebView2

Edge Canary is a Microsoft-distributed preview browser channel and can be
installed/updated with the winget package ID `Microsoft.Edge.Canary`. The
engine registry labels winget as community-trust because its package manifest
is maintained in `microsoft/winget-pkgs`; the installer itself comes from
Microsoft. Canary supports channel-level compatibility and performance
observation, not reproducible engine-source builds.

WebView2 embeds the installed Microsoft Edge runtime in native applications;
it is not a separate Chromium source checkout. Evergreen deployment installs
the current runtime, while Fixed Version bundles a chosen runtime that the app
developer must service. Its SDK and bindings are owned by the consuming app.

## Sources

- Chromium: [checkout and build](https://chromium.googlesource.com/chromium/src/+/main/docs/get_the_code.md), [Windows build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md), and [`depot_tools`](https://chromium.googlesource.com/chromium/tools/depot_tools/)
- Microsoft: [Edge channels](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-channels), [WebView2 distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution), and [Evergreen vs Fixed Version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)
- [Edge Canary winget manifest](https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Microsoft/Edge/Canary)
- CEF: [sandbox setup](https://github.com/chromiumembedded/cef/blob/master/docs/sandbox_setup.md), [binary distribution index](https://cef-builds.spotifycdn.com/index.html), and the [`tauri-apps/cef-rs`](https://github.com/tauri-apps/cef-rs) bindings
