/**
 * @yolo-web/servo-bridge
 *
 * Pure Bun/TypeScript bridge mirroring consolidated Servo Rust crates in `crates/servo-*`:
 * - `crates/servo-euclid` & `crates/yolo-browser` geometry primitives (`ServoEuclidPoint2D`, `ServoEuclidSize2D`, `ServoEuclidRect`, `ServoViewportScale`)
 * - `crates/servo-stylo/selectors` specificity & selector engine (`ServoSelectorEngine`, `SelectorSpecificity`)
 * - `crates/servo-xpath` XPath-to-CSS translation helpers
 * - `crates/servo-webvtt` W3C WebVTT cue parser & timing helpers
 * - `SERVO_CONSOLIDATED_CRATES` metadata registry for all 31 `crates/servo-*` crates
 */

export type EuclidUnitTag =
  "CssPixel" | "DevicePixel" | "WorldSpace" | "UnknownUnit";

/**
 * Mirrors `euclid::Point2D<f32, U>` from `crates/servo-euclid`.
 */
export class ServoEuclidPoint2D<U extends EuclidUnitTag = "CssPixel"> {
  readonly unit: U;
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number, unit: U = "CssPixel" as U) {
    this.x = x;
    this.y = y;
    this.unit = unit;
  }

  static origin<U extends EuclidUnitTag = "CssPixel">(
    unit: U = "CssPixel" as U,
  ): ServoEuclidPoint2D<U> {
    return new ServoEuclidPoint2D(0, 0, unit);
  }

  translate(dx: number, dy: number): ServoEuclidPoint2D<U> {
    return new ServoEuclidPoint2D(this.x + dx, this.y + dy, this.unit);
  }

  scale<Dst extends EuclidUnitTag = "DevicePixel">(
    factor: number,
    targetUnit: Dst = "DevicePixel" as Dst,
  ): ServoEuclidPoint2D<Dst> {
    return new ServoEuclidPoint2D(this.x * factor, this.y * factor, targetUnit);
  }

  distanceTo(other: ServoEuclidPoint2D<U>): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }
}

/**
 * Mirrors `euclid::Size2D<f32, U>` from `crates/servo-euclid`.
 */
export class ServoEuclidSize2D<U extends EuclidUnitTag = "CssPixel"> {
  readonly unit: U;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number, unit: U = "CssPixel" as U) {
    this.width = width;
    this.height = height;
    this.unit = unit;
  }

  static zero<U extends EuclidUnitTag = "CssPixel">(
    unit: U = "CssPixel" as U,
  ): ServoEuclidSize2D<U> {
    return new ServoEuclidSize2D(0, 0, unit);
  }

  area(): number {
    return this.width * this.height;
  }

  isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  scale<Dst extends EuclidUnitTag = "DevicePixel">(
    factor: number,
    targetUnit: Dst = "DevicePixel" as Dst,
  ): ServoEuclidSize2D<Dst> {
    return new ServoEuclidSize2D(
      this.width * factor,
      this.height * factor,
      targetUnit,
    );
  }

  round(): ServoEuclidSize2D<U> {
    return new ServoEuclidSize2D(
      Math.round(this.width),
      Math.round(this.height),
      this.unit,
    );
  }
}

/**
 * Mirrors `euclid::Rect<f32, U>` from `crates/servo-euclid`.
 */
export class ServoEuclidRect<U extends EuclidUnitTag = "CssPixel"> {
  readonly origin: ServoEuclidPoint2D<U>;
  readonly size: ServoEuclidSize2D<U>;

  constructor(origin: ServoEuclidPoint2D<U>, size: ServoEuclidSize2D<U>) {
    this.origin = origin;
    this.size = size;
  }

  static fromXYWH<U extends EuclidUnitTag = "CssPixel">(
    x: number,
    y: number,
    width: number,
    height: number,
    unit: U = "CssPixel" as U,
  ): ServoEuclidRect<U> {
    return new ServoEuclidRect(
      new ServoEuclidPoint2D(x, y, unit),
      new ServoEuclidSize2D(width, height, unit),
    );
  }

