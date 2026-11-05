/**
 * Live edits of a page through CDP: CSS (an inspector stylesheet), JavaScript
 * (Runtime.evaluate), and HTML (DOM.setOuterHTML). Live edits last until the
 * page reloads; persistent chrome:// edits use yolo-chromium's
 * `--webui-patch-dir` instead.
 */

import type { PageSession } from "./session.ts";

export type EditKind = "css" | "js" | "html";

export interface EditResult {
  kind: EditKind;
  url: string;
  styleSheetId?: string;
  value?: unknown;
  nodeId?: number;
}

async function mainFrameId(session: PageSession): Promise<string> {
  const { frameTree } = await session.send<{
    frameTree: { frame: { id: string } };
  }>("Page.getFrameTree");
  return frameTree.frame.id;
}

async function querySelector(
  session: PageSession,
  selector: string,
): Promise<number> {
  const { root } = await session.send<{ root: { nodeId: number } }>(
    "DOM.getDocument",
    { depth: 0 },
  );
  const { nodeId } = await session.send<{ nodeId: number }>(
    "DOM.querySelector",
    {
      nodeId: root.nodeId,
      selector,
    },
  );
  if (!nodeId)
    throw new Error(`no element matches ${JSON.stringify(selector)}`);
  return nodeId;
}

/** Adds `css` to the page as a new inspector stylesheet. */
export async function applyCss(
  session: PageSession,
  css: string,
): Promise<string> {
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const frameId = await mainFrameId(session);
  const { styleSheetId } = await session.send<{ styleSheetId: string }>(
    "CSS.createStyleSheet",
    { frameId },
  );
  await session.send("CSS.setStyleSheetText", { styleSheetId, text: css });
  return styleSheetId;
}

/** Evaluates `js` in the page's main world and returns its value. */
export function applyJs(session: PageSession, js: string): Promise<unknown> {
  return session.evaluate(js);
}

/** Replaces the first element that matches `selector` with `html`. */
export async function applyHtml(
  session: PageSession,
  selector: string,
  html: string,
): Promise<number> {
  await session.send("DOM.enable");
  const nodeId = await querySelector(session, selector);
  await session.send("DOM.setOuterHTML", { nodeId, outerHTML: html });
  return nodeId;
}

/** Computed value of `property` on the first element matching `selector`. */
export async function computedStyle(
  session: PageSession,
  selector: string,
  property: string,
): Promise<string | undefined> {
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const nodeId = await querySelector(session, selector);
  const { computedStyle: styles } = await session.send<{
    computedStyle: Array<{ name: string; value: string }>;
  }>("CSS.getComputedStyleForNode", { nodeId });
  return styles.find((entry) => entry.name === property)?.value;
}

/** `body:color=rgb(1, 2, 3)` -> selector, property, expected value. */
export function parseStyleCheck(spec: string): {
  selector: string;
  property: string;
  value: string;
} {
  const equals = spec.indexOf("=");
  const colon = spec.lastIndexOf(":", equals < 0 ? undefined : equals);
  if (equals < 0 || colon <= 0)
    throw new Error(
      `style check must be <selector>:<property>=<value>, got ${spec}`,
    );
  return {
    selector: spec.slice(0, colon).trim(),
    property: spec.slice(colon + 1, equals).trim(),
    value: spec.slice(equals + 1).trim(),
  };
}

export async function applyEdit(
  session: PageSession,
  kind: EditKind,
  source: string,
  selector = "body",
): Promise<EditResult> {
  const url = await session.evaluate<string>("location.href");
  switch (kind) {
    case "css":
      return { kind, url, styleSheetId: await applyCss(session, source) };
    case "js":
      return { kind, url, value: await applyJs(session, source) };
    case "html":
      return { kind, url, nodeId: await applyHtml(session, selector, source) };
  }
}
