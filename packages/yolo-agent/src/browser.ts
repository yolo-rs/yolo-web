// SPDX-License-Identifier: Apache-2.0
/**
 * Browser driver: target management plus the action implementations
 * (click, type, key, scroll, drag, select, upload, navigate, tabs, wait-for).
 * Works over any `TargetBackend` (raw CDP or chrome.debugger).
 */
import { type CdpResult, type CdpTransport, waitForEvent } from "./cdp.ts";
import { type AxNode, type Observation, compactAxTree } from "./observe.ts";
import { PageSession } from "./page.ts";
import { type BatchStep, ACTION_NAMES } from "./spec.ts";

export interface TargetInfo {
  id: string;
  title: string;
  url: string;
}

export interface TargetBackend {
  list(): Promise<TargetInfo[]>;
  attach(id: string): Promise<PageSession>;
  create(url: string): Promise<string>;
  activate(id: string): Promise<void>;
  close(id: string): Promise<void>;
}

/** Target backend over a browser-level CDP connection using flat sessions. */
export class CdpTargetBackend implements TargetBackend {
  constructor(private readonly transport: CdpTransport) {}

  async list(): Promise<TargetInfo[]> {
    const { targetInfos } = await this.transport.send("Target.getTargets");
    return (targetInfos as CdpResult[])
      .filter(
        (t) => t.type === "page" && !String(t.url).startsWith("devtools://"),
      )
      .map((t) => ({ id: t.targetId, title: t.title, url: t.url }));
  }

  async attach(id: string): Promise<PageSession> {
    const { sessionId } = await this.transport.send("Target.attachToTarget", {
      targetId: id,
      flatten: true,
    });
    const page = new PageSession(this.transport, id, sessionId);
    await page.init();
    return page;
  }

  async create(url: string): Promise<string> {
    const { targetId } = await this.transport.send("Target.createTarget", {
      url,
    });
    return targetId;
  }

  async activate(id: string): Promise<void> {
    await this.transport.send("Target.activateTarget", { targetId: id });
  }

  async close(id: string): Promise<void> {
    await this.transport.send("Target.closeTarget", { targetId: id });
  }
}

