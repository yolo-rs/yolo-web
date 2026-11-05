# auto.aphrody.com audit, round 2 after release 20261105T124026Z-3bc47ea0

Measured 2026-11-05 12:45-12:50 UTC from bunos (Chrome for Testing 157.0.8103.38 headless shell, Lighthouse via `bun`, own temp dir `~/audit-run-r2` and Lighthouse port 9611, separate from the concurrent yolo.aphrody.com audit). Tool: `bun tools/site-audit/run.ts auto --name auto-after-r2` (run on bunos, `--out out`, copied here). Raw: [auto-after-r2.json](auto-after-r2.json), tables: [auto-after-r2.measured.md](auto-after-r2.measured.md). Earlier: [auto.md](auto.md) (before), [auto-after.md](auto-after.md) (round 1).
Limits: GET only, 2 concurrent crawl requests, 250 ms gap, no login, no custom headers. Extra GETs by curl (headers, bodies, `/img/v/*`, `/health`). Extra single Lighthouse runs (mobile; `/`, `/app/`, `/app/connexion`) for LCP element, network table and console. Lighthouse is lab data; TBT varies between runs (113 ms and 246 ms on `/`), perf 95 on the tool run and 98 on the standalone run.
`/health`: `{"ok":true,"version":"20261105T124026Z-3bc47ea0","commit":"0abe10b57f4f0e7bb197beaeebc546392ed5910d"}`, matches the release and commit 0abe10b given by the owner.

## Before / round 1 / round 2

| Metric | Before (auto.md) | Round 1 | Round 2 |
|---|---|---|---|
| Mobile perf `/` | 52 | 80 | 95 (tool run), 98 (standalone) |
| Mobile a11y / BP / SEO `/` | 97 / 100 / 100 | 97 / 100 / 100 | 100 / 100 / 100 |
| Mobile LCP `/` | 8.2 s | 4.8 s | 2.0 s (both runs) |
| Mobile TBT / CLS `/` | 393 ms / 0 | 164 ms / 0 | 246 ms and 113 ms / 0 |
| Desktop perf / a11y / BP / SEO `/` | 94 / 97 / 100 / 100 | 99 / 97 / 100 / 100 | 100 / 100 / 100 / 100 |
| Desktop LCP / TBT `/` | 1.4 s / 25 ms | 0.9 s / 0 ms | 0.6 s / 3 ms |
| Mobile transferred bytes `/` | not recorded | 872,407 B (15 requests) | 353,050 B (15 requests), 592,104 B uncompressed |
| Landing CSS identity / transferred | 1,293,791 B | 79,563 B / 14,668 B | 76,334 B / 14,077 B (`/chunk-5aa1vp5c.css`, zstd) |
| Material Symbols woff2 on `/` | - | 373,905 B loaded | not requested |
| Hero | - | CSS background, no preload | `<picture><img fetchpriority=high>` AVIF/WebP, `<link rel=preload as=image imagesrcset>` |
| Sitemap | 404 | 404 | 200, 5 URLs |
| robots.txt Sitemap line | absent | absent | present |
| security.txt | 404 | 404 | 200 |
| CSP | absent | absent | enforced `script-src` + report-only `default-src` |
| XFO / Referrer-Policy / Permissions-Policy | absent | absent | all present |
| canonical / og:url / og:image / twitter:card on `/` | absent | absent | all present |
| Console errors `/` (Lighthouse) | 0 | 0 | 0 |
| `/app/connexion` mobile perf / a11y / BP / SEO | - | - | 97 / 100 / 96 / 54 (tool), 95 / 100 / 96 / 54 (standalone) |

## Owner claims

