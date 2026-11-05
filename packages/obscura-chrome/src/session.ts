/**
 * One flattened CDP session on a page target of a yolo-chromium (or any
 * Chromium) browser, with load waiting and crash detection.
 */

import { YoloCdpClient } from "@yolo-web/cdp-client";

export interface ConsoleEntry {
  source: "console" | "exception" | "log";
  level: string;
  text: string;
  url?: string;
}

export interface LoadResult {
  /** `closed`: the page closed its own tab (WebUI dialogs do). */
  /** `browser-exited`: the whole browser went away while loading the page. */
  status:
    "loaded" | "error" | "timeout" | "crashed" | "closed" | "browser-exited";
  errorText?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PageSession {
  readonly client: YoloCdpClient;
  targetId = "";
  sessionId = "";
  crashed = false;
  /** The attached target was closed (some WebUI dialogs close themselves). */
  closed = false;
  /** Create a new target instead of reusing an existing page. */
  private createTargets = false;
  viewport = { width: 1280, height: 800 };
  private loadWaiters = new Set<() => void>();
  readonly console: ConsoleEntry[] = [];

  private constructor(client: YoloCdpClient) {
    this.client = client;
    client.on("Page.loadEventFired", (_params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      for (const waiter of this.loadWaiters) waiter();
    });
    client.on("Target.detachedFromTarget", (params) => {
      if (params.sessionId !== this.sessionId) return;
      this.closed = true;
      for (const waiter of this.loadWaiters) waiter();
    });
    client.on("Inspector.targetCrashed", (_params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      this.crashed = true;
      for (const waiter of this.loadWaiters) waiter();
    });
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      const type = String(params.type ?? "");
      if (type !== "error" && type !== "assert") return;
      const args = Array.isArray(params.args) ? params.args : [];
      const text = args
        .map((arg: Record<string, unknown>) =>
          String(arg.value ?? arg.description ?? arg.type ?? ""),
        )
        .join(" ");
      this.console.push({ source: "console", level: type, text });
    });
    client.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      const details = (params.exceptionDetails ?? {}) as Record<
        string,
        unknown
      >;
      const exception = (details.exception ?? {}) as Record<string, unknown>;
      this.console.push({
        source: "exception",
        level: "error",
        text: String(exception.description ?? details.text ?? "exception"),
        url: typeof details.url === "string" ? details.url : undefined,
      });
    });
    client.on("Log.entryAdded", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      const entry = (params.entry ?? {}) as Record<string, unknown>;
      if (entry.level !== "error") return;
      this.console.push({
        source: "log",
        level: "error",
        text: String(entry.text ?? ""),
        url: typeof entry.url === "string" ? entry.url : undefined,
      });
    });
  }

  /**
   * Connects to the browser endpoint and attaches to a page target: the one
   * whose URL starts with `preferUrl`, else the first page, else a new one.
   * A `--headless` yolo-chromium exposes its windowless page as such a target;
   * `Target.createTarget` there would open a Chrome-style window, so it is
   * used only when no page exists or `createTarget` is set.
   */
  static async attach(
    endpoint: string,
    options: {
      preferUrl?: string;
      createTarget?: boolean;
      timeoutMs?: number;
    } = {},
  ): Promise<PageSession> {
    const client = await YoloCdpClient.connect({
      endpoint,
      timeoutMs: options.timeoutMs ?? 30_000,
    });
    const session = new PageSession(client);
    await session.attachTarget(options);
    return session;
  }

  async attachTarget(
    options: { preferUrl?: string; createTarget?: boolean } = {},
  ): Promise<void> {
    const { targetInfos } = await this.client.send<{
      targetInfos: Array<Record<string, unknown>>;
    }>("Target.getTargets");
    if (options.createTarget) this.createTargets = true;
    const pages = targetInfos.filter((info) => info.type === "page");
    let target =
      (options.preferUrl
        ? pages.find((info) => String(info.url).startsWith(options.preferUrl!))
        : undefined) ?? (options.createTarget ? undefined : pages[0]);
    let targetId = target ? String(target.targetId) : "";
    if (!targetId) {
      const created = await this.client.send<{ targetId: string }>(
        "Target.createTarget",
        {
          url: "about:blank",
        },
      );
      targetId = created.targetId;
    }
    const { sessionId } = await this.client.send<{ sessionId: string }>(
      "Target.attachToTarget",
      {
        targetId,
        flatten: true,
      },
    );
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.crashed = false;
    this.closed = false;
    await Promise.all([
      this.send("Page.enable"),
      this.send("Runtime.enable"),
      this.send("Log.enable"),
      this.send("Inspector.enable").catch(() => undefined),
    ]);
    // Fixed viewport so screenshots do not depend on the host window size.
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: this.viewport.width,
      height: this.viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    }).catch(() => undefined);
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    return this.client.send<T>(method, params, this.sessionId);
  }

  async evaluate<T>(expression: string, awaitPromise = true): Promise<T> {
    const result = await this.send<{
      result?: { value?: T };
      exceptionDetails?: {
        text?: string;
        exception?: { description?: string };
      };
    }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "evaluation failed",
      );
    }
    return result.result?.value as T;
  }

  /**
   * Navigates the attached page and waits for `load`, then `settleMs` for
   * WebUI pages that render asynchronously (Lit/Polymer, Mojo round trips).
   */
  async navigate(
    url: string,
    timeoutMs = 20_000,
    settleMs = 750,
  ): Promise<LoadResult> {
    if (this.closed)
      await this.attachTarget({ createTarget: this.createTargets });
    else if (this.crashed) await this.recover();
    this.console.length = 0;
    let fired = false;
    let wake: () => void = () => undefined;
    const loaded = new Promise<void>((resolve) => {
      wake = () => {
        fired = true;
        resolve();
      };
      this.loadWaiters.add(wake);
    });
    try {
      const response = await this.send<{ errorText?: string }>(
        "Page.navigate",
        { url },
      );
      if (response.errorText)
        return { status: "error", errorText: response.errorText };
      await Promise.race([loaded, sleep(timeoutMs)]);
    } catch (error) {
      if (this.crashed) return { status: "crashed" };
      if (this.closed) return { status: "closed" };
      return {
        status: "error",
        errorText: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.loadWaiters.delete(wake);
    }
    if (this.crashed) return { status: "crashed" };
    if (this.closed) return { status: "closed" };
    if (!fired) return { status: "timeout" };
    await sleep(settleMs);
    if (this.closed) return { status: "closed" };
    return this.crashed ? { status: "crashed" } : { status: "loaded" };
  }

  /** Whether the browser still answers on the DevTools connection. */
  async alive(timeoutMs = 3_000): Promise<boolean> {
    try {
      await Promise.race([
        this.client.send("Browser.getVersion", {}, ""),
        sleep(timeoutMs).then(() => {
          throw new Error("timeout");
        }),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /** Brings a crashed page back by navigating it to about:blank. */
  async recover(): Promise<void> {
    this.crashed = false;
    try {
      await this.send("Page.navigate", { url: "about:blank" });
      await sleep(500);
    } catch {
      await this.attachTarget();
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
