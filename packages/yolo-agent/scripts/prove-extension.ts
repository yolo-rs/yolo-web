// SPDX-License-Identifier: Apache-2.0
/**
 * End-to-end proof for the merged YOLO-Web extension (packages/chrome-extension-yolo):
 * builds it, launches yolo-chromium headless with the extension loaded and a
 * chrome-extension:// start URL (the race fixed in crates/yolo-chromium
 * src/shell.rs), drives a fixture page through the extension tool path
 * (chrome.debugger inside the service worker, via the MCP bridge) and writes a
 * receipt with the real tool output.
 *
 *   YOLO_CHROMIUM=/path/to/yolo-chromium bun scripts/prove-extension.ts \
 *     --out ../../docs/yolo-agent-extension-receipt.json [--browser-args "--ozone-platform=headless"]
 *
 * Linux headless (no display) needs --no-sandbox, which the CLI only accepts
 * with the explicit --nhitl opt-in; this script passes both because it runs
 * the owner's own dev host, against a loopback fixture only.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "../../chrome-extension-yolo/scripts/build.ts";
import { startFixture } from "../fixtures/server.ts";

const root = resolve(import.meta.dir, "..");
const args = Bun.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const chromium = opt("chromium") ?? Bun.env.YOLO_CHROMIUM;
if (!chromium) throw new Error("set YOLO_CHROMIUM or pass --chromium");
const outPath = resolve(
  opt("out") ??
    join(root, "..", "..", "docs", "yolo-agent-extension-receipt.json"),
);
const browserArgs =
  opt("browser-args") ??
  (process.platform === "linux"
    ? "--ozone-platform=headless --disable-gpu"
    : "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Unpacked extension id: first 16 bytes of sha256(absolute path), nibbles mapped to a-p. */
export function unpackedId(path: string): string {
  const digest = createHash("sha256").update(path).digest();
  let id = "";
  for (const byte of digest.subarray(0, 16)) {
    id +=
      String.fromCharCode(97 + (byte >> 4)) +
      String.fromCharCode(97 + (byte & 15));
  }
  return id;
}

interface Step {
  name: string;
  ok: boolean;
  ms: number;
  detail: unknown;
}
const steps: Step[] = [];
const failures: string[] = [];

async function step<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const t0 = performance.now();
  try {
    const detail = await fn();
    steps.push({
      name,
      ok: true,
      ms: Math.round(performance.now() - t0),
      detail,
    });
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({
      name,
      ok: false,
      ms: Math.round(performance.now() - t0),
      detail: message,
    });
    failures.push(`${name}: ${message}`);
    return undefined;
  }
}

const work = await mkdtemp(join(tmpdir(), "yolo-ext-proof-"));
const extDir = join(work, "ext");
const profile = join(work, "profile");
const fixture = startFixture();
let cli: ReturnType<typeof Bun.spawn> | undefined;
const stderrLines: string[] = [];

