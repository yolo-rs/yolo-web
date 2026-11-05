// SPDX-License-Identifier: Apache-2.0
/**
 * Design tokens. The default theme is Chromium's own Google Material look
 * (Google Sans / system-ui stack, Google blue `#1a73e8`, Google grey
 * surfaces, 8 px grid). The seven YOLO brand presets map the `yolo-ui`
 * `YoloThemePreset` families onto the same token names so one style sheet
 * serves every theme. Only local fonts are referenced; no icon packs.
 */

export const GRID = 8;

export const FONT_STACK =
  '"Google Sans", "Google Sans Text", system-ui, -apple-system, "Segoe UI", sans-serif';

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

export interface ThemeColors {
  /** Accent used for primary actions and links. */
  readonly primary: string;
  /** Text and icons drawn on `primary`. */
  readonly onPrimary: string;
  /** Page surface. */
  readonly surface: string;
  /** Text on `surface` and `surfaceContainer`. */
  readonly onSurface: string;
  /** Hover and chip surfaces. */
  readonly surfaceVariant: string;
  /** Secondary text on `surface` and `surfaceVariant`. */
  readonly onSurfaceVariant: string;
  /** Cards, the search field, and popup controls. */
  readonly surfaceContainer: string;
  /** Hairline borders. */
  readonly outline: string;
  /** Page background behind `surface` content. */
  readonly background: string;
}

export interface ThemeShape {
  /** Buttons and chips, px. */
  readonly control: number;
  /** Cards and tiles, px. */
  readonly card: number;
  /** Search field, px. */
  readonly field: number;
}

export interface ThemeEffects {
  /** Backdrop blur behind the search field, px (0 disables it). */
  readonly blur: number;
  /** Optional two-stop active-border gradient (Hyprland style). */
  readonly borderGradient?: readonly [string, string];
}

export interface ThemeTokens {
  readonly id: ThemeId;
  readonly label: string;
  readonly description: string;
  readonly scheme: "light" | "dark";
  /** Seed color of the brand family, kept for reference and swatches. */
  readonly seed: string;
  readonly colors: ThemeColors;
  readonly shape: ThemeShape;
  readonly effects: ThemeEffects;
}

export const THEMES: readonly ThemeTokens[] = [
  {
    id: "default",
    label: "Chromium",
    description: "Chromium and Google Material defaults",
    scheme: "light",
    seed: "#1a73e8",
    colors: {
      primary: "#1a73e8",
      onPrimary: "#ffffff",
      surface: "#ffffff",
      onSurface: "#202124",
      surfaceVariant: "#f1f3f4",
      onSurfaceVariant: "#5f6368",
      surfaceContainer: "#f8f9fa",
      outline: "#dadce0",
      background: "#ffffff",
    },
    shape: { control: 20, card: 8, field: 24 },
    effects: { blur: 0 },
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Vendor-neutral zinc surfaces with an indigo accent",
    scheme: "light",
    seed: "#6366f1",
    colors: {
      primary: "#4f46e5",
      onPrimary: "#ffffff",
      surface: "#fafafa",
      onSurface: "#18181b",
      surfaceVariant: "#f4f4f5",
      onSurfaceVariant: "#52525b",
      surfaceContainer: "#ffffff",
      outline: "#d4d4d8",
      background: "#fafafa",
    },
    shape: { control: 8, card: 12, field: 8 },
    effects: { blur: 0 },
  },
  {
    id: "m3",
    label: "M3",
    description: "Material Design 3 baseline scheme",
    scheme: "light",
    seed: "#6750a4",
    colors: {
      primary: "#6750a4",
      onPrimary: "#ffffff",
      surface: "#fef7ff",
      onSurface: "#1d1b20",
      surfaceVariant: "#e7e0ec",
      onSurfaceVariant: "#49454f",
      surfaceContainer: "#f3edf7",
      outline: "#79747e",
      background: "#fef7ff",
    },
    shape: { control: 20, card: 12, field: 28 },
    effects: { blur: 0 },
  },
  {
    id: "fluent",
    label: "Fluent",
    description: "Windows 11 Fluent and WinUI 3 light surfaces",
    scheme: "light",
    seed: "#0078d4",
    colors: {
      primary: "#0067c0",
      onPrimary: "#ffffff",
      surface: "#f3f3f3",
      onSurface: "#1a1a1a",
      surfaceVariant: "#ebebeb",
      onSurfaceVariant: "#5d5d5d",
      surfaceContainer: "#ffffff",
      outline: "#e0e0e0",
      background: "#f3f3f3",
    },
    shape: { control: 4, card: 8, field: 4 },
    effects: { blur: 0 },
  },
  {
    id: "apple",
    label: "Apple",
    description: "macOS and iOS light chrome with squircle radii",
    scheme: "light",
    seed: "#007aff",
    colors: {
      primary: "#0066cc",
      onPrimary: "#ffffff",
      surface: "#f5f5f7",
      onSurface: "#1d1d1f",
      surfaceVariant: "#ffffff",
      onSurfaceVariant: "#6e6e73",
      surfaceContainer: "#ffffff",
      outline: "#d2d2d7",
      background: "#f5f5f7",
    },
    shape: { control: 10, card: 14, field: 10 },
    effects: { blur: 24 },
  },
  {
    id: "omarchy",
    label: "Omarchy",
    description: "Omarchy Tokyo Night dark palette",
    scheme: "dark",
    seed: "#7aa2f7",
    colors: {
      primary: "#7aa2f7",
      onPrimary: "#1a1b26",
      surface: "#1a1b26",
      onSurface: "#c0caf5",
      surfaceVariant: "#24283b",
      onSurfaceVariant: "#a9b1d6",
      surfaceContainer: "#16161e",
      outline: "#414868",
      background: "#1a1b26",
    },
    shape: { control: 6, card: 8, field: 6 },
    effects: { blur: 0 },
  },
  {
    id: "hyprland",
    label: "Hyprland",
    description: "Hyprland dark palette with the cyan-to-green active border",
    scheme: "dark",
    seed: "#33ccff",
    colors: {
      primary: "#89b4fa",
      onPrimary: "#1e1e2e",
      surface: "#1e1e2e",
      onSurface: "#cdd6f4",
      surfaceVariant: "#313244",
      onSurfaceVariant: "#bac2de",
      surfaceContainer: "#181825",
      outline: "#45475a",
      background: "#1e1e2e",
    },
    shape: { control: 10, card: 12, field: 10 },
    effects: { blur: 8, borderGradient: ["#33ccff", "#00ff99"] },
  },
  {
    id: "aphrody",
    label: "Aphrody",
    description: "aphrody.com Material 3 dark blue scheme",
    scheme: "dark",
    seed: "#435e91",
    colors: {
      primary: "#acc7ff",
      onPrimary: "#0e2f60",
      surface: "#111318",
      onSurface: "#e2e2e9",
      surfaceVariant: "#282a2f",
      onSurfaceVariant: "#c4c6d0",
      surfaceContainer: "#1e2025",
      outline: "#8e9099",
      background: "#0f141c",
    },
    shape: { control: 20, card: 16, field: 28 },
    effects: { blur: 0 },
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" && (THEME_IDS as readonly string[]).includes(value)
  );
}

export function themeById(id: ThemeId): ThemeTokens {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (!theme) {
    throw new Error(`unknown theme: ${id}`);
  }
  return theme;
}