  get x(): number {
    return this.origin.x;
  }

  get y(): number {
    return this.origin.y;
  }

  get width(): number {
    return this.size.width;
  }

  get height(): number {
    return this.size.height;
  }

  maxX(): number {
    return this.origin.x + this.size.width;
  }

  maxY(): number {
    return this.origin.y + this.size.height;
  }

  center(): ServoEuclidPoint2D<U> {
    return new ServoEuclidPoint2D(
      this.origin.x + this.size.width / 2,
      this.origin.y + this.size.height / 2,
      this.origin.unit,
    );
  }

  contains(point: ServoEuclidPoint2D<U>): boolean {
    return (
      point.x >= this.origin.x &&
      point.x < this.maxX() &&
      point.y >= this.origin.y &&
      point.y < this.maxY()
    );
  }

  intersects(other: ServoEuclidRect<U>): boolean {
    return (
      this.origin.x < other.maxX() &&
      this.maxX() > other.origin.x &&
      this.origin.y < other.maxY() &&
      this.maxY() > other.origin.y
    );
  }

  scale<Dst extends EuclidUnitTag = "DevicePixel">(
    factor: number,
    targetUnit: Dst = "DevicePixel" as Dst,
  ): ServoEuclidRect<Dst> {
    return new ServoEuclidRect(
      this.origin.scale(factor, targetUnit),
      this.size.scale(factor, targetUnit),
    );
  }
}

/**
 * Mirrors `YoloViewport` and `euclid::Scale<f32, CssPixel, DevicePixel>` from `crates/yolo-browser`.
 */
export class ServoViewportScale {
  readonly widthCss: number;
  readonly heightCss: number;
  readonly devicePixelRatio: number;

  constructor(widthCss = 1280, heightCss = 800, devicePixelRatio = 1.0) {
    this.widthCss = widthCss;
    this.heightCss = heightCss;
    this.devicePixelRatio = Math.max(0.5, devicePixelRatio);
  }

  cssRect(): ServoEuclidRect<"CssPixel"> {
    return new ServoEuclidRect(
      ServoEuclidPoint2D.origin("CssPixel"),
      new ServoEuclidSize2D(this.widthCss, this.heightCss, "CssPixel"),
    );
  }

  physicalSize(): ServoEuclidSize2D<"DevicePixel"> {
    return new ServoEuclidSize2D(this.widthCss, this.heightCss, "CssPixel")
      .scale(this.devicePixelRatio, "DevicePixel")
      .round();
  }

  physicalRect(): ServoEuclidRect<"DevicePixel"> {
    return new ServoEuclidRect(
      ServoEuclidPoint2D.origin("DevicePixel"),
      this.physicalSize(),
    );
  }

  cssToDevicePoint(
    point: ServoEuclidPoint2D<"CssPixel">,
  ): ServoEuclidPoint2D<"DevicePixel"> {
    return point.scale(this.devicePixelRatio, "DevicePixel");
  }

  deviceToCssPoint(
    point: ServoEuclidPoint2D<"DevicePixel">,
  ): ServoEuclidPoint2D<"CssPixel"> {
    return point.scale(1 / this.devicePixelRatio, "CssPixel");
  }
}

/**
 * Specificity tuple matching `crates/servo-stylo/selectors/builder.rs`:
 * `(id_selectors, class_like_selectors, element_selectors)` packed into 10-bit lanes (`MAX_10BIT = 1023`).
 */
export interface SelectorSpecificity {
  readonly id: number;
  readonly class: number;
  readonly element: number;
  readonly packed: number;
}

export interface WebVttCueTiming {
  readonly identifier: string;
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
  readonly settings: Record<string, string>;
  readonly payload: string;
}

const MAX_10BIT = (1 << 10) - 1;

