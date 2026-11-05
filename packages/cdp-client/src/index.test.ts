import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { YoloCdpClient } from "./index";

describe("@yolo-web/cdp-client", () => {
  let mockServer: ReturnType<typeof Bun.serve>;
  let endpoint = "";
  const dispatchedInputs: Array<{ method: string; params: unknown }> = [];

  beforeAll(() => {
    mockServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      routes: {
        "/json/version": () =>
          Response.json({
            Browser: "Yolo-Web/0.1.0 (Servo+Obscura+Brave)",
            "Protocol-Version": "1.3",
            "User-Agent": "YoloWeb/0.1",
            "V8-Version": "13.0",
          }),
        "/json/list": () =>
          Response.json([
            {
              targetId: "target-1",
              type: "page",
              title: "Yolo-Web Test Page",
              url: "https://example.com",
              attached: false,
            },
          ]),
      },
      fetch(req, srv) {
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

          const reply = (result: Record<string, unknown>) => {
            ws.send(
              JSON.stringify({
                id: msg.id,
                result,
                ...(msg.sessionId ? { sessionId: msg.sessionId } : {}),
              }),
            );
          };
          const emit = (method: string, params: Record<string, unknown>) => {
            ws.send(
              JSON.stringify({
                method,
                params,
                ...(msg.sessionId ? { sessionId: msg.sessionId } : {}),
              }),
            );
          };

          switch (msg.method) {
            case "Target.createTarget":
              reply({ targetId: "target-1" });
              break;
            case "Target.attachToTarget":
              reply({ sessionId: "session-1" });
              break;
            case "Target.closeTarget":
              reply({ success: msg.params?.targetId === "target-1" });
              break;
            case "Page.navigate":
              reply({ frameId: "frame-1", loaderId: "loader-1" });
              // A browser follows the navigate response with the lifecycle
              // events that `navigate({ waitUntil })` awaits.
              emit("Page.domContentEventFired", { timestamp: 1 });
              emit("Page.loadEventFired", { timestamp: 2 });
              break;
            case "Runtime.evaluate":
              if (msg.params?.expression === "document.title") {
                reply({ result: { type: "string", value: "Example Domain" } });
              } else if (msg.params?.expression === "1 + 2") {
                reply({ result: { type: "number", value: 3 } });
              } else {
                reply({ result: { type: "undefined" } });
              }
              break;
            case "Page.captureScreenshot":
              reply({ data: btoa("fake-png-bytes") });
              break;
            case "Page.printToPDF":
              reply({ data: btoa("%PDF-1.7-mock") });
              break;
            case "Input.dispatchMouseEvent":
            case "Input.dispatchKeyEvent":
              dispatchedInputs.push({ method: msg.method, params: msg.params });
              reply({});
              break;
            case "DOM.getDocument":
              reply({ root: { nodeId: 1 } });
              break;
            case "DOM.querySelectorAll":
              reply({ nodeIds: [10, 11, 12] });
              break;
            default:
              reply({});
          }
        },
      },
    });
    endpoint = `ws://127.0.0.1:${mockServer.port}`;
  });

  afterAll(() => {
    void mockServer.stop(true);
  });

  test("queries version, targets, navigates, evaluates, captures media, and disposes cleanly", async () => {
    await using client = await YoloCdpClient.connect({ endpoint });

    const version = await client.getVersion();
    expect(version.Browser).toContain("Yolo-Web");

    const targets = await client.listTargets();
    expect(targets.length).toBe(1);
    expect(targets[0]?.targetId).toBe("target-1");

    const targetId = await client.createTarget("https://example.com");
    expect(targetId).toBe("target-1");

    const sessionId = await client.attachToTarget(targetId);
    expect(sessionId).toBe("session-1");

    const nav = await client.navigate("https://example.com", {
      waitUntil: "load",
    });
    expect(nav.frameId).toBe("frame-1");

    const title = await client.evaluate<string>("document.title");
    expect(title).toBe("Example Domain");

    const sum = await client.evaluate<number>("1 + 2");
    expect(sum).toBe(3);

    const png = await client.captureScreenshot({ format: "png" });
    expect(new TextDecoder().decode(png)).toBe("fake-png-bytes");

    const pdf = await client.printToPdf({ printBackground: true });
    expect(new TextDecoder().decode(pdf)).toBe("%PDF-1.7-mock");

    await client.dispatchMouseEvent({ type: "mousePressed", x: 100, y: 200 });
    await client.dispatchKeyEvent({ type: "keyDown", key: "Enter" });
    expect(dispatchedInputs.length).toBe(2);

    const nodes = await client.querySelectorAll(".item");
    expect(nodes).toEqual([10, 11, 12]);
    expect(await client.closeTarget(targetId)).toBe(true);
  });
});
