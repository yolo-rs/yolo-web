# dragonballfr.com audit, after pass

Measured 2026-11-05 13:39-13:50 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Command: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after --max-pages 60 --lh-urls <same 8 URLs as the before report>`. Raw: [dragonballfr-after.json](dragonballfr-after.json), tables: [dragonballfr-after.measured.md](dragonballfr-after.measured.md). Before report: [dragonballfr.md](dragonballfr.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login, robots honoured, no custom headers. Crawl 61 pages (60 of the 61 URLs match the before crawl; the sitemap still lists 4126 URLs); 150 of 1184 link targets and 120 of 269 assets checked. Lighthouse lab data, one run per URL (plus two extra runs of `/wiki/episodes`); scores move by several points between runs, INP is not measurable. The tool gained `--lh-urls` (pins the Lighthouse sample) for this pass.
Release: the owner reports Shenron 916975c1. The release id is NOT exposed: `916975` does not appear in the home HTML or in the response headers, and `/api/health` returns only `version: "0.1.0"`. The deployed behaviour matches the repo features listed below, which is consistent with, but does not prove, that commit.
Owner: sheron-24. Repo `C:\src\shenron` read-only (commit 916975c1 is in the object database; the local HEAD is still 02d10ef3, so the files below were read with `git show 916975c1:...`).

## Before and after (Lighthouse mobile unless noted)

| Page | Perf before / after | A11y | BP before / after | SEO | LCP s before / after | TBT ms before / after | CLS after | Console errors |
|---|---|---|---|---|---|---|---|---|
| / (mobile) | 39 / 49 | 100 / 100 | 77 / 77 | 100 / 100 | 9.0 / 7.2 | 2739 / 1670 | 0.000 | 0 / 0 |
| / (desktop) | 57 / 72 | 100 / 100 | 77 / 77 | 100 / 100 | 5.2 / 3.9 | 354 / 193 | 0.000 | 0 / 0 |
| /wiki/cards | 50 / 53 | 100 / 100 | none / none | 100 / 100 | 2.9 / 2.7 | 42769 / 21732 | 0.000 | 0 / 0 |
| /wiki/toriyama | 54 / 55 | 90 / 90 | 77 / 77 | 100 / 100 | 2.7 / 2.9 | 4272 / 2241 | 0.000 | 0 / 0 |
| /wiki/timeline | 36 / 44 | 97 / 97 | 77 / 96 | 100 / 100 | 42.1 / 17.6 | 3460 / 1361 | 0.000 | 0 / 0 |
| /wiki/manga | 42 / 47 | 100 / 100 | 77 / 96 | 100 / 100 | 8.6 / 7.9 | 2065 / 1390 | 0.000 | 0 / 0 |
| /wiki/staff | 42 / 45 | 100 / 100 | 77 / 77 | 100 / 100 | 8.9 / 9.8 | 4717 / 2129 | 0.000 | 0 / 0 |
| /wiki/episodes | 36 / 23 (reruns 22, 23) | 100 / 100 | 77 / 96 | 100 / 100 | 8.8 / 13.0 (reruns 10.5, 10.6) | 4262 / 1895 | 0.479 (reruns 0.479) | 0 / 0 |
| /wiki/episodes/669 | 64 / 70 | 100 / 100 | 58 / 58 | 100 / 100 | 1.1 / 1.3 | 2173 / 2068 | 0.002 | 0 / 0 |

Home best-practices is unchanged at 77. Mobile performance rose 3 to 10 points on 7 of 9 rows (the two home forms count as rows) and fell on `/wiki/episodes` (reproduced three times). `/wiki/staff` LCP is slightly worse (8.9 to 9.8 s).

## Crawl and headers, before and after

| Item | Before | After |
|---|---|---|
| Pages crawled / 4xx-5xx | 61 / 1 (/mcp 405) | 61 / 1 (/mcp 405) |
| Broken internal links, bad own-host assets | 0 of 150, 0 of 120 | 0 of 150, 0 of 120 |
| Home HTML size | 556 KB (543 KiB) | 543 KiB |
| Mean HTML size (59 pages) / largest | 509 KiB / 12.6 MiB | 508 KiB / 12.6 MiB |
| 58 pages present in both: total HTML | 29.8 MiB | 29.8 MiB |
| Pages without canonical | 3 of 59 (/catalog, /vip, /donations) | 3 of 59 (same) |
| Titles over 70 characters | 16 of 59 (the before text said 13; its own table says 16) | 16 of 59 |
| Copy heuristic hits | 17 pages | 17 pages |
| Mean crawl response time | 488 ms | 445 ms |
| /.well-known/security.txt | 503 `auth_unavailable` | 200, `Cache-Control: public, max-age=86400`, RFC 9116 fields (Contact, Expires 2027-11-05, Preferred-Languages, Canonical) |
| Cache-Control on `/` | `private, no-cache, no-store, max-age=0, must-revalidate` | `public, max-age=0, s-maxage=60, stale-while-revalidate=600` |
| Cache-Control on `/wiki` | not recorded | `public, max-age=0, s-maxage=60, stale-while-revalidate=600` |
| cf-cache-status on `/` and `/wiki` | DYNAMIC | DYNAMIC (two GETs of `/wiki` one second apart, both DYNAMIC, no `Age`) |
| CSP | `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` | same, plus `Content-Security-Policy-Report-Only: script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://www.googletagmanager.com https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google https://*.google.com https://*.vercel-scripts.com; report-uri /api/csp-report` |
| Other headers | HSTS 2 y, nosniff, XFO, Referrer-Policy, Permissions-Policy, COOP | unchanged; CORP still absent |
| http, www, TLS | 301, 308, TLS 1.3 Let's Encrypt YE2 to 2027-01-09 | unchanged |