function packSpecificity(
  id: number,
  cls: number,
  element: number,
): SelectorSpecificity {
  const clampedId = Math.min(Math.max(0, id), MAX_10BIT);
  const clampedClass = Math.min(Math.max(0, cls), MAX_10BIT);
  const clampedElement = Math.min(Math.max(0, element), MAX_10BIT);
  const packed = (clampedId << 20) | (clampedClass << 10) | clampedElement;
  return {
    id: clampedId,
    class: clampedClass,
    element: clampedElement,
    packed,
  };
}

/**
 * Pure Bun/TypeScript helper utilities mirroring `crates/servo-stylo/selectors`,
 * `crates/servo-xpath`, and `crates/servo-webvtt`.
 */
export class ServoSelectorEngine {
  /**
   * Validates whether a CSS selector string is syntactically non-empty and balanced.
   */
  static validateSelector(selector: string): {
    valid: boolean;
    reason?: string;
  } {
    const trimmed = selector.trim();
    if (!trimmed) {
      return { valid: false, reason: "Empty selector string" };
    }

    let bracketDepth = 0;
    let parenDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      const prev = i > 0 ? trimmed[i - 1] : "";
      if (prev === "\\") continue;

      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (!inSingleQuote && !inDoubleQuote) {
        if (ch === "[") bracketDepth++;
        else if (ch === "]") bracketDepth--;
        else if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth--;

        if (bracketDepth < 0 || parenDepth < 0) {
          return { valid: false, reason: "Unbalanced closing delimiter" };
        }
      }
    }

    if (inSingleQuote || inDoubleQuote) {
      return { valid: false, reason: "Unclosed string literal" };
    }
    if (bracketDepth !== 0 || parenDepth !== 0) {
      return {
        valid: false,
        reason: "Unclosed attribute or pseudo-class delimiter",
      };
    }
    if (/^[>+~]|[>+~]$/.test(trimmed)) {
      return { valid: false, reason: "Leading or trailing combinator" };
    }

