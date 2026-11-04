#!/usr/bin/env bun
/**
 * Pure Bun MCP Server entrypoint for @yolo-web/brave-shields
 * Exposes `brave_web_search`, `brave_local_search`, and `brave_news_search` over stdio or HTTP.
 */
import { BraveSearchMcpBridge } from "./index.ts";

const bridge = new BraveSearchMcpBridge();

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.includes("--list-tools")) {
    console.log(JSON.stringify(bridge.getToolDefinitions(), null, 2));
  }
}

export { bridge };
