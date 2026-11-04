# Browsers & engines — provisioning and build prereqs

Bleeding-edge browsers, agent-browser/desktop tooling, and the prerequisites to build
Chromium (Windows), AOSP and ChromiumOS (Linux `vps`). Lightweight things are installed;
heavy things are detected and documented. No Google/account sign-in, no profile or
`User Data` access (see `SIGN-IN.md`).

| Doc / script | What |
|---|---|
| `INSTALL.md` | Windows browsers (winget ids, versions, install/uninstall) |
| `../../scripts/browsers/install-windows.ps1` | Idempotent detect-then-install (`-Uninstall`, `-DryRun`) |
| `SIGN-IN.md` | Manual per-browser sign-in steps (user only) |
| `../../scripts/browsers/agent-browser.md` | Drive a browser headlessly for agents (native + CDP + browser-use); agent-desktop via DeskVNC |
| `../../scripts/browsers/cdp-screenshot.ts` | Zero-dep Bun CDP screenshot helper |
| `chromium-windows.md` | Native Chromium-on-Windows path (no WSL/Docker/MSYS2) |
| `../../scripts/browsers/chromium-windows-detect.ps1` | Read-only Chromium toolchain detector |
| `aosp-chromiumos.md` | AOSP + ChromiumOS build prereqs on the Linux `vps` |
| `../../scripts/browsers/vps-aosp-cros-prereq.sh` | Read-only vps prereq checker |
| `receipts/` | Real command output for everything installed/run |

## Status (2026-11-05)

- **Windows browsers**: Chrome Canary, Edge Canary, Firefox Nightly — all already
  installed; script verified idempotent (nothing to install).
- **Agent browser**: Chrome Canary 159 headless over CDP, screenshot captured — green.
- **Chromium/Windows**: toolchain present (VS 2026, SDK, depot_tools, checkout);
  BLOCKED by C: disk (<100 GB) + missing VC.ATLMFC + unset `vs2026_install`.
- **AOSP**: BLOCKED on vps (RAM 45<64 GB, disk 333<400 GB).
- **ChromiumOS**: feasible on vps disk/RAM; OS 26.10 vs official 22.04 caveat.
