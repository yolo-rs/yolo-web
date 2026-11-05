# craft.aphrody.app after pass (owner release 2026-11-05T16-25-14-419Z)

Measured 2026-11-05 16:27-16:45 UTC from bunos (Chrome for Testing 157.0.8103.38 headless shell, Lighthouse via `bun`, puppeteer-core). Tool: `bun tools/site-audit/run.ts craft --name craft-after --lh-urls <7 urls>` (same Lighthouse sample as [craft.md](craft.md): /, /effect/, /film/, /art/, /light/, /sound/, /cad/; home mobile and desktop). Raw data: [craft-after.json](craft-after.json) (tool output plus `probe` and `probe2` keys), tables: [craft-after.measured.md](craft-after.measured.md). Probe scripts: `tools/site-audit/probes/craft-after-probe.ts`, `craft-after-probe2.ts`.

Politeness: GET/HEAD only, sequential, 250 ms gap, no custom headers except `User-Agent` and (for the encoding test) `Accept-Encoding`. Lighthouse and browser loads open several connections per page. Own Lighthouse (auto-picked port) and temp dirs; a parallel yolo.aphrody.com audit used its own Chrome on port 9333.

Wasm fetch discipline: each studio page was loaded once in a fresh browser context, so each studio wasm was downloaded once by the browser (the 13 wasm files are 3.4-12.4 MB encoded). The other requests on wasm files were HEAD. Deviations, stated plainly: (a) /word/ wasm was fetched again by the persistent-profile run (probe2, needed because the first repeat-visit test used an incognito memory cache, see below), (b) probe2 sent four `Range: bytes=0-0` GETs on the /word/ wasm; the server ignored Range (full 200) and the body was cancelled after the headers, so some data was transferred, (c) Lighthouse loaded effect, film, light, sound and cad again, each pulling its wasm.

Owner claims checked: release `2026-11-05T16-25-14-419Z`, yolo-ui dcf09ae9d + ba5a174f2, yolo-os 3d366a8. The release id appears only as `?v=` on /film/ (js and wasm); the deployed commit shas are not visible from outside and were not verified.

## Before / after

Before = [craft.md](craft.md) (09:50-11:05 UTC). Before transfer bytes were not measured in that audit; the owner's figure for /word/ is about 11.18 MB.

| Metric | Before | After (measured) |
|---|---|---|
| Home mobile perf / a11y / BP / SEO | 95 / 100 / 100 / 100 | 100 / 96 / 100 / 100 |
| Home mobile LCP / TBT | 2.9 s / 64 ms | 1.0 s / 14 ms |
| Home desktop | 100 / 100 / 100 / 100, LCP 0.8 s | 100 / 96 / 100 / 100, LCP 0.3 s |
| /effect/ perf / a11y / SEO, TBT | 60 / 87 / 100, 6815 ms | 60 / 87 / 100, 3528 ms |
| /film/ perf / a11y / SEO, TBT | 60 / 87 / 91, 4147 ms | 60 / 87 / 91, 4245 ms |
| /light/ perf / a11y / SEO, TBT | 60 / 92 / 100, 22326 ms | 60 / 92 / 100, 21107 ms |
| /sound/ | no perf score (earlier run perf 60, TBT 18193), a11y 92, SEO 91 | 61 / 92 / 100 / 91, TBT 7101 ms |
| /cad/ perf / a11y / SEO, TBT | 61 / 92 / 91, 2668 ms | 62 / 92 / 91, 2172 ms |
| /art/ | Lighthouse produced no result | Lighthouse produced no score (NaN); see studios below |
| Lighthouse console errors | 0 on measured pages | 0 on all measured pages |
| /word/ first-visit transfer | not measured (owner: about 11.18 MB) | 9,447,987 B (fresh context), 9,448,545 B (fresh profile dir) |
| /word/ repeat visit, warm HTTP cache, same session | not measured | 1,280 and 1,281 B (persistent profile; incognito context 9,418,005 B, see below) |
| Hashed assets Cache-Control | `no-cache` on all responses | `public, max-age=31536000, immutable` on hashed css, js, wasm |
| HTML Cache-Control | `no-cache` | `no-cache` (unchanged, as intended) |
| Unhashed wasm | not checked | none: 13 of 13 studio wasm are hashed |
| Sitemap | 15 URLs, all 200 | 15 URLs, all 200 (unchanged) |
| CSP / Permissions-Policy | absent | absent (unchanged) |
| Canonical / OG missing on studios | 14/15 | 14/15 (unchanged) |
| Meta description missing | 12/15 | 12/15 (unchanged) |
| h1 count != 1 | 13/15 | 13/15 (unchanged) |
| Brotli / zstd | not measured | served, see Encoding |

Home perf and LCP moved from 95 to 100 and 2.9 to 1.0 s, but the owner release changed assets, not the home; this may be run-to-run variance and was not repeated. Home a11y fell from 100 to 96 (label-content-name-mismatch and target-size both score 0 in the after run; the before report also listed the label mismatch as a failing audit while showing a11y 100, so the before table is not internally consistent). Studio TBT swings of 5-30 percent are within lab noise in a software-rendering browser.

