# Design: yolo-templates

Rebuilds the *system* behind the recon patterns (roles, scale, layout, behaviour), never a reference's look:
no logos, imagery, fonts, icons or copy from R01 to R14. Values come from the eight yolo-ui presets; the templates
only name roles.

## Colour roles

`Palette::resolve(preset, mode)` in `crates/yolo-templates/src/theme.rs` maps the `yolo-shared` tokens of each
preset to 18 roles and solves every foreground role with `ensure_contrast` (moves the colour in 2 % steps toward
the readable end until the ratio holds on every surface it is used on).

| Role | From | Floor | Checked against |
| --- | --- | --- | --- |
| canvas, surface, raised | `bg_primary`, `bg_surface`, `bg_elevated` | - | - |
| text | `text_primary` | 7:1 | canvas, surface, raised |
| muted | `text_secondary` | 4.5:1 | canvas, surface, raised |
| accent (text, links) | `accent_primary` | 4.5:1 | canvas, surface, raised |
| accent-fill / on-accent | `accent_primary`, white or ink | 4.5:1 | each other |
| border | `border_subtle` | none (decorative) | - |
| control-border | `border_subtle` | 3:1 | canvas, surface |
| focus | `accent_primary` | 3:1 | canvas, surface, raised |
| stage, stage-text, stage-muted, stage-accent, stage-fill, stage-on-fill, stage-focus | dark tokens of the same preset | 7 / 4.5 / 4.5 / 4.5 / 3 | stage |

The stage roles are always the dark tokens, so heroes and the reveal stay a dark spotlight in light mode (pattern 1
of the recon) while text on them keeps AA.

### Raw preset pairs the solver had to fix

Measured on the `yolo-shared` values (worst ratio over canvas, surface, raised):

| Preset | Raw failures |
| --- | --- |
| Neutral dark | accent 3.33 |
| Fluent light | accent 4.08 |
| Apple dark | muted 4.45, accent 3.50 |
| Apple light | muted 3.05, accent 3.38 |
| Omarchy light (Catppuccin Latte) | muted 4.05, accent 3.18 |
| Hyprland light | accent 2.73 |
| Aphrody dark | accent 3.82 |
| Chromium light | accent 4.05 |
| All 16 | `border_subtle` as a control boundary 1.03 to 1.83 (kept as decorative `border`, solved as `control-border`) |

After solving: zero AA failures across 8 presets x 2 modes x 18 roles (asserted by
`theme::tests::every_text_role_meets_aa_in_every_preset_and_mode` and `requirements_cover_every_foreground_role`).
The docs shell token page prints every role with its measured ratio in both modes.

## Type

Open variable fonts only (SIL OFL 1.1, referenced by family, not bundled; see `crates/yolo-templates/ASSETS.md`).
The generic faces named in the global rules (Inter, Roboto) and the references' proprietary faces are not in any
stack.

| Role | Default stack | Omarchy | Hyprland |
| --- | --- | --- | --- |
| body | Instrument Sans, Atkinson Hyperlegible Next, system-ui | JetBrains Mono | Instrument Sans |
| display | Bricolage Grotesque | JetBrains Mono | Space Grotesk |
| serif (editorial) | Fraunces, Source Serif 4 | JetBrains Mono | Fraunces |
| mono | JetBrains Mono, Iosevka | JetBrains Mono | JetBrains Mono |

| Step | Size | Line | Weight | Use |
| --- | --- | --- | --- | --- |
| kicker | 13 px, +0.08em caps | 1.5 | 600 | kickers, flyout headings |
| meta | 14 px | 1.5 | 400 to 500 | media metadata, captions |
| body | 16 px | 1.5 | 400 | running text |
| lede | 17 to 21 px fluid | 1.5 | 400 | hero ledes |
| h3 | 24 to 28 px | 1.15 | 600 to 700 | section and card titles |
| h2 | 30 to 60 px fluid | 1.05 to 1.1 | 700 | template titles |
| stage | 40 to 88 px fluid, -0.035em | 1.02 | 700 | stage hero |
| display | 44 to 128 px fluid, -0.04em | 0.95 to 1 | 600 | editorial headline, split title |

## Space, shape, motion

