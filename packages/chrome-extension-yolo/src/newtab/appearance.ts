// SPDX-License-Identifier: Apache-2.0
/**
 * Applies the theme to a document: resolves the scheme from the theme, the
 * mode setting and the device (`prefers-color-scheme`), builds the color
 * roles, sets the custom properties, and loads the self-hosted font.
 */
import {
  rolesFor,
  resolveScheme,
  type ColorRoles,
  type Scheme,
} from "./scheme.ts";
import type { NtpSettings } from "./settings.ts";
import { applyTheme } from "../styles.ts";
import { FONT_FAMILY, FONT_FILE, type ThemeId, themeById } from "../tokens.ts";

export interface Appearance {
  readonly scheme: Scheme;
  readonly roles: ColorRoles;
}

const darkQuery = (): MediaQueryList | undefined =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)");

export function deviceIsDark(): boolean {
  return darkQuery()?.matches ?? false;
}

/** Calls `listener` when the device switches between light and dark. */
export function watchDevice(listener: (dark: boolean) => void): void {
  darkQuery()?.addEventListener("change", (event) => listener(event.matches));
}

export function applyAppearance(
  themeId: ThemeId,
  settings: Pick<NtpSettings, "seed" | "mode">,
  deviceDark: boolean = deviceIsDark(),
): Appearance {
  const theme = themeById(themeId);
  const scheme = resolveScheme(theme, settings.mode, deviceDark);
  const roles = rolesFor(theme, settings.seed, scheme);
  applyTheme(theme, roles, scheme);
  return { scheme, roles };
}

/** Registers the variable font from the extension package. */
export async function loadFont(): Promise<void> {
  if (typeof FontFace === "undefined") {
    return;
  }
  try {
    const face = new FontFace(FONT_FAMILY, `url("${FONT_FILE}")`, {
      weight: "400 700",
      stretch: "75% 100%",
      style: "normal",
      display: "swap",
    });
    document.fonts.add(face);
    await face.load();
  } catch {
    // The fallback stack stays in place.
  }
}
