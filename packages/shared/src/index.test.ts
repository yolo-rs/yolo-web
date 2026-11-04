import { describe, expect, test } from "bun:test";
import {
  createBrowserSessionInfo,
  DEFAULT_STEALTH_CONFIG,
  DEFAULT_VIEWPORT,
  isValidEngineMode,
  normalizeCdpHttpUrl,
  normalizeCdpWebSocketUrl,
  OBSCURA_MCP_TOOLS,
} from "./index";

describe("@yolo-web/shared", () => {
  test("validates EngineMode values", () => {
    expect(isValidEngineMode("ai-agent")).toBe(true);
    expect(isValidEngineMode("human-interactive")).toBe(true);
    expect(isValidEngineMode("hybrid-copilot")).toBe(true);
    expect(isValidEngineMode("legacy")).toBe(false);
    expect(isValidEngineMode(null)).toBe(false);
  });

  test("creates BrowserSessionInfo with defaults", () => {
    const info = createBrowserSessionInfo({
      sessionId: "sess-1",
      cdpEndpoint: "ws://127.0.0.1:9222",
    });

    expect(info.sessionId).toBe("sess-1");
    expect(info.mode).toBe("hybrid-copilot");
    expect(info.viewport).toEqual(DEFAULT_VIEWPORT);
    expect(info.stealth).toEqual(DEFAULT_STEALTH_CONFIG);
    expect(info.humanTakeoverActive).toBe(false);
  });

  test("normalizes CDP WebSocket and HTTP endpoints", () => {
    expect(normalizeCdpWebSocketUrl("127.0.0.1:9222")).toBe(
      "ws://127.0.0.1:9222",
    );
    expect(normalizeCdpWebSocketUrl("http://127.0.0.1:9222")).toBe(
      "ws://127.0.0.1:9222",
    );
    expect(normalizeCdpHttpUrl("ws://127.0.0.1:9222/devtools/browser/1")).toBe(
      "http://127.0.0.1:9222",
    );
  });

  test("exposes standard Obscura MCP tools definitions", () => {
    const names = OBSCURA_MCP_TOOLS.map((t) => t.name);
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_snapshot");
    expect(names).toContain("browser_evaluate");
    expect(names).toContain("browser_markdown");
  });
});
