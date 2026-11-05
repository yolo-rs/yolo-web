# auto.aphrody.com audit, round 3 after release 20261105T130952Z-ff8cf73f

Measured 2026-11-05 13:14-13:30 UTC from bunos (Chrome for Testing 157.0.8103.38 headless shell, Lighthouse via `bun`, puppeteer-core 25.16 via `bun`; own temp dir `~/audit-run-r3`, separate from the concurrent yolo.aphrody.com audit; Lighthouse and Chrome launched on their own random debugging ports). Tool: `bun tools/site-audit/run.ts auto --name auto-after-r3` (`--out out`, copied here). Raw: [auto-after-r3.json](auto-after-r3.json) (key `extra` holds the curl, standalone Lighthouse and interaction data), tables: [auto-after-r3.measured.md](auto-after-r3.measured.md). Earlier: [auto.md](auto.md) (before), [auto-after.md](auto-after.md) (r1), [auto-after-r2.md](auto-after-r2.md) (r2).

Limits: GET only (crawler, curl, browser page loads), 2 concurrent crawl requests, 250 ms gap, no login, no custom headers. Nothing was POSTed. In the puppeteer runs every request to `/csp-rapport` was aborted client-side; zero such requests were attempted. The tool run and the standalone Lighthouse runs used a normal browser without that interception, so I cannot say whether any automatic CSP report left the browser then (no violation was observed in the puppeteer runs, see below). Lighthouse is lab data; the tool run and the standalone run differ (`/`: perf 99 and 100, LCP 1.8 s and 1.3 s, TBT 80 ms and 10 ms).

`/health`: `{"ok":true,"version":"20261105T130952Z-ff8cf73f","commit":"08c51d26d925bb20b29a7a776f0ad059acfe968e"}`, matches the release and commit 08c51d2 given by the owner.
Probed, all 200: `/`, `/app/` (1,563 B shell), `/app/connexion` (1,563 B), `/health`, `/sitemap.xml` (5 URLs), `/robots.txt` (Sitemap line present), `/.well-known/security.txt` (159 B), `/tarifs`, `/telechargements`, `/mentions-legales`, `/confidentialite`.

## Before / r1 / r2 / r3

| Metric | Before | r1 | r2 | r3 |
|---|---|---|---|---|
| Mobile perf `/` | 52 | 80 | 95 (tool), 98 (standalone) | 99 (tool), 100 (standalone) |
| Mobile a11y / BP / SEO `/` | 97 / 100 / 100 | 97 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 |
| Mobile LCP `/` | 8.2 s | 4.8 s | 2.0 s | 1.8 s (tool), 1.3 s (standalone) |
| Mobile TBT / CLS `/` | 393 ms / 0 | 164 ms / 0 | 246 and 113 ms / 0 | 80 and 10 ms / 0 |
| Desktop perf / LCP / TBT `/` | 94 / 1.4 s / 25 ms | 99 / 0.9 s / 0 ms | 100 / 0.6 s / 3 ms | 100 / 0.4 s / 0 ms |
| Mobile transferred `/` | not recorded | 872,407 B (15 req) | 353,050 B (15 req) | 225,781 B (14 req), 308,630 B uncompressed |
| JS transferred on `/` | not recorded | not recorded | main chunk 89,698 B | 1,245 B (1,656 B raw), one script |
| Landing CSS | 1,293,791 B | 79,563 B (14,668 B transferred) | 76,334 B (14,077 B transferred) | inlined, 72,591 B in `<style>`, no stylesheet request |
| `<h1>` in raw HTML `/` | 0 | 0 | 0 (3,756 B shell) | 1 (HTML 111,675 B identity, 22,148 B zstd) |
| Film poster on `/` | - | - | `/img/btp-analytique.webp` 85,904 B, unhashed, 7 days | `/img/v/btp-analytique-1600-a3630c07b5.avif` 40,327 B, immutable |
| `og:title` vs `<title>` | - | - | differ | identical |
| Meta description `/mentions-legales`, `/confidentialite` | - | - | missing (SEO 92) | present on both (SEO 100) |
| `/app/connexion` mobile perf / a11y / BP / SEO | - | - | 97 / 100 / 96 / 54 | 100 / 100 / 100 / 54 (tool and standalone) |
| `/app/connexion` transferred | - | - | 331,376 B script alone | 214,580 B total (11 req); script 127,951 B (384,551 B raw) |
| `/app/connexion` console errors | - | - | 1 (`/v1/moi` 401) | 0 |
| CSP enforced | absent | absent | `script-src` only | `default-src 'self'` + script hashes, `style-src 'self' 'unsafe-inline'` |
| CSP report-only | absent | absent | `default-src`, no reporting | strict `style-src` (1 hash), `report-uri` + `report-to` |

## Owner claims

