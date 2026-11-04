# Bleeding-edge browsers — Windows 11 (winget)

Host: Windows 11 Pro 10.0.28120. winget `v1.30.140-preview`.
Provisioning is idempotent via `scripts/browsers/install-windows.ps1`
(detect-then-install; `-Uninstall` to remove; `-DryRun` to preview).

No account sign-in, profile import, or `User Data` access is performed. See `SIGN-IN.md`.

## Resolved packages (IDs verified with `winget search --id <id> -e`, 2026-11-04)

| Browser | winget ID | Version (installed) |
|---|---|---|
| Chrome Canary | `Google.Chrome.Canary` | 159.0.8142.0 |
| Edge Canary | `Microsoft.Edge.Canary` | 159.0.4382.0 |
| Firefox Nightly | `Mozilla.Firefox.Nightly.MSIX` | 161.2611.308.0 |

Notes:
- The plain id `Mozilla.Firefox.Nightly` does **not** exist in the winget source; the
  shipping Nightly is the MSIX package `Mozilla.Firefox.Nightly.MSIX`.
- winget's Edge Canary **manifest** lagged at 142.0.3539.0, but the installed Canary
  self-updates (observed 159.0.4382.0). winget still manages install/uninstall.
- **All three were already installed on this host.** The script detected them and
  installed nothing (receipt: `receipts/install-windows.txt`). No C: disk consumed.

## Commands

Install all (idempotent):
```powershell
pwsh -File scripts/browsers/install-windows.ps1
```

Per-browser install (what the script runs):
```powershell
winget install --id Google.Chrome.Canary         -e --accept-source-agreements --accept-package-agreements
winget install --id Microsoft.Edge.Canary        -e --accept-source-agreements --accept-package-agreements
winget install --id Mozilla.Firefox.Nightly.MSIX -e --accept-source-agreements --accept-package-agreements
```

Uninstall all:
```powershell
pwsh -File scripts/browsers/install-windows.ps1 -Uninstall
```

Per-browser uninstall:
```powershell
winget uninstall --id Google.Chrome.Canary         -e
winget uninstall --id Microsoft.Edge.Canary        -e
winget uninstall --id Mozilla.Firefox.Nightly.MSIX -e
```

## Install locations (for launching headless/agent sessions)
- Chrome Canary: `%LOCALAPPDATA%\Google\Chrome SxS\Application\chrome.exe`
- Edge Canary: `%LOCALAPPDATA%\Microsoft\Edge SxS\Application\msedge.exe`
- Firefox Nightly (MSIX): launch via Start menu "Firefox Nightly" or
  `Get-AppxPackage *Firefox*Nightly* | % { $_.PackageFamilyName }` then
  `explorer.exe shell:AppsFolder\<PFN>!App`.
