// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Interface icons drawn for this page on a 24-unit grid with 1.75-unit round
 * strokes (see `.yw-icon`). Each is a single path so they inherit
 * `currentColor` and scale with the text. Decorative: always `aria-hidden`;
 * the button or row that holds one carries the accessible name.
 */
import { h } from "../../dom.ts";

const PATHS = {
  search: "M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13ZM15.2 15.2L20 20",
  close: "M6 6L18 18M18 6L6 18",
  arrow: "M5 12H19M13 6L19 12L13 18",
  plus: "M12 5V19M5 12H19",
  more: "M12 5a1 1 0 1 1 0 2a1 1 0 0 1 0-2ZM12 11a1 1 0 1 1 0 2a1 1 0 0 1 0-2ZM12 17a1 1 0 1 1 0 2a1 1 0 0 1 0-2Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  remove: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  left: "M15 5L8 12L15 19",
  right: "M9 5L16 12L9 19",
  history: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4.5l3 2",
  page: "M6 3.5h8l4 4V20.5H6ZM14 3.5V8h4",
  customize: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  image:
    "M4 5h16v14H4ZM4 16l5-5l4 4l2-2l5 5M15.5 8.5a1 1 0 1 1 0 2a1 1 0 0 1 0-2Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon(props: { name: IconName; size?: number }): Node {
  const size = props.size ?? 20;
  return (
    <svg
      class="yw-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[props.name]} />
    </svg>
  );
}
