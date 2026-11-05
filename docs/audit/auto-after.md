# auto.aphrody.com audit, after release 20261105T115340Z-93408ded

Measured 2026-11-05 12:08-12:12 UTC from bunos (Chrome for Testing 157.0.8103.38 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts auto --name auto-after` (copy of the script run on bunos, `--out out`, then copied here). Raw: [auto-after.json](auto-after.json), tables: [auto-after.measured.md](auto-after.measured.md). Baseline: [auto.md](auto.md).
Limits: GET only, 2 concurrent crawl requests, 250 ms gap, no login, no custom headers. Extra GETs by curl: `/app/`, `/health`, CSS and font files. Lighthouse is lab data, one run per form (mobile 80 on the tool run, 82 on a second standalone run: expect about +-2 noise).
`/health` reports `{"ok":true,"version":"20261105T115340Z-93408ded","commit":"8b368e27b87f5f17d5c48442593f45f179f7c01a"}`, matching the release the owner gave.

## Owner claims, verified by measurement

| Claim | Measured | Result |
|---|---|---|
| Landing CSS 1,293,791 B -> 79,563 B | Old `/chunk-8p9wtwr7.css` (still served): 1,293,791 B identity. New `/chunk-ywn4w56k.css`: 79,563 B identity (`content-length`). Compressed: old gzip 932,186 / br 915,815 / zstd 902,804; new gzip 13,449 / br 13,674 / zstd 14,349 (Cloudflare serves `content-encoding: zstd`) | Confirmed |
| App CSS 1,168,135 B -> 106,935 B | New `/chunk-mfe1v7r0.css` (linked from `/app/`): 106,935 B identity, gzip 16,509. The old app chunk URL is not known to the audit, so the 1,168,135 B figure was not re-measured | New size confirmed; old size not verified |
| Fonts moved out of CSS to `/polices/<file>-<sha256>.woff2` | Both CSS files hold 30 `@font-face` blocks and 0 `data:` URIs; 60 distinct `/polices/...` references (woff and woff2). The two woff2 files fetched: body SHA-256 starts with the hash in the filename (`2050755bf475`, `8909904ab6c8`) | Confirmed |
| Fonts have immutable cache | `/polices/plus-jakarta-sans-latin-700-normal-2050755bf4.woff2` and `/polices/inter-latin-400-normal-8909904ab6.woff2`: `cache-control: public, max-age=31536000, immutable`, `access-control-allow-origin: *`, `content-type: font/woff2`. `cf-cache-status: MISS` on first fetch (not re-fetched to see HIT) | Confirmed |
| content-encoding on a font | None on either woff2, also with `accept-encoding: gzip, br, zstd`. Expected: woff2 is already compressed. CSS and HTML are encoded (zstd) | No encoding on fonts; fine |
| Preloads on Plus Jakarta 700 and Inter 400 latin | `/` has exactly 2 `<link rel="preload" as="font" type="font/woff2" crossorigin>`: plus-jakarta-sans-latin-700-normal-2050755bf4 and inter-latin-400-normal-8909904ab6. `/app/` has 1 preload: Inter 400 latin | Confirmed |
| Hero `/img/btp-plan.webp` is the LCP, not preloaded | Lighthouse LCP node: `section.btp-heros`. The image is referenced only from CSS: `.btp-heros:before{...background:url(/img/btp-plan.webp) 50%/cover...}` in the landing CSS. `lcp-discovery-insight`: request not discoverable in the initial document, fetchpriority=high not applied. LCP breakdown: TTFB 115 ms, load delay 141 ms, load duration 49 ms, render delay 88 ms. No `<link rel=preload as=image>` in the HTML | Confirmed (resource URL itself not captured by the tool; inferred from the CSS rule, 109,729 B transfer, largest image) |
| Material Symbols 374 KB still loads on `/` | `/polices/material-symbols-rounded-latin-400-normal-b20c6bfb7d.woff2`: 373,905 B transferred, 373,316 B resource, the largest request on the page | Confirmed |

## Before / after (Lighthouse lab)

| Metric | Before (auto.md) | After | Delta |
|---|---|---|---|
| Mobile perf | 52 | 80 | +28 |
| Mobile a11y / BP / SEO | 97 / 100 / 100 | 97 / 100 / 100 | 0 |
| Mobile LCP | 8.2 s | 4.8 s | -3.4 s |
| Mobile TBT | 393 ms | 164 ms | -229 ms |
| Mobile CLS | 0.000 | 0.000 | 0 |
| Desktop perf | 94 | 99 | +5 |
| Desktop a11y / BP / SEO | 97 / 100 / 100 | 97 / 100 / 100 | 0 |
| Desktop LCP / TBT | 1.4 s / 25 ms | 0.9 s / 0 ms | better |
| Landing CSS (identity) | 1,293,791 B | 79,563 B | -94% |
| Landing CSS (gzip) | 932,186 B | 13,449 B | -98.6% |
| App CSS (identity) | 1,168,135 B (owner figure) | 106,935 B | -91% |
| Sitemap | /sitemap.xml 404 | /sitemap.xml 404 | unchanged |
| CSP | absent | absent (HSTS and nosniff only) | unchanged |
| Console errors | 0 | 0 | 0 |

Mobile page weight after (second standalone run, 15 requests): 872,407 B transferred. Largest: Material Symbols 373,905; btp-plan.webp 109,729; JS chunk 93,754 (282,363 raw); btp-analytique.webp 85,909; btp-tableau.webp 57,682; btp-mobile.webp 34,787; Inter 600/500/400 about 24-25 KB each; landing CSS 14,668.

## Remaining problems

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | High | No sitemap: `/sitemap.xml` 404; robots.txt lists a sitemap URL that returns 404 | crawl |
| 2 | High | Mobile LCP 4.8 s: hero image is a CSS background (`.btp-heros:before`), discovered late, no `fetchpriority`/preload; HTML still only holds a no-JS fallback (2,744 B), h1 appears after JS | lcp-discovery-insight, crawl |
| 3 | Medium | Material Symbols woff2 373,905 B on `/` (43% of the transferred bytes); subset to the icons used or load on demand | network-requests |
| 4 | Medium | No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy on HTML | headers |
| 5 | Medium | Contrast failures (a11y 97): figcaption text #81908c on #fff = 3.33:1 and #7c8d87 on #edf5ef = 3.14:1 at 11px (need 4.5:1); also the `<a href=/img/btp-analytique.webp>` caption link | Lighthouse color-contrast |
| 6 | Medium | Unused JS about 41 KiB, render-blocking CSS est. 120 ms, image delivery est. 138 KiB savings; 4 webp images (288 KB) load on the home | Lighthouse insights |
| 7 | Low | No canonical; og:title differs from `<title>`; no og:image, og:url, twitter:card | crawl |
| 8 | Low | `/.well-known/security.txt` 404; `/mcp` GET 405 with empty body | crawl |
| 9 | Info | Fonts: every landing and app load references 30 `@font-face` blocks (woff and woff2 variants); only used faces are fetched (5 woff2 on the landing), fine | CSS, network |

`/app/` (noindex by design) returns 200 with a 1,563 B shell and one Inter 400 preload; not run in Lighthouse.

## Handoff

Owner yolo-ui-aa (repo `C:\src\auto`, release commit 8b368e2). Re-run on bunos: `SITE_AUDIT_LH="bun <path>/lighthouse" CHROME_PATH=<chrome-headless-shell> bun tools/site-audit/run.ts auto --name auto-after`.
