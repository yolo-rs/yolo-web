# Bugs: YOLO new tab

Found while testing on 2026-11-05 in the yolo-chromium CEF 156 shell
(1440 x 900 and 390 x 844). Every fixed bug is fixed in the commit that adds
this file on branch `claude-chrome-extension-yolo`; the build before the fix
only existed in the working tree.

### BUG-001: hidden buttons still shown (Remove in the Add dialog, Clear on an empty box)

- Severity: S3
- Flow / case: F04-H1, F01
- Screen: S06, S04
- Steps: 1. open the page with an empty box. 2. click Add shortcut.
- Expected: no clear button; no Remove button in the Add dialog.
- Actual: both visible. `[hidden]{display:none}` lost to `.yw-button` and
  `.yw-icon-button` display rules of equal specificity declared later.
- Evidence: first S04-light / S06-light captures.
- Status: fixed: `[hidden]:not(#yw-none)` outranks every class-only rule.

### BUG-002: shortcut tiles stacked in one column

- Severity: S2
- Flow / case: F03
- Screen: S04
- Steps: 1. open the page with 6 shortcuts at 1440 px.
- Expected: tiles in rows of five or more.
- Actual: one 120 px column; the wrapper div shrank to its content inside the
  centered flex column.
- Evidence: first S04-light capture.
- Status: fixed: `.yw-slot` wrappers take `min(680px, 100%)`.

### BUG-003: console errors on every first keystroke with the default settings

- Severity: S3
- Flow / case: F02-H1, G-1
- Steps: 1. type "ch".
- Expected: no console errors.
- Actual: `https://aphrody.com/suggest?q=ch` blocked by CORS, then
  net::ERR_FAILED (the endpoint answers 404 without CORS headers).
- Evidence: capture run log.
- Status: fixed: the default suggestion service is empty (local only); the
  aphrody.com URL is offered as an example in the panel. The 5 minute backoff
  after a failure stays for user-configured endpoints.

### BUG-004: fixed Customize button covers the card at 390 px

- Severity: S3 (WCAG 2.2 SC 2.4.11 Focus Not Obscured risk)
- Screen: S04 mobile
- Steps: 1. open at 390 x 844.
- Expected: no control covered.
- Actual: the button overlapped the Allow access button.
- Status: fixed: in flow below the page under 600 px; `scroll-padding-bottom`
  96 px on wider screens.

### BUG-005: focus ring doubled with the field border

- Severity: S4
- Screen: S04
- Actual: 2 px outline 2 px outside a 1.5 px border looked like two boxes.
- Status: fixed: the field boundary itself turns primary and thickens to
  3 px when the input has focus.

### BUG-006 (outside this package): the shell cannot start on the extension page

- Severity: S3 for automation, none for users
- Steps: `yolo-chromium --smoke --url=chrome-extension://<id>/newtab.html
--load-extension=<dist> --cache-path=<tmp>`, fresh or warm cache.
- Expected: smoke load OK.
- Actual: receipt `outcome: load-error`, `ERR_BLOCKED_BY_CLIENT`, exit 2: the
  shell's first navigation runs before the unpacked extension is registered.
  (`--url=chrome://newtab` hangs at shutdown, exit 4, already known.)
- Workaround: `scripts/capture.ts` starts on chrome://version and navigates
  over CDP.
- Status: open, belongs to `crates/yolo-chromium` (not changed here).

## To check

- Choosing "My image" and then cancelling the file picker leaves the radio
  checked until the next settings change redraws the panel (not reproduced
  under automation, the picker cannot be cancelled over CDP).
- Remote suggestions were only tested against a stub fetch; no live
  OpenSearch endpoint with CORS was available.
