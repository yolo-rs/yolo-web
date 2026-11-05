/**
 * Crawls every chrome:// WebUI page listed by chrome://chrome-urls and saves,
 * per page: final URL, title, load status, DOM snapshot, serialized HTML
 * (shadow roots included), visible text, accessibility tree, screenshot, and
 * console errors.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromiumVersion, type BrowserVersion } from "./browser.ts";
import type { ConsoleEntry, LoadResult, PageSession } from "./session.ts";
import { denyReason, pageSlug, parseChromeUrls, webuiHost } from "./urls.ts";

/** Every href in the document and all nested open shadow roots. */
export const DEEP_HREFS_SCRIPT = `(() => {
  const out = [];
  // A TreeWalker, not querySelectorAll: chrome://tracing patches the DOM
  // collection prototypes.
  const qsa = (root, selector) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (selector === "*" || node.matches(selector)) out.push(node);
    }
    return out;
  };
  const walk = (root) => {
    for (const el of qsa(root, "*")) {
      const href = el.getAttribute("href");
      if (href) out.push(href);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return out;
})()`;

/** Rendered text of the composed tree (shadow roots and slots followed). */
export const DEEP_TEXT_SCRIPT = `(() => {
  const lines = [];
  const skip = new Set(["script", "style", "template", "noscript"]);
  // checkVisibility() is false for display: contents (slots, wrappers), whose
  // children still render, so those are treated as visible.
  const visible = (el) =>
    !el ||
    !el.checkVisibility ||
    getComputedStyle(el).display === "contents" ||
    el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\\s+/g, " ").trim();
      if (text && visible(node.parentElement)) lines.push(text);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (skip.has(node.localName) || !visible(node)) return;
      if (node.localName === "slot") {
        const assigned = node.assignedNodes();
        for (const child of assigned.length ? assigned : node.childNodes) visit(child);
        return;
      }
      if (node.shadowRoot) {
        visit(node.shadowRoot);
        return;
      }
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(document.body ?? document.documentElement);
  return lines.join("\\n");
})()`;

/** HTML with open shadow roots serialized as declarative shadow DOM. */
export const DEEP_HTML_SCRIPT = `(() => {
  const roots = [];
  // A TreeWalker, not querySelectorAll: chrome://tracing patches the DOM
  // collection prototypes.
  const qsa = (root, selector) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (selector === "*" || node.matches(selector)) out.push(node);
    }
    return out;
  };
  const walk = (root) => {
    for (const el of qsa(root, "*")) {
      if (el.shadowRoot) {
        roots.push(el.shadowRoot);
        walk(el.shadowRoot);
      }
    }
  };
  walk(document);
  const html = document.documentElement;
  return typeof html.getHTML === "function"
    ? "<!doctype html>\\n<html>" + html.getHTML({ shadowRoots: roots }) + "</html>"
    : html.outerHTML;
})()`;

/** Clicks chrome://chrome-urls' "Enable internal debugging pages" button. */
export const ENABLE_DEBUG_PAGES_SCRIPT = `(() => {
  const hits = [];
  // A TreeWalker, not querySelectorAll: chrome://tracing patches the DOM
  // collection prototypes.
  const qsa = (root, selector) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (selector === "*" || node.matches(selector)) out.push(node);
    }
    return out;
  };
  const walk = (root) => {
    for (const el of qsa(root, "button, cr-button, [role=button]")) {
      if (/internal debugging pages/i.test(el.textContent || "")) hits.push(el);
    }
    for (const el of qsa(root, "*")) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  const button = hits.find((el) => /enable/i.test(el.textContent || ""));
  if (!button) return hits.length ? "already-enabled" : "not-found";
  button.click();
  return "clicked";
})()`;

export interface CrawlOptions {
  outRoot: string;
  /** Limit to these hosts (`version`, `gpu`, ...). */
  only?: string[];
  limit?: number;
  /** Turn on chrome://chrome-urls' internal debugging pages list first. */
  debugPages?: boolean;
  timeoutMs?: number;
  settleMs?: number;
  log?: (line: string) => void;
  /**
   * Called when a page made the whole browser exit (some sign-in and sync
   * dialogs close their window); returns a session on a fresh browser.
   */
  restart?: () => Promise<PageSession>;
}

