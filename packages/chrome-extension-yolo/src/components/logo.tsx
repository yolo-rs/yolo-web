// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
import { h } from "../dom.ts";
import { MARK, markPath } from "../icon.ts";

export interface LogoProps {
  /** Rendered size in CSS pixels. */
  size?: number;
  /** Unique suffix for the gradient id when several logos share a page. */
  id?: string;
}

/** Inline SVG of the YOLO-Web mark, drawn from the shared geometry. */
export function Logo(props: LogoProps): Node {
  const size = props.size ?? 32;
  const gradientId = `yw-mark-${props.id ?? "default"}`;
  const [top, bottom] = MARK.gradient;
  return (
    <svg
      viewBox={`0 0 ${MARK.size} ${MARK.size}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={top} />
          <stop offset="1" stop-color={bottom} />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width={MARK.size}
        height={MARK.size}
        rx={MARK.cornerRadius}
        fill={`url(#${gradientId})`}
      />
      <path
        d={markPath()}
        fill="none"
        stroke={MARK.stroke}
        stroke-width={MARK.strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
