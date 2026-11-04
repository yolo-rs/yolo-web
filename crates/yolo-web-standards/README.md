# `yolo-web-standards`

Rust bindings for the shared browser and web-platform snapshots in `data/standards/web`. The `yolo-browser` facade re-exports this crate as `yolo_browser::standards`.

The crate exposes typed parsers and embedded snapshots for WebAssembly, MDN browser compatibility, TC39 proposals, and YOLO-Web's MCP implementation profile. It includes the shared JSON at compile time, so Rust callers use the same source of truth as Bun without runtime path assumptions.

The MCP profile is registry metadata, not a normative copy of the MCP specification. Snapshot provenance and refresh boundaries are documented in [`data/standards/web/README.md`](../../data/standards/web/README.md).

Licensed under Apache-2.0, carried forward from the upstream `yolo-standards` workspace; the crate is named `yolo-web-standards` inside YOLO-Web to avoid colliding with the `yolo-standards` pillar in the merged monorepo.