export class AgentError extends Error {
  constructor(
    message: string,
    readonly code:
      "stale_ref" | "no_target" | "timeout" | "invalid" | "failed" = "failed",
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export interface ActionResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  ms: number;
  observation?: Observation;
}

const MODIFIERS: Record<string, number> = {
  alt: 1,
  control: 2,
  ctrl: 2,
  meta: 4,
  cmd: 4,
  command: 4,
  shift: 8,
};
const KEYS: Record<
  string,
  { key: string; code: string; vk: number; text?: string }
> = {
  enter: { key: "Enter", code: "Enter", vk: 13, text: "\r" },
  tab: { key: "Tab", code: "Tab", vk: 9 },
  escape: { key: "Escape", code: "Escape", vk: 27 },
  esc: { key: "Escape", code: "Escape", vk: 27 },
  backspace: { key: "Backspace", code: "Backspace", vk: 8 },
  delete: { key: "Delete", code: "Delete", vk: 46 },
  space: { key: " ", code: "Space", vk: 32, text: " " },
  arrowup: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  arrowdown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  arrowleft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  arrowright: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  home: { key: "Home", code: "Home", vk: 36 },
  end: { key: "End", code: "End", vk: 35 },
  pageup: { key: "PageUp", code: "PageUp", vk: 33 },
  pagedown: { key: "PageDown", code: "PageDown", vk: 34 },
};

export function parseChord(chord: string): { modifiers: number; key: string } {
  const parts = chord.split("+").filter(Boolean);
  const last = parts.pop() ?? chord;
  let modifiers = 0;
  for (const part of parts) {
    const bit = MODIFIERS[part.toLowerCase()];
    if (bit === undefined)
      throw new AgentError(
        `unknown modifier "${part}" in "${chord}"`,
        "invalid",
      );
    modifiers |= bit;
  }
  return { modifiers, key: last };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Args = Record<string, unknown>;
const asStr = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const asNum = (v: unknown): number | undefined =>
  typeof v === "number" ? v : undefined;

export class Browser {
  private pages = new Map<string, PageSession>();
  private activeId: string | undefined;
  private prefetched:
    | {
        seq: number;
        id: string;
        at: number;
        screenshot: boolean;
        promise: Promise<Observation>;
      }
    | undefined;

  constructor(
    private readonly backend: TargetBackend,
    private readonly opts: { settleMs?: number; navTimeoutMs?: number } = {},
  ) {}

  // ------------------------------------------------------------ targets

  async page(): Promise<PageSession> {
    if (this.activeId) {
      const existing = this.pages.get(this.activeId);
      if (existing) return existing;
    }
    const targets = await this.backend.list();
    const first = targets[0];
    if (!first)
      throw new AgentError("no page targets; use tabs op=new", "no_target");
    return this.use(first.id);
  }

  async use(id: string): Promise<PageSession> {
    let page = this.pages.get(id);
    if (!page) {
      page = await this.backend.attach(id);
      this.pages.set(id, page);
    }
    this.activeId = id;
    return page;
  }

  // -------------------------------------------------------- observation

  /** Starts an observation without waiting; the next `observe` call reuses it if nothing mutated. */
  prefetch(screenshot = false): void {
    void this.page().then(
      (page) => {
        const promise = this.observeNow(page, { screenshot });
        promise.catch(() => undefined);
        this.prefetched = {
          seq: page.mutationSeq,
          id: page.targetId,
          at: Date.now(),
          screenshot,
          promise,
        };
      },
      () => undefined,
    );
  }

  async observe(
    options: { screenshot?: boolean; maxLines?: number } = {},
  ): Promise<Observation & { prefetched: boolean }> {
    const page = await this.page();
    const hit = this.prefetched;
    this.prefetched = undefined;
    if (
      hit &&
      hit.id === page.targetId &&
      hit.seq === page.mutationSeq &&
      Date.now() - hit.at < 3000 &&
      (hit.screenshot || !options.screenshot) &&
      !options.maxLines
    ) {
      return { ...(await hit.promise), prefetched: true };
    }
    return { ...(await this.observeNow(page, options)), prefetched: false };
  }

  private async observeNow(
    page: PageSession,
    options: { screenshot?: boolean; maxLines?: number },
  ): Promise<Observation> {
    const t0 = performance.now();
    const infoExpr = `({url:location.href,title:document.title,w:innerWidth,h:innerHeight,sx:Math.round(scrollX),sy:Math.round(scrollY),ph:document.documentElement.scrollHeight})`;
    const shot = options.screenshot ? this.shoot(page) : undefined;
    const [ax, info, tabs] = await Promise.all([
      page.send("Accessibility.getFullAXTree"),
      page.dialog
        ? Promise.resolve({
            url: "",
            title: "",
            w: 0,
            h: 0,
            sx: 0,
            sy: 0,
            ph: 0,
          })
        : page.evaluate<{
            url: string;
            title: string;
            w: number;
            h: number;
            sx: number;
            sy: number;
            ph: number;
          }>(infoExpr),
      this.backend.list().catch(() => [] as TargetInfo[]),
    ]);
    const axMs = performance.now() - t0;
    const compact = compactAxTree(ax.nodes as AxNode[], page.registry, {
      maxLines: options.maxLines,
    });
    const screenshot = shot ? await shot : undefined;
    return {
      url: info.url,
      title: info.title,
      tree: compact.lines,
      refs: compact.refs,
      truncated: compact.truncated,
      flagged: compact.flagged,
      viewport: {
        width: info.w,
        height: info.h,
        scrollX: info.sx,
        scrollY: info.sy,
        pageHeight: info.ph,
      },
      dialog: page.dialog
        ? { type: page.dialog.type, message: page.dialog.message }
        : undefined,
      screenshot: screenshot
        ? { mime: "image/jpeg", data: screenshot }
        : undefined,
      tabs: tabs.map((t) => ({ ...t, active: t.id === page.targetId })),
      timings: {
        axMs: Math.round(axMs),
        totalMs: Math.round(performance.now() - t0),
      },
    };
  }

  private async shoot(page: PageSession, fullPage = false): Promise<string> {
    const res = await page.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 55,
      optimizeForSpeed: true,
      captureBeyondViewport: fullPage,
    });
    return res.data as string;
  }

