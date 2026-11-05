# aphrody.com audit

Measured 2026-11-05 09:58-10:01 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts aphrody`. Raw: [aphrody.json](aphrody.json), tables: [aphrody.measured.md](aphrody.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login. The sitemap has 3 URLs (/, /privacy, /status), all crawled.

Handoff owner: yolo-ui-aa (taking it after audit). Owning repo: `C:\src\bun-os-archive\crates\aphrody-webos-server` (landing `src/landing.html` embedded via `include_str!` in `src/page.rs`; SEO, robots, sitemap, security.txt and manifest in `src/site.rs`; headers in `src/main.rs`; the yolo-ai copy has diverged and is ignored).

Cross-check: REA report `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), section `## aphrody.com` (findings AP-1 to AP-4). Not copied here.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 99 | 98 | 96 | 100 | 1.0 | 0.000 | 103 | 0 |
| desktop | / | 100 | 98 | 96 | 100 | 0.3 | 0.000 | 47 | 0 |
| mobile | /status | 100 | 88 | 100 | 92 | 0.8 | 0.000 | 3 | 0 |
| mobile | /privacy | 100 | 100 | 100 | 100 | 0.8 | 0.031 | 4 | 0 |

INP is not measurable in lab. The /status row is from the first run (09:58 UTC); a rerun at about 11:05 UTC produced no result for that page (cause not determined, possibly its meta refresh). Other rows are from the rerun.

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
| 2 | Medium | `/status` has `<meta http-equiv="refresh" content="120">` (Lighthouse meta-refresh fail), no meta description, no canonical, no og tags; a11y 88 (td-has-header fail), SEO 92 | Lighthouse, crawl | Replace the meta refresh with script polling; add description and canonical; add header cells in the status table (`src/site.rs` status route; the crate has `src/health.rs`) |
| 3 | Low | Home a11y 98: `heading-order`, `label-content-name-mismatch` fail | Lighthouse | Fix heading levels; make accessible names contain the visible text (`src/landing.html`) |
| 4 | Low | Home best-practices 96: `image-aspect-ratio` fails; 2 images without width/height | Lighthouse, crawl | Set width/height matching the intrinsic ratio on the home images in `src/landing.html` |
| 5 | Low | Permissions-Policy absent; HSTS without `preload` | headers | `src/main.rs` (header block near line 390, where CSP, nosniff and HSTS are set): add `Permissions-Policy`; HSTS value at line 402. nginx equivalent: `add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;` and optionally `; preload` on HSTS |
| 6 | Low | `<title>` and og:title use the entity `&bull;` in the source. Browsers render a bullet; some scrapers show it raw | raw HTML | Use a literal middle dot or a pipe in `src/landing.html` lines 8, 32, 43 |
| 7 | Medium | `GET /boot.js` returns 404; REA (AP-2) traces it to `import("/boot.js")` in `site.js`, so the desktop (WebOS) mode silently fails. Status confirmed by one GET; the import was not re-read by this audit | curl | Ship `boot.js` (referenced by the comment at `src/site.rs` line 591) or remove the import in `src/site.js` |
| 8 | Info | Copy heuristic flagged "Companion Companion" on /; source text is "Shared Companion" then "Companion Aphrody Pet" in adjacent elements: false positive | page text | None |

## Fact check

| Claim on page | Check | Result |
|---|---|---|
| "Four signature creative powerhouses": WordCraft, DeckCraft, GridCraft, VectorCraft | craft.aphrody.app sitemap lists 14 studios | Inconsistent framing (4 vs 14). The four named studios exist there (word, deck, grid, vector). Page could link to https://craft.aphrody.app |
| "zero telemetry" | Lighthouse and asset checks show no third-party host among 13 own-host assets | Not verified for runtime traffic (no network capture run) |
| "Byron Love (Aphrodi)", "60 FPS HDR", "174Hz and 432Hz soundscapes" | no source located | Not verified |
| JSON-LD offer price 0 USD | no pricing page on the site | Not verifiable further |

## Source drift

| Claim | Source | Result |
|---|---|---|
| Live title "Aphrody • The Calm, Divine Operating System" | `src/landing.html` line 8 says "Bun OS • The Unified Operating System" (description also differs); "Calm, Divine" appears only in `src/site.css` in this crate | Production does not serve this crate's landing.html as committed. Either prod runs a different build or the live copy was edited elsewhere; not determined |

## Handoff

Owner yolo-ui-aa. Re-run: `bun tools/site-audit/run.ts aphrody`.
