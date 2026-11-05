// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
import { h } from "../dom.ts";
import { SHORTCUTS, navigateCurrentTab } from "../navigation.ts";

/** Tiles for the browser pages and aphrody.com. */
export function Shortcuts(): Node {
  return (
    <nav class="yw-shortcuts" aria-label="Shortcuts">
      {SHORTCUTS.map((shortcut) => (
        <a
          class="yw-tile"
          href={shortcut.url}
          onClick={(event) => {
            event.preventDefault();
            void navigateCurrentTab(shortcut.url);
          }}
        >
          <span class="yw-tile-mark" aria-hidden="true">
            {shortcut.mark}
          </span>
          <span class="yw-tile-label">{shortcut.label}</span>
        </a>
      ))}
    </nav>
  );
}
