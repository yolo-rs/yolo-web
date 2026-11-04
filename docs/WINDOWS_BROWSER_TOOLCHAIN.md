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
