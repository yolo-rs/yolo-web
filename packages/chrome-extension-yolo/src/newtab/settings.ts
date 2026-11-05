// SPDX-License-Identifier: Apache-2.0
/**
 * New tab page settings (recon entity NtpSettings), stored as one object in
 * `chrome.storage.sync` under `ntp.settings`. Every read goes through
 * `coerceSettings`, so a value written by an older or newer version, or
 * edited by hand, can never break the page.
 */
import { isHexColor } from "../color.ts";
import type { KeyValueArea, WatchableArea } from "../storage.ts";
import { DEFAULT_SEED } from "../tokens.ts";

export const SETTINGS_KEY = "ntp.settings";

export const DEFAULT_SEARCH_URL = "https://aphrody.com/search?q={searchTerms}";
/**
 * The planned aphrody.com suggestion service (OpenSearch suggestions JSON,
 * `["query", ["completion", ...]]`). It answered 404 without CORS headers on
 * 2026-11-05, so it is offered as an example and the default stays empty:
 * suggestions then come from this device only, with no request per keystroke.
 */
export const EXAMPLE_SUGGEST_URL =
  "https://aphrody.com/suggest?q={searchTerms}";
export const SEARCH_TERMS = "{searchTerms}";

export type Mode = "device" | "light" | "dark";
export type ShortcutsMode = "mine" | "top";

export interface NtpSettings {
  readonly version: 1;
  /** `#rrggbb` color seed of the `default` theme. */
  readonly seed: string;
  readonly mode: Mode;
  readonly shortcutsVisible: boolean;
  readonly shortcutsMode: ShortcutsMode;
  readonly cardsVisible: { readonly resume: boolean };
  readonly footerVisible: boolean;
  readonly background: "none" | "image";
  /** Changes whenever a new image is stored, so other tabs reload it. */
  readonly backgroundStamp: number;
  /** https URL template containing `{searchTerms}`. */
  readonly searchUrl: string;
  /** https URL template containing `{searchTerms}`, or "" for local only. */
  readonly suggestUrl: string;
}

export const DEFAULT_SETTINGS: NtpSettings = {
  version: 1,
  seed: DEFAULT_SEED,
  mode: "device",
  shortcutsVisible: true,
  shortcutsMode: "top",
  cardsVisible: { resume: true },
  footerVisible: true,
  background: "none",
  backgroundStamp: 0,
  searchUrl: DEFAULT_SEARCH_URL,
  suggestUrl: "",
};

/** True for an `https:` URL template that contains `{searchTerms}` once. */
export function isUrlTemplate(value: unknown): value is string {
  if (typeof value !== "string" || value.split(SEARCH_TERMS).length !== 2) {
    return false;
  }
  try {
    const url = new URL(value.replace(SEARCH_TERMS, "x"));
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Expands a template with the URL-encoded query. */
export function expandTemplate(template: string, query: string): string {
  return template.replace(SEARCH_TERMS, encodeURIComponent(query));
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function coerceSettings(value: unknown): NtpSettings {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const d = DEFAULT_SETTINGS;
  const cards =
    raw["cardsVisible"] && typeof raw["cardsVisible"] === "object"
      ? (raw["cardsVisible"] as Record<string, unknown>)
      : {};
  const seed =
    typeof raw["seed"] === "string" ? raw["seed"].toLowerCase() : d.seed;
  const suggestUrl = raw["suggestUrl"];
  return {
    version: 1,
    seed: isHexColor(seed) ? seed : d.seed,
    mode: pick(raw["mode"], ["device", "light", "dark"] as const, d.mode),
    shortcutsVisible: bool(raw["shortcutsVisible"], d.shortcutsVisible),
    shortcutsMode: pick(
      raw["shortcutsMode"],
      ["mine", "top"] as const,
      d.shortcutsMode,
    ),
    cardsVisible: { resume: bool(cards["resume"], d.cardsVisible.resume) },
    footerVisible: bool(raw["footerVisible"], d.footerVisible),
    background: pick(
      raw["background"],
      ["none", "image"] as const,
      d.background,
    ),
    backgroundStamp:
      typeof raw["backgroundStamp"] === "number" &&
      Number.isFinite(raw["backgroundStamp"]) &&
      raw["backgroundStamp"] >= 0
        ? raw["backgroundStamp"]
        : 0,
    searchUrl: isUrlTemplate(raw["searchUrl"]) ? raw["searchUrl"] : d.searchUrl,
    suggestUrl:
      suggestUrl === "" || isUrlTemplate(suggestUrl)
        ? suggestUrl
        : d.suggestUrl,
  };
}

export async function loadSettings(area: KeyValueArea): Promise<NtpSettings> {
  const stored = await area.get(SETTINGS_KEY);
  return coerceSettings(stored[SETTINGS_KEY]);
}

/** Re-reads, merges `patch`, validates and writes; returns the result. */
export async function updateSettings(
  area: KeyValueArea,
  patch: Partial<NtpSettings>,
): Promise<NtpSettings> {
  const current = await loadSettings(area);
  const next = coerceSettings({ ...current, ...patch });
  await area.set({ [SETTINGS_KEY]: next });
  return next;
}

export function watchSettings(
  area: WatchableArea,
  listener: (settings: NtpSettings) => void,
): void {
  area.watch((changes) => {
    if (SETTINGS_KEY in changes) {
      listener(coerceSettings(changes[SETTINGS_KEY]));
    }
  });
}
