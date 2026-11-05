# dragonballfr.com audit, round-2 after pass

Measured 2026-11-05 15:00-15:30 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`, puppeteer-core for the probes; disk 48% used). Command: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after-r2 --max-pages 60 --lh-urls <same 8 URLs as dragonballfr-after>`. Raw: [dragonballfr-after-r2.json](dragonballfr-after-r2.json), tables: [dragonballfr-after-r2.measured.md](dragonballfr-after-r2.measured.md), probe output: [dragonballfr-after-r2.probe.json](dragonballfr-after-r2.probe.json). Previous reports: [before](dragonballfr.md), [r1](dragonballfr-after.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login, robots honoured, no custom headers. Crawl 61 pages (the crawl frontier drifts: 52 URLs in common with r1, 53 with before; home links to rotating episodes). Lighthouse lab data, one run per URL, 3 runs for /wiki/episodes; the probes use a fresh browser context per page. Lighthouse used its own default debugging port and the temp dir `~/audit-run-dbfr-r2` on bunos; no yolo-aphrody-* file touched.
Release: owner reports Shenron feb3158a (the commit exists in `C:\src\shenron`). The id is NOT exposed: not in the response headers, the home HTML (`feb3158a`, `buildId`, `dpl_` not found) or `/api/health` (`version: "0.1.0"`, timestamp only). Behaviour below is consistent with, not proof of, that commit.
Owner: sheron-24.

## Before / r1 / r2 (Lighthouse mobile unless noted)

| Page | Perf before / r1 / r2 | BP before / r1 / r2 | LCP s before / r1 / r2 | TBT ms before / r1 / r2 | CLS r1 / r2 | A11y r2 | Console errors r2 |
|---|---|---|---|---|---|---|---|
| / (mobile) | 39 / 49 / 46 | 77 / 77 / 77 | 9.0 / 7.2 / 8.0 | 2739 / 1670 / 1854 | 0.000 / 0.000 | 100 | 0 |
| / (desktop) | 57 / 72 / 81 | 77 / 77 / 77 | 5.2 / 3.9 / 1.6 | 354 / 193 / 282 | 0.000 / 0.000 | 100 | 0 |
| /wiki/cards | 50 / 53 / 52 | none / none / none | 2.9 / 2.7 / 2.9 | 42769 / 21732 / 14880 | 0.000 / 0.000 | 100 | 0 |
| /wiki/toriyama | 54 / 55 / 60 | 77 / 77 / 77 | 2.7 / 2.9 / 2.5 | 4272 / 2241 / 1996 | 0.000 / 0.000 | 90 | 0 |
| /wiki/timeline | 36 / 44 / 43 | 77 / 96 / 100 | 42.1 / 17.6 / 17.0 | 3460 / 1361 / 1445 | 0.000 / 0.000 | 97 | 0 |
| /wiki/manga | 42 / 47 / 47 | 77 / 96 / 100 | 8.6 / 7.9 / 8.0 | 2065 / 1390 / 1506 | 0.000 / 0.000 | 100 | 0 |
| /wiki/staff | 42 / 45 / 44 | 77 / 77 / 77 | 8.9 / 9.8 / 10.4 | 4717 / 2129 / 2767 | 0.000 / 0.000 | 100 | 0 |
| /wiki/episodes (median of 3) | 36 / 23 / 44 | 77 / 96 / 100 | 8.8 / 13.0 / 12.8 | 4262 / 1895 / 1596 | 0.479 / 0.000 | 100 | 0 |
| /wiki/episodes/669 | 64 / 70 / 69 | 58 / 58 / 58 | 1.1 / 1.3 / 1.1 | 2173 / 2068 / 1809 | 0.002 / 0.002 | 100 | 0 |

Single-run noise is several points (home 49 to 46, 669 70 to 69 are within it). Real moves: /wiki/episodes perf 23 to 44 and CLS 0.479 to 0, BP 96 to 100 on timeline, manga, episodes; /wiki/cards TBT 21.7 to 14.9 s; home desktop 72 to 81.

## Answers

### (a) Requests to Google ad and analytics hosts with no consent: confirmed zero

Fresh browser context (no localStorage; `dbfr_consent` stayed null), mobile viewport 412x915, `/` for 20 s idle, wheel scroll 900 px, 3 s, one real mouse click on an H2 ("Dragon Ball Super : Beerus", not a link, not a consent control, page URL unchanged), 10 s more. 120 requests in total, 0 to googletagmanager, google-analytics, googlesyndication, doubleclick, adservice, adtrafficquality, gstatic or google.com. Hosts: cdn.dragonballfr.com 70, dragonballfr.com 24, cdn.discordapp.com 21, bot.dragonballfr.com 5. On r1 the same probe saw 12 Google ad-host requests from 6.5 s; they are gone. The full request log (time and URL) is in the probe JSON under `a.log`. Requests after the 20 s idle are post-scroll lazy images (`db_manga_volumes/82,83,147.jpg`, `databooks/01.jpg`, a publications object, a databook jpg) and two `?_rsc=` prefetches (`/leaderboard`, `/privacy`). No consent button was clicked. Not examined: behaviour after consent is given.

### (b) CSP violations: zero on all six pages

Per page (fresh context, 12 s wait, scroll, 3 s; `securitypolicyviolation` listener from document start, CDP `Audits` issues, console errors and warnings):

| Page | securitypolicyviolation events | CSP issues (Audits) | Console errors/warnings | Other issues |
|---|---|---|---|---|
| / | 0 | 0 | 0 | CookieIssue 20 (Discord avatar `__cf_bm`), PerformanceIssue 1 |
| /wiki | 0 | 0 | 0 | PerformanceIssue 1 |
| /wiki/episodes | 0 | 0 | 0 | PerformanceIssue 1 |
| /wiki/timeline | 0 | 0 | 0 | PerformanceIssue 1 |
| /wiki/manga | 0 | 0 | 0 | PerformanceIssue 1 |
| /catalog | 0 | 0 | 0 | PerformanceIssue 1 |

Lighthouse `inspector-issues` on home now lists only a Cookie issue (the Discord avatars) and no Content security policy item (r1: 26). A Function-probe from zod would have produced a script-src report-only violation (the policy has no `unsafe-eval`); none was seen on any of the six pages, consistent with the removal.

Served headers, identical on all six pages:
- `Content-Security-Policy: object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`
- `Content-Security-Policy-Report-Only: script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.dragonballfr.com https://www.googletagmanager.com https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google https://*.google.com https://*.vercel-scripts.com; report-uri /api/csp-report`
- `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=600` on all but `/catalog` (`private, no-cache, no-store, max-age=0, must-revalidate`); `cf-cache-status: DYNAMIC` on all six.

The Report-Only policy covers only `script-src`; img, frame and connect are in no report-only policy, so those were not tested by it.

### (c) /wiki/episodes

| Run | Perf | CLS | LCP | TBT |
|---|---|---|---|---|
| tool run | 44 | 0 | 12.9 s | 1596 ms |
| extra 1 | 44 | 0 | 12.8 s | 1823 ms |
| extra 2 | 44 | 0 | 10.5 s | 1591 ms |
| median | 44 | 0 | 12.8 s | 1596 ms |
| r1 (3 runs) | 22-23 | 0.479 | 10.5-13.0 s | 1895 ms |
| before | 36 | 0 | 8.8 s | 4262 ms |

CLS regression fixed (0.479 to 0 on 3 of 3 runs); perf 23 to 44 (above the 36 before) but LCP stays 10.5-12.9 s (before 8.8 s). BP is 100 on this page now.

### (d) Canonical and titles

- /catalog, /vip, /donations: canonical present and self-referencing (`https://dragonballfr.com/catalog`, `/vip`, `/donations`).
- Crawl: 59 of 59 HTML pages have a canonical (the 60th HTTP 200 is `/api/health`, JSON); r1 and before: 3 missing. The `missing canonical` check list is empty.
- Titles over 70 characters: 0 of 59 (r1 and before: 16); longest 70, next 69. Home title 33.
- Unchanged: 61 pages with one 4xx (`/mcp` 405), 0 of 150 broken links, 0 of 120 bad assets, mean HTML 507 KiB (largest 12.6 MiB), mean response 450 ms (r1 445, before 488), 17 pages with the repeated-word copy heuristic.

### Other

- Best-practices on the 8 URLs (r1 to r2): / 77 to 77, desktop 77 to 77, cards none to none, toriyama 77 to 77, timeline 96 to 100, manga 96 to 100, staff 77 to 77, episodes 96 to 100, 669 58 to 58.
- cf-cache-status: unchanged. `DYNAMIC` on `/`, on `/wiki` in three consecutive GETs, and on the six probed pages; no `Age` header. The owner's open Cloudflare rule has no visible effect on HTML.
- Release id: not exposed (see above).

## Owner expectations, verified

| Expectation | Result | Evidence |
|---|---|---|
| AdSense gated on `dbfr_consent.analytics` like GTM | Confirmed (no consent: zero Google requests) | (a) |
| CSP report-only includes cdn.dragonballfr.com | Confirmed in header | (b), 0 CSP issues on 6 pages, Lighthouse 26 to 0 on home |
| Function-probe from zod removed | Consistent, not provable from outside | 0 violation events |
| /wiki/episodes fallback against CLS | Confirmed | CLS 0.479 to 0 on 3 runs |
| Canonical on /catalog /vip /donations | Confirmed | crawl |
| Titles truncated to 70 | Confirmed | 0 of 59 over 70, max 70 |
| Release feb3158a deployed | Owner-reported only | no exposed id |
| Cloudflare HTML caching | Not confirmed | DYNAMIC |

## Remaining problems, in priority order

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | High | Mobile performance still 43-69 everywhere: home LCP 8.0 s, TBT 1.9 s; /wiki/cards TBT 14.9 s; /wiki/timeline LCP 17.0 s; /wiki/staff LCP 10.4 s; /wiki/episodes LCP 10.5-12.9 s. HTML payload unchanged (mean 507 KiB, largest 12.6 MiB) | Lighthouse, crawl |
| 2 | Medium | Cloudflare still serves HTML as DYNAMIC, so `s-maxage=60` has no edge effect | headers |
| 3 | Medium | Home, /wiki/staff, /wiki/toriyama BP 77: `third-party-cookies` (`__cf_bm` from cdn.discordapp.com avatars, 20 cookie issues on home; `WMF-Uniq` on toriyama in r1) | Lighthouse, Audits |
| 4 | Medium | /wiki/episodes/669 BP 58: Lighthouse sees a third-party video embed (`vidmoly.biz`) pulling Yandex Metrika, `rtmark`, `browpotware` and an old jQuery; 13 third-party cookies and an unload-listener deprecation; no consent was given in that run. Not examined: whether the embed loads only after a click | Lighthouse `third-party-cookies`, `deprecations`, `inspector-issues` |
| 5 | Medium | /wiki/cards still returns no BP score | Lighthouse |
| 6 | Low | `/wiki/toriyama` a11y 90, /wiki/timeline a11y 97 (color-contrast); `label-content-name-mismatch` on episode pages; 17 pages with the copy heuristic; CORP absent; HSTS without includeSubDomains/preload | Lighthouse, headers |
| 7 | Info | Report-Only covers `script-src` only; enforcement not attempted | header |

## Handoff

Owner sheron-24. Re-run: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after-r2 --lh-urls <urls>`. The consent and CSP probes are not part of the tool; their description is in the probe JSON `note`.