| Claim | Measured | Result |
|---|---|---|
| Release ff8cf73f / commit 08c51d2 live | `/health` returns exactly that version and commit | Confirmed |
| `/` prerendered, h1 in HTML | curl with `Accept-Encoding: identity`: 111,675 B, one `<h1>` ("Du chantier au bureau, tout se retrouve." with inline breaks), no JS executed; the HTML also holds the tablist and the film template | Confirmed |
| CSS inlined | 0 `<link rel=stylesheet>` in `/`; one `<style>` block of 72,591 B; no stylesheet in the Lighthouse network table | Confirmed |
| 1.2 KB JS via islands (`ilots.ts`) instead of React | The only external script on `/` is `<script type=module src=/accueil-ilots-qzayn35r.js>`: 1,656 B raw, 1,245 B transferred (Lighthouse), 891 B in a direct curl with zstd, `immutable`. Plus 2 inline hashed scripts (236 and 284 B). It holds the tablist, film and theme `storage` handlers. 14 requests, no React chunk | Confirmed (1.2 KB is the transferred size) |
| `/app` split, screens loaded on demand | The login entry loads one script `/chunk-rdha25f1.js`: 127,951 B transferred (r2: 331,376 B), 384,551 B raw. It contains 26 distinct `import("/chunk-*.js")` calls; none fetched on `/app/connexion` or `/app/inscription`. Authenticated screens were not opened | Split confirmed on the login path; on-demand loading of other screens not exercised |
| Poster is a hashed AVIF | HTML `poster="/img/v/btp-analytique-1600-a3630c07b5.avif"`; GET 200, `image/avif`, 40,327 B, `cache-control: public, max-age=31536000, immutable`. It is requested on load (40,870 B transferred, 18% of the page) although the video has `preload="none"` | Confirmed hashed AVIF and cache; still loaded on every `/` visit |
| Meta descriptions on `/mentions-legales` and `/confidentialite` | Both `<meta name="description">` present (texts start "Mentions légales d’auto : éditeur du service..." and "Politique de confidentialité d’auto : données traitées..."); Lighthouse SEO 100 on both; the tool's missing-description check lists only the 3 `/app/*` shell pages | Confirmed |
| No `/v1/moi` call without a session | Requests on `/app/connexion`: `GET /v1/auth/methodes` and `GET /api/auth/get-session`; on `/app/inscription`: `GET /api/auth/get-session`; Lighthouse `/app/` (client redirect to `/app/connexion?retour=%2Fapp%2F`): same two. No `/v1/moi`. 0 console errors (Lighthouse and puppeteer) | Confirmed. `/api/auth/get-session` is still called (200, 4 B) |
| `og:title` equals `<title>` | Both "auto · Devis, factures et suivi de chantiers pour le BTP" | Confirmed |
| CSP enforced `default-src 'self'` + script hashes, `style-src` with `'unsafe-inline'` | `default-src 'self'; script-src 'self' 'sha256-zmzo...' 'sha256-jfk8...'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' https:; frame-src 'self' blob:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'; report-uri /csp-rapport; report-to csp`. The page runs, so the hashes match the two inline scripts | Confirmed |
| Report-only strict on styles | `content-security-policy-report-only` identical except `style-src 'self' 'sha256-bf9Cd7...'` and `form-action 'self'` | Confirmed |
| Reports to `/csp-rapport` via report-uri + report-to + Reporting-Endpoints | Present: `reporting-endpoints: csp="/csp-rapport"`, `report-uri /csp-rapport`, `report-to csp` in both policies. The separate `report-to` response header is only Cloudflare's NEL group `cf-nel`. Endpoint behaviour not tested (no POST) | Headers confirmed; report delivery and storage unverified |
| No console CSP violations | `securitypolicyviolation` listener (enforced and report-only) plus console and pageerror capture on `/`, `/tarifs`, `/telechargements`, `/mentions-legales`, `/confidentialite`, `/app/connexion`, `/app/inscription`: 0 violations, 0 console messages, 0 page errors. Lighthouse `errors-in-console`: 0 on all 7 audited pages | Confirmed on these 7 pages |
| Owner Lighthouse `/` mobile 99, 225 KB, TBT 0-30 ms | Tool run 99, TBT 80 ms, LCP 1.8 s. Standalone 100, TBT 10 ms, LCP 1.3 s, 225,781 B. Desktop 100, LCP 0.4 s | Score and bytes confirmed; TBT 80 ms in one of two runs |
| Owner Lighthouse `/app/connexion` 98, 216 KB, no console error | Tool run 100 (TBT 12 ms), standalone 100 (TBT 20 ms), 214,580 B, 0 console errors | Confirmed (scores higher than claimed) |

## Interaction check (puppeteer-core, Chrome for Testing 157 headless shell, viewport 1280x900, page `/`)

The only `role=tablist` found is on `/`: `div.btp-onglets[role=tablist][aria-label="Découvrir les espaces d’auto"]` with 4 `button.btp-onglet[role=tab]`: `#onglet-chantiers`, `#onglet-devis`, `#onglet-achats`, `#onglet-documents`, each with `aria-controls="panneau-<name>"`. Other public pages were not checked for tablists in the DOM beyond the crawl's HTML (tablist count was read only on `/`). Panels column: `hidden` attribute of the 4 panels in tab order (V visible, H hidden).