  // ------------------------------------------------------ element access

  private async node(
    page: PageSession,
    ref: string,
  ): Promise<{ backendNodeId: number; objectId: string }> {
    const backendNodeId = page.registry.resolve(ref);
    if (backendNodeId === undefined)
      throw new AgentError(
        `unknown ref "${ref}"; call observe first`,
        "stale_ref",
      );
    try {
      const res = await page.send("DOM.resolveNode", { backendNodeId });
      return { backendNodeId, objectId: res.object.objectId };
    } catch {
      throw new AgentError(
        `ref "${ref}" is stale (element removed); call observe again`,
        "stale_ref",
      );
    }
  }

  private async center(
    page: PageSession,
    ref: string,
  ): Promise<{
    x: number;
    y: number;
    objectId: string;
    backendNodeId: number;
  }> {
    const node = await this.node(page, ref);
    await page
      .send("DOM.scrollIntoViewIfNeeded", { backendNodeId: node.backendNodeId })
      .catch(() => undefined);
    const quads = (
      await page
        .send("DOM.getContentQuads", { backendNodeId: node.backendNodeId })
        .catch(() => ({ quads: [] }))
    ).quads as number[][];
    const q = quads.find((quad) => quad.length === 8);
    if (!q)
      throw new AgentError(
        `ref "${ref}" has no visible box (hidden or zero size)`,
        "failed",
      );
    const xs = [q[0], q[2], q[4], q[6]] as number[];
    const ys = [q[1], q[3], q[5], q[7]] as number[];
    return {
      x: xs.reduce((a, b) => a + b, 0) / 4,
      y: ys.reduce((a, b) => a + b, 0) / 4,
      objectId: node.objectId,
      backendNodeId: node.backendNodeId,
    };
  }

  // ------------------------------------------------------------- settle

  /** Waits for a navigation started by the last action (if any) to finish loading. */
  private async settle(page: PageSession, seqBefore: number): Promise<void> {
    await sleep(this.opts.settleMs ?? 30);
    if (page.dialog) return;
    const deadline = Date.now() + (this.opts.navTimeoutMs ?? 10_000);
    // loadSeq advances on frameStoppedLoading; a navigation in flight shows as loading state.
    const state = await page
      .evaluate<string>("document.readyState")
      .catch(() => "navigating");
    if (state === "complete" && page.loadSeq === seqBefore) return;
    while (Date.now() < deadline) {
      if (page.loadSeq > seqBefore) break;
      const ready = await page
        .evaluate<string>("document.readyState")
        .catch(() => "navigating");
      if (ready === "complete") break;
      await sleep(25);
    }
  }

  // ------------------------------------------------------------ actions

