// SPDX-License-Identifier: Apache-2.0
/**
 * Semantic color roles for one theme in one scheme (light or dark).
 *
 * Seed themes use the Material "tonal spot" recipe on HCT palettes (primary
 * chroma 36, secondary 16, tertiary hue + 60 at 24, neutral 6, neutral
 * variant 8) with the MCU tone assignments. Brand presets start from the five
 * yolo-chromium colors and derive the rest; every text and boundary role is
 * then pushed in tone until it meets WCAG 2.2 AA against the surfaces it is
 * drawn on, so a preset can never ship an unreadable pair.
 */
import { contrastRatio, mix } from "../color.ts";
import { hct, hctFromHex, tonalPalette } from "./hct.ts";
import { type ThemeTokens } from "../tokens.ts";

export interface ColorRoles {
  /** Page background. */
  readonly surface: string;
  /** Body text on every surface role. */
  readonly onSurface: string;
  /** Secondary text (labels, URLs, timestamps) on every surface role. */
  readonly onSurfaceVariant: string;
  /** Tiles at rest, the resume card. */
  readonly surfaceContainerLow: string;
  /** The search field, dialogs, the side panel. */
  readonly surfaceContainer: string;
  /** Hovered tiles and rows, the selected suggestion. */
  readonly surfaceContainerHigh: string;
  /** Pressed state, tile icon wells. */
  readonly surfaceContainerHighest: string;
  /** Input borders and focus rings: 3:1 against every surface role. */
  readonly outline: string;
  /** Decorative hairlines only. */
  readonly outlineVariant: string;
  /** Primary buttons, links, selected controls. 4.5:1 on surfaces. */
  readonly primary: string;
  readonly onPrimary: string;
  /** Selected chips and the switch track. */
  readonly secondaryContainer: string;
  readonly onSecondaryContainer: string;
  /** Validation messages. 4.5:1 on surfaces. */
  readonly error: string;
  /** Toast background and its text and action. */
  readonly inverseSurface: string;
  readonly inverseOnSurface: string;
  readonly inversePrimary: string;
}

export type Scheme = "light" | "dark";

/** Surface roles that text and outlines must contrast with. */
export const SURFACE_ROLES = [
  "surface",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
] as const satisfies readonly (keyof ColorRoles)[];

export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

function minContrast(color: string, backgrounds: readonly string[]): number {
  return Math.min(...backgrounds.map((bg) => contrastRatio(color, bg)));
}

/**
 * Moves `color` in HCT tone, keeping its hue and chroma where the gamut
 * allows, until it has at least `ratio` against every background. Goes
 * darker on light backgrounds and lighter on dark ones.
 */
export function ensureContrast(
  color: string,
  backgrounds: readonly string[],
  ratio: number,
): string {
  if (minContrast(color, backgrounds) >= ratio) {
    return color;
  }
  const start = hctFromHex(color);
  const meanTone =
    backgrounds.reduce((sum, bg) => sum + hctFromHex(bg).tone, 0) /
    backgrounds.length;
  const step = meanTone >= 50 ? -1 : 1;
  for (let tone = start.tone; tone >= 0 && tone <= 100; tone += step) {
    const candidate = hct(start.hue, start.chroma, tone).hex;
    if (minContrast(candidate, backgrounds) >= ratio) {
      return candidate;
    }
  }
  return step < 0 ? "#000000" : "#ffffff";
}

/**
 * The first candidate with AA contrast on `background`, else the one with
 * the highest contrast.
 */
