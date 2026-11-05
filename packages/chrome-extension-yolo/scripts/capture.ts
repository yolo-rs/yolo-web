// SPDX-License-Identifier: Apache-2.0
/**
 * Loads the built extension in the yolo-chromium CEF shell and captures the
 * new tab page over the DevTools protocol (Page.captureScreenshot), in light
 * and dark, plus the suggestion list, the customize panel and the shortcut
 * dialog. Fails on console errors or uncaught exceptions in the page.
 *
 *   bun run scripts/capture.ts --exe=<yolo-chromium.exe> --out=<dir>
 *     [--port=9350]
 *
 * The shell starts on chrome://version and the page is then navigated to
 * `chrome-extension://<id>/newtab.html` over CDP. Starting the shell with
 * `--url=chrome-extension://<id>/newtab.html` fails with
 * ERR_BLOCKED_BY_CLIENT (exit 2) because the shell's first navigation runs
 * before the unpacked extension is registered; smoke runs on chrome://newtab
 * hang at shutdown. The id is read from the extension's service worker
 * target. The exe can also come from `YOLO_CHROMIUM_EXE`.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DIST_DIR } from "./build.ts";

interface Target {
  readonly id: string;
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl?: string;
}

const args = new Map(
  Bun.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key ?? "", rest.join("=")] as const;
  }),
);
const exe = args.get("exe") || process.env["YOLO_CHROMIUM_EXE"];
const outDir = resolve(args.get("out") || "clone-screens");
const port = Number(args.get("port") || 9350);
if (!exe) {
  throw new Error(
    "pass --exe=<path to yolo-chromium.exe> or set YOLO_CHROMIUM_EXE",
  );
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForTargets(
  predicate: (targets: Target[]) => boolean,
  timeoutMs = 30_000,
): Promise<Target[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as Target[];
      if (predicate(targets)) {
        return targets;
      }
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }
  throw new Error("timed out waiting for DevTools targets");
}

function launch(url: string, cachePath: string, holdMs: number) {
  return Bun.spawn(
    [
      exe!,
      "--smoke",
      `--url=${url}`,
      `--load-extension=${DIST_DIR}`,
      `--remote-debugging-port=${port}`,
      `--cache-path=${cachePath}`,
      `--smoke-hold-ms=${holdMs}`,
      `--smoke-timeout-ms=${holdMs + 30_000}`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
}

class Cdp {
  private nextId = 0;
  private readonly pending = new Map<number, (value: unknown) => void>();
  readonly problems: string[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
        method?: string;
        params?: Record<string, unknown>;
      };
      if (message.id !== undefined) {
        const resolveCall = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          this.problems.push(`CDP error: ${message.error.message}`);
        }
        resolveCall?.(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.problems.push(`exception: ${JSON.stringify(message.params)}`);
      }
      if (message.method === "Runtime.consoleAPICalled") {
        const params = message.params as { type: string; args: unknown[] };
        if (params.type === "error") {
          this.problems.push(`console.error: ${JSON.stringify(params.args)}`);
        }
      }
      if (message.method === "Log.entryAdded") {
        const entry = (
          message.params as {
            entry: { level: string; text: string; url?: string };
          }
        ).entry;
        // The search flow leaves the extension; that site's own errors
        // (aphrody.com/search answers 404) are not the page's.
        const own = !entry.url || entry.url.startsWith("chrome-extension://");
        if (entry.level === "error" && own) {
          this.problems.push(`log: ${entry.text} ${entry.url ?? ""}`);
        }
      }
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise((done, fail) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", fail, { once: true });
    });
    return new Cdp(socket);
  }

  send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done) =>
      this.pending.set(id, done as (value: unknown) => void),
    );
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await this.send<{
      result: { value: T };
      exceptionDetails?: unknown;
    }>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `evaluate failed: ${JSON.stringify(result.exceptionDetails)}`,
      );
    }
    return result.result.value;
  }

  async screenshot(path: string): Promise<void> {
    await sleep(400);
    const { data } = await this.send<{ data: string }>(
      "Page.captureScreenshot",
      {
        format: "png",
        captureBeyondViewport: false,
      },
    );
    await Bun.write(path, Buffer.from(data, "base64"));
    console.log(`  wrote ${path}`);
  }

  close(): void {
    this.socket.close();
  }
}

const SEED = `(async () => {
  const now = Date.now();
  await chrome.storage.local.set({ "ntp.queries": [
    { text: "chromium embedded framework build", count: 6, last: now - 3600e3 },
    { text: "chrome extension manifest v3 new tab", count: 4, last: now - 86400e3 },
    { text: "cheap flights lisbon", count: 2, last: now - 5 * 86400e3 },
    { text: "material color utilities hct", count: 3, last: now - 2 * 86400e3 },
  ] });
  await chrome.storage.sync.set({ "ntp.shortcuts": [
    { id: "s1", title: "Chromium docs", url: "https://chromium.googlesource.com/chromium/src/+/main/docs/" },
    { id: "s2", title: "MDN", url: "https://developer.mozilla.org/" },
    { id: "s3", title: "Bun", url: "https://bun.sh/" },
    { id: "s4", title: "Rust", url: "https://www.rust-lang.org/" },
    { id: "s5", title: "W3C WCAG 2.2", url: "https://www.w3.org/TR/WCAG22/" },
    { id: "s6", title: "crates.io", url: "https://crates.io/" },
  ] });
  const s = (await chrome.storage.sync.get("ntp.settings"))["ntp.settings"] || {};
  await chrome.storage.sync.set({ "ntp.settings": { ...s, shortcutsMode: "mine" } });
  return true;
})()`;

/** Re-reads `read` every 200 ms until `done` holds or 8 s pass. */
async function poll<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + 8000;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await sleep(200);
    value = await read();
  }
  return value;
}

