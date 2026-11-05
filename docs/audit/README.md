# Site audits 2026-11-05

Read-only audits of the owner websites. Produced by `bun tools/site-audit/run.ts <site|url>` (GET only, 2 concurrent requests, 250 ms gap, no login, robots honoured), run on host `bunos` with Chrome for Testing 157 headless shell and Lighthouse via `bun` (no node/npm). Each site has a hand-written report (`<site>.md`), generated tables (`<site>.measured.md`) and raw data (`<site>.json`).

Method limits: crawls are capped (60 pages, 100 for rosegriffon), link and asset checks are sampled (150 and 120), Lighthouse is lab data (INP not measurable, TBT shown), the headless browser has no GPU, and Lighthouse opens more than 2 connections per page load. A first Lighthouse pass sent a custom request header that created fake CORS console errors; it was discarded and all Lighthouse numbers come from reruns without it.

Cross-check from yolo-re (not copied here): `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), with one section per site.

## Reports

| Site | Report | Owner | Lighthouse mobile perf / a11y / BP / SEO (home) | LCP s | Top blocker |
|---|---|---|---|---|---|
| craft.aphrody.app | [craft.md](craft.md) | yolo-ui-aa | 95 / 100 / 100 / 100 | 2.9 | No CSP; studio pages lack canonical, OG, description, h1 |
| auto.aphrody.com | [auto.md](auto.md) | yolo-ui-aa | 52 / 97 / 100 / 100 | 8.2 | No sitemap, SPA with empty no-JS fallback, slow mobile LCP, no CSP |
| auto.aphrody.com (after 93408ded) | [auto-after.md](auto-after.md) | yolo-ui-aa | 80 / 97 / 100 / 100 | 4.8 | Hero image is a CSS background (late LCP), Material Symbols 374 KB, no sitemap, no CSP; CSS 1.29 MB down to 79.6 KB confirmed |
| auto.aphrody.com (round 2, 3bc47ea0) | [auto-after-r2.md](auto-after-r2.md) | yolo-ui-aa | 95-98 / 100 / 100 / 100 | 2.0 | Page 353 KB; /app bundle 331 KB (232 KiB unused); unhashed poster /img/btp-analytique.webp 85.9 KB loaded on /; legal pages lack meta description; sitemap, CSP, security.txt, hashed hero confirmed |
| auto.aphrody.com (round 3, ff8cf73f) | [auto-after-r3.md](auto-after-r3.md) | yolo-ui-aa | 99-100 / 100 / 100 / 100 | 1.3-1.8 | Page 226 KB, h1 prerendered, CSS inlined, 1.2 KB JS on /; poster hashed AVIF still loaded on / (40 KB); /app/connexion script 128 KB (57 KiB unused); /csp-rapport delivery unverified |
| auto.aphrody.com (round 4, 88f036fd) | [auto-after-r4.md](auto-after-r4.md) | yolo-ui-aa | 98-100 / 100 / 100 / 100 | 1.6 | Page 185 KB; poster still fetched on load (16.6 KB mobile, 40.7 KB at 1280 px); /app/connexion 56 KiB unused JS; CLS 0.011 on /mentions-legales; COOP/CORP, /mcp 405 Allow, fallback fonts, video src on click confirmed |
| aphrody.com | [aphrody.md](aphrody.md) | yolo-ui-aa | 99 / 98 / 96 / 100 | 1.0 | Public /status exposes internals; /boot.js 404; live copy differs from committed landing.html |
| dragonballfr.com | [dragonballfr.md](dragonballfr.md) | sheron-24 | 39 / 100 / 77 / 100 | 9.0 | Mobile perf 36-64 site-wide, no HTML caching, security.txt 503 |
| dragonballfr.com (after, owner release 916975c1) | [dragonballfr-after.md](dragonballfr-after.md) | sheron-24 | 49 / 100 / 77 / 100 | 7.2 | security.txt 200 and s-maxage on / and /wiki confirmed (Cloudflare still DYNAMIC); GTM gated but AdSense loads at 6.5 s with no consent; Report-Only script-src omits the cdn host (26-29 CSP issues, BP stays 77); /wiki/episodes CLS 0.48, perf 23 |
| dragonballfr.com (round 2, owner release feb3158a) | [dragonballfr-after-r2.md](dragonballfr-after-r2.md) | sheron-24 | 46 / 100 / 77 / 100 | 8.0 | AdSense gated (0 Google requests without consent), 0 CSP violations on 6 pages, /wiki/episodes CLS 0.479 to 0 and perf 23 to 44, canonical 59/59, titles over 70: 0, BP 100 on timeline, manga, episodes; Cloudflare still DYNAMIC, mobile perf 43-69, home BP 77 (Discord avatar cookies), /wiki/episodes/669 BP 58 (third-party video embed) |
| rosegriffon.fr (before) | [rosegriffon-before.md](rosegriffon-before.md) | rosegriffon-4a | 47 / 100 / 77 / 100 | 7.2 | Mobile perf, 3.5-5.9 MB community HTML, iergday images 400 |
| rosegriffon.fr (after) | [rosegriffon-after.md](rosegriffon-after.md) | rosegriffon-4a | 49 / 100 / 100 / 100 | 7.2 | Mobile perf 42-49, /news LCP 52 s, iergday images 400; community HTML 3.5-5.9 MB down to about 0.21 MB |
| yolo.aphrody.com | [yolo.md](yolo.md) | yolo-ui-aa | 100 / 91 / 100 / 91 | 1.0 | Page counts differ from repo (7 vs 8 presets, 124 vs 156 submodules), no description |
| secondary and disabled hosts | [secondary-hosts.md](secondary-hosts.md) | yolo-ui-aa | not run | not run | Disabled hosts return 526; cdn/deploy/nie/video lack CSP |

aphrody.app (apex) redirects every request to a Cloudflare Access login; nothing behind it was measured. Local dev servers: none were running or configured with a reachable URL (yolo-hub documents `cargo leptos serve` on 127.0.0.1:3000, not started); not run.

## Re-run

```
SITE_AUDIT_LH="bun /path/node_modules/.bin/lighthouse" CHROME_PATH=/path/to/chrome-headless-shell \
  bun tools/site-audit/run.ts <craft|auto|aphrody|dragonballfr|yolo|rosegriffon|cdn|...> --out docs/audit
bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-after --max-pages 100
```
