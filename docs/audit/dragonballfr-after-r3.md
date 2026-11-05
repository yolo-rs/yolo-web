# dragonballfr.com audit, round-3 after pass

Measured 2026-11-05 from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`, puppeteer-core 24 for the probes). Command: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after-r3 --max-pages 60 --lh-urls <8 URLs of r2>` (the 8 include /wiki/cards and /wiki/episodes/669). Raw: [json](dragonballfr-after-r3.json), tables: [measured](dragonballfr-after-r3.measured.md), probes: [probe json](dragonballfr-after-r3.probe.json), [headers](dragonballfr-after-r3.headers.json), [proxy GETs](dragonballfr-after-r3.proxy.txt), [one facade click](dragonballfr-after-r3.click.json). Probe source: `tools/site-audit/probes/dbfr-r3-probe.ts`. Previous: [before](dragonballfr.md), [r1](dragonballfr-after.md), [r2](dragonballfr-after-r2.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login, robots honoured, no custom headers, fresh browser context per page, no consent control clicked. Lighthouse lab data, one run per URL (no repeat runs this round, so single-run noise of several points applies). Crawl 61 pages. Lighthouse used its default random debugging port and temp dir `~/audit-run-dbfr-r3`; no yolo-aphrody-* file touched. A first launch with a duplicated home URL was killed after seconds and discarded.
Owner: sheron-24.

## Before / r1 / r2 / r3 (Lighthouse mobile unless noted)

| Page | Perf | BP | LCP s | TBT ms | CLS r3 |
|---|---|---|---|---|---|
| / (mobile) | 39 / 49 / 46 / 47 | 77 / 77 / 77 / 100 | 9.0 / 7.2 / 8.0 / 7.4 | 2739 / 1670 / 1854 / 1656 | 0.000 |
| / (desktop) | 57 / 72 / 81 / 70 | 77 / 77 / 77 / 100 | 5.2 / 3.9 / 1.6 / 3.8 | 354 / 193 / 282 / 237 | 0.000 |
| /wiki/cards | 50 / 53 / 52 / 79 | none / none / none / 100 | 2.9 / 2.7 / 2.9 / 1.4 | 42769 / 21732 / 14880 / 890 | 0.000 |
| /wiki/toriyama | 54 / 55 / 60 / 76 | 77 / 77 / 77 / 100 | 2.7 / 2.9 / 2.5 / 2.2 | 4272 / 2241 / 1996 / 674 | 0.000 |
| /wiki/timeline | 36 / 44 / 43 / 45 | 77 / 96 / 100 / 100 | 42.1 / 17.6 / 17.0 / 11.9 | 3460 / 1361 / 1445 / 1569 | 0.000 |
| /wiki/manga | 42 / 47 / 47 / 48 | 77 / 96 / 100 / 100 | 8.6 / 7.9 / 8.0 / 7.7 | 2065 / 1390 / 1506 / 1233 | 0.000 |
| /wiki/staff | 42 / 45 / 44 / 55 | 77 / 77 / 77 / 100 | 8.9 / 9.8 / 10.4 / 5.5 | 4717 / 2129 / 2767 / 1199 | 0.000 |
| /wiki/episodes (r3 single run) | 36 / 23 / 44 / 43 | 77 / 96 / 100 / 100 | 8.8 / 13.0 / 12.8 / 12.5 | 4262 / 1895 / 1596 / 1719 | 0.000 |
| /wiki/episodes/669 | 64 / 70 / 69 / 81 | 58 / 58 / 58 / 100 | 1.1 / 1.3 / 1.1 / 1.4 | 2173 / 2068 / 1809 / 743 | 0.001 |

A11y r3: 100 everywhere except toriyama 90 and timeline 97 (unchanged). SEO 100 on all. Lighthouse console errors: 0 on all nine runs. Moves beyond noise: BP 77 to 100 on home, staff, toriyama, 58 to 100 on 669, none to 100 on cards; cards perf 52 to 79 and TBT 14.9 s to 0.89 s; 669 perf 69 to 81; staff LCP 10.4 to 5.5 s; timeline LCP 17.0 to 11.9 s. Home and episodes perf are within noise.

## Answers

1. Release id: confirmed. `x-shenron-release: 64a12ab1` on `/`, `/wiki`, `/wiki/cards`; `/api/local/health` returns `"release":"64a12ab1"`, `version 1.4.5`, `buildId QZ0zBZ7sV_o1kPUe6lLxu` (headers file).
2. Third-party cookies: Lighthouse BP is 100 on home, staff, toriyama (r2: 77 each), consistent with the `third-party-cookies` audit now passing (the per-audit item was not stored in the run json; the BP score is the evidence). Fresh-profile CDP network log (12 s plus scroll): zero `Set-Cookie` response headers from any host on `/`, `/wiki/staff`, `/wiki/toriyama`; Audits CookieIssue count 0 on all three (r2 home: 20). Home requests: dragonballfr.com 45, cdn.dragonballfr.com 70, bot.dragonballfr.com 5; no discordapp host. Staff: first party plus cdn only. Toriyama still requests `dosbg3xlm0x1t.cloudfront.net` (4), `cache-www.dragonquest.jp`, `www.jp.square-enix.com`, `dragonballdaima.com` (1 each); no cookie set by them. No wikimedia host requested.
3. Best-practices vs r2: see table; all nine runs are 100.
4. /wiki/episodes/669 before any click (fresh profile, 20 s idle, scroll 900 px, no click, no consent): 79 requests, hosts only dragonballfr.com 19 and cdn.dragonballfr.com 60; zero requests to vidmoly, Yandex, any Google host or any other third party; 0 iframes in the DOM; no `Set-Cookie`. The page's own `/api/ads/eligibility` and `/api/ads/campaigns` fetches are first party. `dbfr_consent` stayed null. Full log: probe json `ep669.log`. The HTML shows a facade button "Charger le lecteur 1" with the text that the player is hosted by a third party that may set cookies and that nothing loads before the click.
   One click on that facade (done once, fresh context, nothing else clicked): it creates an iframe `https://vidmoly.biz/embed-sgr5o72c1l8n.html` and 34 more requests to 14 third-party hosts: vidmoly.biz, cdn.staticmoly.me, cdn.vidmoly.me, jsdelivr (adblock detector), pagead2.googlesyndication.com (adsbygoogle.js, inside the embed, no consent given), jwpcdn.com, jwpltx.com, browpotware.com, llvpn.com, luugy.com, rtmark.net, mc.yandex.ru and mc.yandex.com (Metrika), cdnjs, vmcld.space. Set-Cookie seen: browpotware `GL_UI4`, rtmark `ID`, mc.yandex.ru `bh`, mc.yandex.com `yabs-sid i yandexuid yuidss ymex bh`; 26 Audits cookie issues. So the facade works (nothing before the click) but after the click the embed brings ad and tracking hosts with no consent; the facade text discloses cookies only.
5. Proxies (GET, no custom headers): `/api/avatar/<id>/<hash>.webp?s=64` 200, `image/webp`, `public, max-age=604800, stale-while-revalidate=2592000`, `cf-cache-status HIT`, no Set-Cookie. `/api/ext-image/upload/wikipedia/en/1/15/Akira_Toriyama_in_1982.jpg` 200, `image/jpeg`, same cache-control, HIT, 57,218 B; png and svg also served on toriyama/staff. Not an open proxy on the tests made: `/api/ext-image?url=https://example.com/x.png` returns 404 (HTML not-found page); `/api/ext-image/example.com/x.png` 404; `/api/ext-image/https://example.com/x.png` 308 (redirect target not followed or read); a non-existent avatar id 404. The route is path-based on a Wikimedia path, so the allowlist logic (other hosts, scheme tricks, private addresses) is NOT proven by these benign tests and no internal address was probed.
6. /wiki/cards: HTML 310,153 B decoded (about 303 KiB; r2 12.6 MiB; owner says 295 KB); perf 52 to 79, TBT 14,880 to 890 ms, LCP 2.9 to 1.4 s, BP now scored (100). Crawl: largest HTML is now /wiki/toriyama at 1,047,167 B (r2 largest 12.6 MiB), mean 284 KiB (r2 507 KiB), mean response 406 ms (r2 450).
7. /wiki/timeline LCP 11.9 s (r2 17.0, r1 17.6, before 42.1), perf 45, TBT 1569 ms. Staff perf 55 (r2 44), LCP 5.5 s. Toriyama perf 76 (r2 60), LCP 2.2 s, TBT 674 ms.
8. Cloudflare: `cf-cache-status: DYNAMIC` on `/` (2 GETs) and `/wiki` (3 GETs), no `Age` header, `cache-control: public, max-age=0, s-maxage=60, stale-while-revalidate=600`. The open rule still has no effect on HTML. The avatar and ext-image URLs are HIT at Cloudflare.
9. CSP violations still 0: 7 pages (/, /wiki, /wiki/episodes, /wiki/timeline, /wiki/manga, /catalog, /wiki/cards): 0 `securitypolicyviolation` events, 0 CSP Audits issues, 0 console errors or warnings.
10. Google ad/GTM before consent still 0: `/` (122 requests, 114 in the 20 s idle), 669 (79) and the 7 CSP pages: zero requests to googletagmanager, google-analytics, googlesyndication, doubleclick, gstatic, google.com, googleapis; `dbfr_consent` null, no consent control clicked. (Google ad requests do occur inside the vidmoly embed after the facade click, see 4.)
11. /wiki/episodes CLS still 0 (Lighthouse single run 0.000, perf 43).

## Owner expectations

| Expectation | Result |
|---|---|
| Release 64a12ab1 in header and health | Confirmed |
| Discord avatars and wikimedia images via first-party proxy | Confirmed (home has no discordapp host, ext-image on staff/toriyama, both HIT, 7-day cache) |
| Third-party cookies gone on home, staff, toriyama | Confirmed (0 Set-Cookie, 0 cookie issues, BP 100) |
| Video embeds click-to-load | Confirmed on 669 (0 third-party requests and 0 iframes before the click); after the click ad and tracker hosts load |
| /wiki/cards paginated (13 MiB to 295 KB) | Confirmed (310,153 B decoded, TBT 0.89 s) |
| Timeline backgrounds as lazy img | Consistent: LCP 17.0 to 11.9 s, still slow; markup not inspected |
| content-visibility on staff and toriyama | Consistent: staff perf 44 to 55, toriyama 60 to 76; CSS not inspected |
| Cloudflare HTML caching | Not confirmed (DYNAMIC, no Age) |

## Remaining problems, in priority order

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | High | Mobile perf 43-55 on home, timeline, manga, staff, episodes; LCP 7.4 s home, 11.9 s timeline, 12.5 s episodes, 7.7 s manga; TBT 1.2-1.7 s | Lighthouse |
| 2 | Medium | Embed click loads 14 third-party hosts, adsbygoogle and Yandex Metrika inside the vidmoly frame, 5 cookie-setting hosts, without consent | click probe |
| 3 | Medium | Cloudflare HTML still DYNAMIC, `s-maxage=60` has no edge effect | headers |
| 4 | Medium | Proxy allowlist depth unproven (benign refusals only); `/api/ext-image?url=` returns a 185 KB HTML 404 page | proxy GETs |
| 5 | Low | /wiki/toriyama 1.0 MiB HTML (largest), a11y 90; timeline a11y 97 (color-contrast); `label-content-name-mismatch` on episodes; 17 pages with the copy heuristic; `/mcp` 405 (only crawl error); CORP absent; HSTS without includeSubDomains/preload | crawl, Lighthouse |
| 6 | Info | Report-Only CSP covers `script-src` only | r2 header, not re-read |

Handoff: owner sheron-24. Re-run: `bun tools/site-audit/run.ts dragonballfr --name dragonballfr-after-r3 --lh-urls <urls>`; probes: `bun tools/site-audit/probes/dbfr-r3-probe.ts all|tp|ep669|csp|home|click669 <selector>`.
