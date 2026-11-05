# auto.aphrody.com audit, round 4 after release 20261105T134013Z-88f036fd

Measured 2026-11-05 13:45-14:15 UTC from bunos (Chrome for Testing 157.0.8103.38 headless shell, Lighthouse via `bun`, puppeteer-core via `bun`; own temp dir `~/audit-run-r4`, own random debugging ports, separate from the concurrent dragonballfr.com and yolo.aphrody.com audits). Tool: `bun tools/site-audit/run.ts auto --name auto-after-r4` (`--out out`, copied here; the committed HEAD version of the script was used). Raw: [auto-after-r4.json](auto-after-r4.json) (key `extra` holds the 13 standalone Lighthouse runs, the interaction log and the console/CSP sweep), tables: [auto-after-r4.measured.md](auto-after-r4.measured.md). Earlier: [auto.md](auto.md) (before), [auto-after.md](auto-after.md) (r1), [auto-after-r2.md](auto-after-r2.md) (r2), [auto-after-r3.md](auto-after-r3.md) (r3).

Limits: GET only (crawler, curl, browser page loads), 2 concurrent crawl requests, 250 ms gap, no login, no custom headers. Nothing was POSTed. In the puppeteer runs every request to `/csp-rapport` was aborted client-side; zero such requests were attempted (`blockedReports` empty). The tool run and standalone Lighthouse runs used a normal browser. Lighthouse is lab data and varies run to run (`/` perf 98, 100, 99 in three runs; TBT 49-134 ms). CLS values are the median of 3 standalone mobile Lighthouse runs per page.

`/health`: `{"ok":true,"version":"20261105T134013Z-88f036fd","commit":"95d163aa35a464b6b3859601c59bcb49e38db4bc"}`, matches the release and commit 95d163a given by the owner.
Crawl: 11 URLs fetched (10 x 200, `/mcp` 405), 15 own-host assets checked, 0 4xx/5xx.

## Before / r1 / r2 / r3 / r4

| Metric | Before | r1 | r2 | r3 | r4 |
|---|---|---|---|---|---|
| Mobile perf `/` | 52 | 80 | 95 (tool), 98 (standalone) | 99, 100 | 99 (tool); 98, 100, 99 (3 standalone) |
| Mobile a11y / BP / SEO `/` | 97 / 100 / 100 | 97 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 |
| Mobile LCP `/` | 8.2 s | 4.8 s | 2.0 s | 1.8 s (tool), 1.3 s (standalone) | 1.6 s (tool); 1.61, 1.61, 1.63 s (standalone) |
| Mobile TBT `/` | 393 ms | 164 ms | 246 and 113 ms | 80 and 10 ms | 112 ms (tool); 134, 49, 68 ms |
| Mobile CLS `/` | 0 | 0 | 0 | 0 | 0, 0, 0 (median 0) |
| Desktop perf / LCP / TBT `/` | 94 / 1.4 s / 25 ms | 99 / 0.9 s / 0 ms | 100 / 0.6 s / 3 ms | 100 / 0.4 s / 0 ms | 100 / 0.4 s / 0 ms (tool and standalone) |
| Mobile transferred `/` (Lighthouse) | not recorded | 872,407 B (15 req) | 353,050 B (15 req) | 225,781 B (14 req) | 184,851-185,065 B (13 req), 269,386 B uncompressed |
| Transferred `/` at viewport 1280 (puppeteer, fresh profile) | - | - | - | - | 241,687 B (13 req) |
| JS on `/` | - | - | main chunk 89,698 B | 1,245 B (1 script) | 1,273 B (`/accueil-ilots-j3heq64b.js`, 1,772 B raw) |
| Film poster on `/` | - | - | `/img/btp-analytique.webp` 85,904 B, unhashed | hashed AVIF 1600, 40,327 B | mobile: AVIF 800, 16,557 B; desktop 1280: AVIF 1600, 40,716 B (see below) |
| Mobile CLS `/mentions-legales` | - | - | - | 0.100 | 0.0106, 0.0106, 0.0091 (median 0.0106) |
| Mobile CLS `/telechargements` | - | - | - | 0.037 | 0.0003 x 3 (median 0.0003) |
| Mobile CLS `/app/connexion` | - | - | - | 0.059 | 0.0001 x 3 (median 0.0001) |
| `/app/connexion` transferred | - | - | 331,376 B script alone | 214,580 B (11 req) | 214,722-214,831 B (10 req); script 127,995 B (384,741 B raw) |
| `/app/connexion` mobile perf | - | - | 97 | 100 | 100 (tool); 99, 99, 100 |
| `/app/connexion` unused JS / CSS (Lighthouse) | - | - | 232 KiB JS | 57 KiB / 16 KiB | 56 KiB / 16 KiB |
| COOP / CORP on HTML | absent | absent | absent | absent | `same-origin` / `same-origin` |
| `GET /mcp` | 405 | 405 | 405 | 405 | 405, `allow: POST`, JSON body |
| Console errors, 7 pages | - | - | 1 (`/v1/moi` 401) | 0 | 0 |

