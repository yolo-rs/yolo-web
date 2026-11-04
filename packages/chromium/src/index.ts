// SPDX-License-Identifier: Apache-2.0
// @yolo-web/chromium: Bun-native browser orchestration and the chromium/chrome/obscura aliases.
// Importing the package works without the plugin preload; ./bun-plugin maps virtual specifiers.
export { default } from "./modules/chromium.ts";
export * from "./modules/chromium.ts";
export { default as chrome } from "./modules/chromium.ts";
export { default as obscura } from "./modules/obscura.ts";
export { default as browserFetch } from "./modules/fetch.ts";
