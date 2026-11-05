# Chromium native build on Windows (no WSL / Docker / MSYS2)

Supported path = Visual Studio Build Tools + Windows 11 SDK + depot_tools +
`fetch chromium` + `gn`/`autoninja`, run from `cmd.exe`/PowerShell directly on Windows.

Source (official, verbatim requirements below):
https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md

Detector: `scripts/browsers/chromium-windows-detect.ps1` (read-only).
Receipt: `docs/browsers/receipts/chromium-windows-detect.txt`.

## Official requirements (from the Chromium docs, 2026-11)

| Requirement | Official value |
|---|---|
| Visual Studio | 2026 (>=18.0.0), workload `Microsoft.VisualStudio.Workload.NativeDesktop` + component `Microsoft.VisualStudio.Component.VC.ATLMFC` |
| Windows 11 SDK | 10.0.28000.2270 |
| SDK Debugging Tools | >= 10.0.26100.3323 (SDK > Change > "Debugging Tools for Windows") |
| Env | `DEPOT_TOOLS_WIN_TOOLCHAIN=0`; `vs2026_install=<VS install path>` |
| RAM | >= 8 GB (>16 GB highly recommended) |
| Disk | >= 100 GB free, NTFS (FAT32 unsupported) |

## This workstation — detected state (receipt has live values)

| Item | State |
|---|---|
| VS Build Tools 2026 | PRESENT `18.11.12324.101` at `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools` |
| MSVC toolset / cl.exe | PRESENT `14.51.36231` |
| VC.ATLMFC component | **MISSING** (required) |
| Windows 11 SDK | PRESENT `10.0.28000.0` + `10.0.26100.0` (verify servicing build vs 10.0.28000.2270) |
| SDK Debugging Tools (cdb.exe) | PRESENT |
| depot_tools | PRESENT on PATH at `C:\src\depot_tools` (fetch/gn/ninja shims) |
| `DEPOT_TOOLS_WIN_TOOLCHAIN` | `0` (process + machine scope) |
| `vs2026_install` | **NOT SET** |
| Existing checkout | PRESENT at `C:\src\chromium\src\.git` (do NOT re-sync; see below) |
| C: free | ~46 GB (fluctuates) vs 100 GB required |

## Blockers (why a build is NOT started here)

1. **Disk** — C: free (~46 GB, observed as low as ~9 GB) is well under the 100 GB
   Chromium requires. A full checkout+build is 100+ GB; it cannot live on C:. Build
   on a separate >=100 GB NTFS volume. This is the hard blocker.
2. **VC.ATLMFC missing** — add without touching anything else (records in receipt):
   ```cmd
   "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe" modify ^
     --installPath "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools" ^
     --add Microsoft.VisualStudio.Component.VC.ATLMFC --quiet --norestart
   ```
3. **`vs2026_install` not set** — needed so `gn`/vs_toolchain find the local VS:
   ```cmd
   setx vs2026_install "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools"
   ```

## Build command sequence (official; NOT run here)

Per the official docs. **Not executed** — a 100+ GB sync/build was intentionally not
started given the disk blocker.
```cmd
:: depot_tools already present at C:\src\depot_tools and on PATH (prepend it).
set DEPOT_TOOLS_WIN_TOOLCHAIN=0
set vs2026_install=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools
gclient                          :: first run installs bundled git/python
:: On a >=100GB NTFS volume (NOT C:):
mkdir chromium && cd chromium
fetch chromium
cd src
gn gen out\Default
autoninja -C out\Default chrome
```

## Existing checkout at `C:\src\chromium`

`C:\src\chromium\src\.git` exists with `.gclient` (solution `src` ->
chromium/src.git, bootstrap cache). **Do not re-run `fetch`/`gclient sync` blindly**
(it will try to pull 100+ GB and can fill the disk). To update an existing checkout
when there is room, the official recovery/update command is:
```cmd
cd C:\src\chromium\src
gclient sync -D
```
