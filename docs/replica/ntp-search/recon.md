# Replica recon: new tab page and search front page

Captured 2026-11-05 with Claude in Chrome on the owner's own browser, at human speed, public pages only.
Reference screenshots live in `screens/` (git-ignored, never shipped). Nothing from the originals' code,
assets, logos, copy or network calls is reused.

## Scope

- Apps: Chrome desktop New Tab Page (NTP) and the Google Search home and results page, web.
- Slice: the core loop, "open a tab, type, get to the answer", plus NTP personalization.
- For: an original YOLO new tab (served by `packages/chrome-extension-yolo` as `chrome_url_overrides.newtab`
  and by `yolo-chromium --new-tab-url`) and the aphrody.com search front page, both on yolo-ui tokens.
- Terms: Google's terms restrict automated access and reuse of results. The clone ships its own engine
  (YOLO Search, tantivy core in yolo-hub) and never proxies or scrapes Google results.

## Sources

| Source                     | URL                                                                                  | Gives                                                          |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Live home page             | https://www.google.com/                                                              | S01, S02                                                       |
| Live results page          | https://www.google.com/search?q=chromium+browser                                     | S03                                                            |
| Help: customize NTP        | https://support.google.com/chrome/answer/11032183                                    | shortcuts, most visited, footer, cards, Customize Chrome panel |
| Help: change theme         | linked from the article above                                                        | colors, background image, follow device theme                  |
| Chrome theme manifest docs | https://developer.chrome.com/docs/extensions/reference/manifest/theme                | theme keys for the emitter                                     |
| chrome_url_overrides docs  | https://developer.chrome.com/docs/extensions/reference/manifest/chrome-url-overrides | how an extension replaces the NTP                              |

The owner's `chrome://newtab` could not be read: the browser tool refuses internal pages. NTP facts come
from the help article and the Chromium source tree (`chrome/browser/resources/new_tab_page`, BSD-licensed,
readable for behavior; not copied).

## Screens

| ID  | Screen                 | Route               | Purpose            | Key components                                                                                                                                                            | States seen         |
| --- | ---------------------- | ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| S01 | Search home            | `/`                 | start a query      | top bar (links, apps grid, account), wordmark, search box (add, voice, image, AI mode), suggestion chips, footer (locale, legal)                                          | filled (dark theme) |
| S02 | Suggestions            | `/` focused, typing | complete the query | expanded box, 10 suggestion rows with search glyph, bolded completion, submit button, report link                                                                         | typing              |
| S03 | Results                | `/search?q=`        | answer             | compact header with box, vertical tabs (AI, All, Images, News, Videos...), AI overview card, organic results (favicon, site, breadcrumb, title, snippet), knowledge panel | filled              |
| S04 | New tab page           | `chrome://newtab`   | start or resume    | logo, search box, shortcut tiles (my shortcuts or most visited, edit/remove), cards (resume browsing, Drive), footer, Customize Chrome button                             | from help only      |
| S05 | Customize Chrome panel | side panel from S04 | personalize        | theme/background picker, color seeds, follow device, shortcuts toggle and mode, cards toggles, footer toggle                                                              | from help only      |
| S06 | Edit shortcut dialog   | S04 tile menu       | edit tile          | name and URL fields, save/cancel, remove                                                                                                                                  | from help only      |

## Flows

```
F01 Search from the home page          S01 -> S02 -> S03
    happy path: click box, type, Enter = 2 actions; with a suggestion: 3
    edge: empty query, offline, very long query, RTL query, no results
F02 Search from a new tab               S04 -> S02 -> S03     (omnibox or box, same count)
F03 Open a shortcut                     S04 -> site           1 click
F04 Add / edit / remove a shortcut      S04 -> S06 -> S04     3-4 actions; undo toast after remove
F05 Personalize                         S04 -> S05            background, color, shortcuts mode, cards, footer
F06 Resume browsing                     S04 card -> site      1 click
```

## Components

| Component       | Variants                            | States                                                   | Screens  |
| --------------- | ----------------------------------- | -------------------------------------------------------- | -------- |
| Search box      | hero, compact header                | idle, focused, typing, with suggestions, voice listening | S01-S04  |
| Suggestion list | text, entity with thumbnail         | hover, keyboard-selected                                 | S02      |
| Chip            | action suggestion, tab              | default, hover, selected                                 | S01, S03 |
| Shortcut tile   | site, add                           | default, hover with menu, dragging                       | S04      |
| Card            | resume browsing, file list          | loading, empty, filled, dismissed                        | S04      |
| Result item     | web, with sitelinks, with thumbnail | visited                                                  | S03      |
| Overview card   | collapsed, expanded                 | loading, filled                                          | S03      |
| Side panel      | customize                           | open, closed                                             | S05      |
| Dialog          | edit shortcut                       | valid, invalid URL                                       | S06      |
| Toast           | undo                                | shown, dismissed                                         | S04      |
| Top bar         | home, results                       | signed in, signed out                                    | S01, S03 |

## Inferred data model

```
Shortcut    id, title, url, position, source (user | most_visited), hidden
            evidence: help article (my shortcuts vs most visited, edit, remove)    confidence: high
NtpSettings shortcuts_visible, shortcuts_mode, cards_visible{kind}, footer_visible,
            background (none | image_url | collection_id), color_seed, follow_device_theme
            evidence: help article, Customize Chrome panel                         confidence: high
Query       text, locale, safe_search, vertical (all | images | news | videos)
            evidence: S03 tabs, URL params                                          confidence: high
Suggestion  text, completion_span, kind (query | entity | history)
            evidence: S02 bolded completions                                        confidence: medium
Result      url, title, snippet, site_name, favicon_url, breadcrumbs[], sitelinks[]
            evidence: S03                                                           confidence: high
VisitStat   url, visit_count, last_visit (source of most visited)                   confidence: guess
```

## What cannot be cloned

- The Google index, ranking, AI overview content and knowledge graph: YOLO Search supplies its own.
- Google wordmark, product logos, doodles, background image collections: original Aphrody assets only.
- Account features (Drive card, Gmail link, sync): need the user's own services; YOLO equivalents later.

## Size

6 screens, 6 flows, 6 entities. Hard parts: suggestion latency under 100 ms, the result-quality engine
(owned by yolo-hub), and theme parity between the web page, the extension NTP and `yolo-chromium --theme`.
Size: M for the NTP and front page on existing tokens; the engine is a separate L.