## Owner expectations, verified

| Expectation | Result | Evidence |
|---|---|---|
| No GTM or AdSense requests before consent | GTM confirmed, AdSense NOT confirmed | Fresh Chrome profile (no localStorage, `dbfr_consent` null), CDP Network log of `/`, 15 s idle, then a wheel scroll and 10 s more: no `googletagmanager.com` or `google-analytics.com` request at all. AdSense requests began at 6.5 s without any consent: `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3412964128786100`, then `googleads.g.doubleclick.net/pagead/ads`, `ep1/ep2.adtrafficquality.google` sodar calls (12 requests to Google ad hosts). The repo says why: `PublicAdsScript` loads after first interaction or a 4 s idle fallback and delegates consent to AdSense's own CMP; only GTM waits for `dbfr_consent`. Lighthouse never accepts consent and its window ended before the 6.5 s ad load: its home network log lists only dragonballfr.com, cdn.dragonballfr.com, cdn.discordapp.com and bot.dragonballfr.com (no Google script host), so Lighthouse alone would show a clean result. The HTML still carries the default `gtag('consent','default', ... 'denied')` block and the GTM `<noscript>` iframe (`ns.html?id=GTM-KLSS5787`, only fetched with JS off) |
| s-maxage=60 on /wiki and / | Header confirmed; edge caching NOT confirmed | `public, max-age=0, s-maxage=60, stale-while-revalidate=600` on both, but `cf-cache-status: DYNAMIC` every time: Cloudflare is not serving the HTML from cache (HTML is not cached by default without a Cache Rule). The home rule in `next.config.ts` only applies to requests without a session cookie |
| /.well-known/security.txt 200 | Confirmed | 200, static file `apps/site/public/.well-known/security.txt` at 916975c1 |
| CSP report-only header with script-src | Confirmed, but mis-scoped (finding 1) | Header above |
| Best-practices up | Partly | 77 to 96 on /wiki/timeline, /wiki/manga, /wiki/episodes; unchanged at 77 on /, /wiki/toriyama, /wiki/staff and 58 on /wiki/episodes/669 |
| Release id | Owner-reported | Not in headers, HTML or `/api/health` |

## Remaining problems, in priority order

