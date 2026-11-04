/**
 * @yolo-web/cdp-client
 * Pure Bun Chrome DevTools Protocol (CDP) WebSocket + HTTP client for Obscura & Yolo-Web.
 */

import {
  type CdpEvent,
  type CdpRequest,
  type CdpResponse,
  type CdpTargetInfo,
  type CdpVersionInfo,
  normalizeCdpHttpUrl,
  normalizeCdpWebSocketUrl,
} from "@yolo-web/shared";

export interface YoloCdpClientOptions {
  endpoint: string;
  token?: string;
  sessionId?: string;
  timeoutMs?: number;
}

export interface NavigateResult {
  frameId: string;
  loaderId?: string;
  errorText?: string;
}

export interface ScreenshotOptions {
  format?: "png" | "jpeg" | "webp";
  quality?: number;
  captureBeyondViewport?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale?: number;
  };
}

export interface PdfOptions {
  landscape?: boolean;
  printBackground?: boolean;
  scale?: number;
  paperWidth?: number;
  paperHeight?: number;
}

export interface MouseEventParams {
  type: "mousePressed" | "mouseReleased" | "mouseMoved" | "mouseWheel";
  x: number;
  y: number;
  button?: "none" | "left" | "middle" | "right";
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface KeyEventParams {
  type: "keyDown" | "keyUp" | "rawKeyDown" | "char";
  key?: string;
  text?: string;
  code?: string;
  windowsVirtualKeyCode?: number;
}

interface PendingCommand {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class YoloCdpClient implements AsyncDisposable {
  readonly wsUrl: string;
  readonly httpUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private sessionId?: string;
  private readonly pending = new Map<number, PendingCommand>();
  private readonly listeners = new Map<
    string,
    Set<(params: Record<string, unknown>, sessionId?: string) => void>
  >();

