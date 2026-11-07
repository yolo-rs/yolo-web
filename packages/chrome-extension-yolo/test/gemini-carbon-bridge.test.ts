// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  GEMINI_HD_VOICES,
  GeminiCarbonBridge,
  YOLO_EXTENSION_DOMAINS,
  computeSapisidHash,
} from "../src/extension-api.ts";

describe("gemini-carbon-bridge (single Chrome extension domain owner)", () => {
  test("declares single-owner domain coverage for Aphrody, Gemini Web, AI Studio, Antigravity, and Carbon Gateway", () => {
    const ids = YOLO_EXTENSION_DOMAINS.map((d) => d.id);
    expect(ids).toEqual([
      "aphrody",
      "gemini-web",
      "aistudio",
      "antigravity",
      "carbon-gateway",
    ]);
    expect(GEMINI_HD_VOICES).toEqual([
      "Aoede",
      "Puck",
      "Charon",
      "Kore",
      "Fenrir",
      "Orion",
    ]);
  });

  test("computes deterministic SAPISIDHASH authorization header via Web Crypto SHA-1", async () => {
    const header = await computeSapisidHash(
      "test_sapisid_token",
      "https://gemini.google.com",
      1762500000,
    );
    expect(header).toMatch(/^SAPISIDHASH 1762500000_[0-9a-f]{40}$/);
  });

  test("GeminiCarbonBridge normalizes gateway URL and handles offline health gracefully", async () => {
    const bridge = new GeminiCarbonBridge("http://127.0.0.1:59998///");
    expect(bridge.gatewayUrl).toBe("http://127.0.0.1:59998");
    const status = await bridge.health();
    expect(status.ok).toBe(false);
  });
});
