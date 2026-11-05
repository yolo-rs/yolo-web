<#
.SYNOPSIS
    Build a Rust repository on the VPS and copy the artifacts back.

.DESCRIPTION
    1. rsync the repository to <RemoteRoot>/<repo-name>/ on the remote host.
       Regenerable directories (target, node_modules, dist, build, out, .cache,
       .turbo, .next, zig-cache, zig-out, __pycache__, .venv) and secrets
       (.env*, *.pem, *.key) are never transferred. The .git directory is
       skipped unless -IncludeGit is given.
    2. Run `cargo build --release` (or the requested profile) remotely with
       sccache as RUSTC_WRAPPER (configured globally on the VPS).
    3. rsync target/<profile>/ back to <repo>/target/remote/<host>/<profile>/,
       skipping deps/, build/, incremental/ and .fingerprint/.

    rsync runs through Git Bash (MSYS2 rsync installed in %USERPROFILE%\.local\bin)
    and uses the SSH host alias from %USERPROFILE%\.ssh\config.

.PARAMETER RepoPath
    Local repository (directory containing Cargo.toml).
.PARAMETER RemoteHost
    SSH host alias. Default: prod.
.PARAMETER RemoteRoot
    Remote directory that holds build checkouts. Default: /srv/build.
.PARAMETER Profile
    Cargo profile. Default: release.
.PARAMETER CargoArgs
    Extra arguments appended to `cargo build` (for example -p,cross or --features,foo).
.PARAMETER IncludeGit
    Also transfer the .git directory (needed when build scripts call git).
.PARAMETER NoCopyBack
    Build only; do not copy artifacts back.

.EXAMPLE
    .\tools\remote-build.ps1 C:\src\yolo-cross
    .\tools\remote-build.ps1 C:\src\yolo-web -CargoArgs '-p','yolo-browser-cli'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$RepoPath,
    [string]$RemoteHost = 'prod',
    [string]$RemoteRoot = '/srv/build',
    [string]$Profile = 'release',
    [string[]]$CargoArgs = @(),
    [switch]$IncludeGit,
    [switch]$NoCopyBack
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repo = (Resolve-Path -LiteralPath $RepoPath).Path.TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $repo 'Cargo.toml'))) {
    throw "No Cargo.toml in $repo"
}
$name = Split-Path -Leaf $repo
if ($name -notmatch '^[A-Za-z0-9._-]+$') { throw "Repository directory name '$name' is not safe for a remote path" }
if ($RemoteRoot -notmatch '^/[A-Za-z0-9._/-]+$') { throw "RemoteRoot must be an absolute POSIX path" }
if ($Profile -notmatch '^[A-Za-z0-9_-]+$') { throw "Invalid profile name" }

$bash = Join-Path $env:ProgramFiles 'Git\usr\bin\bash.exe'
if (-not (Test-Path -LiteralPath $bash)) { throw "Git Bash not found at $bash" }
$rsyncCandidates = @(
    (Join-Path $env:USERPROFILE '.local\bin\rsync.exe'),
    (Join-Path $env:ProgramFiles 'Git\usr\bin\rsync.exe')
)
$rsync = $rsyncCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $rsync) {
    throw "rsync.exe not found. See docs/REMOTE_BUILD_AND_ARCHIVE.md (MSYS2 rsync package into %USERPROFILE%\.local\bin)."
}

function Invoke-Bash([string]$Script) {
    # Arguments are passed through environment variables to avoid quoting issues.
    # --noprofile skips /etc/profile, so MSYS /usr/bin (ssh, cygpath) must be put on PATH here.
    $full = 'export PATH="/usr/bin:/mingw64/bin:$PATH"; ' + $Script
    & $bash --noprofile --norc -c $full
    return $LASTEXITCODE
}

