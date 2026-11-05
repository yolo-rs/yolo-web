# YOLO-Web crawl cluster

Status date: 2026-11-05. Every claim below is backed by `docs/receipts/cluster-20261105.txt` or `docs/receipts/replica-smoke-20261105.json` (measured on the PC, Windows 11). Fleet addresses, keys and the Postgres password are deliberately not recorded here; hosts are referenced by their ssh aliases and secrets live in `C:\src\yolo-ai\.yolo\cluster.env` (gitignored).

## Topology (as deployed)

```text
PC (Windows 11)                                   vps (Ubuntu, OVH hub)              bunos (Ubuntu)
 coordinator  Bun.serve :18800 (HTTP + WS) <------ ssh -R 18800 ---- worker "vps"     worker "bunos"
 worker "pc"  (Chrome CDP :9222)                    redis (docker aphrody-redis-1, loopback :6379, reused)
 browsers: chrome 9222, edge canary 9223,           postgres (NEW docker yolo-crawl-pg, loopback :15432)
           firefox nightly 9224 (BiDi), obscura 9225 lightpanda (systemd --user, loopback :9226)
 ssh -L 16379/15432 -> vps  (PC clients)            ssh -R 16379/15432/18800/9222 from the PC -> bunos
 ssh -L 9226 -> vps lightpanda
prod: inventoried read-only, no cluster role (production web/database/CDN preserved).
```

- Tunnel: reused plain ssh (BatchMode, ServerAliveInterval) as scheduled tasks `yolo-tunnel`, `yolo-tunnel-bunos`, `yolo-tunnel-lightpanda`. WireGuard `wg1` is already active on vps and bunos (mesh hub = vps) but the PC is not a peer, so ssh is the PC path. Nothing in `wg1` was changed.
- Queue: Redis list `yolo:crawl:queue` on the existing vps Redis (no auth, loopback only, key prefix `yolo:crawl:`). Per-host politeness lock `yolo:crawl:host:<host>` (SET NX PX 1500) is shared by all workers.
- State: PostgreSQL 18 in a new dedicated container `yolo-crawl-pg` (volume `yolo-crawl-pgdata`, `restart unless-stopped`). Existing Postgres containers on vps were not touched. Tables `crawl_jobs`, `crawl_results` (schema in `packages/web-cluster/src/common.ts`).
- Control and progress: WebSocket `/ws?role=worker|observer`. Workers push `progress` messages that are broadcast to observers; an observer can send `{type:"control",cmd:"pause"|"resume"}` to all workers. HTTP: `POST /enqueue {urls, mode: fetch|cdp}`, `GET /status`, `GET /results`.
- Workers: `packages/web-cluster/src/worker.ts` reuses `@yolo-web/web-crawler` `crawl()` (robots.txt, SSRF guard, per-origin limits) for every job; `cdp` mode additionally runs `cdp.ts` recon (DOM/CSS/JS inventory) on the node's CDP endpoint. Bun APIs used: `Bun.serve` websocket, `Bun.RedisClient`, `Bun.SQL`.

## Run

All shell actions are scripts in `C:\src\yolo-ai\scripts\cluster\`:

| Script | Purpose |
| --- | --- |
| `inventory.ps1` | read-only fleet inventory (ssh BatchMode) |
| `setup-pg.ps1` | idempotent creation of `yolo-crawl-pg` on vps |
| `deploy-workers.ps1` | ship worker sources, write `worker.env` (600), systemd user units on vps/bunos; Lightpanda unit on vps |
| `service.ps1` / `install-services.ps1` | per-service launcher and Windows scheduled-task registration (logon trigger, restart on failure, no time limit); logs in `C:\src\yolo-ai\.yolo\logs\` |
| `build-obscura.ps1` | Obscura release build as a one-shot scheduled task |
| `engines-check.ts`, `mcp-call.ts`, `cluster-smoke.ts`, `replica-smoke.ts`, `collect-receipts.ps1` | verification |

Start everything: `powershell -File install-services.ps1 -Start`. Remote workers: `systemctl --user enable --now yolo-worker` (linger is enabled for the ubuntu user on both hosts).

## Browser engines (receipts: engines-check)

| Engine | Endpoint | Result |
| --- | --- | --- |
| Google Chrome 157 | CDP 9222 | live, recon OK, yolo-web MCP OK |
| Microsoft Edge Canary 159 | CDP 9223 | live as scheduled task, recon OK, MCP OK (stable Edge binary is absent on this PC; Canary is installed) |
| Firefox Nightly 161.0a1 | BiDi 9224 | `session.status` ready=true; Firefox no longer serves CDP, so CDP recon and MCP do not apply |
| Obscura 0.2.0-dev | CDP 9225 | built (`cargo build --release -p obscura-cli --features render`, 6m43s, sccache bypassed) ; recon OK; MCP navigate/evaluate/markdown/links OK after the attach fix (recreates a target when `/json/list` ids are stale) |
| Lightpanda 1.1.0-nightly | CDP 9226 (vps, tunnelled) | recon OK, MCP navigate/markdown/links OK after the empty-target-list fix; no Windows build exists, so it runs on vps |
| Servo 0.7.0 | WebDriver 7002 | upstream release `servoshell` runs headless with `--webdriver`; no CDP; see [ENGINES.md](ENGINES.md) |

## Fixes made along the way

1. `C:\src\yolo-ai\scripts\yolo-web-mcp.ts` never answered `initialize`: web-mcp's entry point only runs `main()` when `import.meta.main`, which is false under `import()`. The wrapper now spawns the entry as a child with inherited stdio. `mcp-probe.ts yolo-web` lists 57 tools.
2. `cdp-client` `listTargets()` returned `/json/list` entries with `id` instead of `targetId`, so every MCP call failed with `-32602`. Normalized to `targetId`.
3. `web-mcp` re-created targets on engines with an empty `/json/list`; it now keeps the attached target.
4. `web-crawler` robots parser reset the group on every `User-agent` line, so Google's grouped `User-agent: *` / `User-agent: Yandex` / `Disallow: /search` was ignored and `/search?q=` was fetched. Consecutive `User-agent` lines now share a group (verified: `/search` is refused). No automated test was added.

## Verification summary

- `bun scripts/mcp-probe.ts yolo-web` returns 57 tools; `mcp-call.ts` navigates `https://example.com/` and returns markdown and links on Chrome, Edge Canary and Lightpanda.
- `cluster-smoke.ts fetch` and `cdp`: 10 jobs each, executed by `pc`, `vps` and `bunos` (see the job table in the receipt). Failures are expected ones: cross-origin redirects refused by the crawler (`www.google.com/about/` to `about.google`), `gstatic.com/generate_204` (empty body), and the robots-disallowed `/search?q=chromium`.
- `replica-smoke.ts`: DOM/CSS/JS inventory of google.com, about.google, developers.google.com and web.dev through Chrome, Edge and Lightpanda with a robots gate and 1.5 s spacing; `google.com/search?q=` skipped by robots. Example: google.com on Chrome 460 nodes, 16 scripts, 42 stylesheets, 1133 CSS rules.
- No CAPTCHA or anti-bot handling was attempted.

## Not done

See `C:\src\yolo-ai\.yolo\BLOCKED.md`. Notably: PC is not a WireGuard peer, no worker on `prod`, Servo not runnable, Obscura MCP incompatibility, Chrome/Edge scheduled tasks end when the browser parent exits (Chrome on 9222 may be a pre-existing process).
