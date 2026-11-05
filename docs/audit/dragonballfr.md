# dragonballfr.com audit

Measured 2026-11-05 about 10:35-10:55 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts dragonballfr`. Raw: [dragonballfr.json](dragonballfr.json), tables: [dragonballfr.measured.md](dragonballfr.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login, robots honoured. 61 pages crawled (cap 60, depth 2, sitemap sample of 10 plus links) out of a 4126-URL sitemap; 150 of 1158 internal link targets and 120 of 270 own-host assets checked. Lighthouse on 9 URLs (home mobile and desktop, 5 heaviest by HTML size, 2 sitemap sample). INP is not measurable in lab. A first Lighthouse pass sent a custom request header that caused fake CORS console errors; it was discarded and everything below is from the rerun without it.

Handoff owner: sheron-24. Owning repo: `C:\src\shenron` (HEAD 02d10ef3 at audit time; `apps/site`).

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 39 | 100 | 77 | 100 | 9.0 | 0.000 | 2739 | 0 |
| desktop | / | 57 | 100 | 77 | 100 | 5.2 | 0.000 | 354 | 0 |
| mobile | /wiki/cards | 50 | 100 | no result | 100 | 2.9 | 0.000 | 42769 | 0 |
| mobile | /wiki/toriyama | 54 | 90 | 77 | 100 | 2.7 | 0.000 | 4272 | 0 |
| mobile | /wiki/timeline | 36 | 97 | 77 | 100 | 42.1 | 0.000 | 3460 | 0 |
| mobile | /wiki/manga | 42 | 100 | 77 | 100 | 8.6 | 0.000 | 2065 | 0 |
| mobile | /wiki/staff | 42 | 100 | 77 | 100 | 8.9 | 0.000 | 4717 | 0 |
| mobile | /wiki/episodes | 36 | 100 | 77 | 100 | 8.8 | 0.000 | 4262 | 0 |
| mobile | /wiki/episodes/669 | 64 | 100 | 58 | 100 | 1.1 | 0.002 | 2173 | 0 |

## Routes, redirects, TLS, headers

| Item | Result |
|---|---|
| / and 60 crawled pages | 200 |
| /robots.txt | 200; Disallow `/admin/`, `/api/`, `/profile/`; per-bot sections for AI crawlers |
| /sitemap.xml | 200, 4126 URLs |
| /api/health | 200, liveness JSON, version "0.1.0" |
| /mcp (GET) | 405 (POST-only endpoint; POST not tested) |
| /.well-known/security.txt | 503 `{"error":"auth_unavailable"}` |
| unknown path | 404 |
| http:// | 301 to https (1 hop); www to apex 308 |
| TLS | TLS 1.3, CN=dragonballfr.com, Let's Encrypt YE2, valid 2026-10-11 to 2027-01-09, verify OK |
| Headers | HSTS 2 years (no includeSubDomains/preload), nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy, COOP same-origin-allow-popups. CSP is only `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` (no script-src/default-src). CORP absent |
| Caching | HTML: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `cf-cache-status: DYNAMIC` |
| Broken internal links / assets | 0 of 150 / 0 of 120 (the only 4xx is /mcp 405) |
| Home HTML size | about 556 KB |

## Findings

| # | Severity | Finding | Evidence | Proposed patch (owning repo `C:\src\shenron`) |
|---|---|---|---|---|
| 1 | High | Mobile performance is 36-64 on every page measured; home LCP 9.0 s, TBT 2.7 s; `/wiki/timeline` LCP 42.1 s; `/wiki/cards` TBT 42.8 s (best-practices audit produced no result there) | Lighthouse | Reduce client JS and DOM on `apps/site/src/app/wiki/*` list pages (virtualise /wiki/cards and /wiki/timeline); inspect the LCP element on /wiki/timeline (report not stored, rerun with that URL) |
| 2 | High | `/.well-known/security.txt` returns 503 `auth_unavailable`. The repo route `apps/site/src/app/.well-known/[...path]/route.ts` says non-auth `/.well-known/*` paths answer 404, so production appears to run an older build than HEAD (not confirmed) | curl, route.ts | Deploy HEAD, and add a static `apps/site/public/.well-known/security.txt` |
| 3 | Medium | HTML is never cacheable: `private, no-cache, no-store` on `/`, a 556 KB document, DYNAMIC at Cloudflare | headers | Set `s-maxage` + `stale-while-revalidate` for anonymous GETs of public wiki pages in `apps/site/next.config.ts` headers() (as `rg-website` does) |
| 4 | Medium | Home best-practices 77: `third-party-cookies`, `inspector-issues` flagged | Lighthouse | Identify the cookie-setting third party (not itemised in stored summary; rerun to list) |
| 5 | Medium | CSP lacks `script-src`/`default-src`, so it only restricts framing and forms | headers | Add a nonce-based CSP in `apps/site/next.config.ts` or middleware |
| 6 | Low | 13 of 59 pages have titles over 70 characters (e.g. `/wiki/staff`, `/wiki/manga/20186`); 3 have no canonical (`/catalog`, `/vip`, one more) | crawl | Shorten the wiki title template; add canonical metadata to those routes |
| 7 | Low | `/wiki/toriyama` a11y 90; home `label-content-name-mismatch` | Lighthouse | Align aria-labels with visible text |
| 8 | Low | `og:title` and og:image:alt contain the entity `&#x27;` in source (correct HTML, shown raw by naive scrapers) | raw HTML | None required |
| 9 | Info | Copy heuristic flagged repeated words ("Databook Databook" on `/`, "Volume Volume" on `/wiki/episodes/877`, "Portrait Portrait" on `/shop`, "Noter Noter" on `/rankings`). Pairs such as "Pai Pai", "Bye Bye", "Pui Pui" are real character names, so only the first group is suspect and each could be icon plus label | crawl | Inspect those four components |

## Fact check

| Claim | Source | Result |
|---|---|---|
| robots.txt Disallow `/admin/`, `/api/`, `/profile/` | `apps/site/src/app/robots.ts` | Not diffed line by line; live rules are consistent with an admin/api/profile split |
| Home "Le serveur en direct": 598 / 6 428 online, 8 354 warriors, 188 485 843 404 XP, 3 488 achievements | bot API (`bot.dragonballfr.com/api/public/*`) | Dynamic values, no repo source; not verified. Calls from the home to `bot.dragonballfr.com` produced no console errors in the clean rerun |
| Home news: "Épisode 4, diffusé 1 novembre 2026" and weekly episodes 11, 18, 25 Oct | no repo data located | Dates are weekly Sundays, internally consistent; source not verified |
| Sitemap lists 4126 URLs | `apps/site/src/app/sitemap.ts` | Live count recorded; generation logic not compared |
| `/.well-known/*` non-auth paths answer 404 | `route.ts` comment | Contradicted by prod (503 on security.txt) |

## Handoff

Owner sheron-24. Re-run: `bun tools/site-audit/run.ts dragonballfr`.
