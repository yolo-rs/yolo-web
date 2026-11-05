#!/usr/bin/env pwsh
# Read-only detector for the native Chromium-on-Windows toolchain (no WSL/Docker/MSYS2).
# Changes nothing. Reports present/missing against the official requirements in
# docs/browsers/chromium-windows.md and prints a READY/BLOCKED verdict.

$ErrorActionPreference = 'Continue'
function line($k,$v){ "{0,-26} {1}" -f $k, $v }

"=== Chromium-on-Windows toolchain detection ==="
line 'date' (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
line 'host' $env:COMPUTERNAME

# Visual Studio (Build Tools 2026 is a BuildTools product -> needs -products *)
$vsw = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
$vsPath = $null
if (Test-Path $vsw) {
  $vsName = & $vsw -products * -latest -property displayName
  $vsVer  = & $vsw -products * -latest -property installationVersion
  $vsPath = & $vsw -products * -latest -property installationPath
  line 'visual studio' "$vsName ($vsVer)"
  line 'vs installPath' $vsPath
} else { line 'visual studio' 'vswhere MISSING' }

# MSVC toolset + ATL/MFC
$msvc = $null
if ($vsPath) { $msvc = Get-ChildItem "$vsPath\VC\Tools\MSVC" -Directory -EA SilentlyContinue | Select-Object -Last 1 -Expand FullName }
if ($msvc) {
  line 'msvc toolset' (Split-Path $msvc -Leaf)
  line 'cl.exe' (Test-Path "$msvc\bin\Hostx64\x64\cl.exe")
  line 'ATL/MFC (VC.ATLMFC)' (Test-Path "$msvc\atlmfc\include\atlbase.h")
} else { line 'msvc toolset' 'MISSING' }

# Windows SDK + Debugging Tools
$inc = 'C:\Program Files (x86)\Windows Kits\10\Include'
$sdks = if (Test-Path $inc) { (Get-ChildItem $inc -Directory | Where-Object Name -match '^10\.' | Select-Object -Expand Name) -join ', ' } else { 'none' }
line 'windows 11 SDKs' $sdks
line 'SDK Debugging Tools' (Test-Path 'C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe')

# depot_tools
$dt = ($env:PATH -split ';' | Where-Object { $_ -like '*depot_tools*' } | Select-Object -First 1)
line 'depot_tools on PATH' ($(if ($dt) { $dt } else { 'NOT on PATH' }))
line 'depot_tools fetch/gn' ((Test-Path 'C:\src\depot_tools\fetch.py') -and (Test-Path 'C:\src\depot_tools\gn.bat'))

# env vars across scopes
foreach ($n in 'DEPOT_TOOLS_WIN_TOOLCHAIN','vs2026_install','GYP_MSVS_OVERRIDE_PATH') {
  $p=[Environment]::GetEnvironmentVariable($n,'Process'); $u=[Environment]::GetEnvironmentVariable($n,'User'); $m=[Environment]::GetEnvironmentVariable($n,'Machine')
  line "env $n" ("process='$p' user='$u' machine='$m'")
}

# existing checkout
line 'checkout C:\src\chromium' (Test-Path 'C:\src\chromium\src\.git')

# disk
$c = Get-PSDrive C
$freeGB = [math]::Round($c.Free/1GB,1)
line 'C: free (GB)' $freeGB
line 'C: required (GB)' '100 (NTFS)'

"`n=== verdict ==="
$blockers = @()
if ($freeGB -lt 100) { $blockers += "DISK: C: has ${freeGB}GB free, Chromium needs >=100GB (build on another volume)" }
if ($msvc -and -not (Test-Path "$msvc\atlmfc\include\atlbase.h")) { $blockers += "COMPONENT: VC.ATLMFC missing (required)" }
if (-not [Environment]::GetEnvironmentVariable('vs2026_install','User') -and -not [Environment]::GetEnvironmentVariable('vs2026_install','Machine') -and -not $env:vs2026_install) { $blockers += "ENV: vs2026_install not set persistently" }
if ($blockers.Count -eq 0) { "READY" } else { "BLOCKED:"; $blockers | ForEach-Object { " - $_" } }
