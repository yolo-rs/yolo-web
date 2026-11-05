// SPDX-License-Identifier: Apache-2.0
/**
 * Style sheet generated from the design tokens. Rules are declaration
 * objects serialized once at startup; components only reference semantic
 * custom properties (`--yw-*`), and themes are applied by setting those
 * properties on the document element.
 */
import { withAlpha } from "./color.ts";
import type { ColorRoles } from "./newtab/scheme.ts";
import {
  FONT_STACK,
  GRID,
  MOTION,
  SPACE,
  TARGET_MIN,
  TYPE,
  type ThemeTokens,
} from "./tokens.ts";

/** camelCase CSS property names to values; numbers become px. */
export type Declarations = Readonly<Record<string, string | number>>;

const UNITLESS: ReadonlySet<string> = new Set([
  "animationIterationCount",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "zIndex",
]);

/** Semantic custom properties. */
export const VAR = {
  surface: "--yw-surface",
  onSurface: "--yw-on-surface",
  onSurfaceVariant: "--yw-on-surface-variant",
  surfaceContainerLow: "--yw-surface-container-low",
  surfaceContainer: "--yw-surface-container",
  surfaceContainerHigh: "--yw-surface-container-high",
  surfaceContainerHighest: "--yw-surface-container-highest",
  outline: "--yw-outline",
  outlineVariant: "--yw-outline-variant",
  primary: "--yw-primary",
  onPrimary: "--yw-on-primary",
  secondaryContainer: "--yw-secondary-container",
  onSecondaryContainer: "--yw-on-secondary-container",
  error: "--yw-error",
  inverseSurface: "--yw-inverse-surface",
  inverseOnSurface: "--yw-inverse-on-surface",
  inversePrimary: "--yw-inverse-primary",
  focusRing: "--yw-focus-ring",
  radiusControl: "--yw-radius-control",
  radiusCard: "--yw-radius-card",
  radiusField: "--yw-radius-field",
  blur: "--yw-blur",
  font: "--yw-font",
  fieldBorder: "--yw-field-border",
  backgroundImage: "--yw-background-image",
  swatch: "--yw-swatch",
  swatchOn: "--yw-swatch-on",
} as const;

const ROLE_VARS: Record<keyof ColorRoles, string> = {
  surface: VAR.surface,
  onSurface: VAR.onSurface,
  onSurfaceVariant: VAR.onSurfaceVariant,
  surfaceContainerLow: VAR.surfaceContainerLow,
  surfaceContainer: VAR.surfaceContainer,
  surfaceContainerHigh: VAR.surfaceContainerHigh,
  surfaceContainerHighest: VAR.surfaceContainerHighest,
  outline: VAR.outline,
  outlineVariant: VAR.outlineVariant,
  primary: VAR.primary,
  onPrimary: VAR.onPrimary,
  secondaryContainer: VAR.secondaryContainer,
  onSecondaryContainer: VAR.onSecondaryContainer,
  error: VAR.error,
  inverseSurface: VAR.inverseSurface,
  inverseOnSurface: VAR.inverseOnSurface,
  inversePrimary: VAR.inversePrimary,
};

/** Custom properties that a swatch element sets for its own colors. */
export const SWATCH_PROPERTY = VAR.swatch;
export const SWATCH_ON_PROPERTY = VAR.swatchOn;

const px = (value: number): string => `${value}px`;
const use = (name: string): string => `var(${name})`;

function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function serialize(property: string, value: string | number): string {
  const text =
    typeof value === "number" && !UNITLESS.has(property) && value !== 0
      ? px(value)
      : String(value);
  return `${kebab(property)}:${text}`;
}

/** One rule, serialized. Exported for tests and for host pages. */
export function rule(selector: string, declarations: Declarations): string {
  const body = Object.entries(declarations)
    .map(([property, value]) => serialize(property, value))
    .join(";");
  return `${selector}{${body}}`;
}

/** An at-rule block (`@media`, `@supports`) around rules. */
export function block(prelude: string, rules: readonly string[]): string {
  return `${prelude}{${rules.join("")}}`;
}

