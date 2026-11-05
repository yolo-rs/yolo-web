// SPDX-License-Identifier: Apache-2.0
/** aphrody.com search and the shortcuts of the new tab page. */
import { extensionApi } from "./extension-api.ts";

export const APHRODY_ORIGIN = "https://aphrody.com";
export const SEARCH_ACTION = `${APHRODY_ORIGIN}/search`;
export const SEARCH_PARAM = "q";
/** Must equal `chrome_settings_overrides.search_provider.search_url`. */
export const SEARCH_URL_TEMPLATE = `${SEARCH_ACTION}?${SEARCH_PARAM}={searchTerms}`;

export interface Shortcut {
  readonly label: string;
  readonly url: string;
  /** Single-letter monogram shown in the tile. */
  readonly mark: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { label: "Version", url: "chrome://version/", mark: "V" },
  { label: "Settings", url: "chrome://settings/", mark: "S" },
  { label: "Extensions", url: "chrome://extensions/", mark: "E" },
  { label: "aphrody.com", url: `${APHRODY_ORIGIN}/`, mark: "A" },
];

/**
 * Navigates the current tab. `chrome://` pages cannot be reached through a
 * plain link from an extension page, so the tabs API is used when present.
 */
export async function navigateCurrentTab(url: string): Promise<void> {
  const tabs = extensionApi()?.tabs;
  if (tabs) {
    await tabs.update({ url });
    return;
  }
  window.location.assign(url);
}

/**
 * Opens `url` in a new tab (the browser's new tab page when omitted) and
 * closes a popup window afterwards.
 */
export async function openInNewTab(url?: string): Promise<void> {
  const tabs = extensionApi()?.tabs;
  if (tabs) {
    await tabs.create(url === undefined ? {} : { url });
    window.close();
    return;
  }
  window.open(url ?? "about:blank", "_blank", "noopener");
}
