// SPDX-License-Identifier: Apache-2.0
/**
 * Shortcut store (recon entity Shortcut). "My shortcuts" are an ordered list
 * in `chrome.storage.sync` under `ntp.shortcuts`; "most visited" come from
 * `chrome.topSites` minus the URLs the user removed (`ntp.hiddenTop`).
 *
 * The list operations are pure functions so they can be unit tested; the
 * store re-reads the stored list before each write, so two open new tab pages
 * never overwrite each other's edits with a stale copy.
 */
import type { KeyValueArea } from "../storage.ts";

export const SHORTCUTS_KEY = "ntp.shortcuts";
export const HIDDEN_TOP_KEY = "ntp.hiddenTop";
export const MAX_SHORTCUTS = 10;
export const MAX_TITLE_LENGTH = 60;
/** `chrome.storage.sync` QUOTA_BYTES_PER_ITEM. */
export const SYNC_ITEM_QUOTA = 8192;

export interface Shortcut {
  readonly id: string;
  readonly title: string;
  readonly url: string;
}

export type ShortcutError =
  | "empty-url"
  | "invalid-url"
  | "unsupported-scheme"
  | "duplicate"
  | "full"
  | "quota"
  | "not-found";

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ShortcutError };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: ShortcutError): Result<T> => ({ ok: false, error });

/** Messages for the edit dialog, written for this page. */
export const SHORTCUT_ERROR_TEXT: Record<ShortcutError, string> = {
  "empty-url": "Enter a web address.",
  "invalid-url": "That does not look like a web address.",
  "unsupported-scheme": "Only http and https addresses can be shortcuts.",
  duplicate: "You already have a shortcut to this address.",
  full: `You can keep up to ${MAX_SHORTCUTS} shortcuts. Remove one first.`,
  quota: "This shortcut is too long to sync with your profile.",
  "not-found": "This shortcut no longer exists.",
};

/**
 * Normalizes what a person types into an address: trims, adds `https://`
 * when there is no scheme, and accepts only `http:` and `https:`.
 */
