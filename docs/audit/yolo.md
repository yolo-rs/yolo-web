# yolo.aphrody.com audit

Measured 2026-11-05 about 10:55 UTC from bunos (Chrome for Testing 157 headless shell, Lighthouse via `bun`). Tool: `bun tools/site-audit/run.ts yolo`. Raw: [yolo.json](yolo.json), tables: [yolo.measured.md](yolo.measured.md).
Limits: GET only, 2 concurrent, 250 ms gap, no login. The site is one page with no internal links and no sitemap, so 1 page was crawled and Lighthouse ran on `/` only (mobile and desktop). INP is not measurable in lab.

Handoff owner: yolo-ui-aa. Owning repo: `C:\src\yolo-ui` (HEAD 00554c10b). Deploy config `wrangler.jsonc` (assets from `dist/yolo-aphrody-com`, custom domain `yolo.aphrody.com`); page markup is generated in `apps/yolo-showcase/src/site_hub.rs`.

## Scores (Lighthouse lab)

| Form | Page | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| mobile | / | 100 | 91 | 100 | 91 | 1.0 | 0.000 | 0 | 0 |
| desktop | / | 100 | 91 | 100 | 91 | 0.3 | 0.000 | 0 | 0 |

## Routes, redirects, TLS, headers

| Item | Result |
|---|---|
| / | 200 (served from Cloudflare cache, `cf-cache-status: HIT`) |
| /robots.txt | 200, no rules |
| /sitemap.xml, /favicon.ico, /.well-known/security.txt | 404 each |
| http:// | 301 to https (1 hop) |
| TLS | TLS 1.3, cert CN=aphrody.com (SAN not parsed), Google Trust Services WE1, valid 2026-11-04 to 2027-02-02, verify OK |
| Headers | HSTS 2 years, nosniff. Absent: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP |

## Findings

| # | Severity | Finding | Evidence | Proposed patch |
|---|---|---|---|---|
| 1 | Medium | Page claims do not match the repo: "7 Presets" / "7 Presets Thèmes" while `YoloThemePreset` has 8 variants (Neutral, M3, Fluent, Apple, Omarchy, Hyprland, Aphrody, Chromium) and the README says 8; "124 Submodules" while `.gitmodules` has 156 entries and the README says 151 | live text; `crates/yolo-shared/src/lib.rs` line 176; `README.md` line 13; `.gitmodules` | In `apps/yolo-showcase/src/site_hub.rs` lines 4, 449, 672, 691 and `apps/yolo-showcase/src/main.rs` line 56, derive the counts from the preset enum and the submodule list at build time instead of literals. Also the migrate description at `site_hub.rs` line 310 says "7 YoloThemePresets" |
| 2 | Medium | No meta description, no canonical, no Open Graph tags; title exceeds 70 characters ("yolo.aphrody.com — Unified Dioxus, Iced, Egui, Taffy, WGPUI & Zed GPUI Hub"); Lighthouse SEO 91 | crawl, Lighthouse | Add `<meta name="description">`, canonical, og:title/og:image to the page template in `site_hub.rs`; shorten the title |
| 3 | Medium | Colour-contrast failures (a11y 91) | Lighthouse `color-contrast` | Raise `--yolo-muted` (`#a1a1aa` on the dark surfaces is a candidate; elements not itemised, rerun to list) in the page CSS in `site_hub.rs` |
| 4 | Low | Mixed languages on one page: English nav and headings ("Showcase", "Starter Templates", "Interactive Theme & Multi-Engine Showcase") next to French ("Plan de Migration", "Benchmarks & Comparatifs", "Portail Unifié", "7 Presets Thèmes", "Architecture unifiée") | page text | Choose one language per page or add `lang`-scoped sections; `<html lang>` value not recorded |
| 5 | Low | No CSP, Referrer-Policy, Permissions-Policy, COOP; no `_headers` file | headers | Add a `_headers` file to the assets directory published by `wrangler.jsonc` |
| 6 | Low | No favicon (404), no sitemap, no security.txt | routes | Add `favicon.svg`/`.ico` and a one-URL sitemap to the published assets |
| 7 | Info | Page weight/perf is excellent (static, cached) | Lighthouse | None |

## Fact check

| Claim (live) | Repo | Result |
|---|---|---|
| "7 Presets" | 8 variants in `YoloThemePreset`; README "8 built-in theme presets" | Mismatch (see finding 1) |
| "124 Submodules" / "Awesome Hub (124 Submodules)" | `.gitmodules` 156 entries; README "151 forked submodules" | Mismatch; the README and `.gitmodules` also disagree with each other |
| "Dioxus 0.8, Iced 0.14, Egui 0.36, Taffy 0.15" | `README.md` lines 62 (Iced 0.14) and others | Iced 0.14 matches README; other versions not checked against `Cargo.toml` |
| "Starter Templates (8)", "Plan de Migration (6 Piliers)" | not checked | Not verified |

## Handoff

Owner yolo-ui-aa. Re-run: `bun tools/site-audit/run.ts yolo`.
