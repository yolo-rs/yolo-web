# @yolo-web/chromium

Bun-native Chromium executable discovery, process lifecycle, CDP connection, browser profiles, and
the `bun:chromium`, `bun:chrome`, `bun:obscura`, and `bun:fetch` virtual-module aliases.

```ts
import chromium from "@yolo-web/chromium";

const browser = await chromium.launch({ headless: true });
try {
  console.log(await browser.connection.send("Browser.getVersion"));
} finally {
  await browser.close();
}
```

This package contains browser orchestration wrappers only. Chromium source and its third-party
dependency tree remain in the separately managed `depot_tools` checkout. Brave adblock and privacy
FFI modules are not included; they require the BunOS-only C ABI adapter and are not part of this
package's active dependency closure.

The result of `launch()` reports `processTreeOwnership`: `windows-job`, `linux-pidfd-group`, or
`single-process`. The last value means only the launched process is directly controlled; child
process cleanup is not guaranteed by that mechanism. Availability depends on the host and plugin.

Migrated from `aphrody-labs/bun` at fork commit
`7c57ac563e12c35be817697c4b5488b0fd64cc09`; original source and notices remain in the BunOS archive.