try {
  const built = await build(extDir);
  const extensionId = unpackedId(extDir);
  const startUrl = `chrome-extension://${extensionId}/newtab.html`;

  cli = Bun.spawn(
    [
      process.execPath,
      join(root, "src", "cli.ts"),
      "serve",
      "--driver",
      "extension",
      "--headless",
      "--nhitl",
      "--no-sandbox",
      "--autonomy",
      "nhitl",
      "--chromium",
      chromium,
      "--extension",
      extDir,
      "--profile",
      profile,
      "--url",
      startUrl,
      ...(browserArgs ? ["--browser-args", browserArgs] : []),
    ],
    { stdout: "ignore", stderr: "pipe", stdin: "ignore" },
  );
  (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of cli!.stderr as ReadableStream<Uint8Array>) {
      buffer += decoder.decode(chunk);
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) stderrLines.push(line);
    }
  })();

  const info = await step("bridge up and extension provisioned", async () => {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (cli!.exitCode !== null)
        throw new Error(
          `cli exited ${cli!.exitCode}: ${stderrLines.join(" | ")}`,
        );
      if (
        stderrLines.some((l) => l.startsWith("bridge:")) &&
        stderrLines.some(
          (l) =>
            l.includes("provisioned") || l.includes("provisioning skipped"),
        )
      ) {
        break;
      }
      await sleep(200);
    }
    const provisioned = stderrLines.find(
      (l) => l.includes("provisioned") || l.includes("provisioning skipped"),
    );
    if (!provisioned?.includes(" provisioned"))
      throw new Error(`not provisioned: ${stderrLines.join(" | ")}`);
    const bridge = JSON.parse(
      await readFile(join(profile, "bridge.json"), "utf8"),
    ) as {
      url: string;
      token: string;
      endpoint: string;
    };
    return { stderr: stderrLines.slice(), ...bridge };
  });
  if (!info) throw new Error("bridge did not come up");
  const {
    url: bridgeUrl,
    token,
    endpoint,
  } = info as { url: string; token: string; endpoint: string };

  await step(
    "start URL chrome-extension://.../newtab.html loaded (race fix)",
    async () => {
      const deadline = Date.now() + 30_000;
      let last: unknown;
      while (Date.now() < deadline) {
        const targets = (await (
          await fetch(`${endpoint}/json/list`)
        ).json()) as {
          type: string;
          url: string;
          title: string;
        }[];
        last = targets.map((t) => ({
          type: t.type,
          url: t.url,
          title: t.title,
        }));
        const hit = targets.find(
          (t) => t.type === "page" && t.url === startUrl,
        );
        if (hit)
          return {
            extensionId,
            startUrl,
            page: { url: hit.url, title: hit.title },
            targets: last,
          };
        await sleep(250);
      }
      throw new Error(
        `no page target at ${startUrl}; targets=${JSON.stringify(last)}`,
      );
    },
  );

  await step("extension service worker has the merged manifest", async () => {
    const targets = (await (await fetch(`${endpoint}/json/list`)).json()) as {
      type: string;
      url: string;
      webSocketDebuggerUrl: string;
    }[];
    const worker = targets.find(
      (t) =>
        t.type === "service_worker" &&
        t.url.startsWith(`chrome-extension://${extensionId}/`),
    );
    if (!worker) throw new Error("service worker target not found");
    const { WsCdpTransport } = await import("../src/cdp.ts");
    const transport = await WsCdpTransport.connect(worker.webSocketDebuggerUrl);
    try {
      const res = await transport.send("Runtime.evaluate", {
        expression: `(() => { const m = chrome.runtime.getManifest(); return JSON.stringify({ name: m.name, version: m.version, permissions: m.permissions, side_panel: m.side_panel, content_scripts: m.content_scripts.map(c => c.js), hasAgentHook: typeof globalThis.__yoloAgent, hasDebugger: typeof chrome.debugger, hasSidePanel: typeof chrome.sidePanel }); })()`,
        returnByValue: true,
      });
      if (res.exceptionDetails)
        throw new Error(String(res.exceptionDetails.text));
      return JSON.parse(res.result.value as string);
    } finally {
      transport.close();
    }
  });

  let rpcId = 0;
  const rpc = async (method: string, params: unknown) => {
    const response = await fetch(`${bridgeUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
    return (await response.json()) as { result?: any; error?: any };
  };
  const call = async (name: string, toolArgs: Record<string, unknown> = {}) => {
    const response = await rpc("tools/call", { name, arguments: toolArgs });
    if (response.error) throw new Error(JSON.stringify(response.error));
    if (response.result?.isError)
      throw new Error(JSON.stringify(response.result.content).slice(0, 600));
    return response.result as {
      content: {
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
      }[];
    };
  };
  const text = (result: Awaited<ReturnType<typeof call>>) =>
    result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "prove-extension", version: "0" },
  });
  await step("tools/list", async () => {
    const r = await rpc("tools/list", {});
    return (r.result.tools as { name: string }[]).map((t) => t.name);
  });

  await step(
    "offscreen document connected the extension to the bridge",
    async () => {
      const deadline = Date.now() + 30_000;
      let last = "";
      while (Date.now() < deadline) {
        const response = await rpc("tools/call", {
          name: "browser_observe",
          arguments: {},
        });
        last = JSON.stringify(response.result?.content ?? response.error).slice(
          0,
          200,
        );
        if (!last.includes("not connected"))
          return { waitedMs: 30_000 - (deadline - Date.now()) };
        await sleep(250);
      }
      throw new Error(`still not connected: ${last}`);
    },
  );
  // The only page is the extension's own new tab, which chrome.debugger cannot
  // attach to, so the agent opens a tab for the work page first.
  await step("browser_tabs new (open a work tab)", async () => {
    const r = await call("browser_tabs", { op: "new", url: "about:blank" });
    return text(r).slice(0, 400);
  });
  await step("browser_navigate (fixture home)", async () => {
    const r = await call("browser_navigate", { url: `${fixture.url}/` });
    return text(r).slice(0, 600);
  });
  const observed = await step("browser_observe (read)", async () => {
    const r = await call("browser_observe", {});
    const out = text(r);
    if (!out.includes("YOLO Fixture Shop"))
      throw new Error(`unexpected observation: ${out.slice(0, 400)}`);
    return out;
  });
  const buttonRef = (observed as string | undefined)?.match(
    /\[(e\d+)\] button "Click me"/,
  )?.[1];
  await step("browser_click (button Click me)", async () => {
    if (!buttonRef) throw new Error("button ref not found in observation");
    const r = await call("browser_click", { ref: buttonRef });
    return { ref: buttonRef, output: text(r).slice(0, 400) };
  });
  await step(
    "browser_extract confirms the click changed the page",
    async () => {
      const r = await call("browser_extract", { selector: "#count" });
      const out = text(r);
      if (!out.includes("Clicked 1 times"))
        throw new Error(`click not reflected: ${out.slice(0, 300)}`);
      return out.slice(0, 400);
    },
  );
  await step("browser_screenshot", async () => {
    const r = await call("browser_screenshot", {});
    const image = r.content.find((c) => c.type === "image");
    if (!image?.data) throw new Error("no image content");
    const bytes = Buffer.from(image.data, "base64");
    const isPng = bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpeg)
      throw new Error(`not PNG or JPEG (mime ${image.mimeType})`);
    let width = 0;
    let height = 0;
    if (isPng) {
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
    } else {
      // Walk JPEG segments to the first start-of-frame marker.
      for (let at = 2; at + 9 < bytes.length;) {
        const marker = bytes[at + 1] as number;
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker)
        ) {
          height = bytes.readUInt16BE(at + 5);
          width = bytes.readUInt16BE(at + 7);
          break;
        }
        at += 2 + bytes.readUInt16BE(at + 2);
      }
    }
    if (!width || !height) throw new Error("could not read image dimensions");
    return {
      mimeType: image.mimeType,
      bytes: bytes.length,
      width,
      height,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  await step(
    "webmcp_list on the WebMCP fixture (polyfill content script)",
    async () => {
      await call("browser_navigate", { url: `${fixture.url}/webmcp` });
      await sleep(500);
      const r = await call("webmcp_list", {});
      return text(r).slice(0, 800);
    },
  );
} finally {
  cli?.kill();
  await cli?.exited.catch(() => undefined);
  await fixture.stop().catch(() => undefined);
  const receipt = {
    generatedAt: new Date().toISOString(),
    host: `${process.platform}-${process.arch}`,
    bun: Bun.version,
    chromium,
    browserArgs,
    command: `YOLO_CHROMIUM=${chromium} bun scripts/prove-extension.ts${browserArgs ? ` --browser-args "${browserArgs}"` : ""}`,
    passed: failures.length === 0 && steps.length > 0,
    failures,
    steps,
    cliStderr: stderrLines.slice(0, 40),
  };
  // The bridge token and pid belong to a session that is already over; keep them out of the file.
  const redact = (key: string, value: unknown) =>
    key === "token" || key === "pid" ? "<redacted>" : value;
  await Bun.write(outPath, `${JSON.stringify(receipt, redact, 2)}\n`);
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
  console.log(`receipt: ${outPath} passed=${receipt.passed}`);
  for (const s of steps)
    console.log(`${s.ok ? "ok  " : "FAIL"} ${s.name} (${s.ms} ms)`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exitCode = 1;
  }
}