| Claim | Measured | Result |
|---|---|---|
| Release 20261105T124026Z-3bc47ea0 / commit 0abe10b live | `/health` returns exactly that version and commit | Confirmed |
| `/sitemap.xml` with 5 public pages | 200, `application/xml`, `cache-control: public, max-age=3600`, 412 B, 5 `<loc>`: `/`, `/tarifs`, `/telechargements`, `/mentions-legales`, `/confidentialite`. Each fetched: 200 (HTML 3,756 / 11,439 / 4,679 / 5,326 / 9,125 B). No `lastmod` | Confirmed |
| `robots.txt` with a Sitemap line | `User-agent: *`, `Allow: /`, `Sitemap: https://auto.aphrody.com/sitemap.xml` (70 B, cf-cache-status HIT, last-modified 12:42:40 GMT) | Confirmed |
| security.txt | 200 `text/plain`, Contact `mailto:contact@aphrody.com`, Expires 2027-05-04, Preferred-Languages, Canonical line | Confirmed |
| canonical, og:url, og:image, twitter:card | Present on `/` (canonical `https://auto.aphrody.com/`, og:image `/img/og-auto.jpg` 1200x629, `summary_large_image`). `/img/og-auto.jpg` is 200 `image/jpeg`, `max-age=604800`. Canonical also on the 4 other public pages | Confirmed |
| Hero as `<picture>` AVIF/WebP, `fetchpriority=high`, preloaded | Lighthouse LCP node: `main#contenu > section.btp-heros > picture.btp-heros-fond > img` with `fetchpriority="high"`. `lcp-discovery-insight` score 1: fetchpriority applied, request discoverable in the initial document, not lazy. HTML has `<link rel=preload as=image type=image/avif fetchpriority=high imagesrcset=... imagesizes=100vw>`. LCP resource `/img/v/btp-plan-768-139c24c163.avif`, 15,915 B, priority High, requested at 179 ms. LCP breakdown: TTFB 148 ms, load delay 29 ms | Confirmed |
| Hashed files under `/img/v/` with immutable cache | Fetched `btp-plan-768-139c24c163.avif` (15,563 B), `btp-plan-768-ad94db510e.webp` (16,808 B), `btp-plan-1536-33f2c3b4b1.avif` (57,024 B): all `cache-control: public, max-age=31536000, immutable`, correct content-type. The JS bundle references 28 `/img/v/` URLs. CSS and JS chunks are also `immutable` | Confirmed |
| Landing no longer loads Material Symbols (11 inline SVG) | Lighthouse network table (15 requests) has no material font on `/`; rendered DOM (headless dump, 412 px) has 0 "material-symbols" strings and 29 `<svg>` elements. The landing CSS still declares the Material Symbols face (`material-symbols-rounded-latin-400-normal-b20c6bfb7d.woff2`) but it is not fetched | Font absence confirmed; "11" not verified (29 `<svg>` in the DOM, distinct icon count not determined) |
| `/app` keeps the font | The CSS linked from `/app/` (`chunk-mfe1v7r0.css`) declares Material Symbols. The font was not requested on the `/app/connexion` page (login screen) | Declared; not observed loading on the login screen |
| CSP script-src 'self' + hashes enforced | `content-security-policy: script-src 'self' 'sha256-zmzo...' 'sha256-jfk8...'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. The two inline scripts in the HTML are the hashed ones; the page runs (hero, h1, 29 svg rendered) | Confirmed (header served, page functional) |
| Full default-src in report-only | `content-security-policy-report-only: default-src 'self'; script-src ...; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' https:; frame-src 'self' blob:; worker-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`. No report-uri / report-to in it | Header confirmed; no reporting endpoint, so violations are not collected server-side |
| XFO DENY, nosniff, Referrer-Policy, Permissions-Policy | `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`; HSTS `max-age=63072000` | Confirmed |
| No CSP console violations | Lighthouse `errors-in-console`: 0 items on `/` (all runs) and on `/tarifs`, `/confidentialite`, `/mentions-legales`, `/telechargements`. Separate headless Chrome run with stderr logging on `/`, `/tarifs`, `/app/connexion`: no CSP or "Refused" message. Lighthouse `csp-xss`: score 1, one Medium note (add `'unsafe-inline'` as a fallback for old browsers) | Confirmed for these pages |
| Captions 12px on mobile and no fade | CSS: `.btp-demonstration figcaption` and `.btp-appareils figcaption` `font-size:12px`. Lighthouse a11y 100, `color-contrast` score 1 (round 1: 97 with 3.33:1 and 3.14:1 captions). "No fade" not examined | 12px and contrast confirmed; fade not verified |
| Lighthouse `/` mobile 98, LCP 2.1 s, 353 KB | Standalone run: perf 98, LCP 1.98 s, transferred 353,050 B. Tool run: perf 95, LCP 2.0 s. a11y 100 both | Confirmed (95 to 98 range) |
| Lighthouse desktop 100 | 100 / 100 / 100 / 100, LCP 0.6 s | Confirmed |
| Lighthouse `/app/` 90 | `/app/` redirects an anonymous visitor to `/app/connexion?retour=%2Fapp%2F`. Measured on that login page: perf 95 (standalone) and 97 (tool run), a11y 100, BP 96, SEO 54 | Not reproduced: 95 to 97, not 90 (login screen, not an authenticated app view) |
| `/app` JS not split (about 41 KiB) | `/app/connexion` loads one 331,376 B transferred script (`/chunk-r6rm7w0g.js`; 1,214,647 B uncompressed for the page). Lighthouse unused-javascript: 232 KiB potential saving (score 0.5). On `/` the main chunk has 40,115 B of 89,698 B unused (about 39 KiB) | Confirmed not done; the app figure is 232 KiB, the 41 KiB figure matches the landing chunk |

