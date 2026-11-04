// SPDX-License-Identifier: MIT
// Bun OS plugin: the fork's browser builtins as virtual modules over this package.
import { defineBunPlugin } from "@yolo-web/bun-plugin";

export default defineBunPlugin({
  name: "@yolo-web/chromium",
  modules: {
    "bun:chromium": new URL("./modules/chromium.ts", import.meta.url),
    "bun:chrome": new URL("./modules/chromium.ts", import.meta.url),
    "bun:obscura": new URL("./modules/obscura.ts", import.meta.url),
    "bun:fetch": new URL("./modules/fetch.ts", import.meta.url),
  },
});
