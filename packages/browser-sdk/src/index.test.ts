import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { YoloBrowser } from "./index";

describe("@yolo-web/browser-sdk", () => {
  let mockServer: ReturnType<typeof Bun.serve>;
  let cdpUrl = "";
  let mcpUrl = "";

  beforeAll(() => {
    mockServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req, srv) {
        const url = new URL(req.url);
        if (url.pathname === "/mcp" && req.method === "POST") {
          const body = (await req.json()) as {
            id: number;
            params?: { name?: string };
          };
          if (body.params?.name === "browser_snapshot") {
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: "URL: https://example.com\nTitle: Yolo-Web Hybrid\n[e1] button 'Sign in'",
                  },
                ],
              },
            });
          }
          if (body.params?.name === "browser_markdown") {
            return Response.json({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                content: [
                  { type: "text", text: "# Yolo-Web Hybrid\n\nReady." },
                ],
              },
            });
          }
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: { content: [{ type: "text", text: "ok" }] },
          });
        }
        if (srv.upgrade(req)) return undefined;
        return new Response("Not Found", { status: 404 });
      },
      websocket: {
        message(ws, raw) {
          const msg = JSON.parse(String(raw)) as {
            id: number;
            method: string;
            params?: Record<string, unknown>;
            sessionId?: string;
          };
          const reply = (result: Record<string, unknown>) =>
            ws.send(
              JSON.stringify({
                id: msg.id,
                result,
                ...(msg.sessionId ? { sessionId: msg.sessionId } : {}),
              }),
            );

          switch (msg.method) {
            case "Target.createTarget":
              reply({ targetId: "target-sdk-1" });
              break;
            case "Target.attachToTarget":
              reply({ sessionId: "session-sdk-1" });
              break;
            case "Page.navigate":
              reply({ frameId: "frame-sdk-1" });
              break;
            case "Runtime.evaluate":
              if (msg.params?.expression === "document.title") {
                reply({
                  result: { type: "string", value: "Yolo-Web Hybrid" },
                });
              } else if (msg.params?.expression === "location.href") {
                reply({
                  result: { type: "string", value: "https://example.com/" },
                });
              } else {
                reply({
                  result: {
                    type: "string",
                    value: "<html><body><h1>Yolo-Web Hybrid</h1></body></html>",
                  },
                });
              }
              break;
            case "Page.captureScreenshot":
              reply({ data: btoa("sdk-png") });
              break;
            default:
              reply({});
          }
        },
      },
    });

    cdpUrl = `ws://127.0.0.1:${mockServer.port}`;
    mcpUrl = `http://127.0.0.1:${mockServer.port}/mcp`;
  });

  afterAll(() => {
    mockServer.stop(true);
  });

  test("automates page via CDP + MCP and supports Human Co-Pilot handoff", async () => {
    await using browser = await YoloBrowser.connect({
      cdpUrl,
      mcpUrl,
      mode: "hybrid-copilot",
    });

    expect(browser.sessionInfo().mode).toBe("hybrid-copilot");
    expect(browser.sessionInfo().humanTakeoverActive).toBe(false);

    const page = await browser.newPage();
    await page.goto("https://example.com");

    expect(await page.title()).toBe("Yolo-Web Hybrid");
    expect(await page.url()).toBe("https://example.com/");
    expect(await page.content()).toContain("<h1>Yolo-Web Hybrid</h1>");

    const snap = await page.snapshot();
    expect(snap).toContain("[e1] button 'Sign in'");

    const md = await page.markdown();
    expect(md).toContain("# Yolo-Web Hybrid");

    const shot = await page.screenshot();
    expect(new TextDecoder().decode(shot)).toBe("sdk-png");

    // Human co-pilot takeover and resume
    const takeoverState = browser.requestHumanTakeover("CAPTCHA challenge");
    expect(takeoverState.humanTakeoverActive).toBe(true);
    expect(takeoverState.mode).toBe("human-interactive");

    const resumedState = browser.resumeAgentControl();
    expect(resumedState.humanTakeoverActive).toBe(false);
    expect(resumedState.mode).toBe("hybrid-copilot");
  });
});
