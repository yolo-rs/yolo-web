// SPDX-License-Identifier: Apache-2.0
/**
 * Bridge server (Bun.serve): the same tool surface over
 *  - POST /mcp        MCP streamable HTTP (JSON or single-event SSE reply)
 *  - WS   /events     streaming events (server.publish), approvals, tool calls, agent runs
 *  - WS   /ext        the MV3 extension registers here as the tool executor (driver=extension)
 * MCP over stdio is served by `serveStdio` in mcp.ts with the same handler.
 *
 * Security: loopback bind only, bearer token on every route except /health,
 * Host and Origin checks against DNS rebinding and web pages, and an
 * approval round trip for gated actions when the autonomy level requires it.
 */
import { timingSafeEqual } from "node:crypto";
import { type CallContext, McpHandler, type ToolBackend } from "./mcp.ts";
import type { ModelClient } from "./model.ts";
import { runAgent } from "./loop.ts";
import { type Autonomy, isLoopbackHost, resolveAutonomy } from "./safety.ts";
import {
  type AgentSession,
  type ToolDescriptor,
  type ToolResult,
  allTools,
} from "./tools.ts";

export interface BridgeOptions {
  host?: string;
  port?: number;
  token?: string;
  desktopToken?: string;
  /** Tool executor: an AgentSession backend (CDP driver) or an ExtensionBackend (extension driver). */
  backend: ToolBackend;
  /** CDP-driver session; enables /events "run" and the approval round trip. */
  session?: AgentSession;
  model?: ModelClient;
  driver: "cdp" | "extension";
  /** Whether --nhitl was passed for this process. Needed to switch autonomy to nhitl at runtime. */
  nhitlOptIn: boolean;
  approvalTimeoutMs?: number;
  /** Set by the extension driver: handles `run` and `autonomy` requests. */
  extension?: ExtensionBackend;
}

export interface BridgeHandle {
  url: string;
  host: string;
  port: number;
  token: string;
  desktopToken: string;
  stop(): Promise<void>;
}

function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString(
    "hex",
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type WsData = { kind: "events" | "ext" };

/** Executes tools in the extension over its WebSocket. */
export class ExtensionBackend implements ToolBackend {
  private socket: Bun.ServerWebSocket<WsData> | undefined;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (r: ToolResult) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  attach(socket: Bun.ServerWebSocket<WsData> | undefined): void {
    this.socket = socket;
    if (!socket)
      for (const [id, p] of this.pending)
        (clearTimeout(p.timer),
          p.reject(new Error("extension disconnected")),
          this.pending.delete(id));
  }

  get connected(): boolean {
    return this.socket !== undefined;
  }

  tools(): ToolDescriptor[] {
    // chrome.debugger does not expose the Tracing domain to extensions.
    return allTools().filter((t) => t.name !== "trace_performance");
  }

  resolve(id: number, result: ToolResult): void {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(result);
  }

  call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const socket = this.socket;
    if (!socket)
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: "ERROR: extension is not connected to the bridge",
          },
        ],
        isError: true,
        ms: 0,
      });
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`extension call timeout: ${name}`));
      }, 120_000);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ type: "call", id, name, args }));
    });
  }

  send(message: unknown): boolean {
    if (!this.socket) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
}

