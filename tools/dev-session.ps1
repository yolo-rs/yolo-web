[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('status', 'start', 'restore')]
    [string] $Action = 'status',

    # Opt in only when Xbox services and game input are not needed in this session.
    [switch] $IncludeGamingServices,

    # Show the planned service actions without changing state.
    [switch] $WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:WincleanExe = if ($env:WINCLEAN_MCP_BIN -and (Test-Path -LiteralPath $env:WINCLEAN_MCP_BIN)) {
    $env:WINCLEAN_MCP_BIN
} elseif (Test-Path -LiteralPath 'C:\Windows\System32\aphrody-mcp.exe') {
    'C:\Windows\System32\aphrody-mcp.exe'
} else {
    throw 'Aphrody WnClean MCP executable was not found. Set WINCLEAN_MCP_BIN.'
}
$script:JournalPath = Join-Path $env:LOCALAPPDATA 'YOLO-Web\dev-session.json'
$script:RpcId = 0

function Invoke-Winclean {
    param(
        [Parameter(Mandatory)] [string] $Tool,
        [hashtable] $Arguments = @{}
    )

    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $script:WincleanExe
    $start.ArgumentList.Add('server')
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Failed to start aphrody-mcp server.' }

    try {
        $script:RpcId++
        $initialize = @{
            jsonrpc = '2.0'; id = $script:RpcId; method = 'initialize'
            params = @{ protocolVersion = '2025-06-18'; capabilities = @{}; clientInfo = @{ name = 'yolo-web-dev-session'; version = '1.0.0' } }
        } | ConvertTo-Json -Depth 12 -Compress
        $process.StandardInput.WriteLine($initialize)
        $initResponse = $process.StandardOutput.ReadLine() | ConvertFrom-Json -AsHashtable
        if ($initResponse.ContainsKey('error')) { throw "WnClean MCP initialization failed: $($initResponse.error.message)" }
        $process.StandardInput.WriteLine('{"jsonrpc":"2.0","method":"notifications/initialized"}')

        $script:RpcId++
        $call = @{
            jsonrpc = '2.0'; id = $script:RpcId; method = 'tools/call'
            params = @{ name = $Tool; arguments = $Arguments }
        } | ConvertTo-Json -Depth 12 -Compress
        $process.StandardInput.WriteLine($call)
        $response = $process.StandardOutput.ReadLine() | ConvertFrom-Json -AsHashtable
        if ($response.ContainsKey('error')) { throw "WnClean $Tool failed: $($response.error.message)" }
        if ($response.result.isError) {
            $detail = ($response.result.content | ForEach-Object text) -join ' '
            throw "WnClean $Tool failed: $detail"
        }
        return $response.result
    } finally {
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(3000)) { $process.Kill(); $process.WaitForExit() }
        $process.Dispose()
    }
}

function Get-WincleanData {
    param([Parameter(Mandatory)] $Result)
    if ($Result.structuredContent) { return $Result.structuredContent }
    foreach ($block in $Result.content) {
        if ($block.text) {
            try { return ($block.text | ConvertFrom-Json -AsHashtable) } catch { }
        }
    }
    return $Result.content
}

function Get-ServiceSnapshot {
    $data = Get-WincleanData (Invoke-Winclean -Tool 'list_services' -Arguments @{})
    if ($data -is [System.Collections.IDictionary]) {
        $key = @($data.Keys | Where-Object { $_ -ieq 'services' } | Select-Object -First 1)
        if ($key.Count) { return @($data[$key[0]]) }
    }
    return @($data)
}

function Get-ProcessSnapshot {
    $data = Get-WincleanData (Invoke-Winclean -Tool 'list_processes' -Arguments @{ sortBy = 'memory'; limit = 20 })
    if ($data -is [System.Collections.IDictionary]) {
        $key = @($data.Keys | Where-Object { $_ -ieq 'processes' } | Select-Object -First 1)
        if ($key.Count) { return @($data[$key[0]]) }
    }
    return @($data)
}

function Invoke-ServiceAction {
    param([ValidateSet('stop_service', 'start_service')] [string] $Tool, [string] $Name)
    $result = Invoke-Winclean -Tool $Tool -Arguments @{ name = $Name }
    $message = ($result.content | ForEach-Object text) -join ' '
    if ($message) { Write-Host $message }
}

