/**
 * High-performance Network Interception & Routing Engine.
 * Supports pattern matching (glob, regex, predicate), request mocking, headers manipulation, and blocking.
 */

import type { YoloCdpClient } from "@yolo-web/cdp-client";

export interface RouteResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  contentType?: string;
  body?: string | Uint8Array;
}

export interface RouteContinueOptions {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  postData?: string;
}

export interface InterceptedRequestInfo {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  resourceType: string;
}

export class Route {
  private readonly cdp: YoloCdpClient;
  readonly request: InterceptedRequestInfo;
  private handled = false;

  constructor(cdp: YoloCdpClient, request: InterceptedRequestInfo) {
    this.cdp = cdp;
    this.request = request;
  }

  /**
   * Fulfill the intercepted request with custom mock data.
   */
  async fulfill(options: RouteResponseOptions = {}): Promise<void> {
    if (this.handled) return;
    this.handled = true;

    const responseCode = options.status ?? 200;
    const responseHeaders: Array<{ name: string; value: string }> = [];

    const headers = { ...options.headers };
    if (options.contentType && !headers["content-type"] && !headers["Content-Type"]) {
      headers["Content-Type"] = options.contentType;
    }

    for (const [name, value] of Object.entries(headers)) {
      responseHeaders.push({ name, value: String(value) });
    }

    let base64Body: string | undefined;
    if (options.body) {
      if (typeof options.body === "string") {
        base64Body = Buffer.from(options.body, "utf8").toString("base64");
      } else {
        base64Body = Buffer.from(options.body).toString("base64");
      }
    }

    await this.cdp.send("Fetch.fulfillRequest", {
      requestId: this.request.requestId,
      responseCode,
      responseHeaders,
      ...(base64Body ? { body: base64Body } : {}),
    });
  }

  /**
   * Abort the intercepted request (e.g. Failed, Aborted, BlockedByClient).
   */
  async abort(errorCode = "Failed"): Promise<void> {
    if (this.handled) return;
    this.handled = true;
    await this.cdp.send("Fetch.failRequest", {
      requestId: this.request.requestId,
      errorReason: errorCode,
    });
  }

  /**
   * Continue request towards destination, optionally modifying url, method, headers, or body.
   */
  async continue(overrides: RouteContinueOptions = {}): Promise<void> {
    if (this.handled) return;
    this.handled = true;

    const params: Record<string, unknown> = {
      requestId: this.request.requestId,
    };

    if (overrides.url) params.url = overrides.url;
    if (overrides.method) params.method = overrides.method;
    if (overrides.postData) params.postData = overrides.postData;
    if (overrides.headers) {
      params.headers = Object.entries(overrides.headers).map(([name, value]) => ({
        name,
        value: String(value),
      }));
    }

    await this.cdp.send("Fetch.continueRequest", params);
  }
}

export type RoutePattern = string | RegExp | ((url: URL) => boolean);
export type RouteHandler = (route: Route) => void | Promise<void>;

export class RouteRegistry {
  private readonly rules: Array<{ pattern: RoutePattern; handler: RouteHandler }> = [];
  private fetchEnabled = false;

  add(pattern: RoutePattern, handler: RouteHandler): void {
    this.rules.unshift({ pattern, handler });
  }

  remove(pattern: RoutePattern): void {
    const idx = this.rules.findIndex((r) => r.pattern === pattern);
    if (idx !== -1) {
      this.rules.splice(idx, 1);
    }
  }

  clear(): void {
    this.rules.length = 0;
  }

  matches(urlStr: string): RouteHandler | undefined {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return undefined;
    }

    for (const rule of this.rules) {
      if (typeof rule.pattern === "string") {
        if (rule.pattern === urlStr || urlStr.includes(rule.pattern)) return rule.handler;
        // Simple glob pattern support (e.g. **/*.png or **/api/v1/user)
        if (rule.pattern.includes("*")) {
          const glob = rule.pattern.startsWith("*") ? rule.pattern : `*${rule.pattern}`;
          const regexStr = glob
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, ".*");
          if (new RegExp(`^${regexStr}$`).test(urlStr) || new RegExp(`^${regexStr}$`).test(parsed.pathname)) {
            return rule.handler;
          }
        }
      } else if (rule.pattern instanceof RegExp) {
        if (rule.pattern.test(urlStr)) return rule.handler;
      } else if (typeof rule.pattern === "function") {
        if (rule.pattern(parsed)) return rule.handler;
      }
    }
    return undefined;
  }

  get isEnabled(): boolean {
    return this.fetchEnabled;
  }

  set enabled(val: boolean) {
    this.fetchEnabled = val;
  }
}
