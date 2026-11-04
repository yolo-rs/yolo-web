# `@yolo-web/standards`

The Bun API and shared data for browser/web-platform standards used by YOLO-Web. The same JSON snapshots are consumed by the Rust `yolo-standards` crate from `data/standards/web`; neither runtime maintains a separate copy.

Families in this package:

- WebAssembly core and component-model profile
- MDN browser-compatibility snapshot
- TC39 proposal snapshot
- YOLO-Web's MCP capability/method profile

`StandardsLoader` validates a snapshot before returning it. `bun run update` refreshes the tracked MDN `Array.prototype.toSorted` record and refuses to overwrite it with a response that does not match the local profile. TC39, WebAssembly, and MCP records stay curated because their upstream sources do not expose the local profile as matching stable JSON.

The MCP profile is registry metadata for YOLO-Web's implementation surface. It does not replace the normative MCP specification or claim that every listed transport is an official transport.

Source data originated in the Apache-2.0-licensed `yolo-standards` workspace. The upstream `create-yolo-app` package and its templates are intentionally outside this package; its generator is a separate concern and uses Node APIs that are not part of YOLO-Web's Bun-owned code.
