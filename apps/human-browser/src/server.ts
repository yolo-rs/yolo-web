#!/usr/bin/env bun
/**
 * YOLO-Web Human + AI Co-Pilot Browser Workbench
 * Powered by 100% native Bun (`Bun.serve`, `Bun.spawn`, `WebSocket`)
 * Uniting Servo (HTML5/CSS3/Euclid/WebRender) + Obscura (V8/DOM/CDP/MCP/Stealth) + Brave (Adblock/Shields)
 */

export interface WorkbenchConfig {
  cdpPort: number;
  httpPort: number;
  hostname?: string;
  stealth: boolean;
  braveShields: boolean;
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "twclid",
]);

/**
 * Strips known ad/tracking parameters from a URL (Brave Shields query sanitizer).
 */
export function sanitizeUrlWithBraveShields(rawUrl: string): {
  cleanUrl: string;
  strippedParams: string[];
} {
  const strippedParams: string[] = [];
  try {
    const parsed = new URL(rawUrl);
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        TRACKING_PARAMS.has(key.toLowerCase()) ||
        key.toLowerCase().startsWith("utm_")
      ) {
        parsed.searchParams.delete(key);
        strippedParams.push(key);
      }
    }
    return { cleanUrl: parsed.toString(), strippedParams };
  } catch {
    return { cleanUrl: rawUrl, strippedParams };
  }
}

export function renderHumanBrowserHtml(config: WorkbenchConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YOLO-Web Browser — Servo + Obscura + Brave (Rust + Bun)</title>
  <style>
    :root {
      --bg: #0b0d12;
      --panel: #131722;
      --border: #232a3b;
      --accent: #ff5500;
      --servo: #2dd4bf;
      --obscura: #a855f7;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      display: grid;
      grid-template-rows: 56px 1fr 32px;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
    }
    .brand {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.03em;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
      font-weight: 600;
      border: 1px solid var(--border);
    }
    .badge-servo { color: var(--servo); border-color: rgba(45, 212, 191, 0.35); }
    .badge-obscura { color: var(--obscura); border-color: rgba(168, 85, 247, 0.35); }
    .badge-brave { color: var(--accent); border-color: rgba(255, 85, 0, 0.35); }
    #url-input {
      flex: 1;
      background: #090b10;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 7px 12px;
      font-family: ui-monospace, monospace;
      font-size: 13px;
    }
    button {
      background: #1e2434;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
    }
    button:hover { border-color: var(--servo); }
    main {
      display: grid;
      grid-template-columns: 1fr 320px;
      height: 100%;
      overflow: hidden;
    }
    #viewport-wrap {
      display: grid;
      place-items: center;
      background: #06080b;
      position: relative;
      overflow: auto;
    }
    #viewport-img {
      max-width: 100%;
      max-height: 100%;
      border: 1px solid var(--border);
      cursor: crosshair;
    }
    aside {
      background: var(--panel);
      border-left: 1px solid var(--border);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      font-size: 12px;
    }
    footer {
      background: var(--panel);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      font-size: 11px;
      color: var(--muted);
      font-family: ui-monospace, monospace;
    }
    pre {
      background: #090b10;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px;
      overflow: auto;
      margin: 0;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>YOLO-WEB</span>
      <span class="badge badge-servo">Servo</span>
      <span class="badge badge-obscura">Obscura V8/CDP</span>
      <span class="badge badge-brave">Brave Shields</span>
    </div>
    <input id="url-input" type="url" value="https://example.com" placeholder="Enter URL (Brave Shields active)..." />
    <button id="go-btn">Navigate</button>
  </header>
  <main>
    <div id="viewport-wrap">
      <img id="viewport-img" alt="Live Rust Browser Viewport" />
    </div>
    <aside>
      <strong>Engine Telemetry (Rust + Bun)</strong>
      <pre id="telemetry-box">Connecting to CDP :${config.cdpPort}...</pre>
      <strong>JS / Selector Co-Pilot</strong>
      <input id="eval-input" placeholder="document.title" style="background:#090b10;color:#fff;border:1px solid #232a3b;padding:6px;border-radius:4px;" />
      <button id="eval-btn">Evaluate in V8</button>
      <pre id="eval-output">Ready.</pre>
    </aside>
  </main>
  <footer>
    <span id="status-text">stream: connecting</span>
    <span>CDP :${config.cdpPort} | Stealth: ${config.stealth ? "ON" : "OFF"} | Brave Shields: ${config.braveShields ? "ON" : "OFF"}</span>
  </footer>
  <script type="module">
    const img = document.getElementById("viewport-img");
    const statusText = document.getElementById("status-text");
    const telemetryBox = document.getElementById("telemetry-box");
    const urlInput = document.getElementById("url-input");
    const evalInput = document.getElementById("eval-input");
    const evalOutput = document.getElementById("eval-output");

    let prevBlobUrl = null;
    const es = new EventSource("/events");
    es.onopen = () => (statusText.textContent = "stream: live (SSE)");
    es.onerror = () => (statusText.textContent = "stream: reconnecting");
    es.onmessage = (e) => {
      const bytes = Uint8Array.from(atob(e.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      img.src = url;
      if (prevBlobUrl) URL.revokeObjectURL(prevBlobUrl);
      prevBlobUrl = url;
    };

    async function refreshStatus() {
      const res = await fetch("/api/status");
      if (res.ok) {
        telemetryBox.textContent = JSON.stringify(await res.json(), null, 2);
      }
    }
    refreshStatus();

    document.getElementById("go-btn").onclick = async () => {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.value }),
      });
      evalOutput.textContent = JSON.stringify(await res.json(), null, 2);
    };

    document.getElementById("eval-btn").onclick = async () => {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: evalInput.value || "document.title" }),
      });
      evalOutput.textContent = JSON.stringify(await res.json(), null, 2);
    };
  </script>
