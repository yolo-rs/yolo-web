// SPDX-License-Identifier: Apache-2.0
/**
 * HCT color space (hue and chroma from CAM16, tone from CIE L*) and tonal
 * palettes.
 *
 * Port of `crates/yolo-tokens/src/{color_math,cam16,hct}.rs` from yolo-ui,
 * which is itself an exact port of `utils/color_utils.ts`, `hct/cam16.ts`,
 * `hct/viewing_conditions.ts`, `hct/hct_solver.ts` and
 * `palettes/tonal_palette.ts` from material-color-utilities
 * (https://github.com/material-foundation/material-color-utilities),
 * Copyright 2021-2022 Google LLC, licensed under the Apache License 2.0.
 * Changes: TypeScript module without classes for the solver, the critical
 * plane table is computed at load time instead of being inlined, colors are
 * exchanged as `#rrggbb` strings, and only the parts the new tab page needs
 * (no quantizer, no scorer, no dynamic color engine) are kept.
 */

type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];

// ---------------------------------------------------------------- color math

const SRGB_TO_XYZ: Mat3 = [
  [0.41233895, 0.35762064, 0.18051042],
  [0.2126, 0.7152, 0.0722],
  [0.01932141, 0.11916382, 0.95034478],
];

const WHITE_POINT_D65: Vec3 = [95.047, 100.0, 108.883];

function matrixMultiply(row: Vec3, matrix: Mat3): [number, number, number] {
  return [
    row[0] * matrix[0][0] + row[1] * matrix[0][1] + row[2] * matrix[0][2],
    row[0] * matrix[1][0] + row[1] * matrix[1][1] + row[2] * matrix[1][2],
    row[0] * matrix[2][0] + row[1] * matrix[2][1] + row[2] * matrix[2][2],
  ];
}

function signum(x: number): number {
  return x < 0 ? -1 : x === 0 ? 0 : 1;
}

function lerp(start: number, stop: number, amount: number): number {
  return (1 - amount) * start + amount * stop;
}

export function sanitizeDegrees(degrees: number): number {
  const d = degrees % 360;
  return d < 0 ? d + 360 : d;
}

/** sRGB component 0..255 to linear 0..100. */
function linearized(component: number): number {
  const normalized = component / 255;
  return normalized <= 0.040449936
    ? (normalized / 12.92) * 100
    : ((normalized + 0.055) / 1.055) ** 2.4 * 100;
}

/** Linear 0..100 to sRGB 0..255, unrounded. */
function trueDelinearized(component: number): number {
  const normalized = component / 100;
  const delinearized =
    normalized <= 0.0031308
      ? normalized * 12.92
      : 1.055 * normalized ** (1 / 2.4) - 0.055;
  return delinearized * 255;
}

function delinearized(component: number): number {
  return Math.min(255, Math.max(0, Math.round(trueDelinearized(component))));
}

function labF(t: number): number {
  const e = 216 / 24389;
  const kappa = 24389 / 27;
  return t > e ? t ** (1 / 3) : (kappa * t + 16) / 116;
}

function labInvf(ft: number): number {
  const e = 216 / 24389;
  const kappa = 24389 / 27;
  const ft3 = ft * ft * ft;
  return ft3 > e ? ft3 : (116 * ft - 16) / kappa;
}

export function yFromLstar(lstar: number): number {
  return 100 * labInvf((lstar + 16) / 116);
}

