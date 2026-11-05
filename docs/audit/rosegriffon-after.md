# rosegriffon.fr audit, "after" pass

Measured 2026-11-05 11:13:53 to about 11:23 UTC (550 s) from bunos. Tool: `bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-after --max-pages 100` (same tool file as the before run, md5 identical to the repo copy). Raw: [rosegriffon-after.json](rosegriffon-after.json), tables: [rosegriffon-after.measured.md](rosegriffon-after.measured.md). Baseline: [rosegriffon-before.md](rosegriffon-before.md).

Limits (same as before): GET only, 2 concurrent, 250 ms gap, robots honoured, no custom request headers, 101 pages crawled (cap 100, depth 2), 150 of 501 internal link targets and 120 of 330 own-host assets checked, Lighthouse on 9 URLs (lab data, INP not measurable). The Lighthouse URL set is chosen by HTML size, so it differs from the before run (see "Comparability").

## Build identity

The owner reported build `TFu-T1mdhusiRm6TvkhaB` live since 11:10:20 UTC (commits a03fbe7a consent gate, 965716f8 community pagination). The string `TFu-T1mdhusiRm6TvkhaB` is present in the HTML of `GET /` fetched at 11:13 UTC, so the build id is exposed in the response and matches the owner's report. The commit hashes are owner-reported and not verifiable from the response. The run started 3.5 minutes after the reported go-live.

## Consent gate and what Lighthouse measured

The tool and Lighthouse load pages as a fresh visitor with no stored choice and never accept consent. Per the owner, a consent banner is now shown and GTM/AdSense load only after acceptance, so Lighthouse measured the pages without third-party ad and tag scripts. The scores below therefore describe the site without third parties; they are not what a visitor sees after accepting. The banner itself was not inspected by this tool (no screenshot taken). The string `pagead2.googlesyndication.com` still appears once in the home HTML (a curl grep, not analysed further, likely a loader URL referenced by the consent code). A with-consent run was not performed.

## Before / after

| Metric | Before (10:05-10:42, build ekHHwPMKZgZb-p8jStMCl) | After (11:14-11:23, build TFu-T1mdhusiRm6TvkhaB) | Note |
|---|---|---|---|
| Home mobile perf / a11y / BP / SEO | 47 / 100 / 77 / 100 | 49 / 100 / 100 / 100 | BP 77 to 100 |
| Home mobile LCP | 7.2 s | 7.2 s | unchanged |
| Home mobile TBT | 2604 ms | 1777 ms | |
| Home desktop perf / a11y / BP / SEO | 65 / 93 / 77 / 100 | 85 / 93 / 77 / 100 | BP still 77, third-party-cookies still flagged |
| Home desktop LCP / TBT | 2.8 s / 274 ms | 1.9 s / 208 ms | |
| /feed mobile perf / LCP / TBT | 38 / 8.4 s / 2682 ms | 42 / 7.7 s / 1952 ms | |
| /feed?reseau=x mobile perf / LCP / TBT | 44 / 8.5 s / 2957 ms | 45 / 8.2 s / 1918 ms | |
| /news mobile perf / LCP / TBT | 43 / 52.4 s / 2316 ms | 48 / 52.0 s / 1789 ms | LCP still 52 s |
| /design-system mobile perf / LCP / TBT | 53 / 6.4 s / 1272 ms | 51 / 9.0 s / 1239 ms | |
| /community mobile Lighthouse | perf 38, LCP 7.5 s, TBT 8019 ms | not run | page no longer among the heaviest HTML, so the tool did not select it |
| /community?serveur=achillea mobile Lighthouse | perf 33, LCP 7.9 s, TBT 6307 ms | not run | same reason |
| /community HTML bytes | 3,548,199 | 211,837 | -94% |
| /community?serveur=rose-griffon HTML bytes | 3,548,241 | 211,979 | -94% |
| /community?serveur=achillea HTML bytes | 5,879,312 | 205,762 | -96% |
| Largest HTML in crawl | 5.88 MB (community achillea) | 687 KB (/feed) | |
| Total HTML of 101 crawled pages | 31.5 MB | 18.6 MB | different page set (adds /community?page=N), indicative only |
| Console errors (Lighthouse, 9 pages) | 0 | 0 | |
| Own-host assets 4xx/5xx (120 sampled) | 5 (4 x HTTP 400, 1 network error) | 2 (both `_next/image` iergday Instagram, HTTP 400) | the direct `/storage/.../iergday/affiche-v2.webp` and `reglement-v2.webp` were not in this sample; a direct GET after the run still returned 400 for both, so they are not fixed |
| Home `_next/image` RG_screens_twitch_ethan.webp network error | 1 | 0 in sample | |
| Pages without canonical | 24/101 | 22/101 | `/feed/status/*` and `/settings` remain |
| Canonical differs from URL | 28/101 | 30/101 | includes new `/community?page=1`, `?page=2`, `?page=31` |
| Titles over 70 chars | 11/101 | 0/101 | fixed |
| Pages without og:title/og:image | 16/101 | 16/101 | unchanged |
| Pages noindex | 25/101 | 24/101 | `/settings` is now noindex |
| Copy heuristic hits | 31/101 | 26/101 | `/community` and `/notre-equipe` no longer hit; `/community?page=2` and `?vue=staff` still hit |
| Broken internal links | 0/150 | 0/150 | |
| TLS, headers, CSP, security.txt | as before | as before | CSP is still only `frame-ancestors`; security.txt 404 |
| cdn.rosegriffon.fr/dx11/menu/ | 502 | 502 | one GET |

