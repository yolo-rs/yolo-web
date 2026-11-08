# AGENTS.md — yolo-web (Autonomous AI Operations)

## 1. Role & Identity
This repository is the canonical sovereign pillar **yolo-web** in the YOLO Fleet.
- Package Manager: `bun@1.4.4-canary.1`
- Retained Core Engines (`crates/`): Obscura (`obscura*`), Servo (`servo*`), Brave (`brave*`, `aphrody-adblock`), Chromium/CEF (`yolo-chromium`, `aphrody-chromium-ffi`), Deno/V8 (`deno*`), Search & Browser Automation (`yolo-browser`, `agent-browser`, `yolo-search-rs`).
- Retained Core Packages (`packages/`): `web-cli`, `web-mcp`, `bun-mirror`, `browser-sdk`, `cdp-client`, `mcp-client`, `mcp-native`, `cli-native`, `brave-shields`, `brave-search-mcp`, `servo-bridge`, `bun-v8-bridge`, `challenge-solver`, `chromium`, `chromium-tracker`, `obscura-chrome`, `search-core`, `web-crawler`, `web-cluster`, `google`, `google-crawler`, `google-indexer`, `knowledge-indexer`, `auth`, `api-contract`, `shared`, `web-standards`, `yolo-agent`, `chrome-extension-yolo`, `posix-bun`, `bun-plugin`, `agent-browser-skills`, `web-plugin`, `h3blast`.
- Toolchains: Rust 2024 (edition 2024, resolver 2/3), Bun v1.4.4+, Python uv

## 2. Standard Development Workflows
- **Check**: `bun run check` or `cargo check --workspace --quiet`
- **Test**: `bun test` or `bun run rust:test`
- **Lint & Format**: `bun run lint && bun run fmt`
- **Slice Execution**: `bun run C:/src/yolo/scripts/slice.ts run <slice-name>`

## 3. Anti-Context Saturation Rules
- Never load all workspace crates simultaneously if not required.
- Query symbols via local AST index or run targeted slices.
- Strictly adhere to NHITL protocol: no emojis, concise factual logs.
