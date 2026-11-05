// SPDX-License-Identifier: Apache-2.0
/**
 * The Aphrody mark as vector geometry in a 64-unit square: a rounded tile in
 * a deep violet gradient and a gold "A" drawn from three round-capped
 * strokes. The crossbar stops short of the right leg, which is what makes the
 * mark read as Aphrody's own and keeps it legible at 16 px. The PNG icons and
 * the inline SVG logo share this geometry. Colors are the `aphrody` preset of
 * `crates/yolo-chromium/src/theme.rs` (surface, field and accent).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Segment {
  readonly from: Point;
  readonly to: Point;
}

export const MARK = {
  /** Side of the design square. */
  size: 64,
  /** Corner radius of the tile, in design units. */
  cornerRadius: 16,
  /** Vertical gradient of the tile, top to bottom. */
  gradient: ["#3a2563", "#1c0f2b"] as const,
  /** Stroke color of the mark. */
  stroke: "#f2c14e",
  /** Stroke width, in design units. */
  strokeWidth: 6.5,
  /** Left leg, right leg, and the open crossbar of the "A". */
  segments: [
    { from: { x: 17, y: 50 }, to: { x: 32, y: 14 } },
    { from: { x: 32, y: 14 }, to: { x: 47, y: 50 } },
    { from: { x: 23, y: 37 }, to: { x: 36, y: 37 } },
  ] as readonly Segment[],
} as const;

/** SVG path data for the strokes of the mark. */
export function markPath(): string {
  return MARK.segments
    .map(({ from, to }) => `M${from.x} ${from.y}L${to.x} ${to.y}`)
    .join("");
}
