// SPDX-License-Identifier: Apache-2.0
/**
 * sRGB color helpers: six-digit hex parsing, WCAG 2.2 relative luminance and
 * contrast ratio (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio).
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/** True for lowercase `#rrggbb` strings, the only color form tokens use. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

export function parseHex(hex: string): Rgb {
  if (!isHexColor(hex)) {
    throw new Error(`invalid hex color: ${String(hex)}`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function toHex({ r, g, b }: Rgb): string {
  const pair = (channel: number) =>
    clampByte(channel).toString(16).padStart(2, "0");
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function linearChannel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b)
  );
}

/** WCAG contrast ratio in [1, 21]; order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Linear sRGB-space mix of `a` toward `b` by `t` in [0, 1]. */
export function mix(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  return toHex({
    r: from.r + (to.r - from.r) * k,
    g: from.g + (to.g - from.g) * k,
    b: from.b + (to.b - from.b) * k,
  });
}

/** CSS `rgb()` color with an alpha channel, for soft tints and focus rings. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${Math.min(1, Math.max(0, alpha))})`;
}
