# auto.aphrody.com audit

Measured 2026-11-05 09:57-09:58 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts auto`. Raw: [auto.json](auto.json), tables: [auto.measured.md](auto.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login. The home is a client-rendered SPA with no crawlable links, so the crawler saw 3 URLs; extra routes were probed by hand (GET) from the file list in `C:\src\auto\apps\web\public`.

Handoff owner: yolo-ui-aa. Owning repo: `C:\src\auto\apps\web` (HEAD 227a509 at audit time): home markup `src/site/accueil.tsx` and `public/index.html`, styles `src/styles/accueil.css`, server `src/serveur.ts`.

Cross-check: REA report `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), section `## auto.aphrody.com`. Not copied here.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 52 | 97 | 100 | 100 | 8.2 | 0.000 | 393 | 0 |
| desktop | / | 94 | 97 | 100 | 100 | 1.4 | 0.001 | 25 | 0 |

Rerun at about 11:05 UTC; the first run (09:57 UTC) gave mobile perf 59, LCP 6.3 s. Other pages (/tarifs, /confidentialite, /mentions-legales, /telechargements, /app): not run in Lighthouse. INP is not measurable in lab.

## Routes, redirects, TLS

| Item | Result |
|---|---|
| / | 200 |
| /health | 200, body `{"ok":true}` |
| /mcp (GET) | 405 with `allow: POST` (expected for a POST-only MCP endpoint; POST not tested) |
| /robots.txt | 200 (Cloudflare managed content-signals text) |
| /sitemap.xml | 404 |
| /favicon.ico | 200 |
| /.well-known/security.txt | 404 |
| /tarifs, /confidentialite, /mentions-legales, /telechargements, /app | 200 each (manual GET) |
| `/tarifs.html`, `/app.html` | 404 (extensionless routes only) |
| /craft/word/ | 404 (repo has `apps/web/public/craft/{word,grid,pdf}`; not served at this path on prod) |
| http:// | 301 to https (1 hop) |
| TLS | TLS 1.3, CN=aphrody.com, Let's Encrypt YE2, valid 2026-10-11 to 2027-01-09, verify OK |
| Availability | One request at about 09:46 UTC returned HTTP 530 (Cloudflare origin unreachable) on `/`; all later requests (about 15) returned 200. Single observation, cause not determined |

## Security headers (GET /)

Present: `strict-transport-security: max-age=63072000`, `x-content-type-options: nosniff`. Absent: Content-Security-Policy, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP.

## Findings

| # | Severity | Finding | Evidence | Proposed patch |
|---|---|---|---|---|
| 1 | High | No sitemap (404). Home HTML (2291 bytes) holds only a no-JS fallback sentence; content and h1 appear after JavaScript, so non-JS crawlers see almost nothing | crawl | Add `GET /sitemap.xml` (home, /tarifs, /telechargements, /confidentialite, /mentions-legales) in `C:\src\auto\apps\web\src\serveur.ts` and a `Sitemap:` line; prerender hero text in `apps/web/public/index.html` |
| 2 | High | Mobile Lighthouse performance 52-59 (two runs), LCP 6.3-8.2 s | Lighthouse | Render-blocking resources, unused JS/CSS and forced reflow flagged. Split the bundle and defer non-critical CSS/JS (`apps/web/src/client`; the home is `src/site/accueil.tsx` with `src/styles/accueil.css`) |
| 3 | Medium | No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy on HTML | headers | Add a header set in `apps/web/src/serveur.ts`; `apps/web/src/craft.ts` already defines a CSP const to reuse as a pattern |
| 4 | Medium | Colour-contrast failure (a11y 97) | Lighthouse `color-contrast` | Fix the failing colour in `apps/web/src/styles/accueil.css`; offending elements not itemised in the stored summary, rerun to list them |
| 5 | Low | No canonical on the home | crawl | Add `<link rel="canonical" href="https://auto.aphrody.com/">` in `apps/web/public/index.html` |
| 6 | Low | og:title ("Du chantier au bureau, tout se retrouve") differs from `<title>`; no og:image, og:url, twitter:card | crawl | Add the tags in `apps/web/public/index.html` |
| 7 | Low | `/mcp` GET returns 405 with empty body | curl | Optional: JSON hint describing POST usage |
| 8 | Low | No `security.txt` | 404 | Serve `/.well-known/security.txt` (repo has `SECURITY.md`) |
| 9 | Info | README says production is an OVH server (`C:\src\auto\README.md` line 28); responses come from Cloudflare | headers | None if Cloudflare proxies OVH |

## Fact check

| Claim (live) | Repo | Result |
|---|---|---|
| /tarifs: Gratuit 0 EUR, Pro 14 EUR HT/month (140/year), Business 39 EUR HT/month (390/year), Pro trial 30 days | `packages/billing/src/plans.ts` lines 36 and 43 (1400/14000 and 3900/39000 cents); `apps/api/src/modules/abonnement.test.ts` line 104 (essaiJours 30) | Match |
| /tarifs: 2, 10, 50 employees; 1, 20, 200 Go storage | `apps/web/public/tarifs.html` | Same figures in the file; whole-file diff with live differs, not itemised |
| README: app at https://auto.aphrody.com, MCP at `/mcp` | live | URL exists; GET gives 405 (POST-only); tools not exercised |
| README lists wordcraft/deckcraft as planned | live `/craft/word/` 404 on auto | Consistent; the separate craft.aphrody.app serves those studios ([craft.md](craft.md)) |

## Handoff

Owner yolo-ui-aa. Re-run: `bun tools/site-audit/run.ts auto`.