/** Custom property values for a theme and its resolved color roles. */
export function themeVariables(
  theme: ThemeTokens,
  roles: ColorRoles,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, name] of Object.entries(ROLE_VARS)) {
    out[name] = roles[role as keyof ColorRoles];
  }
  out[VAR.focusRing] = roles.primary;
  out[VAR.radiusControl] = px(theme.shape.control);
  out[VAR.radiusCard] = px(theme.shape.card);
  out[VAR.radiusField] = px(theme.shape.field);
  out[VAR.blur] = px(theme.blur);
  out[VAR.font] = FONT_STACK;
  out[VAR.fieldBorder] = theme.borderGradient
    ? `linear-gradient(45deg, ${theme.borderGradient[0]}, ${theme.borderGradient[1]})`
    : `linear-gradient(${roles.outline}, ${roles.outline})`;
  return out;
}

/** Applies a theme to `root` (the document element by default). */
export function applyTheme(
  theme: ThemeTokens,
  roles: ColorRoles,
  scheme: "light" | "dark",
  root: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of Object.entries(themeVariables(theme, roles))) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = scheme;
  root.dataset["theme"] = theme.id;
  root.dataset["scheme"] = scheme;
}

const t = (name: keyof typeof TYPE): Declarations => ({
  fontSize: TYPE[name].size,
  lineHeight: `${TYPE[name].line}px`,
  fontWeight: TYPE[name].weight,
});

