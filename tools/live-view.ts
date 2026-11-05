#!/usr/bin/env bun
/**
 * Obscura & Yolo-Web Live View Server (Pure Bun Runtime)
 *
 * Replaces legacy Node.js `node:http` / `node:child_process` live viewer with:
 * - `Bun.serve` for HTTP, Server-Sent Events (`/events`), and WebSockets (`/ws`)
 * - `Bun.spawn` for optional managed `obscura serve` subprocess lifecycle
 * - Native `WebSocket` CDP client for zero-dependency frame capture and human co-pilot input
 */

import type { ServerWebSocket } from "bun";

interface ViewerSocketData {
  connectedAt: number;
}

const CDP_PORT = Number(Bun.env.OBSCURA_CDP_PORT ?? "9222");
const CDP_HOST = Bun.env.OBSCURA_CDP_HOST ?? "127.0.0.1";
const VIEW_PORT = Number(Bun.env.OBSCURA_LIVE_VIEW_PORT ?? "8080");
const VIEW_HOST = Bun.env.OBSCURA_LIVE_VIEW_HOST ?? "127.0.0.1";
const CDP_TOKEN = Bun.env.OBSCURA_CDP_TOKEN;
const INITIAL_URL = Bun.env.OBSCURA_INITIAL_URL ?? "https://example.com";
const SHOULD_SPAWN = Bun.argv.includes("--spawn");

const HTML_VIEWER = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Yolo-Web / Obscura Live View (Bun)</title>
  <style>
    body { margin: 0; background: #0d1117; color: #e6edf3; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; }
    header { width: 100%; padding: 8px 16px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
    .badge { background: #238636; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    #frame { max-width: 100%; border: 1px solid #30363d; margin-top: 12px; cursor: crosshair; }
  </style>
</head>
<body>
  <header>
    <span><strong>Yolo-Web</strong> Live Agent Session Viewer</span>
    <span class="badge" id="status">Connecting...</span>
  </header>
  <img id="frame" alt="Current page">
  <script>
    const image = document.getElementById('frame');
    const status = document.getElementById('status');
    const events = new EventSource('/events');
    events.onopen = () => { status.textContent = 'Live (SSE)'; };
    events.onmessage = event => {
      image.src = 'data:image/jpeg;base64,' + event.data;
    };
    events.onerror = () => { status.textContent = 'Reconnecting...'; };
  </script>
</body>
</html>`;

export function spawnObscuraServer(binPath = "obscura", port = CDP_PORT) {
  return Bun.spawn([binPath, "serve", "--port", String(port)], {
    stdout: "inherit",
    stderr: "inherit",
  });
}

export async function startLiveViewServer(options?: {
  viewPort?: number;
  viewHost?: string;
}) {
  const sseControllers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const wsClients = new Set<ServerWebSocket<ViewerSocketData>>();
  const encoder = new TextEncoder();
  let latestFrameBase64: string | null = null;

  const broadcastFrame = (base64Jpeg: string) => {
    latestFrameBase64 = base64Jpeg;
    const ssePayload = encoder.encode(`data:${base64Jpeg}\n\n`);
    for (const controller of sseControllers) {
      try {
        controller.enqueue(ssePayload);
      } catch {
        sseControllers.delete(controller);
      }
    }
    for (const ws of wsClients) {
      try {
        ws.send(JSON.stringify({ type: "frame", data: base64Jpeg }));
      } catch {
        wsClients.delete(ws);
      }
    }
  };

  const server = Bun.serve<ViewerSocketData>({
    hostname: options?.viewHost ?? VIEW_HOST,
    port: options?.viewPort ?? VIEW_PORT,
    routes: {
      "/": new Response(HTML_VIEWER, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
      "/health": () =>
        Response.json({
          ok: true,
          runtime: "bun",
          sseClients: sseControllers.size,
          wsClients: wsClients.size,
          hasFrame: latestFrameBase64 !== null,
        }),
    },
    fetch(req, srv) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const origin = req.headers.get("origin");
        if (
          origin &&
          !origin.startsWith(`http://${VIEW_HOST}`) &&
          !origin.startsWith("http://localhost") &&
          !origin.startsWith("http://127.0.0.1")
        ) {
          return new Response("Forbidden origin", { status: 403 });
        }
        const upgraded = srv.upgrade(req, {
          data: { connectedAt: Date.now() },
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      if (url.pathname === "/events") {
        let activeController: ReadableStreamDefaultController<Uint8Array> | null =
          null;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            activeController = controller;
            sseControllers.add(controller);
            if (latestFrameBase64) {
              controller.enqueue(
                encoder.encode(`data:${latestFrameBase64}\n\n`),
              );
            }
          },
          cancel() {
            if (activeController) {
              sseControllers.delete(activeController);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
          },
        });
      }

      return new Response(HTML_VIEWER, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    websocket: {
      open(ws) {
        wsClients.add(ws);
        if (latestFrameBase64) {
          ws.send(JSON.stringify({ type: "frame", data: latestFrameBase64 }));
        }
      },
      message(_ws, _message) {
        // Co-pilot input events can be forwarded to active CDP session
      },
      close(ws) {
        wsClients.delete(ws);
      },
    },
  });

  return {
    server,
    broadcastFrame,
    stop() {
      for (const controller of sseControllers) {
        try {
          controller.close();
        } catch {
          // Ignore already-closed SSE stream
        }
      }
      sseControllers.clear();
      for (const ws of wsClients) {
        try {
          ws.close();
        } catch {
          // Ignore already-closed WebSocket
        }
      }
      wsClients.clear();
      void server.stop(true);
    },
  };
}