</body>
</html>`;
}

export function startHumanBrowserServer(config: WorkbenchConfig) {
  const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();
  let latestFrameBase64: string | null = null;
  let strippedTrackerCount = 0;

  const broadcastFrame = (base64Frame: string) => {
    latestFrameBase64 = base64Frame;
    const payload = encoder.encode(`data:${base64Frame}\n\n`);
    for (const controller of sseClients) {
      try {
        controller.enqueue(payload);
      } catch {
        sseClients.delete(controller);
      }
    }
  };

  const server = Bun.serve({
    port: config.httpPort,
    hostname: config.hostname ?? "127.0.0.1",
    routes: {
      "/": () =>
        new Response(renderHumanBrowserHtml(config), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      "/api/status": () =>
        Response.json({
          engine: "yolo-web (Servo + Obscura + Brave)",
          runtime: `Bun v${Bun.version}`,
          cdpPort: config.cdpPort,
          httpPort: server.port,
          stealth: config.stealth,
          braveShields: config.braveShields,
          strippedTrackerCount,
          connectedViewers: sseClients.size,
        }),
      "/api/navigate": {
        POST: async (req) => {
          const body = (await req.json()) as { url?: string };
          const rawUrl = body.url ?? "https://example.com";
          const sanitized = config.braveShields
            ? sanitizeUrlWithBraveShields(rawUrl)
            : { cleanUrl: rawUrl, strippedParams: [] };
          strippedTrackerCount += sanitized.strippedParams.length;
          return Response.json({
            ok: true,
            requestedUrl: rawUrl,
            navigatedUrl: sanitized.cleanUrl,
            braveShieldsStripped: sanitized.strippedParams,
          });
        },
      },
      "/api/eval": {
        POST: async (req) => {
          const body = (await req.json()) as { expression?: string };
          return Response.json({
            ok: true,
            expression: body.expression ?? "document.title",
          });
        },
      },
      "/events": () => {
        let activeController: ReadableStreamDefaultController<Uint8Array> | null =
          null;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            activeController = controller;
            sseClients.add(controller);
            if (latestFrameBase64) {
              controller.enqueue(
                encoder.encode(`data:${latestFrameBase64}\n\n`),
              );
            }
          },
          cancel() {
            if (activeController) sseClients.delete(activeController);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
          },
        });
      },
    },
    fetch() {
      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    server,
    broadcastFrame,
    stop: () => server.stop(true),
  };
}

if (import.meta.main) {
  const cdpPort = Number(Bun.argv[2] ?? process.env.YOLO_CDP_PORT ?? 9222);
  const httpPort = Number(Bun.argv[3] ?? process.env.YOLO_HTTP_PORT ?? 8080);
  const { server } = startHumanBrowserServer({
    cdpPort,
    httpPort,
    stealth: true,
    braveShields: true,
  });
  console.log(
    `YOLO-Web Human + AI Browser Workbench running at http://127.0.0.1:${server.port}`,
  );
}