  constructor(options: YoloCdpClientOptions) {
    this.wsUrl = normalizeCdpWebSocketUrl(options.endpoint);
    this.httpUrl = normalizeCdpHttpUrl(options.endpoint);
    this.token = options.token ?? Bun.env.OBSCURA_CDP_TOKEN;
    this.sessionId = options.sessionId;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  static async connect(options: YoloCdpClientOptions): Promise<YoloCdpClient> {
    const client = new YoloCdpClient(options);
    await client.open();
    return client;
  }

  async open(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        this.wsUrl,
        this.token
          ? ({
              headers: { Authorization: `Bearer ${this.token}` },
            } as unknown as string[])
          : undefined,
      );

      const onOpen = () => {
        cleanup();
        this.ws = ws;
        this.bindSocket(ws);
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Failed to connect to CDP WebSocket: ${this.wsUrl}`));
      };

      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
      };

      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
    });
  }

  private bindSocket(ws: WebSocket): void {
    ws.addEventListener("message", (event) => {
      const raw =
        typeof event.data === "string" ? event.data : String(event.data);
      let msg: CdpResponse & Partial<CdpEvent>;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (typeof msg.id === "number") {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        clearTimeout(pending.timer);

        if (msg.error) {
          pending.reject(
            new Error(`CDP Error (${msg.error.code}): ${msg.error.message}`),
          );
        } else {
          pending.resolve(msg.result ?? {});
        }
        return;
      }

      if (typeof msg.method === "string") {
        const handlers = this.listeners.get(msg.method);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.params ?? {}, msg.sessionId);
          }
        }
      }
    });

    ws.addEventListener("close", () => {
      for (const [id, pending] of this.pending.entries()) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(`CDP WebSocket closed while awaiting command ${id}`),
        );
      }
      this.pending.clear();
    });
  }

  get activeSessionId(): string | undefined {
    return this.sessionId;
  }

  setSessionId(sessionId: string | undefined): void {
    this.sessionId = sessionId;
  }

  on(
    event: string,
    handler: (params: Record<string, unknown>, sessionId?: string) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  async send<TResult = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    sessionIdOverride?: string,
  ): Promise<TResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.open();
    }

    const id = this.nextId++;
    const payload: CdpRequest = {
      id,
      method,
      params,
      ...((sessionIdOverride ?? this.sessionId)
        ? { sessionId: sessionIdOverride ?? this.sessionId }
        : {}),
    };

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `CDP command timed out after ${this.timeoutMs}ms: ${method}`,
          ),
        );
      }, this.timeoutMs);

      this.pending.set(id, {
        resolve: (res) => resolve(res as TResult),
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(payload));
    });
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async listTargets(): Promise<CdpTargetInfo[]> {
    try {
      const res = await fetch(`${this.httpUrl}/json/list`, {
        headers: this.authHeaders(),
      });
      if (res.ok) {
        return (await res.json()) as CdpTargetInfo[];
      }
    } catch {
      // Fallback to WebSocket Target.getTargets
    }
    const { targetInfos } = await this.send<{ targetInfos: CdpTargetInfo[] }>(
      "Target.getTargets",
      {},
    );
    return targetInfos ?? [];
  }

  async getVersion(): Promise<CdpVersionInfo> {
    try {
      const res = await fetch(`${this.httpUrl}/json/version`, {
        headers: this.authHeaders(),
      });
      if (res.ok) {
        return (await res.json()) as CdpVersionInfo;
      }
    } catch {
      // Fallback to WebSocket Browser.getVersion
    }
    const info = await this.send<{
      product: string;
      protocolVersion: string;
      userAgent: string;
      jsVersion?: string;
    }>("Browser.getVersion", {});
    return {
      Browser: info.product,
      "Protocol-Version": info.protocolVersion,
      "User-Agent": info.userAgent,
      "V8-Version": info.jsVersion,
      webSocketDebuggerUrl: this.wsUrl,
    };
  }

  async createTarget(url = "about:blank"): Promise<string> {
    const { targetId } = await this.send<{ targetId: string }>(
      "Target.createTarget",
      { url },
    );
    return targetId;
  }

  async attachToTarget(targetId: string, flatten = true): Promise<string> {
    const { sessionId } = await this.send<{ sessionId: string }>(
      "Target.attachToTarget",
      { targetId, flatten },
    );
    this.sessionId = sessionId;
    return sessionId;
  }

  async navigate(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle0" },
  ): Promise<NavigateResult> {
    return this.send<NavigateResult>("Page.navigate", {
      url,
      ...(options?.waitUntil ? { waitUntil: options.waitUntil } : {}),
    });
  }

  async evaluate<T = unknown>(
    expression: string,
    options?: { awaitPromise?: boolean; returnByValue?: boolean },
  ): Promise<T> {
    const response = await this.send<{
      result: { type: string; value?: T; description?: string };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    }>("Runtime.evaluate", {
      expression,
      awaitPromise: options?.awaitPromise ?? true,
      returnByValue: options?.returnByValue ?? true,
    });

    if (response.exceptionDetails) {
      const detail =
        response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text;
      throw new Error(`Runtime.evaluate exception: ${detail}`);
    }

    return response.result.value as T;
  }

  async captureScreenshot(options?: ScreenshotOptions): Promise<Uint8Array> {
    const { data } = await this.send<{ data: string }>(
      "Page.captureScreenshot",
      {
        format: options?.format ?? "png",
        ...(options?.quality !== undefined ? { quality: options.quality } : {}),
        ...(options?.captureBeyondViewport !== undefined
          ? { captureBeyondViewport: options.captureBeyondViewport }
          : {}),
        ...(options?.clip ? { clip: options.clip } : {}),
      },
    );
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  }

  async printToPdf(options?: PdfOptions): Promise<Uint8Array> {
    const { data } = await this.send<{ data: string }>("Page.printToPDF", {
      landscape: options?.landscape ?? false,
      printBackground: options?.printBackground ?? true,
      ...(options?.scale !== undefined ? { scale: options.scale } : {}),
      ...(options?.paperWidth !== undefined
        ? { paperWidth: options.paperWidth }
        : {}),
      ...(options?.paperHeight !== undefined
        ? { paperHeight: options.paperHeight }
        : {}),
    });
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  }

  async dispatchMouseEvent(params: MouseEventParams): Promise<void> {
    await this.send("Input.dispatchMouseEvent", {
      type: params.type,
      x: params.x,
      y: params.y,
      button: params.button ?? "left",
      clickCount: params.clickCount ?? 1,
      ...(params.deltaX !== undefined ? { deltaX: params.deltaX } : {}),
      ...(params.deltaY !== undefined ? { deltaY: params.deltaY } : {}),
    });
  }

  async dispatchKeyEvent(params: KeyEventParams): Promise<void> {
    await this.send("Input.dispatchKeyEvent", { ...params });
  }

  async querySelectorAll(
    selector: string,
    rootNodeId?: number,
  ): Promise<number[]> {
    let nodeId = rootNodeId;
    if (nodeId === undefined) {
      const doc = await this.send<{ root: { nodeId: number } }>(
        "DOM.getDocument",
        {},
      );
      nodeId = doc.root.nodeId;
    }
    const { nodeIds } = await this.send<{ nodeIds: number[] }>(
      "DOM.querySelectorAll",
      {
        nodeId,
        selector,
      },
    );
    return nodeIds ?? [];
  }

  async close(): Promise<void> {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
