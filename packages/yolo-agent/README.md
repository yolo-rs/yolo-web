# yolo-agent

Browser use and computer use for yolo-chromium and Chromium-family browsers: an
observe-act agent core, an MV3 extension (side panel, service worker driver,
offscreen relay, WebMCP provider), an MCP bridge, and a compiled launcher.
Bun only, zero npm dependencies.

Last verified: 2026-11-05, Windows 11 x64 (Bun 1.4.4-canary) and bunos Linux x64
(Bun 1.4.6-canary). yolo-chromium = CEF 156.0.15 / Chromium 156.0.8078.80 built
from this tree. Chrome 157.0 (branded) was used for core tests.

## Status

| Area                                                                                                                            | Status                                                                                                                                                                              | Evidence                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Observe-act core over CDP (WebSocket)                                                                                           | built                                                                                                                                                                               | `test/e2e.test.ts`, scripted run on yolo-chromium and Chrome                                     |
| Observation: AX tree compaction, stable refs, optional screenshot                                                               | built                                                                                                                                                                               | `test/unit.test.ts`, e2e ref-stability test                                                      |
| Actions: click, type, key, scroll, drag, select, upload, navigate, tabs, wait_for, extract, screenshot, dialog, evaluate, batch | built (drag is pointer events only, no native HTML5 DnD; upload and cross-origin iframes not covered by e2e)                                                                        | e2e covers navigate, type, select, click, wait_for, extract, tabs, key, scroll, dialog, evaluate |
| Streamed tool-call execution (act when the call JSON closes)                                                                    | built, verified with mocked SSE and a scripted model                                                                                                                                | `JsonObjectAccumulator` + stream test; `overlapSavedMs` in the latency report                    |
| Speculative next-observation prefetch                                                                                           | built                                                                                                                                                                               | latency report `prefetchHit`                                                                     |
| Per-step timing receipts                                                                                                        | built                                                                                                                                                                               | `StepReceipt`, `TurnReceipt` in `src/loop.ts`                                                    |
| Anthropic Messages streaming adapter                                                                                            | built, offline-tested; live path untested (no key available)                                                                                                                        | mocked-fetch tests; key from env/getter, redacted from errors                                    |
| Other providers                                                                                                                 | planned                                                                                                                                                                             | `ModelClient` interface exists                                                                   |
| Prompt-injection guard                                                                                                          | built (advisory flags plus fencing, not a guarantee)                                                                                                                                | `src/safety.ts`, unit + e2e on fixture bait                                                      |
| Autonomy: ask / auto / nhitl, nhitl opt-in, audit log                                                                           | built                                                                                                                                                                               | `test/bridge.test.ts`, `test/unit.test.ts`                                                       |
| MV3 extension: service worker, offscreen, side panel, WebMCP provider                                                           | built; loads in yolo-chromium 156 (service worker and offscreen document confirmed); side panel page renders and talks to the worker; docked side-panel UI not seen (headless only) | `YOLO_AGENT_EXT_E2E=1` e2e, manual CDP checks                                                    |
| Extension tool path (chrome.debugger) driven through the bridge                                                                 | built                                                                                                                                                                               | e2e: navigate, observe, type via extension; manual MCP session fill-and-submit                   |
| WebMCP provider (polyfill, draft IDL)                                                                                           | built; native `document.modelContext` is absent by default in Chrome 157 and CEF 156 (checked on a secure localhost page)                                                           | `test/extension.test.ts`                                                                         |
| WebMCP consumer (`webmcp_list`, `webmcp_call`, declarative `form[toolname]` listing)                                            | built; declarative forms are listed, not invoked                                                                                                                                    | e2e                                                                                              |
| Bridge: MCP streamable HTTP, MCP stdio, WebSocket events with `server.publish`, approvals                                       | built                                                                                                                                                                               | `test/bridge.test.ts` (14 tests), compiled binary stdio session                                  |
| Remote desktop (yolo-desktop) behind allowlist and token                                                                        | partial: proxy verified against a fake stdio MCP server; the real `yolo-desktop-mcp.ts` did not start (missing `@modelcontextprotocol/server` in `C:\src\yolo-ai`)                  | `test/bridge.test.ts`                                                                            |
| Headless mode                                                                                                                   | built on yolo-chromium (`--headless`, no top-level window observed) and Chrome (`--headless=new`)                                                                                   | e2e, process window check                                                                        |
| Full GUI mode                                                                                                                   | built (launched without `--headless`, e2e passes); window not screenshotted                                                                                                         | latency report `gui`                                                                             |
| Compiled binary (`bun build --compile --bytecode`) with embedded extension                                                      | built: windows-x64 executed end to end (launch, load extension, provision, bridge, MCP); linux-x64 built and `--help` run on bunos; darwin-arm64 built, not executed                | sizes below                                                                                      |
| Best-practice tools: `audit_page`, `audit_a11y`, `audit_errors`, `trace_performance`                                            | built; heuristics, not Lighthouse scores; `trace_performance` needs raw CDP                                                                                                         | e2e, `summarizeTrace` unit test                                                                  |
| Chromium patch queue entries                                                                                                    | none added (queue is empty); proposals below                                                                                                                                        | n/a                                                                                              |
| Native messaging transport                                                                                                      | planned (loopback WebSocket is used instead)                                                                                                                                        | n/a                                                                                              |
| Human takeover / pause on user input                                                                                            | planned (Stop button only)                                                                                                                                                          | n/a                                                                                              |
| OOPIF (cross-origin iframe) targets, shadow DOM piercing beyond the AX tree                                                     | planned                                                                                                                                                                             | n/a                                                                                              |
| Live model run with real latency                                                                                                | not measured                                                                                                                                                                        | no API key in this environment                                                                   |

