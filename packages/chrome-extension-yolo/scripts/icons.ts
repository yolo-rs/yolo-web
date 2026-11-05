// SPDX-License-Identifier: Apache-2.0
/**
 * Renders the brand mark to PNG at the Chrome icon sizes with an analytic
 * signed-distance rasterizer (rounded tile plus round-capped strokes),
 * 4x4 supersampled. Run directly to write the files:
 * `bun run scripts/icons.ts [outDir]`.
 */
import { join } from "node:path";
import { parseHex } from "../src/color.ts";
import { MARK, type Segment } from "../src/icon.ts";
import { encodePng } from "./png.ts";

export const ICON_SIZES = [16, 32, 48, 128] as const;

const SUPERSAMPLE = 4;

export function iconFileName(size: number): string {
  return `icon-${size}.png`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Signed distance to a square of half-size `half` with rounded corners. */
function roundedBoxDistance(
  x: number,
  y: number,
  half: number,
  radius: number,
): number {
  const qx = Math.abs(x) - half + radius;
  const qy = Math.abs(y) - half + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

/** Distance from a point to a line segment. */
function segmentDistance(x: number, y: number, { from, to }: Segment): number {
  const px = x - from.x;
  const py = y - from.y;
  const bx = to.x - from.x;
  const by = to.y - from.y;
  const t = clamp01((px * bx + py * by) / (bx * bx + by * by));
  return Math.hypot(px - bx * t, py - by * t);
}

/** Straight-alpha RGBA pixels of the mark at `size` x `size`. */
export function renderIconRgba(size: number): Uint8Array {
  const unitsPerPixel = MARK.size / size;
  const half = MARK.size / 2;
  const top = parseHex(MARK.gradient[0]);
  const bottom = parseHex(MARK.gradient[1]);
  const ink = parseHex(MARK.stroke);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const coverage = (distanceUnits: number): number =>
    clamp01(0.5 - distanceUnits / unitsPerPixel);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) * unitsPerPixel;
          const v = (y + (sy + 0.5) / SUPERSAMPLE) * unitsPerPixel;
          const tile = coverage(
            roundedBoxDistance(u - half, v - half, half, MARK.cornerRadius),
          );
          if (tile <= 0) {
            continue;
          }
          let strokeDistance = Number.POSITIVE_INFINITY;
          for (const segment of MARK.segments) {
            strokeDistance = Math.min(
              strokeDistance,
              segmentDistance(u, v, segment) - MARK.strokeWidth / 2,
            );
          }
          const stroke = coverage(strokeDistance);
          const t = v / MARK.size;
          const baseR = top.r + (bottom.r - top.r) * t;
          const baseG = top.g + (bottom.g - top.g) * t;
          const baseB = top.b + (bottom.b - top.b) * t;
          r += (baseR + (ink.r - baseR) * stroke) * tile;
          g += (baseG + (ink.g - baseG) * stroke) * tile;
          b += (baseB + (ink.b - baseB) * stroke) * tile;
          a += tile;
        }
      }
      if (a > 0) {
        const i = (y * size + x) * 4;
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
        rgba[i + 3] = Math.round((a / samples) * 255);
      }
    }
  }
  return rgba;
}

export function renderIconPng(size: number): Uint8Array {
  return encodePng(size, size, renderIconRgba(size));
}

/** Writes `icon-<size>.png` for every Chrome icon size into `outDir`. */
export async function writeIcons(outDir: string): Promise<string[]> {
  const files: string[] = [];
  for (const size of ICON_SIZES) {
    const path = join(outDir, iconFileName(size));
    await Bun.write(path, renderIconPng(size));
    files.push(path);
  }
  return files;
}

if (import.meta.main) {
  const outDir = Bun.argv[2] ?? join(import.meta.dir, "..", "dist", "icons");
  for (const file of await writeIcons(outDir)) {
    console.log(file);
  }
}