export interface PageRecord {
  url: string;
  finalUrl: string;
  title: string;
  status: LoadResult["status"];
  errorText?: string;
  consoleErrors: number;
  /** `data-yolo-webui-patch` on <html>, set by yolo-chromium's patch injection. */
  webuiPatch?: string;
  dir: string;
  files: string[];
  captureErrors: string[];
  ms: number;
}

export interface CrawlIndex {
  schemaVersion: 1;
  capturedAt: string;
  chromiumVersion: string;
  browser: string;
  userAgent?: string;
  protocolVersion?: string;
  source: string;
  debugPages: string;
  listed: number;
  denied: Array<{ url: string; reason: string }>;
  crawled: number;
  loaded: number;
  failed: number;
  pages: PageRecord[];
}

async function capture(
  session: PageSession,
  url: string,
  dir: string,
): Promise<{
  files: string[];
  errors: string[];
  title: string;
  finalUrl: string;
  patch?: string;
}> {
  const files: string[] = [];
  const errors: string[] = [];
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      errors.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  let title = "";
  let finalUrl = url;
  let patch: string | undefined;
  await step("meta", async () => {
    const meta = await session.evaluate<{
      title: string;
      url: string;
      patch?: string;
    }>(
      "({ title: document.title, url: location.href, patch: document.documentElement?.dataset.yoloWebuiPatch })",
    );
    title = meta.title;
    finalUrl = meta.url;
    patch = meta.patch;
  });
  const write = async (name: string, data: string | Uint8Array) => {
    await Bun.write(join(dir, name), data);
    files.push(name);
  };
  await step("dom-snapshot", async () => {
    const snapshot = await session.send("DOMSnapshot.captureSnapshot", {
      computedStyles: ["display", "visibility", "color", "background-color"],
      includeDOMRects: true,
    });
    await write("dom-snapshot.json", JSON.stringify(snapshot));
  });
  await step("html", async () => {
    let html: string;
    try {
      html = await session.evaluate<string>(DEEP_HTML_SCRIPT);
    } catch {
      // Pages with DOM polyfills (chrome://tracing) break in-page walkers;
      // DevTools serializes the light DOM regardless.
      const { root } = await session.send<{ root: { nodeId: number } }>(
        "DOM.getDocument",
        { depth: 0 },
      );
      ({ outerHTML: html } = await session.send<{ outerHTML: string }>(
        "DOM.getOuterHTML",
        { nodeId: root.nodeId },
      ));
    }
    await write("page.html", html);
  });
  await step("text", async () =>
    write("text.txt", await session.evaluate<string>(DEEP_TEXT_SCRIPT)),
  );
  await step("ax-tree", async () => {
    const tree = await session.send("Accessibility.getFullAXTree");
    await write("ax-tree.json", JSON.stringify(tree));
  });
  await step("screenshot", async () => {
    const { data } = await session.send<{ data: string }>(
      "Page.captureScreenshot",
      { format: "png" },
    );
    await write("screenshot.png", Buffer.from(data, "base64"));
  });
  return { files, errors, title, finalUrl, patch };
}

/** Reads the WebUI URL list from chrome://chrome-urls. */
export async function listChromeUrls(
  session: PageSession,
  options: { debugPages?: boolean; timeoutMs?: number } = {},
): Promise<{
  urls: string[];
  denied: string[];
  debugPages: string;
  hrefs: string[];
}> {
  const load = await session.navigate(
    "chrome://chrome-urls/",
    options.timeoutMs,
  );
  if (load.status !== "loaded") {
    throw new Error(
      `chrome://chrome-urls did not load: ${load.status} ${load.errorText ?? ""}`,
    );
  }
  let debugPages = "skipped";
  if (options.debugPages !== false) {
    debugPages = await session
      .evaluate<string>(ENABLE_DEBUG_PAGES_SCRIPT)
      .catch(() => "error");
    if (debugPages === "clicked") await Bun.sleep(1_000);
  }
  const hrefs = await session.evaluate<string[]>(DEEP_HREFS_SCRIPT);
  const text = await session.evaluate<string>(DEEP_TEXT_SCRIPT);
  const parsed = parseChromeUrls(hrefs, text);
  return { ...parsed, debugPages, hrefs };
}