interface Rgb8 {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function rgbFromHex(hex: string): Rgb8 {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`invalid hex color: ${hex}`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function hexFromRgb(r: number, g: number, b: number): string {
  const pair = (c: number) => c.toString(16).padStart(2, "0");
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

function hexFromLinrgb(linrgb: Vec3): string {
  return hexFromRgb(
    delinearized(linrgb[0]),
    delinearized(linrgb[1]),
    delinearized(linrgb[2]),
  );
}

function hexFromLstar(lstar: number): string {
  const c = delinearized(yFromLstar(lstar));
  return hexFromRgb(c, c, c);
}

/** CIE L* of a color, 0..100. */
export function lstarFromHex(hex: string): number {
  const { r, g, b } = rgbFromHex(hex);
  const y = matrixMultiply(
    [linearized(r), linearized(g), linearized(b)],
    SRGB_TO_XYZ,
  )[1];
  return 116 * labF(y / 100) - 16;
}

// ------------------------------------------------------- viewing conditions

interface ViewingConditions {
  readonly n: number;
  readonly aw: number;
  readonly nbb: number;
  readonly ncb: number;
  readonly c: number;
  readonly nc: number;
  readonly rgbD: Vec3;
  readonly fl: number;
  readonly flRoot: number;
  readonly z: number;
}

function makeViewingConditions(
  whitePoint: Vec3,
  adaptingLuminance: number,
  backgroundLstar: number,
  surround: number,
  discountingIlluminant: boolean,
): ViewingConditions {
  const [x, y, z0] = whitePoint;
  const rW = x * 0.401288 + y * 0.650173 + z0 * -0.051461;
  const gW = x * -0.250268 + y * 1.204414 + z0 * 0.045854;
  const bW = x * -0.002079 + y * 0.048952 + z0 * 0.953127;
  const f = 0.8 + surround / 10;
  const c =
    f >= 0.9
      ? lerp(0.59, 0.69, (f - 0.9) * 10)
      : lerp(0.525, 0.59, (f - 0.8) * 10);
  let d = discountingIlluminant
    ? 1
    : f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92));
  d = Math.min(1, Math.max(0, d));
  const nc = f;
  const rgbD: Vec3 = [
    d * (100 / rW) + 1 - d,
    d * (100 / gW) + 1 - d,
    d * (100 / bW) + 1 - d,
  ];
  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k * k * k * k;
  const k4f = 1 - k4;
  const fl =
    k4 * adaptingLuminance + 0.1 * k4f * k4f * Math.cbrt(5 * adaptingLuminance);
  const n = yFromLstar(backgroundLstar) / whitePoint[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / n ** 0.2;
  const ncb = nbb;
  const factors = [
    ((fl * rgbD[0] * rW) / 100) ** 0.42,
    ((fl * rgbD[1] * gW) / 100) ** 0.42,
    ((fl * rgbD[2] * bW) / 100) ** 0.42,
  ];
  const rgbA = factors.map((value) => (400 * value) / (value + 27.13));
  const aw = (2 * rgbA[0]! + rgbA[1]! + 0.05 * rgbA[2]!) * nbb;
  return { n, aw, nbb, ncb, c, nc, rgbD, fl, flRoot: fl ** 0.25, z };
}

/** D65 white, background at L* 50, average surround (the MCU defaults). */
const VC = makeViewingConditions(
  WHITE_POINT_D65,
  ((200 / Math.PI) * yFromLstar(50)) / 100,
  50,
  2,
  false,
);

// --------------------------------------------------------------------- CAM16

interface Cam16 {
  readonly hue: number;
  readonly chroma: number;
}

function cam16FromHex(hex: string): Cam16 {
  const { r, g, b } = rgbFromHex(hex);
  const redL = linearized(r);
  const greenL = linearized(g);
  const blueL = linearized(b);
  const x = 0.41233895 * redL + 0.35762064 * greenL + 0.18051042 * blueL;
  const y = 0.2126 * redL + 0.7152 * greenL + 0.0722 * blueL;
  const z = 0.01932141 * redL + 0.11916382 * greenL + 0.95034478 * blueL;

  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;
  const rD = VC.rgbD[0] * rC;
  const gD = VC.rgbD[1] * gC;
  const bD = VC.rgbD[2] * bC;
  const rAF = ((VC.fl * Math.abs(rD)) / 100) ** 0.42;
  const gAF = ((VC.fl * Math.abs(gD)) / 100) ** 0.42;
  const bAF = ((VC.fl * Math.abs(bD)) / 100) ** 0.42;
  const rA = (signum(rD) * 400 * rAF) / (rAF + 27.13);
  const gA = (signum(gD) * 400 * gAF) / (gAF + 27.13);
  const bA = (signum(bD) * 400 * bAF) / (bAF + 27.13);
  const a = (11 * rA + -12 * gA + bA) / 11;
  const bb = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;
  const hue = sanitizeDegrees((Math.atan2(bb, a) * 180) / Math.PI);
  const ac = p2 * VC.nbb;
  const j = 100 * (ac / VC.aw) ** (VC.c * VC.z);
  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
  const p1 = (50000 / 13) * eHue * VC.nc * VC.ncb;
  const t = (p1 * Math.sqrt(a * a + bb * bb)) / (u + 0.305);
  const alpha = t ** 0.9 * (1.64 - 0.29 ** VC.n) ** 0.73;
  const chroma = alpha * Math.sqrt(j / 100);
  return { hue, chroma };
}

// ---------------------------------------------------------------- HCT solver

const SCALED_DISCOUNT_FROM_LINRGB: Mat3 = [
  [0.001200833568784504, 0.002389694492170889, 0.0002795742885861124],
  [0.0005891086651375999, 0.0029785502573438758, 0.0003270666104008398],
  [0.00010146692491640572, 0.0005364214359186694, 0.0032979401770712076],
];

const LINRGB_FROM_SCALED_DISCOUNT: Mat3 = [
  [1373.2198709594231, -1100.4251190754821, -7.278681089101213],
  [-271.815969077903, 559.6580465940733, -32.46047482791194],
  [1.9622899599665666, -57.173814538844006, 308.7233197812385],
];

const Y_FROM_LINRGB: Vec3 = [0.2126, 0.7152, 0.0722];

/**
 * Linear RGB value of every half step between 8-bit sRGB levels: the planes
 * where a rounded channel changes. The MCU source inlines these 255 values.
 */
const CRITICAL_PLANES: readonly number[] = Array.from(
  { length: 255 },
  (_, i) => {
    const normalized = (i + 0.5) / 255;
    return normalized <= 0.040449936
      ? (normalized / 12.92) * 100
      : ((normalized + 0.055) / 1.055) ** 2.4 * 100;
  },
);

function sanitizeRadians(angle: number): number {
  return (angle + Math.PI * 8) % (Math.PI * 2);
}

function chromaticAdaptation(component: number): number {
  const af = Math.abs(component) ** 0.42;
  return (signum(component) * 400 * af) / (af + 27.13);
}

function hueOf(linrgb: Vec3): number {
  const scaled = matrixMultiply(linrgb, SCALED_DISCOUNT_FROM_LINRGB);
  const rA = chromaticAdaptation(scaled[0]);
  const gA = chromaticAdaptation(scaled[1]);
  const bA = chromaticAdaptation(scaled[2]);
  const a = (11 * rA + -12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  return Math.atan2(b, a);
}

function areInCyclicOrder(a: number, b: number, c: number): boolean {
  return sanitizeRadians(b - a) < sanitizeRadians(c - a);
}

function lerpPoint(source: Vec3, t: number, target: Vec3): Vec3 {
  return [
    source[0] + (target[0] - source[0]) * t,
    source[1] + (target[1] - source[1]) * t,
    source[2] + (target[2] - source[2]) * t,
  ];
}

function setCoordinate(
  source: Vec3,
  coordinate: number,
  target: Vec3,
  axis: 0 | 1 | 2,
): Vec3 {
  const t = (coordinate - source[axis]) / (target[axis] - source[axis]);
  return lerpPoint(source, t, target);
}

function isBounded(x: number): boolean {
  return x >= 0 && x <= 100;
}

const NO_VERTEX: Vec3 = [-1, -1, -1];

function nthVertex(y: number, n: number): Vec3 {
  const [kR, kG, kB] = Y_FROM_LINRGB;
  const coordA = n % 4 <= 1 ? 0 : 100;
  const coordB = n % 2 === 0 ? 0 : 100;
  if (n < 4) {
    const g = coordA;
    const b = coordB;
    const r = (y - g * kG - b * kB) / kR;
    return isBounded(r) ? [r, g, b] : NO_VERTEX;
  }
  if (n < 8) {
    const b = coordA;
    const r = coordB;
    const g = (y - r * kR - b * kB) / kG;
    return isBounded(g) ? [r, g, b] : NO_VERTEX;
  }
  const r = coordA;
  const g = coordB;
  const b = (y - r * kR - g * kG) / kB;
  return isBounded(b) ? [r, g, b] : NO_VERTEX;
}

function bisectToSegment(y: number, targetHue: number): [Vec3, Vec3] {
  let left = NO_VERTEX;
  let right = NO_VERTEX;
  let leftHue = 0;
  let rightHue = 0;
  let initialized = false;
  let uncut = true;
  for (let n = 0; n < 12; n++) {
    const mid = nthVertex(y, n);
    if (mid[0] < 0) {
      continue;
    }
    const midHue = hueOf(mid);
    if (!initialized) {
      left = mid;
      right = mid;
      leftHue = midHue;
      rightHue = midHue;
      initialized = true;
      continue;
    }
    if (uncut || areInCyclicOrder(leftHue, midHue, rightHue)) {
      uncut = false;
      if (areInCyclicOrder(leftHue, targetHue, midHue)) {
        right = mid;
        rightHue = midHue;
      } else {
        left = mid;
        leftHue = midHue;
      }
    }
  }
  return [left, right];
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function bisectToLimit(y: number, targetHue: number): Vec3 {
  let [left, right] = bisectToSegment(y, targetHue);
  let leftHue = hueOf(left);
  for (const axis of [0, 1, 2] as const) {
    if (left[axis] === right[axis]) {
      continue;
    }
    let lPlane: number;
    let rPlane: number;
    if (left[axis] < right[axis]) {
      lPlane = Math.floor(trueDelinearized(left[axis]) - 0.5);
      rPlane = Math.ceil(trueDelinearized(right[axis]) - 0.5);
    } else {
      lPlane = Math.ceil(trueDelinearized(left[axis]) - 0.5);
      rPlane = Math.floor(trueDelinearized(right[axis]) - 0.5);
    }
    for (let i = 0; i < 8; i++) {
      if (Math.abs(rPlane - lPlane) <= 1) {
        break;
      }
      const mPlane = Math.floor((lPlane + rPlane) / 2);
      const coordinate =
        CRITICAL_PLANES[Math.min(254, Math.max(0, mPlane))] ?? 0;
      const mid = setCoordinate(left, coordinate, right, axis);
      const midHue = hueOf(mid);
      if (areInCyclicOrder(leftHue, targetHue, midHue)) {
        right = mid;
        rPlane = mPlane;
      } else {
        left = mid;
        leftHue = midHue;
        lPlane = mPlane;
      }
    }
  }
  return midpoint(left, right);
}

function inverseChromaticAdaptation(adapted: number): number {
  const adaptedAbs = Math.abs(adapted);
  const base = Math.max(0, (27.13 * adaptedAbs) / (400 - adaptedAbs));
  return signum(adapted) * base ** (1 / 0.42);
}

function findResultByJ(
  hueRadians: number,
  chroma: number,
  y: number,
): string | undefined {
  let j = Math.sqrt(y) * 11;
  const tInnerCoeff = 1 / (1.64 - 0.29 ** VC.n) ** 0.73;
  const eHue = 0.25 * (Math.cos(hueRadians + 2) + 3.8);
  const p1 = eHue * (50000 / 13) * VC.nc * VC.ncb;
  const hSin = Math.sin(hueRadians);
  const hCos = Math.cos(hueRadians);
  for (let round = 0; round < 5; round++) {
    const jNormalized = j / 100;
    const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(jNormalized);
    const t = (alpha * tInnerCoeff) ** (1 / 0.9);
    const ac = VC.aw * jNormalized ** (1 / VC.c / VC.z);
    const p2 = ac / VC.nbb;
    const gamma =
      (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
    const a = gamma * hCos;
    const b = gamma * hSin;
    const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
    const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
    const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
    const linrgb = matrixMultiply(
      [
        inverseChromaticAdaptation(rA),
        inverseChromaticAdaptation(gA),
        inverseChromaticAdaptation(bA),
      ],
      LINRGB_FROM_SCALED_DISCOUNT,
    );
    if (linrgb.some((c) => c < 0)) {
      return undefined;
    }
    const [kR, kG, kB] = Y_FROM_LINRGB;
    const fnj = kR * linrgb[0] + kG * linrgb[1] + kB * linrgb[2];
    if (fnj <= 0) {
      return undefined;
    }
    if (round === 4 || Math.abs(fnj - y) < 0.002) {
      if (linrgb.some((c) => c > 100.01)) {
        return undefined;
      }
      return hexFromLinrgb(linrgb);
    }
    j -= ((fnj - y) * j) / (2 * fnj);
  }
  return undefined;
}

/** The in-gamut sRGB color closest to the requested hue, chroma and tone. */
export function solveToHex(hue: number, chroma: number, tone: number): string {
  if (chroma < 0.0001 || tone < 0.0001 || tone > 99.9999) {
    return hexFromLstar(tone);
  }
  const hueRadians = (sanitizeDegrees(hue) / 180) * Math.PI;
  const y = yFromLstar(tone);
  return (
    findResultByJ(hueRadians, chroma, y) ??
    hexFromLinrgb(bisectToLimit(y, hueRadians))
  );
}

// ----------------------------------------------------------------------- HCT

export interface Hct {
  /** Hue angle in degrees, 0..360. */
  readonly hue: number;
  /** Chroma; its maximum depends on hue and tone. */
  readonly chroma: number;
  /** Tone (L*), 0..100. */
  readonly tone: number;
  /** The exact sRGB color of these coordinates. */
  readonly hex: string;
}

export function hctFromHex(hex: string): Hct {
  const normalized = hex.toLowerCase();
  const cam = cam16FromHex(normalized);
  return {
    hue: cam.hue,
    chroma: cam.chroma,
    tone: lstarFromHex(normalized),
    hex: normalized,
  };
}

export function hct(hue: number, chroma: number, tone: number): Hct {
  return hctFromHex(solveToHex(hue, chroma, tone));
}

// ------------------------------------------------------------ tonal palettes

/** A hue and chroma; `tone(t)` gives the color at any tone. */
export interface TonalPalette {
  readonly hue: number;
  readonly chroma: number;
  tone(tone: number): string;
}

export function tonalPalette(hue: number, chroma: number): TonalPalette {
  const cache = new Map<number, string>();
  return {
    hue,
    chroma,
    tone(tone: number): string {
      let hex = cache.get(tone);
      if (hex === undefined) {
        hex = solveToHex(hue, chroma, tone);
        cache.set(tone, hex);
      }
      return hex;
    },
  };
}
