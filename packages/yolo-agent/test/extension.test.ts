// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtension } from "../scripts/build-extension.ts";
import { Browser, CdpTargetBackend } from "../src/browser.ts";
import { WsCdpTransport } from "../src/cdp.ts";
import {
  candidateExecutables,
  launchBrowser,
  type LaunchedBrowser,
} from "../src/launcher.ts";
import { startFixture, type Fixture } from "../fixtures/server.ts";

type Manifest = {
  manifest_version: number;
  version: string;
  permissions: string[];
  host_permissions: string[];
  background: { service_worker: string; type: string };
  content_scripts: { js: string[]; world?: string; matches: string[] }[];
  side_panel: { default_path: string };
  content_security_policy: { extension_pages: string };
};

let dir: string;
let manifest: Manifest;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "yolo-ext-"));
  await buildExtension(dir);
  manifest = (await Bun.file(join(dir, "manifest.json")).json()) as Manifest;
});

describe("extension package", () => {
  test("manifest is MV3 with exactly the documented permissions", () => {
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual([
      "debugger",
      "offscreen",
      "sidePanel",
      "storage",
      "tabs",
    ]);
    expect(manifest.host_permissions).toEqual(["https://api.anthropic.com/*"]);
    expect(manifest.content_security_policy.extension_pages).toBe(
      "script-src 'self'; object-src 'self'",
    );
  });

  test("every file the manifest references exists in the build", () => {
    const refs = [
      manifest.background.service_worker,
      manifest.side_panel.default_path,
      ...manifest.content_scripts.flatMap((c) => c.js),
    ];
    for (const ref of refs) expect(existsSync(join(dir, ref))).toBe(true);
    expect(existsSync(join(dir, "offscreen.html"))).toBe(true);
  });

  test("the WebMCP provider runs in the MAIN world, the relay in the isolated world", () => {
    const main = manifest.content_scripts.find((c) =>
      c.js.includes("webmcp-main.js"),
    );
    const relay = manifest.content_scripts.find((c) =>
      c.js.includes("webmcp-relay.js"),
    );
    expect(main?.world).toBe("MAIN");
    expect(relay?.world).toBeUndefined();
  });

  test("no remote code, no secrets, no host globals in the bundles", async () => {
    for (const name of [
      "service-worker.js",
      "offscreen.js",
      "sidepanel.js",
      "webmcp-main.js",
      "webmcp-relay.js",
    ]) {
      const code = await Bun.file(join(dir, name)).text();
      expect(code).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
      expect(code).not.toContain("process.env");
      expect(code).not.toMatch(/\beval\s*\(/);
      expect(code).not.toMatch(/new Function\s*\(/);
      expect(code).not.toMatch(/import\(\s*["']https?:/);
    }
    // Bun-only globals are guarded so the worker does not throw when Bun is absent.
    const worker = await Bun.file(join(dir, "service-worker.js")).text();
    expect(worker).toContain('typeof Bun === "undefined"');
  });

  test("the page-facing provider registers no browser-control tools", async () => {
    const code = await Bun.file(join(dir, "webmcp-main.js")).text();
    expect(code).not.toContain("registerTool({");
    expect(code).not.toContain("chrome.");
  });
});

const hasBrowser = candidateExecutables().some((p) => existsSync(p));
describe("WebMCP polyfill in a real browser", () => {
  let proc: LaunchedBrowser;
  let transport: WsCdpTransport;
  let browser: Browser;
  let fixture: Fixture;

  beforeAll(async () => {
    if (!hasBrowser) return;
    fixture = startFixture();
    proc = await launchBrowser({ headless: true });
    transport = await WsCdpTransport.connect(proc.endpoint);
    browser = new Browser(new CdpTargetBackend(transport));
  }, 60_000);
  afterAll(async () => {
    if (!hasBrowser) return;
    transport.close();
    await proc.kill();
    await fixture.stop();
  });

  (hasBrowser ? test : test.skip)(
    "registerTool, getTools, executeTool and AbortSignal unregistration follow the draft IDL",
    async () => {
      const page = await browser.page();
      // A secure context is required by the spec; localhost qualifies. Load the provider as a page script.
      await page.send("Page.addScriptToEvaluateOnNewDocument", {
        source: await Bun.file(join(dir, "webmcp-main.js")).text(),
      });
      await page.send("Page.navigate", { url: `${fixture.url}/` });
      await new Promise((r) => setTimeout(r, 300));
      const result = await page.evaluate<Record<string, unknown>>(
        `(async () => {
          const mc = document.modelContext;
          if (!mc) return { missing: true };
          const ac = new AbortController();
          await mc.registerTool({ name: "echo", description: "Echo", inputSchema: { type: "object" }, annotations: { readOnlyHint: true }, execute: async (i) => ({ got: i.x }) }, { signal: ac.signal });
          const listed = (await mc.getTools()).map((t) => t.name);
          const out = await mc.executeTool({ name: "echo" }, { x: 7 });
          let dup = "none";
          try { await mc.registerTool({ name: "echo", description: "d", execute() {} }); } catch (e) { dup = e.name; }
          ac.abort();
          const after = (await mc.getTools()).map((t) => t.name);
          return { listed, out, dup, after, alias: navigator.modelContext === document.modelContext || typeof navigator.modelContext };
        })()`,
        true,
      );
      expect(result.missing).toBeUndefined();
      expect(result.listed).toEqual(["echo"]);
      expect(result.out).toBe('{"got":7}');
      expect(result.after).toEqual([]);
      expect(result.dup).not.toBe("none");
    },
    30_000,
  );
});
