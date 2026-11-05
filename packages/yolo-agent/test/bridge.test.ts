// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BridgeHandle, startBridge } from "../src/bridge.ts";
import type { Browser } from "../src/browser.ts";
import {
  CompositeBackend,
  DesktopProxy,
  McpHandler,
  SessionBackend,
} from "../src/mcp.ts";
import { AuditLog, type Autonomy } from "../src/safety.ts";
import { AgentSession } from "../src/tools.ts";

const fakeBrowser = {
  act: async (action: string) => ({
    ok: true,
    summary: `did ${action}`,
    ms: 1,
  }),
  page: async () => ({}),
  prefetch: () => undefined,
} as unknown as Browser;

function makeSession(autonomy: Autonomy) {
  return new AgentSession({
    id: "t",
    browser: fakeBrowser,
    autonomy,
    audit: new AuditLog(),
  });
}

const open: { stop(): Promise<void> | void }[] = [];
afterEach(async () => {
  for (const item of open.splice(0)) await item.stop();
});

function bridgeFor(
  session: AgentSession,
  extra: Partial<Parameters<typeof startBridge>[0]> = {},
): BridgeHandle {
  const handle = startBridge({
    backend: new SessionBackend(session),
    session,
    driver: "cdp",
    nhitlOptIn: false,
    approvalTimeoutMs: 2000,
    token: "tok",
    ...extra,
  });
  open.push(handle);
  return handle;
}