export function readableOn(
  background: string,
  candidates: readonly string[],
): string {
  let best = candidates[0] ?? "#000000";
  for (const candidate of candidates) {
    if (contrastRatio(candidate, background) >= AA_TEXT) {
      return candidate;
    }
    if (
      contrastRatio(candidate, background) > contrastRatio(best, background)
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Tonal spot scheme from a seed (or achromatic when `neutral`). */
export function schemeFromSeed(
  seed: string,
  scheme: Scheme,
  neutral = false,
): ColorRoles {
  const source = hctFromHex(seed);
  const hue = source.hue;
  const p = tonalPalette(hue, neutral ? 0 : 36);
  const s = tonalPalette(hue, neutral ? 0 : 16);
  const n = tonalPalette(hue, neutral ? 0 : 6);
  const nv = tonalPalette(hue, neutral ? 0 : 8);
  const e = tonalPalette(25, 84);
  const dark = scheme === "dark";
  const roles: ColorRoles = dark
    ? {
        surface: n.tone(6),
        onSurface: n.tone(90),
        onSurfaceVariant: nv.tone(80),
        surfaceContainerLow: n.tone(10),
        surfaceContainer: n.tone(12),
        surfaceContainerHigh: n.tone(17),
        surfaceContainerHighest: n.tone(22),
        outline: nv.tone(60),
        outlineVariant: nv.tone(30),
        primary: neutral ? n.tone(90) : p.tone(80),
        onPrimary: neutral ? n.tone(10) : p.tone(20),
        secondaryContainer: s.tone(30),
        onSecondaryContainer: s.tone(90),
        error: e.tone(80),
        inverseSurface: n.tone(90),
        inverseOnSurface: n.tone(20),
        inversePrimary: neutral ? n.tone(30) : p.tone(40),
      }
    : {
        surface: n.tone(98),
        onSurface: n.tone(10),
        onSurfaceVariant: nv.tone(30),
        surfaceContainerLow: n.tone(96),
        surfaceContainer: n.tone(94),
        surfaceContainerHigh: n.tone(92),
        surfaceContainerHighest: n.tone(90),
        outline: nv.tone(50),
        outlineVariant: nv.tone(80),
        primary: neutral ? n.tone(20) : p.tone(40),
        onPrimary: neutral ? n.tone(100) : p.tone(100),
        secondaryContainer: s.tone(90),
        onSecondaryContainer: s.tone(10),
        error: e.tone(40),
        inverseSurface: n.tone(20),
        inverseOnSurface: n.tone(95),
        inversePrimary: neutral ? n.tone(90) : p.tone(80),
      };
  return enforceAccessibility(roles);
}

/** Roles from the five yolo-chromium preset colors. */
export function schemeFromChrome(theme: ThemeTokens): ColorRoles {
  const chrome = theme.chrome;
  if (!chrome) {
    throw new Error(`theme ${theme.id} has no fixed palette`);
  }
  const { surface, field, text, accent } = chrome;
  const dark = theme.scheme === "dark";
  const roles: ColorRoles = {
    surface,
    onSurface: text,
    onSurfaceVariant: mix(text, surface, 0.3),
    surfaceContainerLow: mix(surface, field, 0.5),
    surfaceContainer: field,
    surfaceContainerHigh: mix(field, text, 0.07),
    surfaceContainerHighest: mix(field, text, 0.13),
    outline: mix(text, surface, 0.45),
    outlineVariant: mix(surface, text, 0.18),
    primary: accent,
    onPrimary: dark ? surface : "#ffffff",
    secondaryContainer: mix(field, accent, dark ? 0.24 : 0.16),
    onSecondaryContainer: text,
    error: dark ? "#f2b8b5" : "#b3261e",
    inverseSurface: text,
    inverseOnSurface: surface,
    inversePrimary: accent,
  };
  return enforceAccessibility(roles);
}

/** Raises every text and boundary role to AA against its backgrounds. */
export function enforceAccessibility(roles: ColorRoles): ColorRoles {
  const surfaces = SURFACE_ROLES.map((role) => roles[role]);
  const primary = ensureContrast(roles.primary, surfaces, AA_TEXT);
  const onPrimary = ensureContrast(
    readableOn(primary, [
      roles.onPrimary,
      roles.surface,
      roles.onSurface,
      "#ffffff",
      "#000000",
    ]),
    [primary],
    AA_TEXT,
  );
  return {
    ...roles,
    onSurface: ensureContrast(roles.onSurface, surfaces, AA_TEXT),
    onSurfaceVariant: ensureContrast(roles.onSurfaceVariant, surfaces, AA_TEXT),
    outline: ensureContrast(roles.outline, surfaces, AA_NON_TEXT),
    primary,
    onPrimary,
    onSecondaryContainer: ensureContrast(
      roles.onSecondaryContainer,
      [roles.secondaryContainer],
      AA_TEXT,
    ),
    error: ensureContrast(roles.error, surfaces, AA_TEXT),
    inverseOnSurface: ensureContrast(
      roles.inverseOnSurface,
      [roles.inverseSurface],
      AA_TEXT,
    ),
    inversePrimary: ensureContrast(
      roles.inversePrimary,
      [roles.inverseSurface],
      AA_TEXT,
    ),
  };
}

/** Which scheme a theme renders in for a mode and the device setting. */
export function resolveScheme(
  theme: ThemeTokens,
  mode: "device" | "light" | "dark",
  deviceDark: boolean,
): Scheme {
  if (theme.scheme) {
    return theme.scheme;
  }
  if (mode === "device") {
    return deviceDark ? "dark" : "light";
  }
  return mode;
}

/** The color roles for a theme, seed and resolved scheme. */
export function rolesFor(
  theme: ThemeTokens,
  seed: string,
  scheme: Scheme,
): ColorRoles {
  if (theme.chrome) {
    return schemeFromChrome(theme);
  }
  return schemeFromSeed(seed, scheme, theme.id === "neutral");
}
