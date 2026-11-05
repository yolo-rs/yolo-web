// SPDX-License-Identifier: Apache-2.0
/**
 * The YOLO-Web mark as vector geometry in a 64-unit square: a rounded tile
 * with a vertical Google-blue gradient and a white "Y" drawn from three
 * round-capped strokes. The PNG icons and the inline SVG logo share it.
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
  cornerRadius: 14,
  /** Vertical gradient of the tile, top to bottom (Google blue 600 to 900). */
  gradient: ["#1a73e8", "#174ea6"] as const,
  /** Stroke color of the mark. */
  stroke: "#ffffff",
  /** Stroke width, in design units. */
  strokeWidth: 7,
  /** The three strokes of the "Y": two arms meeting at the fork, one stem. */
  segments: [
    { from: { x: 18, y: 18 }, to: { x: 32, y: 33 } },
    { from: { x: 46, y: 18 }, to: { x: 32, y: 33 } },
    { from: { x: 32, y: 33 }, to: { x: 32, y: 50 } },
  ] as readonly Segment[],
} as const;

/** SVG path data for the strokes of the mark. */
export function markPath(): string {
  return MARK.segments
    .map(({ from, to }) => `M${from.x} ${from.y}L${to.x} ${to.y}`)
    .join("");
}
