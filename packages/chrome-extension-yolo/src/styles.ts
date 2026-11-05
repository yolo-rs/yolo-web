// SPDX-License-Identifier: Apache-2.0
/**
 * Style sheet generated from the design tokens. Rules are typed declaration
 * objects, serialized once at startup; themes are applied by setting the
 * `--yw-*` custom properties on the document element.
 */
import { withAlpha } from "./color.ts";
import { FONT_STACK, GRID, type ThemeTokens } from "./tokens.ts";

type CssProperty =
  | "alignItems"
  | "backdropFilter"
  | "background"
  | "backgroundColor"
  | "border"
  | "borderColor"
  | "borderRadius"
  | "boxShadow"
  | "boxSizing"
  | "clipPath"
  | "color"
  | "cursor"
  | "display"
  | "flex"
  | "flexDirection"
  | "flexWrap"
  | "font"
  | "fontFamily"
  | "fontSize"
  | "fontVariantNumeric"
  | "fontWeight"
  | "gap"
  | "gridTemplateColumns"
  | "height"
  | "justifyContent"
  | "letterSpacing"
  | "lineHeight"
  | "margin"
  | "minHeight"
  | "minWidth"
  | "opacity"
  | "outline"
  | "outlineOffset"
  | "overflow"
  | "padding"
  | "placeItems"
  | "position"
  | "textAlign"
  | "textDecoration"
  | "textTransform"
  | "transition"
  | "whiteSpace"
  | "width";

type Declarations = Partial<Record<CssProperty, string | number>>;

const UNITLESS: ReadonlySet<CssProperty> = new Set<CssProperty>([
  "flex",
  "fontWeight",
  "lineHeight",
  "opacity",
]);

const VAR = {
  primary: "--yw-primary",
  onPrimary: "--yw-on-primary",
  primarySoft: "--yw-primary-soft",
  surface: "--yw-surface",
  onSurface: "--yw-on-surface",
  surfaceVariant: "--yw-surface-variant",
  onSurfaceVariant: "--yw-on-surface-variant",
  surfaceContainer: "--yw-surface-container",
  outline: "--yw-outline",
  background: "--yw-background",
  radiusControl: "--yw-radius-control",
  radiusCard: "--yw-radius-card",
  radiusField: "--yw-radius-field",
  blur: "--yw-blur",
  font: "--yw-font",
  borderGradient: "--yw-border-gradient",
  swatch: "--yw-swatch",
} as const;

/** Custom property that a swatch element sets to its theme's primary color. */
export const SWATCH_PROPERTY = VAR.swatch;

const px = (value: number): string => `${value}px`;
const use = (name: string): string => `var(${name})`;

function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function serialize(property: CssProperty, value: string | number): string {
  const text =
    typeof value === "number" && !UNITLESS.has(property) ? px(value) : value;
  return `${kebab(property)}:${text}`;
}

/** One rule, serialized. Exported for tests and for host pages. */
export function rule(selector: string, declarations: Declarations): string {
  const body = (Object.keys(declarations) as CssProperty[])
    .map((property) => {
      const value = declarations[property];
      return value === undefined ? "" : serialize(property, value);
    })
    .filter(Boolean)
    .join(";");
  return `${selector}{${body}}`;
}

/** Custom property values for a theme. */
export function themeVariables(tokens: ThemeTokens): Record<string, string> {
  const { colors, shape, effects } = tokens;
  const gradient = effects.borderGradient
    ? `linear-gradient(45deg, ${effects.borderGradient[0]}, ${effects.borderGradient[1]})`
    : `linear-gradient(${colors.outline}, ${colors.outline})`;
  return {
    [VAR.primary]: colors.primary,
    [VAR.onPrimary]: colors.onPrimary,
    [VAR.primarySoft]: withAlpha(colors.primary, 0.16),
    [VAR.surface]: colors.surface,
    [VAR.onSurface]: colors.onSurface,
    [VAR.surfaceVariant]: colors.surfaceVariant,
    [VAR.onSurfaceVariant]: colors.onSurfaceVariant,
    [VAR.surfaceContainer]: colors.surfaceContainer,
    [VAR.outline]: colors.outline,
    [VAR.background]: colors.background,
    [VAR.radiusControl]: px(shape.control),
    [VAR.radiusCard]: px(shape.card),
    [VAR.radiusField]: px(shape.field),
    [VAR.blur]: px(effects.blur),
    [VAR.font]: FONT_STACK,
    [VAR.borderGradient]: gradient,
  };
}

/** Applies a theme to `root` (the document element by default). */
export function applyTheme(
  tokens: ThemeTokens,
  root: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of Object.entries(themeVariables(tokens))) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = tokens.scheme;
  root.dataset["theme"] = tokens.id;
}

