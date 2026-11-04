#!/usr/bin/env bun
import { YoloCdpClient } from "@yolo-web/cdp-client";
/**
 * YOLO-Web browser service. It owns CDP lifecycle, policy, browser APIs, and
 * screenshots; the user-facing workbench is hosted by yolo-ui.
 */

export interface WorkbenchConfig {
  cdpPort: number;
  httpPort: number;
  hostname?: string;
  stealth: boolean;
  braveShields: boolean;
  cdpEndpoint?: string;
  cdpToken?: string;
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

export function validateBrowserNavigationUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "http:" || url.protocol === "https:") return url;
    if (url.href === "about:blank") return url;
    if (url.protocol === "data:") return url;
  } catch {
    // Invalid absolute URL.
  }
  return null;
}

export function startHumanBrowserServer(config: WorkbenchConfig) {
  const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const frameClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();
  let latestFrameBase64: string | null = null;
  let strippedTrackerCount = 0;
  let cdp: YoloCdpClient | null = null;
  let browserTargetId: string | null = null;
  let browserSessionId: string | null = null;
  let cdpError: string | null = null;
  let browserVersion: Awaited<ReturnType<YoloCdpClient["getVersion"]>> | null =
    null;
  let cdpConnecting: Promise<YoloCdpClient> | null = null;
  let screenshotTimer: ReturnType<typeof setInterval> | null = null;
  let screenshotInFlight = false;

  const ensureCdp = async () => {
    if (cdp && browserSessionId) return cdp;
    if (cdpConnecting) return cdpConnecting;
    cdpConnecting = (async () => {
      const client = await YoloCdpClient.connect({
        endpoint: config.cdpEndpoint ?? `http://127.0.0.1:${config.cdpPort}`,
        token: config.cdpToken,
        timeoutMs: 5_000,
      });
      try {
        browserVersion = await client.getVersion();
        const targetId = await client.createTarget("about:blank");
        const sessionId = await client.attachToTarget(targetId, true);
        client.setSessionId(sessionId);
        await client.send("Page.enable");
        await client.send("Runtime.enable");
        cdp = client;
        browserTargetId = targetId;
        browserSessionId = sessionId;
        cdpError = null;
        screenshotTimer = setInterval(async () => {
          if (
            !cdp ||
            (sseClients.size === 0 && frameClients.size === 0) ||
            screenshotInFlight
          )
            return;
          screenshotInFlight = true;
          try {
            const frame = await cdp.captureScreenshot({
              format: "jpeg",
              quality: 65,
            });
            broadcastFrame(Buffer.from(frame).toString("base64"));
          } catch (error) {
            cdpError = error instanceof Error ? error.message : String(error);
          } finally {
            screenshotInFlight = false;
          }
        }, 1000);
        return client;
      } catch (error) {
        await client.close();
        throw error;
      }
    })();
    try {
      return await cdpConnecting;
    } finally {
      cdpConnecting = null;
    }
  };

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
    const binaryFrame = Uint8Array.from(atob(base64Frame), (character) =>
      character.charCodeAt(0),
    );
    const header = encoder.encode(
      `--yolo-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${binaryFrame.byteLength}\r\n\r\n`,
    );
    const trailer = encoder.encode("\r\n");
    const frame = new Uint8Array(
      header.byteLength + binaryFrame.byteLength + trailer.byteLength,
    );
    frame.set(header, 0);
    frame.set(binaryFrame, header.byteLength);
    frame.set(trailer, header.byteLength + binaryFrame.byteLength);
    for (const controller of frameClients) {
      try {
        controller.enqueue(frame);
      } catch {
        frameClients.delete(controller);
      }
    }
  };

  const server = Bun.serve({
    port: config.httpPort,
    hostname: config.hostname ?? "127.0.0.1",
    routes: {
      "/healthz": () =>
        Response.json({ ok: true, service: "yolo-web-human-browser-api" }),
      "/stream": async () => {
        try {
          await ensureCdp();
        } catch {
          return new Response("Chromium CDP is unavailable.", { status: 503 });
        }
        let activeController: ReadableStreamDefaultController<Uint8Array> | null =
          null;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            activeController = controller;
            frameClients.add(controller);
          },
          cancel() {
            if (activeController) frameClients.delete(activeController);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "multipart/x-mixed-replace; boundary=yolo-frame",
            "Cache-Control": "no-store, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
      "/api/status": () =>
        Response.json({
          implementation:
            "Bun-hosted workbench with external CDP browser rendering",
          browserConnected: Boolean(cdp && browserSessionId),
          browserVersion,
          browserIntegration: cdp ? "connected" : "lazy-cdp-client",
          browserTargetId,
          browserIntegrationMessage: cdpError,
          runtime: `Bun v${Bun.version}`,
          cdpPort: config.cdpPort,
          httpPort: config.httpPort,
          stealth: config.stealth,
          braveShields: config.braveShields,
          strippedTrackerCount,
          connectedViewers: sseClients.size + frameClients.size,
        }),
      "/api/navigate": {
        POST: async (req) => {
          let body: { url?: string };
          try {
            body = (await req.json()) as { url?: string };
          } catch {
            return Response.json(
              { ok: false, error: "request body must be valid JSON" },
              { status: 400 },
            );
          }
          try {
            const rawUrl = body.url?.trim();
            if (!rawUrl)
              return Response.json(
                { ok: false, error: "url is required" },
                { status: 400 },
              );
            if (!validateBrowserNavigationUrl(rawUrl)) {
              return Response.json(
                {
                  ok: false,
                  error: "url must use http, https, data, or about:blank",
                },
                { status: 400 },
              );
            }
            const sanitized = config.braveShields
              ? sanitizeUrlWithBraveShields(rawUrl)
              : { cleanUrl: rawUrl, strippedParams: [] };
            const client = await ensureCdp();
            const result = await client.navigate(sanitized.cleanUrl);
            strippedTrackerCount += sanitized.strippedParams.length;
            return Response.json(
              {
                ok: !result.errorText,
                requestedUrl: rawUrl,
                navigatedUrl: sanitized.cleanUrl,
                braveShieldsStripped: sanitized.strippedParams,
                ...result,
              },
              { status: result.errorText ? 502 : 200 },
            );
          } catch (error) {
            cdpError = error instanceof Error ? error.message : String(error);
            return Response.json(
              { ok: false, error: cdpError },
              { status: 503 },
            );
          }
        },
      },
      "/api/eval": {
        POST: async (req) => {
          let body: { expression?: string };
          try {
            body = (await req.json()) as { expression?: string };
          } catch {
            return Response.json(
              { ok: false, error: "request body must be valid JSON" },
              { status: 400 },
            );
          }
          try {
            const expression = body.expression?.trim();
            if (!expression)
              return Response.json(
                { ok: false, error: "expression is required" },
                { status: 400 },
              );
            const client = await ensureCdp();
            return Response.json({
              ok: true,
              expression,
              value: await client.evaluate(expression),
            });
          } catch (error) {
            cdpError = error instanceof Error ? error.message : String(error);
            const unavailable = !cdp || !browserSessionId;
            return Response.json(
              { ok: false, error: cdpError },
              { status: unavailable ? 503 : 500 },
            );
          }
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
    stop: async () => {
      if (screenshotTimer) clearInterval(screenshotTimer);
      for (const controller of [...sseClients, ...frameClients]) {
        try {
          controller.close();
        } catch {
          /* Client disconnected during shutdown. */
        }
      }
      sseClients.clear();
      frameClients.clear();
      if (cdp && browserTargetId) {
        try {
          await cdp.closeTarget(browserTargetId);
        } catch {
          // The browser may already have disconnected; still close our socket.
        }
      }
      await cdp?.close();
      cdp = null;
      browserTargetId = null;
      browserSessionId = null;
      browserVersion = null;
      server.stop(true);
    },
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
    `YOLO-Web browser CDP API listening at http://127.0.0.1:${server.port}`,
  );
}
