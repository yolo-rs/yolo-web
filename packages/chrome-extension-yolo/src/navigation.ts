// SPDX-License-Identifier: Apache-2.0
/** Tab navigation helpers shared by the popup. */
import { extensionApi } from "./extension-api.ts";
import { DEFAULT_SEARCH_URL } from "./newtab/settings.ts";

/** Must equal `chrome_settings_overrides.search_provider.search_url`. */
export const SEARCH_URL_TEMPLATE = DEFAULT_SEARCH_URL;

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
