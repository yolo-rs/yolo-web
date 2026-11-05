# Architecture: yolo-templates (shared page templates for the Aphrody sites)

Input: `recon.md` and `features.csv` in this folder (patterns R01 to R14). Output: the `yolo-templates` crate in
`yolo-ui` (branch `claude-yolo-templates`, path `crates/yolo-templates`). This is a template library, not an app
clone: no product is copied, the cross-cutting patterns are rebuilt as original components that every Aphrody site
(Aphrody, YOLO, Shenron, Rose Griffon, Auto, Craft) renders with its own copy.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Components | Dioxus 0.8 RSX (`packages/dioxus` in yolo-ui, features `macro html signals hooks`) | Primary component stack of yolo-ui GOAL phase 3; one source for web (SSR plus hydration), desktop and Blitz native |
| Server rendering | `dioxus-ssr` (`render_document`) | Pages work with scripting off; showcase and screenshots need no browser runtime |
| Theme | `yolo-shared` presets read-only, solved in `theme.rs` | Eight presets x light/dark; WCAG solver fixes pairs the raw presets miss |
| Layout | `yolo-layout` (Taffy 0.15) on `LAYOUT_CSS` | The same box rules run in the browser and in Taffy, so native hosts and tests get identical rects |
| GPU background | WGSL (`shaders/starfield.wgsl`), validated with naga 30 | yolo-gpu has no shader directory with a clear owner, so the shader stays in the crate (task rule) |
| Interaction without script | native `popover`, `details`, radio groups, `:has()` | Keyboard support comes from the platform: Esc, focus return, arrow keys in radio groups |
| Interaction with Dioxus | signals in `SectionTabs`, `Starfield`, `RailAppChrome`, `DocsShell` | Same state after hydration and in native renderers |

No database, auth, payments, email or jobs: the templates are presentation only. Steps 2 to 4 of replica-architect
(schema, API, webhooks) do not apply; the data model is the typed content in `src/content.rs`.

## Data model (content types)

| Type | Feeds | Notes |
| --- | --- | --- |
| `Site` | every template | id, name, domain, interface `Strings` (en or fr) and one value per template below |
| `NavItem` / `LinkGroup` / `Link` | `GlobalNav` | 0 groups = link, 1 = flyout, 2+ = mega menu |
| `Release` | `ReleasePill` | tag, text, href |
| `Hero` | `StageHero`, product hero | one primary `Link`, optional secondary |
| `ProductPage` / `Section` / `Faq` / `Sketch` | `ProductPageView`, `SectionTabs`, `UiSketch` | section ids unique per page (tested) |
| `Downloads` / `Channel` | `DownloadChannels` | exactly one recommended channel (tested) |
| `AppChrome` / `RailItem` / `MediaItem` | `RailAppChrome`, `MediaGrid` | media artwork generated from a hue, no image |
| `Editorial` / `Story` | `EditorialGrid` | first story leads with the 3D object |
| `Reveal` | `ScrollReveal` | two title halves and a body line |
| `Docs` / `DocNode` / `Platform` | `DocsShell` | documents yolo-ui itself; token page generated from `Palette` |

## Module map

| Module | Responsibility |
| --- | --- |
| `theme.rs` | WCAG luminance and contrast, `ensure_contrast` solver, `Palette` (18 roles), `TypeStacks`, `theme_css()` |
| `content.rs` | content types, EN and FR interface strings, the six sites, the docs tree |
| `nav.rs` | `GlobalNav` (popover flyouts and mega menu), `SectionTabs` |
| `hero.rs` | `StageHero`, `ReleasePill`, `Object3d`, `Starfield` |
| `product.rs` | `ProductPageView`, `UiSketch`, `DownloadChannels`, `EditorialGrid`, `ScrollReveal` |
| `app.rs` | `RailAppChrome`, `MediaGrid`, `MediaTile`, `visible_window`, `auto_fill_columns` |
| `docs.rs` | `DocsShell`, `token_rows`, `platform_css` |
| `motion.rs` | `reveal_progress`, `RevealFrame`, `StarfieldClock`, `StarfieldUniforms`, deterministic `stars` |
| `style.rs` | `LAYOUT_CSS` and `LAYOUT_COMPACT_CSS` (yolo-layout subset), `PAINT_CSS`, `stylesheet()` |
| `layout.rs` | Taffy trees for app chrome, docs shell and editorial grid |
| `page.rs` | `Template`, `ThemeRoot`, `TemplatePage`, `render_document` |
| `examples/showcase.rs` | 16 preset pages (8 presets x 2 modes) plus 12 site pages and an index |

## Boundaries kept

- `crates/yolo-icons`, `crates/yolo-emit`, `scripts/ui.ts` and `GOAL.md` are owned by other branches and were not
  touched. The crate draws its eleven line icons itself and exposes `IconName` so `yolo-icons` can replace them.
- `yolo-shared` and `yolo-layout` are dependencies, read-only. `yolo-tokens` is not needed: the solver works on the
  `yolo-shared` token strings directly.
- `catalog/assets.lock.toml` is absent on `origin/main`; the asset record is `crates/yolo-templates/ASSETS.md`.
- Workspace changes: one `members` entry and one hand-written `Cargo.lock` package entry (no new registry crates),
  so the fleet runner's `--locked` builds accept it.

## The parts that bite

- Popover positioning: flyouts are full-width panels fixed under a 52 px bar. A page whose nav is not at the top of
  the viewport needs CSS anchor positioning instead; that is not done.
- `:has()` drives the theme switch, rail switch, platform switcher and pause switch. Browsers without `:has()` keep
  the server-rendered state (still usable, not switchable without hydration).
- Scroll timelines exist only in Chromium-based browsers today; elsewhere the reveal shows its final frame, which is
  also what reduced motion shows.
- Blitz and other native renderers do not implement `popover`; there the flyouts need a signal-driven open state,
  which is not wired yet.
- Copy that states release cadences and sign-in providers describes intended product behaviour; the owner must
  confirm it before a site publishes it (see design.md, copy review).

## Build order (as executed)

1. Vertical slice: `theme.rs` solver and `render_document` with all templates for one site.
2. Must-haves: stage hero, global nav with flyouts, sticky section tabs, product page, docs shell, preset switching,
   rail app chrome with centred search.
3. Should-haves: mega menu, download channels, release pill, dense media grid, editorial grid, scroll reveal,
   terminal identity (Omarchy stacks).
4. Could-haves: split title, starfield shader with pause.
5. Not started: language picker, region banner, audience segmented control, listen-to-article, benchmark charts.