/** The complete style sheet shared by the new tab page and the popup. */
export function buildStyleSheet(): string {
  const surface = use(VAR.surface);
  const onSurface = use(VAR.onSurface);
  const onSurfaceVariant = use(VAR.onSurfaceVariant);
  const low = use(VAR.surfaceContainerLow);
  const container = use(VAR.surfaceContainer);
  const high = use(VAR.surfaceContainerHigh);
  const highest = use(VAR.surfaceContainerHighest);
  const outline = use(VAR.outline);
  const outlineVariant = use(VAR.outlineVariant);
  const primary = use(VAR.primary);
  const onPrimary = use(VAR.onPrimary);
  const secondaryContainer = use(VAR.secondaryContainer);
  const onSecondaryContainer = use(VAR.onSecondaryContainer);
  const error = use(VAR.error);
  const inverseSurface = use(VAR.inverseSurface);
  const inverseOnSurface = use(VAR.inverseOnSurface);
  const inversePrimary = use(VAR.inversePrimary);
  const rControl = use(VAR.radiusControl);
  const rCard = use(VAR.radiusCard);
  const rField = use(VAR.radiusField);
  const hairline = `1px solid ${outlineVariant}`;
  const ring = `2px solid ${use(VAR.focusRing)}`;
  const transition = (props: string): string =>
    props
      .split(",")
      .map((prop) => `${prop.trim()} ${MOTION.fast} ${MOTION.ease}`)
      .join(",");
  const stateLayer = (amount: number): string =>
    `color-mix(in srgb, ${onSurface} ${amount}%, transparent)`;
  const shadowPop = `0 8px 24px ${withAlpha("#000000", 0.18)}, 0 2px 6px ${withAlpha("#000000", 0.12)}`;
  const shadowField = `0 1px 3px ${withAlpha("#000000", 0.12)}`;
  const [, s1, s2, s3, s4, s5, s6, s7] = SPACE;

  return [
    rule("*,*::before,*::after", { boxSizing: "border-box" }),
    rule("html,body", { margin: 0, minHeight: "100%" }),
    // Keeps focused controls clear of the fixed footer and button (2.4.11).
    rule("html", { scrollPaddingBottom: 96 }),
    rule("body", {
      ...t("body"),
      fontFamily: use(VAR.font),
      fontOpticalSizing: "auto",
      color: onSurface,
      background: surface,
      WebkitFontSmoothing: "antialiased",
    }),
    rule("body.yw-has-image", {
      backgroundImage: use(VAR.backgroundImage),
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }),
    rule("button,input,select", { font: "inherit", color: "inherit" }),
    rule("a", { color: primary }),
    rule(":focus-visible", { outline: ring, outlineOffset: 2 }),
    // Wins over every class-only `display` rule below.
    rule("[hidden]:not(#yw-none)", { display: "none" }),
    rule(".yw-visually-hidden", {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
    }),
    rule(".yw-icon", {
      width: 20,
      height: 20,
      flexShrink: 0,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),

    // Page layout (S04).
    rule(".yw-page", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: s6,
      minHeight: "100vh",
      padding: `${px(GRID * 12)} ${px(s5)} ${px(GRID * 14)}`,
    }),
    rule(".yw-brand", {
      display: "inline-flex",
      alignItems: "center",
      gap: s3,
      margin: 0,
      padding: `${px(s2)} ${px(s4)} ${px(s2)} ${px(s2)}`,
      borderRadius: 999,
      ...t("display"),
      letterSpacing: "-0.01em",
      fontStretch: "92%",
      color: onSurface,
    }),
    rule(".yw-has-image .yw-brand,.yw-has-image .yw-footer", {
      background: container,
      boxShadow: shadowField,
    }),

    // Search box (S01, S02).
    rule(".yw-search", {
      position: "relative",
      width: "min(680px, 100%)",
    }),
    rule(".yw-search-field", {
      display: "flex",
      alignItems: "center",
      gap: s1,
      minHeight: 56,
      padding: `0 ${px(s2)} 0 ${px(s4)}`,
      border: "1.5px solid transparent",
      borderRadius: rField,
      background: `linear-gradient(${container}, ${container}) padding-box, ${use(VAR.fieldBorder)} border-box`,
      backdropFilter: `blur(${use(VAR.blur)})`,
      boxShadow: shadowField,
      color: onSurfaceVariant,
      transition: transition("box-shadow, border-radius"),
    }),
    // Focus: the 1.5 px boundary turns primary and thickens to 3 px.
    rule(".yw-search-field:focus-within", {
      background: `linear-gradient(${container}, ${container}) padding-box, linear-gradient(${primary}, ${primary}) border-box`,
      boxShadow: `0 0 0 1.5px ${primary}, ${shadowField}`,
    }),
    rule(".yw-search-field:has(:focus-visible) .yw-search-input", {
      outline: "none",
    }),
    rule(".yw-search.yw-open .yw-search-field", {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      boxShadow: shadowPop,
    }),
    rule(".yw-search-input", {
      flex: 1,
      minWidth: 0,
      height: 52,
      padding: `0 ${px(s2)}`,
      border: "none",
      background: "transparent",
      outline: "none",
      color: onSurface,
      ...t("field"),
    }),
    rule(".yw-search-input::placeholder", {
      color: onSurfaceVariant,
      opacity: 1,
    }),
    rule(".yw-icon-button", {
      display: "inline-grid",
      placeItems: "center",
      width: TARGET_MIN,
      height: TARGET_MIN,
      padding: 0,
      border: "none",
      borderRadius: "50%",
      background: "transparent",
      color: onSurfaceVariant,
      cursor: "pointer",
      transition: transition("background-color"),
    }),
    rule(".yw-icon-button:hover", { backgroundColor: stateLayer(8) }),
    rule(".yw-icon-button:active", { backgroundColor: stateLayer(12) }),
    rule(".yw-submit", { background: primary, color: onPrimary }),
    rule(".yw-submit:hover", {
      backgroundColor: `color-mix(in srgb, ${primary} 88%, ${onPrimary})`,
    }),
    rule(".yw-listbox", {
      position: "absolute",
      zIndex: 20,
      left: 0,
      right: 0,
      top: "100%",
      margin: 0,
      padding: `${px(s1)} 0 ${px(s2)}`,
      listStyle: "none",
      background: container,
      border: "1.5px solid transparent",
      borderTop: hairline,
      borderRadius: `0 0 ${rField} ${rField}`,
      boxShadow: shadowPop,
      overflow: "hidden",
    }),
    rule(".yw-option", {
      display: "flex",
      alignItems: "center",
      gap: s3,
      minHeight: TARGET_MIN,
      padding: `${px(s1)} ${px(s4)}`,
      color: onSurface,
      cursor: "pointer",
    }),
    rule(".yw-option:hover", { background: high }),
    rule('.yw-option[aria-selected="true"]', {
      background: secondaryContainer,
      color: onSecondaryContainer,
      boxShadow: `inset 3px 0 0 ${primary}`,
    }),
    rule(
      '.yw-option[aria-selected="true"] .yw-option-icon,.yw-option[aria-selected="true"] .yw-option-url',
      {
        color: onSecondaryContainer,
      },
    ),
    rule(".yw-option-icon", {
      color: onSurfaceVariant,
      display: "inline-flex",
    }),
    rule(".yw-option-text", {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      ...t("field"),
    }),
    rule(".yw-option-text b", { fontWeight: 650 }),
    rule(".yw-option-typed", { fontWeight: 420 }),
    rule(".yw-option-url", {
      ...t("body"),
      color: onSurfaceVariant,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: "40%",
    }),

    // Shortcut tiles (S04, F03, F04).
    rule(".yw-slot", { width: "min(680px, 100%)" }),
    rule(".yw-shortcuts", { width: "100%" }),
    rule(".yw-tiles", {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
      gap: s3,
      margin: 0,
      padding: 0,
      listStyle: "none",
    }),
    rule(".yw-tile", {
      position: "relative",
      borderRadius: rCard,
      background: low,
      transition: transition("background-color, box-shadow, transform"),
    }),
    rule(".yw-tile:hover", { background: high }),
    rule(".yw-tile.yw-dragging", { opacity: 0.5 }),
    rule(".yw-tile.yw-drop-before", { boxShadow: `inset 3px 0 0 ${primary}` }),
    rule(".yw-tile.yw-drop-after", { boxShadow: `inset -3px 0 0 ${primary}` }),
    rule(".yw-tile-link,.yw-tile-add", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: s2,
      width: "100%",
      minHeight: 112,
      padding: `${px(s4)} ${px(s2)} ${px(s3)}`,
      border: "none",
      borderRadius: rCard,
      background: "transparent",
      color: onSurface,
      textDecoration: "none",
      cursor: "pointer",
    }),
    rule(".yw-tile-add", { border: `1.5px dashed ${outline}` }),
    rule(".yw-tile-add:hover", { background: stateLayer(6) }),
    rule(".yw-tile-well", {
      display: "grid",
      placeItems: "center",
      width: 48,
      height: 48,
      borderRadius: "50%",
      background: highest,
      color: primary,
      ...t("title"),
      overflow: "hidden",
    }),
    rule(".yw-tile-well img", { width: 24, height: 24 }),
    rule(".yw-tile-title", {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      ...t("body"),
    }),
    rule(".yw-tile-menu-button", {
      position: "absolute",
      top: s1,
      right: s1,
      opacity: 0,
    }),
    rule(
      '.yw-tile:hover .yw-tile-menu-button,.yw-tile:focus-within .yw-tile-menu-button,.yw-tile-menu-button[aria-expanded="true"]',
      { opacity: 1 },
    ),
    block("@media (hover: none)", [
      rule(".yw-tile-menu-button", { opacity: 1 }),
    ]),
    rule(".yw-hint", {
      margin: `${px(s3)} 0 0`,
      color: onSurfaceVariant,
      textAlign: "center",
    }),
    rule(".yw-hint button", {
      padding: 0,
      border: "none",
      background: "none",
      color: primary,
      textDecoration: "underline",
      cursor: "pointer",
      minHeight: 24,
    }),

    // Menus (tile options).
    rule(".yw-menu", {
      position: "fixed",
      inset: "auto",
      margin: 0,
      minWidth: 200,
      padding: `${px(s1)} 0`,
      border: hairline,
      borderRadius: 12,
      background: container,
      color: onSurface,
      boxShadow: shadowPop,
    }),
    rule(".yw-menu-item", {
      display: "flex",
      alignItems: "center",
      gap: s3,
      width: "100%",
      minHeight: TARGET_MIN,
      padding: `0 ${px(s4)}`,
      border: "none",
      background: "transparent",
      textAlign: "start",
      cursor: "pointer",
    }),
    rule(".yw-menu-item:hover,.yw-menu-item:focus-visible", {
      background: high,
      outlineOffset: -2,
    }),
    rule(".yw-menu-item:disabled", {
      color: onSurfaceVariant,
      cursor: "default",
    }),
    rule(".yw-menu-item:disabled:hover", { background: "transparent" }),

    // Cards (resume browsing, F06).
    rule(".yw-card", {
      width: "100%",
      padding: `${px(s4)} ${px(s5)} ${px(s5)}`,
      borderRadius: rCard,
      background: low,
      border: hairline,
    }),
    rule(".yw-card-header", {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: s3,
      marginBottom: s2,
    }),
    rule(".yw-card-title", { margin: 0, ...t("title") }),
    rule(".yw-card-body", { margin: 0, color: onSurfaceVariant }),
    rule(".yw-visits", {
      display: "flex",
      flexDirection: "column",
      margin: 0,
      padding: 0,
      listStyle: "none",
    }),
    rule(".yw-visit", {
      display: "flex",
      alignItems: "center",
      gap: s3,
      minHeight: 48,
      padding: `${px(s1)} ${px(s2)}`,
      margin: `0 ${px(-s2)}`,
      borderRadius: 10,
      color: onSurface,
      textDecoration: "none",
    }),
    rule(".yw-visit:hover", { background: high }),
    rule(".yw-visit img", { width: 20, height: 20, flexShrink: 0 }),
    rule(".yw-visit-text", {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    }),
    rule(".yw-visit-title,.yw-visit-meta", {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    rule(".yw-visit-meta", { ...t("label"), color: onSurfaceVariant }),
    rule(".yw-skeleton", {
      height: 40,
      margin: `${px(s1)} 0`,
      borderRadius: 10,
      background: `linear-gradient(90deg, ${container}, ${highest}, ${container})`,
      backgroundSize: "200% 100%",
      animation: `yw-shimmer 1.4s linear infinite`,
    }),
    "@keyframes yw-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}",

    // Buttons.
    rule(".yw-button", {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s2,
      minHeight: TARGET_MIN,
      padding: `0 ${px(s4)}`,
      border: `1px solid ${outline}`,
      borderRadius: rControl,
      background: "transparent",
      color: primary,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: transition("background-color"),
    }),
    rule(".yw-button:hover", {
      background: `color-mix(in srgb, ${primary} 8%, transparent)`,
    }),
    rule(".yw-button-primary", {
      borderColor: primary,
      background: primary,
      color: onPrimary,
    }),
    rule(".yw-button-primary:hover", {
      background: `color-mix(in srgb, ${primary} 88%, ${onPrimary})`,
    }),
    rule(".yw-button-text", { borderColor: "transparent" }),
    rule(".yw-button-danger", { color: error, borderColor: "transparent" }),
    rule(".yw-button:disabled", {
      color: onSurfaceVariant,
      borderColor: outlineVariant,
      background: "transparent",
      cursor: "not-allowed",
    }),

    // Dialogs: the shortcut editor (S06) and the customize side panel (S05).
    rule(".yw-dialog", {
      width: "min(440px, calc(100vw - 32px))",
      padding: s5,
      border: "none",
      borderRadius: 20,
      background: container,
      color: onSurface,
      boxShadow: shadowPop,
    }),
    rule(".yw-dialog::backdrop,.yw-panel::backdrop", {
      background: withAlpha("#000000", 0.4),
    }),
    rule(".yw-dialog-title", { margin: `0 0 ${px(s4)}`, ...t("title") }),
    rule(".yw-field", {
      display: "flex",
      flexDirection: "column",
      gap: s1,
      marginBottom: s4,
    }),
    rule(".yw-field label,.yw-label", {
      ...t("label"),
      color: onSurfaceVariant,
    }),
    rule(".yw-input", {
      minHeight: 48,
      padding: `0 ${px(s3)}`,
      border: `1px solid ${outline}`,
      borderRadius: 10,
      background: surface,
      color: onSurface,
      ...t("field"),
    }),
    rule(".yw-input:focus-visible", { outline: ring, outlineOffset: 1 }),
    rule('.yw-input[aria-invalid="true"]', {
      borderColor: error,
      borderWidth: 2,
    }),
    rule(".yw-error", { margin: `${px(s1)} 0 0`, color: error, ...t("body") }),
    rule(".yw-dialog-actions", {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: s2,
      marginTop: s5,
    }),
    rule(".yw-dialog-actions .yw-spacer", { flex: 1 }),
    rule(".yw-panel", {
      position: "fixed",
      inset: "0 0 0 auto",
      width: "min(400px, 100vw)",
      maxWidth: "100vw",
      height: "100vh",
      maxHeight: "100vh",
      margin: 0,
      padding: 0,
      border: "none",
      borderLeft: hairline,
      background: container,
      color: onSurface,
      boxShadow: shadowPop,
      overflowY: "auto",
    }),
    rule(".yw-panel-header", {
      position: "sticky",
      top: 0,
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${px(s4)} ${px(s3)} ${px(s4)} ${px(s5)}`,
      background: container,
      borderBottom: hairline,
    }),
    rule(".yw-panel-title", { margin: 0, ...t("title") }),
    rule(".yw-panel-body", {
      display: "flex",
      flexDirection: "column",
      gap: s5,
      padding: `${px(s4)} ${px(s5)} ${px(s7)}`,
    }),
    rule(".yw-group", {
      display: "flex",
      flexDirection: "column",
      gap: s3,
      margin: 0,
      padding: 0,
      border: "none",
      minWidth: 0,
    }),
    rule(".yw-group legend,.yw-group-title", {
      padding: 0,
      marginBottom: s3,
      ...t("label"),
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: onSurfaceVariant,
    }),
    rule(".yw-group[disabled] .yw-note,.yw-note", {
      margin: 0,
      color: onSurfaceVariant,
    }),
    rule(".yw-presets", {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: s2,
    }),
    rule(".yw-choice", {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: s3,
      minHeight: 48,
      padding: `${px(s2)} ${px(s3)}`,
      border: `1px solid ${outlineVariant}`,
      borderRadius: 12,
      cursor: "pointer",
    }),
    rule(".yw-choice:hover", { background: stateLayer(6) }),
    rule(".yw-choice:has(input:checked)", {
      borderColor: primary,
      background: secondaryContainer,
      color: onSecondaryContainer,
      boxShadow: `inset 0 0 0 1px ${primary}`,
    }),
    rule(".yw-choice:has(input:focus-visible)", {
      outline: ring,
      outlineOffset: 2,
    }),
    rule(".yw-choice:has(input:disabled)", {
      opacity: 0.6,
      cursor: "not-allowed",
    }),
    rule(".yw-choice input", {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1,
      margin: 0,
    }),
    rule(".yw-preset-swatch", {
      display: "grid",
      placeItems: "center",
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: "50%",
      background: use(VAR.swatch),
      boxShadow: `inset 0 0 0 1px ${withAlpha("#000000", 0.16)}`,
    }),
    rule(".yw-preset-swatch::after", {
      content: '""',
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: use(VAR.swatchOn),
    }),
    rule(".yw-seeds", {
      display: "flex",
      flexWrap: "wrap",
      gap: s2,
    }),
    rule(".yw-seed", {
      position: "relative",
      display: "grid",
      placeItems: "center",
      width: TARGET_MIN,
      height: TARGET_MIN,
      borderRadius: "50%",
      cursor: "pointer",
    }),
    rule(".yw-seed span", {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: use(VAR.swatch),
      boxShadow: `inset 0 0 0 1px ${withAlpha("#000000", 0.16)}`,
    }),
    rule(".yw-seed input", {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1,
      margin: 0,
    }),
    rule(".yw-seed:has(input:checked)", {
      boxShadow: `0 0 0 2px ${onSurface}`,
    }),
    rule(".yw-group[disabled] .yw-seeds", { opacity: 0.45 }),
    rule(".yw-seed:has(input:focus-visible)", {
      outline: ring,
      outlineOffset: 3,
    }),
    rule(".yw-color-input", {
      width: TARGET_MIN,
      height: TARGET_MIN,
      padding: 2,
      border: `1px solid ${outline}`,
      borderRadius: "50%",
      background: "transparent",
      cursor: "pointer",
    }),
    rule(".yw-row", {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: s3,
      minHeight: TARGET_MIN,
    }),
    rule(".yw-segmented", {
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: "1fr",
      gap: s1,
    }),
    rule(".yw-segmented .yw-choice", {
      justifyContent: "center",
      minHeight: TARGET_MIN,
    }),
    rule(".yw-switch", {
      appearance: "none",
      position: "relative",
      flexShrink: 0,
      width: 52,
      height: 32,
      margin: 0,
      borderRadius: 999,
      border: `2px solid ${outline}`,
      background: highest,
      cursor: "pointer",
      transition: transition("background-color, border-color"),
    }),
    rule(".yw-switch::before", {
      content: '""',
      position: "absolute",
      top: 6,
      left: 6,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: outline,
      transition: transition(
        "transform, background-color, width, height, top, left",
      ),
    }),
    rule(".yw-switch:checked", { background: primary, borderColor: primary }),
    rule(".yw-switch:checked::before", {
      top: 2,
      left: 2,
      width: 24,
      height: 24,
      transform: "translateX(20px)",
      background: onPrimary,
    }),

    // Undo toast (F04).
    rule(".yw-toast", {
      position: "fixed",
      zIndex: 40,
      left: "50%",
      bottom: s5,
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: s3,
      maxWidth: "calc(100vw - 32px)",
      minHeight: 48,
      padding: `${px(s1)} ${px(s1)} ${px(s1)} ${px(s4)}`,
      borderRadius: 12,
      background: inverseSurface,
      color: inverseOnSurface,
      boxShadow: shadowPop,
    }),
    rule(".yw-toast .yw-button", {
      color: inversePrimary,
      borderColor: "transparent",
    }),
    rule(".yw-toast .yw-icon-button", { color: inverseOnSurface }),

    // Footer and the customize button.
    rule(".yw-footer", {
      position: "fixed",
      left: s4,
      bottom: s4,
      maxWidth: "calc(100vw - 200px)",
      padding: `${px(s2)} ${px(s3)}`,
      borderRadius: 999,
      ...t("label"),
      color: onSurfaceVariant,
    }),
    rule(".yw-customize", {
      position: "fixed",
      right: s4,
      bottom: s4,
      background: container,
      boxShadow: shadowField,
    }),

    // Popup.
    rule(".yw-popup", {
      display: "flex",
      flexDirection: "column",
      gap: s4,
      width: 340,
      padding: s4,
    }),
    rule(".yw-popup .yw-brand", { ...t("title"), padding: 0 }),
    rule(".yw-popup-title", { margin: 0, ...t("title") }),
    rule(".yw-actions", { display: "flex", gap: s2 }),
    rule(".yw-actions .yw-button", { flex: 1 }),

    block("@media (max-width: 600px)", [
      rule(".yw-page", { paddingTop: GRID * 6, gap: s5 }),
      rule(".yw-brand", { ...t("title") }),
      rule(".yw-tiles", {
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
      }),
      rule(".yw-footer", { display: "none" }),
      rule(".yw-page", { paddingBottom: s5 }),
      rule(".yw-customize", {
        position: "static",
        display: "flex",
        margin: `0 auto ${px(s5)}`,
      }),
    ]),
    block("@media (prefers-reduced-motion: reduce)", [
      rule("*,*::before,*::after", {
        animationDuration: "0.01ms",
        animationIterationCount: 1,
        transitionDuration: "0.01ms",
        scrollBehavior: "auto",
      }),
    ]),
    block("@media (forced-colors: active)", [
      rule(".yw-search-field,.yw-tile,.yw-card,.yw-choice", {
        border: "1px solid CanvasText",
      }),
      rule(".yw-switch:checked", { background: "Highlight" }),
    ]),
  ].join("\n");
}
