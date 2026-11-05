# Architecture: YOLO new tab (a rebuild of the Chrome NTP core features)

Input: `recon.md` and `features.csv` in this folder (replica-recon, 2026-11-05).
Build target: `packages/chrome-extension-yolo` (Manifest V3, branch
`claude-chrome-extension-yolo`), page `newtab.html` registered through
`chrome_url_overrides.newtab`. The new tab page is a secondary, self-contained
module of the extension: entry `src/newtab.tsx`, everything else under
`src/newtab/`; it shares only the DOM factory, tokens, styles, storage areas
and the mark with the rest of the package. The extension's primary role (an
agent plugin, `packages/yolo-agent`) is built separately; the popup carries no
theme UI and the service worker is unchanged by this work. The aphrody.com results page (S03) and the YOLO
Search engine are a separate build in yolo-hub and are out of this target.

## Stack

The replica-architect defaults (Next.js, Postgres, Supabase, Vercel) do not
apply: the target is a browser extension page with no server, no account and no
payments. The stack is the one the package already uses.

| layer      | choice                                                                    | why                                                                                                   |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| web        | TSX with the package's own `h()` DOM factory, bundled by `Bun.build`      | already in the package; no framework runtime, small bundle, CSP `script-src 'self'` holds             |
| styling    | typed rule objects serialized to one adopted style sheet, `--yw-*` tokens | already in the package; semantic custom properties, no raw values in components                       |
| color      | TypeScript port of the HCT solver and CAM16 from yolo-tokens / MCU        | seed color to tonal palettes with the same math as yolo-ui and Chromium's own color pipeline          |
| font       | Instrument Sans variable (OFL-1.1), self-hosted TTF                       | see design.md; no network font, no system default stack                                               |
| settings   | `chrome.storage.sync`                                                     | follows the profile, the popup already writes the theme there                                         |
| local data | `chrome.storage.local` (search history), IndexedDB (background image)     | search history stays on the device; images exceed the sync quota and are blobs                        |
| browser    | `chrome.topSites`, optional `chrome.history`, `_favicon` URLs             | most visited, resume browsing and the history suggestion fallback; favicons without network           |
| database   | none                                                                      | no server side in this target                                                                         |
| auth, pay  | none                                                                      | no account features (recon: Drive and Gmail cards skipped)                                            |
| jobs       | none                                                                      | the service worker only seeds defaults on install                                                     |
| hosting    | the unpacked `dist/` directory, `bun run scripts/zip.ts` for the archive  | loaded by `yolo-chromium --load-extension=<dist>` and by Chrome; store upload is not part of this run |

## Schema

No SQL. The inferred data model becomes typed records in three stores. Access
rule: everything is per profile and per extension origin; nothing leaves the
device except the query sent to the configured search URL and, when set, the
suggestion endpoint.

```ts
// chrome.storage.sync, key "theme" (kept for the popup, already shipped)
type ThemeId =
  | "default"
  | "neutral"
  | "m3"
  | "fluent"
  | "apple"
  | "omarchy"
  | "hyprland"
  | "aphrody";

// chrome.storage.sync, key "ntp.settings"  (NtpSettings in recon)
interface NtpSettings {
  version: 1;
  seed: string; // #rrggbb, used by the "default" theme
  mode: "device" | "light" | "dark"; // follow device or force a scheme
  shortcutsVisible: boolean;
  shortcutsMode: "mine" | "top"; // my shortcuts | most visited
  cardsVisible: { resume: boolean };
  footerVisible: boolean;
  background: "none" | "image"; // the image itself lives in IndexedDB
  searchUrl: string; // contains {searchTerms}; default https://aphrody.com/search?q={searchTerms}
  suggestUrl: string; // "" (the default) disables remote suggestions
  backgroundStamp: number; // changes on each new image so other tabs reload it
}

// chrome.storage.sync, key "ntp.shortcuts"  (Shortcut in recon)
interface Shortcut {
  id: string;
  title: string;
  url: string;
} // array order = position, max 10
// chrome.storage.sync, key "ntp.hiddenTop": string[]            // most-visited URLs the user removed

// chrome.storage.local, key "ntp.queries"  (Query + VisitStat in recon)
interface QueryStat {
  text: string;
  count: number;
  last: number;
} // max 200, pruned by frecency

// IndexedDB "yolo-ntp" v1, store "background", key "current": { blob: Blob, type: string, saved: number }
```

Hard constraints from the recon, enforced in the data layer, not the UI:
at most 10 shortcuts; URLs normalized (scheme added, `http(s)` only, no
`javascript:`); duplicate URLs rejected; the sync quota (8 KB per item) is
checked by the store before writing; an image larger than 8 MB is refused.

## API

The extension has no HTTP routes. Its "API" is the module boundary between the
screens and the data layer; every function returns plain data so the screens
never call `chrome.*` directly.