  async act(action: string, args: Args = {}): Promise<ActionResult> {
    if (!ACTION_NAMES.has(action))
      throw new AgentError(`unknown action "${action}"`, "invalid");
    const t0 = performance.now();
    const page = action === "tabs" ? undefined : await this.page();
    const mutates = !["observe", "screenshot", "extract", "wait_for"].includes(
      action,
    );
    if (page && mutates) page.mutationSeq++;
    const seqBefore = page?.loadSeq ?? 0;

    let summary = "";
    let data: unknown;
    switch (action) {
      case "observe": {
        const obs = await this.observe({
          screenshot: args.screenshot === true,
          maxLines: asNum(args.maxLines),
        });
        return {
          ok: true,
          summary: `observed ${obs.refs} refs${obs.prefetched ? " (prefetched)" : ""}`,
          observation: obs,
          ms: ms(t0),
        };
      }
      case "navigate":
        summary = await this.navigate(page as PageSession, args);
        break;
      case "click":
        summary = await this.click(page as PageSession, args);
        break;
      case "type":
        summary = await this.type(page as PageSession, args);
        break;
      case "key":
        summary = await this.key(page as PageSession, String(args.key));
        break;
      case "scroll":
        summary = await this.scroll(page as PageSession, args);
        break;
      case "drag":
        summary = await this.drag(page as PageSession, args);
        break;
      case "select":
        summary = await this.select(
          page as PageSession,
          String(args.ref),
          String(args.value),
        );
        break;
      case "upload": {
        const node = await this.node(page as PageSession, String(args.ref));
        await (page as PageSession).send("DOM.setFileInputFiles", {
          files: args.paths,
          backendNodeId: node.backendNodeId,
        });
        summary = `set ${(args.paths as string[]).length} file(s) on ${String(args.ref)}`;
        break;
      }
      case "tabs":
        ({ summary, data } = await this.tabs(args));
        break;
      case "wait_for":
        summary = await this.waitFor(page as PageSession, args);
        break;
      case "extract":
        data = await this.extract(page as PageSession, args);
        summary = "extracted";
        break;
      case "screenshot": {
        const image = await this.shoot(
          page as PageSession,
          args.fullPage === true,
        );
        data = { mime: "image/jpeg", data: image };
        summary = `screenshot ${Math.round((image.length * 3) / 4 / 1024)} KiB`;
        break;
      }
      case "dialog": {
        const p = page as PageSession;
        if (!p.dialog) throw new AgentError("no open dialog", "invalid");
        await p.send("Page.handleJavaScriptDialog", {
          accept: args.accept === true,
          promptText: asStr(args.text),
        });
        summary = args.accept ? "dialog accepted" : "dialog dismissed";
        break;
      }
      case "evaluate": {
        const value = await (page as PageSession).evaluate(
          String(args.expression),
          true,
          5000,
        );
        data = value;
        summary = "evaluated";
        break;
      }
      default:
        throw new AgentError(`unhandled action "${action}"`, "invalid");
    }
    if (page && mutates && action !== "dialog")
      await this.settle(page, seqBefore);
    return { ok: true, summary, data, ms: ms(t0) };
  }

  /** Runs steps sequentially; stops at the first failure. Optionally appends a fresh observation. */
  async batch(
    steps: BatchStep[],
    options: { observe?: boolean } = {},
  ): Promise<{
    results: ActionResult[];
    failedAt?: number;
    observation?: Observation;
  }> {
    const results: ActionResult[] = [];
    let failedAt: number | undefined;
    for (const [index, step] of steps.entries()) {
      const { action, ...args } = step;
      try {
        results.push(await this.act(action, args));
      } catch (error) {
        results.push({
          ok: false,
          summary: error instanceof Error ? error.message : String(error),
          ms: 0,
        });
        failedAt = index;
        break;
      }
    }
    const observation =
      options.observe === false
        ? undefined
        : ((await this.observe().catch(() => undefined)) ?? undefined);
    return { results, failedAt, observation };
  }

