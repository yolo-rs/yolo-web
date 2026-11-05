// SPDX-License-Identifier: Apache-2.0
/**
 * Minimal DOM factory used as the TSX runtime (`jsxFactory: "h"`). There is
 * no virtual DOM: each JSX expression creates real nodes once, and later
 * updates go through `ref` callbacks.
 */

export type Child =
  Node | string | number | boolean | null | undefined | readonly Child[];

export interface EventProps {
  onClick?: (event: MouseEvent) => void;
  onInput?: (event: Event) => void;
  onChange?: (event: Event) => void;
  onSubmit?: (event: SubmitEvent) => void;
  onKeydown?: (event: KeyboardEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onPointerdown?: (event: PointerEvent) => void;
  onMousedown?: (event: MouseEvent) => void;
  onMouseenter?: (event: MouseEvent) => void;
  onMousemove?: (event: MouseEvent) => void;
  onDragstart?: (event: DragEvent) => void;
  onDragend?: (event: DragEvent) => void;
  onDragover?: (event: DragEvent) => void;
  onDragleave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: Event) => void;
  onToggle?: (event: Event) => void;
}

export interface BaseProps<E extends Element> extends EventProps {
  id?: string;
  class?: string;
  title?: string;
  role?: string;
  tabindex?: number;
  hidden?: boolean;
  lang?: string;
  draggable?: "true" | "false";
  /** Any ARIA state or property. */
  [aria: `aria-${string}`]: string | undefined;
  /** Any data attribute. */
  [data: `data-${string}`]: string | undefined;
  ref?: (element: E) => void;
  children?: Child;
}

export interface HtmlProps<
  E extends HTMLElement = HTMLElement,
> extends BaseProps<E> {
  href?: string;
  target?: string;
  rel?: string;
  type?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  autocomplete?: string;
  autofocus?: boolean;
  disabled?: boolean;
  action?: string;
  method?: string;
  for?: string;
  spellcheck?: "true" | "false";
  enterkeyhint?: string;
  inputmode?: string;
  datetime?: string;
  maxlength?: number;
  accept?: string;
  alt?: string;
  checked?: boolean;
  decoding?: "async" | "sync" | "auto";
  form?: string;
  loading?: "lazy" | "eager";
  novalidate?: boolean;
  popover?: "auto" | "manual";
  required?: boolean;
  src?: string;
  width?: number | string;
  height?: number | string;
}

export interface SvgProps extends BaseProps<SVGElement> {
  viewBox?: string;
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  "stroke-width"?: number | string;
  "stroke-linecap"?: "butt" | "round" | "square";
  "stroke-linejoin"?: "miter" | "round" | "bevel";
  d?: string;
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
  x?: number | string;
  y?: number | string;
  rx?: number | string;
  ry?: number | string;
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  offset?: number | string;
  "stop-color"?: string;
  focusable?: "true" | "false";
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
}

type SvgTag =
  | "svg"
  | "path"
  | "circle"
  | "rect"
  | "g"
  | "line"
  | "defs"
  | "linearGradient"
  | "stop";

type ComponentProps = Record<string, unknown> & { children?: Child };
type AnyComponent = (props: ComponentProps) => Node;

declare global {
  namespace JSX {
    type Element = Node;
    interface ElementChildrenAttribute {
      children: Child;
    }
    type IntrinsicElements = {
      [K in keyof HTMLElementTagNameMap]: HtmlProps<HTMLElementTagNameMap[K]>;
    } & { [K in SvgTag]: SvgProps };
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS: ReadonlySet<string> = new Set<SvgTag>([
  "svg",
  "path",
  "circle",
  "rect",
  "g",
  "line",
  "defs",
  "linearGradient",
  "stop",
]);

/** JSX factory. */
export function h(
  type: string | AnyComponent,
  props: Record<string, unknown> | null,
  ...children: Child[]
): Node {
  if (typeof type === "function") {
    return type({
      ...(props ?? {}),
      children: children.length === 1 ? children[0] : children,
    });
  }
  const element = SVG_TAGS.has(type)
    ? document.createElementNS(SVG_NS, type)
    : document.createElement(type);
  if (props) {
    for (const [name, value] of Object.entries(props)) {
      applyProp(element, name, value);
    }
  }
  appendChildren(element, children);
  return element;
}

/** JSX fragment factory. */
export function Fragment(props: { children?: Child }): Node {
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, [props.children]);
  return fragment;
}

function applyProp(element: Element, name: string, value: unknown): void {
  if (
    name === "children" ||
    value === null ||
    value === undefined ||
    value === false
  ) {
    return;
  }
  if (name === "ref") {
    if (typeof value === "function") {
      (value as (target: Element) => void)(element);
    }
    return;
  }
  if (name.startsWith("on") && typeof value === "function") {
    element.addEventListener(
      name.slice(2).toLowerCase(),
      value as EventListener,
    );
    return;
  }
  if (name === "checked" && element instanceof HTMLInputElement) {
    element.checked = Boolean(value);
    return;
  }
  if (
    name === "value" &&
    (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement)
  ) {
    element.value = String(value);
    return;
  }
  if (value === true) {
    element.setAttribute(name, "");
    return;
  }
  element.setAttribute(name, String(value));
}

function appendChildren(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || typeof child === "boolean") {
      continue;
    }
    if (Array.isArray(child)) {
      appendChildren(parent, child as readonly Child[]);
      continue;
    }
    if (child instanceof Node) {
      parent.appendChild(child);
      continue;
    }
    parent.appendChild(document.createTextNode(String(child)));
  }
}

/** Replaces the children of `root` with `node`. */
export function mount(root: Element, node: Node): void {
  root.replaceChildren(node);
}

/** Adopts a generated style sheet without a `<style>` element. */
export function mountStyles(cssText: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return sheet;
}

/** The single root element of an entry document. */
export function rootElement(): HTMLElement {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("entry document has no #root element");
  }
  return root;
}