## Comparability

- Lighthouse URL selection (5 heaviest by HTML, 2 sitemap sample) changed because the community pages shrank, so community Lighthouse numbers have no after value. Lighthouse on `/community` specifically was not run.
- Lab variance: home mobile perf 47 vs 49 and LCP 7.2 s vs 7.2 s are within normal run-to-run noise; only a single run per page was taken. The best-practices change (77 to 100) is a binary audit result, not noise.
- The crawl page set differs (501 vs 704 internal link targets), so crawl totals are indicative.

## Top remaining problems (measured)

| # | Severity | Problem | Evidence |
|---|---|---|---|
| 1 | High | Mobile performance still 42-49 on every sampled page: home LCP 7.2 s unchanged, TBT 1.6-3.3 s even without third parties. `/notre-equipe` TBT 3291 ms | Lighthouse |
| 2 | High | `/news` LCP 52.0 s on mobile (unchanged) | Lighthouse |
| 3 | High | `/feed` is 687 KB of HTML with 4.3 s response time in the crawl and `server-response-time` flagged; `/notre-equipe` is 635 KB | crawl, Lighthouse |
| 4 | High | iergday storage objects still return HTTP 400: `affiche-v2.webp`, `reglement-v2.webp` (direct GET) and two Instagram thumbnails via `_next/image` (before run: backend NoSuchKey; a missing object should be 404) | crawl, curl |
| 5 | Medium | Desktop home and `/notre-equipe` mobile still flag `third-party-cookies` (BP 77) with no consent given; the setting party was not identified | Lighthouse |
| 6 | Medium | Community pagination has 31+ pages of about 140-212 KB; community Lighthouse was not re-measured. `/community?page=N` canonicalises away from itself (3 pages in sample) | crawl; Lighthouse not run |
| 7 | Medium | 22 pages lack a canonical (`/settings`, `/feed/status/*`); `/settings` has h1 count != 1 although it is now noindex | crawl |
| 8 | Medium | 16 pages lack og:title or og:image (`/charte-engagements`, `/evenements`, `/sondages*`, `/wiki`, `/contact`, `/projets/*`) | crawl |
| 9 | Medium | CSP only restricts framing (`frame-ancestors`); no script/style/img policy, which matters now that GTM/AdSense load after consent. security.txt 404; cdn.rosegriffon.fr/dx11/menu/ 502 | headers, probes |
| 10 | Low | Copy heuristics still hit 26 pages (doubled "Instagram Instagram" on `/feed*`, "Patreon Patreon", "Tournoi Tournoi", "Président Président", "Hyroto Hyroto"), mojibake U+FFFD on `/feed?groupe=Inazuma+Eleven`; `/design-system` still public with a11y 95 and LCP 9.0 s | crawl, Lighthouse |

## Not run

Lighthouse with consent accepted (third parties loaded); Lighthouse on `/community` and `/community?serveur=achillea`; banner screenshot or accessibility check of the consent dialog; field data (CrUX/INP); `/wiki/chara`.
