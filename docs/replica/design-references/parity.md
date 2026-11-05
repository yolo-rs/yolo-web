# Diff report: yolo-templates against the design-reference patterns

Branch `claude-yolo-templates` (yolo-ui), head `01c34dd10`. This is a pattern study, not a clone, so parity means
"does the template do the job of the pattern", never visual likeness (trade dress is deliberately different).

## Feature parity (`parity.py features.csv`)

Score 77.7 / 100, 23 features counted (4 `skip` rows excluded), must-haves 7 of 8.
Verdict by the skill's rule: not shippable, because one must-have is partial.

| Area | Score | Notes |
| --- | --- | --- |
| layout, docs, component | 100 | stage hero, product page, channels, docs shell, release pill |
| navigation | 88.9 | flyouts, mega menu, sticky tabs done; audience segmented control not built |
| app | 87.5 | rail, centred search done; media grid not DOM-virtualised, voice button is UI only |
| motion | 75 | split title, starfield done; 3D reveal is CSS only (no wgpu or Bevy path); shader not yet run on a GPU |
| editorial | 66.7 | editorial grid done; listen-to-article not built |
| theming | 58.3 | terminal identity done; preset picker missing; geometric gradient variant not built |
| i18n | 0 | EN and FR strings exist, no language picker, no region banner |
| data | 0 | benchmark tab strip not built |

### Missing, in build order
1. [must] in-page preset picker (theming): presets switch only via `data-yt-preset`; the docs shell switches light/dark.
2. [should] language picker; DOM virtualisation of the media grid; wgpu/Bevy reveal path.
3. [could] region banner, audience segmented control, listen-to-article, benchmark tabs, geometric gradient variant.

## Layout diff

Not computed with `imgdiff.py`. The reference screenshots show other products' layouts at one state each, and the
templates intentionally differ in colour, type and copy. Structural checks were done instead with Taffy
(`tests/layout.rs`): centred search, 72 px rail, bottom bar at 390 px, grid column count, docs tree 280 px column,
editorial lead spanning two columns. Rendered pages were screenshotted in headless Chrome 1440x900 and 390x844 for
Aphrody dark and light, Fluent light and Omarchy dark (`clone-screens/`, local only). Viewed: Aphrody dark desktop
and Shenron (Fluent preset) phone; stage, pill, CTAs and object render as designed. Fonts fell back to the system
sans because the OFL faces are not bundled.

## Test results (VPS `yolo-ui-templates`, `--lib --tests`)

| Run | Result |
| --- | --- |
| `cargo check -p yolo-templates --all-targets` | pass |
| `cargo test --lib --tests` | 36 passed, 0 failed (19 unit, 7 layout, 2 shader, 8 template) |
| doctests | not run: `/tmp` on the VPS is a full tmpfs (7 GB `/tmp/aotprobe` belongs to another job) |
| clippy | not run |

Bugs found by the tests and fixed: a test matched the `@supports` query instead of the scroll declaration; four
layout tests failed because Taffy roots had auto width (fixed with `width: 100%` on the layout roots). No open bugs.

## Behaviour diff

| Flow | Pattern sites do | Templates do | Decision |
| --- | --- | --- | --- |
| Flyout | open on hover or click, script driven | native popover: click, Enter or Space; Esc closes and returns focus; no hover open | keep, simpler and accessible |
| Theme switch | script toggle | CSS `:has()` on a checkbox, works before hydration | keep |
| Reveal | scroll-driven in all engines | Chromium scroll timelines, final frame elsewhere | keep, documented |
| Voice search | recognition | button only | build when a speech backend is chosen |

## Not verified

Keyboard behaviour (M01 to M07 in `test-plan.md`) and screen readers were not exercised in a browser; only markup
structure and CSS rules were tested. Copy that states release cadences and sign-in providers needs owner review.

## Next five
1. Preset picker (must). 2. Run M01 to M07 in headless Chrome. 3. Language picker. 4. Bundle the OFL fonts with
OFL.txt and record in `catalog/assets.lock.toml`. 5. Signal-driven open state for flyouts in Blitz.
