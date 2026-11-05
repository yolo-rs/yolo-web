import { McpServer } from "../src/index.ts";

export function createFixture(): McpServer {
  const s = new McpServer({ name: "fixture", version: "1.0.0" });
  s.setRequestHandler("tools/list", () => ({
    tools: [
      {
        name: "echo",
        description: "echo text",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
        },
      },
    ],
  }));
  s.setRequestHandler("tools/call", (p) => {
    if (p.name !== "echo") throw new Error(`Unknown tool: ${p.name}`);
    return {
      content: [{ type: "text", text: String(p.arguments?.text ?? "") }],
    };
  });
  s.setRequestHandler("resources/list", () => ({
    resources: [{ uri: "x://a", name: "a" }],
  }));
  s.setRequestHandler("prompts/list", () => ({ prompts: [] }));
  return s;
}

if (import.meta.main) await createFixture().serveStdio();
