# Shared web standards snapshots

These JSON profiles were consolidated from the Apache-2.0-licensed `yolo-standards` workspace. They are shared by the Bun `@yolo-web/standards` package and Rust `yolo-standards` crate, so each language consumes one source of truth.

| Family | Snapshot | Upstream reference |
| --- | --- | --- |
| WebAssembly | Curated core/component model profile | [WebAssembly core specification](https://webassembly.github.io/spec/core/) and [component model](https://github.com/WebAssembly/component-model) |
| MDN BCD | Curated `javascript.builtins.Array.toSorted` compatibility data | [MDN browser-compat-data](https://github.com/mdn/browser-compat-data) |
| TC39 | Curated proposal stage/champion snapshot | [TC39 proposals](https://github.com/tc39/proposals) |
| MCP | YOLO-Web capability/method registry profile | [MCP specification](https://github.com/modelcontextprotocol/specification) |

The data is a useful local index, not a replacement for the linked normative specifications. `bun --filter @yolo-web/standards update` refreshes the MDN compatibility record after validating its expected shape. TC39, WebAssembly, and MCP profiles stay curated because their upstream publication formats do not match these snapshot schemas.
