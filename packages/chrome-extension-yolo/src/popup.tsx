// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Toolbar popup entry: opens a new tab or the browser settings. It has no
 * settings of its own; it only borrows the new tab page's colors so the two
 * look alike.
 */
import { Logo } from "./components/logo.tsx";
import { h, mount, mountStyles, rootElement } from "./dom.ts";
import { openInNewTab } from "./navigation.ts";
import {
  applyAppearance,
  deviceIsDark,
  loadFont,
} from "./newtab/appearance.ts";
import { loadSettings } from "./newtab/settings.ts";
import { loadThemeId, syncArea } from "./storage.ts";
import { buildStyleSheet } from "./styles.ts";

function Popup(): Node {
  return (
    <main class="yw-popup">
      <header class="yw-brand">
        <Logo size={28} id="popup" />
        <h1 class="yw-popup-title">Aphrody</h1>
      </header>
      <section class="yw-actions">
        <button
          type="button"
          class="yw-button"
          onClick={() => void openInNewTab("chrome://settings/")}
        >
          Browser settings
        </button>
        <button
          type="button"
          class="yw-button yw-button-primary"
          onClick={() => void openInNewTab()}
        >
          New tab
        </button>
      </section>
    </main>
  );
}

async function main(): Promise<void> {
  mountStyles(buildStyleSheet());
  const sync = syncArea();
  applyAppearance(
    await loadThemeId(sync),
    await loadSettings(sync),
    deviceIsDark(),
  );
  void loadFont();
  mount(rootElement(), <Popup />);
}

void main();
