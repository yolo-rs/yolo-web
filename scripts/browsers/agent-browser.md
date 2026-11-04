# Driving a browser headlessly for agents

Three layers are available: (A) the repo's native Rust/Bun browser tooling, (B) any
installed Canary driven over CDP, (C) the external `browser-use` CLI/MCP. All of them
must run against a **throwaway `--user-data-dir`**, never the user's real profile
(hard boundary; see `docs/browsers/SIGN-IN.md`).

Smoke result for (B): `docs/browsers/receipts/agent-browser-smoke.txt`.

## A. Native repo tooling (public tree)

- **`obscura` CLI** (`crates/obscura-cli`, bins `obscura` / `obscura-worker`):
  - `obscura serve --port 9222 [--host 127.0.0.1]` — CDP server for agents.
  - `obscura scrape <url>` / `obscura fetch <url>` — one-shot headless fetch/scrape.
  - `obscura mcp` — expose browser tools over MCP.
  - Globals: `--stealth`, `--proxy`, `--user-agent`, `--obey-robots`,
    `--allow-private-network`, `--storage-dir`. Build features: `stealth`, `render`
    (`render` enables CDP `Page.captureScreenshot`).
  - Build/run: `cargo run -p obscura-cli --features render -- serve --port 9222`.
- **`yolo-browser` CLI** (`apps/yolo-browser-cli`):
  - `yolo-browser serve --port 9222 --width 1280 --height 800` — CDP WS server for
    Playwright / Puppeteer / Bun CDP clients + Human Live View.
  - `yolo-browser query --html <file|str> --selector <css>`,
    `yolo-browser shield-check --url <u>`, `yolo-browser info --json`.
  - Stealth + Brave Shields default on; `--allow-private-network` for localhost.
- **`ai-agent-runner`** (`apps/ai-agent-runner`, Bun): step runner with actions
  `navigate|click|type|evaluate|extract-markdown|screenshot`, Brave Shields domain
  blocking + UTM/fbclid/gclid stripping. Run: `bun apps/ai-agent-runner/src/index.ts`.

## B. Installed Canary over CDP (no build needed) — smoked here

Chrome Canary: `%LOCALAPPDATA%\Google\Chrome SxS\Application\chrome.exe`
Edge Canary:   `%LOCALAPPDATA%\Microsoft\Edge SxS\Application\msedge.exe`

Launch an isolated headless instance with a CDP endpoint:
```powershell
$prof = "$env:TEMP\agent-run"          # throwaway, NOT the user's profile
& "$env:LOCALAPPDATA\Google\Chrome SxS\Application\chrome.exe" `
  --headless=new --disable-gpu --no-first-run --no-default-browser-check `
  --user-data-dir=$prof --remote-debugging-port=9465 --remote-allow-origins=* about:blank
curl http://127.0.0.1:9465/json/version      # agent attach surface
```
- `--remote-allow-origins=*` is **required** by Chrome 111+ for CDP WebSocket clients.
- Attach from Playwright (`connectOverCDP("http://127.0.0.1:9465")`), Puppeteer
  (`puppeteer.connect({browserURL})`), a Bun CDP client, or `browser-use`.
- Screenshot via CDP (the CLI `--screenshot` flag writes a 0-byte file under
  Chrome 159 new-headless — use CDP `Page.captureScreenshot` instead):
```bash
bun scripts/browsers/cdp-screenshot.ts 9465 https://example.com out.png
```
- Teardown: kill only processes whose command line carries your unique
  `--user-data-dir` marker; never `Get-Process chrome | Stop-Process` (that would
  kill the user's browser).

## C. browser-use (external)

- CLI: `uvx browser-use` (pulls the package + a Chromium on first run — sizeable;
  mind C: free space). MCP tools: `browser_exec`, `browser_screenshot`.
- browser-use attaches to a **running Chrome CDP endpoint**. For agent isolation,
  point it at a dedicated headless instance launched as in (B) with a throwaway
  profile — do **not** attach it to the user's personal/synced Chrome.

## Agent desktop (documented, nothing installed, no remote connected)

- **DeskVNC** (`deskvnc` skill / `dvv` CLI): drives real Windows/Linux/macOS desktops
  over VNC/RDP/SSH for full desktop automation. Use it when the task needs the OS GUI,
  not just a browser. No host was connected here.
- **browser-use** covers the browser-automation slice of "agent desktop".
- Nothing desktop-related was installed; no remote machine was contacted.