export async function crawl(
  initialSession: PageSession,
  version: BrowserVersion,
  options: CrawlOptions,
): Promise<{ index: CrawlIndex; outDir: string }> {
  const log = options.log ?? ((line: string) => console.error(line));
  let session = initialSession;
  const versionName = chromiumVersion(version);
  const outDir = join(options.outRoot, versionName);
  mkdirSync(join(outDir, "pages"), { recursive: true });

  const listing = await listChromeUrls(session, options);
  await Bun.write(
    join(outDir, "chrome-urls.json"),
    JSON.stringify(listing, null, 2),
  );
  log(
    `chrome://chrome-urls: ${listing.urls.length} pages, ${listing.denied.length} denied, debug pages ${listing.debugPages}`,
  );

  const only = options.only?.map((host) => host.toLowerCase());
  let targets = only
    ? listing.urls.filter((url) => only.includes(webuiHost(url) ?? ""))
    : listing.urls;
  if (only) {
    // Requested hosts that the list did not mention are still visited.
    for (const host of only) {
      const url = `chrome://${host}/`;
      if (
        !targets.some((known) => webuiHost(known) === host) &&
        !denyReason(url)
      )
        targets.push(url);
    }
  }
  if (options.limit !== undefined) targets = targets.slice(0, options.limit);

  const pages: PageRecord[] = [];
  for (const [position, url] of targets.entries()) {
    const started = Date.now();
    const slug = pageSlug(url);
    const dir = join(outDir, "pages", slug);
    mkdirSync(dir, { recursive: true });
    let load = await session.navigate(url, options.timeoutMs, options.settleMs);
    if (load.status !== "loaded" && !(await session.alive())) {
      load = {
        status: "browser-exited",
        errorText: load.errorText ?? load.status,
      };
      if (!options.restart) {
        log(`browser exited while loading ${url}; stopping`);
        await Bun.write(
          join(dir, "page.json"),
          JSON.stringify({ url, status: load.status }, null, 2),
        );
        pages.push({
          url,
          finalUrl: url,
          title: "",
          status: load.status,
          errorText: load.errorText,
          consoleErrors: 0,
          dir: `pages/${slug}`,
          files: ["page.json"],
          captureErrors: [],
          ms: Date.now() - started,
        });
        break;
      }
      log(`browser exited while loading ${url}; restarting`);
      session = await options.restart();
    }
    const consoleEntries: ConsoleEntry[] = [...session.console];
    let shot: Awaited<ReturnType<typeof capture>> = {
      files: [],
      errors: [],
      title: "",
      finalUrl: url,
    };
    // Error pages (net::ERR_*) are committed documents too; capture them.
    if (
      load.status === "loaded" ||
      load.status === "timeout" ||
      (load.status === "error" &&
        !load.errorText?.startsWith("Failed to connect"))
    ) {
      shot = await capture(session, url, dir);
    }
    consoleEntries.push(...session.console.slice(consoleEntries.length));
    await Bun.write(
      join(dir, "console.json"),
      JSON.stringify(consoleEntries, null, 2),
    );
    const record: PageRecord = {
      url,
      finalUrl: shot.finalUrl,
      title: shot.title,
      status: load.status,
      ...(load.errorText ? { errorText: load.errorText } : {}),
      consoleErrors: consoleEntries.length,
      ...(shot.patch ? { webuiPatch: shot.patch } : {}),
      dir: `pages/${slug}`,
      files: ["console.json", ...shot.files, "page.json"],
      captureErrors: shot.errors,
      ms: Date.now() - started,
    };
    await Bun.write(join(dir, "page.json"), JSON.stringify(record, null, 2));
    pages.push(record);
    log(
      `[${position + 1}/${targets.length}] ${record.status.padEnd(7)} ${url} ${JSON.stringify(record.title)}`,
    );
  }

  const index: CrawlIndex = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    chromiumVersion: versionName,
    browser: version.Browser,
    userAgent: version["User-Agent"],
    protocolVersion: version["Protocol-Version"],
    source: "chrome://chrome-urls/",
    debugPages: listing.debugPages,
    listed: listing.urls.length + listing.denied.length,
    denied: listing.denied.map((url) => ({
      url,
      reason: denyReason(url) ?? "",
    })),
    crawled: pages.length,
    loaded: pages.filter((page) => page.status === "loaded").length,
    failed: pages.filter((page) => page.status !== "loaded").length,
    pages,
  };
  await Bun.write(join(outDir, "index.json"), JSON.stringify(index, null, 2));
  return { index, outDir };
}
