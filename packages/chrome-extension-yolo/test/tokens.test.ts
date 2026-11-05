// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  contrastRatio,
  isHexColor,
  mix,
  relativeLuminance,
  withAlpha,
} from "../src/color.ts";
import { rolesFor } from "../src/newtab/scheme.ts";
import { block, buildStyleSheet, rule, themeVariables } from "../src/styles.ts";
import {
  DEFAULT_SEED,
  DEFAULT_THEME_ID,
  FONT_FILE,
  FONT_LICENSE_FILE,
  FONT_STACK,
  GRID,
  SEED_SWATCHES,
  THEME_IDS,
  THEMES,
  isThemeId,
  themeById,
} from "../src/tokens.ts";
import { PACKAGE_ROOT } from "./helpers.ts";

describe("color", () => {
  test("WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 6);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
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
  test("eight theme ids, matching the yolo-chromium --theme names", () => {
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
    expect(THEMES.map((theme) => theme.id)).toEqual([...THEME_IDS]);
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
    expect(isThemeId(DEFAULT_THEME_ID)).toBe(true);
    expect(isThemeId("solarized")).toBe(false);
  });

  test("colors are six-digit lowercase hex", () => {
    expect(isHexColor(DEFAULT_SEED)).toBe(true);
    for (const swatch of SEED_SWATCHES) {
      expect(isHexColor(swatch.hex)).toBe(true);
    }
    for (const theme of THEMES) {
      for (const value of Object.values(theme.chrome ?? {})) {
        expect({ theme: theme.id, value, ok: isHexColor(value) }).toEqual({
          theme: theme.id,
          value,
          ok: true,
        });
      }
    }
  });

  test("seed themes follow the device; brand themes are fixed", () => {
    expect(themeById("default").scheme).toBeUndefined();
    expect(themeById("neutral").scheme).toBeUndefined();
    for (const id of ["m3", "fluent", "apple"] as const) {
      expect(themeById(id).scheme).toBe("light");
    }
    for (const id of ["omarchy", "hyprland", "aphrody"] as const) {
      expect(themeById(id).scheme).toBe("dark");
    }
  });

  test("shapes are whole pixels", () => {
    expect(GRID).toBe(8);
    for (const theme of THEMES) {
      for (const radius of Object.values(theme.shape)) {
        expect(Number.isInteger(radius)).toBe(true);
        expect(radius).toBeGreaterThanOrEqual(0);
      }
      expect(theme.blur).toBeGreaterThanOrEqual(0);
    }
  });

  test("the font is self-hosted with its OFL license", async () => {
    expect(FONT_STACK.startsWith('"Instrument Sans"')).toBe(true);
    expect(FONT_STACK).not.toMatch(/url\(|@import|https?:|Inter|Roboto|Arial/);
    const font = Bun.file(join(PACKAGE_ROOT, "assets", FONT_FILE));
    expect(await font.exists()).toBe(true);
    const head = new Uint8Array(await font.slice(0, 4).arrayBuffer());
    expect([...head]).toEqual([0, 1, 0, 0]); // TrueType
    const license = await Bun.file(
      join(PACKAGE_ROOT, "assets", FONT_LICENSE_FILE),
    ).text();
    expect(license).toContain("SIL Open Font License, Version 1.1");
    expect(license).toContain("Instrument Sans Project Authors");
  });

  test("the style sheet is generated from rules, roles only, no remote URLs", () => {
    expect(rule(".a", { display: "flex", gap: GRID, lineHeight: 1.5 })).toBe(
      ".a{display:flex;gap:8px;line-height:1.5}",
    );
    expect(block("@media (x)", [rule(".a", { opacity: 0 })])).toBe(
      "@media (x){.a{opacity:0}}",
    );
    const css = buildStyleSheet();
    for (const selector of [
      ".yw-search-field{",
      ".yw-listbox{",
      ".yw-tile{",
      ".yw-panel{",
      ".yw-dialog{",
      ".yw-toast{",
      ".yw-card{",
      ".yw-popup{",
    ]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("var(--yw-primary)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(
      ":focus-visible{outline:2px solid var(--yw-focus-ring)",
    );
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/url\(|@import|https?:/);
    // No raw hex colors: components read semantic custom properties.
    expect(css.match(/#[0-9a-f]{6}\b/g) ?? []).toEqual([]);
  });

  test("theme variables carry every role and the preset shape", () => {
    const hyprland = themeById("hyprland");
    const vars = themeVariables(
      hyprland,
      rolesFor(hyprland, DEFAULT_SEED, "dark"),
    );
    expect(vars["--yw-field-border"]).toBe(
      "linear-gradient(45deg, #33ccff, #00ff99)",
    );
    expect(vars["--yw-surface"]).toBe("#1e1e2e");
    expect(vars["--yw-on-surface"]).toBe("#cdd6f4");
    const apple = themeById("apple");
    expect(
      themeVariables(apple, rolesFor(apple, DEFAULT_SEED, "light"))[
        "--yw-blur"
      ],
    ).toBe("24px");
  });
});