## Confirmed

| Claim | Evidence |
|---|---|
| Hashed filenames match the content sha | The 8 hex digits in the name equal the first 8 of the SHA-256 of the decoded body for all 14 `theme-8feb0fbf.css` loads (same bytes, 9788 B) and for all 13 studio js files (e.g. `wordcraft_web-7ecb28be.js`). Wasm: confirmed for /word/ (`51359c2e36c5...`, 29,470,113 B decoded, hashed in page from the HTTP cache with no extra network fetch), /sound/ (`a2a4eb0e`, 10,990,508 B) and /grid/ (`de7971f8`, 13,247,983 B). Wasm for the other 10 studios were not hashed (the CDP response body was not returned for them, and a second download was not allowed): name match not confirmed |
| Cache-Control per asset | Hashed css, js, wasm: `public, max-age=31536000, immutable` (every studio). HTML (/, 14 studios, robots, sitemap): `no-cache` |
| /word/ first visit | 9,447,987 B total (HTML 1,169 + speculation 484 + css 1,649 + icon 7,099 + js 21,126 + wasm 9,416,460), vs owner 9,448,859 B |
| /word/ repeat visit | 1,280 B and 1,281 B on two repeat loads in one persistent-profile session: wasm, js, css, icon from cache (0 B), only HTML revalidation (about 650 B) and `/cdn-cgi/speculation` (about 630 B) transferred. Owner figure 1,271 B |
| Wasm decoded vs encoded | /word/ wasm 9,417,022 B encoded (br) for 29,470,113 B decoded (ratio 3.13); sound 3.38 MB br for 10.99 MB; grid 3.82 MB br for 13.25 MB |
| film uses `?v=<release>` | `filmcraft_web-26d1d8ae.js?v=2026-11-05T16-25-14-419Z` and `filmcraft_web_bg-2baafcde.wasm?v=2026-11-05T16-25-14-419Z`, both immutable. No other studio uses `?v=` |
| Brotli, zstd, gzip precompressed | See Encoding |
| 0 console errors | 13 wasm studios: 0 console errors, 0 failed requests (probe) and 0 in Lighthouse |

## Encoding negotiation (HEAD, /word/ wasm and theme css)

| Accept-Encoding | Served | Content-Length header |
|---|---|---|
| identity | none | absent |
| gzip | gzip | absent |
| br | br | 9,414,590 (wasm), 1,295 (css 9,788 decoded) |
| zstd | zstd | absent |
| br, zstd, gzip | br | same as br |

Observed: br is chosen when offered with the others. Only br responses carry a Content-Length equal to the ETag size (`"6aecadea-8fa7be"` = 9,414,590), which is consistent with a precompressed `.br` file on disk. The gzip and zstd responses have no Content-Length and no stable size header, so their encoded size was not measured (Range is ignored, a full download of each was not allowed). Whether gzip and zstd are precompressed files or compressed on the fly, and whether br is q11, are not determinable from outside; only "br is served and is smaller than decoded by 3.13x on word" is measured. HTML is served zstd to a default Bun/Chrome client (Chrome sends br, zstd, gzip; Cloudflare picked zstd for HTML and br for sitemap, css, js, wasm).

## Cloudflare cache on wasm

`cf-cache-status: DYNAMIC` on all 13 wasm in the first HEAD and again on two further HEADs of the /word/ wasm, with no `Age` header: not cached at the Cloudflare edge, as the owner said (needs a cache rule). Hashed css is `HIT` with Age 190-407 s; unhashed `/craft.css` is `HIT` (Age 23,928 s, `public, max-age=86400, stale-while-revalidate=604800`); `/craft.js` is `REVALIDATED` (`no-cache`). Hashed studio js: Cloudflare status not measured (only seen in the browser, no HEAD).

## Studios (fresh context per page, 8 s after load, no GPU)

| Studio | Load transfer B | wasm br B | Console errors | Canvas | State |
|---|---|---|---|---|---|
| photo | 9,405,434 | 9,371,214 | 0 | 800x600 | loaded |
| vector | 13,499,291 | 12,403,023 | 0 | 800x600 | loaded, plus 2 uncompressed no-cache fonts (845 KB, 219 KB) |
| film | 9,743,697 | 9,708,123 | 0 | 800x600 | loaded |
| design | 10,093,083 | 10,062,612 | 0 | 800x600 | loaded, still the Oct 24 build per owner (not verified externally) |
| fig | 9,249,596 | 9,219,242 | 0 | 800x600 | loaded |
| effect | 9,148,754 | 9,104,194 | 0 | 800x600 | loaded; `snippets/.../host.js` is `no-cache` |
| light | 24,502,262 | 8,027,148 | 0 | 800x600 | loaded, plus `lightcraft_zh_hans.otf` 16,441,762 B, `no-cache`, no content-encoding |
| sound | 3,411,874 | 3,380,519 | 0 | 800x600 | loaded |
| cad | 6,932,967 | 6,902,350 | 0 | 800x600 | loaded |
| word | 9,447,987 | 9,416,460 | 0 | 800x600 | loaded |
| deck | 7,089,004 | 7,058,327 | 0 | 800x600 | loaded |
| grid | 3,851,212 | 3,820,355 | 0 | 800x600 | loaded |
| pdf | 10,360,172 | 10,336,307 | 0 | 800x600 | loaded |
| art | 1,752,133 | none (React SPA, js 1.47 MB br) | 1 pageerror: `(intermediate value).glob is not a function` | none | did not initialise |