## Layout

- `src/` agent core: `cdp.ts` transport, `page.ts` session and buffers,
  `observe.ts` AX compaction and refs, `browser.ts` actions, `spec.ts` action
  schemas, `tools.ts` tool registry with approval and audit, `loop.ts`
  streamed loop, `model.ts` Anthropic adapter and scripted stub, `audits.ts`
  best-practice tools, `safety.ts`, `mcp.ts`, `bridge.ts`, `launcher.ts`,
  `provision.ts`, `cli.ts`.
- `extension/` MV3 sources. `bun run build:ext` writes `dist/extension`.
- `fixtures/server.ts` local fixture site. `scripts/e2e.ts` writes
  `dist/agent-latency.json`. `scripts/compile.ts` builds the binaries.

## Use

```sh
bun run build:ext
# bridge + browser with the extension, MCP on http://127.0.0.1:<port>/mcp
YOLO_CHROMIUM=<path to yolo-chromium launcher> bun src/cli.ts serve --driver extension --headless
# MCP over stdio for Claude Code or Codex
bun src/cli.ts mcp --autonomy auto
# one-shot run with a live model (key from the environment only)
ANTHROPIC_API_KEY=... bun src/cli.ts run "open example.com and summarize it"
# compiled
bun run scripts/compile.ts windows-x64,linux-x64,darwin-arm64
```

`serve` writes `<profile>/bridge.json` with the URL and bearer token (mode 0600
where supported). HTTP callers send `Authorization: Bearer <token>`; desktop
tools additionally need `x-yolo-desktop-token`.

