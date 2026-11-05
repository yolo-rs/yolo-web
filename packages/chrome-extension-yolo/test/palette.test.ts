// SPDX-License-Identifier: Apache-2.0
/**
 * HCT port fidelity, tonal palettes, scheme generation and WCAG 2.2 AA
 * contrast for every theme, scheme and a sweep of seeds; and parity of the
 * brand presets with crates/yolo-chromium/src/theme.rs.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { contrastRatio } from "../src/color.ts";
import {
  hct,
  hctFromHex,
  solveToHex,
  tonalPalette,
} from "../src/newtab/hct.ts";
import {
  AA_NON_TEXT,
  AA_TEXT,
  type ColorRoles,
  ensureContrast,
  resolveScheme,
  rolesFor,
  SURFACE_ROLES,
  schemeFromSeed,
} from "../src/newtab/scheme.ts";
import {
  DEFAULT_SEED,
  SEED_SWATCHES,
  THEMES,
  themeById,
} from "../src/tokens.ts";
import { PACKAGE_ROOT } from "./helpers.ts";

describe("HCT", () => {
  test("matches material-color-utilities for #6750a4", () => {
    // Hct.fromInt(0xff6750a4) in @material/material-color-utilities 0.4.0,
    // the same reference values yolo-tokens pins in hct.rs.
    const color = hctFromHex("#6750a4");
    expect(color.hue).toBeCloseTo(298.980997210704, 9);
    expect(color.chroma).toBeCloseTo(47.8565263749703, 9);
    expect(color.tone).toBeCloseTo(40.08324408746242, 9);
  });

  test("the baseline primary palette is bit-identical to M3", () => {
    // yolo-tokens PRIMARY_BASELINE (tonal.rs), tones 0..100.
    const expected = [
      "#000000",
      "#22005d",
      "#381e72",
      "#4f378a",
      "#6750a4",
      "#8069bf",
      "#9a83db",
      "#b69df8",
      "#cfbcff",
      "#e9ddff",
      "#f6eeff",
      "#fffbff",
      "#ffffff",
    ];
    // CorePalette uses max(48, source chroma) for primary: 47.86 -> 48.
    const source = hctFromHex("#6750a4");
    const palette = tonalPalette(source.hue, Math.max(48, source.chroma));
    const tones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
    expect(tones.map((tone) => palette.tone(tone))).toEqual(expected);
  });

  test("displayable colors round-trip exactly", () => {
    for (const hex of [
      "#6750a4",
      "#1a73e8",
      "#2499ff",
      "#ff0000",
      "#00ff00",
      "#0000ff",
      DEFAULT_SEED,
    ]) {
      const color = hctFromHex(hex);
      expect(solveToHex(color.hue, color.chroma, color.tone)).toBe(hex);
    }
  });

  test("out-of-gamut chroma is clipped at the requested hue and tone", () => {
    const clipped = hct(282, 200, 40);
    expect(clipped.chroma).toBeLessThan(200);
    expect(Math.abs(clipped.tone - 40)).toBeLessThan(0.5);
    expect(Math.abs(clipped.hue - 282)).toBeLessThan(2);
    expect(solveToHex(0, 0, 0)).toBe("#000000");
    expect(solveToHex(120, 40, 100)).toBe("#ffffff");
  });

  test("tones are monotonic in lightness", () => {
    const palette = tonalPalette(hctFromHex(DEFAULT_SEED).hue, 36);
    let previous = -1;
    for (let tone = 0; tone <= 100; tone += 5) {
      const l = hctFromHex(palette.tone(tone)).tone;
      expect(l).toBeGreaterThan(previous);
      previous = l;
    }
  });
});

const TEXT_PAIRS: ReadonlyArray<
  readonly [keyof ColorRoles, readonly (keyof ColorRoles)[]]
> = [
  ["onSurface", SURFACE_ROLES],
  ["onSurfaceVariant", SURFACE_ROLES],
  ["primary", SURFACE_ROLES],
  ["error", SURFACE_ROLES],
  ["onPrimary", ["primary"]],
  ["onSecondaryContainer", ["secondaryContainer"]],
  ["inverseOnSurface", ["inverseSurface"]],
  ["inversePrimary", ["inverseSurface"]],
];

function failures(label: string, roles: ColorRoles): string[] {
  const out: string[] = [];
  for (const [text, backgrounds] of TEXT_PAIRS) {
    for (const bg of backgrounds) {
      const ratio = contrastRatio(roles[text], roles[bg]);
      if (ratio < AA_TEXT) {
        out.push(`${label} ${text}/${bg} ${ratio.toFixed(2)}`);
      }
    }
  }
  for (const bg of SURFACE_ROLES) {
    const ratio = contrastRatio(roles.outline, roles[bg]);
    if (ratio < AA_NON_TEXT) {
      out.push(`${label} outline/${bg} ${ratio.toFixed(2)}`);
    }
  }
  return out;
}

describe("schemes", () => {
  test("every theme in every scheme meets WCAG 2.2 AA", () => {
    const problems: string[] = [];
    for (const theme of THEMES) {
      for (const scheme of ["light", "dark"] as const) {
        const resolved = resolveScheme(theme, scheme, false);
        problems.push(
          ...failures(
            `${theme.id}/${resolved}`,
            rolesFor(theme, DEFAULT_SEED, resolved),
          ),
        );
      }
    }
    expect(problems).toEqual([]);
  });

  test("a sweep of 74 seeds stays AA in light and dark", () => {
    const problems: string[] = [];
    const seeds = [
      ...SEED_SWATCHES.map((swatch) => swatch.hex),
      "#ffff00",
      "#00ffff",
      "#ff00ff",
      "#ffffff",
      "#000000",
      "#808080",
    ];
    for (let hue = 0; hue < 360; hue += 6) {
      seeds.push(hct(hue, 60, 50).hex);
    }
    expect(seeds.length).toBe(74);
    for (const seed of seeds) {
      for (const scheme of ["light", "dark"] as const) {
        problems.push(
          ...failures(`${seed}/${scheme}`, schemeFromSeed(seed, scheme)),
        );
      }
    }
    expect(problems).toEqual([]);
  });

  test("seed schemes keep the seed hue in primary", () => {
    for (const swatch of SEED_SWATCHES) {
      const seedHue = hctFromHex(swatch.hex).hue;
      const primary = hctFromHex(schemeFromSeed(swatch.hex, "light").primary);
      const delta = Math.abs(((primary.hue - seedHue + 540) % 360) - 180);
      expect({ seed: swatch.hex, close: delta < 8 }).toEqual({
        seed: swatch.hex,
        close: true,
      });
    }
  });

  test("neutral is achromatic", () => {
    const roles = rolesFor(themeById("neutral"), "#c2416b", "light");
    for (const [role, value] of Object.entries(roles)) {
      if (role === "error") {
        continue;
      }
      // Equal channels: true greys (CAM16 reports a small residual chroma).
      const [r, g, b] = [1, 3, 5].map((i) => value.slice(i, i + 2));
      expect({ role, grey: r === g && g === b }).toEqual({ role, grey: true });
    }
  });

  test("device mode switches seed themes and leaves brand themes alone", () => {
    expect(resolveScheme(themeById("default"), "device", true)).toBe("dark");
    expect(resolveScheme(themeById("default"), "device", false)).toBe("light");
    expect(resolveScheme(themeById("default"), "dark", false)).toBe("dark");
    expect(resolveScheme(themeById("apple"), "dark", true)).toBe("light");
    expect(resolveScheme(themeById("aphrody"), "light", false)).toBe("dark");
  });

  test("ensureContrast only moves colors that fail, and keeps the hue", () => {
    expect(ensureContrast("#000000", ["#ffffff"], 4.5)).toBe("#000000");
    const fixed = ensureContrast("#007aff", ["#f6f6f6"], 4.5);
    expect(contrastRatio(fixed, "#f6f6f6")).toBeGreaterThanOrEqual(4.5);
    expect(
      Math.abs(hctFromHex(fixed).hue - hctFromHex("#007aff").hue),
    ).toBeLessThan(4);
  });
});

describe("parity with yolo-chromium --theme", () => {
  test("brand presets use the same five colors as theme.rs", async () => {
    const source = await Bun.file(
      join(
        PACKAGE_ROOT,
        "..",
        "..",
        "crates",
        "yolo-chromium",
        "src",
        "theme.rs",
      ),
    ).text();
    const hex = "0x([0-9A-Fa-f]{8})";
    const pattern = new RegExp(
      `palette\\(\\s*"([a-z0-9]+)",\\s*${hex},\\s*${hex},\\s*${hex},\\s*${hex},\\s*${hex},?\\s*\\)`,
      "g",
    );
    const presets = new Map<string, string[]>();
    for (const match of source.matchAll(pattern)) {
      presets.set(
        match[1] ?? "",
        match.slice(2, 7).map((argb) => `#${argb.slice(2).toLowerCase()}`),
      );
    }
    expect([...presets.keys()].sort()).toEqual([
      "aphrody",
      "apple",
      "fluent",
      "hyprland",
      "m3",
      "omarchy",
    ]);
    for (const [name, colors] of presets) {
      const [frame, surface, field, text, accent] = colors;
      const theme = THEMES.find((candidate) => candidate.id === name);
      if (!theme?.scheme) {
        throw new Error(`preset ${name} missing in tokens.ts`);
      }
      expect(theme.chrome as unknown).toEqual({
        frame,
        surface,
        field,
        text,
        accent,
      });
      const roles = rolesFor(theme, DEFAULT_SEED, theme.scheme);
      // The page background, text and field are exactly the browser's.
      expect(roles.surface).toBe(surface ?? "");
      expect(roles.onSurface).toBe(text ?? "");
      expect(roles.surfaceContainer).toBe(field ?? "");
    }
    expect(source).toContain('"neutral" | "chromium" | "google" | "default"');
  });
});