  private async navigate(page: PageSession, args: Args): Promise<string> {
    const op = asStr(args.op) ?? "goto";
    const before = page.loadSeq;
    if (op === "goto") {
      const url = asStr(args.url);
      if (!url) throw new AgentError("navigate requires url", "invalid");
      if (!/^(https?|file|about|chrome|data):/i.test(url))
        throw new AgentError(`unsupported URL scheme: ${url}`, "invalid");
      const res = await page.send("Page.navigate", { url });
      if (res.errorText)
        throw new AgentError(`navigation failed: ${res.errorText}`);
      if (res.loaderId) await this.waitLoad(page, before);
      return `navigated to ${url}`;
    }
    if (op === "reload") {
      await page.send("Page.reload");
      await this.waitLoad(page, before);
      return "reloaded";
    }
    const history = await page.send("Page.getNavigationHistory");
    const index = (history.currentIndex as number) + (op === "back" ? -1 : 1);
    const entry = (history.entries as CdpResult[])[index];
    if (!entry) throw new AgentError(`no history entry to go ${op}`, "invalid");
    await page.send("Page.navigateToHistoryEntry", { entryId: entry.id });
    await this.waitLoad(page, before);
    return `went ${op}`;
  }

  private async waitLoad(page: PageSession, seqBefore: number): Promise<void> {
    const deadline = Date.now() + (this.opts.navTimeoutMs ?? 10_000);
    while (page.loadSeq === seqBefore) {
      if (Date.now() > deadline)
        throw new AgentError("navigation load timeout", "timeout");
      await sleep(10);
    }
  }