"Loaded" means: load event fired, the main thread answered a script evaluation, a canvas was created, 0 console errors, 0 failed requests. Interactivity was not tested (no input driven, no visible text in any studio body). The headless browser has no GPU: `navigator.gpu` exists in all 14 but `requestAdapter()` returned null in all 14, so WebGPU rendering could not initialise in any studio; whether the studios render or are usable on a real GPU is not confirmed. A studio reaching the canvas stage without errors without an adapter may mean the app tolerates or silently skips GPU init; not verified.

## Headers and metadata (unchanged by the release)

| Item | Result |
|---|---|
| HSTS, nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, CORP same-origin | present |
| Content-Security-Policy, Permissions-Policy | absent on / and all 14 studio pages |
| COOP same-origin + COEP require-corp | only /film/, /effect/, /light/ (and their assets); absent elsewhere |
| /.well-known/security.txt | 404 |
| Sitemap | 200, 15 URLs, all 200; robots 200 |
| Canonical, OG, Twitter | home only (OG: type, site_name, locale, url, title, image `og.png`, twitter summary_large_image); 14 studios none |
| Meta description | home, /effect/, /light/ only |
| h1 | home and /film/ only |
| Titles | studios still "Aphrody / Bun · X", home "Craft by Aphrody: ..." |

## Remaining problems

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | High | Large no-cache, uncompressed font on /light/: `lightcraft_zh_hans.otf` 16.4 MB on every load, doubling the page (24.5 MB) | browser log: encoded 16,441,762, no content-encoding, `no-cache` |
| 2 | High | /art/ does not run: pageerror `glob is not a function` (unprocessed Vite `import.meta.glob`), no canvas, Lighthouse yields no score; HTML still references `https://unpkg.com/react-scan/dist/auto.global.js` (302, dev tool) and `/src/styles.css` (404); assets are `no-cache`, 5.79 MB js decoded | probe, HEAD |
| 3 | Medium | Wasm not cached at Cloudflare (`DYNAMIC`, no Age on 3 requests): every first visit per PoP goes to origin | HEAD |
| 4 | Medium | /art/ loads Google Tag Manager, Google Analytics, Microsoft Clarity and Google Fonts (181 KB gtag) with no consent step, while the home claims "zero cloud telemetry, local-first privacy"; the 13 wasm studios and word load no third-party hosts | browser log hosts |
| 5 | Medium | No CSP, no Permissions-Policy; COOP/COEP on only 3 studios | headers |
| 6 | Medium | Studio SEO unchanged: canonical and OG 14 of 15 missing, description 12 of 15, h1 13 of 15 | crawl |
| 7 | Low | Unhashed assets with weak caching: `/craft.js` `no-cache`, `/craft.css` 1 day, effect `host.js` `no-cache`, vector fonts `no-cache` uncompressed (NotoSansArabic 845 KB, NotoSansThai 219 KB) | HEAD, browser log |
| 8 | Low | Home a11y 96 (label-content-name-mismatch, target-size), /effect/ and /film/ a11y 87; studio Lighthouse perf stays 60-62 and TBT 2.2-21 s in software rendering (not representative of a GPU) | Lighthouse |
| 9 | Low | security.txt 404; zstd/gzip sizes and wasm hashes for 10 studios unverified | see above |

## Not confirmed

- Deployed commits (yolo-ui dcf09ae9d + ba5a174f2, yolo-os 3d366a8): not observable from outside.
- Wasm hash equals filename for photo, vector, film, design, fig, effect, light, cad, deck, pdf (bodies not retrievable without a second download).
- Brotli quality 11 and whether zstd/gzip copies are precompressed: not determinable; only that all three encodings are served and br is preferred.
- gzip and zstd encoded sizes of the wasm and css.
- Studios interactive or rendering: no GPU, no input test; none could initialise WebGPU.
- "Design is still the Oct 24 build" and "art carried over unchanged": the design wasm is hashed and loads; art is broken as above; build dates are not visible externally.
- Cloudflare status of the hashed js files.
- Home Lighthouse improvement caused by the release: not isolated.

## Incognito repeat-visit artifact

The first repeat-visit test used a fresh incognito browser context (memory cache only): the 9.4 MB wasm was not kept and the repeat visit transferred 9,418,005 B. This is a limit of the headless in-memory cache, not of the headers. A fresh persistent profile directory (disk cache) then gave 1,280 B and 1,281 B on two repeat loads. The 1,280 B figure is the one reported as the repeat visit.
