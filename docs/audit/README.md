# Site audits 2026-11-05

Read-only audits of the owner websites. Produced by `bun tools/site-audit/run.ts <site|url>` (GET only, 2 concurrent requests, 250 ms gap, no login, robots honoured), run on host `bunos` with Chrome for Testing 157 headless shell and Lighthouse via `bun` (no node/npm). Each site has a hand-written report (`<site>.md`), generated tables (`<site>.measured.md`) and raw data (`<site>.json`).

Method limits: crawls are capped (60 pages, 100 for rosegriffon), link and asset checks are sampled (150 and 120), Lighthouse is lab data (INP not measurable, TBT shown), the headless browser has no GPU, and Lighthouse opens more than 2 connections per page load. A first Lighthouse pass sent a custom request header that created fake CORS console errors; it was discarded and all Lighthouse numbers come from reruns without it.

Cross-check from yolo-re (not copied here): `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), with one section per site.

## Reports

| Site | Report | Owner | Lighthouse mobile perf / a11y / BP / SEO (home) | LCP s | Top blocker |
|---|---|---|---|---|---|
| craft.aphrody.app | [craft.md](craft.md) | yolo-ui-aa | 95 / 100 / 100 / 100 | 2.9 | No CSP; studio pages lack canonical, OG, description, h1 |
| auto.aphrody.com | [auto.md](auto.md) | yolo-ui-aa | 52 / 97 / 100 / 100 | 8.2 | No sitemap, SPA with empty no-JS fallback, slow mobile LCP, no CSP |
| aphrody.com | [aphrody.md](aphrody.md) | yolo-ui-aa | 99 / 98 / 96 / 100 | 1.0 | Public /status exposes internals; /boot.js 404; live copy differs from committed landing.html |
| dragonballfr.com | [dragonballfr.md](dragonballfr.md) | sheron-24 | 39 / 100 / 77 / 100 | 9.0 | Mobile perf 36-64 site-wide, no HTML caching, security.txt 503 |
| rosegriffon.fr (before) | [rosegriffon-before.md](rosegriffon-before.md) | rosegriffon-4a | 47 / 100 / 77 / 100 | 7.2 | Mobile perf, 3.5-5.9 MB community HTML, iergday images 400 |
| yolo.aphrody.com | [yolo.md](yolo.md) | yolo-ui-aa | 100 / 91 / 100 / 91 | 1.0 | Page counts differ from repo (7 vs 8 presets, 124 vs 156 submodules), no description |
| secondary and disabled hosts | [secondary-hosts.md](secondary-hosts.md) | yolo-ui-aa | not run | not run | Disabled hosts return 526; cdn/deploy/nie/video lack CSP |

aphrody.app (apex) redirects every request to a Cloudflare Access login; nothing behind it was measured. Local dev servers: none were running or configured with a reachable URL (yolo-hub documents `cargo leptos serve` on 127.0.0.1:3000, not started); not run.

## Re-run

```
SITE_AUDIT_LH="bun /path/node_modules/.bin/lighthouse" CHROME_PATH=/path/to/chrome-headless-shell \
  bun tools/site-audit/run.ts <craft|auto|aphrody|dragonballfr|yolo|rosegriffon|cdn|...> --out docs/audit
bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-after --max-pages 100
```