switch ($Action) {
    'status' {
        $services = Get-ServiceSnapshot
        $procs = Get-ProcessSnapshot
        Write-Host 'Aphrody WnClean — services configured for temporary pause:'
        $candidateNames = @('WSearch')
        if ($IncludeGamingServices) { $candidateNames += @('XboxService', 'GameInputRedistService') }
        $services | Where-Object { $_.Name -in $candidateNames } |
            Select-Object Name, DisplayName, Status, StartType | Format-Table -AutoSize
        Write-Host "Top $($procs.Count) processes by memory (observation only):"
        $procs | Select-Object -First 20 Name, Pid,
            @{ Name = 'WorkingSetGiB'; Expression = { [math]::Round($_.WorkingSetBytes / 1GB, 2) } },
            @{ Name = 'PrivateGiB'; Expression = { [math]::Round($_.PrivateWorkingSetBytes / 1GB, 2) } } |
            Format-Table -AutoSize
        if (Test-Path -LiteralPath $script:JournalPath) {
            Write-Host "Active session journal: $script:JournalPath (run 'restore' to restore services)."
        }
    }
    'start' {
        if (Test-Path -LiteralPath $script:JournalPath) {
            throw "A session journal already exists at '$script:JournalPath'. Restore it before starting another session."
        }
        $candidateNames = @('WSearch')
        if ($IncludeGamingServices) { $candidateNames += @('XboxService', 'GameInputRedistService') }
        $services = Get-ServiceSnapshot
        $selected = @($services | Where-Object { $_.Name -in $candidateNames -and $_.Status -eq 'Running' })
        if ($WhatIf) {
            Write-Host 'WhatIf: services that would be stopped:'
            $selected | Select-Object Name, DisplayName, Status, StartType | Format-Table -AutoSize
            return
        }
        $directory = Split-Path -Parent $script:JournalPath
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        $journal = @{
            schemaVersion = 1
            createdAt = [DateTimeOffset]::Now.ToString('o')
            machine = $env:COMPUTERNAME
            services = @($selected | ForEach-Object { @{ name = $_.Name; status = $_.Status; startType = $_.StartType } })
        }
        $journal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $script:JournalPath -Encoding utf8
        $stopped = [Collections.Generic.List[string]]::new()
        try {
            foreach ($service in $selected) {
                Invoke-ServiceAction -Tool 'stop_service' -Name $service.Name
                $stopped.Add([string] $service.Name)
            }
            Write-Host "Dev session active. Restore with: pwsh -File `"$PSCommandPath`" restore"
            Write-Host "State journal: $script:JournalPath"
        } catch {
            Write-Warning 'A service stop failed; restoring every service recorded as running.'
            foreach ($name in $stopped) {
                try { Invoke-ServiceAction -Tool 'start_service' -Name $name } catch { Write-Warning "Could not restore ${name}: $_" }
            }
            Remove-Item -LiteralPath $script:JournalPath -Force -ErrorAction SilentlyContinue
            throw
        }
    }
    'restore' {
        if (-not (Test-Path -LiteralPath $script:JournalPath)) {
            Write-Host 'No dev-session journal exists; nothing to restore.'
            return
        }
        $journal = Get-Content -LiteralPath $script:JournalPath -Raw | ConvertFrom-Json -AsHashtable
        if ($journal.machine -ne $env:COMPUTERNAME) { throw 'Journal machine does not match this host; refusing service changes.' }
        $current = Get-ServiceSnapshot
        $restoreFailed = $false
        foreach ($service in $journal.services) {
            $entry = $current | Where-Object Name -eq $service.name | Select-Object -First 1
            if (-not $entry) { Write-Warning "Service '$($service.name)' no longer exists."; $restoreFailed = $true; continue }
            if ($service.status -eq 'Running' -and $entry.Status -ne 'Running') {
                try { Invoke-ServiceAction -Tool 'start_service' -Name $service.name }
                catch { Write-Warning "Could not restore $($service.name): $_"; $restoreFailed = $true }
            }
        }
        if ($restoreFailed) { throw "Some services could not be restored; journal retained at '$script:JournalPath'." }
        Remove-Item -LiteralPath $script:JournalPath -Force
        Write-Host 'Services that were running before this session have been started. Their startup configuration was not changed.'
    }
}
