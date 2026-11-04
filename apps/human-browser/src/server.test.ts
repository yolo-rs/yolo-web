import { describe, expect, test } from "bun:test";
import {
  sanitizeUrlWithBraveShields,
  validateBrowserNavigationUrl,
  startHumanBrowserServer,
} from "./server.ts";

describe("@yolo-web/human-browser CDP service", () => {
  test("Brave Shields URL sanitizer strips tracking parameters", () => {
    const result = sanitizeUrlWithBraveShields(
      "https://example.com/article?id=42&utm_source=newsletter&fbclid=IwAR123&gclid=abc",
    );
    expect(result.cleanUrl).toBe("https://example.com/article?id=42");
    expect(result.strippedParams).toEqual(["utm_source", "fbclid", "gclid"]);
  });

  test("navigation URL policy rejects executable and local-file schemes", () => {
    expect(validateBrowserNavigationUrl("https://example.com")?.protocol).toBe(
      "https:",
    );
    expect(validateBrowserNavigationUrl("about:blank")?.href).toBe(
      "about:blank",
    );
    expect(validateBrowserNavigationUrl("data:text/html,hello")?.protocol).toBe(
      "data:",
    );
    expect(validateBrowserNavigationUrl("javascript:alert(1)")).toBeNull();
    expect(validateBrowserNavigationUrl("file:///etc/passwd")).toBeNull();
    expect(validateBrowserNavigationUrl("not a url")).toBeNull();
  });

  test("service exposes health and reports CDP connection failures through its API", async () => {
    const workbench = startHumanBrowserServer({
      cdpPort: 9222,
      httpPort: 0,
      stealth: true,
      braveShields: true,
    });

    try {
      const baseUrl = `http://127.0.0.1:${workbench.server.port}`;

      const health = await fetch(`${baseUrl}/healthz`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({
        ok: true,
        service: "yolo-web-human-browser-api",
      });
      const root = await fetch(baseUrl);
      expect(root.status).toBe(404);
      expect(root.headers.get("content-type")).not.toContain("text/html");

      const navRes = await fetch(`${baseUrl}/api/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://servo.org/?utm_campaign=launch&msclkid=999&page=1",
        }),
      });
      const navJson = (await navRes.json()) as {
        ok: boolean;
        error: string;
      };
      expect(navRes.status).toBe(503);
      expect(navJson.ok).toBe(false);
      expect(navJson.error.length).toBeGreaterThan(0);

      const malformed = await fetch(`${baseUrl}/api/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      expect(malformed.status).toBe(400);
      expect((await malformed.json()).error).toContain("valid JSON");

      const invalidUrl = await fetch(`${baseUrl}/api/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not a url" }),
      });
      expect(invalidUrl.status).toBe(400);

      const evalRes = await fetch(`${baseUrl}/api/eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: "document.title" }),
      });
      expect(evalRes.status).toBe(503);
      expect((await evalRes.json()).ok).toBe(false);

      const statusRes = await fetch(`${baseUrl}/api/status`);
      const statusJson = (await statusRes.json()) as {
        strippedTrackerCount: number;
        browserConnected: boolean;
        browserVersion: { Browser: string; "Protocol-Version": string } | null;
        browserIntegration: string;
        browserIntegrationMessage: string;
      };
      expect(statusJson.strippedTrackerCount).toBe(0);
      expect(statusJson.browserConnected).toBe(false);
      expect(statusJson.browserVersion).toBeNull();
      expect(statusJson.browserIntegration).toBe("lazy-cdp-client");
      expect(statusJson.browserIntegrationMessage.length).toBeGreaterThan(0);
    } finally {
      await workbench.stop();
    }
  });

  test("uses CDP for navigation and evaluation against a local protocol endpoint", async () => {
    const methods: string[] = [];
    const cdpServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("Not Found", { status: 404 });
      },
      websocket: {
        message(ws, raw) {
          const request = JSON.parse(String(raw)) as {
            id: number;
            method: string;
            sessionId?: string;
          };
          methods.push(request.method);
          const results: Record<string, Record<string, unknown>> = {
            "Target.createTarget": { targetId: "target-1" },
            "Browser.getVersion": {
              product: "Chrome/150.0.0.0",
              protocolVersion: "1.3",
              userAgent: "Chrome test",
              jsVersion: "V8 test",
            },
            "Target.attachToTarget": { sessionId: "session-1" },
            "Page.navigate": { frameId: "frame-1", loaderId: "loader-1" },
            "Runtime.evaluate": { result: { type: "number", value: 42 } },
            "Page.captureScreenshot": { data: btoa("jpeg-frame") },
          };
          ws.send(
            JSON.stringify({
              id: request.id,
              result: results[request.method] ?? {},
              ...(request.sessionId ? { sessionId: request.sessionId } : {}),
            }),
          );
          if (request.method === "Page.navigate")
            ws.send(
              JSON.stringify({
                method: "Page.domContentEventFired",
                params: {},
              }),
            );
        },
      },
    });
    const workbench = startHumanBrowserServer({
      cdpPort: cdpServer.port!,
      cdpEndpoint: `ws://127.0.0.1:${cdpServer.port!}`,
      httpPort: 0,
      stealth: true,
      braveShields: true,
    });
    try {
      const baseUrl = `http://127.0.0.1:${workbench.server.port}`;
      const nav = await fetch(`${baseUrl}/api/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/?utm_source=test" }),
      });
      expect(nav.status).toBe(200);
      expect((await nav.json()).navigatedUrl).toBe("https://example.com/");
      const evaluated = await fetch(`${baseUrl}/api/eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: "6 * 7" }),
      });
      expect((await evaluated.json()).value).toBe(42);
      expect(methods).toContain("Page.enable");
      expect(methods).toContain("Browser.getVersion");
      expect(methods).toContain("Runtime.enable");
      expect(methods).toContain("Page.navigate");
      expect(methods).toContain("Runtime.evaluate");
      const events = await fetch(`${baseUrl}/events`);
      const reader = events.body!.getReader();
      const frame = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("screenshot frame timeout")), 2500),
        ),
      ]);
      expect(new TextDecoder().decode(frame.value)).toContain(
        btoa("jpeg-frame"),
      );
      expect(methods).toContain("Page.captureScreenshot");
      const status = await fetch(`${baseUrl}/api/status`).then((response) =>
        response.json(),
      );
      expect(status.browserVersion.Browser).toBe("Chrome/150.0.0.0");
      await reader.cancel();
    } finally {
      await workbench.stop();
      expect(methods).toContain("Target.closeTarget");
      cdpServer.stop(true);
    }
  });
});
