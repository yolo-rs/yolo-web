// SPDX-License-Identifier: Apache-2.0
/**
 * Design tokens: the eight theme presets, the type, space, radius and motion
 * scales, and the self-hosted font.
 *
 * Six presets carry the five colors that `crates/yolo-chromium/src/theme.rs`
 * paints into the browser chrome with `--theme=<id>` (frame, surface, field,
 * text, accent), so the new tab page and the window around it agree. The
 * other two have no fixed palette: `default` builds an HCT scheme from the
 * user's color seed and `neutral` an achromatic one; both follow the device
 * light or dark setting, like Chromium's own defaults that
 * `--theme=neutral|default` keeps.
 */

export const GRID = 8;

/**
 * Instrument Sans (OFL-1.1, The Instrument Sans Project Authors), shipped in
 * `fonts/`. Chosen for its narrow-to-normal width axis and calm grotesque
 * forms, which read well at 14 to 16 px in the search box and stay compact in
 * tile labels. The fallbacks only cover the instant before the font loads.
 */
export const FONT_FAMILY = "Instrument Sans";
export const FONT_FILE = "fonts/InstrumentSans-Variable.ttf";
export const FONT_LICENSE_FILE = "fonts/OFL.txt";
export const FONT_STACK = `"${FONT_FAMILY}", system-ui, sans-serif`;

export const THEME_IDS = [
  "default",
  "neutral",
  "m3",
  "fluent",
  "apple",
  "omarchy",
  "hyprland",
  "aphrody",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "default";

/** Default color seed: the Aphrody violet. */
export const DEFAULT_SEED = "#6d4bc3";

/** Seed swatches offered in the customize panel; any color can be typed. */
export const SEED_SWATCHES: readonly { label: string; hex: string }[] = [
  { label: "Violet", hex: "#6d4bc3" },
  { label: "Blue", hex: "#2f6fd6" },
  { label: "Teal", hex: "#1f8a84" },
  { label: "Green", hex: "#3f8f3a" },
  { label: "Gold", hex: "#b08a1e" },
  { label: "Orange", hex: "#c8642b" },
  { label: "Rose", hex: "#c2416b" },
  { label: "Slate", hex: "#5e6a7d" },
];

/** The five colors a yolo-chromium preset paints, as `#rrggbb`. */
export interface ChromeColors {
  readonly frame: string;
  readonly surface: string;
  readonly field: string;
  readonly text: string;
  readonly accent: string;
}

export interface ThemeShape {
  /** Buttons and chips, px. */
  readonly control: number;
  /** Cards, tiles and dialogs, px. */
  readonly card: number;
  /** Search field, px. */
  readonly field: number;
}

export interface ThemeTokens {
  readonly id: ThemeId;
  readonly label: string;
  readonly description: string;
  /** `undefined` follows the device (and the user's mode setting). */
  readonly scheme?: "light" | "dark";
  /** Fixed browser-chrome palette; `undefined` for seed-driven themes. */
  readonly chrome?: ChromeColors;
  readonly shape: ThemeShape;
  /** Backdrop blur behind the search field, px. */
  readonly blur: number;
  /** Optional two-stop active-border gradient (Hyprland). */
  readonly borderGradient?: readonly [string, string];
}

export const THEMES: readonly ThemeTokens[] = [
  {
    id: "default",
    label: "Color seed",
    description: "Tonal palette from your color seed, light or dark",
    shape: { control: 20, card: 16, field: 28 },
    blur: 0,
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Achromatic greys; the browser keeps its own colors",
    shape: { control: 8, card: 12, field: 12 },
    blur: 0,
  },
  {
    id: "m3",
    label: "M3",
    description: "Material 3 baseline, light",
    scheme: "light",
    chrome: {
      frame: "#e8def8",
      surface: "#fef7ff",
      field: "#f3edf7",
      text: "#1d1b20",
      accent: "#6750a4",
    },
    shape: { control: 20, card: 12, field: 28 },
    blur: 0,
  },
  {
    id: "fluent",
    label: "Fluent",
    description: "Windows 11 light surfaces",
    scheme: "light",
    chrome: {
      frame: "#ededed",
      surface: "#f9f9f9",
      field: "#ffffff",
      text: "#1a1a1a",
      accent: "#0067c0",
    },
    shape: { control: 4, card: 8, field: 4 },
    blur: 0,
  },
  {
    id: "apple",
    label: "Apple",
    description: "macOS-style light chrome",
    scheme: "light",
    chrome: {
      frame: "#e7e7e7",
      surface: "#f6f6f6",
      field: "#ffffff",
      text: "#1d1d1f",
      accent: "#007aff",
    },
    shape: { control: 10, card: 14, field: 10 },
    blur: 24,
  },
  {
    id: "omarchy",
    label: "Omarchy",
    description: "Tokyo Night family, dark",
    scheme: "dark",
    chrome: {
      frame: "#16161e",
      surface: "#1a1b26",
      field: "#24283b",
      text: "#c0caf5",
      accent: "#7aa2f7",
    },
    shape: { control: 6, card: 8, field: 6 },
    blur: 0,
  },
  {
    id: "hyprland",
    label: "Hyprland",
    description: "Catppuccin Mocha family with the active-border gradient",
    scheme: "dark",
    chrome: {
      frame: "#11111b",
      surface: "#1e1e2e",
      field: "#313244",
      text: "#cdd6f4",
      accent: "#89b4fa",
    },
    shape: { control: 10, card: 12, field: 10 },
    blur: 8,
    borderGradient: ["#33ccff", "#00ff99"],
  },
  {
    id: "aphrody",
    label: "Aphrody",
    description: "Deep violet surfaces with a gold accent",
    scheme: "dark",
    chrome: {
      frame: "#140a22",
      surface: "#1c0f2b",
      field: "#2a1b3f",
      text: "#f4ecff",
      accent: "#f2c14e",
    },
    shape: { control: 20, card: 16, field: 28 },
    blur: 0,
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as readonly string[]).includes(value)
  );
}

export function themeById(id: ThemeId): ThemeTokens {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (!theme) {
    throw new Error(`unknown theme: ${id}`);
  }
  return theme;
}

/** Type scale (px): size, line height, weight. */
export const TYPE = {
  label: { size: 12, line: 16, weight: 550 },
  body: { size: 14, line: 20, weight: 420 },
  field: { size: 16, line: 24, weight: 420 },
  title: { size: 20, line: 28, weight: 600 },
  display: { size: 32, line: 40, weight: 640 },
} as const;

/** Spacing scale on the 4 px half grid. */
export const SPACE = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;

/** Minimum pointer target (WCAG 2.2 SC 2.5.8 asks for 24 px; we use 40). */
export const TARGET_MIN = 40;

export const MOTION = {
  fast: "120ms",
  base: "200ms",
  ease: "cubic-bezier(.2,.8,.2,1)",
} as const;