const rpc = (
  bridge: BridgeHandle,
  method: string,
  params: unknown,
  headers: Record<string, string> = {},
  id: number | undefined = 1,
) =>
  fetch(`${bridge.url}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer tok",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

async function socket(
  bridge: BridgeHandle,
  path = "events",
): Promise<{
  ws: WebSocket;
  messages: Record<string, any>[];
  next(type: string): Promise<Record<string, any>>;
}> {
  const ws = new WebSocket(
    `${bridge.url.replace("http", "ws")}/${path}?token=tok`,
  );
  const messages: Record<string, any>[] = [];
  const waiters: { type: string; resolve: (m: Record<string, any>) => void }[] =
    [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    messages.push(msg);
    for (const [i, w] of waiters.entries()) {
      if (w.type === msg.type) {
        waiters.splice(i, 1)[0]?.resolve(msg);
        break;
      }
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  open.push({ stop: () => ws.close() });
  return {
    ws,
    messages,
    next: (type) =>
      new Promise((resolve) => {
        const hit = messages.find((m) => m.type === type);
        if (hit) return resolve(hit);
        waiters.push({ type, resolve });
      }),
  };
}

describe("bridge security", () => {
  test("refuses non-loopback bind", () => {
    expect(() =>
      startBridge({
        backend: new SessionBackend(makeSession("ask")),
        driver: "cdp",
        nhitlOptIn: false,
        host: "0.0.0.0",
      }),
    ).toThrow(/loopback/);
  });

  test("health is open, everything else needs the token", async () => {
    const bridge = bridgeFor(makeSession("auto"));
    expect((await fetch(`${bridge.url}/health`)).status).toBe(200);
    expect(
      (await fetch(`${bridge.url}/mcp`, { method: "POST", body: "{}" })).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${bridge.url}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer wrong" },
          body: "{}",
        })
      ).status,
    ).toBe(401);
    expect((await rpc(bridge, "ping", {})).status).toBe(200);
  });

  test("web page origins are rejected even with a valid token", async () => {
    const bridge = bridgeFor(makeSession("auto"));
    const res = await rpc(
      bridge,
      "ping",
      {},
      { origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
    const ext = await rpc(
      bridge,
      "ping",
      {},
      { origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop" },
    );
    expect(ext.status).toBe(200);
  });
});

describe("MCP over HTTP", () => {
  test("initialize, list and call; read-only tools need no approval", async () => {
    const bridge = bridgeFor(makeSession("ask"));
    const init = (await (
      await rpc(bridge, "initialize", { protocolVersion: "2025-06-18" })
    ).json()) as any;
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.capabilities.tools).toBeDefined();
    const list = (await (await rpc(bridge, "tools/list", {})).json()) as any;
    const names: string[] = list.result.tools.map((t: any) => t.name);
    expect(names).toContain("browser_batch");
    expect(names).toContain("audit_a11y");
    expect(
      list.result.tools.find((t: any) => t.name === "browser_observe")
        .annotations.readOnlyHint,
    ).toBe(true);
    const shot = (await (
      await rpc(bridge, "tools/call", {
        name: "browser_screenshot",
        arguments: {},
      })
    ).json()) as any;
    expect(shot.result.isError).toBe(false);
  });

  test("notifications get 202 and SSE accept gets an event stream", async () => {
    const bridge = bridgeFor(makeSession("auto"));
    const note = await fetch(`${bridge.url}/mcp`, {
      method: "POST",
      headers: {
        authorization: "Bearer tok",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    expect(note.status).toBe(202);
    const sse = await rpc(bridge, "ping", {}, { accept: "text/event-stream" });
    expect(sse.headers.get("content-type")).toContain("text/event-stream");
    expect(await sse.text()).toContain('data: {"jsonrpc":"2.0"');
  });

  test("ask mode with nobody connected denies immediately and audits it", async () => {
    const session = makeSession("ask");
    const bridge = bridgeFor(session);
    const res = (await (
      await rpc(bridge, "tools/call", {
        name: "browser_click",
        arguments: { ref: "e1" },
      })
    ).json()) as any;
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("DENIED");
    expect(session.audit.entries.at(-1)?.outcome).toBe("denied");
  });

  test("unknown tool and bad arguments are errors, not crashes", async () => {
    const bridge = bridgeFor(makeSession("auto"));
    const unknown = (await (
      await rpc(bridge, "tools/call", { name: "nope", arguments: {} })
    ).json()) as any;
    expect(unknown.error.code).toBe(-32602);
    const bad = (await (
      await rpc(bridge, "tools/call", { name: "browser_type", arguments: {} })
    ).json()) as any;
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0].text).toContain("missing required");
  });
});

describe("websocket events, approvals and autonomy", () => {
  test("approval round trip over the events socket", async () => {
    const session = makeSession("ask");
    const bridge = bridgeFor(session);
    const client = await socket(bridge);
    await client.next("hello");

    const approved = rpc(bridge, "tools/call", {
      name: "browser_click",
      arguments: { ref: "e1" },
    }).then((r) => r.json()) as Promise<any>;
    const request = await client.next("approval_request");
    expect(request.action).toBe("click");
    client.ws.send(
      JSON.stringify({
        type: "approval_response",
        id: request.id,
        approved: true,
      }),
    );
    const result = await approved;
    expect(result.result.isError).toBe(false);
    expect(result.result.content[0].text).toContain("did click");

    client.messages.length = 0;
    const denied = rpc(bridge, "tools/call", {
      name: "browser_click",
      arguments: { ref: "e1" },
    }).then((r) => r.json()) as Promise<any>;
    const second = await client.next("approval_request");
    client.ws.send(
      JSON.stringify({
        type: "approval_response",
        id: second.id,
        approved: false,
      }),
    );
    expect((await denied).result.content[0].text).toContain("DENIED");
    expect(session.audit.entries.map((e) => e.outcome)).toEqual(
      expect.arrayContaining(["approved", "denied"]),
    );
  });

  test("tool events are published to subscribers", async () => {
    const bridge = bridgeFor(makeSession("auto"));
    const client = await socket(bridge);
    await client.next("hello");
    await rpc(bridge, "tools/call", {
      name: "browser_click",
      arguments: { ref: "e1" },
    });
    const end = await client.next("tool_end");
    expect(end).toMatchObject({ name: "browser_click", isError: false });
  });

  test("switching to nhitl at runtime needs the process-level opt-in", async () => {
    const session = makeSession("ask");
    const bridge = bridgeFor(session);
    const client = await socket(bridge);
    client.ws.send(JSON.stringify({ type: "autonomy", level: "nhitl" }));
    const err = await client.next("error");
    expect(err.message).toContain("--nhitl");
    expect(session.autonomy).toBe("ask");

    const optedIn = makeSession("ask");
    const bridge2 = bridgeFor(optedIn, { nhitlOptIn: true });
    const client2 = await socket(bridge2);
    client2.ws.send(JSON.stringify({ type: "autonomy", level: "nhitl" }));
    await client2.next("autonomy");
    expect(optedIn.autonomy).toBe("nhitl");
  });

  test("nhitl lets gated actions run without anyone connected", async () => {
    const bridge = bridgeFor(makeSession("nhitl"), { nhitlOptIn: true });
    const res = (await (
      await rpc(bridge, "tools/call", {
        name: "browser_evaluate",
        arguments: { expression: "1" },
      })
    ).json()) as any;
    expect(res.result.isError).toBe(false);
  });
});

describe("desktop proxy", () => {
  async function fakeDesktop(): Promise<string[]> {
    const dir = await mkdtemp(join(tmpdir(), "yolo-desktop-fake-"));
    const script = join(dir, "server.ts");
    await writeFile(
      script,
      `for await (const chunk of Bun.stdin.stream()) {
  for (const line of new TextDecoder().decode(chunk).split("\\n")) {
    if (!line.trim()) continue;
    const m = JSON.parse(line);
    if (m.id === undefined) continue;
    let result = {};
    if (m.method === "initialize") result = { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake" } };
    if (m.method === "tools/list") result = { tools: ["computer_observe", "computer_click", "os_info", "registry_read"].map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {} } })) };
    if (m.method === "tools/call") result = { content: [{ type: "text", text: "ran " + m.params.name }] };
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }) + "\\n");
  }
}`,
    );
    return ["bun", script];
  }

  test("only allowlisted tools are exposed, token and approval are enforced", async () => {
    const session = makeSession("ask");
    const proxy = new DesktopProxy(
      {
        command: await fakeDesktop(),
        allow: ["computer_observe", "computer_click"],
      },
      session,
    );
    await proxy.start();
    open.push({ stop: () => proxy.stop() });
    const backend = new CompositeBackend(new SessionBackend(session), proxy);
    const bridge = bridgeFor(session, { backend, desktopToken: "dtok" });

    const list = (await (await rpc(bridge, "tools/list", {})).json()) as any;
    const names: string[] = list.result.tools.map((t: any) => t.name);
    expect(names).toContain("desktop_computer_observe");
    expect(names).toContain("desktop_computer_click");
    expect(names).not.toContain("desktop_os_info");
    expect(names).not.toContain("desktop_registry_read");

    const call = async (name: string, headers: Record<string, string>) =>
      (await (
        await rpc(bridge, "tools/call", { name, arguments: {} }, headers)
      ).json()) as any;

    expect(
      (await call("desktop_computer_observe", {})).result.content[0].text,
    ).toContain("missing or invalid desktop token");
    expect(
      (
        await call("desktop_computer_observe", {
          "x-yolo-desktop-token": "wrong",
        })
      ).result.isError,
    ).toBe(true);
    expect(
      (
        await call("desktop_computer_observe", {
          "x-yolo-desktop-token": "dtok",
        })
      ).result.content[0].text,
    ).toBe("ran computer_observe");
    // click is not read-only: at autonomy=ask with no approver it is denied even with the token
    expect(
      (await call("desktop_computer_click", { "x-yolo-desktop-token": "dtok" }))
        .result.content[0].text,
    ).toContain("needs human approval");
  });

  test("empty allowlist is refused", async () => {
    const proxy = new DesktopProxy(
      { command: ["bun", "-e", "0"], allow: [] },
      makeSession("ask"),
    );
    await expect(proxy.start()).rejects.toThrow(/allowlist/);
  });
});

describe("mcp handler without HTTP", () => {
  test("negotiates down to a supported protocol version", async () => {
    const handler = new McpHandler(new SessionBackend(makeSession("auto")));
    const res = await handler.handle(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      },
      { desktopAuthorized: true },
    );
    expect((res?.result as any).protocolVersion).toBe("2025-06-18");
  });
});
