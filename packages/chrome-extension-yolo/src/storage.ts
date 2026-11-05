// SPDX-License-Identifier: Apache-2.0
/**
 * Key-value storage areas. Extension pages use `chrome.storage.sync` (follows
 * the profile) and `chrome.storage.local` (stays on the device). Opened from
 * a plain file for layout work, or in unit tests, the same code runs on a
 * `localStorage`-backed or in-memory area with the same interface.
 */
import { extensionApi } from "./extension-api.ts";
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from "./tokens.ts";

export interface KeyValueArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export type ChangeListener = (changes: Record<string, unknown>) => void;

/** An area plus change notification for keys written by any context. */
export interface WatchableArea extends KeyValueArea {
  watch(listener: ChangeListener): void;
}

const toList = (keys: string | string[]): string[] =>
  typeof keys === "string" ? [keys] : keys;

/** In-memory area; `watch` fires for writes made through this object. */
export function memoryArea(
  initial: Record<string, unknown> = {},
): WatchableArea {
  const data = new Map<string, unknown>(Object.entries(initial));
  const listeners: ChangeListener[] = [];
  const emit = (changes: Record<string, unknown>) => {
    for (const listener of listeners) {
      listener(changes);
    }
  };
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const key of toList(keys)) {
        if (data.has(key)) {
          out[key] = structuredClone(data.get(key));
        }
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, structuredClone(value));
      }
      emit(items);
    },
    async remove(keys) {
      const changes: Record<string, unknown> = {};
      for (const key of toList(keys)) {
        data.delete(key);
        changes[key] = undefined;
      }
      emit(changes);
    },
    watch(listener) {
      listeners.push(listener);
    },
  };
}

function localStorageArea(prefix: string): WatchableArea {
  const store = globalThis.localStorage;
  const memory = memoryArea();
  if (!store) {
    return memory;
  }
  const read = (key: string): unknown => {
    const raw = store.getItem(prefix + key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  };
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const key of toList(keys)) {
        const value = read(key);
        if (value !== undefined) {
          out[key] = value;
        }
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        store.setItem(prefix + key, JSON.stringify(value));
      }
      await memory.set(items);
    },
    async remove(keys) {
      for (const key of toList(keys)) {
        store.removeItem(prefix + key);
      }
      await memory.remove(keys);
    },
    watch(listener) {
      memory.watch(listener);
      globalThis.addEventListener?.("storage", (event: StorageEvent) => {
        if (event.key?.startsWith(prefix)) {
          const key = event.key.slice(prefix.length);
          listener({ [key]: read(key) });
        }
      });
    },
  };
}

function chromeArea(name: "sync" | "local"): WatchableArea | undefined {
  const storage = extensionApi()?.storage;
  const area = storage?.[name];
  if (!area) {
    return undefined;
  }
  return {
    get: (keys) => area.get(keys),
    set: (items) => area.set(items),
    remove: (keys) => area.remove(keys),
    watch(listener) {
      storage.onChanged?.addListener((changes, areaName) => {
        if (areaName !== name) {
          return;
        }
        const values: Record<string, unknown> = {};
        for (const [key, change] of Object.entries(changes)) {
          values[key] = change.newValue;
        }
        listener(values);
      });
    },
  };
}

let syncSingleton: WatchableArea | undefined;
let localSingleton: WatchableArea | undefined;

/** Settings, shortcuts and the theme: follows the browser profile. */
export function syncArea(): WatchableArea {
  syncSingleton ??= chromeArea("sync") ?? localStorageArea("yw.sync.");
  return syncSingleton;
}

/** Search history: never leaves the device. */
export function localArea(): WatchableArea {
  localSingleton ??= chromeArea("local") ?? localStorageArea("yw.local.");
  return localSingleton;
}

// ---------------------------------------------------------------- the theme

/** Shared with the popup and the service worker (shipped in 0.2.0). */
export const THEME_STORAGE_KEY = "theme";

function coerceThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

export async function loadThemeId(
  area: KeyValueArea = syncArea(),
): Promise<ThemeId> {
  const stored = await area.get(THEME_STORAGE_KEY);
  return coerceThemeId(stored[THEME_STORAGE_KEY]);
}

export async function saveThemeId(
  id: ThemeId,
  area: KeyValueArea = syncArea(),
): Promise<void> {
  await area.set({ [THEME_STORAGE_KEY]: id });
}

/** Calls `listener` whenever the theme changes in any context. */
export function watchThemeId(
  listener: (id: ThemeId) => void,
  area: WatchableArea = syncArea(),
): void {
  area.watch((changes) => {
    if (THEME_STORAGE_KEY in changes) {
      listener(coerceThemeId(changes[THEME_STORAGE_KEY]));
    }
  });
}