/** The complete style sheet shared by the new tab page and the popup. */
export function buildStyleSheet(): string {
  const primary = use(VAR.primary);
  const onPrimary = use(VAR.onPrimary);
  const primarySoft = use(VAR.primarySoft);
  const onSurface = use(VAR.onSurface);
  const surfaceVariant = use(VAR.surfaceVariant);
  const onSurfaceVariant = use(VAR.onSurfaceVariant);
  const surfaceContainer = use(VAR.surfaceContainer);
  const outline = use(VAR.outline);
  const background = use(VAR.background);
  const radiusControl = use(VAR.radiusControl);
  const radiusCard = use(VAR.radiusCard);
  const radiusField = use(VAR.radiusField);
  const hairline = `1px solid ${outline}`;

  return [
    rule("*,*::before,*::after", { boxSizing: "border-box" }),
    rule("html,body", { margin: 0, minHeight: "100%" }),
    rule("body", {
      fontFamily: use(VAR.font),
      fontSize: 14,
      lineHeight: 1.5,
      color: onSurface,
      background: `radial-gradient(circle at 50% -10%, ${primarySoft}, transparent 55%), ${background}`,
    }),
    rule("button,input", { font: "inherit", color: "inherit" }),
    rule(":focus-visible", {
      outline: `2px solid ${primary}`,
      outlineOffset: 2,
    }),
    rule(".yw-page", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: GRID * 4,
      minHeight: "100vh",
      padding: GRID * 4,
    }),
    rule(".yw-brand", {
      display: "flex",
      alignItems: "center",
      gap: GRID * 1.5,
    }),
    rule(".yw-wordmark", {
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: "0.01em",
    }),
    rule(".yw-clock", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: GRID / 2,
    }),
    rule(".yw-time", {
      fontSize: 64,
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums",
    }),
    rule(".yw-date", { color: onSurfaceVariant }),
    rule(".yw-search", {
      display: "flex",
      alignItems: "center",
      gap: GRID,
      width: "min(640px, 100%)",
      height: GRID * 7,
      padding: `0 ${px(GRID)} 0 ${px(GRID * 3)}`,
      border: "1px solid transparent",
      borderRadius: radiusField,
      background: `linear-gradient(${surfaceContainer}, ${surfaceContainer}) padding-box, ${use(VAR.borderGradient)} border-box`,
      backdropFilter: `blur(${use(VAR.blur)})`,
      boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)",
      transition: "box-shadow 120ms ease",
    }),
    rule(".yw-search:focus-within", { boxShadow: `0 0 0 3px ${primarySoft}` }),
    rule(".yw-search-input", {
      flex: 1,
      minWidth: 0,
      border: "none",
      background: "transparent",
      outline: "none",
      fontSize: 16,
    }),
    rule(".yw-search-button", {
      height: GRID * 5,
      padding: `0 ${px(GRID * 2)}`,
      border: "none",
      borderRadius: radiusControl,
      background: primary,
      color: onPrimary,
      fontWeight: 500,
      cursor: "pointer",
    }),
    rule(".yw-search-button:hover", { opacity: 0.92 }),
    rule(".yw-shortcuts", {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: GRID * 2,
      width: "min(640px, 100%)",
    }),
    rule(".yw-tile", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: GRID,
      padding: GRID * 2,
      border: hairline,
      borderRadius: radiusCard,
      background: surfaceContainer,
      color: onSurface,
      textDecoration: "none",
      transition: "background-color 120ms ease",
    }),
    rule(".yw-tile:hover", { backgroundColor: surfaceVariant }),
    rule(".yw-tile-mark", {
      display: "grid",
      placeItems: "center",
      width: GRID * 5,
      height: GRID * 5,
      borderRadius: "50%",
      background: surfaceVariant,
      color: primary,
      fontWeight: 600,
    }),
    rule(".yw-tile-label", { fontSize: 13, color: onSurfaceVariant }),
    rule(".yw-themes", {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: GRID,
    }),
    rule(".yw-chip", {
      display: "inline-flex",
      alignItems: "center",
      gap: GRID,
      height: GRID * 4,
      padding: `0 ${px(GRID * 1.5)}`,
      border: hairline,
      borderRadius: radiusControl,
      background: "transparent",
      color: onSurface,
      fontSize: 13,
      cursor: "pointer",
    }),
    rule(".yw-chip:hover", { backgroundColor: surfaceVariant }),
    rule('.yw-chip[aria-pressed="true"]', {
      background: primary,
      color: onPrimary,
      borderColor: primary,
    }),
    rule(".yw-swatch", {
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: use(VAR.swatch),
      boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
    }),
    rule(".yw-footer", {
      fontSize: 12,
      color: onSurfaceVariant,
      textAlign: "center",
    }),
    rule(".yw-visually-hidden", {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    }),
    rule(".yw-popup", {
      display: "flex",
      flexDirection: "column",
      gap: GRID * 2,
      width: 320,
      padding: GRID * 2,
    }),
    rule(".yw-popup-title", { margin: 0, fontSize: 16, fontWeight: 500 }),
    rule(".yw-section", { display: "flex", flexDirection: "column", gap: GRID }),
    rule(".yw-section-title", {
      margin: 0,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: onSurfaceVariant,
    }),
    rule(".yw-actions", { display: "flex", gap: GRID }),
    rule(".yw-button", {
      flex: 1,
      height: GRID * 5,
      padding: `0 ${px(GRID * 2)}`,
      border: hairline,
      borderRadius: radiusControl,
      background: surfaceContainer,
      color: primary,
      fontWeight: 500,
      cursor: "pointer",
    }),
    rule(".yw-button:hover", { backgroundColor: surfaceVariant }),
  ].join("\n");
}
