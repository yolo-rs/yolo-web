import { describe, expect, it } from "bun:test";
import { createWebMcpServer } from "./server.js";

const call = (id: number, method: string, params: unknown = {}) => ({
  jsonrpc: "2.0",
  id,
  method,
  params,
});

describe("web-mcp JSON-RPC protocol (mcp-native)", () => {
  it("completes initialize, tools/list and tools/call in process", async () => {
    const server = createWebMcpServer();
    const init = await server.handleMessage(
      call(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      }),
    );
    expect((init!.result as any).serverInfo.name).toBe(
      "io.github.yolo-rs/web-mcp-server",
    );
    expect((init!.result as any).capabilities).toEqual({
      tools: {},
      prompts: {},
      resources: {},
    });

    const list = await server.handleMessage(call(2, "tools/list"));
    const names = (list!.result as any).tools.map(
      (t: { name: string }) => t.name,
    );
    expect(names).toContain("servo_css_specificity");

    const res = await server.handleMessage(
      call(3, "tools/call", {
        name: "servo_css_specificity",
        arguments: { selector: "#a .b" },
      }),
    );
    expect(JSON.parse((res!.result as any).content[0].text).components.id).toBe(
      1,
    );

    const prompts = await server.handleMessage(call(4, "prompts/list"));
    expect((prompts!.result as any).prompts.length).toBeGreaterThan(0);
    const missing = await server.handleMessage(
      call(5, "prompts/get", { name: "nope" }),
    );
    expect(missing!.error!.message).toBe("Unknown prompt: nope");
  });

  it("speaks newline-delimited JSON-RPC over a real stdio subprocess", async () => {
    const proc = Bun.spawn([process.execPath, `${import.meta.dir}/index.ts`], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    });
    void proc.stdin.write(
      `${JSON.stringify(call(1, "initialize", { protocolVersion: "2025-06-18" }))}\n`,
    );
    void proc.stdin.write(
      `${JSON.stringify(call(2, "tools/call", { name: "servo_css_specificity", arguments: { selector: "li" } }))}\n`,
    );
    void proc.stdin.end();
    const lines = (await new Response(proc.stdout).text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    await proc.exited;
    expect(lines.find((l) => l.id === 1).result.protocolVersion).toBe(
      "2025-06-18",
    );
    expect(
      JSON.parse(lines.find((l) => l.id === 2).result.content[0].text)
        .components.elementPseudoElement,
    ).toBe(1);
  });

  it("serves the Streamable HTTP endpoint with a session header", async () => {
    const proc = Bun.spawn(
      [
        process.execPath,
        `${import.meta.dir}/index.ts`,
        "--transport",
        "http",
        "--port",
        "0",
      ],
      { stdout: "ignore", stderr: "pipe" },
    );
    try {
      const reader = proc.stderr.getReader();
      let log = "";
      while (!/listening at (\S+)/.test(log)) {
        const { value, done } = await reader.read();
        if (done) break;
        log += new TextDecoder().decode(value);
      }
      const base = /listening at (\S+)/.exec(log)![1]!;
      const headers = {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      };
      const init = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify(
          call(1, "initialize", { protocolVersion: "2025-06-18" }),
        ),
      });
      const sid = init.headers.get("mcp-session-id")!;
      expect(sid).toBeTruthy();
      const list = await fetch(base, {
        method: "POST",
        headers: { ...headers, "mcp-session-id": sid },
        body: JSON.stringify(call(2, "tools/list")),
      });
      expect(
        ((await list.json()) as any).result.tools.length,
      ).toBeGreaterThanOrEqual(40);
      const health = await fetch(new URL("/health", base));
      expect(((await health.json()) as any).status).toBe("ok");
    } finally {
      proc.kill();
    }
  });
});
