# Browser engine manager

The `engines` command is a cross-platform, auditable catalog and command planner for browser research targets. It does not assume a fixed checkout location: pass the Chromium workspace path or set `CHROMIUM_ROOT`. It only runs a package or checkout operation when `--execute` is supplied. `status` probes executable names on `PATH` and source roots provided through environment variables; it does not scan proprietary installer databases or guess OS-specific install directories. Automatic version pinning is not implemented yet.

```sh
bun run packages/chromium-tracker/src/cli.ts engines list
bun run packages/chromium-tracker/src/cli.ts engines status chrome-canary
bun run packages/chromium-tracker/src/cli.ts engines source servo "$SERVO_ROOT"

# After fetch and gclient sync, capture the exact source/dependency state
bun run packages/chromium-tracker/src/cli.ts engines lock "$CHROMIUM_ROOT" --write "$CHROMIUM_ROOT.lock.json"

# Include the effective arguments for an already-generated GN output directory
bun run packages/chromium-tracker/src/cli.ts engines lock "$CHROMIUM_ROOT" --out out/Default --write "$CHROMIUM_ROOT.lock.json"

# Check, sync dependencies, generate a GN build, build Chrome, and lock it
bun run packages/chromium-tracker/src/cli.ts engines chromium status
bun run packages/chromium-tracker/src/cli.ts engines chromium sync
bun run packages/chromium-tracker/src/cli.ts engines chromium gen out/Default --args 'is_debug=true is_component_build=true'
bun run packages/chromium-tracker/src/cli.ts engines chromium build out/Default chrome
bun run packages/chromium-tracker/src/cli.ts engines chromium lock --out out/Default --write "$CHROMIUM_ROOT.lock.json"
```

The current public Windows 11 checkout is recorded in
[`engines/chromium.lock.json`](../engines/chromium.lock.json): Chromium commit,
`DEPS` digest, active `gclient revinfo --actual` dependency revisions, and
`depot_tools` commit. It contains no local checkout path. This lock describes the
checked-out source graph; it does not capture CIPD package contents, host SDKs,
patches, or build artifacts. Refresh it after a DEPS sync or Chromium roll.

Set `SERVO_ROOT` and `CHROMIUM_ROOT` in the shell before using these examples;
PowerShell users use `$env:SERVO_ROOT` and `$env:CHROMIUM_ROOT`. The manager does
not choose a default source directory.

Windows-only package plan (winget metadata is community maintained):

```powershell
bun run packages/chromium-tracker/src/cli.ts engines install chrome-canary --manager winget
bun run packages/chromium-tracker/src/cli.ts engines install edge-canary --manager winget
```

Source probes use `CHROMIUM_ROOT`, `FIREFOX_ROOT`, `WEBKIT_ROOT`, and
`SERVO_ROOT`. Binary probes search `PATH` for the engine's command name and
query `--version` when supported. The detected executable path is reported, but
no presumed application install directory is searched.

Add `--execute` to the install and source commands to perform those operations. `engines lock` is read-only. Winget entries come from the community-maintained `microsoft/winget-pkgs` manifests; they invoke vendor installers and are not vendor-authored package metadata. Package installation for apt, pacman, Flatpak, and Docker currently has no catalog mappings, so the command refuses to invent package names. Source operations are real Git checkouts for Firefox, WebKit/JSC, and Servo. Chromium source is intentionally not exposed as a plain clone: Chromium requires `depot_tools` and gclient synchronization.

## Upstream workflows and sources

