// SPDX-License-Identifier: Apache-2.0
/**
 * Browser data behind permissions: most visited sites (`topSites`), recent
 * pages (optional `history`), and favicons from the browser's own cache
 * (`favicon`, served at `chrome-extension://<id>/_favicon/`). Every function
 * degrades to an empty result when the API or the permission is missing.
 */
import { extensionApi } from "../extension-api.ts";
import type { TopSite } from "./shortcuts.ts";
import type { Candidate } from "./suggest.ts";

const HISTORY_PERMISSION = { permissions: ["history"] };

export async function loadTopSites(): Promise<TopSite[]> {
  const topSites = extensionApi()?.topSites;
  if (!topSites) {
    return [];
  }
  try {
    return await topSites.get();
  } catch {
    return [];
  }
}

export async function hasHistoryAccess(): Promise<boolean> {
  const permissions = extensionApi()?.permissions;
  if (!permissions) {
    return false;
  }
  try {
    return await permissions.contains(HISTORY_PERMISSION);
  } catch {
    return false;
  }
}

/** Must run inside a user gesture (a click handler). */
export async function requestHistoryAccess(): Promise<boolean> {
  const permissions = extensionApi()?.permissions;
  if (!permissions) {
    return false;
  }
  try {
    return await permissions.request(HISTORY_PERMISSION);
  } catch {
    return false;
  }
}

export async function revokeHistoryAccess(): Promise<void> {
  try {
    await extensionApi()?.permissions?.remove(HISTORY_PERMISSION);
  } catch {
    // Already gone.
  }
}

export interface Visit {
  readonly title: string;
  readonly url: string;
  readonly lastVisit: number;
  readonly visits: number;
}

/** Only real web pages: no extension, browser or file URLs in the card. */
function isWebPage(url: string | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

/** Pages visited in the last `hours`, newest first, one row per URL. */
export async function loadRecentPages(limit = 5, hours = 24): Promise<Visit[]> {
  const history = extensionApi()?.history;
  if (!history || !(await hasHistoryAccess())) {
    return [];
  }
  try {
    const items = await history.search({
      text: "",
      startTime: Date.now() - hours * 3_600_000,
      maxResults: 50,
    });
    const seen = new Set<string>();
    const out: Visit[] = [];
    for (const item of items) {
      if (!isWebPage(item.url) || seen.has(item.url)) {
        continue;
      }
      seen.add(item.url);
      out.push({
        title: item.title?.trim() || new URL(item.url).hostname,
        url: item.url,
        lastVisit: item.lastVisitTime ?? 0,
        visits: item.visitCount ?? 1,
      });
      if (out.length === limit) {
        break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** History pages matching `text`, as suggestion candidates. */
export async function historyCandidates(text: string): Promise<Candidate[]> {
  const history = extensionApi()?.history;
  if (!history || !text.trim()) {
    return [];
  }
  try {
    const items = await history.search({ text, maxResults: 20, startTime: 0 });
    return items
      .filter((item) => isWebPage(item.url) && item.title)
      .map((item) => ({
        kind: "page" as const,
        text: item.title ?? "",
        url: item.url ?? "",
        count: item.visitCount ?? 1,
        last: item.lastVisitTime ?? 0,
        source: "history" as const,
      }));
  } catch {
    return [];
  }
}

/** Favicon URL from the browser cache, or `undefined` outside an extension. */
export function faviconUrl(pageUrl: string, size = 32): string | undefined {
  const runtime = extensionApi()?.runtime;
  if (!runtime?.getURL) {
    return undefined;
  }
  const url = new URL(runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.href;
}
