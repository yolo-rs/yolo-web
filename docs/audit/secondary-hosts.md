# Secondary and disabled hosts (status, TLS, headers only)

Measured 2026-11-05 about 10:45-10:55 UTC from bunos. Tool: `bun tools/site-audit/run.ts <name>` in light mode (1 page, no crawl, no Lighthouse; Lighthouse not run on these hosts by instruction). GET only, no login. Raw per-host data: `cdn.json`, `deploy.json`, `downloads.json`, `nie.json`, `video.json`, `omar.json`, `creator.json`, `play.json`, `os.json` plus matching `.measured.md` in this directory.

Handoff owner: yolo-ui-aa for the whole table (site map from yolo-ui-aa). Owning repos not located.

## Enabled hosts

| Host | `GET /` | http:// chain | TLS (issuer, expiry) | HSTS | CSP | nosniff | XFO | Referrer-Policy | Server |
|---|---|---|---|---|---|---|---|---|---|
| cdn.aphrody.com | 200 `application/json` | 301, 302, 200 | Let's Encrypt YE1, 2027-01-22 | yes | no | no | no | no | nginx |
| deploy.aphrody.app | 200 `text/html` | 301, 200 | Google Trust Services WE1, 2027-01-09 | yes | no | yes | yes | yes | cloudflare |
| downloads.aphrody.com | 200 `text/html` | 301, 200 | Let's Encrypt YE1, 2027-01-22 | yes | yes | yes | no | yes | nginx |
| nie.aphrody.app | 410 `text/plain` | 301, 410 | Google Trust Services WE1, 2027-01-09 | yes | no | yes | no | no | cloudflare |
| video.aphrody.app | 404 `text/html` | 301, 404 | Google Trust Services WE1, 2027-01-10 | yes | no | yes | no | no | cloudflare |
| omar.aphrody.com | 403 `text/html` | 301, 403 | Let's Encrypt YE2, 2027-01-09 | yes | no | yes | no | yes | cloudflare |

TLS 1.3 verify OK on all six. Permissions-Policy absent on all six.

## Disabled since 11-03 (expected failure)

| Host | `GET /` | http:// chain | TLS | Notes |
|---|---|---|---|---|
| creator.aphrody.com | 526 | 301, 526 | cert Let's Encrypt YE2 valid to 2027-01-09 | Cloudflare 526 (origin certificate invalid or unreachable), no HSTS |
| os.aphrody.com | 526 | 301, 526 | cert Let's Encrypt YE2 valid to 2027-01-09 | same as creator |
| play.aphrody.app | 404 `text/html` on `/`, 526 on `/robots.txt` and an unknown path | 301, 301, 404 | Google Trust Services WE1 | Inconsistent: root answers 404 while other paths answer 526 |

aphrody.app (apex) answers every path with a 302 to a Cloudflare Access login for the `aphrody-labs` team (no login attempted); nothing behind it was measured. Its redirect URL carries a signed token and is not reproduced.

## Findings

| # | Severity | Finding | Proposed patch |
|---|---|---|---|
| 1 | Medium | Disabled hosts still resolve and return Cloudflare 526 error pages; play.aphrody.app mixes 404 and 526 | Remove the DNS records (or serve a deliberate 410 page) for creator, os and play in the Cloudflare zone |
| 2 | Low | `nie.aphrody.app` returns 410 for every path (including robots.txt) | Confirm intentional; otherwise restore the service or drop the DNS record |
| 3 | Low | `omar.aphrody.com` returns 403 on every path (probably an access policy) | Confirm intentional |
| 4 | Low | `cdn.aphrody.com` (nginx): `http://` goes 301 then 302 then 200, JSON at `/`, no nosniff, no Referrer-Policy | Add `X-Content-Type-Options: nosniff` and fix the redirect chain to a single hop |
| 5 | Low | `deploy.aphrody.app`, `nie`, `video`: no CSP; `video.aphrody.app` has no content at `/` (404) | Add CSP where HTML is served; confirm video root is intended |
| 6 | Info | Only `downloads.aphrody.com` sends a CSP among the enabled hosts | None |

Not run: Lighthouse, crawl, link checks, fact check (out of scope for these hosts).