async function key(cdp: Cdp, name: string, code: number): Promise<void> {
  for (const type of ["keyDown", "keyUp"] as const) {
    await cdp.send("Input.dispatchKeyEvent", {
      type,
      key: name,
      code: name,
      windowsVirtualKeyCode: code,
    });
  }
}

/**
 * Test plan cases that drive the real page (test-plan.md, "auto: cdp").
 * Each prints PASS or FAIL; any FAIL sets a non-zero exit code.
 */
async function runFlows(cdp: Cdp, url: string): Promise<void> {
  const results: Array<[string, boolean, string]> = [];
  const check = async (
    id: string,
    run: () => Promise<[boolean, string]>,
  ): Promise<void> => {
    try {
      const [ok, detail] = await run();
      results.push([id, ok, detail]);
    } catch (error) {
      results.push([id, false, String(error)]);
    }
  };
  const tiles = () =>
    cdp.evaluate<string[]>(
      `[...document.querySelectorAll(".yw-tile .yw-tile-title")].map((el) => el.textContent)`,
    );
  const typeQuery = async (text: string) => {
    await cdp.evaluate(`(() => {
      const input = document.getElementById("yw-query");
      input.focus();
      input.value = ${JSON.stringify(text)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(150);
  };

  await check("F02-E1 Escape closes the list, then clears", async () => {
    await typeQuery("ch");
    await key(cdp, "ArrowDown", 40);
    await key(cdp, "Escape", 27);
    const closed = await cdp.evaluate<string>(
      `document.getElementById("yw-query").getAttribute("aria-expanded") + "|" + document.getElementById("yw-query").value`,
    );
    await key(cdp, "Escape", 27);
    const cleared = await cdp.evaluate<string>(
      `document.getElementById("yw-query").value`,
    );
    return [
      closed === "false|ch" && cleared === "",
      `${closed} then "${cleared}"`,
    ];
  });

  await check("F02-E2 Up from the input wraps to the last option", async () => {
    await typeQuery("ch");
    await key(cdp, "ArrowDown", 40);
    await key(cdp, "ArrowUp", 38);
    await key(cdp, "ArrowUp", 38);
    const state = await cdp.evaluate<{
      active: string | null;
      count: number;
    }>(`(() => ({
      active: document.getElementById("yw-query").getAttribute("aria-activedescendant"),
      count: document.querySelectorAll('[role="option"]').length,
    }))()`);
    return [
      Boolean(state.active?.endsWith(`-${state.count - 1}`)),
      JSON.stringify(state),
    ];
  });

  await check("F04-H1 add a shortcut from the dialog", async () => {
    const before = (await tiles()).length;
    await cdp.evaluate(`(() => {
      document.querySelector(".yw-tile-add").click();
      document.getElementById("yw-shortcut-name").value = "Servo";
      document.getElementById("yw-shortcut-url").value = "servo.org";
      document.getElementById("yw-shortcut-url").form.requestSubmit();
      return true;
    })()`);
    await sleep(500);
    const after = await tiles();
    const open = await cdp.evaluate<boolean>(
      `Boolean(document.querySelector("dialog[open]"))`,
    );
    return [
      after.length === before + 1 && after.at(-1) === "Servo" && !open,
      after.join(", "),
    ];
  });

  await check(
    "F04-N1 invalid address keeps the dialog open with an error",
    async () => {
      const state = await cdp.evaluate<{
        invalid: string | null;
        error: string;
        open: boolean;
      }>(`(async () => {
      document.querySelector(".yw-tile-add").click();
      document.getElementById("yw-shortcut-url").value = "servo.org";
      document.getElementById("yw-shortcut-url").form.requestSubmit();
      await new Promise((r) => setTimeout(r, 300));
      const out = {
        invalid: document.getElementById("yw-shortcut-url").getAttribute("aria-invalid"),
        error: document.getElementById("yw-shortcut-error").textContent,
        open: Boolean(document.querySelector("dialog[open]")),
      };
      document.querySelector("dialog[open]").close();
      return out;
    })()`);
      return [
        state.invalid === "true" &&
          state.open &&
          state.error.includes("already"),
        JSON.stringify(state),
      ];
    },
  );

  await check("F04-H3 Move right from the tile menu", async () => {
    const before = await tiles();
    await cdp.evaluate(`(() => {
      document.querySelector(".yw-tile .yw-tile-menu-button").click();
      [...document.querySelectorAll(".yw-menu-item")].find((el) => el.textContent.includes("Move right")).click();
      return true;
    })()`);
    await sleep(500);
    const after = await tiles();
    return [
      after[0] === before[1] && after[1] === before[0],
      after.slice(0, 3).join(", "),
    ];
  });

  await check(
    "F04-H2 remove shows an undo toast; Undo restores the position",
    async () => {
      const before = await tiles();
      await cdp.evaluate(`(() => {
      document.querySelectorAll(".yw-tile .yw-tile-menu-button")[1].click();
      [...document.querySelectorAll(".yw-menu-item")].find((el) => el.textContent.includes("Remove")).click();
      return true;
    })()`);
      await sleep(500);
      const removed = await tiles();
      const toast = await cdp.evaluate<string>(
        `document.querySelector(".yw-toast")?.textContent ?? ""`,
      );
      await cdp.evaluate(
        `[...document.querySelectorAll(".yw-toast button")].find((el) => el.textContent === "Undo").click(), true`,
      );
      await sleep(500);
      const restored = await tiles();
      return [
        removed.length === before.length - 1 &&
          toast.includes("Undo") &&
          restored.join() === before.join(),
        `toast "${toast}"; restored ${restored.join(", ")}`,
      ];
    },
  );

  await check(
    "F05-H1 picking a preset in the panel recolors the page",
    async () => {
      const state = await cdp.evaluate<{
        theme?: string;
        surface: string;
      }>(`(async () => {
      document.querySelector(".yw-customize").click();
      document.querySelector('input[type="radio"][value="omarchy"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const out = {
        theme: document.documentElement.dataset.theme,
        surface: document.documentElement.style.getPropertyValue("--yw-surface"),
      };
      document.querySelector('input[type="radio"][value="default"]').click();
      await new Promise((r) => setTimeout(r, 300));
      return out;
    })()`);
      return [
        state.theme === "omarchy" && state.surface === "#1a1b26",
        JSON.stringify(state),
      ];
    },
  );

  await check(
    "F05-H2 Dark mode applies to the seed theme and persists",
    async () => {
      const state = await cdp.evaluate<{
        scheme?: string;
        stored: string;
      }>(`(async () => {
      document.querySelector('input[type="radio"][value="dark"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const stored = (await chrome.storage.sync.get("ntp.settings"))["ntp.settings"].mode;
      const out = { scheme: document.documentElement.dataset.scheme, stored };
      document.querySelector('input[type="radio"][value="device"]').click();
      await new Promise((r) => setTimeout(r, 300));
      document.querySelector("dialog[open]").close();
      return out;
    })()`);
      return [
        state.scheme === "dark" && state.stored === "dark",
        JSON.stringify(state),
      ];
    },
  );

  await check(
    "F05-H3 footer and shortcuts toggles hide their sections",
    async () => {
      const state = await cdp.evaluate<string>(`(async () => {
      const s = (await chrome.storage.sync.get("ntp.settings"))["ntp.settings"];
      await chrome.storage.sync.set({ "ntp.settings": { ...s, footerVisible: false, shortcutsVisible: false } });
      await new Promise((r) => setTimeout(r, 300));
      const out = [document.querySelector(".yw-footer").hidden, document.querySelector(".yw-slot").hidden].join();
      await chrome.storage.sync.set({ "ntp.settings": { ...s, footerVisible: true, shortcutsVisible: true } });
      return out;
    })()`);
      return [state === "true,true", state];
    },
  );

  await check(
    "F05-H4 a picked image becomes the background; None clears it",
    async () => {
      await cdp.evaluate(
        `document.querySelector(".yw-customize").click(), true`,
      );
      const { root } = await cdp.send<{ root: { nodeId: number } }>(
        "DOM.getDocument",
      );
      const { nodeId } = await cdp.send<{ nodeId: number }>(
        "DOM.querySelector",
        {
          nodeId: root.nodeId,
          selector: 'input[type="file"]',
        },
      );
      await cdp.send("DOM.setFileInputFiles", {
        nodeId,
        files: [join(DIST_DIR, "icons", "icon-128.png")],
      });
      const withImage = await poll(
        () =>
          cdp.evaluate<string>(
            `document.body.classList.contains("yw-has-image") + "|" + document.body.style.getPropertyValue("--yw-background-image").slice(0, 9)`,
          ),
        (value) => value.startsWith("true"),
      );
      await cdp.evaluate(
        `document.querySelector('input[type="radio"][value="none"]').click(), true`,
      );
      await sleep(800);
      const cleared = await cdp.evaluate<boolean>(
        `!document.body.classList.contains("yw-has-image")`,
      );
      await cdp.evaluate(
        `document.querySelector("dialog[open]").close(), true`,
      );
      return [
        withImage.startsWith('true|url("blob') && cleared,
        `${withImage}; cleared ${cleared}`,
      ];
    },
  );

  await check("F01-E1 Enter on an empty box stays on the page", async () => {
    await typeQuery("");
    await key(cdp, "Enter", 13);
    await sleep(300);
    const location = await cdp.evaluate<string>("location.href");
    return [location === url, location];
  });

  await check(
    "F01-H1 Enter submits to the search template and records the query",
    async () => {
      await typeQuery("servo layout engine");
      await key(cdp, "Enter", 13);
      const location = await poll(
        () => cdp.evaluate<string>("location.href").catch(() => ""),
        (value) => value.startsWith("https://"),
      );
      await cdp.send("Page.navigate", { url });
      await sleep(1200);
      const recorded = await cdp.evaluate<boolean>(
        `chrome.storage.local.get("ntp.queries").then((r) => r["ntp.queries"].some((q) => q.text === "servo layout engine"))`,
      );
      return [
        location === "https://aphrody.com/search?q=servo%20layout%20engine" &&
          recorded,
        `${location}; recorded ${recorded}`,
      ];
    },
  );

  console.log("flows:");
  for (const [id, ok, detail] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"} ${id}  (${detail})`);
  }
  if (results.some(([, ok]) => !ok)) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const cache = await mkdtemp(join(tmpdir(), "yw-ntp-"));
  const child = launch("chrome://version", cache, 60_000);
  let cdp: Cdp | undefined;
  try {
    const targets = await waitForTargets(
      (list) =>
        list.some(
          (target) =>
            target.type === "service_worker" &&
            target.url.startsWith("chrome-extension://"),
        ) &&
        list.some(
          (target) =>
            target.type === "page" && target.url === "chrome://version/",
        ),
    );
    const worker = targets.find((target) => target.type === "service_worker")!;
    const id = new URL(worker.url).host;
    const url = `chrome-extension://${id}/newtab.html`;
    console.log(`extension id ${id}`);
    const page = targets.find(
      (target) => target.type === "page" && target.url === "chrome://version/",
    )!;
    cdp = await Cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url });
    await sleep(1500);
    const location = await cdp.evaluate<string>("location.href");
    if (location !== url) {
      throw new Error(`navigation ended on ${location}`);
    }
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const scheme = (value: "light" | "dark") =>
      cdp!.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value }],
      });
    await cdp.evaluate(SEED);
    await cdp.send("Page.reload");
    await sleep(1500);
    await cdp
      .evaluate(
        "document.fonts.ready.then(() => document.fonts.check('16px \"Instrument Sans\"'))",
      )
      .then((loaded) => console.log(`  font loaded: ${String(loaded)}`));

    await scheme("light");
    await cdp.screenshot(join(outDir, "S04-light.png"));
    await scheme("dark");
    await cdp.screenshot(join(outDir, "S04-dark.png"));

    // S02: type and open the suggestion list from the local history.
    await cdp.evaluate(`(() => {
      const input = document.getElementById("yw-query");
      input.focus();
      input.value = "ch";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
    });
    const combobox = await cdp.evaluate<Record<string, string | null>>(`(() => {
      const input = document.getElementById("yw-query");
      return {
        expanded: input.getAttribute("aria-expanded"),
        active: input.getAttribute("aria-activedescendant"),
        value: input.value,
        options: String(document.querySelectorAll('[role="option"]').length),
      };
    })()`);
    console.log(`  combobox ${JSON.stringify(combobox)}`);
    await cdp.screenshot(join(outDir, "S02-dark.png"));
    await scheme("light");
    await cdp.screenshot(join(outDir, "S02-light.png"));

    // S06: the add shortcut dialog with a validation error.
    await cdp.evaluate(`(() => {
      document.getElementById("yw-query").blur();
      document.querySelector(".yw-tile-add").click();
      document.getElementById("yw-shortcut-url").value = "javascript:alert(1)";
      document.querySelector("#yw-shortcut-url").form.requestSubmit();
      return true;
    })()`);
    await sleep(300);
    await cdp.screenshot(join(outDir, "S06-light.png"));
    await cdp.evaluate(`document.querySelector("dialog[open]").close(), true`);

    // S05: the customize panel, then the Aphrody preset.
    await cdp.evaluate(`document.querySelector(".yw-customize").click(), true`);
    await cdp.screenshot(join(outDir, "S05-light.png"));
    await cdp.evaluate(
      `chrome.storage.sync.set({ theme: "aphrody" }).then(() => true)`,
    );
    await sleep(500);
    await cdp.screenshot(join(outDir, "S05-aphrody.png"));
    await cdp.evaluate(`document.querySelector("dialog[open]").close(), true`);
    await cdp.screenshot(join(outDir, "S04-aphrody.png"));

    // Mobile width, dark.
    await cdp.evaluate(
      `chrome.storage.sync.set({ theme: "default" }).then(() => true)`,
    );
    await scheme("dark");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp.screenshot(join(outDir, "S04-mobile-dark.png"));
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await runFlows(cdp, url);

    if (cdp.problems.length > 0) {
      console.error("page problems:");
      for (const problem of cdp.problems) {
        console.error(`  ${problem}`);
      }
      process.exitCode = 1;
    } else {
      console.log("  no console errors or exceptions");
    }
  } finally {
    cdp?.close();
    const code = await child.exited;
    console.log(`shell exit code ${code}`);
    await rm(cache, { recursive: true, force: true }).catch(() => undefined);
  }
}

await main();
