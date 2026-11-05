/**
 * End-to-end: crawls six chrome:// pages of a real `--headless` yolo-chromium
 * and verifies a persistent (`--webui-patch-dir`) and a live (CDP) CSS edit
 * on chrome://version through computed styles.
 *
 * Runs only when YOLO_CHROMIUM_EXE points at a built yolo-chromium launcher
 * (`cargo build -p yolo-chromium`); skipped otherwise.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { launchHeadless, type RunningBrowser } from "./browser.ts";
import { crawl } from "./crawl.ts";
import { applyCss, computedStyle } from "./edit.ts";
import { PageSession } from "./session.ts";

const exe = Bun.env.YOLO_CHROMIUM_EXE?.trim();
const run = exe ? test : test.skip;
const work = mkdtempSync(join(tmpdir(), "obscura-chrome-e2e-"));
let browser: RunningBrowser | undefined;
let session: PageSession | undefined;

beforeAll(async () => {
  if (!exe) return;
  const patchDir = join(work, "patches");
  // The shell refuses group- or world-writable patch files on Unix.
  mkdirSync(patchDir, { recursive: true, mode: 0o700 });
  const patchFile = join(patchDir, "version.css");
  await Bun.write(
    patchFile,
    "body { border-top: 7px solid rgb(1, 2, 3) !important; }\n",
  );
  if (process.platform !== "win32") {
    chmodSync(patchDir, 0o700);
    chmodSync(patchFile, 0o600);
  }
  browser = await launchHeadless({
    exe,
    port: Number(Bun.env.OBSCURA_CHROME_E2E_PORT ?? 9347),
    profileDir: join(work, "profile"),
    patchDir,
    // Outside `work`: this process keeps the log handle open until exit.
    logFile: join(tmpdir(), `obscura-chrome-e2e-${process.pid}.log`),
  });
  session = await PageSession.attach(browser.endpoint, { createTarget: true });
}, 60_000);

afterAll(async () => {
  await session?.close().catch(() => undefined);
  await browser?.stop();
  if (Bun.env.OBSCURA_CHROME_E2E_KEEP) return;
  // Chromium sub-processes can hold profile files for a moment after the
  // launcher exits.
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(work, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt >= 40) {
        console.warn(`could not remove ${work}: ${error}`);
        break;
      }
      await Bun.sleep(250);
    }
  }
}, 30_000);

const REQUIRED = [
  "version",
  "gpu",
  "flags",
  "settings",
  "extensions",
  "chrome-urls",
];

run(
  "crawls chrome://version, gpu, flags, settings, extensions, and chrome-urls headless",
  async () => {
    const { index, outDir } = await crawl(session!, browser!.version, {
      outRoot: join(work, "out"),
      only: REQUIRED,
      log: () => undefined,
    });
    expect(index.listed).toBeGreaterThan(100);
    expect(index.denied.map((entry) => entry.url)).toContain("chrome://kill/");
    expect(index.pages.map((page) => page.url).sort()).toEqual(
      REQUIRED.map((host) => `chrome://${host}/`).sort(),
    );
    for (const page of index.pages) {
      expect({ url: page.url, status: page.status }).toEqual({
        url: page.url,
        status: "loaded",
      });
      expect(page.title.length).toBeGreaterThan(0);
      for (const file of [
        "dom-snapshot.json",
        "page.html",
        "text.txt",
        "ax-tree.json",
        "screenshot.png",
      ]) {
        expect(existsSync(join(outDir, page.dir, file))).toBe(true);
      }
    }
    expect(existsSync(join(outDir, "index.json"))).toBe(true);
    const version = index.pages.find(
      (page) => page.url === "chrome://version/",
    );
    expect(version?.webuiPatch).toBe("version");
  },
  120_000,
);

run(
  "persistent --webui-patch-dir CSS and a live CDP CSS edit apply to chrome://version",
  async () => {
    const load = await session!.navigate("chrome://version/");
    expect(load.status).toBe("loaded");
    expect(await computedStyle(session!, "body", "border-top-color")).toBe(
      "rgb(1, 2, 3)",
    );
    expect(await computedStyle(session!, "body", "border-top-width")).toBe(
      "7px",
    );

    expect(await computedStyle(session!, "body", "color")).not.toBe(
      "rgb(10, 20, 30)",
    );
    await applyCss(session!, "body { color: rgb(10, 20, 30) !important; }");
    expect(await computedStyle(session!, "body", "color")).toBe(
      "rgb(10, 20, 30)",
    );
  },
  60_000,
);
