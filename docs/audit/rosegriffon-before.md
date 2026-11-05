# rosegriffon.fr audit, "before" baseline

Measured 2026-11-05 about 10:05-10:25 UTC from bunos, after the owner reported deploy 972fc663 (BUILD_ID ekHHwPMKZgZb-p8jStMCl, 10:03:40 UTC). Build identity was reported by the owner and not verified by this tool. Tool: `bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-before --max-pages 100`. Raw: [rosegriffon-before.json](rosegriffon-before.json), tables: [rosegriffon-before.measured.md](rosegriffon-before.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, robots honoured, 101 pages crawled (cap 100, depth 2, sitemap sample plus links), 150 of 491 internal link targets and 120 of 340 own-host assets checked. Lighthouse on 9 URLs (home mobile and desktop, 5 heaviest by HTML size, 2 sitemap sample). INP is not measurable in lab. The crawl is a subset: `/wiki/chara`, `/iergday?campagne=*` and `/feed?reseau=x&compte=*` from the owner's earlier audit (`C:\src\rosegriffon\docs\audits\2026-11-05-crawl.md`) were not in this sample.

Handoff owner: rosegriffon-4a. Owning repo: `C:\src\rosegriffon` (apps `rg-website`, `azalee-web`). An "after" pass will be requested later; rerun the same command with `--name rosegriffon-after`.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 53 | 100 | 73 | 100 | 5.1 | 0.000 | 2136 | 26 |
| desktop | / | 82 | 93 | 73 | 100 | 2.1 | 0.000 | 218 | 26 |
| mobile | /community?serveur=achillea | 34 | 96 | 73 | 100 | 6.8 | 0.000 | 5942 | 20 |
| mobile | /community?serveur=rose-griffon | 61 | 96 | 73 | 100 | 2.0 | 0.000 | 6606 | 20 |
| mobile | /community | 62 | 96 | 73 | 100 | 2.0 | 0.000 | 7063 | 20 |
| mobile | /feed | 38 | 97 | 73 | 100 | 8.4 | 0.000 | 2405 | 20 |
| mobile | /feed?reseau=x | 45 | 97 | 73 | 100 | 8.4 | 0.000 | 2341 | 20 |
| mobile | /news | 44 | 91 | 73 | 100 | 52.1 | 0.000 | 2550 | 20 |
| mobile | /design-system | 48 | 95 | 100 | 100 | 9.6 | 0.000 | 1734 | 0 |

## Routes, redirects, TLS, headers

| Item | Result |
|---|---|
| / and 101 crawled pages | all 200 |
| /robots.txt | 200, 12 Disallow rules |
| /sitemap.xml | 200, 40 URLs |
| /.well-known/security.txt | 404 |
| unknown path | 404 |
| http:// and www | 301 to https://rosegriffon.fr/ (1 hop each) |
| TLS | TLS 1.3, CN=rosegriffon.fr, Let's Encrypt YE1, valid 2026-10-11 to 2027-01-09, verify OK |
| Headers | HSTS 2 years (no includeSubDomains/preload), nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy, COOP same-origin-allow-popups. CSP on the response is only `frame-ancestors 'self' https://*.rosegriffon.fr` (no script/style/img restrictions). CORP absent. `cache-control: s-maxage=300, stale-while-revalidate=31535700` with `cf-cache-status: DYNAMIC` |
| Broken internal links | 0 of 150 checked |
| Own-host asset 4xx | 4 of 120 checked, all from `/iergday` (see finding 4) |
| `cdn.rosegriffon.fr/dx11/menu/` | 502 on one GET |

## Top 10 problems (measured)

| # | Severity | Problem | Evidence | Proposed patch (owning repo `C:\src\rosegriffon`) |
|---|---|---|---|---|
| 1 | High | Home mobile perf 53, LCP 5.1 s, TBT 2136 ms; `/community` TBT 7063 ms, `/community?serveur=achillea` perf 34 | Lighthouse | Cut main-thread JS on the home and community pages; lazy-load below-the-fold widgets in `apps/rg-website/src/components/shared/DiscordSection.tsx` and the community page |
| 2 | High | `/community?serveur=achillea` HTML is 5.88 MB; `/community` and `?serveur=rose-griffon` are 3.55 MB; `/feed` is 687 KB | crawl htmlBytes | Paginate or virtualise the member lists in `apps/rg-website/src/app/community/page.tsx` |
| 3 | High | `/news` LCP 52.1 s on mobile Lighthouse; `/feed` LCP 8.4 s | Lighthouse | Find the LCP element on `/news` (Lighthouse report not stored; rerun the tool with a single URL) and give it priority/preload; `/feed` fetches slowly (3.6 s server time in crawl) |
| 4 | High | Missing campaign images return 400: `/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp`, `reglement-v2.webp`, and two `_next/image` Instagram thumbnails. Backend body: `NoSuchKey` (object not found) | crawl, curl | Upload the objects or remove the references in `apps/rg-website/src/app/iergday/page.tsx`; the storage proxy returns 400 instead of 404 for missing keys |
| 5 | Medium | 26 console errors on the home, 20 on other pages: CORS blocks on `https://discord.com/api/guilds/<id>/widget.json` and failed XHR to `fundingchoicesmessages.google.com`. Best-practices 73 on every page except /design-system | Lighthouse | Call Discord widget data through a same-origin route handler instead of the browser (`DiscordSection.tsx` line 132); gate the consent/ad script load. Ad hosts are listed in `apps/azalee-web/next.config.ts` lines 18-25 |
| 6 | Medium | Third-party cookies flagged (Lighthouse `third-party-cookies`) on home and community pages | Lighthouse | Identify the setting host (ad scripts above are the likely source, not confirmed) |
| 7 | Medium | `/settings` is a user page but is `index, follow` with no canonical and no h1 | crawl | Add `robots: { index: false }` in `apps/rg-website/src/app/settings/page.tsx` metadata and add `/settings` to the Disallow list in `apps/rg-website/src/app/robots.ts` |
| 8 | Medium | Canonical problems: 24 of 101 pages have no canonical; 28 have a canonical different from the URL (query-string variants of /community and /feed canonicalise to the base page, which is intended; `/feed/status/*` and `/settings` have none) | crawl | Add canonical metadata to `/feed/status/[id]` and the other pages without one |
| 9 | Medium | 11 of 101 pages have titles over 70 characters (e.g. `/sondages/3e501896`, 105 chars) and 16 pages lack og:title or og:image (e.g. `/charte-engagements`, `/evenements`) | crawl | Shorten the sondages title template; add OG metadata to those routes' `generateMetadata` |
| 10 | Low | Copy: repeated words ("Bureau Bureau" on `/notre-equipe`, "Patreon Patreon" on `/nous-soutenir`, "Chroniques Chroniques" and "Critique Critique" on `/wiki`, "Tournoi Tournoi" on `/achillea/tournaments`, "Président Président" on `/achillea/guide`, "Hyroto Hyroto" on `/community`, "Instagram Instagram" on `/feed`) and mojibake `U+FFFD` on `/feed?groupe=Inazuma+Eleven` and three `/feed/status/*` pages | crawl copy heuristics | Likely icon plus label rendered as text twice (heuristic can false-positive when an icon name is in the DOM text); inspect and fix the duplicated label in each component; fix the encoding of the tweet text on the `U+FFFD` pages |

Further measured items: no security.txt (404); CSP only restricts framing; `/design-system` is publicly reachable with perf 48 and LCP 9.6 s.

## Fact check

| Claim | Source | Result |
|---|---|---|
| Home meta: "wiki Victory Road, ladder et tournois e-sport, actualites et communaute" and og:description "depuis 2019" | repo/data | Not checked against repo (no founding-date source located) |
| Sitemap lists 40 URLs | `apps/rg-website/src/app/sitemap.ts` | Live count 40; static route count in the file not compared |
| Earlier owner audit items (doubled names on `/wiki/chara`, 502 on `cdn.rosegriffon.fr/dx11/menu/...`, 400 on iergday storage objects) | `docs/audits/2026-11-05-crawl.md` | Still present: cdn dx11 502 and iergday 400 reproduced; `/wiki/chara` was not in this sample |

## Handoff

Owner rosegriffon-4a. After-pass command: `bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-after --max-pages 100`.
