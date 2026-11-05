// SPDX-License-Identifier: Apache-2.0
/**
 * Accessibility-tree observation: compacts `Accessibility.getFullAXTree`
 * output into a small indented outline with stable element refs, and formats
 * the result for a model behind the untrusted-content fence.
 */
import { sanitizeUntrusted, scanInjection, wrapUntrusted } from "./safety.ts";

export interface AxValue {
  type?: string;
  value?: unknown;
}
export interface AxProperty {
  name: string;
  value: AxValue;
}
export interface AxNode {
  nodeId: string;
  ignored?: boolean;
  role?: AxValue;
  name?: AxValue;
  value?: AxValue;
  description?: AxValue;
  properties?: AxProperty[];
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
}

/** Roles that receive a ref because an agent can act on them. */
export const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "spinbutton",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "option",
  "listbox",
  "treeitem",
  "DisclosureTriangle",
  "PopUpButton",
  "TextField",
  "ComboBox",
]);

/** Structural roles worth printing for orientation (they get refs for scoping/extraction). */
const LANDMARK_ROLES = new Set([
  "heading",
  "main",
  "navigation",
  "banner",
  "contentinfo",
  "complementary",
  "form",
  "search",
  "dialog",
  "alertdialog",
  "alert",
  "status",
  "table",
  "list",
  "img",
  "region",
]);

const SKIP_ROLES = new Set([
  "none",
  "presentation",
  "generic",
  "InlineTextBox",
  "LineBreak",
  "RootWebArea",
  "WebArea",
  "Ignored",
]);

const STATE_PROPS = [
  "checked",
  "expanded",
  "selected",
  "disabled",
  "required",
  "invalid",
  "pressed",
  "readonly",
  "focused",
  "level",
  "modal",
];

/** Keeps refs stable across observations of the same document. */
export class RefRegistry {
  private byBackend = new Map<number, string>();
  private byRef = new Map<string, number>();
  private counter = 0;

  refFor(backendId: number): string {
    let ref = this.byBackend.get(backendId);
    if (!ref) {
      ref = `e${++this.counter}`;
      this.byBackend.set(backendId, ref);
      this.byRef.set(ref, backendId);
    }
    return ref;
  }

  resolve(ref: string): number | undefined {
    return this.byRef.get(ref.replace(/^@/, "").replace(/^\[|\]$/g, ""));
  }

  /** New document: backend node ids are no longer valid. */
  reset(): void {
    this.byBackend.clear();
    this.byRef.clear();
    this.counter = 0;
  }

  get size(): number {
    return this.byRef.size;
  }
}

export interface CompactOptions {
  maxLines?: number;
  maxChars?: number;
  maxTextLength?: number;
}

export interface CompactResult {
  lines: string[];
  refs: number;
  truncated: boolean;
  flagged: string[];
}

function str(value: AxValue | undefined): string {
  const v = value?.value;
  return typeof v === "string"
    ? v
    : v === undefined || v === null
      ? ""
      : String(v);
}

function stateText(node: AxNode): string {
  const parts: string[] = [];
  for (const prop of node.properties ?? []) {
    if (!STATE_PROPS.includes(prop.name)) continue;
    const v = prop.value.value;
    if (v === false || v === "false" || v === undefined) continue;
    parts.push(
      v === true || v === "true" ? prop.name : `${prop.name}=${String(v)}`,
    );
  }
  return parts.join(" ");
}

