# Design: YOLO new tab (replica-design)

Inputs: `recon.md`, the reference screens S01-S03 (looked at for hierarchy
only), the yolo-ui token engine and `crates/yolo-chromium/src/theme.rs`.
Outputs: this file, `design/tokens.json` (generated), the primitives in
`packages/chrome-extension-yolo/src/styles.ts` and `src/components/`.

## What was rebuilt and what was not taken

Rebuilt (the system, not ownable): a centered hero search box over a grid of
round-welled shortcut tiles, a list popup under the box, a right-docked
customize panel, an edit dialog, an undo toast, a dismissible card.

Not taken: the Google wordmark, product logos, doodles, the Google Sans family,
Google blue, background collections, every string of copy. Labels were written
fresh ("What are you looking for?", "Opened today", "Pin the sites you open
every day.", "Customize this page"). Icons are drawn for this page (14 single
paths on a 24-unit grid, `src/components/icons.tsx`), no icon pack.

## Mark

`src/icon.ts`: an "A" of three round-capped strokes on a rounded violet tile;
the crossbar stops short of the right leg, which keeps it legible at 16 px and
makes it Aphrody's own. Gold stroke `#f2c14e` on a `#3a2563` to `#1c0f2b`
gradient, the accent and surfaces of the `aphrody` preset in theme.rs. The PNG
icons (16, 32, 48, 128) are rasterized from the same geometry by
`scripts/icons.ts`; the inline SVG logo uses it too.

## Type

Instrument Sans variable (weight 400-700, width 75-100), SIL OFL 1.1, by The
Instrument Sans Project Authors. Downloaded from `google/fonts`
`ofl/instrumentsans/InstrumentSans[wdth,wght].ttf` on 2026-11-05,
SHA-256 `b24f1812584816958afcf22e22d08e44318c5e51651e25d2438efdde389b33b1`,
shipped as `assets/fonts/InstrumentSans-Variable.ttf` with `assets/fonts/OFL.txt`
and loaded with the `FontFace` API (no network, no `@font-face` URL in CSS).
Why this face: a calm grotesque with open apertures that stays readable at
14-16 px in the field and the suggestion rows, and a width axis that narrows
the 32 px brand line (`font-stretch: 92%`) without a second family. It is not
Inter, Roboto or a system default stack; the fallback (`system-ui, sans-serif`)
only covers the first paint. The upstream repository ships no WOFF2, so the
TTF (194 KB) is shipped as is.

| step    | size / line | weight | used for                                  |
| ------- | ----------- | ------ | ----------------------------------------- |
| label   | 12 / 16     | 550    | field labels, group titles, footer, meta  |
| body    | 14 / 20     | 420    | tile titles, card text, panel text        |
| field   | 16 / 24     | 420    | the search input, suggestion rows, inputs |
| title   | 20 / 28     | 600    | card, dialog and panel titles             |
| display | 32 / 40     | 640    | the brand line                            |

Suggestion rows: the typed span is 420, the completion 650.

## Space, shape, motion

- Space: 4 px half grid, `[0, 4, 8, 12, 16, 24, 32, 48, 64]`.
- Targets: 40 px minimum for every icon button, menu item, choice and switch
  (WCAG 2.2 SC 2.5.8 asks for 24 px); tiles are 112 px tall.
- Radius per preset (`control / card / field`): default 20/16/28, neutral
  8/12/12, m3 20/12/28, fluent 4/8/4, apple 10/14/10, omarchy 6/8/6,
  hyprland 10/12/10, aphrody 20/16/28.
- Motion: 120 ms `cubic-bezier(.2,.8,.2,1)` on hover and state changes only;
  `prefers-reduced-motion: reduce` collapses every transition and the
  skeleton shimmer to 0.01 ms.
- Blur behind the field: apple 24 px, hyprland 8 px, others none.
- Hyprland draws its cyan-to-green gradient as the field border.

## Color

### Roles

Semantic roles (`ColorRoles` in `src/scheme.ts`), exposed as `--yw-*` custom
properties. Components never use a hex value; a unit test fails if the style
sheet contains one.

| role                                    | use                                                    |
| --------------------------------------- | ------------------------------------------------------ |
| surface                                 | page background                                        |
| on-surface                              | body text on every surface role                        |
| on-surface-variant                      | secondary text: labels, hosts, times, notes            |
| surface-container-low                   | tiles at rest, the card                                |
| surface-container                       | search field, list popup, dialogs, panel               |
| surface-container-high                  | hovered tiles, rows, menu items                        |
| surface-container-highest               | tile icon wells, switch track                          |
| outline                                 | input borders, the field boundary, switch border (3:1) |
| outline-variant                         | decorative hairlines only                              |
| primary / on-primary                    | submit and primary buttons, links, selected switches   |
| secondary-container / on-               | selected choices and the highlighted suggestion row    |
| error                                   | validation text and invalid borders                    |
| inverse-surface / on- / inverse-primary | the undo toast and its action                          |
| focus-ring (= primary)                  | 2 px focus outline, offset 2 px                        |

### Seed themes (`default`, `neutral`)

