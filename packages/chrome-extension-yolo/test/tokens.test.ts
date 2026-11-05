// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  contrastRatio,
  isHexColor,
  mix,
  relativeLuminance,
  withAlpha,
} from "../src/color.ts";
import { buildStyleSheet, rule, themeVariables } from "../src/styles.ts";
import {
  DEFAULT_THEME_ID,
  FONT_STACK,
  GRID,
  THEME_IDS,
  THEMES,
  isThemeId,
  themeById,
} from "../src/tokens.ts";

const AA_TEXT_CONTRAST = 4.5;

describe("color", () => {
  test("WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 6);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#1a73e8", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  test("hex helpers", () => {
    expect(isHexColor("#1a73e8")).toBe(true);
    expect(isHexColor("#1A73E8")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(withAlpha("#1a73e8", 0.16)).toBe("rgb(26 115 232 / 0.16)");
    expect(() => relativeLuminance("blue")).toThrow();
  });
});

describe("design tokens", () => {
  test("theme ids are unique and include the default", () => {
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
    expect(THEMES.map((theme) => theme.id)).toEqual([...THEME_IDS]);
    expect(isThemeId(DEFAULT_THEME_ID)).toBe(true);
    expect(isThemeId("solarized")).toBe(false);
    expect(themeById(DEFAULT_THEME_ID).colors.primary).toBe("#1a73e8");
    expect(THEME_IDS).toEqual([
      "default",
      "neutral",
      "m3",
      "fluent",
      "apple",
      "omarchy",
      "hyprland",
      "aphrody",
    ]);
  });

  test("colors are six-digit lowercase hex", () => {
    for (const theme of THEMES) {
      expect(isHexColor(theme.seed)).toBe(true);
      for (const [name, value] of Object.entries(theme.colors)) {
        expect({ theme: theme.id, name, valid: isHexColor(value) }).toEqual({
          theme: theme.id,
          name,
          valid: true,
        });
      }
    }
  });

  test("text on surfaces meets WCAG AA (4.5:1)", () => {
    const failures: string[] = [];
    for (const { id, colors } of THEMES) {
      const pairs: Array<[string, string, string]> = [
        ["onSurface/surface", colors.onSurface, colors.surface],
        ["onSurface/surfaceContainer", colors.onSurface, colors.surfaceContainer],
        ["onSurface/background", colors.onSurface, colors.background],
        ["onSurfaceVariant/surface", colors.onSurfaceVariant, colors.surface],
        [
          "onSurfaceVariant/surfaceVariant",
          colors.onSurfaceVariant,
          colors.surfaceVariant,
        ],
        ["onPrimary/primary", colors.onPrimary, colors.primary],
      ];
      for (const [label, text, surface] of pairs) {
        const ratio = contrastRatio(text, surface);
        if (ratio < AA_TEXT_CONTRAST) {
          failures.push(`${id} ${label} = ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("shapes and spacing follow the 8px grid", () => {
    expect(GRID).toBe(8);
    for (const theme of THEMES) {
      for (const radius of Object.values(theme.shape)) {
        expect(Number.isInteger(radius)).toBe(true);
        expect(radius).toBeGreaterThanOrEqual(0);
      }
      expect(theme.effects.blur).toBeGreaterThanOrEqual(0);
    }
  });

  test("fonts are local and no icon pack is referenced", () => {
    expect(FONT_STACK).toContain("system-ui");
    expect(FONT_STACK).not.toMatch(/url\(|@import|https?:/);
    const css = buildStyleSheet();
    expect(css).not.toMatch(/url\(|@import|@font-face/);
  });

  test("the style sheet is generated from typed rules", () => {
    expect(rule(".a", { display: "flex", gap: GRID, lineHeight: 1.5 })).toBe(
      ".a{display:flex;gap:8px;line-height:1.5}",
    );
    const css = buildStyleSheet();
    expect(css).toContain("var(--yw-primary)");
    expect(css).toContain(".yw-search{");
    expect(css).toContain(".yw-popup{");
    expect(css).not.toContain("!important");
    expect(themeVariables(themeById("default"))["--yw-primary"]).toBe(
      "#1a73e8",
    );
    expect(themeVariables(themeById("hyprland"))["--yw-border-gradient"]).toBe(
      "linear-gradient(45deg, #33ccff, #00ff99)",
    );
    expect(themeVariables(themeById("apple"))["--yw-blur"]).toBe("24px");
  });
});