if (import.meta.main) {
  const proc = SHOULD_SPAWN ? spawnObscuraServer() : null;
  const viewer = await startLiveViewServer();
  console.log(
    `Yolo-Web live viewer listening on http://${viewer.server.hostname}:${viewer.server.port}`,
  );

  const wsUrl = `ws://${CDP_HOST}:${CDP_PORT}`;
  const cdpWs = new WebSocket(
    wsUrl,
    CDP_TOKEN
      ? ({
          headers: { Authorization: `Bearer ${CDP_TOKEN}` },
        } as unknown as string[])
      : undefined,
  );

  let nextId = 1;
  let sessionId: string | null = null;
  let stopping = false;

  const sendCdp = (
    method: string,
    params: Record<string, unknown> = {},
    targetSessionId?: string | null,
  ) => {
    const id = nextId++;
    const payload: Record<string, unknown> = { id, method, params };
    if (targetSessionId) payload.sessionId = targetSessionId;
    cdpWs.send(JSON.stringify(payload));
    return id;
  };

  cdpWs.addEventListener("open", () => {
    sendCdp("Target.createTarget", { url: INITIAL_URL });
  });

  cdpWs.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data)) as {
      id?: number;
      result?: Record<string, unknown>;
    };
    if (msg.result && typeof msg.result.targetId === "string" && !sessionId) {
      sendCdp("Target.attachToTarget", {
        targetId: msg.result.targetId,
        flatten: true,
      });
    } else if (
      msg.result &&
      typeof msg.result.sessionId === "string" &&
      !sessionId
    ) {
      sessionId = msg.result.sessionId;
      sendCdp("Page.navigate", { url: INITIAL_URL }, sessionId);
      const poll = () => {
        if (stopping || !sessionId || cdpWs.readyState !== WebSocket.OPEN) {
          return;
        }
        sendCdp(
          "Page.captureScreenshot",
          { format: "jpeg", quality: 70 },
          sessionId,
        );
        setTimeout(poll, 500);
      };
      setTimeout(poll, 500);
    } else if (msg.result && typeof msg.result.data === "string") {
      viewer.broadcastFrame(msg.result.data);
    }
  });

  process.once("SIGINT", () => {
    stopping = true;
    cdpWs.close();
    viewer.stop();
    proc?.kill();
  });
}
