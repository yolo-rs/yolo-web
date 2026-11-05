// SPDX-License-Identifier: Apache-2.0
/**
 * Minimal CDP transport abstraction. The same agent core runs over a raw
 * WebSocket (Bun host, `--remote-debugging-port`) and over `chrome.debugger`
 * (extension service worker); only the transport differs.
 */

export type CdpParams = Record<string, unknown>;
// biome-ignore lint/suspicious/noExplicitAny: CDP results are protocol-defined JSON
export type CdpResult = any;
export type CdpListener = (params: CdpResult, sessionId?: string) => void;

export interface CdpTransport {
  send(
    method: string,
    params?: CdpParams,
    sessionId?: string,
  ): Promise<CdpResult>;
  on(event: string, listener: CdpListener): () => void;
  close(): void;
}

export class CdpError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    message: string,
  ) {
    super(`${method}: ${message} (${code})`);
    this.name = "CdpError";
  }
}

interface Pending {
  method: string;
  resolve: (value: CdpResult) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Shared event fan-out for transports. */
export abstract class BaseTransport implements CdpTransport {
  protected readonly listeners = new Map<string, Set<CdpListener>>();
  abstract send(
    method: string,
    params?: CdpParams,
    sessionId?: string,
  ): Promise<CdpResult>;
  abstract close(): void;

  on(event: string, listener: CdpListener): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    const target = set;
    target.add(listener);
    return () => target.delete(listener);
  }

  protected emit(event: string, params: CdpResult, sessionId?: string): void {
    const direct = this.listeners.get(event);
    if (direct) {
      for (const listener of direct) {
        try {
          listener(params, sessionId);
        } catch {
          // a faulty listener must not break the dispatch loop
        }
      }
    }
  }
}

export class WsCdpTransport extends BaseTransport {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private constructor(
    private readonly ws: WebSocket,
    private readonly timeoutMs: number,
  ) {
    super();
    ws.addEventListener("message", (event) =>
      this.onMessage(String(event.data)),
    );
    ws.addEventListener("close", () =>
      this.failAll(new Error("CDP socket closed")),
    );
  }

  /** Connects to a `ws://` URL, or resolves the browser endpoint from `http://host:port`. */
  static async connect(
    endpoint: string,
    timeoutMs = 15_000,
  ): Promise<WsCdpTransport> {
    let url = endpoint;
    if (!/^wss?:/i.test(endpoint)) {
      const response = await fetch(
        `${endpoint.replace(/\/$/, "")}/json/version`,
        {
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok)
        throw new Error(`CDP /json/version returned HTTP ${response.status}`);
      const info = (await response.json()) as { webSocketDebuggerUrl?: string };
      if (!info.webSocketDebuggerUrl)
        throw new Error("CDP endpoint has no webSocketDebuggerUrl");
      url = info.webSocketDebuggerUrl;
    }
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CDP connect timeout: ${url}`)),
        timeoutMs,
      );
      ws.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      ws.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error(`CDP connect failed: ${url}`));
        },
        { once: true },
      );
    });
    return new WsCdpTransport(ws, timeoutMs);
  }

  send(
    method: string,
    params: CdpParams = {},
    sessionId?: string,
  ): Promise<CdpResult> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  }

  close(): void {
    this.ws.close();
  }

  private onMessage(raw: string): void {
    const msg = JSON.parse(raw) as {
      id?: number;
      result?: CdpResult;
      error?: { code: number; message: string };
      method?: string;
      params?: CdpResult;
      sessionId?: string;
    };
    if (msg.id !== undefined) {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error)
        entry.reject(
          new CdpError(entry.method, msg.error.code, msg.error.message),
        );
      else entry.resolve(msg.result ?? {});
    } else if (msg.method) {
      this.emit(msg.method, msg.params ?? {}, msg.sessionId);
    }
  }

  private failAll(error: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}

/** Waits for the first event matching `predicate`; rejects on timeout. */
export function waitForEvent(
  transport: CdpTransport,
  event: string,
  predicate: (params: CdpResult, sessionId?: string) => boolean,
  timeoutMs: number,
): Promise<CdpResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const off = transport.on(event, (params, sessionId) => {
      if (!predicate(params, sessionId)) return;
      clearTimeout(timer);
      off();
      resolve(params);
    });
  });
}
