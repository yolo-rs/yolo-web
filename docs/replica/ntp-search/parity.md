# Parity: YOLO new tab vs Chrome NTP and Google Search home (replica-diff)

Date 2026-11-05. Tools: `parity.py` and `imgdiff.py` from the replica-diff
skill (standard-library Python), on `features.csv` and the screenshots in
`clone-screens/` (git-ignored; regenerate with `bun run capture`).

```
python parity.py features.csv --visual diffs/S01-S04.json diffs/S02.json
```

## Scores

| measure                         | score    | notes                                                                        |
| ------------------------------- | -------- | ---------------------------------------------------------------------------- |
| overall (80% feat + 20% layout) | **54.8** | as the tool computes it; the layout half is not a fair comparison, see below |
| features                        | **64.3** | 19 rows counted; must-haves 6 of 9                                           |
| features, area `ntp`            | 95.5     | 9 rows; only the wallpaper library is partial                                |
| features, area `search`         | 42.9     | 7 rows; two musts partial (no live suggest service, no live results page)    |
| features, area `results`        | 0.0      | 3 rows; the results page is outside this build target                        |
| layout S01 vs S04-dark          | 12.2     | different                                                                    |
| layout S02 vs S02-dark          | 21.1     | different                                                                    |

Feature parity counts `partial` as half, must 3, should 2, could 1, and leaves
out the three `skip` rows (Google marks, the Google index, account cards) and
the one row the original does not have (theme parity with yolo-chromium).

Why the layout numbers are low and not meaningful: the only reference
screenshots are the google.com home and suggestion screens (S01, S02) captured
at 738 x 406 with a top bar, account avatar and a footer of links. The
original NTP (S04) could not be captured (`chrome://` pages are refused by the
recon browser tool), so the clone's NTP at 1440 x 900, with a shortcut grid and
a card, is compared against a different screen at a different viewport. The
skill requires the same viewport and state; that precondition is not met.
Treat the feature score as the number.

## Verdict

**Not shippable** by the replica-diff rule: 3 must-haves are not done. No open
S1 or S2 bugs (`bugs.md`).

For the scope of this build target (the extension's new tab page) the
remaining gaps are server-side: every NTP must-have is done, and the search
musts are partial only because aphrody.com does not yet serve `/suggest` or
`/search` (both answered 404 on 2026-11-05).

## Missing, in build order

1. [must] Result item with favicon, breadcrumb, title, snippet: aphrody.com
   results page (yolo-hub).
2. [must] Live suggestions: an OpenSearch suggestion endpoint on aphrody.com
   with `Access-Control-Allow-Origin` for the extension origin; then set it in
   the panel or make it the default.
3. [must] Submit to YOLO Search results: the `/search` page itself.
4. [should] Results verticals tabs; [should] AI answer mode (yolo-hub).
5. [should] Open wallpaper library: needs a licensed image collection.
6. [could] Knowledge panel, action chips, search by image, voice input.

## Behaviour differences

| flow               | original does                                                               | clone does                                                                                                                  | fix or keep                         |
| ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| F01 search         | Enter searches Google; typed URLs navigate                                  | Enter goes to the configurable template (aphrody.com by default); typed addresses navigate                                  | keep                                |
| F02 suggestions    | server completions for any prefix, plus history                             | local ranking of own past queries, shortcuts, most visited and (opt-in) visited pages; remote endpoint optional             | fix: needs the aphrody.com endpoint |
| F02 privacy        | keystrokes go to the provider                                               | nothing leaves the device by default; credentials omitted when an endpoint is set                                           | keep (better)                       |
| F03 open shortcut  | 1 click                                                                     | 1 click                                                                                                                     | keep                                |
| F04 edit shortcuts | 3-4 actions, undo toast                                                     | same; undo toast pauses on hover and focus; reorder also from the menu                                                      | keep (better for keyboard users)    |
| F05 personalize    | theme, color, background collections, device mode, shortcuts, cards, footer | same, minus collections; plus 8 presets that match `yolo-chromium --theme` and a configurable search and suggestion service | keep                                |
| F06 resume         | card from synced tabs                                                       | card from local history after an explicit opt-in                                                                            | keep                                |
| remembered         | settings sync with the account                                              | settings and shortcuts in chrome.storage.sync; search history local only                                                    | keep                                |

## Top five things to build next

1. aphrody.com `/suggest` (OpenSearch JSON, CORS for the extension origin).
2. aphrody.com `/search` results page with result items and verticals.
3. A fix in `crates/yolo-chromium` so `--url=chrome-extension://...` works on
   the first navigation (BUG-006), which also unblocks a real S04 capture of
   the original for a fair layout diff.
4. Remove-from-history control on own-query suggestion rows.
5. A licensed wallpaper collection (or a generated one) for the background
   picker.