  private async click(page: PageSession, args: Args): Promise<string> {
    let x = asNum(args.x);
    let y = asNum(args.y);
    const refArg = asStr(args.ref);
    let objectId: string | undefined;
    if (refArg) {
      const c = await this.center(page, refArg);
      ({ x, y, objectId } = c);
    }
    if (x === undefined || y === undefined)
      throw new AgentError("click requires ref or x/y", "invalid");
    const button = (asStr(args.button) ?? "left") as
      "left" | "right" | "middle";
    const count = Math.max(1, Math.min(3, asNum(args.count) ?? 1));
    await page.sendInput("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
    });
    for (let i = 1; i <= count; i++) {
      await page.sendInput("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button,
        clickCount: i,
        buttons: 1,
      });
      await page.sendInput("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button,
        clickCount: i,
      });
    }
    void objectId;
    return `clicked ${refArg ?? `(${Math.round(x)},${Math.round(y)})`}`;
  }

  private async type(page: PageSession, args: Args): Promise<string> {
    const text = String(args.text);
    const refArg = asStr(args.ref);
    if (refArg) {
      const node = await this.node(page, refArg);
      await page
        .send("DOM.scrollIntoViewIfNeeded", {
          backendNodeId: node.backendNodeId,
        })
        .catch(() => undefined);
      await page.send("DOM.focus", { backendNodeId: node.backendNodeId });
      if (args.append !== true) {
        await page.send("Runtime.callFunctionOn", {
          objectId: node.objectId,
          functionDeclaration: `function(){ if (typeof this.select === "function") { this.select(); } else { const s = getSelection(); s.selectAllChildren(this); } }`,
        });
      }
    }
    if (text) await page.send("Input.insertText", { text });
    if (args.submit === true) await this.key(page, "Enter");
    return `typed ${text.length} chars${refArg ? ` into ${refArg}` : ""}${args.submit ? " and submitted" : ""}`;
  }

  private async key(page: PageSession, chord: string): Promise<string> {
    const { modifiers, key } = parseChord(chord);
    const known = KEYS[key.toLowerCase()];
    const def = known ?? {
      key,
      code:
        key.length === 1
          ? /[a-z]/i.test(key)
            ? `Key${key.toUpperCase()}`
            : `Digit${key}`
          : key,
      vk: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
      text: key.length === 1 ? key : undefined,
    };
    const printable = def.text !== undefined && (modifiers & 6) === 0;
    await page.sendInput("Input.dispatchKeyEvent", {
      type: printable ? "keyDown" : "rawKeyDown",
      key: def.key,
      code: def.code,
      windowsVirtualKeyCode: def.vk,
      modifiers,
      ...(printable ? { text: def.text } : {}),
      ...(modifiers & 6 && def.key.toLowerCase() === "a"
        ? { commands: ["selectAll"] }
        : {}),
    });
    await page.sendInput("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: def.key,
      code: def.code,
      windowsVirtualKeyCode: def.vk,
      modifiers,
    });
    return `pressed ${chord}`;
  }

  private async scroll(page: PageSession, args: Args): Promise<string> {
    const refArg = asStr(args.ref);
    const direction = asStr(args.direction);
    if (refArg && !direction) {
      const node = await this.node(page, refArg);
      await page.send("DOM.scrollIntoViewIfNeeded", {
        backendNodeId: node.backendNodeId,
      });
      return `scrolled ${refArg} into view`;
    }
    const metrics = await page.send("Page.getLayoutMetrics");
    const vw = (metrics.cssVisualViewport?.clientWidth ?? 800) as number;
    const vh = (metrics.cssVisualViewport?.clientHeight ?? 600) as number;
    const amount = asNum(args.amount) ?? 0.8;
    let x = vw / 2;
    let y = vh / 2;
    if (refArg) ({ x, y } = await this.center(page, refArg));
    const dir = direction ?? "down";
    const deltaY =
      dir === "down" ? vh * amount : dir === "up" ? -vh * amount : 0;
    const deltaX =
      dir === "right" ? vw * amount : dir === "left" ? -vw * amount : 0;
    await page.sendInput("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX,
      deltaY,
    });
    return `scrolled ${dir} ${amount} viewport`;
  }

  private async drag(page: PageSession, args: Args): Promise<string> {
    const from = asStr(args.from)
      ? await this.center(page, String(args.from))
      : { x: asNum(args.fromX), y: asNum(args.fromY) };
    const to = asStr(args.to)
      ? await this.center(page, String(args.to))
      : { x: asNum(args.toX), y: asNum(args.toY) };
    if (
      from.x === undefined ||
      from.y === undefined ||
      to.x === undefined ||
      to.y === undefined
    ) {
      throw new AgentError(
        "drag requires from/to refs or coordinates",
        "invalid",
      );
    }
    await page.sendInput("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from.x,
      y: from.y,
    });
    await page.sendInput("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: from.x,
      y: from.y,
      button: "left",
      clickCount: 1,
      buttons: 1,
    });
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await page.sendInput("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
        button: "left",
        buttons: 1,
      });
    }
    await page.sendInput("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: to.x,
      y: to.y,
      button: "left",
      clickCount: 1,
    });
    return "dragged (pointer events; native HTML5 drag-and-drop not synthesized)";
  }

  private async select(
    page: PageSession,
    ref: string,
    value: string,
  ): Promise<string> {
    const node = await this.node(page, ref);
    const res = await page.send("Runtime.callFunctionOn", {
      objectId: node.objectId,
      returnByValue: true,
      arguments: [{ value }],
      functionDeclaration: `function(v){ if (this.tagName !== "SELECT") return "not-select"; const o = [...this.options].find(o => o.value === v || o.label === v || o.text.trim() === v); if (!o) return "no-option"; this.value = o.value; this.dispatchEvent(new Event("input", {bubbles:true})); this.dispatchEvent(new Event("change", {bubbles:true})); return "ok"; }`,
    });
    const outcome = res.result?.value;
    if (outcome === "not-select")
      throw new AgentError(`${ref} is not a <select>`, "invalid");
    if (outcome === "no-option")
      throw new AgentError(`no option "${value}" in ${ref}`, "invalid");
    return `selected "${value}" in ${ref}`;
  }

  private async tabs(args: Args): Promise<{ summary: string; data?: unknown }> {
    const op = String(args.op);
    if (op === "list") {
      const list = await this.backend.list();
      return {
        summary: `${list.length} tab(s)`,
        data: list.map((t) => ({ ...t, active: t.id === this.activeId })),
      };
    }
    if (op === "new") {
      const id = await this.backend.create(asStr(args.url) ?? "about:blank");
      await this.use(id);
      await this.backend.activate(id).catch(() => undefined);
      return { summary: `opened tab ${id}`, data: { id } };
    }
    const id = asStr(args.id);
    if (!id) throw new AgentError(`tabs ${op} requires id`, "invalid");
    if (op === "switch") {
      await this.use(id);
      await this.backend.activate(id);
      return { summary: `switched to ${id}` };
    }
    await this.backend.close(id);
    this.pages.get(id)?.dispose();
    this.pages.delete(id);
    if (this.activeId === id) this.activeId = undefined;
    return { summary: `closed ${id}` };
  }

  private async waitFor(page: PageSession, args: Args): Promise<string> {
    const timeout = asNum(args.timeoutMs) ?? 10_000;
    const ms = asNum(args.ms);
    if (
      ms !== undefined &&
      !args.text &&
      !args.textGone &&
      !args.selector &&
      !args.urlIncludes
    ) {
      await sleep(Math.min(ms, timeout));
      return `waited ${ms}ms`;
    }
    const cond = {
      text: asStr(args.text),
      textGone: asStr(args.textGone),
      selector: asStr(args.selector),
      url: asStr(args.urlIncludes),
    };
    // One in-page promise driven by MutationObserver: no polling round-trips.
    const expression = `new Promise((resolve) => {
      const c = ${JSON.stringify(cond)};
      const ok = () => (!c.text || document.body && document.body.innerText.includes(c.text))
        && (!c.textGone || !(document.body && document.body.innerText.includes(c.textGone)))
        && (!c.selector || document.querySelector(c.selector))
        && (!c.url || location.href.includes(c.url));
      if (ok()) return resolve(true);
      const mo = new MutationObserver(() => { if (ok()) { mo.disconnect(); clearTimeout(t); resolve(true); } });
      mo.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true});
      const t = setTimeout(() => { mo.disconnect(); resolve(false); }, ${timeout});
    })`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const matched = await page.evaluate<boolean>(expression, true);
        if (!matched)
          throw new AgentError(
            `wait_for timed out after ${timeout}ms`,
            "timeout",
          );
        return "condition met";
      } catch (error) {
        if (error instanceof AgentError) throw error;
        await sleep(50); // execution context destroyed by navigation: retry in the new document
      }
    }
    throw new AgentError("wait_for failed across navigations", "failed");
  }

  private async extract(page: PageSession, args: Args): Promise<unknown> {
    const format = asStr(args.format) ?? "text";
    const maxChars = asNum(args.maxChars) ?? 8000;
    const fn = `function(){ const el = this && this.nodeType ? this : document.body; ${
      format === "links"
        ? `return [...el.querySelectorAll("a[href]")].slice(0,200).map(a => ({text:(a.innerText||a.getAttribute("aria-label")||"").trim().slice(0,120), href:a.href}));`
        : format === "html"
          ? `return el.outerHTML.slice(0, ${maxChars});`
          : `return (el.innerText || el.textContent || "").slice(0, ${maxChars});`
    } }`;
    const refArg = asStr(args.ref);
    const selector = asStr(args.selector);
    let objectId: string | undefined;
    if (refArg) objectId = (await this.node(page, refArg)).objectId;
    else if (selector) {
      const found = await page.send("Runtime.evaluate", {
        expression: `document.querySelector(${JSON.stringify(selector)})`,
      });
      objectId = found.result?.objectId;
      if (!objectId)
        throw new AgentError(`selector matched nothing: ${selector}`, "failed");
    }
    if (objectId) {
      const res = await page.send("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: fn,
        returnByValue: true,
      });
      return res.result?.value;
    }
    return page.evaluate(`(${fn}).call(document.body)`);
  }

  async dispose(): Promise<void> {
    for (const page of this.pages.values()) page.dispose();
    this.pages.clear();
  }
}

function ms(t0: number): number {
  return Math.round(performance.now() - t0);
}

export { waitForEvent };
