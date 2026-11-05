# Build log: YOLO new tab

One line per screen (replica-build step 4). All on 2026-11-05, branch
`claude-chrome-extension-yolo`, package `packages/chrome-extension-yolo`.

| screen  | status        | missing                                                                             | harder than expected                                                                                |
| ------- | ------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| shell   | done          | none                                                                                | the existing `h()` factory has no re-render; lists redraw with `replaceChildren`                    |
| S04     | done          | no wallpaper library; drag reorder not exercised by mouse in automation             | favicons: `_favicon` needs the `favicon` permission; fresh profiles return the browser's globe icon |
| S01/S02 | partial       | no live completion service (aphrody.com/suggest 404); voice, image, chips not built | mapping the typed span back through accent folding                                                  |
| S05     | done          | none                                                                                | keeping two tabs and the popup in step: every control writes storage and redraws from `onChanged`   |
| S06     | done          | none                                                                                | none                                                                                                |
| S03     | not in target | results page, verticals, result items, AI answer, knowledge panel                   | belongs to aphrody.com / yolo-hub                                                                   |

Bigger than it looked: AA for brand presets. Five of the six theme.rs accents
fail 4.5:1 as text on their own surfaces (Apple `#007aff` is 3.72:1), so the
page moves those roles in HCT tone while the browser chrome keeps the original
accent. The surfaces and text stay identical to theme.rs.

Removed from the previous NTP: the clock, the Google-blue "Y" mark, the
`chrome://` shortcut tiles and the Google Sans font stack.

Definition of done per screen: 1440 and 390 px captured; keyboard flow for
search, menu and dialog automated; no console errors in the capture run;
copy written fresh; features.csv updated; screenshots in `clone-screens/`
(git-ignored, regenerate with `bun run capture`).