function ConvertTo-MsysPath([string]$WindowsPath) {
    $p = $WindowsPath -replace '\\', '/'
    if ($p -match '^([A-Za-z]):(.*)$') { return '/' + $Matches[1].ToLower() + $Matches[2] }
    return $p
}

$env:RB_RSYNC = ConvertTo-MsysPath $rsync
$env:RB_SRC = ConvertTo-MsysPath $repo
$env:RB_HOST = $RemoteHost
$env:RB_DEST = "$RemoteRoot/$name"
$env:RB_PROFILE = $Profile

$excludes = @('node_modules', 'target', 'dist', 'build', 'out', '.cache', '.turbo', '.next',
    'zig-cache', 'zig-out', '__pycache__', '.venv', '.env*', '*.pem', '*.key')
if (-not $IncludeGit) { $excludes += '.git' }
$env:RB_EXCLUDES = ($excludes | ForEach-Object { "--exclude=$_" }) -join ' '

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host "[remote-build] rsync $repo -> ${RemoteHost}:$RemoteRoot/$name"
$code = Invoke-Bash @'
set -e
ssh -o BatchMode=yes "$RB_HOST" "mkdir -p '$RB_DEST'"
"$RB_RSYNC" -rltD --delete --partial --info=progress2,stats1 --human-readable \
  --no-perms --no-owner --no-group --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  $RB_EXCLUDES -e "ssh -o BatchMode=yes" "$RB_SRC/" "$RB_HOST:$RB_DEST/"
'@
if ($code -ne 0) { throw "rsync upload failed with exit code $code" }
$uploadSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)

$profileFlag = if ($Profile -eq 'release') { '--release' } elseif ($Profile -eq 'dev') { '' } else { "--profile $Profile" }
$extra = ($CargoArgs | ForEach-Object { "'" + ($_ -replace "'", "'\''") + "'" }) -join ' '
$env:RB_CARGO = "cargo build $profileFlag $extra".Trim()

Write-Host "[remote-build] remote: $env:RB_CARGO"
$sw.Restart()
$code = Invoke-Bash @'
ssh -o BatchMode=yes "$RB_HOST" "cd '$RB_DEST' && export RUSTC_WRAPPER=sccache CARGO_TERM_COLOR=never && $RB_CARGO 2>&1; rc=\$?; echo; sccache --show-stats 2>/dev/null | grep -E 'Compile requests|Cache hits|Cache misses|Cache location' ; exit \$rc"
'@
$buildSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
if ($code -ne 0) { throw "remote cargo build failed with exit code $code (upload ${uploadSeconds}s, build ${buildSeconds}s)" }

$copySeconds = 0
if (-not $NoCopyBack) {
    $profileDir = if ($Profile -eq 'dev') { 'debug' } else { $Profile }
    $env:RB_PROFILE_DIR = $profileDir
    $localOut = Join-Path $repo "target\remote\$RemoteHost\$profileDir"
    New-Item -ItemType Directory -Force -Path $localOut | Out-Null
    $env:RB_LOCAL_OUT = ConvertTo-MsysPath $localOut
    Write-Host "[remote-build] copying artifacts back to $localOut"
    $sw.Restart()
    $code = Invoke-Bash @'
"$RB_RSYNC" -rltD --partial --info=progress2,stats1 --human-readable \
  --no-perms --no-owner --no-group --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  --exclude=deps --exclude=build --exclude=incremental --exclude=.fingerprint \
  -e "ssh -o BatchMode=yes" "$RB_HOST:$RB_DEST/target/$RB_PROFILE_DIR/" "$RB_LOCAL_OUT/"
'@
    $copySeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    if ($code -ne 0) { throw "rsync download of artifacts failed with exit code $code" }
    Get-ChildItem -LiteralPath $localOut -File | Select-Object Name, Length | Format-Table -AutoSize | Out-String | Write-Host
}

Write-Host ("[remote-build] done: upload {0}s, build {1}s, copy-back {2}s" -f $uploadSeconds, $buildSeconds, $copySeconds)
