#!/usr/bin/env pwsh
# yolo-web :: bleeding-edge browsers on Windows 11 via winget.
# Idempotent: detect-then-install. -Uninstall removes. -DryRun prints only.
# No profiles, no sign-in, no account data touched. See docs/browsers/SIGN-IN.md.
#
# Verified winget IDs (winget search --id <id> -e), 2026-11-04:
#   Google.Chrome.Canary          Chrome Canary
#   Microsoft.Edge.Canary         Edge Canary
#   Mozilla.Firefox.Nightly.MSIX  Firefox Nightly (MSIX; plain .Nightly id does NOT exist)

[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Packages = @(
  @{ Name = 'Chrome Canary';  Id = 'Google.Chrome.Canary' },
  @{ Name = 'Edge Canary';    Id = 'Microsoft.Edge.Canary' },
  @{ Name = 'Firefox Nightly';Id = 'Mozilla.Firefox.Nightly.MSIX' }
)

function Test-Installed {
  param([string]$Id)
  $out = winget list --id $Id -e --disable-interactivity --accept-source-agreements 2>$null
  return ($LASTEXITCODE -eq 0 -and (($out -join "`n") -match [regex]::Escape($Id)))
}

function Get-Version {
  param([string]$Id)
  $out = winget list --id $Id -e --disable-interactivity --accept-source-agreements 2>$null
  foreach ($line in $out) { if ($line -match [regex]::Escape($Id) + '\s+([0-9][0-9A-Za-z\.\-]+)') { return $Matches[1] } }
  return '?'
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Error 'winget not found. Install "App Installer" from the Microsoft Store.'
  exit 1
}

Write-Host ("winget: " + (winget --version))
$action = if ($Uninstall) { 'UNINSTALL' } else { 'INSTALL' }
Write-Host "mode: $action  dryrun: $DryRun`n"

foreach ($p in $Packages) {
  $present = Test-Installed -Id $p.Id
  if ($Uninstall) {
    if (-not $present) { Write-Host ("SKIP   {0,-16} {1} (absent)" -f $p.Name, $p.Id); continue }
    Write-Host ("REMOVE {0,-16} {1}" -f $p.Name, $p.Id)
    if (-not $DryRun) { winget uninstall --id $p.Id -e --disable-interactivity }
  }
  else {
    if ($present) { Write-Host ("SKIP   {0,-16} {1} (present {2})" -f $p.Name, $p.Id, (Get-Version $p.Id)); continue }
    Write-Host ("ADD    {0,-16} {1}" -f $p.Name, $p.Id)
    if (-not $DryRun) {
      winget install --id $p.Id -e --disable-interactivity --accept-source-agreements --accept-package-agreements
    }
  }
}

Write-Host "`n=== state ==="
foreach ($p in $Packages) {
  $v = if (Test-Installed $p.Id) { Get-Version $p.Id } else { 'absent' }
  Write-Host ("{0,-16} {1,-30} {2}" -f $p.Name, $p.Id, $v)
}
