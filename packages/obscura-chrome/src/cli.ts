#!/usr/bin/env bun
/**
 * obscura-chrome: crawl and edit chrome:// WebUI pages of a headless
 * yolo-chromium (real Chromium via CEF) over the DevTools protocol.
 */

import { join, resolve } from "node:path";

import {
  defaultExecutable,
  fetchVersion,
  launchHeadless,
  type BrowserVersion,
} from "./browser.ts";
import { crawl, listChromeUrls } from "./crawl.ts";
import {
  applyEdit,
  computedStyle,
  parseStyleCheck,
  type EditKind,
} from "./edit.ts";
import { PageSession } from "./session.ts";
import { denyReason } from "./urls.ts";

const USAGE = `obscura-chrome - crawl and edit chrome:// pages of a headless yolo-chromium

Usage:
  obscura-chrome crawl  [browser] [--out=dist/chrome-crawl] [--only=version,gpu] [--limit=N]
                        [--no-debug-pages] [--timeout-ms=20000] [--settle-ms=750]
  obscura-chrome list   [browser]
  obscura-chrome edit css|js|html --url=chrome://version/ --file=<patch> [--selector=body]
                        [--check=<selector>:<property>=<value>] [--screenshot=out.png] [browser]
  obscura-chrome style  --url=<url> --selector=<css> --property=<name> [browser]

Browser (one of):
  --endpoint=http://127.0.0.1:9222   Attach to a running browser's DevTools endpoint
  --exe=<yolo-chromium>              Start it --headless (default: $YOLO_CHROMIUM_EXE or the cargo build)
  --port=9333                        DevTools port for --exe
  --windowless                       CEF off-screen rendering (Alloy style) instead of Chromium headless
  --patch-dir=<dir>                  Forward --webui-patch-dir (persistent chrome:// edits) to --exe
  --log=<file>                       Browser log file for --exe
`;

type Flags = Map<string, string>;

function parse(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = new Map();
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq < 0) flags.set(arg.slice(2), "true");
      else flags.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function int(flags: Flags, name: string): number | undefined {
  const raw = flags.get(name);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`--${name} expects a non-negative integer`);
  return value;
}

/** Starts a fresh browser after the previous one exited; launched browsers only. */
type Restart = () => Promise<{ endpoint: string; version: BrowserVersion }>;

async function withBrowser<T>(
  flags: Flags,
  run: (
    endpoint: string,
    version: BrowserVersion,
    restart?: Restart,
  ) => Promise<T>,
): Promise<T> {
  const endpoint = flags.get("endpoint");
  if (endpoint) return run(endpoint, await fetchVersion(endpoint));
  const exe = flags.get("exe") ?? defaultExecutable();
  if (!exe)
    throw new Error(
      "no browser: pass --endpoint or --exe, or set YOLO_CHROMIUM_EXE",
    );
  const patchDir = flags.get("patch-dir");
  const launch = () =>
    launchHeadless({
      exe,
      port: int(flags, "port") ?? 9333,
      patchDir: patchDir ? resolve(patchDir) : undefined,
      logFile: flags.get("log"),
      mode: flags.has("windowless") ? "windowless" : "headless",
    });
  let browser = await launch();
  const restart: Restart = async () => {
    await browser.stop();
    browser = await launch();
    return browser;
  };
  try {
    return await run(browser.endpoint, browser.version, restart);
  } finally {
    await browser.stop();
  }
}