HCT port in `src/hct.ts`: `color_math.rs`, `cam16.rs` and `hct.rs` of
yolo-ui `crates/yolo-tokens`, which port material-color-utilities
(Copyright Google LLC, Apache-2.0; attribution in the file header). Scheme:
Material "tonal spot" (primary chroma 36, secondary 16, neutral 6, neutral
variant 8, error hue 25 chroma 84) with the MCU tones (light: surface N98,
containers N96/94/92/90, primary P40; dark: surface N6, containers
N10/12/17/22, primary P80). `neutral` uses chroma 0 everywhere except error.
Both follow the device (`prefers-color-scheme`) unless the panel forces Light
or Dark. Default seed `#6d4bc3`; swatches violet, blue, teal, green, gold,
orange, rose, slate, plus any color from the color input.

### Brand presets (`m3`, `fluent`, `apple`, `omarchy`, `hyprland`, `aphrody`)

Each carries the five colors that `yolo-chromium --theme=<id>` paints into the
browser chrome: frame, surface, field, text, accent. The page uses `surface`,
`text` and `field` unchanged as `surface`, `on-surface` and
`surface-container`, so the new tab and the toolbar around it are the same
colors; a unit test parses theme.rs and fails on drift. Other roles are mixes
of those five. Then every text and boundary role is moved in HCT tone (hue and
chroma kept) until it meets AA against all surface roles. Visible result: the
Apple accent `#007aff` becomes `#0060ca` as text and button fill (3.72:1 to
5.51:1 on the `#f6f6f6` surface, 4.02:1 to 5.96:1 under white text), Fluent `#0067c0` becomes `#0062b7`, M3 `#6750a4` becomes
`#624b9f`, Omarchy `#7aa2f7` becomes `#7fa7fd`; the browser chrome keeps the
original accents.

`neutral` and `default` both map to `--theme=neutral|default` in yolo-chromium,
which keeps Chromium's own colors.

### Contrast report

`bun run scripts/tokens-json.ts design/tokens.json` then
`python contrast.py design/tokens.json` (replica-design): **290 pairs, 0
failing AA** (normal text 4.5:1 for on-surface, on-surface-variant, primary
and error on all five surface roles, on-primary, on-secondary-container,
inverse pairs; 3:1 for the outline on all surface roles). Lowest: m3 outline
on surface-container-highest 3.00:1. `bun test` (palette.test.ts) checks the
same pairs for every preset and for 74 seeds in light and dark.

Over a background image, the brand line and the footer get a solid
surface-container pill, and tiles, card and field are solid, so text never
sits directly on the image.

## Components

```
Search box (S01, S02)
  variants  hero
  states    idle, focused (boundary turns primary, 3 px), typing (clear button shows),
            list open (bottom corners square, shadow), option highlighted (secondary-container,
            3 px primary bar), empty submit (focus stays)
  tokens    surface-container, outline, primary, radius field, type field
  a11y      ARIA 1.2 combobox: input role=combobox, aria-expanded, aria-controls,
            aria-activedescendant, aria-autocomplete=list; listbox role=listbox with role=option rows;
            label "Search with <host>"; result count announced in a polite live region;
            keys Down, Up (wraps to typed text), Enter, Escape (close, then clear), Tab (close)
  used on   S04

Suggestion row
  variants  query, own past query (history glyph), page (page glyph, host on the right)
  states    default, hover, highlighted
  a11y      mouse down does not steal focus from the input

Shortcut tile (S04)
  variants  site (favicon from the browser cache, monogram fallback), add
  states    default, hover, focus-within (menu button shows), dragging (50%),
            drop target (3 px primary bar on the side it will land)
  a11y      a real link; separate "Options for <title>" menu button, aria-haspopup=menu;
            menu: role=menu, Up/Down/Home/End, Escape returns focus; Move left/right
            as the non-drag alternative (2.5.7); moves announced
  used on   S04

Dialog: edit shortcut (S06)
  states    add, edit (adds Remove), invalid (aria-invalid, error text linked by aria-describedby)
  a11y      native <dialog> showModal: focus trap, Escape, backdrop

Side panel: customize (S05)
  groups    Theme (8 radio cards with a surface/accent swatch), Color seed (8 radios + color input;
            disabled with a note for brand presets), Light and dark (Device/Light/Dark; disabled for
            fixed-scheme presets), Background (None / My image + Choose image), Shortcuts (switch +
            My shortcuts / Most visited + Restore), Cards (switch + history access note + Turn off),
            Footer (switch), Search (search and suggestion templates, Save, Clear search history)
  a11y      native <dialog> docked right; fieldset/legend groups; switches are
            <input type=checkbox role=switch> with labels; focus returns to the Customize button

Card: Opened today (S04)
  states    needs access (explains the permission first), loading (3 skeleton rows, aria-busy),
            empty, filled (favicon, title, host, relative time)
  a11y      section labelled by its heading; Hide button named "Hide this card"

Toast
  states    shown with an action, dismissed, timed out (10 s, paused on hover and focus)
  a11y      role=status, polite

Buttons
  variants  primary, outline, text, danger, icon (40 px round)
  states    default, hover (8% primary layer), active, focus-visible, disabled
```

## Primitives check

Built once in code and screenshotted in the real browser shell (replica-design
step 4, without a separate `/design` route): `clone-screens/S04-*.png`,
`S02-*.png`, `S05-*.png`, `S06-light.png`, produced by `scripts/capture.ts`.