    return { valid: true };
  }

  /**
   * Calculates CSS selector specificity `(id, class, element)` and 30-bit packed value
   * matching `crates/servo-stylo/selectors/builder.rs`.
   */
  static calculateSpecificity(selector: string): SelectorSpecificity {
    const trimmed = selector.trim();
    if (!trimmed) {
      return packSpecificity(0, 0, 0);
    }

    // If comma-separated selector list, return the maximum specificity in the list
    if (trimmed.includes(",") && !trimmed.includes("(")) {
      let best = packSpecificity(0, 0, 0);
      for (const part of trimmed.split(",")) {
        const spec = ServoSelectorEngine.calculateSpecificity(part);
        if (spec.packed > best.packed) {
          best = spec;
        }
      }
      return best;
    }

    let idCount = 0;
    let classCount = 0;
    let elementCount = 0;

    // Strip :where(...) which has 0 specificity according to Selectors Level 4
    let working = trimmed.replace(/:where\([^)]*\)/gi, "");

    // Handle :is(...), :not(...), :has(...) by replacing with their most specific argument
    working = working.replace(
      /:(?:is|not|has|matches)\(([^)]*)\)/gi,
      (_match, inner: string) => {
        const args = inner.split(",");
        let maxSpec = packSpecificity(0, 0, 0);
        for (const arg of args) {
          const s = ServoSelectorEngine.calculateSpecificity(arg);
          if (s.packed > maxSpec.packed) {
            maxSpec = s;
          }
        }
        idCount += maxSpec.id;
        classCount += maxSpec.class;
        elementCount += maxSpec.element;
        return "";
      },
    );

    // Count attribute selectors [...] as class-like (+1 class) and strip them
    working = working.replace(/\[[^\]]*\]/g, () => {
      classCount += 1;
      return " ";
    });

    // Count pseudo-elements ::before, ::after, ::slotted, ::part, and legacy single-colon
    working = working.replace(/::[a-zA-Z-]+(?:\([^)]*\))?/g, () => {
      elementCount += 1;
      return " ";
    });
    working = working.replace(
      /:(?:before|after|first-line|first-letter)\b/gi,
      () => {
        elementCount += 1;
        return " ";
      },
    );

    // Count pseudo-classes :hover, :nth-child(...), etc. (+1 class)
    working = working.replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, () => {
      classCount += 1;
      return " ";
    });

    // Count ID selectors #id (+1 id)
    working = working.replace(/#[a-zA-Z0-9_-]+/g, () => {
      idCount += 1;
      return " ";
    });

    // Count class selectors .class (+1 class)
    working = working.replace(/\.[a-zA-Z0-9_-]+/g, () => {
      classCount += 1;
      return " ";
    });

    // Replace combinators and universal selector '*'
    working = working.replace(/[>+~*]/g, " ");

    // Remaining tokens are type/element selectors (e.g. div, button, main)
    const tokens = working
      .trim()
      .split(/\s+/)
      .filter((t) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(t));
    elementCount += tokens.length;

    return packSpecificity(idCount, classCount, elementCount);
  }

  /**
   * Unpacks a 30-bit `servo-stylo/selectors` specificity integer back into `(id, class, element)`.
   */
  static unpackSpecificity(packed: number): SelectorSpecificity {
    const id = (packed >>> 20) & MAX_10BIT;
    const cls = (packed >>> 10) & MAX_10BIT;
    const element = packed & MAX_10BIT;
    return { id, class: cls, element, packed };
  }

  /**
   * Converts common XPath 1.0 queries (compatible with `crates/servo-xpath`) into equivalent CSS3 selectors.
   */
  static xpathToCss(xpath: string): string {
    let expr = xpath.trim();
    if (!expr) return "*";

    // Normalize leading // or /
    expr = expr.replace(/^\/\/+/, "").replace(/^\/+/, "");

    // Convert [@id='foo'] or [@id="foo"] to #foo
    expr = expr.replace(/\[@id=['"]([^'"]+)['"]\]/g, "#$1");

    // Convert [contains(@class, 'bar')] or [@class='bar'] to .bar
    expr = expr.replace(
      /\[contains\(\s*@class\s*,\s*['"]([^'"]+)['"]\s*\)\]/g,
      ".$1",
    );
    expr = expr.replace(
      /\[@class=['"]([^'"]+)['"]\]/g,
      (_m, classes: string) => "." + classes.trim().split(/\s+/).join("."),
    );

    // Convert [@attr='val'] to [attr="val"] and [@attr] to [attr]
    expr = expr.replace(/\[@([a-zA-Z0-9_-]+)=['"]([^'"]+)['"]\]/g, '[$1="$2"]');
    expr = expr.replace(/\[@([a-zA-Z0-9_-]+)\]/g, "[$1]");

    // Convert [1], [2] positional predicates to :nth-of-type(n)
    expr = expr.replace(/\[(\d+)\]/g, ":nth-of-type($1)");

    // Convert descendant '//' to ' ' and child '/' to ' > '
    expr = expr.replace(/\/\//g, " ").replace(/\//g, " > ");

    return expr.trim().replace(/\s+/g, " ");
  }

  /**
   * Parses a W3C WebVTT timestamp (`HH:MM:SS.mmm` or `MM:SS.mmm`) into seconds,
   * matching `crates/servo-webvtt` timing collectors.
   */
  static parseWebVttTimestamp(raw: string): number {
    const match = raw
      .trim()
      .match(/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/);
    if (!match) {
      throw new Error(`Invalid WebVTT timestamp: "${raw}"`);
    }
    const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
    const minutes = Number.parseInt(match[2]!, 10);
    const seconds = Number.parseInt(match[3]!, 10);
    const millis = Number.parseInt(match[4]!, 10);
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  /**
   * Parses a WebVTT document string into structured cues matching `crates/servo-webvtt`.
   */
  static parseWebVttCues(input: string): WebVttCueTiming[] {
    const normalized = input.replaceAll("\0", "\uFFFD").replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");
    const firstLine = (lines[0] ?? "").replace(/^\uFEFF/, "");

    if (
      !firstLine.startsWith("WEBVTT") ||
      (firstLine.length > 6 && !/^[\t ]/.test(firstLine[6]!))
    ) {
      throw new Error("Invalid WebVTT header in file");
    }

    const blocks = normalized
      .split(/\n{2,}/)
      .slice(1)
      .map((b) => b.trim())
      .filter(
        (b) =>
          b.length > 0 &&
          !b.startsWith("NOTE") &&
          !b.startsWith("STYLE") &&
          !b.startsWith("REGION"),
      );

    const cues: WebVttCueTiming[] = [];
    for (const block of blocks) {
      const blockLines = block.split("\n");
      let timingLineIdx = 0;
      let identifier = "";

      if (
        blockLines[0] &&
        !blockLines[0].includes("-->") &&
        blockLines[1]?.includes("-->")
      ) {
        identifier = blockLines[0].trim();
        timingLineIdx = 1;
      }

      const timingLine = blockLines[timingLineIdx];
      if (!timingLine || !timingLine.includes("-->")) {
        continue;
      }

      const [startRaw, restRaw] = timingLine.split("-->").map((s) => s.trim());
      if (!startRaw || !restRaw) continue;

      const restTokens = restRaw.split(/[\t ]+/);
      const endRaw = restTokens[0]!;
      const settingsTokens = restTokens.slice(1);

      const settings: Record<string, string> = {};
      for (const token of settingsTokens) {
        const colonIdx = token.indexOf(":");
        if (colonIdx > 0 && colonIdx < token.length - 1) {
          settings[token.slice(0, colonIdx)] = token.slice(colonIdx + 1);
        }
      }

      const startTimeSeconds =
        ServoSelectorEngine.parseWebVttTimestamp(startRaw);
      const endTimeSeconds = ServoSelectorEngine.parseWebVttTimestamp(endRaw);
      const payload = blockLines.slice(timingLineIdx + 1).join("\n");

      cues.push({
        identifier,
        startTimeSeconds,
        endTimeSeconds,
        settings,
        payload,
      });
    }

    return cues;
  }
}

export interface ServoCrateEntry {
  readonly id: string;
  readonly cargoPackage: string;
  readonly path: string;
  readonly upstreamRepo: string;
  readonly stars: number;
  readonly category:
    | "core-engine"
    | "html-xml-dom"
    | "css-selectors"
    | "gpu-rendering"
    | "geometry-math"
    | "data-structures"
    | "networking-ipc"
    | "media-xpath"
    | "macros-infra";
  readonly purpose: string;
}

/**
 * Complete registry of all 31 consolidated Servo crates in `crates/servo-*`.
 */
export const calculateSpecificity =
  ServoSelectorEngine.calculateSpecificity.bind(ServoSelectorEngine);
export const validateCssSelector = (selector: string) => {
  const res = ServoSelectorEngine.validateSelector(selector);
  if (!res.valid) throw new Error(res.reason ?? "Invalid CSS selector");
  return res;
};
export const translateXPathToCss =
  ServoSelectorEngine.xpathToCss.bind(ServoSelectorEngine);
export const parseWebVtt =
  ServoSelectorEngine.parseWebVttCues.bind(ServoSelectorEngine);

export const SERVO_CONSOLIDATED_CRATES: readonly ServoCrateEntry[] = [
  {
    id: "servo-engine",
    cargoPackage: "servo",
    path: "crates/servo-engine",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "core-engine",
    purpose:
      "Full parallel W3C browser engine (constellation, layout, script, net, paint, webgpu, webxr)",
  },
  {
    id: "servo-webrender",
    cargoPackage: "webrender",
    path: "crates/servo-webrender",
    upstreamRepo: "servo/webrender",
    stars: 6400,
    category: "gpu-rendering",
    purpose: "GPU-accelerated 2D display list renderer and compositor",
  },
  {
    id: "servo-pathfinder",
    cargoPackage: "pathfinder_renderer",
    path: "crates/servo-pathfinder",
    upstreamRepo: "servo/pathfinder",
    stars: 4900,
    category: "gpu-rendering",
    purpose: "GPU-accelerated vector graphics, SVG, and font curve rasterizer",
  },
  {
    id: "servo-rust-url",
    cargoPackage: "url",
    path: "crates/servo-rust-url",
    upstreamRepo: "servo/rust-url",
    stars: 3200,
    category: "networking-ipc",
    purpose: "WHATWG URL Standard parser, IDNA punycode, and form_urlencoded",
  },
  {
    id: "servo-html5ever",
    cargoPackage: "html5ever",
    path: "crates/servo-html5ever",
    upstreamRepo: "servo/html5ever",
    stars: 3000,
    category: "html-xml-dom",
    purpose:
      "High-performance browser-grade WHATWG HTML5 tokenizer and tree builder",
  },
  {
    id: "servo-markup5ever",
    cargoPackage: "markup5ever",
    path: "crates/servo-markup5ever",
    upstreamRepo: "servo/html5ever",
    stars: 3000,
    category: "html-xml-dom",
    purpose:
      "Common TreeSink, QualName, and buffer queues for html5ever and xml5ever",
  },
  {
    id: "servo-xml5ever",
    cargoPackage: "xml5ever",
    path: "crates/servo-xml5ever",
    upstreamRepo: "servo/html5ever",
    stars: 3000,
    category: "html-xml-dom",
    purpose: "Push-based streaming XML5 parser",
  },
  {
    id: "servo-web-atoms",
    cargoPackage: "web_atoms",
    path: "crates/servo-web-atoms",
    upstreamRepo: "servo/html5ever",
    stars: 3000,
    category: "html-xml-dom",
    purpose:
      "Pre-compiled static atom tables for HTML, SVG, and MathML namespaces",
  },
  {
    id: "servo-rcdom",
    cargoPackage: "markup5ever_rcdom",
    path: "crates/servo-rcdom",
    upstreamRepo: "servo/html5ever",
    stars: 3000,
    category: "html-xml-dom",
    purpose:
      "Reference-counted DOM structure for HTML5/XML5 tree construction tests",
  },
  {
    id: "servo-smallvec",
    cargoPackage: "smallvec",
    path: "crates/servo-smallvec",
    upstreamRepo: "servo/rust-smallvec",
    stars: 2700,
    category: "data-structures",
    purpose:
      "Stack-inlined small vector optimization avoiding heap allocations",
  },
  {
    id: "servo-font-kit",
    cargoPackage: "font-kit",
    path: "crates/servo-font-kit",
    upstreamRepo: "servo/font-kit",
    stars: 1300,
    category: "gpu-rendering",
    purpose: "Cross-platform system font discovery and glyph loading library",
  },
  {
    id: "servo-ipc-channel",
    cargoPackage: "ipc-channel",
    path: "crates/servo-ipc-channel",
    upstreamRepo: "servo/ipc-channel",
    stars: 1050,
    category: "networking-ipc",
    purpose: "Multiprocess drop-in replacement for Rust channels over OS IPC",
  },
  {
    id: "servo-euclid",
    cargoPackage: "euclid",
    path: "crates/servo-euclid",
    upstreamRepo: "servo/euclid",
    stars: 970,
    category: "geometry-math",
    purpose: "Unit-tagged 2D/3D linear algebra and layout geometry primitives",
  },
  {
    id: "servo-fnv",
    cargoPackage: "fnv",
    path: "crates/servo-fnv",
    upstreamRepo: "servo/rust-fnv",
    stars: 820,
    category: "data-structures",
    purpose:
      "Fowler-Noll-Vo fast non-cryptographic hash function and FnvHashMap",
  },
  {
    id: "servo-cssparser",
    cargoPackage: "cssparser",
    path: "crates/servo-cssparser",
    upstreamRepo: "servo/rust-cssparser",
    stars: 730,
    category: "css-selectors",
    purpose: "W3C CSS Syntax Module Level 3 tokenizer and parser",
  },
  {
    id: "servo-gaol",
    cargoPackage: "gaol",
    path: "crates/servo-gaol",
    upstreamRepo: "servo/gaol",
    stars: 680,
    category: "networking-ipc",
    purpose: "OS-level application sandboxing library",
  },
  {
    id: "servo-string-cache",
    cargoPackage: "string_cache",
    path: "crates/servo-string-cache",
    upstreamRepo: "servo/string-cache",
    stars: 560,
    category: "data-structures",
    purpose: "Compile-time and runtime string interning library (Atom)",
  },
  {
    id: "servo-stylo",
    cargoPackage: "selectors",
    path: "crates/servo-stylo",
    upstreamRepo: "servo/stylo",
    stars: 540,
    category: "css-selectors",
    purpose:
      "Quantum CSS (Stylo) parallel style engine, W3C Selectors Level 4, and servo_arc",
  },
  {
    id: "servo-surfman",
    cargoPackage: "surfman",
    path: "crates/servo-surfman",
    upstreamRepo: "servo/surfman",
    stars: 390,
    category: "gpu-rendering",
    purpose: "Cross-platform low-level toolkit for GPU surface management",
  },
  {
    id: "servo-tendril",
    cargoPackage: "tendril",
    path: "crates/servo-tendril",
    upstreamRepo: "servo/tendril",
    stars: 310,
    category: "data-structures",
    purpose: "Compact buffer/string type for zero-copy streaming parsers",
  },
  {
    id: "servo-uluru",
    cargoPackage: "uluru",
    path: "crates/servo-uluru",
    upstreamRepo: "servo/uluru",
    stars: 260,
    category: "data-structures",
    purpose: "Fast stack-allocated no_std LRU cache implementation",
  },
  {
    id: "servo-svg",
    cargoPackage: "servo-svg",
    path: "crates/servo-svg",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "media-xpath",
    purpose: "SVG attribute, viewBox, transform, and length parser",
  },
  {
    id: "servo-xpath",
    cargoPackage: "servo-xpath",
    path: "crates/servo-xpath",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "media-xpath",
    purpose: "W3C XPath 1.0 tokenizer, AST parser, and DOM evaluator",
  },
  {
    id: "servo-webvtt",
    cargoPackage: "servo-webvtt",
    path: "crates/servo-webvtt",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "media-xpath",
    purpose: "W3C WebVTT incremental streaming subtitle & cue parser",
  },
  {
    id: "servo-timers",
    cargoPackage: "servo-timers",
    path: "crates/servo-timers",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "macros-infra",
    purpose:
      "Priority timer wheel and channel scheduler for browser event loops",
  },
  {
    id: "servo-url",
    cargoPackage: "servo-url",
    path: "crates/servo-url",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "networking-ipc",
    purpose: "ServoUrl, Origin, CORS checks, and blob: UUID URL management",
  },
  {
    id: "servo-allocator",
    cargoPackage: "servo-allocator",
    path: "crates/servo-allocator",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "macros-infra",
    purpose: "Global memory allocator (system / jemalloc) with heap tracking",
  },
  {
    id: "servo-tracing",
    cargoPackage: "servo-tracing",
    path: "crates/servo-tracing",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "macros-infra",
    purpose: "Procedural macro for profiling spans across engine threads",
  },
  {
    id: "servo-dom-struct",
    cargoPackage: "servo-dom-struct",
    path: "crates/servo-dom-struct",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "macros-infra",
    purpose:
      "Procedural macro enforcing #[repr(C)] DOM inheritance and GC tracing",
  },
  {
    id: "servo-deny-public-fields",
    cargoPackage: "servo-deny-public-fields",
    path: "crates/servo-deny-public-fields",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "macros-infra",
    purpose: "Procedural derive macro enforcing private DOM struct fields",
  },
  {
    id: "servo-hyper-serde",
    cargoPackage: "servo-hyper-serde",
    path: "crates/servo-hyper-serde",
    upstreamRepo: "servo/servo",
    stars: 36100,
    category: "networking-ipc",
    purpose:
      "Serde serialization support for hyper, http, cookie, and mime types",
  },
] as const;

export * from "./webdriver.ts";