export function startBridge(options: BridgeOptions): BridgeHandle {
  const host = options.host ?? "127.0.0.1";
  if (!isLoopbackHost(host))
    throw new Error(`bridge binds loopback only (got ${host})`);
  const token = options.token ?? randomToken();
  const desktopToken = options.desktopToken ?? randomToken();
  const pendingApprovals = new Map<string, (approved: boolean) => void>();
  let approvalSeq = 0;
  let server!: Bun.Server<WsData>;

  const publish = (event: Record<string, unknown>) =>
    server.publish("events", JSON.stringify(event));

  if (options.session) {
    options.session.setApprover(
      (request) =>
        new Promise<boolean>((resolve) => {
          if (server.subscriberCount("events") === 0) return resolve(false); // nobody to ask: deny
          const id = `a${++approvalSeq}`;
          const timer = setTimeout(() => {
            pendingApprovals.delete(id);
            resolve(false);
          }, options.approvalTimeoutMs ?? 60_000);
          pendingApprovals.set(
            id,
            (approved) => (clearTimeout(timer), resolve(approved)),
          );
          publish({ type: "approval_request", id, ...request });
        }),
    );
  }

  const hostOk = (req: Request): boolean => {
    const hostHeader = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
    return isLoopbackHost(hostHeader);
  };
  const originOk = (req: Request): boolean => {
    const origin = req.headers.get("origin");
    if (!origin) return true; // non-browser clients
    return (
      origin.startsWith("chrome-extension://") ||
      /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin)
    );
  };
  const authed = (req: Request, url: URL): boolean => {
    const header = req.headers.get("authorization");
    const given = header?.startsWith("Bearer ")
      ? header.slice(7)
      : (url.searchParams.get("token") ?? "");
    return given.length > 0 && safeEqual(given, token);
  };

  const runBackend = async (
    name: string,
    args: Record<string, unknown>,
    ctx: CallContext,
  ): Promise<ToolResult> => {
    publish({ type: "tool_start", name });
    const result = await options.backend.call(name, args, ctx);
    publish({ type: "tool_end", name, ms: result.ms, isError: result.isError });
    return result;
  };
  const instrumented: ToolBackend = {
    tools: () => options.backend.tools(),
    call: runBackend,
  };
  const mcp = new McpHandler(instrumented);

  server = Bun.serve<WsData>({
    hostname: host,
    port: options.port ?? 0,
    async fetch(req, srv) {
      const url = new URL(req.url);
      if (!hostOk(req)) return new Response("bad host", { status: 421 });
      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          name: "yolo-agent-bridge",
          driver: options.driver,
          extensionConnected: options.extension?.connected ?? null,
        });
      }
      if (!originOk(req))
        return new Response("forbidden origin", { status: 403 });
      if (!authed(req, url))
        return new Response("unauthorized", {
          status: 401,
          headers: { "www-authenticate": "Bearer" },
        });

      if (url.pathname === "/events" || url.pathname === "/ext") {
        if (url.pathname === "/ext" && !options.extension)
          return new Response("extension driver not enabled", { status: 404 });
        if (
          srv.upgrade(req, {
            data: { kind: url.pathname === "/ext" ? "ext" : "events" },
          })
        )
          return undefined;
        return new Response("websocket upgrade required", { status: 426 });
      }

      if (url.pathname === "/mcp") {
        if (req.method === "GET" || req.method === "DELETE")
          return new Response("no server-initiated stream", { status: 405 });
        if (req.method !== "POST")
          return new Response("method not allowed", { status: 405 });
        const ctx: CallContext = {
          desktopAuthorized:
            req.headers.get("x-yolo-desktop-token") === desktopToken,
        };
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "parse error" },
            },
            { status: 400 },
          );
        }
        const batch = Array.isArray(body) ? body : [body];
        const responses = (
          await Promise.all(batch.map((m) => mcp.handle(m as never, ctx)))
        ).filter((r) => r !== undefined);
        if (responses.length === 0) return new Response(null, { status: 202 });
        const payload = Array.isArray(body) ? responses : responses[0];
        if (
          (req.headers.get("accept") ?? "").includes("text/event-stream") &&
          !(req.headers.get("accept") ?? "").includes("application/json")
        ) {
          return new Response(
            `event: message\ndata: ${JSON.stringify(payload)}\n\n`,
            {
              headers: {
                "content-type": "text/event-stream",
                "cache-control": "no-store",
              },
            },
          );
        }
        return Response.json(payload);
      }
      return new Response("not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        if (ws.data.kind === "events") {
          ws.subscribe("events");
          ws.send(
            JSON.stringify({
              type: "hello",
              driver: options.driver,
              autonomy: options.session?.autonomy,
              tools: options.backend.tools().map((t) => t.name),
            }),
          );
        } else {
          options.extension?.attach(ws);
          publish({ type: "extension", connected: true });
        }
      },
      close(ws) {
        if (ws.data.kind === "ext") {
          options.extension?.attach(undefined);
          publish({ type: "extension", connected: false });
        }
      },
      async message(ws, raw) {
        let msg: Record<string, any>;
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (ws.data.kind === "ext") {
          if (msg.type === "result")
            options.extension?.resolve(msg.id, msg.result);
          else if (msg.type === "event") {
            publish(msg.event); // extension-side streaming (text, steps) fans out to subscribers
            if (
              msg.event?.type === "approval_request" &&
              !msg.event.panel &&
              server.subscriberCount("events") === 0
            ) {
              // Nobody connected can approve: deny now instead of waiting for the timeout.
              options.extension?.send({
                type: "approval_response",
                id: msg.event.id,
                approved: false,
              });
            }
          } else if (msg.type === "ping")
            ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        switch (msg.type) {
          case "approval_response":
            if (pendingApprovals.has(msg.id)) {
              pendingApprovals.get(msg.id)?.(msg.approved === true);
              pendingApprovals.delete(msg.id);
            } else {
              // Approval raised inside the extension (driver=extension).
              options.extension?.send({
                type: "approval_response",
                id: msg.id,
                approved: msg.approved === true,
              });
            }
            break;
          case "call": {
            const result = await runBackend(String(msg.name), msg.args ?? {}, {
              desktopAuthorized: false,
            });
            ws.send(JSON.stringify({ type: "result", id: msg.id, result }));
            break;
          }
          case "autonomy": {
            try {
              const level = resolveAutonomy(msg.level as Autonomy, {
                nhitlOptIn: options.nhitlOptIn,
              });
              if (options.session) options.session.autonomy = level;
              options.extension?.send({ type: "autonomy", level });
              publish({ type: "autonomy", level });
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message:
                    error instanceof Error ? error.message : String(error),
                }),
              );
            }
            break;
          }
          case "run": {
            if (options.extension) {
              if (
                !options.extension.send({
                  type: "run",
                  goal: msg.goal,
                  screenshot: msg.screenshot === true,
                })
              )
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "extension is not connected",
                  }),
                );
              break;
            }
            if (!options.session || !options.model) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message:
                    "agent runs need a model client (set ANTHROPIC_API_KEY)",
                }),
              );
              break;
            }
            publish({ type: "run_start", goal: String(msg.goal) });
            const run = await runAgent(String(msg.goal), {
              model: options.model,
              session: options.session,
              screenshot: msg.screenshot === true,
              onText: (text) => publish({ type: "text", text }),
              onStep: (step) => publish({ type: "step", ...step }),
            });
            publish({
              type: "run_end",
              stopped: run.stopped,
              error: run.error,
              turns: run.turns,
              totalMs: run.totalMs,
              finalText: run.finalText,
            });
            break;
          }
          default:
            break;
        }
      },
    },
  });

  return {
    url: `http://${host}:${server.port}`,
    host,
    port: server.port as number,
    token,
    desktopToken,
    async stop() {
      await server.stop(true);
    },
  };
}
