/**
 * Zero-dependency MCP (Model Context Protocol) server over JSON-RPC 2.0.
 * Transports: newline-delimited stdio and Streamable HTTP (JSON responses,
 * session header, no server-initiated stream). Built on web streams and
 * `Request`/`Response`; the host chooses where to mount `fetch`.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export class McpError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpServerOptions {
  /** Advertised in `initialize`; keys are derived from registered handlers when omitted. */
  capabilities?: Record<string, object>;
  instructions?: string;
}

export type RequestHandler = (
  params: any,
  request: JsonRpcRequest,
) => unknown | Promise<unknown>;

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export class McpServer {
  private readonly handlers = new Map<string, RequestHandler>();
  private readonly sessions = new Set<string>();
  private clientProtocol?: string;
  clientInfo?: { name?: string; version?: string };

  constructor(
    readonly info: McpServerInfo,
    readonly options: McpServerOptions = {},
  ) {}

  /** Register a method handler, e.g. `tools/list`, `tools/call`, `prompts/get`. */
  setRequestHandler(method: string, handler: RequestHandler): this {
    this.handlers.set(method, handler);
    return this;
  }

  private capabilities(): Record<string, object> {
    if (this.options.capabilities) return this.options.capabilities;
    const caps: Record<string, object> = {};
    for (const method of this.handlers.keys()) {
      const ns = method.split("/")[0]!;
      if (
        ["tools", "prompts", "resources", "logging", "completion"].includes(ns)
      )
        caps[ns] = {};
    }
    return caps;
  }

  /** Process one JSON-RPC message (request or notification). Returns undefined for notifications. */
  async handleMessage(message: unknown): Promise<JsonRpcResponse | undefined> {
    if (
      !isObject(message) ||
      message.jsonrpc !== "2.0" ||
      typeof message.method !== "string"
    ) {
      // A response from the peer (we never send server requests) or garbage.
      if (isObject(message) && ("result" in message || "error" in message))
        return undefined;
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: ErrorCode.InvalidRequest, message: "Invalid Request" },
      };
    }
    const request = message as unknown as JsonRpcRequest;
    const isNotification = request.id === undefined || request.id === null;
    try {
      const result = await this.dispatch(request);
      return isNotification
        ? undefined
        : { jsonrpc: "2.0", id: request.id!, result };
    } catch (error) {
      if (isNotification) return undefined;
      if (error instanceof McpError) {
        return {
          jsonrpc: "2.0",
          id: request.id!,
          error: {
            code: error.code,
            message: error.message,
            ...(error.data !== undefined ? { data: error.data } : {}),
          },
        };
      }
      const msg = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: "2.0",
        id: request.id!,
        error: { code: ErrorCode.InternalError, message: msg },
      };
    }
  }

  private async dispatch(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case "initialize": {
        const requested = request.params?.protocolVersion;
        this.clientProtocol = (
          SUPPORTED_PROTOCOL_VERSIONS as readonly string[]
        ).includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
        this.clientInfo = request.params?.clientInfo;
        return {
          protocolVersion: this.clientProtocol,
          capabilities: this.capabilities(),
          serverInfo: this.info,
          ...(this.options.instructions
            ? { instructions: this.options.instructions }
            : {}),
        };
      }
      case "ping":
        return {};
      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/roots/list_changed":
        return undefined;
    }
    const handler = this.handlers.get(request.method);
    if (!handler) {
      if (request.method.startsWith("notifications/")) return undefined;
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Method not found: ${request.method}`,
      );
    }
    return await handler(request.params ?? {}, request);
  }

  /** Process a JSON body that may be a single message or a batch. */
  async handleBody(
    body: unknown,
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | undefined> {
    if (Array.isArray(body)) {
      if (body.length === 0)
        return {
          jsonrpc: "2.0",
          id: null,
          error: { code: ErrorCode.InvalidRequest, message: "Invalid Request" },
        };
      const out = (
        await Promise.all(body.map((m) => this.handleMessage(m)))
      ).filter((r): r is JsonRpcResponse => r !== undefined);
      return out.length ? out : undefined;
    }
    return this.handleMessage(body);
  }

  /**
   * Serve newline-delimited JSON-RPC. Resolves when `input` ends and in-flight
   * requests have been answered.
   */
  async serveStdio(
    input: ReadableStream<Uint8Array> = Bun.stdin.stream(),
    write: (line: string) => void = (() => {
      const w = Bun.stdout.writer();
      return (line: string) => {
        void w.write(line);
        void w.flush();
      };
    })(),
  ): Promise<void> {
    const pending = new Set<Promise<void>>();
    const send = (r: unknown) => write(`${JSON.stringify(r)}\n`);
    const onLine = (line: string) => {
      if (!line.trim()) return;
      let body: unknown;
      try {
        body = JSON.parse(line);
      } catch {
        send({
          jsonrpc: "2.0",
          id: null,
          error: { code: ErrorCode.ParseError, message: "Parse error" },
        });
        return;
      }
      const task = this.handleBody(body).then((r) => {
        if (r !== undefined) send(r);
      });
      pending.add(task);
      void task.finally(() => pending.delete(task));
    };
    let buffer = "";
    const decoder = new TextDecoder();
    for await (const chunk of input) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        onLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    buffer += decoder.decode();
    onLine(buffer);
    await Promise.all(pending);
  }

  /**
   * Streamable HTTP endpoint. POST carries JSON-RPC; the session id is issued
   * on `initialize` and required afterwards. GET returns 405 (no server stream);
   * DELETE ends the session.
   */
  async fetch(request: Request): Promise<Response> {
    const json = (
      body: unknown,
      status = 200,
      headers: Record<string, string> = {},
    ) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      });
    const rpcError = (status: number, code: number, message: string) =>
      json({ jsonrpc: "2.0", id: null, error: { code, message } }, status);

    if (request.method === "GET")
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "POST, DELETE" },
      });
    const sessionId = request.headers.get("mcp-session-id");
    if (request.method === "DELETE") {
      if (!sessionId || !this.sessions.delete(sessionId))
        return new Response("Not Found", { status: 404 });
      return new Response(null, { status: 200 });
    }
    if (request.method !== "POST")
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "POST, DELETE" },
      });

    const accept = request.headers.get("accept") ?? "";
    if (
      accept &&
      !accept.includes("application/json") &&
      !accept.includes("*/*") &&
      !accept.includes("text/event-stream")
    ) {
      return rpcError(406, -32000, "Not Acceptable: expected application/json");
    }
    if (
      !(request.headers.get("content-type") ?? "").includes("application/json")
    ) {
      return rpcError(
        415,
        -32000,
        "Unsupported Media Type: expected application/json",
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return rpcError(400, ErrorCode.ParseError, "Parse error");
    }
    const messages = Array.isArray(body) ? body : [body];
    const hasInitialize = messages.some(
      (m) => isObject(m) && m.method === "initialize",
    );
    if (hasInitialize && messages.length > 1)
      return rpcError(
        400,
        ErrorCode.InvalidRequest,
        "Only one initialization request is allowed",
      );

    let newSession: string | undefined;
    if (hasInitialize) {
      newSession = crypto.randomUUID();
    } else if (!sessionId) {
      return rpcError(
        400,
        -32000,
        "Bad Request: Mcp-Session-Id header is required",
      );
    } else if (!this.sessions.has(sessionId)) {
      return rpcError(404, -32001, "Session not found");
    }

    const result = await this.handleBody(body);
    if (newSession && result && !Array.isArray(result) && !result.error)
      this.sessions.add(newSession);
    else newSession = undefined;
    if (result === undefined) return new Response(null, { status: 202 });
    return json(
      result,
      200,
      newSession ? { "mcp-session-id": newSession } : {},
    );
  }
}
