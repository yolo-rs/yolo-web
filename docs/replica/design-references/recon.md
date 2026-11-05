# Replica recon: design references for the YOLO design system

Captured 2026-11-05 with Claude in Chrome on the owner's browser, at human speed, public pages only.
Screenshots in `screens/` are reference only (git-ignored, never shipped). Purpose: extract patterns for
`yolo-ui` (see `C:\src\yolo-ui\GOAL.md`), not to clone any site. No logos, product imagery, copy, fonts or
code from these sites enter the product. The owner's own Gmail and Drive were not opened, to keep private
mail and files out of the capture; their public product pages were used instead.

## Targets

| ID | Target | URL | Kind | Pattern worth learning |
| --- | --- | --- | --- | --- |
| R01 | Google Search | https://www.google.com/ | web app | see `../ntp-search/recon.md` |
| R02 | Googlebook | https://googlebook.google/ | product launch site | black stage, single centered product reveal, one pill CTA, scroll-tied 3D hardware, quiet top bar (Switch, Shop) |
| R03 | Omarchy | https://omarchy.org/ | OS project site | monospace terminal aesthetic, dark grid, release pill banner, site theme switcher, language picker, audio-backed demo, theme gallery at /themes |
| R04 | GNOME OS | https://os.gnome.org/ | OS project site | saturated brand gradient with large geometric shapes, laptop mockup with real UI, two channel cards (Preview, Nightly), pill announcement |
| R05 | COSMIC DE | https://system76.com/cosmic | DE marketing | light retail chrome, wordmark hero, one amber CTA, screenshot strip of desktop themes |
| R06 | Fluent 2 | https://fluent2.microsoft.design/ | design system site | left nav tree, platform switcher (React, iOS, Android, Windows), theme toggle, glass 3D hero mark, Design/Develop entry cards, token docs |
| R07 | Microsoft 365 | https://www.microsoft.com/microsoft-365 | suite marketing | warm off-white canvas, serif-less large headline, 3D soft shapes, audience segmented control |
| R08 | Google Workspace | https://workspace.google.com/ | suite marketing | mega menu (Solutions, Products), sticky section tabs, product-page template reused per app (Drive: hero + UI illustration + section tabs) |
| R09 | Google Drive | https://workspace.google.com/products/drive/ | product page | same template as R08; UI shown as simplified illustration, not a screenshot |
| R10 | YouTube | https://www.youtube.com/ | media app | collapsed rail nav, centered search with voice, 3-column thumbnail grid, dense metadata rows |
| R11 | Apple | https://www.apple.com/ | brand site | global nav with per-item flyout, full-bleed black stage, two CTAs (filled, outline), product as hero, region selector banner |
| R12 | Google Design | https://design.google/ | editorial | dark editorial grid, oversized grotesk headline, 3D rendered illustration panel |
| R13 | OpenAI GPT-6 Sol and Luna | https://openai.com/index/introducing-gpt-6-sol-and-luna/ | launch article | black starfield, centered title, listen-to-article control, share |
| R14 | OpenAI GPT-6 Astra | https://openai.com/index/gpt-6-astra/ | launch article, 3D | scroll-driven split title (GPT ... Astra) converging, particle starfield, embedded film, narrow reading column, benchmark tab strip |

## Cross-cutting patterns (input to yolo-ui)

1. Stage and spotlight: one hero object on a near-black or saturated field, one primary CTA (R02, R11, R13, R14).
2. Scroll-driven 3D and type choreography with a static fallback (R02, R14); must honour reduced motion.
3. Design-system sites share: left nav tree, platform switcher, theme toggle, token pages (R06; Material and Omarchy docs).
4. Suite sites share a reusable product-page template: hero, UI illustration, sticky section tabs, FAQ (R08, R09, R07).
5. App chrome: rail navigation, centered search with voice, dense media grid (R10); search-first home (R01).
6. Community OS sites lean on terminal or geometric identity plus downloadable channels (R03, R04, R05).

## Feature matrix

See `features.csv`. Every row maps a pattern to a yolo-ui deliverable; brand assets, imagery, copy and
fonts of the references are `skip` rows.