## Owner claims

| Claim | Measured | Result |
|---|---|---|
| Release 88f036fd / commit 95d163a live | `/health` returns exactly that | Confirmed |
| Video `src` set only on click | Raw HTML (identity, 112,642 B): one `<video>` (inside `<template id="modele-film">`), attributes `playsInline preload=none width height aria-label`, no `src`, no `<source>`. Live DOM after load (networkidle0): `src` attribute null, `currentSrc` null, `readyState` 0, paused. After clicking `.btp-film-lancer`: `src="/media/lancement-btp.mp4"`, `paused=false`, `controls=true`, `readyState=4`, `currentTime` 2.78 s after 3 s, `error=null`, overlay and button removed; network: `GET /media/lancement-btp.mp4` 206 | Confirmed |
| Poster is a lazy `<picture>` overlay reusing the hero files | Template holds `<picture class="btp-heros-film-affiche">` with AVIF 800/1600 + WebP fallback and `<img loading="lazy">`, same hashed files as the hero capture (`btp-analytique-800-beae38c8cc.avif`, `-1600-a3630c07b5.avif`). No separate poster file | Confirmed |
| Poster no longer fetched on a fresh load | Still fetched. The island runs `HEAD /media/lancement-btp.mp4` on load (200), swaps the capture for the film template, and the poster `<img>` (in the viewport) loads: mobile 412x823 dpr 1.75: `btp-analytique-800-beae38c8cc.avif` 16,557 B; desktop 1280x900: `btp-analytique-1600-a3630c07b5.avif` 40,716 B (about 17% of that page's 241,687 B). It is the same file the hero capture used, so there is no second image request, and `.btp-heros-capture` is gone after the swap. The mp4 body is not fetched before click | Not confirmed as "not fetched"; confirmed as hero file reuse with no extra request, 800 px variant on mobile |
| Metric-matched fallback fonts | `<style>` in `/` holds `@font-face{font-family:Inter repli;src:local(Arial),local(ArialMT),local(Liberation Sans),local(Helvetica);size-adjust:107%;ascent-override:90.54%;descent-override:22.54%;line-gap-override:0%}` and `Plus Jakarta Sans repli` (`local(Arial Bold)...`, `size-adjust:100.05%;ascent-override:103.75%;descent-override:22.19%;line-gap-override:0%`). Wired in `--font-sans:"Inter","Inter repli",system-ui,sans-serif`, `--font-brand:"Plus Jakarta Sans","Plus Jakarta Sans repli",...` and `--md-ref-typeface-*`. Real fonts use `font-display:swap`; 5 latin woff2 (11.3-25 KB each) are fetched on `/`; no `<link rel=preload>` in the HTML. Whether the override numbers match the real fonts' metrics was not verified | Rules present; metric accuracy not verified. `/` CLS 0 in all 3 runs |
| Space reserved on `/telechargements` and `/app/connexion` (OAuth buttons) | CLS median 0.0003 and 0.0001 (r3: 0.037 and 0.059). Remaining shifts: `/telechargements` `header.site-entete > nav > div.liens` 0.0003; `/app/connexion` `form.grille > div.champ > label > span.requis` 0.0001. The CSS rule that reserves the space was not read | Confirmed by CLS. Owner "0" measures 0.0003 / 0.0001 |
| App CSS inlined on `/app/connexion` | Raw HTML 108,939 B: 1 `<style>` block, 0 `<link rel=stylesheet>`; only script is `/chunk-jmazqws2.js`; Lighthouse render-blocking insight score 1. (`/telechargements` and `/mentions-legales` are 5.2 and 5.5 KB shells that still use `<link rel=stylesheet>`.) | Confirmed |
| COOP/CORP same-origin | `cross-origin-opener-policy: same-origin` and `cross-origin-resource-policy: same-origin` on `/`, `/app/connexion`, `/telechargements`, `/mentions-legales`. Absent on `/health`, `/sitemap.xml`, `/accueil-ilots-*.js`, the AVIF and `/mcp` | Confirmed on HTML documents; not on assets or JSON routes |
| `GET /mcp` returns 405, `Allow: POST`, JSON body | `HTTP/2 405`, `allow: POST`, `content-type: application/json;charset=utf-8`, `cache-control: no-store`, body `{"erreur":"Méthode non autorisée","message":"Serveur MCP d'auto (Streamable HTTP) : envoyez les requêtes JSON-RPC en POST, avec un jeton OAuth."}` | Confirmed |
| Owner Lighthouse `/` mobile 100, LCP 1.4 s, 185 KB | Standalone 98, 100, 99; tool 99. LCP 1.61-1.63 s standalone, 1.6 s tool. Transfer 184,851-185,065 B | Bytes confirmed; score 98-100; LCP measured 1.6 s, not 1.4 s |
| CLS `/mentions-legales` 0.011, `/telechargements` 0, `/app/connexion` 0 | Median 0.0106 (0.0106, 0.0106, 0.0091; shifting node `body > main#contenu > p`), 0.0003, 0.0001. Tool run: 0.011 on `/mentions-legales`, 0.000 elsewhere | Confirmed within rounding |
| Known not fixed: about 57 KiB unused JS on `/app/connexion` | Lighthouse 56 KiB unused JS (score 0.5) and 16 KiB unused CSS (score 0.5) on one 127,995 B script | Confirmed still present |

## Interaction check (puppeteer-core, Chrome for Testing 157 headless shell, viewport 1280x900, page `/`, fresh profile)

Console messages 0, page errors 0, CSP violations (enforced and report-only listener) 0 over the whole session. The same sweep on `/`, `/tarifs`, `/telechargements`, `/mentions-legales`, `/confidentialite`, `/app/connexion`, `/app/inscription` gave 0 console messages, 0 page errors, 0 violations on each; Lighthouse console errors 0 on all audited pages. API calls seen: `/telechargements` `GET /api/distributions`; `/app/connexion` `GET /v1/auth/methodes` and `GET /api/auth/get-session`; `/app/inscription` `GET /api/auth/get-session`. No `/v1/moi`.

Tablist (`div.btp-onglets[role=tablist]`, 4 tabs: chantiers, devis, achats, documents). Panels column: V visible, H hidden, in tab order.

| Step | aria-selected true | tabindex 0 | Focus | Panels |
|---|---|---|---|---|
| Initial | chantiers | chantiers | BODY | VHHH |
| focus chantiers | chantiers | chantiers | chantiers | VHHH |
| ArrowRight | devis | devis | devis | HVHH |
| ArrowRight | achats | achats | achats | HHVH |
| ArrowLeft | devis | devis | devis | HVHH |
| End | documents | documents | documents | HHHV |
| ArrowRight (last, wraps) | chantiers | chantiers | chantiers | VHHH |
| ArrowLeft (first, wraps) | documents | documents | documents | HHHV |
| Home (from documents) | chantiers | chantiers | chantiers | VHHH |
| ArrowRight x2 | achats | achats | achats | HHVH |
| Home (from achats) | chantiers | chantiers | chantiers | VHHH |
| End | documents | documents | documents | HHHV |
| Home (from documents) | chantiers | chantiers | chantiers | VHHH |
| ArrowRight x2, Enter on the selected focused tab | achats (unchanged) | achats | achats | HHVH |
| Space on the selected focused tab | achats (unchanged) | achats | achats | HHVH |
| `.focus()` chantiers (not selected), Enter | chantiers | chantiers | chantiers | VHHH |
| `.focus()` documents (not selected), Space | documents | documents | documents | HHHV |
| Click achats | achats | achats | achats | HHVH |
| Tab | achats | achats | `#panneau-achats` | HHVH |

Result: ArrowRight, ArrowLeft, Home and End (including Home from non-first tabs, not covered in r3) move selection, roving tabindex (exactly one tab at 0), focus and the visible panel together, with wrap-around both ways. Enter and Space on a focused but unselected tab select it and show its panel; on an already selected tab they are no-ops. Tab leaves the tablist for the active panel. Enter and Space were driven with focus set programmatically, because arrow keys already select on focus (selection follows focus), so a focused unselected tab is not reachable by keyboard alone in this widget.

Film launch: before click `video` has no `src`, `readyState` 0; clicking `.btp-film-lancer` sets `src`, starts playback (`paused=false`, `readyState=4`, time advancing to 2.78 s), shows native controls, removes the overlay; `canPlayType("video/mp4; codecs=avc1.42E01E")` is "probably".

Not exercised: touch input, mobile-viewport interaction, screen reader output, focus ring visuals, video content or audio, playback to the end, fullscreen, Firefox and Safari, the error path that restores the capture when the mp4 HEAD fails, the theme `storage` island (not re-run in r4), the authenticated app.

## Remaining problems

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | Low | Poster still loads on every `/` visit (16.6 KB mobile, 40.7 KB at 1280 px, about 17% of page bytes), triggered by the island's `HEAD /media/lancement-btp.mp4` and swap on load rather than on click | puppeteer request logs (mobile and desktop), Lighthouse `/` network table |
| 2 | Low | `/app/connexion`: one 127,995 B script (384,741 B raw), 56 KiB unused JS and 16 KiB unused CSS flagged | Lighthouse x3 |
| 3 | Low | CLS 0.009-0.011 on `/mentions-legales` from `main#contenu > p` (client-rendered 5.5 KB shell); under the 0.1 limit | Lighthouse x3 |
| 4 | Low | COOP/CORP only on HTML responses; `/health`, `/mcp`, JS and images carry neither | curl headers |
| 5 | Low | Enforced CSP keeps `style-src 'unsafe-inline'`; Lighthouse `csp-xss` still lists the script-src `'unsafe-inline'` fallback hint; `/csp-rapport` behaviour unverified (no POST) | headers, Lighthouse |
| 6 | Info | `/app/*` shell pages are `noindex` with no description, canonical, h1 or og (SEO 54 on the login page is expected); `/app/connexion` still calls `GET /api/auth/get-session` without a session | crawl, Lighthouse, request log |
| 7 | Info | Lighthouse run-to-run spread on `/`: perf 98-100, TBT 49-134 ms; the owner's 100 is within it | 3 standalone runs |

## Handoff

Owner yolo-ui-aa (repo `C:\src\auto`, commit 95d163a). Re-run on bunos: `SITE_AUDIT_LH="bun /tmp/lh/node_modules/.bin/lighthouse" CHROME_PATH=/tmp/chr/chrome-headless-shell/linux-157.0.8103.38/chrome-headless-shell-linux64/chrome-headless-shell bun tools/site-audit/run.ts auto --name auto-after-r4`.
