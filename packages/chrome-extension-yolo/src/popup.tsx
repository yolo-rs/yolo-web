// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/** Toolbar popup entry: theme chips and browser shortcuts. */
import { Logo } from "./components/logo.tsx";
import { ThemeSwitcher } from "./components/theme-switcher.tsx";
import { h, mount, mountStyles, rootElement } from "./dom.ts";
import { openInNewTab } from "./navigation.ts";
import { loadThemeId, watchThemeId } from "./storage.ts";
import { applyTheme, buildStyleSheet } from "./styles.ts";
import { type ThemeId, themeById } from "./tokens.ts";

function Popup(props: { theme: ThemeId }): Node {
  return (
    <main class="yw-popup">
      <header class="yw-brand">
        <Logo size={28} id="popup" />
        <h1 class="yw-popup-title">YOLO-Web</h1>
      </header>
      <section class="yw-section">
        <h2 class="yw-section-title">Theme</h2>
        <ThemeSwitcher current={props.theme} />
      </section>
      <section class="yw-actions">
        <button
          type="button"
          class="yw-button"
          onClick={() => void openInNewTab("chrome://settings/")}
        >
          Open settings
        </button>
        <button
          type="button"
          class="yw-button"
          onClick={() => void openInNewTab()}
        >
          New tab
        </button>
      </section>
      <footer class="yw-footer">Search and new tab by aphrody.com</footer>
    </main>
  );
}

async function main(): Promise<void> {
  mountStyles(buildStyleSheet());
  const themeId = await loadThemeId();
  applyTheme(themeById(themeId));
  mount(rootElement(), <Popup theme={themeId} />);
  watchThemeId((id) => applyTheme(themeById(id)));
}

void main();