async function main(argv: string[]): Promise<number> {
  const { positional, flags } = parse(argv);
  const [command, sub] = positional;
  if (!command || flags.has("help") || command === "help") {
    console.log(USAGE);
    return command ? 0 : 64;
  }
  switch (command) {
    case "crawl":
      return withBrowser(flags, async (endpoint, version, restart) => {
        // A fresh tab: the browser's first page stays open, so pages that
        // close their own tab do not end a headless yolo-chromium.
        let session = await PageSession.attach(endpoint, {
          createTarget: true,
        });
        try {
          const only = flags
            .get("only")
            ?.split(",")
            .map((host) => host.trim())
            .filter(Boolean);
          const { index, outDir } = await crawl(session, version, {
            outRoot: resolve(flags.get("out") ?? join("dist", "chrome-crawl")),
            only,
            limit: int(flags, "limit"),
            debugPages: !flags.has("no-debug-pages"),
            timeoutMs: int(flags, "timeout-ms"),
            settleMs: int(flags, "settle-ms"),
            restart: restart
              ? async () => {
                  await session.close().catch(() => undefined);
                  const next = await restart();
                  session = await PageSession.attach(next.endpoint, {
                    createTarget: true,
                  });
                  return session;
                }
              : undefined,
          });
          console.log(
            JSON.stringify({
              outDir,
              chromiumVersion: index.chromiumVersion,
              listed: index.listed,
              denied: index.denied.length,
              crawled: index.crawled,
              loaded: index.loaded,
              failed: index.pages
                .filter((page) => page.status !== "loaded")
                .map((page) => `${page.url} ${page.status}`),
            }),
          );
          return 0;
        } finally {
          await session.close();
        }
      });
    case "list":
      return withBrowser(flags, async (endpoint) => {
        const session = await PageSession.attach(endpoint);
        try {
          const listing = await listChromeUrls(session, {
            debugPages: !flags.has("no-debug-pages"),
          });
          console.log(
            JSON.stringify(
              {
                urls: listing.urls,
                denied: listing.denied,
                debugPages: listing.debugPages,
              },
              null,
              2,
            ),
          );
          return 0;
        } finally {
          await session.close();
        }
      });
    case "edit": {
      const kind = sub as EditKind;
      if (kind !== "css" && kind !== "js" && kind !== "html")
        throw new Error("edit expects css, js, or html");
      const url = flags.get("url");
      const file = flags.get("file");
      if (!url || !file) throw new Error("edit needs --url and --file");
      const reason = url.startsWith("chrome://") ? denyReason(url) : undefined;
      if (reason) throw new Error(reason);
      const source = await Bun.file(file).text();
      return withBrowser(flags, async (endpoint) => {
        const session = await PageSession.attach(endpoint, { preferUrl: url });
        try {
          const current = await session.evaluate<string>("location.href");
          if (!current.startsWith(url)) {
            const load = await session.navigate(url);
            if (load.status !== "loaded")
              throw new Error(`${url}: ${load.status} ${load.errorText ?? ""}`);
          }
          const result = await applyEdit(
            session,
            kind,
            source,
            flags.get("selector"),
          );
          let check: Record<string, unknown> | undefined;
          const spec = flags.get("check");
          if (spec) {
            const { selector, property, value } = parseStyleCheck(spec);
            const actual = await computedStyle(session, selector, property);
            check = {
              selector,
              property,
              expected: value,
              actual,
              ok: actual === value,
            };
          }
          const screenshot = flags.get("screenshot");
          if (screenshot) {
            const { data } = await session.send<{ data: string }>(
              "Page.captureScreenshot",
              { format: "png" },
            );
            await Bun.write(screenshot, Buffer.from(data, "base64"));
          }
          console.log(
            JSON.stringify({ ...result, ...(check ? { check } : {}) }),
          );
          return check && !check.ok ? 1 : 0;
        } finally {
          await session.close();
        }
      });
    }
    case "style": {
      const url = flags.get("url");
      const selector = flags.get("selector");
      const property = flags.get("property");
      if (!url || !selector || !property)
        throw new Error("style needs --url, --selector, and --property");
      return withBrowser(flags, async (endpoint) => {
        const session = await PageSession.attach(endpoint, { preferUrl: url });
        try {
          const current = await session.evaluate<string>("location.href");
          if (!current.startsWith(url)) await session.navigate(url);
          console.log(
            JSON.stringify({
              url,
              selector,
              property,
              value: await computedStyle(session, selector, property),
            }),
          );
          return 0;
        } finally {
          await session.close();
        }
      });
    }
    default:
      console.error(USAGE);
      return 64;
  }
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(
        `obscura-chrome: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    },
  );
}

export { main };