| Target | Current MVP path | Primary references |
|---|---|---|
| Chrome stable / Canary | Windows winget plan/execute; community manifests | [Chrome channels and downloads](https://www.chromium.org/getting-involved/download-chromium/), [winget Chrome](https://github.com/microsoft/winget-pkgs/tree/master/manifests/g/Google/Chrome), [winget Canary](https://github.com/microsoft/winget-pkgs/tree/master/manifests/g/Google/Chrome/Canary) |
| Edge Canary | Windows winget plan/execute; community manifest | [Edge channels](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-channels), [Insider downloads](https://www.microsoft.com/en-us/edge/download/insider), [winget manifest](https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Microsoft/Edge/Canary) |
| Firefox Nightly / SpiderMonkey | Clone mozilla-firefox `main`; build via `mach` manually | [Firefox source build](https://firefox-source-docs.mozilla.org/setup/linux_build.html), [contributor quick reference](https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html), [SpiderMonkey build](https://firefox-source-docs.mozilla.org/js/build.html), [Nightly channel](https://www.mozilla.org/firefox/channel/desktop/) |
| WebKit / JavaScriptCore | Clone WebKit `main`; build via WebKit scripts manually | [WebKit build options](https://docs.webkit.org/Build%20&%20Debug/BuildOptions.html), [JSC-only build notes](https://trac.webkit.org/wiki/JSCOnly), [WebKit source](https://github.com/WebKit/WebKit) |
| Servo | Clone Servo `main`; bootstrap/build with `mach` manually | [Servo build guide](https://book.servo.org/building/building.html), [Linux build guide](https://book.servo.org/building/linux.html), [embedding status](https://book.servo.org/embedding/overview.html) |
| Chromium / V8 | Manual `depot_tools` workflow, not a plain Git checkout | [Linux build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md), [depot_tools](https://chromium.googlesource.com/chromium/tools/depot_tools/), [release branches](https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/) |

CEF platform metadata defaults from the running OS and CPU architecture and
uses the platform identifiers published by the [official CEF index](https://cef-builds.spotifycdn.com/index.json).
Override it for cross-host research with `cef --platform linux64` or another
published identifier (`windows64`, `linuxarm64`, `macosarm64`, and others).

Chromium upstream checkout sequence is documented as `fetch --nohooks chromium`, `gclient runhooks`, GN generation, then `autoninja`. `gclient sync --with_branch_heads --with_tags` is relevant when tracking release branches. Do not treat cloning depot_tools as cloning Chromium.

For reproducible Chrome/Chromium browser binaries, Chrome for Testing publishes machine-readable channel/version/platform download metadata; this is the recommended next provider to add for pinned Stable/Beta/Dev/Canary downloads: [Chrome for Testing automation docs](https://developer.chrome.com/docs/automation-and-testing/download-test-binaries), [official JSON endpoint repository](https://github.com/GoogleChromeLabs/chrome-for-testing). This MVP currently catalogs channels but does not yet query or install CfT artifacts.

## Chromium source lock

`engines lock` is read-only. It requires a completed Chromium workspace root containing
`.gclient` and `src/DEPS`, captures `src` HEAD/branch/working-tree state and a
SHA-256 digest of `DEPS`, the depot_tools Git revision when discoverable, then
stores `gclient revinfo --actual --snapshot --output-json -`. It disables
depot_tools self-update for this read. The recursive gclient snapshot records
actual dependency revisions, including dependencies not pinned directly in
`DEPS`. Pass `--out out\\Default` to also capture the effective GN argument
listing for an existing generated output directory. Preserve the result beside
build artifacts or in a separate research manifest; do not commit
machine-specific checkout paths or generated dependency trees to this repo. The
lock output deliberately omits the local absolute workspace and executable paths
so the same lock can be compared across Windows and Linux machines.

`engines chromium sync` calls the official `gclient sync` and updates the
checkout's dependency tree; it is an explicit mutating command. `gen` calls
`gn gen` with a GN output under `src/out/`, and `build` calls `autoninja` for a
target such as `chrome`. These commands locate `gclient`, `gn`, and `autoninja`
through `PATH`, pass arguments without shell interpolation, and disable
depot_tools self-update so tool revisions are managed separately.

The lock is evidence of the source state, not a complete build reproduction by
itself. Also archive the GN args, host/toolchain versions, depot_tools revision,
patch series and output config with benchmark results. The current `lock`
command does not capture those yet.

## Boundaries

- `status` reports catalog metadata plus executable/version probes and explicitly configured source roots. It can miss GUI applications that are installed outside `PATH`.
- `install` and `update` need a manager mapping. The CLI currently maps only Windows winget for Chrome and Edge. APT Chromium packaging differs by distribution, Arch and Flathub identifiers need explicit provenance, and Docker images are not equivalent to host browser installs; these are withheld until validated.
- Source checkout does not bootstrap dependencies, build, or select commits. Firefox/SpiderMonkey use Mozilla's `mach` workflows; WebKit and JSC use WebKit's scripts; Servo uses its `mach` scripts.
- Servo currently uses SpiderMonkey; its embedding surface remains in development. Treat `servoshell` as the available standalone browser path, not as a stable embeddable API.
- No benchmark harness, automatic browser version pinning, or cross-platform install detection is claimed by this MVP.
