// SPDX-License-Identifier: Apache-2.0
/**
 * Theme persistence. Extension contexts use `chrome.storage.sync` so the
 * choice follows the profile; outside an extension (layout work from a file)
 * the page falls back to `localStorage`.
 */
import { extensionApi } from "./extension-api.ts";
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from "./tokens.ts";

export const THEME_STORAGE_KEY = "theme";

function coerceThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

export async function loadThemeId(): Promise<ThemeId> {
  const sync = extensionApi()?.storage?.sync;
  if (sync) {
    const stored = await sync.get(THEME_STORAGE_KEY);
    return coerceThemeId(stored[THEME_STORAGE_KEY]);
  }
  return coerceThemeId(globalThis.localStorage?.getItem(THEME_STORAGE_KEY));
}

export async function saveThemeId(id: ThemeId): Promise<void> {
  const sync = extensionApi()?.storage?.sync;
  if (sync) {
    await sync.set({ [THEME_STORAGE_KEY]: id });
    return;
  }
  globalThis.localStorage?.setItem(THEME_STORAGE_KEY, id);
  window.dispatchEvent(
    new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: id }),
  );
}

/** Calls `listener` whenever the theme changes in any context. */
export function watchThemeId(listener: (id: ThemeId) => void): void {
  const onChanged = extensionApi()?.storage?.onChanged;
  if (onChanged) {
    onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }
      const change = changes[THEME_STORAGE_KEY];
      if (change) {
        listener(coerceThemeId(change.newValue));
      }
    });
    return;
  }
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      listener(coerceThemeId(event.newValue));
    }
  });
}