| Step | aria-selected true | tabindex 0 | Focus | Panels |
|---|---|---|---|---|
| Initial | chantiers | chantiers (others -1) | BODY | VHHH |
| `page.focus("#onglet-chantiers")` | chantiers | chantiers | `#onglet-chantiers` | VHHH |
| ArrowRight | devis | devis | `#onglet-devis` | HVHH |
| ArrowRight | achats | achats | `#onglet-achats` | HHVH |
| ArrowLeft | devis | devis | `#onglet-devis` | HVHH |
| End | documents | documents | `#onglet-documents` | HHHV |
| ArrowRight from last | chantiers (wraps) | chantiers | `#onglet-chantiers` | VHHH |
| Home (already on first) | chantiers | chantiers | `#onglet-chantiers` | VHHH |
| ArrowLeft from first | documents (wraps) | documents | `#onglet-documents` | HHHV |
| Click `#onglet-achats` | achats | achats | `#onglet-achats` | HHVH |
| ArrowRight after click | documents | documents | `#onglet-documents` | HHHV |
| Tab | documents | documents | `#panneau-documents` | HHHV |

Result: ArrowRight, ArrowLeft and End move selection, roving tabindex (exactly one tab at 0) and focus together, with wrap-around in both directions, and show only the matching panel. Home was only run while the first tab was selected (no-op, correct); Home from another tab was not run. Selection follows focus (automatic activation). Tab from a tab goes to the active panel.

Theme island: the page has no theme toggle control (none found by label, text, id or class). The island is a `window` `storage` listener plus an inline pre-paint script reading `localStorage["auto-theme"]`. Exercised with a real second tab on `/mentions-legales` writing `localStorage`:

| Action | `html[data-theme]` / class / body background |
|---|---|
| Initial | none / empty / rgb(255, 255, 255) |
| Second tab sets `auto-theme=sombre` | `sombre` / `dark` / rgb(16, 43, 37) |
| Second tab sets `clair` | `clair` / `light` / rgb(255, 255, 255) |
| Second tab removes the key | none / empty / rgb(255, 255, 255) |
| Reload with `auto-theme=sombre` | `sombre` / `dark` / rgb(16, 43, 37) |

Film island (`figure#film-lancement`): the island issues `HEAD /media/lancement-btp.mp4` (Lighthouse shows it as a 200 fetch) and, when it returns `video/mp4`, swaps `.btp-heros-capture` for the video built from `template#modele-film`. After load: `video` present, paused, no controls, `.btp-heros-film-voile` and `button.btp-film-lancer` present, poster is the hashed AVIF. After clicking `.btp-film-lancer`: `video.paused=false`, `controls=true`, voile and launch button removed, `readyState=4`, `error=null`. Chrome reports `canPlayType` mp4 "probably". Console errors 0, page errors 0, CSP violations 0 over the whole session.

Not exercised: touch input and mobile viewport interaction, screen reader output, focus ring visuals, video frame or audio content, playback to the end, fullscreen, Firefox and Safari, a real theme toggle (none exists on the page), Home from a non-first tab, Enter and Space on tabs, tabs inside the authenticated app, and the error path that restores the capture image when the mp4 fails.

## Remaining problems

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | Low | Poster is fetched on every `/` load despite `preload="none"`: 40,870 B, 18% of page bytes; the 1600 px variant is used for a 370 px box on mobile (Lighthouse image-delivery est. 33 KiB, score 0.5) | Lighthouse `/`, network table |
| 2 | Low | `/app/connexion`: one 127,951 B script (384,551 B raw), unused JS est. 57 KiB, unused CSS est. 16 KiB (84% of `chunk-mfe1v7r0.css`), render-blocking CSS est. 120 ms, CLS 0.059 | Lighthouse `/app/connexion` |
| 3 | Low | CLS 0.100 on `/mentions-legales` (perf 97) and 0.037 on `/telechargements`; cause not investigated | tool-run Lighthouse |
| 4 | Low | Enforced CSP keeps `style-src 'unsafe-inline'`; Lighthouse `csp-xss` (score 1) still notes the `'unsafe-inline'` script fallback for old browsers. `/csp-rapport` behaviour unverified | headers, Lighthouse |
| 5 | Info | App shell pages (`/app/`, `/app/connexion`, `/app/inscription`) are `noindex` with no description, canonical, h1 or og tags; SEO 54 on the login page is expected for noindex | crawl, Lighthouse |
| 6 | Info | `/mcp` GET returns 405; COOP and CORP headers absent; `/brands/*.svg` cached 1 day; `/telechargements` calls `GET /api/distributions`; `/app/*` calls `GET /api/auth/get-session` with no session | crawl, headers, puppeteer request log |

The tool crawl fetched 11 URLs (10 x 200, `/mcp` 405) and found 0 broken own-host assets (17 checked).

## Handoff

Owner yolo-ui-aa (repo `C:\src\auto`, commit 08c51d2). Re-run on bunos: `SITE_AUDIT_LH="bun /tmp/lh/node_modules/.bin/lighthouse" CHROME_PATH=/tmp/chr/chrome-headless-shell/linux-157.0.8103.38/chrome-headless-shell-linux64/chrome-headless-shell bun tools/site-audit/run.ts auto --name auto-after-r3`.
