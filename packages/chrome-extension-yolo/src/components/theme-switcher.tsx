// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
import { h } from "../dom.ts";
import { saveThemeId, watchThemeId } from "../storage.ts";
import { SWATCH_PROPERTY } from "../styles.ts";
import { THEMES, type ThemeId } from "../tokens.ts";

export interface ThemeSwitcherProps {
  current: ThemeId;
}

/** Chips for the eight themes; the pressed chip follows the stored theme. */
export function ThemeSwitcher(props: ThemeSwitcherProps): Node {
  const buttons = new Map<ThemeId, HTMLButtonElement>();

  const setPressed = (id: ThemeId): void => {
    for (const [themeId, button] of buttons) {
      button.setAttribute("aria-pressed", themeId === id ? "true" : "false");
    }
  };

  const group = (
    <div class="yw-themes" role="group" aria-label="Theme">
      {THEMES.map((theme) => (
        <button
          type="button"
          class="yw-chip"
          title={theme.description}
          aria-pressed={theme.id === props.current ? "true" : "false"}
          ref={(button) => buttons.set(theme.id, button)}
          onClick={() => {
            setPressed(theme.id);
            void saveThemeId(theme.id);
          }}
        >
          <span
            class="yw-swatch"
            aria-hidden="true"
            ref={(swatch) =>
              swatch.style.setProperty(SWATCH_PROPERTY, theme.colors.primary)
            }
          />
          {theme.label}
        </button>
      ))}
    </div>
  );

  watchThemeId(setPressed);
  return group;
}
