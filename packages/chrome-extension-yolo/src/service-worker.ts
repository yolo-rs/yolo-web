// SPDX-License-Identifier: Apache-2.0
/**
 * Background service worker. It only reacts to installation: it seeds the
 * default theme in `chrome.storage.sync` and opens the new tab page once.
 * No state is kept in module variables; the worker is ephemeral.
 */
import {
  GeminiCarbonBridge,
  YOLO_EXTENSION_DOMAINS,
} from "./gemini-carbon-bridge.ts";
import { THEME_STORAGE_KEY } from "./storage.ts";
import { DEFAULT_THEME_ID, isThemeId } from "./tokens.ts";

(
  globalThis as {
    __yoloCarbonBridge?: GeminiCarbonBridge;
    __yoloDomains?: typeof YOLO_EXTENSION_DOMAINS;
  }
).__yoloCarbonBridge = new GeminiCarbonBridge();
(
  globalThis as {
    __yoloCarbonBridge?: GeminiCarbonBridge;
    __yoloDomains?: typeof YOLO_EXTENSION_DOMAINS;
  }
).__yoloDomains = YOLO_EXTENSION_DOMAINS;

/** Opened directly so the first run does not depend on `chrome://newtab`. */
const FIRST_RUN_PAGE = "newtab.html";

async function onInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  if (details.reason !== "install") {
    return;
  }
  try {
    const stored = await chrome.storage.sync.get(THEME_STORAGE_KEY);
    if (!isThemeId(stored[THEME_STORAGE_KEY])) {
      await chrome.storage.sync.set({ [THEME_STORAGE_KEY]: DEFAULT_THEME_ID });
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL(FIRST_RUN_PAGE) });
  } catch (error) {
    console.error("[yolo-web] first-run setup failed", error);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void onInstalled(details);
});
