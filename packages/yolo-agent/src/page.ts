// SPDX-License-Identifier: Apache-2.0
/** One attached page target: CDP session, event buffers, load tracking and refs. */
import type { CdpParams, CdpResult, CdpTransport } from "./cdp.ts";
import { RefRegistry } from "./observe.ts";

export interface ConsoleEntry {
  level: string;
  text: string;
  source: "console" | "exception" | "log";
  url?: string;
  line?: number;
  ts: number;
}

export interface NetworkEntry {
  id: string;
  url: string;
  type?: string;
  method?: string;
  status?: number;
  mimeType?: string;
  failed?: string;
  blocked?: string;
  encodedBytes?: number;
  start: number;
  end?: number;
}

export interface DialogInfo {
  type: string;
  message: string;
  defaultPrompt?: string;
}

const BUFFER_LIMIT = 400;

function push<T>(list: T[], item: T): void {
  list.push(item);
  if (list.length > BUFFER_LIMIT) list.shift();
}

export class PageSession {
  readonly registry = new RefRegistry();
  readonly consoleLog: ConsoleEntry[] = [];
  readonly network: NetworkEntry[] = [];
  private readonly netById = new Map<string, NetworkEntry>();
  dialog: DialogInfo | undefined;
  mainFrameId = "";
  loadSeq = 0;
  inflight = 0;
  /** Incremented by every mutating action; invalidates prefetched observations. */
  mutationSeq = 0;
  private readonly offs: Array<() => void> = [];
  private dialogWaiters: Array<() => void> = [];

  constructor(
    readonly transport: CdpTransport,
    readonly targetId: string,
    readonly sessionId?: string,
  ) {}

  send(method: string, params?: CdpParams): Promise<CdpResult> {
    return this.transport.send(method, params, this.sessionId);
  }

  /** Input commands can block while a JS dialog is open; resolve early when one opens. */
  async sendInput(method: string, params: CdpParams): Promise<void> {
    if (this.dialog) return;
    let wake: (() => void) | undefined;
    const dialogOpened = new Promise<void>((resolve) => {
      wake = resolve;
      this.dialogWaiters.push(resolve);
    });
    try {
      await Promise.race([this.send(method, params), dialogOpened]);
    } finally {
      this.dialogWaiters = this.dialogWaiters.filter((w) => w !== wake);
    }
  }

  private listen(event: string, handler: (params: CdpResult) => void): void {
    this.offs.push(
      this.transport.on(event, (params, sid) => {
        if (sid === this.sessionId) handler(params);
      }),
    );
  }

  async init(): Promise<void> {
    this.listen("Runtime.consoleAPICalled", (p) =>
      push(this.consoleLog, {
        level: String(p.type),
        text: (p.args ?? [])
          .map((a: CdpResult) => String(a.value ?? a.description ?? a.type))
          .join(" "),
        source: "console",
        url: p.stackTrace?.callFrames?.[0]?.url,
        line: p.stackTrace?.callFrames?.[0]?.lineNumber,
        ts: Date.now(),
      }),
    );
    this.listen("Runtime.exceptionThrown", (p) =>
      push(this.consoleLog, {
        level: "error",
        text: String(
          p.exceptionDetails?.exception?.description ??
            p.exceptionDetails?.text ??
            "exception",
        ),
        source: "exception",
        url: p.exceptionDetails?.url,
        line: p.exceptionDetails?.lineNumber,
        ts: Date.now(),
      }),
    );
    this.listen("Log.entryAdded", (p) =>
      push(this.consoleLog, {
        level: String(p.entry?.level),
        text: String(p.entry?.text),
        source: "log",
        url: p.entry?.url,
        line: p.entry?.lineNumber,
        ts: Date.now(),
      }),
    );
    this.listen("Network.requestWillBeSent", (p) => {
      this.inflight++;
      const entry: NetworkEntry = {
        id: p.requestId,
        url: p.request?.url,
        method: p.request?.method,
        type: p.type,
        start: Date.now(),
      };
      this.netById.set(p.requestId, entry);
      push(this.network, entry);
    });
    this.listen("Network.responseReceived", (p) => {
      const entry = this.netById.get(p.requestId);
      if (entry)
        Object.assign(entry, {
          status: p.response?.status,
          mimeType: p.response?.mimeType,
        });
    });
    this.listen("Network.loadingFinished", (p) => {
      this.inflight = Math.max(0, this.inflight - 1);
      const entry = this.netById.get(p.requestId);
      if (entry)
        Object.assign(entry, {
          end: Date.now(),
          encodedBytes: p.encodedDataLength,
        });
    });
    this.listen("Network.loadingFailed", (p) => {
      this.inflight = Math.max(0, this.inflight - 1);
      const entry = this.netById.get(p.requestId);
      if (entry)
        Object.assign(entry, {
          end: Date.now(),
          failed: p.errorText,
          blocked: p.blockedReason,
        });
    });
    this.listen("Page.frameNavigated", (p) => {
      if (!p.frame?.parentId) {
        this.registry.reset();
        this.consoleLog.length = 0;
        this.network.length = 0;
        this.netById.clear();
        this.inflight = 0;
      }
    });
    this.listen("Page.frameStoppedLoading", (p) => {
      if (p.frameId === this.mainFrameId) this.loadSeq++;
    });
    this.listen("Page.javascriptDialogOpening", (p) => {
      this.dialog = {
        type: p.type,
        message: p.message,
        defaultPrompt: p.defaultPrompt,
      };
      for (const wake of this.dialogWaiters) wake();
    });
    this.listen("Page.javascriptDialogClosed", () => {
      this.dialog = undefined;
    });

    await Promise.all([
      this.send("Page.enable"),
      this.send("Runtime.enable"),
      this.send("DOM.enable"),
      this.send("Network.enable"),
      this.send("Log.enable"),
      this.send("Accessibility.enable"),
    ]);
    const tree = await this.send("Page.getFrameTree");
    this.mainFrameId = tree.frameTree?.frame?.id ?? "";
  }

  /** Evaluates an expression in the page and returns its JSON value. */
  async evaluate<T = unknown>(
    expression: string,
    awaitPromise = false,
    timeout?: number,
  ): Promise<T> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
      ...(timeout ? { timeout } : {}),
    });
    if (res.exceptionDetails) {
      throw new Error(
        `page script failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`,
      );
    }
    return res.result?.value as T;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