## Remaining problems

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | Medium | `/app` bundle: one 331 KB transferred script on the login screen, 232 KiB unused; TBT 230 to 247 ms (score 0.84 to 0.86) | Lighthouse `/app/connexion` |
| 2 | Medium | An unhashed, non-AVIF image is still loaded on `/`: `/img/btp-analytique.webp` (85,904 B, priority High, requested at 443 ms, `cache-control: public, max-age=604800`, 7 days, not immutable). Source: `<video poster="/img/btp-analytique.webp" preload="none">` in the JS bundle. It is 24% of the page bytes; Lighthouse image-delivery estimates 71,380 B wasted and cache-insight 8,590 B | Lighthouse network table, JS bundle |
| 3 | Medium | `/` main JS 89,698 B transferred (271,682 B raw), about 39 to 40 KiB unused; render-blocking CSS est. 110 ms (landing) and 110 to 120 ms (login) | Lighthouse unused-javascript, render-blocking-insight |
| 4 | Low | `/mentions-legales` and `/confidentialite` have no meta description (SEO 92 each); both are in the sitemap | crawl, Lighthouse `meta-description` |
| 5 | Low | `/app/connexion` logs one console error on every load: `GET /v1/moi` returns 401 (session probe). Best-practices 96. Same page: CLS 0.059, `valid-source-maps` fail; the page is `noindex` by design so SEO 54 (no description, not crawlable) is expected | Lighthouse `errors-in-console` |
| 6 | Low | Home HTML is a 3,756 B shell: 0 `<h1>` before JavaScript, only a `<noscript>` paragraph; h1 appears after JS. `og:title` still differs from `<title>` | crawl |
| 7 | Low | CSP: the report-only policy has no `report-uri`/`report-to`, so violations of the future `default-src` (notably `style-src 'self'` against inline style attributes) cannot be collected; the enforced policy has no `default-src`, `style-src` or `img-src` | headers |
| 8 | Info | Landing and app CSS declare about 30 `@font-face` blocks including the unused Material face; only used faces are fetched, so no byte cost on `/` | CSS, network |
| 9 | Info | `/mcp` GET returns 405 with empty body; COOP and CORP headers absent | crawl, headers |

The 5 sitemap URLs returned 200, and the tool found 0 broken own-host assets (10 checked) and 0 broken pages apart from `/mcp` 405.

## Handoff

Owner yolo-ui-aa (repo `C:\src\auto`, commit 0abe10b). Re-run on bunos: `SITE_AUDIT_LH="bun /tmp/lh/node_modules/.bin/lighthouse" CHROME_PATH=<chrome-headless-shell> bun tools/site-audit/run.ts auto --name auto-after-r2`.
