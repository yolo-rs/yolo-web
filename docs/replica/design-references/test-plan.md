# Test plan: yolo-templates

Branch `claude-yolo-templates` in yolo-ui. Env: VPS fleet runner (`C:\src\yolo-vps`,
`cargo run -- cargo vps yolo-ui-templates --execute -- test -p yolo-templates`), no local Cargo builds. The
project directory `~/src/yolo-current/yolo-ui-templates` on `vps` is a checkout of the branch whose submodules
link to the main yolo-ui snapshot. Results are in `parity.md`.

Rule kept: only the templates are tested. No reference site was loaded, scripted or fetched for testing.

## Automated (cargo test)

| Case | Flow | Type | What it checks | Where |
| --- | --- | --- | --- | --- |
| T01-H1 | theme | happy | WCAG reference points (21:1, 4.54:1 for #767676 on white) | `theme::tests::contrast_math_matches_wcag_reference_points` |
| T01-H2 | theme | happy | text 7:1, muted, accent 4.5:1, focus 3:1 on canvas/surface/raised; on-accent 4.5:1; control-border 3:1; stage roles, for 8 presets x 2 modes | `theme::tests::every_text_role_meets_aa_in_every_preset_and_mode` |
| T01-E1 | theme | edge: raw pair fails | Apple light #86868b on #f5f5f7 (3.3:1) is lifted to AA and no further than needed | `theme::tests::solver_fixes_a_failing_raw_pair` |
| T01-H3 | theme | happy | 16 theme blocks, no Inter or Roboto in stacks | `theme::tests::theme_css_has_light_and_dark_blocks_for_all_presets` |
| T02-H1 | pages | happy | 22 documents (16 preset/mode pages + 6 sites) contain all 21 template parts | `tests/templates.rs::every_page_renders_every_template` |
| T02-H2 | pages | a11y | one h1; unique ids; every popovertarget, aria-controls, aria-labelledby and #fragment resolves | `one_h1_and_unique_ids_and_resolvable_references` |
| T02-H3 | pages | a11y | buttons named and typed; links have href and text; inputs inside named labels; navs labelled; no img; no new-window links | `every_control_has_an_accessible_name` |
| T02-H4 | pages | a11y | icons, starfield, object and artwork aria-hidden; UI drawing is role=img with alt | `icons_are_hidden_and_decorative_layers_are_hidden` |
| T02-E1 | pages | edge: mode | dark switch checked only in dark mode; pause switch present, role=switch, unchecked | `state_matches_mode_and_motion_has_a_pause_control` |
| T02-E2 | pages | edge: language | FR sites render lang=fr and French interface strings | `french_sites_render_french_interface` |
| T02-N1 | copy | negative | no lorem, ipsum, todo, tbd, placeholder or sample text, no emoji in any page | `copy_is_original_and_finished` |
| T02-H5 | content | happy | each site has a flyout and a mega menu, 3+ sections, 2+ FAQs, one recommended channel, 4+ rail items, 6+ tiles, 4 stories | `every_site_fills_every_slot` |
| T03-H1 | layout | happy | layout CSS parses in the yolo-layout subset (desktop and compact) | `tests/layout.rs::layout_css_stays_inside_the_yolo_layout_subset` |
| T03-H2 | layout | happy | search centred in the app bar within 1 px at 1440 px, 480 to 640 px wide; voice button 44 px | `search_is_centred_in_the_app_bar_on_desktop` |
| T03-H3 | layout | a11y | rail 72 px at x=0, items 64 px tall and 44 px wide, stacked | `rail_sits_left_and_keeps_touch_targets` |
| T03-E1 | layout | edge: phone 390 px | rail becomes a bottom bar of side-by-side 64 px items; search spans the bar | `phone_layout_turns_the_rail_into_a_bottom_bar` |
| T03-H4 | layout | happy | media grid has as many columns as CSS auto-fill would (4 at 1440); one column on phones | `media_grid_fills_columns_on_desktop_and_one_column_on_phones` |
| T03-H5 | layout | happy | docs tree 280 px column; stacks on phones | `docs_shell_has_a_tree_column_on_desktop_and_stacks_on_phones` |
| T03-H6 | layout | happy | editorial lead spans two columns and two rows; one column on phones | `editorial_lead_spans_two_columns_on_desktop` |
| T04-H1 | motion | happy | reveal progress clamped and monotonic; short track is revealed | `motion::tests::progress_is_clamped_and_monotonic` |
| T04-E1 | motion | edge: reduced motion | reveal frame is the static final frame under reduced motion and at the end | `motion::tests::reveal_ends_on_the_static_frame` |
| T04-E2 | motion | edge: pause | paused clock does not advance; reduced motion never runs; NaN and negative dt ignored | `motion::tests::pause_freezes_the_clock_and_reduced_motion_never_runs` |
| T04-H2 | shader | happy | starfield.wgsl parses and validates (naga 30), has vs_main and fs_main | `tests/shader.rs::starfield_wgsl_validates` |
| T04-H3 | shader | happy | WGSL `Uniforms` is 16 bytes with resolution, time, density; Rust bytes match | `uniform_block_is_sixteen_bytes`, `motion::tests::uniform_bytes_match_the_wgsl_layout` |
| T04-H4 | motion | happy | star generator deterministic and in bounds | `motion::tests::stars_are_deterministic_and_in_bounds` |
| T05-H1 | css | happy | no raw hex colours in paint rules | `style::tests::paint_uses_tokens_not_raw_hex` |
| T05-H2 | css | a11y | reduced-motion block present; scroll animations only inside the no-preference block | `style::tests::every_animation_is_switched_off_by_reduced_motion` |
| T05-H3 | css | happy | starfield CSS stable (139 gradients); compact rules inside a 720 px media query | `style::tests::*` |
| T06-H1 | grid | happy | virtual window covers viewport plus overscan; clamps at the end; empty on bad input | `app::tests::window_covers_the_viewport_plus_overscan` |
| T06-H2 | docs | happy | ratio labels round down; 18 token rows per preset; one platform rule per platform | `docs::tests::*` |

## Manual / browser (VPS headless Chrome on the showcase output)

| Case | Flow | Type | Steps | Expected | Auto |
| --- | --- | --- | --- | --- | --- |
| M01 | flyout | keyboard | Tab to "Products", Enter, Tab through links, Esc | panel opens under the bar, focus moves in order, Esc closes and focus returns to the trigger | manual |
| M02 | mega menu | keyboard | open the mega item, then Tab to the next trigger and press Enter | first panel closes, second opens | manual |
| M03 | section tabs | keyboard | Tab to a tab, Enter | page jumps to the section; heading visible below the sticky bar | manual |
| M04 | theme switch | keyboard | in the docs shell press Space on "Dark theme" | whole page switches mode with no script | manual |
| M05 | platform switch | keyboard | focus the platform group, press ArrowRight | next platform selected, its code sample shown | manual |
| M06 | starfield | motion | toggle "Pause motion" | stars and object stop; toggling again resumes | manual |
| M07 | reduced motion | motion | emulate prefers-reduced-motion: reduce | no drift, no turn, reveal shows the joined title and body | manual |
| M08 | layout | visual | screenshot 1440 x 900 and 390 x 844 for 16 preset pages | no horizontal scroll at 390; search centred at 1440 | screenshots |
