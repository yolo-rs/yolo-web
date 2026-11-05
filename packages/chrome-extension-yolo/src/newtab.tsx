// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/** New tab page entry: clock, aphrody.com search, shortcuts, theme chips. */
import { Clock } from "./components/clock.tsx";
import { Logo } from "./components/logo.tsx";
import { SearchForm } from "./components/search.tsx";
import { Shortcuts } from "./components/shortcuts.tsx";
import { ThemeSwitcher } from "./components/theme-switcher.tsx";
import { h, mount, mountStyles, rootElement } from "./dom.ts";
import { loadThemeId, watchThemeId } from "./storage.ts";
import { applyTheme, buildStyleSheet } from "./styles.ts";
import { type ThemeId, themeById } from "./tokens.ts";

function NewTabPage(props: { theme: ThemeId }): Node {
  return (
    <main class="yw-page">
      <header class="yw-brand">
        <Logo size={40} id="newtab" />
        <span class="yw-wordmark">YOLO-Web</span>
      </header>
      <Clock />
      <SearchForm />
      <Shortcuts />
      <ThemeSwitcher current={props.theme} />
      <footer class="yw-footer">
        Search runs on aphrody.com. The theme is saved with your profile.
      </footer>
    </main>
  );
}

async function main(): Promise<void> {
  mountStyles(buildStyleSheet());
  const themeId = await loadThemeId();
  applyTheme(themeById(themeId));
  document.title = "New tab";
  mount(rootElement(), <NewTabPage theme={themeId} />);
  watchThemeId((id) => applyTheme(themeById(id)));
}

void main();