export function normalizeUrl(input: string): Result<string> {
  const text = input.trim();
  if (text === "") {
    return fail("empty-url");
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  const looksLikeHostPort = /^[^/:]+:\d+(\/|$)/.test(text);
  const candidate = hasScheme && !looksLikeHostPort ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fail("invalid-url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail("unsupported-scheme");
  }
  if (!url.hostname || /\s/.test(text)) {
    return fail("invalid-url");
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return fail("invalid-url");
  }
  return ok(url.href);
}

/** Comparison key: no scheme, no `www.`, no trailing slash, lowercase host. */
export function urlKey(href: string): string {
  try {
    const url = new URL(href);
    const host = url.host.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}`;
  } catch {
    return href.trim().toLowerCase();
  }
}

/** Title for a tile: the given one, else the host without `www.`. */
export function displayTitle(title: string, url: string): string {
  const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (trimmed) {
    return trimmed;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fitsQuota(list: readonly Shortcut[]): boolean {
  const bytes = new TextEncoder().encode(
    SHORTCUTS_KEY + JSON.stringify(list),
  ).length;
  return bytes <= SYNC_ITEM_QUOTA;
}

let counter = 0;
export function newId(now: number = Date.now()): string {
  counter = (counter + 1) % 1_000_000;
  return `s${now.toString(36)}${counter.toString(36)}`;
}

export function addShortcut(
  list: readonly Shortcut[],
  title: string,
  url: string,
  id: string = newId(),
): Result<Shortcut[]> {
  if (list.length >= MAX_SHORTCUTS) {
    return fail("full");
  }
  const normalized = normalizeUrl(url);
  if (!normalized.ok) {
    return normalized;
  }
  const key = urlKey(normalized.value);
  if (list.some((item) => urlKey(item.url) === key)) {
    return fail("duplicate");
  }
  const next = [
    ...list,
    { id, title: displayTitle(title, normalized.value), url: normalized.value },
  ];
  return fitsQuota(next) ? ok(next) : fail("quota");
}

export function updateShortcut(
  list: readonly Shortcut[],
  id: string,
  title: string,
  url: string,
): Result<Shortcut[]> {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) {
    return fail("not-found");
  }
  const normalized = normalizeUrl(url);
  if (!normalized.ok) {
    return normalized;
  }
  const key = urlKey(normalized.value);
  if (list.some((item) => item.id !== id && urlKey(item.url) === key)) {
    return fail("duplicate");
  }
  const next = list.map((item) =>
    item.id === id
      ? {
          id,
          title: displayTitle(title, normalized.value),
          url: normalized.value,
        }
      : item,
  );
  return fitsQuota(next) ? ok(next) : fail("quota");
}

export interface Removal {
  readonly list: Shortcut[];
  readonly removed: Shortcut;
  readonly index: number;
}

export function removeShortcut(
  list: readonly Shortcut[],
  id: string,
): Result<Removal> {
  const index = list.findIndex((item) => item.id === id);
  const removed = list[index];
  if (index < 0 || !removed) {
    return fail("not-found");
  }
  return ok({ list: list.filter((item) => item.id !== id), removed, index });
}

/** Puts a removed shortcut back at its old position (the undo toast). */
export function restoreShortcut(
  list: readonly Shortcut[],
  removal: Removal,
): Shortcut[] {
  if (list.some((item) => item.id === removal.removed.id)) {
    return [...list];
  }
  const key = urlKey(removal.removed.url);
  if (list.some((item) => urlKey(item.url) === key)) {
    return [...list];
  }
  const next = [...list];
  next.splice(Math.min(removal.index, next.length), 0, removal.removed);
  return next.slice(0, MAX_SHORTCUTS);
}

/** Moves the item at `from` to `to` (both clamped); a no-op returns a copy. */
export function moveShortcut<T>(
  list: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) {
    return next;
  }
  const target = Math.min(Math.max(0, to), next.length - 1);
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(target, 0, item);
  }
  return next;
}

export function coerceShortcuts(value: unknown): Shortcut[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: Shortcut[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { id, title, url } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof url !== "string") {
      continue;
    }
    const normalized = normalizeUrl(url);
    if (!normalized.ok || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      title: displayTitle(
        typeof title === "string" ? title : "",
        normalized.value,
      ),
      url: normalized.value,
    });
    if (out.length === MAX_SHORTCUTS) {
      break;
    }
  }
  return out;
}

/** Persistence around the pure operations. */
export class ShortcutStore {
  constructor(private readonly area: KeyValueArea) {}

  async list(): Promise<Shortcut[]> {
    const stored = await this.area.get(SHORTCUTS_KEY);
    return coerceShortcuts(stored[SHORTCUTS_KEY]);
  }

  private async write(list: readonly Shortcut[]): Promise<void> {
    await this.area.set({ [SHORTCUTS_KEY]: list });
  }

  private async apply<T>(
    operation: (list: Shortcut[]) => Result<T>,
    toList: (value: T) => readonly Shortcut[],
  ): Promise<Result<T>> {
    const result = operation(await this.list());
    if (result.ok) {
      await this.write(toList(result.value));
    }
    return result;
  }

  add(title: string, url: string): Promise<Result<Shortcut[]>> {
    return this.apply(
      (list) => addShortcut(list, title, url),
      (v) => v,
    );
  }

  update(id: string, title: string, url: string): Promise<Result<Shortcut[]>> {
    return this.apply(
      (list) => updateShortcut(list, id, title, url),
      (v) => v,
    );
  }

  remove(id: string): Promise<Result<Removal>> {
    return this.apply(
      (list) => removeShortcut(list, id),
      (v) => v.list,
    );
  }

  async restore(removal: Removal): Promise<Shortcut[]> {
    const next = restoreShortcut(await this.list(), removal);
    await this.write(next);
    return next;
  }

  async move(id: string, to: number): Promise<Shortcut[]> {
    const list = await this.list();
    const from = list.findIndex((item) => item.id === id);
    const next = moveShortcut(list, from, to);
    await this.write(next);
    return next;
  }

  /** Most-visited URLs the user removed. */
  async hiddenTop(): Promise<string[]> {
    const stored = await this.area.get(HIDDEN_TOP_KEY);
    const value = stored[HIDDEN_TOP_KEY];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  async hideTop(url: string): Promise<void> {
    const hidden = new Set(await this.hiddenTop());
    hidden.add(urlKey(url));
    // Keep the newest 100 so the item stays well under the sync quota.
    await this.area.set({ [HIDDEN_TOP_KEY]: [...hidden].slice(-100) });
  }

  async unhideTop(url: string): Promise<void> {
    const key = urlKey(url);
    const hidden = (await this.hiddenTop()).filter((item) => item !== key);
    await this.area.set({ [HIDDEN_TOP_KEY]: hidden });
  }

  async clearHiddenTop(): Promise<void> {
    await this.area.remove(HIDDEN_TOP_KEY);
  }
}

export interface TopSite {
  readonly title: string;
  readonly url: string;
}

/** Most visited tiles: http(s) only, hidden ones dropped, at most 10. */
export function mostVisited(
  sites: readonly TopSite[],
  hidden: readonly string[],
): Shortcut[] {
  const hiddenSet = new Set(hidden);
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (const site of sites) {
    const normalized = normalizeUrl(site.url);
    if (!normalized.ok || !/^https?:\/\//.test(site.url)) {
      continue;
    }
    const key = urlKey(normalized.value);
    if (hiddenSet.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      id: `top:${key}`,
      title: displayTitle(site.title, normalized.value),
      url: normalized.value,
    });
    if (out.length === MAX_SHORTCUTS) {
      break;
    }
  }
  return out;
}