| function                                          | does                                                    | who                | input             | output                | flow     |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------ | ----------------- | --------------------- | -------- |
| `rankSuggestions(query, sources)`                 | merge, dedupe and rank candidates, mark completion      | search box         | text, candidates  | `Suggestion[]` (<= 8) | F01, F02 |
| `fetchRemoteSuggestions(url, query, signal)`      | OpenSearch suggestions JSON, 400 ms budget              | search box         | template, text    | `string[]`            | F01, F02 |
| `recordQuery(text)` / `loadQueries()`             | local search history for the fallback                   | search box         | text              | `QueryStat[]`         | F01      |
| `searchUrlFor(template, text)`                    | builds the submit URL                                   | search box         | template, text    | URL                   | F01      |
| `ShortcutStore.add / update / remove / move`      | my shortcuts, with validation and undo snapshot         | tiles, dialog      | title, url, index | new list              | F03, F04 |
| `loadMostVisited()`                               | `chrome.topSites.get` minus hidden URLs                 | tiles              | none              | `Shortcut[]`          | F03      |
| `loadRecentPages()`                               | `chrome.history.search`, last 24 h, 5 items             | resume card        | none              | `Visit[]`             | F06      |
| `requestHistoryAccess()`                          | `chrome.permissions.request({permissions:["history"]})` | resume card, panel | user gesture      | boolean               | F06      |
| `loadSettings / saveSettings / watchSettings`     | NtpSettings in sync storage                             | panel, page        | patch             | settings              | F05      |
| `saveBackground(file) / loadBackground() / clear` | IndexedDB blob                                          | panel, page        | `File`            | object URL            | F05      |
| `schemeFor(theme, seed, dark)`                    | HCT tonal palettes to semantic roles                    | page, popup        | ids, seed         | `ColorRoles`          | F05      |

Webhooks in or out: none. Jobs: none. Remote calls: the suggestion endpoint
only, user configurable. `https://aphrody.com/suggest` answered 404 without
CORS headers on 2026-11-05, so the default is empty (local suggestions only)
and that URL is offered as an example in the panel. After a failed request
the client stops calling a configured endpoint for five minutes instead of
sending one failing request per keystroke.

### Permissions

| permission | kind     | why                                                                                                                                                                                                                                      |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`  | required | settings, shortcuts and local search history                                                                                                                                                                                             |
| `topSites` | required | the most visited shortcut mode (F03); Chrome shows it as "read a list of your most visited sites"                                                                                                                                        |
| `favicon`  | required | tile and card icons from the browser's favicon cache (`/_favicon/`), no third-party favicon service                                                                                                                                      |
| `history`  | optional | requested only when the user turns on the resume browsing card; it also feeds the suggestion fallback with page titles. Without it the card explains what it needs and the fallback uses search history, shortcuts and most visited only |

`tabs` stays out: `chrome.tabs.update` and `create` work without it.

## The parts that bite

- Latency: the local ranker runs synchronously on every input event over at most
  a few hundred candidates (target under 5 ms, budget 100 ms); remote results
  merge in when they arrive, stale responses are dropped by request id and
  `AbortController`.
- Races: two NTP tabs edit shortcuts at once. Each write re-reads the stored
  list first and every tab re-renders on `storage.onChanged`.
- Quotas: `chrome.storage.sync` allows 8 KB per item and 120 writes per minute;
  writes are whole-list and only on user actions, never on drag-over.
- Offline: the page is fully local; the remote suggestion call fails closed.
- Privacy and GDPR: no telemetry. "Clear search history" in the panel deletes
  `ntp.queries`; removing the extension deletes every store.
- Security: the search and suggestion templates must be `https:` URLs; shortcut
  URLs are limited to `http:` and `https:`; titles render as text nodes only.
- Theme parity: the preset table mirrors `crates/yolo-chromium/src/theme.rs`;
  a unit test pins the five colors per preset so a change on one side fails.
- The yolo-chromium shell hangs at shutdown in `--smoke` runs on
  `chrome://newtab` with an override extension (exit 4, known shell bug), so
  screenshots load `chrome-extension://<id>/newtab.html` directly.

## Build order

1. Vertical slice (F01/F02): S04 shell with the Aphrody mark, search box with
   local suggestions and submit to the configured URL; settings store; tokens
   and the HCT scheme wired in.
2. Must-haves: shortcut tiles in both modes, add/edit/remove dialog (S06) with
   undo toast; customize panel (S05) with theme presets, color seed, device
   light/dark; AA contrast in every preset and seed (unit tested).
3. Should-haves: drag reorder plus keyboard reorder, resume browsing card,
   background image from a user file (the open wallpaper library is not built:
   no licensed collection is bundled), suggestion endpoint.
4. Could-haves built because they are cheap: footer toggle. Not built: voice
   input, search by image, action chips.
5. Out of target: S03 results page features (verticals, result items, AI
   answer, knowledge panel) belong to aphrody.com and yolo-hub.
6. Fixes from replica-entrepreneur: not run yet.
