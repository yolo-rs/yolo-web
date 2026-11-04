# Reproducible Windows dev session profile

`tools/dev-session.ps1` uses the locally installed Aphrody WnClean MCP server for
process and service inventory and for service control. It does not change service
startup settings, terminate processes, or close applications. The default profile
temporarily stops only Windows Search (`WSearch`); Xbox and GameInput are opt-in.

```powershell
# Inspect candidate services and the largest processes (read only)
pwsh -NoProfile -File .\tools\dev-session.ps1 status

# Preview the default service changes
pwsh -NoProfile -File .\tools\dev-session.ps1 start -WhatIf

# Begin a session (requires Windows permission to control WSearch)
pwsh -NoProfile -File .\tools\dev-session.ps1 start

# Include Xbox/GameInput only when they are not needed for this session
pwsh -NoProfile -File .\tools\dev-session.ps1 start -IncludeGamingServices

# Restore services that were running when the session began
pwsh -NoProfile -File .\tools\dev-session.ps1 restore
```

The snapshot is stored in `%LOCALAPPDATA%\YOLO-Web\dev-session.json`. A second
session is refused until the first is restored. If a stop fails, services already
stopped by that invocation are restarted and the journal is removed. A restore
failure leaves the journal in place for retry. The machine name is checked before
restoring. Run `restore` at the end of every session; service recovery policy may
also start a service independently.

The process table is informational. `aphrody-mcp.exe` exposes forceful process
termination, so this profile intentionally never calls that tool. It preserves
build and source-control work such as `git`, `gclient`, `cargo`, `rustc`, `gn`,
`ninja`, `bun`, compilers, terminals, Codex/Aphrody, and user applications.

Service control can fail with Access Denied in a non-elevated shell. In that case
no permanent configuration is changed; run the same command from a Windows
session that already has the required service-control rights. The profile does
not invoke UAC or request credentials.
