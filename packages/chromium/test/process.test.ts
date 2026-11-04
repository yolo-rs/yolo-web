// SPDX-License-Identifier: MIT
import { describe, expect, test } from "bun:test";
import { processTreeOwnership, windowsJob } from "../src/modules/process";

describe("optional Windows Job provider", () => {
  test("reports the actual selected process ownership mechanism", () => {
    expect(processTreeOwnership(true, false)).toBe("windows-job");
    expect(processTreeOwnership(false, true)).toBe("linux-pidfd-group");
    expect(processTreeOwnership(false, false)).toBe("single-process");
  });
  test("falls back only when the module or Job capability is absent", () => {
    const absent = Object.assign(new Error("Cannot find module 'bun:windows'"), { code: "MODULE_NOT_FOUND" });
    expect(windowsJob(() => { throw absent; })).toBeUndefined();
    expect(windowsJob(() => ({}))).toBeUndefined();
  });
  test("propagates provider import and constructor failures", () => {
    const failedImport = Object.assign(new Error("Cannot find module 'broken-dependency'\nRequire stack: 'bun:windows'"), { code: "MODULE_NOT_FOUND" });
    expect(() => windowsJob(() => { throw failedImport; })).toThrow("broken-dependency");
    class BrokenJob { constructor() { throw new Error("job creation failed"); } }
    expect(() => windowsJob(() => ({ Job: BrokenJob as never }))).toThrow("job creation failed");
  });
});
