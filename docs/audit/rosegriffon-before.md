# rosegriffon.fr audit, "before" baseline

Correction (10:55 UTC): a first Lighthouse pass sent a custom request header that made cross-origin calls fail CORS preflight and produced fake console errors. It was discarded; all Lighthouse numbers below are from the rerun without the header. Console errors are 0 on every page.

Measured 2026-11-05 about 10:05-10:25 UTC from bunos, after the owner reported deploy 972fc663 (BUILD_ID ekHHwPMKZgZb-p8jStMCl, 10:03:40 UTC). Build identity was reported by the owner and not verified by this tool. Tool: `bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-before --max-pages 100`. Raw: [rosegriffon-before.json](rosegriffon-before.json), tables: [rosegriffon-before.measured.md](rosegriffon-before.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, robots honoured, 101 pages crawled (cap 100, depth 2, sitemap sample plus links), 150 of 491 internal link targets and 120 of 340 own-host assets checked. Lighthouse on 9 URLs (home mobile and desktop, 5 heaviest by HTML size, 2 sitemap sample). INP is not measurable in lab. The crawl is a subset: `/wiki/chara`, `/iergday?campagne=*` and `/feed?reseau=x&compte=*` from the owner's earlier audit (`C:\src\rosegriffon\docs\audits\2026-11-05-crawl.md`) were not in this sample.

Handoff owner: rosegriffon-4a. Owning repo: `C:\src\rosegriffon` (apps `rg-website`, `azalee-web`). An "after" pass will be requested later; rerun the same command with `--name rosegriffon-after`.

Cross-check: REA report `C:/src/yolo-re/docs/audits/rea-2026-11-05.md` (yolo-re 1b9b800), section `## rosegriffon.fr`. Not copied here.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 47 | 100 | 77 | 100 | 7.2 | 0.000 | 2604 | 0 |
| desktop | / | 65 | 93 | 77 | 100 | 2.8 | 0.000 | 274 | 0 |
| mobile | /community?serveur=achillea | 33 | 96 | 77 | 100 | 7.9 | 0.000 | 6307 | 0 |
| mobile | /community?serveur=rose-griffon | 63 | 96 | 77 | 100 | 2.0 | 0.000 | 6235 | 0 |
| mobile | /community | 38 | 96 | 77 | 100 | 7.5 | 0.000 | 8019 | 0 |
| mobile | /feed | 38 | 97 | 77 | 100 | 8.4 | 0.000 | 2682 | 0 |
| mobile | /feed?reseau=x | 44 | 97 | 77 | 100 | 8.5 | 0.000 | 2957 | 0 |
| mobile | /news | 43 | 91 | 77 | 100 | 52.4 | 0.000 | 2316 | 0 |
| mobile | /design-system | 53 | 95 | 100 | 100 | 6.4 | 0.000 | 1272 | 0 |

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
| Own-host asset errors | 5 of 120 checked: 4x HTTP 400 from `/iergday` (finding 4) and 1 network error (status 0) on `_next/image?url=%2FRG_screens_twitch_ethan.webp&w=1920&q=75` linked from `/` |
| `cdn.rosegriffon.fr/dx11/menu/` | 502 on one GET |

## Top 10 problems (measured)

| # | Severity | Problem | Evidence | Proposed patch (owning repo `C:\src\rosegriffon`) |
|---|---|---|---|---|
| 1 | High | Home mobile perf 47, LCP 7.2 s, TBT 2604 ms; `/community` TBT 8019 ms (perf 38), `/community?serveur=achillea` perf 33 | Lighthouse | Cut main-thread JS on the home and community pages; lazy-load below-the-fold widgets in `apps/rg-website/src/components/shared/DiscordSection.tsx` and the community page |
| 2 | High | `/community?serveur=achillea` HTML is 5.88 MB; `/community` and `?serveur=rose-griffon` are 3.55 MB; `/feed` is 687 KB | crawl htmlBytes | Paginate or virtualise the member lists in `apps/rg-website/src/app/community/page.tsx` |
| 3 | High | `/news` LCP 52.4 s on mobile Lighthouse; `/feed` LCP 8.4 s with `server-response-time` flagged | Lighthouse | Find the LCP element on `/news` (Lighthouse report not stored; rerun the tool with a single URL) and give it priority/preload; `/feed` fetches slowly (3.6 s server time in crawl) |
| 4 | High | Missing campaign images return 400: `/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp`, `reglement-v2.webp`, and two `_next/image` Instagram thumbnails. Backend body: `NoSuchKey` (object not found) | crawl, curl | Upload the objects or remove the references in `apps/rg-website/src/app/iergday/page.tsx`; the storage proxy returns 400 instead of 404 for missing keys |
| 5 | Medium | Best-practices 77 on every page except /design-system (100): `third-party-cookies` flagged on the home and community pages. No console errors in the clean run | Lighthouse | Identify the cookie-setting third party (ad scripts listed in `apps/azalee-web/next.config.ts` lines 18-25 are candidates, not confirmed) |
| 6 | Low | `/design-system` is publicly reachable and has color-contrast and heading-order failures (a11y 95) | Lighthouse | Gate or noindex the page, or fix the tokens |
| 7 | Medium | `/settings` is a user page but is `index, follow` with no canonical and no h1 | crawl | Add `robots: { index: false }` in `apps/rg-website/src/app/settings/page.tsx` metadata and add `/settings` to the Disallow list in `apps/rg-website/src/app/robots.ts` |
| 8 | Medium | Canonical problems: 24 of 101 pages have no canonical; 28 have a canonical different from the URL (query-string variants of /community and /feed canonicalise to the base page, which is intended; `/feed/status/*` and `/settings` have none) | crawl | Add canonical metadata to `/feed/status/[id]` and the other pages without one |
| 9 | Medium | 11 of 101 pages have titles over 70 characters (e.g. `/sondages/3e501896`, 105 chars) and 16 pages lack og:title or og:image (e.g. `/charte-engagements`, `/evenements`) | crawl | Shorten the sondages title template; add OG metadata to those routes' `generateMetadata` |
| 10 | Low | Copy: repeated words ("Bureau Bureau" on `/notre-equipe`, "Patreon Patreon" on `/nous-soutenir`, "Chroniques Chroniques" and "Critique Critique" on `/wiki`, "Tournoi Tournoi" on `/achillea/tournaments`, "Président Président" on `/achillea/guide`, "Hyroto Hyroto" on `/community`, "Instagram Instagram" on `/feed`) and mojibake `U+FFFD` on `/feed?groupe=Inazuma+Eleven` and three `/feed/status/*` pages | crawl copy heuristics | Likely icon plus label rendered as text twice (heuristic can false-positive when an icon name is in the DOM text); inspect and fix the duplicated label in each component; fix the encoding of the tweet text on the `U+FFFD` pages |

Further measured items: no security.txt (404); CSP only restricts framing; `/design-system` is publicly reachable with perf 53 and LCP 6.4 s.

## Fact check

| Claim | Source | Result |
|---|---|---|
| Home meta: "wiki Victory Road, ladder et tournois e-sport, actualites et communaute" and og:description "depuis 2019" | repo/data | Not checked against repo (no founding-date source located) |
| Sitemap lists 40 URLs | `apps/rg-website/src/app/sitemap.ts` | Live count 40; static route count in the file not compared |
| Earlier owner audit items (doubled names on `/wiki/chara`, 502 on `cdn.rosegriffon.fr/dx11/menu/...`, 400 on iergday storage objects) | `docs/audits/2026-11-05-crawl.md` | Still present: cdn dx11 502 and iergday 400 reproduced; `/wiki/chara` was not in this sample |

## Handoff

Owner rosegriffon-4a. After-pass command: `bun tools/site-audit/run.ts rosegriffon --allow-rosegriffon --name rosegriffon-after --max-pages 100`.
