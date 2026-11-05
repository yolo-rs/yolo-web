// SPDX-License-Identifier: Apache-2.0
/**
 * Optional view of the `chrome.*` namespace. Extension pages always have it;
 * the same bundles can also be opened from a plain file for layout work, in
 * which case the API is absent and callers fall back to web platform APIs.
 */
export interface ExtensionApi {
  storage?: {
    sync?: chrome.storage.StorageArea;
    onChanged?: typeof chrome.storage.onChanged;
  };
  tabs?: typeof chrome.tabs;
  runtime?: typeof chrome.runtime;
}

export function extensionApi(): ExtensionApi | undefined {
  return (globalThis as { chrome?: ExtensionApi }).chrome;
}
