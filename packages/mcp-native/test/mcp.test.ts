import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "../src/index.ts";
import { createFixture } from "./fixture-server.ts";

const rpc = (id: number | undefined, method: string, params?: unknown) => ({
  jsonrpc: "2.0",
  id,
  method,
  params,
});

describe("handshake with the reference SDK client", () => {
  test("stdio: initialize, tools/list, tools/call, resources, ping", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [`${import.meta.dir}/fixture-server.ts`],
    });
    const client = new Client({ name: "sdk-client", version: "0.0.0" });
    await client.connect(transport);
    try {
      expect(client.getServerVersion()).toMatchObject({
        name: "fixture",
        version: "1.0.0",
      });
      expect(client.getServerCapabilities()).toMatchObject({
        tools: {},
        resources: {},
        prompts: {},
      });
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toEqual(["echo"]);
      const call = await client.callTool({
        name: "echo",
        arguments: { text: "hi" },
      });
      expect(call.content).toEqual([{ type: "text", text: "hi" }]);
      expect((await client.listResources()).resources[0]!.uri).toBe("x://a");
      await client.ping();
      await expect(client.callTool({ name: "nope" })).rejects.toThrow(
        "Unknown tool: nope",
      );
    } finally {
      await client.close();
    }
  });

  const fixture = createFixture();
  const http = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => fixture.fetch(req),
  });
  afterAll(() => http.stop(true));

  test("streamable http: SDK client full handshake", async () => {
    const client = new Client({ name: "sdk-http", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${http.port}/mcp`),
      ),
    );
    try {
      expect((await client.listTools()).tools[0]!.name).toBe("echo");
      const call = await client.callTool({
        name: "echo",
        arguments: { text: "over http" },
      });
      expect(call.content).toEqual([{ type: "text", text: "over http" }]);
    } finally {
      await client.close();
    }
  });
});

describe("JSON-RPC behavior", () => {
  const s = createFixture();
  test("protocol version negotiation falls back to latest", async () => {
    const r = await s.handleMessage(
      rpc(1, "initialize", { protocolVersion: "1999-01-01" }),
    );
    expect((r!.result as any).protocolVersion).toBe("2025-11-25");
    const old = await s.handleMessage(
      rpc(2, "initialize", { protocolVersion: "2024-11-05" }),
    );
    expect((old!.result as any).protocolVersion).toBe("2024-11-05");
  });
  test("notifications produce no response; unknown method is -32601", async () => {
    expect(
      await s.handleMessage(rpc(undefined, "notifications/initialized")),
    ).toBeUndefined();
    expect((await s.handleMessage(rpc(3, "nope")))!.error!.code).toBe(-32601);
  });
  test("batch and invalid request", async () => {
    const out = (await s.handleBody([
      rpc(1, "ping"),
      rpc(undefined, "notifications/initialized"),
      rpc(2, "tools/list"),
    ])) as any[];
    expect(out.map((o) => o.id)).toEqual([1, 2]);
    expect(((await s.handleBody({ foo: 1 })) as any).error.code).toBe(-32600);
  });
  test("stdio loop answers concurrent lines and reports parse errors", async () => {
    const lines =
      [
        JSON.stringify(rpc(1, "ping")),
        "{bad",
        JSON.stringify(rpc(2, "tools/list")),
      ].join("\n") + "\n";
    const out: string[] = [];
    await s.serveStdio(new Response(lines).body!, (l) => out.push(l));
    const parsed = out.map((l) => JSON.parse(l));
    expect(parsed.find((p) => p.id === 1).result).toEqual({});
    expect(parsed.find((p) => p.id === null).error.code).toBe(-32700);
    expect(parsed.find((p) => p.id === 2).result.tools).toHaveLength(1);
  });
});

describe("http session rules", () => {
  const server: McpServer = createFixture();
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    server.fetch(
      new Request("http://x/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  test("session required, issued on initialize, deletable", async () => {
    expect((await post(rpc(1, "tools/list"))).status).toBe(400);
    const init = await post(
      rpc(1, "initialize", { protocolVersion: "2025-06-18" }),
    );
    const sid = init.headers.get("mcp-session-id")!;
    expect(sid).toBeTruthy();
    expect(
      (await post(rpc(2, "tools/list"), { "mcp-session-id": "bogus" })).status,
    ).toBe(404);
    expect(
      (await post(rpc(2, "tools/list"), { "mcp-session-id": sid })).status,
    ).toBe(200);
    expect(
      (
        await post(rpc(undefined, "notifications/initialized"), {
          "mcp-session-id": sid,
        })
      ).status,
    ).toBe(202);
    expect(
      (await server.fetch(new Request("http://x/mcp", { method: "GET" })))
        .status,
    ).toBe(405);
    expect(
      (
        await server.fetch(
          new Request("http://x/mcp", {
            method: "DELETE",
            headers: { "mcp-session-id": sid },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await post(rpc(3, "tools/list"), { "mcp-session-id": sid })).status,
    ).toBe(404);
  });
  test("rejects bad json and wrong content type", async () => {
    const bad = await server.fetch(
      new Request("http://x/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(bad.status).toBe(400);
    const ct = await server.fetch(
      new Request("http://x/mcp", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "x",
      }),
    );
    expect(ct.status).toBe(415);
  });
});