export function compactAxTree(
  nodes: AxNode[],
  registry: RefRegistry,
  options: CompactOptions = {},
): CompactResult {
  const maxLines = options.maxLines ?? 500;
  const maxChars = options.maxChars ?? 30_000;
  const maxText = options.maxTextLength ?? 160;
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const root = nodes.find((n) => !n.parentId) ?? nodes[0];
  const lines: string[] = [];
  const flagged = new Set<string>();
  let chars = 0;
  let refs = 0;
  let truncated = false;

  const emit = (depth: number, text: string): boolean => {
    if (lines.length >= maxLines || chars + text.length > maxChars) {
      truncated = true;
      return false;
    }
    const line = `${"  ".repeat(Math.min(depth, 12))}${text}`;
    lines.push(line);
    chars += line.length + 1;
    return true;
  };

  const visit = (
    node: AxNode,
    depth: number,
    parentName: string,
    parentRole = "",
  ): void => {
    if (truncated) return;
    const role = str(node.role);
    if (role === "ListMarker") return;
    const name = sanitizeUntrusted(
      str(node.name).replace(/\s+/g, " ").trim(),
      maxText,
    );
    let printed = false;
    let childParentName = parentName;

    if (!node.ignored && role === "StaticText") {
      if (
        name &&
        parentRole !== "LabelText" &&
        name !== parentName &&
        !parentName.includes(name)
      ) {
        for (const hit of scanInjection(name)) flagged.add(hit);
        printed = emit(depth, JSON.stringify(name));
      }
    } else if (!node.ignored && !SKIP_ROLES.has(role) && role) {
      const interactive = INTERACTIVE_ROLES.has(role);
      const landmark = LANDMARK_ROLES.has(role);
      const hasValue = str(node.value) !== "";
      if (
        interactive ||
        (landmark &&
          (name ||
            role === "main" ||
            role === "navigation" ||
            role === "form")) ||
        (name && role !== "paragraph")
      ) {
        const ref =
          node.backendDOMNodeId !== undefined && (interactive || landmark)
            ? registry.refFor(node.backendDOMNodeId)
            : "";
        if (ref) refs++;
        const bits: string[] = [];
        if (ref) bits.push(`[${ref}]`);
        bits.push(role);
        if (name) {
          bits.push(JSON.stringify(name));
          for (const hit of scanInjection(name)) flagged.add(hit);
        }
        if (hasValue && role !== "heading")
          bits.push(
            `value=${JSON.stringify(sanitizeUntrusted(str(node.value), 120))}`,
          );
        const state = stateText(node);
        if (state) bits.push(state);
        printed = emit(depth, bits.join(" "));
        childParentName =
          [name, str(node.value)].filter(Boolean).join("\n") || parentName;
      }
    }
    const nextDepth = printed ? depth + 1 : depth;
    for (const childId of node.childIds ?? []) {
      const child = byId.get(childId);
      if (child) visit(child, nextDepth, childParentName, role);
    }
  };

  if (root) visit(root, 0, "");
  if (truncated)
    lines.push(
      "... [observation truncated; scroll or use extract/ref scoping for more]",
    );
  return { lines, refs, truncated, flagged: [...flagged] };
}

export interface Observation {
  url: string;
  title: string;
  tree: string[];
  refs: number;
  truncated: boolean;
  flagged: string[];
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    pageHeight?: number;
  };
  dialog?: { type: string; message: string };
  screenshot?: { mime: string; data: string };
  tabs?: { id: string; title: string; url: string; active: boolean }[];
  timings: { axMs: number; screenshotMs?: number; totalMs: number };
}

/** Text form of an observation. Everything page-derived sits inside the untrusted fence. */
export function formatObservation(obs: Observation): string {
  const header = [
    `url: ${sanitizeUntrusted(obs.url, 500)}`,
    `title: ${sanitizeUntrusted(obs.title, 200)}`,
    obs.viewport
      ? `viewport: ${obs.viewport.width}x${obs.viewport.height} scroll=(${obs.viewport.scrollX},${obs.viewport.scrollY})${obs.viewport.pageHeight ? ` pageHeight=${obs.viewport.pageHeight}` : ""}`
      : "",
    obs.dialog
      ? `OPEN DIALOG (${obs.dialog.type}): ${JSON.stringify(sanitizeUntrusted(obs.dialog.message, 300))} (use browser_dialog)`
      : "",
    `refs: ${obs.refs}${obs.truncated ? " (truncated)" : ""}`,
  ].filter(Boolean);
  const tabs =
    obs.tabs && obs.tabs.length > 1
      ? `\ntabs:\n${obs.tabs.map((t) => `  ${t.active ? "*" : " "} ${t.id} ${JSON.stringify(sanitizeUntrusted(t.title, 80))} ${sanitizeUntrusted(t.url, 200)}`).join("\n")}`
      : "";
  return `${header.join("\n")}${tabs}\n${wrapUntrusted(obs.tree.join("\n"), { source: obs.url, flagged: obs.flagged })}`;
}
