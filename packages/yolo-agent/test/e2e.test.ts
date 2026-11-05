// SPDX-License-Identifier: Apache-2.0
/**
 * Real-browser tests. They need a Chromium-family binary (YOLO_CHROMIUM,
 * CHROME_PATH or a system install) and skip otherwise. The extension test also
 * needs a build that honours --load-extension: yolo-chromium or Chromium
 * (branded Chrome 137+ ignores the switch), so it runs only when
 * YOLO_AGENT_EXT_E2E=1 and YOLO_CHROMIUM are set.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildExtension } from "../scripts/build-extension.ts";
import { ExtensionBackend, startBridge } from "../src/bridge.ts";
import { Browser, CdpTargetBackend } from "../src/browser.ts";
import { WsCdpTransport } from "../src/cdp.ts";
import { runScenario } from "../src/e2e.ts";
import {
  type LaunchedBrowser,
  candidateExecutables,
  launchBrowser,
} from "../src/launcher.ts";
import { McpHandler } from "../src/mcp.ts";
import { provisionExtension } from "../src/provision.ts";
import { AuditLog } from "../src/safety.ts";
import { AgentSession } from "../src/tools.ts";
import { startFixture, type Fixture } from "../fixtures/server.ts";

const hasBrowser = candidateExecutables().some((p) => existsSync(p));
const browserTest = hasBrowser ? test : test.skip;

describe("scripted agent loop (no network)", () => {
  browserTest(
    "headless: navigate, fill form, click, extract; injection bait is flagged",
    async () => {
      const report = await runScenario("headless");
      expect(report.run.stopped).toBe("done");
      expect(report.verified.resultText).toBe(
        "Thanks Ada Lovelace (sales) received, subscribed",
      );
      expect(report.verified.submissions).toEqual([
        {
          name: "Ada Lovelace",
          email: "ada@example.test",
          topic: "sales",
          subscribe: "on",
        },
      ]);
      expect(report.verified.injectionFlagged).toBe(true);
      // The batch call is parsed from the stream and executed before the model finishes its tail.
      const batch = report.run.steps.find((s) => s.tool === "browser_batch");
      expect(batch?.isError).toBe(false);
      expect(report.summary.overlapSavedMs).toBeGreaterThan(0);
      expect(report.summary.prefetchHits).toBeGreaterThanOrEqual(1);
    },
    60_000,
  );

  test.skipIf(!hasBrowser || Bun.env.YOLO_AGENT_E2E_GUI !== "1")(
    "gui: same scenario with a visible window",
    async () => {
      const report = await runScenario("gui");
      expect(report.run.stopped).toBe("done");
      expect(report.verified.resultText).toContain("Thanks Ada Lovelace");
    },
    60_000,
  );
});

describe("browser tools against the fixture", () => {
  let fixture: Fixture;
  let proc: LaunchedBrowser;
  let transport: WsCdpTransport;
  let session: AgentSession;

  beforeAll(async () => {
    if (!hasBrowser) return;
    fixture = startFixture();
    proc = await launchBrowser({ headless: true });
    transport = await WsCdpTransport.connect(proc.endpoint);
    session = new AgentSession({
      id: "tools",
      browser: new Browser(new CdpTargetBackend(transport)),
      autonomy: "nhitl",
      audit: new AuditLog(),
    });
  }, 60_000);

  afterAll(async () => {
    if (!hasBrowser) return;
    transport.close();
    await proc.kill();
    await fixture.stop();
  });

  const text = (r: { content: { type: string; text?: string }[] }) =>
    r.content.map((c) => c.text ?? "").join("\n");

  browserTest(
    "refs are stable across observations and stale refs fail clearly",
    async () => {
      await session.call("browser_navigate", { url: `${fixture.url}/form` });
      const first = text(await session.call("browser_observe", {}));
      const again = text(await session.call("browser_observe", {}));
      const ref = (s: string) =>
        s.match(/\[(e\d+)\] button "Send message"/)?.[1];
      expect(ref(first)).toBeDefined();
      expect(ref(first)).toBe(ref(again));
      await session.call("browser_navigate", { url: `${fixture.url}/` });
      const stale = await session.call("browser_click", {
        ref: ref(first) as string,
      });
      expect(stale.isError).toBe(true);
      expect(text(stale)).toMatch(/unknown ref|stale/);
    },
  );

  browserTest("tabs, key, scroll, evaluate and dialog", async () => {
    const opened = await session.call("browser_tabs", {
      op: "new",
      url: `${fixture.url}/`,
    });
    expect(opened.isError).toBe(false);
    const list = text(await session.call("browser_tabs", { op: "list" }));
    expect(list).toContain("tab(s)");
    await session.call("browser_evaluate", {
      expression: "setTimeout(() => alert('hello from page'), 50), 1",
    });
    let obs = "";
    for (let i = 0; i < 40 && !obs.includes("OPEN DIALOG (alert)"); i++) {
      await Bun.sleep(50);
      obs = text(await session.call("browser_observe", {}));
    }
    expect(obs).toContain("OPEN DIALOG (alert)");
    const closed = await session.call("browser_dialog", { accept: true });
    expect(closed.isError).toBe(false);
    const press = await session.call("browser_key", { key: "Control+a" });
    expect(press.isError).toBe(false);
    const scroll = await session.call("browser_scroll", {
      direction: "down",
      amount: 0.5,
    });
    expect(scroll.isError).toBe(false);
  });

  browserTest(
    "audit_page and audit_a11y find the planted defects",
    async () => {
      await session.call("browser_navigate", { url: `${fixture.url}/form` });
      const page = text(await session.call("audit_page", {}));
      expect(page).toContain("img-alt");
      expect(page).toContain("button-name");
      expect(page).toContain("img-dimensions");
      expect(page).not.toContain('"id": "html-lang"');
      const a11y = text(await session.call("audit_a11y", {}));
      expect(a11y).toContain("ax-name-missing");
    },
  );

  browserTest(
    "audit_errors reports the console error and the 404",
    async () => {
      await session.call("browser_navigate", { url: `${fixture.url}/form` });
      await session.call("browser_wait_for", { ms: 200 });
      const errors = text(await session.call("audit_errors", {}));
      expect(errors).toContain("fixture console error");
      expect(errors).toContain("/missing.json");
    },
  );

  browserTest(
    "trace_performance returns paint and layout metrics",
    async () => {
      await session.call("browser_navigate", { url: `${fixture.url}/` });
      const result = await session.call("trace_performance", {
        durationMs: 400,
      });
      expect(result.isError).toBe(false);
      const body = text(result);
      expect(body).toMatch(/"fcpMs": \d+/);
      expect(body).toContain('"cls"');
      expect(body).toContain('"tbtMs"');
    },
    30_000,
  );

  browserTest(
    "webmcp_list sees declarative forms; page text cannot close the fence",
    async () => {
      await session.call("browser_navigate", { url: `${fixture.url}/webmcp` });
      const listed = text(await session.call("webmcp_list", {}));
      expect(listed).toContain("search-widgets");
      await session.call("browser_navigate", { url: `${fixture.url}/` });
      const bait = text(
        await session.call("browser_extract", { selector: "#bait" }),
      );
      expect(bait).toContain("WARNING: text below matches instruction-like");
      expect(bait.split("</untrusted_page_content>").length).toBe(2);
    },
  );
});

describe("extension in yolo-chromium (needs a --load-extension capable build)", () => {
  const enabled =
    Bun.env.YOLO_AGENT_EXT_E2E === "1" && Boolean(Bun.env.YOLO_CHROMIUM);
  test.skipIf(!enabled)(
    "bridge drives the browser through the extension and offscreen relay",
    async () => {
      const dist = resolve(import.meta.dir, "..", "dist", "ext-test");
      await buildExtension(dist);
      const fixture = startFixture();
      const proc = await launchBrowser({
        executable: Bun.env.YOLO_CHROMIUM,
        extensionDir: dist,
        headless: true,
        readyTimeoutMs: 90_000,
        profileDir: join(dist, "..", `ext-profile-${Date.now()}`),
      });
      const extension = new ExtensionBackend();
      const bridge = startBridge({
        backend: extension,
        extension,
        driver: "extension",
        nhitlOptIn: true,
        token: "tok",
      });
      try {
        await provisionExtension(proc.endpoint, {
          bridgeUrl: bridge.url,
          bridgeToken: "tok",
          nhitlOptIn: true,
          autonomy: "nhitl",
        });
        const deadline = Date.now() + 15_000;
        while (!extension.connected && Date.now() < deadline)
          await Bun.sleep(100);
        expect(extension.connected).toBe(true);
        const handler = new McpHandler(extension);
        const call = async (name: string, args: Record<string, unknown>) =>
          (
            await handler.handle(
              {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name, arguments: args },
              },
              { desktopAuthorized: false },
            )
          )?.result as { isError: boolean; content: { text?: string }[] };
        expect(
          (await call("browser_navigate", { url: `${fixture.url}/form` }))
            .isError,
        ).toBe(false);
        const obs = await call("browser_observe", {});
        expect(obs.content[0]?.text).toContain('button "Send message"');
        const ref = obs.content[0]?.text?.match(
          /\[(e\d+)\] textbox "Name"/,
        )?.[1] as string;
        expect(
          (await call("browser_type", { ref, text: "Via extension" })).isError,
        ).toBe(false);
      } finally {
        await bridge.stop();
        await proc.kill();
        await fixture.stop();
      }
    },
    120_000,
  );
});