- Spacing: 4 px base; template gaps 4, 8, 12, 16, 24, 32, 40, 48, 64; section padding 64 to 96.
- Radius: `--yt-radius-sm/md/lg` from `YoloStyle` of the preset (Fluent 4/4/8, M3 8/12/16, ...); pills 999 px.
- Targets: every control at least 44 x 44 px except segmented options and tree links (36 px tall, above the
  24 px WCAG 2.5.8 minimum).
- Motion: one infinite animation per surface (object turn, star drift), all tagged `.yt-motion`, all paused by the
  visible pause switch and removed under `prefers-reduced-motion: reduce`. Scroll-driven animation only inside
  `@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`; otherwise the final frame.
- Layout: content max 1200 px (860 px for reading), app and docs frames max 1440 px, compact layout at 720 px.

## Component specs

```
GlobalNav
  parts     skip link, wordmark, items: link | flyout trigger + popover panel (1 group) | mega menu (2+ groups)
  states    closed, open (chevron turns, trigger tinted), hover, focus-visible
  keyboard  Tab to trigger, Enter/Space opens, Tab into panel, Esc closes and returns focus, one panel at a time
  a11y      nav aria-label, button type=button popovertarget + aria-controls, panel aria-label, group h3 + section
  used on   every site page

StageHero
  parts     release pill, eyebrow, h1, lede, primary + optional secondary CTA, Object3d, optional Starfield
  tokens    stage roles only (dark spotlight in both modes)
  a11y      section aria-labelledby the h1; object aria-hidden; one primary action

ReleasePill
  parts     tag, text, arrow; whole pill is one link; min-height 36

Starfield
  parts     three CSS star layers (generated, deterministic) or WGSL shader on GPU hosts; pause switch
  states    running, paused (switch), static (reduced motion)
  a11y      layers aria-hidden; pause is a labelled checkbox role=switch (WCAG 2.2.2)

SectionTabs
  parts     sticky bar of in-page links
  states    current (aria-current=true, accent underline, text colour), hover, focus-visible
  a11y      links, not an ARIA tablist; sections scroll-margin-top 72 px so focus is not obscured (2.4.11)

ProductPageView
  parts     hero (copy + UiSketch), SectionTabs, sections (h3, body, points), FAQ (details/summary)
  a11y      UiSketch is role=img with a description; FAQ native disclosure

DownloadChannels
  parts     cards: name, recommended badge (text), cadence, description, platforms, download button
  states    recommended (2 px accent border + badge + filled button), default (outline button)

DocsShell
  parts     top bar (wordmark, platform segmented control, theme switch), nav tree (details groups), content
            (title, intro, code sample per platform, token table with both modes and ratios)
  keyboard  arrows move between platforms (radio group), Space toggles theme, Enter/Space opens tree groups
  a11y      fieldset + legend, switch role, table caption + scoped headers, scrollable regions focusable

RailAppChrome
  parts     app bar (rail switch, app name, centred search with submit and voice), rail (icon + label), content
  states    rail collapsed (labels under icons), expanded (232 px, labels beside), compact (bottom bar)
  a11y      search form role=search with a label; icon buttons aria-label; rail nav aria-label; aria-current=page

MediaGrid / MediaTile
  parts     generated artwork with badge, avatar initial, title link covering the tile, source, metadata line
  perf      content-visibility auto; visible_window for native virtualisation

EditorialGrid
  parts     kicker, oversized serif headline, lead story (2 x 2 cells, Object3d panel), three stories

ScrollReveal
  parts     split title (two halves converge), Object3d turning to face the reader, body fading in
  states    animated (scroll timeline), final frame (reduced motion, unsupported browsers)
```

## Copy

Every string is in `crates/yolo-templates/src/content.rs`, written for the products (no reference wording, no
lorem, no emoji; enforced by `copy_is_original_and_finished`). Shenron, Rose Griffon and Auto are in French like
their sites; Aphrody, YOLO and Craft in English.

Copy review before publishing (statements of intent rather than verified facts):

- release cadences of the Stable, Preview and Nightly channels (Aphrody, YOLO, Craft);
- sign-in providers on the Aphrody account page (GOAL phase 4, not built);
- "Browser shell now built on Chromium 156" (true for the CEF build in yolo-web; confirm before each release);
- the illustrative values inside UI drawings (page count, ratings).
