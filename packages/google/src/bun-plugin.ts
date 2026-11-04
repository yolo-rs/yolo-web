// SPDX-License-Identifier: MIT
// Bun OS plugin: the fork's bun:google as a virtual module over this package.
import { defineBunPlugin } from "@yolo-web/bun-plugin";

export default defineBunPlugin({
  name: "@yolo-web/google",
  modules: {
    "bun:google": new URL("./bun-google.ts", import.meta.url),
  },
});
