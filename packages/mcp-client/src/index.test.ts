import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { OBSCURA_MCP_TOOLS } from "@yolo-web/shared";
import { YoloMcpClient } from "./index";

describe("@yolo-web/mcp-client", () => {
  let mockMcpServer: ReturnType<typeof Bun.serve>;
  let mcpUrl = "";

  beforeAll(() => {
    mockMcpServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const body = (await req.json()) as {
          id: number;
          method: string;
          params?: { name?: string; arguments?: Record<string, unknown> };
        };

        if (body.method === "tools/list") {
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            result: { tools: OBSCURA_MCP_TOOLS },
          });
        }

        if (body.method === "tools/call") {
          const toolName = body.params?.name;
          const args = body.params?.arguments ?? {};

          switch (toolName) {
            case "browser_navigate":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    { type: "text", text: `Navigated to ${String(args.url)}` },
                  ],
                },
              });
            case "browser_snapshot":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "URL: https://example.com\nTitle: Example Domain\n[e1] link 'More information'",
                    },
                  ],
                },
              });
            case "browser_click":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Clicked ${String(args.ref ?? args.selector)}`,
                    },
                  ],
                },
              });
            case "browser_type":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Typed ${String(args.text)}`,
                    },
                  ],
                },
              });
            case "browser_evaluate":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [{ type: "text", text: "42" }],
                },
              });
            case "browser_screenshot":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "image",
                      mimeType: "image/png",
                      data: btoa("mcp-png-data"),
                    },
                  ],
                },
              });
            case "browser_pdf":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "resource",
                      resource: {
                        uri: "obscura://page.pdf",
                        mimeType: "application/pdf",
                        blob: btoa("mcp-pdf-data"),
                      },
                    },
                  ],
                },
              });
            case "browser_markdown":
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "# Example Domain\n\nThis domain is for use in illustrative examples.",
                    },
                  ],
                },
              });
            default:
              return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  isError: true,
                  content: [{ type: "text", text: "Unknown tool" }],
                },
              });
          }
        }

        return Response.json({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: "Method not found" },
        });
      },
    });
    mcpUrl = `http://127.0.0.1:${mockMcpServer.port}/mcp`;
  });

  afterAll(() => {
    mockMcpServer.stop(true);
  });

  test("executes MCP tools over HTTP JSON-RPC", async () => {
    await using client = new YoloMcpClient({
      transport: "http",
      url: mcpUrl,
    });

    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(8);

    const nav = await client.navigate("https://example.com");
    expect(nav).toContain("https://example.com");

    const snap = await client.snapshot({ maxChars: 2000 });
    expect(snap).toContain("[e1] link");

    const clickRes = await client.click("e1");
    expect(clickRes).toBe("Clicked e1");

    const typeRes = await client.type("#search", "yolo-web");
    expect(typeRes).toBe("Typed yolo-web");

    const evalRes = await client.evaluate("6 * 7");
    expect(evalRes).toBe("42");

    const png = await client.screenshot({ width: 1280, height: 720 });
    expect(new TextDecoder().decode(png)).toBe("mcp-png-data");

    const pdf = await client.pdf({ printBackground: true });
    expect(new TextDecoder().decode(pdf)).toBe("mcp-pdf-data");

    const md = await client.extractMarkdown();
    expect(md).toContain("# Example Domain");
  });
});
