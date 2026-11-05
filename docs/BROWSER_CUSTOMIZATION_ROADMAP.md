# Browser customization roadmap

Status of yolo-chromium (CEF 156 / Chromium 156.0.8078.80, Windows x64)
customization. BUILT means the code exists on `main` and the built shell
accepts the switch (`yolo-chromium --help`, 2026-11-05); the extension section
also records its load test from that date. The `cargo test` commands for themes
and policies were not re-run for this document. PLANNED means no code exists
yet in this repository.

Commands assume the repository root and a built shell:
`cargo build -p yolo-chromium`. `$SHELL_EXE` is the launcher, by default
`<cargo target dir>/debug/yolo-chromium.exe`.

## BUILT

### Brand theme presets (`--theme`)

`crates/yolo-chromium/src/theme.rs` maps the presets `neutral` (Chromium
default, no override), `m3`, `fluent`, `apple`, `omarchy`, `hyprland`, and
`aphrody`, or a JSON token file with an optional `base` preset, onto CEF Views
theme color ids (`CefWindow::SetThemeColor`). Only browser UI is recolored; page
content is not.

```sh
cargo test -p yolo-chromium theme
"$SHELL_EXE" --smoke --theme=aphrody --url=chrome://version
```

### Managed policies (`--search-engine=aphrody` and others)

`crates/yolo-chromium/src/launcher/policy.rs` writes Chromium managed policies
to `HKCU\SOFTWARE\Policies\YOLO-Web\Chromium` before the host starts (Windows
only; on Linux the JSON policy files are read but not written).

| Switch                                                      | Policies                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `--search-engine=aphrody\|google\|duckduckgo\|brave\|<url>` | `DefaultSearchProvider*`, Aphrody URL `https://aphrody.com/search?q={searchTerms}` |
| `--new-tab-url=<url>`                                       | `NewTabPageLocation`                                                               |
| `--homepage=<url>`                                          | `HomepageLocation`, `HomepageIsNewTabPage`, `ShowHomeButton`                       |
| `--startup-urls=<a,b>`                                      | `RestoreOnStartup=4`, `RestoreOnStartupURLs`                                       |
| `--reset-policies`                                          | deletes the key first                                                              |

```sh
cargo test -p yolo-chromium policy
"$SHELL_EXE" --smoke --search-engine=aphrody --url=chrome://policy
reg query "HKCU\SOFTWARE\Policies\YOLO-Web\Chromium"
"$SHELL_EXE" --reset-policies --smoke --url=chrome://version
```

### Manifest V3 extension (`packages/chrome-extension-yolo`)

Bun-built MV3 extension: Aphrody search provider and homepage
(`chrome_settings_overrides`), new tab page (`chrome_url_overrides`; its
customize panel stores the theme preset in `chrome.storage.sync`), a popup
with New tab and Browser settings, and a module service worker. Output is the unpacked directory `dist/`;
`bun run scripts/zip.ts` packages it.

```sh
cd packages/chrome-extension-yolo
bun run build
bun run check
bun test
"$SHELL_EXE" --smoke --url=chrome://extensions --remote-debugging-port=9333 \
  --smoke-hold-ms=25000 --cache-path=<tmp profile> \
  --load-extension=<abs path>/packages/chrome-extension-yolo/dist
```

While the page is held, evaluate on the `chrome://extensions` CDP target:
`chrome.developerPrivate.getExtensionsInfo({includeDisabled:true}, cb)`.

Result on 2026-11-05: build, type check (26 files), and tests (23 pass) are
green. CEF loads the extension as `YOLO-Web` 0.2.0, id
`cnggocnjohkbhafpjmjhikcmlcplnieh`, state `ENABLED`, location `UNPACKED`, with
no manifest errors, runtime errors, or install warnings; its service worker
appears as a CDP target. Known shell issues, not fixed:

- With the extension loaded, a smoke run on `chrome://extensions` or
  `chrome://newtab` does not shut down and the launcher kills the host (exit
  `4`); the receipt is still written with `outcome: "loaded"`. CEF logs
  `Creating a chrome browser without a client`. The same smoke on
  `chrome://version`, or on `chrome://extensions` without the extension or with
  an extension that has neither override key, exits `0`.
- The first `chrome://newtab` navigation in a smoke run resolved to Chromium's
  `chrome://new-tab-page/`, not the extension page, likely because the
  unpacked extension registers after the startup navigation.
- Same cause, rechecked later on 2026-11-05: `--smoke
--url=chrome-extension://<id>/newtab.html` fails with
  `ERR_BLOCKED_BY_CLIENT` (receipt `outcome: "load-error"`, exit `2`) on a
  fresh and on a warm `--cache-path`. `bun run capture` in the package works
  around it: it starts on `chrome://version` and navigates over CDP.

### New tab page module (`packages/chrome-extension-yolo/src/newtab*`)

The replica of the Chrome new tab page and search front page, documented in
`docs/replica/ntp-search/` (architecture, design, test plan, bugs, parity):
search box with suggestions, shortcut tiles, an opt-in recent pages card and a
customize panel whose brand presets use the `--theme` colors of `theme.rs`.

```sh
cd packages/chrome-extension-yolo
bun test                                  # 73 unit tests
bun run capture --exe="$SHELL_EXE" --out=../../docs/replica/ntp-search/clone-screens
```

Result on 2026-11-05: 73 unit tests pass; in the shell, 12 of 12 CDP flow
checks pass with no console errors, and the run exits `0`.

## PLANNED

Nothing below is implemented in this repository. Each item names the command
that must pass before it moves to BUILT.

| Item                                                                     | Owner / boundary                                                 | Verification once built                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Clean smoke shutdown with an override extension loaded                   | `crates/yolo-chromium` (`shell.rs`, client-less browser windows) | `"$SHELL_EXE" --smoke --url=chrome://extensions --load-extension=<dist>` exits `0`                  |
| Extension new tab served on the first navigation                         | `crates/yolo-chromium`                                           | smoke on `chrome://newtab` with the extension: receipt `finalUrl` starts with `chrome-extension://` |
| Launcher `--extension=<dir>` that builds and loads the bundled extension | `crates/yolo-chromium` launcher                                  | `cargo test -p yolo-chromium launcher` plus the CDP check above                                     |
| Theme preset sync between `--theme` and the extension new tab page       | shell + extension                                                | CDP: `chrome.storage.sync.get("theme")` equals the `--theme` preset                                 |
| Linux policy files written by the launcher                               | `launcher/policy.rs`                                             | `cargo test -p yolo-chromium policy` on Linux; `chrome://policy` lists the values                   |
| Tauri hosting of the CEF adapter                                         | yolo-ui (see `docs/CEF_ADAPTER_BOUNDARY.mdx`)                    | yolo-ui host smoke loads the shell; `cargo tree -p yolo-chromium` still has no Tauri crate          |
| WinUI 3 native frame and menus                                           | yolo-ui                                                          | yolo-ui WinUI host smoke with `--theme=fluent`                                                      |
| Chrome Web Store / signed CRX distribution                               | `packages/chrome-extension-yolo`                                 | `bun run scripts/zip.ts` output accepted by the store dashboard; CRX signature verifies             |