| # | Severity | Finding | Evidence | Patch (owning repo `C:\src\shenron`) |
|---|---|---|---|---|
| 1 | High | The Report-Only `script-src` omits `https://cdn.dragonballfr.com`, the host of every `/_next/static/chunks/*.js` file (`assetPrefix: cdnUrl` in `apps/site/next.config.ts`). Lighthouse `inspector-issues` lists 26 (home), 26 (toriyama) and 29 (/wiki/episodes/669) Content security policy issues, the first being `cdn.dragonballfr.com/_next/static/chunks/0zo_3rcebvrp8.js`. On the home and /wiki/toriyama pages the failing best-practices audits are `inspector-issues` (CSP and cookie items) and `third-party-cookies`; on /wiki/episodes/669 only `inspector-issues` (29 CSP items). So the new header is a likely cause of BP staying at 77 and 58, and the report collector will be flooded with the site's own scripts. Enforcing this policy would break the site | Lighthouse `inspector-issues`, header, `next.config.ts` lines 51 and 509-517 | Add the CDN origin to `script-src` (derive it from `cdnUrl`), re-measure, only then consider enforcement |
| 2 | High | AdSense and Google ad frames load without any user consent decision, 6.5 s after a fresh visit | CDP network log | Gate `PublicAdsScript` on `getConsent()`, or confirm the AdSense CMP shows a banner in the EU before the first ad request (not examined here) |
| 3 | High | `/wiki/episodes` regressed: perf 36 to 23, CLS 0 to 0.479 (three runs), LCP 8.8 to 10.5-13.0 s. The only shifting node is the footer (`footer[data-shell-footer]`, top 6898 px) | Lighthouse `layout-shifts` | Reserve the height of the episode list or avoid late insertion above the footer |
| 4 | High | Mobile performance still 23-70 everywhere; home LCP 7.2 s, TBT 1.7 s; `/wiki/cards` TBT 21.7 s; `/wiki/timeline` LCP 17.6 s; `/wiki/staff` LCP 9.8 s. HTML size is unchanged (home 543 KiB, largest page 12.6 MiB) | Lighthouse, crawl | Virtualise list pages, reduce HTML payload |
| 5 | Medium | Cloudflare does not cache the HTML (DYNAMIC), so `s-maxage=60` has no edge effect | headers | Add a Cache Rule honouring origin Cache-Control for anonymous GET HTML, then re-measure for `cf-cache-status: HIT` |
| 6 | Medium | `third-party-cookies` still fails on home (`__cf_bm` set by `cdn.discordapp.com` avatars) and on /wiki/toriyama (`WMF-Uniq` from upload.wikimedia.org) | Lighthouse | Proxy or self-host the avatar and Wikimedia images |
| 7 | Medium | `/wiki/cards` still returns no best-practices score | Lighthouse | Rerun that URL and read the error in the full report |
| 8 | Low | 16 of 59 titles over 70 characters, 3 pages without canonical (/catalog, /vip, /donations), 17 pages with the repeated-word heuristic; `/wiki/toriyama` a11y 90; `label-content-name-mismatch` still flagged on `/` and episode pages | crawl, Lighthouse | Unchanged from the before report |
| 9 | Info | CORP header absent; HSTS without includeSubDomains/preload | headers | Unchanged |

## Fact check against C:\src\shenron (commit 916975c1, read-only)

| Claim | Source in repo | Result |
|---|---|---|
| robots.txt Disallow `/admin/`, `/api/`, `/profile/` | `apps/site/src/app/robots.ts` | Verified: the `*` rule disallows exactly those three; AI-crawler rules allow public API prefixes, `/mcp`, `/.well-known/`; AdSense bots disallow `/admin/`, `/api/`. Live robots.txt shows the same disallows. Both `/sitemap.xml` and `/sources/sitemap.xml` are declared (the second was not fetched) |
| `/.well-known/*` non-auth paths answer 404 | `apps/site/src/app/.well-known/[...path]/route.ts` | Verified in code; `security.txt` is served by a static file in `public/` and now answers 200 (before-report finding 2 resolved) |
| `Cache-Control` `public, max-age=0, s-maxage=60, stale-while-revalidate=600` on `/` for visitors without session cookie | `next.config.ts` lines 443-462 | Verified in code and live. The `/wiki/:path*` rule (line 386) matches the live header; not read in detail |
| CSP Report-Only `script-src`, collector `/api/csp-report` | `next.config.ts` 509-517, `app/api/csp-report/route.ts` | Header verified live. The collector accepts POST only, logs a truncated report, returns 204; POST not exercised (GET only). Config gap: CDN origin missing (finding 1) |
| GTM only after analytics consent | `DeferredGoogleTagManager.tsx`, `lib/consent.ts` (default opt-out) | Verified live: no GTM request without consent |
| Consent covers AdSense | `PublicAdsScript.tsx`, `deferred-third-party.ts` (comment: AdSense's certified CMP keeps control) | Contradicted for the `dbfr_consent` store: ads load with no `dbfr_consent`; whether AdSense's own CMP prompts was not examined |
| Home "Le serveur en direct" values (598 / 6 428 online, 8 354 warriors, 188 485 843 404 XP, 3 488 achievements) | bot API `bot.dragonballfr.com/api/public/*` | Unverified: dynamic values, no repo source; not re-measured |
| Home news "Episode 4, diffuse 1 novembre 2026" and weekly episodes | no repo data located | Unverified |
| Sitemap lists 4126 URLs | `app/sitemap.ts` (revalidate 86400) | Live count unchanged at 4126; generation logic not compared |
| Release 916975c1 deployed | `git log -1 916975c1` (2026-11-05 14:09 +0100, "fix(deploy): build-image refuses Bun < 1.4.6...") | Owner-reported only; not visible from outside. The live behaviour includes features from commits 6363dacd (security.txt), 38383fff and 7d580188 (CSP Report-Only incl. adtrafficquality), 1cce474d and fae94d1e (s-maxage), 68caa83b (GTM after consent), all ancestors of 916975c1 in the range 02d10ef3..916975c1 |

## Handoff

Owner sheron-24. Re-run: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after --lh-urls <urls>`. The consent probe (fresh profile, CDP, 15 s idle then scroll) is not part of the tool; its output is quoted above.