Branded Google Chrome 137+ ignores `--load-extension` ("not allowed in Google
Chrome, ignoring"); use yolo-chromium or Chromium. In branded Chrome the CDP
driver (`--driver cdp`, the default) still works without the extension. A
reused profile keeps the previous extension service worker script: use a fresh
profile or bump the extension version when you rebuild.

## Tool surface

`browser_observe`, `browser_navigate`, `browser_click`, `browser_type`,
`browser_key`, `browser_scroll`, `browser_drag`, `browser_select`,
`browser_upload`, `browser_tabs`, `browser_wait_for`, `browser_extract`,
`browser_screenshot`, `browser_dialog`, `browser_evaluate`, `browser_batch`,
`audit_page`, `audit_a11y`, `audit_errors`, `trace_performance`,
`webmcp_list`, `webmcp_call`, and `desktop_<tool>` for allowlisted desktop
tools. Observations list `[eN] role "name"` lines; refs stay stable within a
document and reset on navigation.

## Safety model

- Page content is data. Observations, extracts and audit output are wrapped in
  `<untrusted_page_content>`; the fence is defused inside the data, invisible
  characters are stripped, and instruction-like text raises a WARNING line.
  The system prompt repeats the rule. This lowers risk and is not a proof.
- Autonomy: `ask` approves every mutating action, `auto` asks only for
  `evaluate`, `upload`, `webmcp_call`, desktop actions, `nhitl` asks nothing.
  `nhitl` and `--no-sandbox` need the explicit `--nhitl` flag per process (the
  extension needs the side-panel opt-in per browser session). The bridge binds
  loopback only, checks Host and Origin, and requires a bearer token.
- With no approver connected, gated actions are denied immediately.
- The audit log (`<profile>/audit.jsonl`, or storage in the extension) records
  action, outcome and timing. Typed text, script bodies and file paths are
  recorded by size only; known secret shapes are redacted.
- The model API key is read from the environment (or the session-memory field
  in the side panel) and is never written to disk, logs or errors.
- The agent is instructed to use only credentials the user supplied.
  Nothing in the code reads cookies or storage on its own; `browser_evaluate`
  can, which is why it is gated outside `nhitl`.

## Extension permissions

| Permission                         | Why                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `debugger`                         | CDP through `chrome.debugger` for the tool path                                 |
| `tabs`                             | list, open, activate, close tabs                                                |
| `storage`                          | settings in `storage.local`, bridge token and API key in `storage.session` only |
| `offscreen`                        | persistent page that holds the bridge WebSocket and keep-alive                  |
| `sidePanel`                        | side panel UI                                                                   |
| host `https://api.anthropic.com/*` | model calls from the service worker                                             |
| content scripts on `<all_urls>`    | WebMCP polyfill (MAIN world) and a count-only relay                             |

No `scripting`, `cookies`, `webRequest`, `nativeMessaging` or broad host access.

## WebMCP

The draft (W3C Web Machine Learning CG, editor draft 2 Nov 2026) exposes
`ModelContext` on `document.modelContext` (secure contexts) with
`registerTool(tool, {signal, exposedTo})`, `getTools()`, `executeTool()`; there
is no `unregisterTool` (abort the registration signal). Earlier builds used
`navigator.modelContext`; the code reads `document.modelContext` first and
falls back to `navigator`. Whether any Chromium 156 build ships it behind a
flag or origin trial was not verified: default Chrome 157 and the CEF 156 shell
do not expose it. The extension therefore polyfills the draft IDL when absent,
and registers no browser-control tool into pages.

## Latency (scripted model, no network)

`dist/agent-latency.json`, yolo-chromium CEF 156, 3 runs per mode, Windows x64,
headless and GUI. The stub waits 40 ms before the call and 80 ms after it to
imitate generation.

| Metric (median)                                                     | headless | GUI    |
| ------------------------------------------------------------------- | -------- | ------ |
| Run total (navigate, 7-step form batch, final turn)                 | 435 ms   | 433 ms |
| 7-step batch execution                                              | 269 ms   | 268 ms |
| Observation ready to first action start (includes 40 ms stub delay) | 41 ms    | 41 ms  |
| Last action to next observation ready                               | 34 ms    | 20 ms  |
| Execution hidden behind model generation                            | 127 ms   | 141 ms |

Through the extension and bridge (headless yolo-chromium): MCP `browser_tabs
list` 16 ms round trip, `browser_observe` 6 to 11 ms, a 7-step fill-and-submit
batch 295 ms. These are local numbers for a stub; real model latency is
dominated by the provider and was not measured.

## Binaries

| Target       | Size      | Built on                  | Executed                         |
| ------------ | --------- | ------------------------- | -------------------------------- |
| windows-x64  | 145.0 MiB | Windows, Bun 1.4.4-canary | yes (serve, mcp)                 |
| linux-x64    | 189.3 MiB | bunos, Bun 1.4.6-canary   | `--help` only (no browser there) |
| darwin-arm64 | 85.6 MiB  | Windows, cross-target     | no                               |

Bun 1.4.6-canary on bunos could not download cross targets, so only linux-x64
was built there.

## Chromium patch proposals (not applied)

The patch queue under `patches/chromium` is empty and there is no Chromium
source build on this machine, so nothing was written or checked. Candidates, if
the shell moves from CEF to a source build:

1. Bundle the extension as a component extension (`ComponentLoader`) so it is
   present without `--load-extension` or a forcelist CRX.
2. Default-enable the WebMCP flag set the project wants for testing, once the
   target Chromium version is chosen and its flag name is verified.

Neither is needed today: yolo-chromium honours `--load-extension` and the
launcher already passes it.

## Not verified

- A live model run (no API key here).
- The side panel docked in a headed yolo-chromium window.
- The real yolo-desktop MCP server through the proxy.
- The darwin-arm64 binary, and Linux or macOS browsers.
- `chrome.debugger` refusing the Tracing domain (assumed, so `trace_performance`
  is only offered on the raw CDP driver).
- Behaviour under real prompt-injection attacks beyond the fixture bait.
