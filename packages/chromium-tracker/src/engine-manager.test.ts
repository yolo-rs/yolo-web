import { describe, expect, test } from "bun:test";
import {
  ENGINE_MANAGER_REGISTRY,
  findEngine,
  packageCommand,
  packageCommandInvocations,
  sourceCheckoutCommand,
} from "./engine-manager";

describe("browser engine catalog", () => {
  test("catalogues major upstream targets and documents sources", () => {
    for (const id of [
      "chrome-stable",
      "chrome-canary",
      "edge-canary",
      "firefox-nightly-source",
      "webkit-jsc",
      "servo",
      "chromium-src",
    ]) {
      const entry = findEngine(id);
      expect(entry.docs.length).toBeGreaterThan(0);
    }
    expect(ENGINE_MANAGER_REGISTRY.length).toBeGreaterThanOrEqual(7);
  });
  test("only emits package commands for explicit verified mappings", () => {
    expect(
      packageCommand(findEngine("chrome-canary"), "winget", "install"),
    ).toContain("Google.Chrome.Canary");
    expect(
      packageCommandInvocations(
        findEngine("chrome-canary"),
        "winget",
        "install",
      ),
    ).toEqual([
      {
        program: "winget",
        args: ["install", "--id", "Google.Chrome.Canary", "--exact"],
      },
    ]);
    expect(packageCommand(findEngine("servo"), "apt", "install")).toBeNull();
    expect(
      packageCommandInvocations(findEngine("servo"), "apt", "install"),
    ).toBeNull();
  });
  test("routes source checkouts and blocks misleading Chromium clone", () => {
    expect(sourceCheckoutCommand(findEngine("servo"), "servo")).toContain(
      "git clone",
    );
    expect(() =>
      sourceCheckoutCommand(findEngine("chromium-src"), "chromium"),
    ).toThrow("depot_tools");
    expect(() => findEngine("unknown")).toThrow("Unknown engine");
  });
});
