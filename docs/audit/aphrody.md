# aphrody.com audit

Measured 2026-11-05 09:58-10:01 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts aphrody`. Raw: [aphrody.json](aphrody.json), tables: [aphrody.measured.md](aphrody.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login. The sitemap has 3 URLs (/, /privacy, /status), all crawled.

Handoff owner: yolo-ui-aa (taking it after audit). Owning repo: not located. `git grep "Celestial Calm"` found nothing in yolo-ui, auto, yolo-os, yolo-bun, yolo-ai, yolo-vps, yolo-hub, yolo-web, so patches below are named by page, not by file.

Cross-check: REA report `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), section `## aphrody.com` (findings AP-1 to AP-4). Not copied here.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 99 | 98 | 96 | 100 | 1.0 | 0.000 | 96 | 0 |
| desktop | / | 100 | 98 | 96 | 100 | 0.3 | 0.000 | 0 | 0 |
| mobile | /status | 100 | 88 | 100 | 92 | 0.8 | 0.000 | 3 | 0 |
| mobile | /privacy | 100 | 100 | 100 | 100 | 0.8 | 0.031 | 9 | 0 |

INP is not measurable in lab.

## Routes, redirects, TLS, headers

| Item | Result |
|---|---|
| / /privacy /status | 200 |
| /robots.txt | 200, Disallow `/api/sessions`, `/privacy/clear`, 1 sitemap |
| /sitemap.xml | 200, 3 URLs |
| /.well-known/security.txt | 200 (contact, Expires 2027-12-31, policy link) |
| unknown path | 404 |
| http:// | 301 to https (1 hop); www to apex 301 |
| TLS | TLS 1.3, CN=aphrody.com, Let's Encrypt YE1, valid 2026-10-24 to 2027-01-22, verify OK |
| Server | nginx, brotli, not behind Cloudflare (no cf-cache-status) |
| Headers | HSTS 1 year includeSubDomains (no preload), strict CSP (`default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `frame-ancestors 'none'`, `object-src 'none'`), nosniff, Referrer-Policy, COOP same-origin, CORP same-site. Absent: Permissions-Policy. X-Frame-Options absent but covered by `frame-ancestors 'none'` |
| Links / assets | 0 broken internal links (3 checked), 0 asset 4xx/5xx (13 checked) |
| Meta | canonical, OG (image 1200x630 with alt), twitter summary_large_image, JSON-LD (Organization, WebSite, WebApplication) on /; no hreflang (single language, `lang=en`) |

## Findings

| # | Severity | Finding | Evidence | Proposed patch |
|---|---|---|---|---|
| 1 | High | Public `/status` (linked from the home page) exposes internal operations data: CI gate results with commit SHAs and repository file paths, shell/lint/type-check error text, service delivery state and release identifiers. Values deliberately not reproduced here. REA finding AP-1 lists further internals | `GET /status` (200, text only, read once) | Remove the link from the home page and require authentication or an IP allow-list for `/status` at the nginx level; publish only a coarse up/down indicator publicly; consider rotating anything that looks like an internal address or path |
| 2 | Medium | `/status` has `<meta http-equiv="refresh" content="120">` (Lighthouse meta-refresh fail), no meta description, no canonical, no og tags; a11y 88 (td-has-header fail), SEO 92 | Lighthouse, crawl | Replace the meta refresh with script polling; add description and canonical; add header cells in the status table (status page template) |
| 3 | Low | Home a11y 98: `heading-order`, `label-content-name-mismatch` fail | Lighthouse | Fix heading levels; make accessible names contain the visible text (home template) |
| 4 | Low | Home best-practices 96: `image-aspect-ratio` fails; 2 images without width/height | Lighthouse, crawl | Set width/height matching the intrinsic ratio on the home images |
| 5 | Low | Permissions-Policy absent; HSTS without `preload` | headers | nginx: `add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;` and optionally `; preload` on HSTS |
| 6 | Low | `<title>` and og:title use the entity `&bull;` in the source. Browsers render a bullet; some scrapers show it raw | raw HTML | Use a literal middle dot or a pipe |
| 7 | Medium | `GET /boot.js` returns 404; REA (AP-2) traces it to `import("/boot.js")` in `site.js`, so the desktop (WebOS) mode silently fails. Status confirmed by one GET; the import was not re-read by this audit | curl | Ship `boot.js` or remove the import (page template) |
| 8 | Info | Copy heuristic flagged "Companion Companion" on /; source text is "Shared Companion" then "Companion Aphrody Pet" in adjacent elements: false positive | page text | None |

## Fact check

| Claim on page | Check | Result |
|---|---|---|
| "Four signature creative powerhouses": WordCraft, DeckCraft, GridCraft, VectorCraft | craft.aphrody.app sitemap lists 14 studios | Inconsistent framing (4 vs 14). The four named studios exist there (word, deck, grid, vector). Page could link to https://craft.aphrody.app |
| "zero telemetry" | Lighthouse and asset checks show no third-party host among 13 own-host assets | Not verified for runtime traffic (no network capture run) |
| "Byron Love (Aphrodi)", "60 FPS HDR", "174Hz and 432Hz soundscapes" | no source located | Not verified |
| JSON-LD offer price 0 USD | no pricing page on the site | Not verifiable further |

## Handoff

Owner yolo-ui-aa. Re-run: `bun tools/site-audit/run.ts aphrody`.
