/**
 * chrome:// URL helpers: host extraction, the crash/kill denylist, and the
 * parser for the list published by chrome://chrome-urls.
 */

/**
 * Hosts that crash, hang, or kill a process, exhaust memory, or quit or
 * restart the browser when navigated to. Chromium lists most of them as
 * "Command URLs for Debug" on chrome://chrome-urls (see
 * `chrome/common/url_constants.cc`, `kChromeDebugURLs`, and
 * `content/public/common/url_constants.h`). Navigating to any of them is a
 * deliberate fault injection, so the crawler never visits them. `blink-oom`,
 * `v8-oom`, and `uithreadhang` appear among the regular pages of Chromium 156
 * but are fault injections too.
 */
export const DENIED_HOSTS: ReadonlySet<string> = new Set([
  "badcastcrash",
  "blink-oom",
  "crash",
  "crashdump",
  "gpuclean",
  "gpucrash",
  "gpuhang",
  "hang",
  "heapcorruptioncrash",
  "inducebrowsercrashforrealz",
  "inducebrowserdcheckforrealz",
  "inducebrowserheapcorruption",
  "kill",
  "memory-exhaust",
  "memory-pressure-critical",
  "memory-pressure-moderate",
  "ppapiflashcrash",
  "ppapiflashhang",
  "quit",
  "restart",
  "shorthang",
  "uithreadhang",
  "v8-oom",
  "webuijserror",
]);

const PLAIN_HOST = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** `chrome://settings/people` -> `settings`; `undefined` for anything else. */
export function webuiHost(url: string): string | undefined {
  const match = /^chrome:\/\/([^/?#]*)/i.exec(url.trim());
  const host = match?.[1]?.toLowerCase();
  if (!host || !PLAIN_HOST.test(host) || host.includes("..")) return undefined;
  return host;
}

/** Why `url` must not be crawled, or `undefined` when it may be. */
export function denyReason(url: string): string | undefined {
  const host = webuiHost(url);
  if (!host) return "not a chrome:// URL";
  if (DENIED_HOSTS.has(host))
    return `chrome://${host} crashes, hangs, or exits by design`;
  return undefined;
}

export function isDenied(url: string): boolean {
  return denyReason(url) !== undefined;
}

/**
 * Normalizes a chrome:// link to `chrome://<host>/<path>`; returns
 * `undefined` for other schemes, empty hosts, or javascript-like garbage.
 * Paths are kept (`chrome://crash/rust` stays distinct from `chrome://crash`),
 * queries and fragments are dropped.
 */
export function normalizeChromeUrl(raw: string): string | undefined {
  const value = raw.trim();
  const host = webuiHost(value);
  if (!host) return undefined;
  const rest = value.slice(value.indexOf("//") + 2 + host.length);
  const path = (rest.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "");
  if (path && !/^\/[A-Za-z0-9._~\-/%]*$/.test(path)) return undefined;
  return `chrome://${host}${path || ""}/`;
}

/** Result of parsing the chrome://chrome-urls page. */
export interface ChromeUrlList {
  /** Pages that will be crawled, sorted. */
  urls: string[];
  /** Pages that were listed but are denied, sorted. */
  denied: string[];
}

/**
 * Parses link targets (and optionally page text) from chrome://chrome-urls.
 * The page lists every registered WebUI host as a link, then the "Command
 * URLs for Debug" as plain text; both are matched.
 */
export function parseChromeUrls(
  hrefs: readonly string[],
  text = "",
): ChromeUrlList {
  const found = new Set<string>();
  for (const href of hrefs) {
    const url = normalizeChromeUrl(href);
    if (url) found.add(url);
  }
  for (const match of text.matchAll(
    /chrome:\/\/[a-z0-9._-]+(?:\/[A-Za-z0-9._~\-/%]*)?/gi,
  )) {
    const url = normalizeChromeUrl(match[0]);
    if (url) found.add(url);
  }
  const urls: string[] = [];
  const denied: string[] = [];
  for (const url of [...found].sort())
    (isDenied(url) ? denied : urls).push(url);
  return { urls, denied };
}

/** File-system safe directory name for a crawled URL. */
export function pageSlug(url: string): string {
  const slug = url
    .replace(/^chrome:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "");
  return slug || "root";
}
