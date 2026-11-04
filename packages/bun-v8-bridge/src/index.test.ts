import { describe, expect, test } from "bun:test";
import {
  BUN_UPSTREAM_REPOS,
  BunHostRuntimeInfo,
  DualEngineCoordinator,
  V8PageIsolateConfig,
} from "./index.ts";

describe("@yolo-web/bun-v8-bridge", () => {
  describe("BUN_UPSTREAM_REPOS registry", () => {
    test("includes core Host Bun (Full Rust + WebKit/JSC) and Guest Browser (Chromium V8) repositories under yolo-rs", () => {
      const names = BUN_UPSTREAM_REPOS.map((r) => r.fullName);
      expect(names).toContain("yolo-rs/bun");
      expect(names).toContain("yolo-rs/WebKit");
      expect(names).toContain("yolo-rs/v8");
      expect(names).toContain("yolo-rs/rusty_v8");
      expect(names).toContain("yolo-rs/deno_core");
      expect(names).toContain("yolo-rs/mimalloc");
      expect(names).toContain("yolo-rs/boringssl");
      expect(names).toContain("yolo-rs/lol-html");
      expect(names).toContain("yolo-rs/picohttpparser");
      expect(names).toContain("yolo-rs/tinycc");
      expect(names).toContain("yolo-rs/hawk");
      expect(names).toContain("yolo-rs/rust");
    });

    test("partitions repositories cleanly between host-bun-webkit and guest-browser-v8 planes", () => {
      const hostRepos = BunHostRuntimeInfo.getReposByPlane("host-bun-webkit");
      const guestRepos = BunHostRuntimeInfo.getReposByPlane("guest-browser-v8");

      expect(hostRepos.length).toBeGreaterThanOrEqual(10);
      expect(guestRepos.map((r) => r.name)).toEqual([
        "v8",
        "rusty_v8",
        "deno_core",
      ]);
      for (const repo of BUN_UPSTREAM_REPOS) {
        expect(repo.url.startsWith("https://github.com/yolo-rs/")).toBe(true);
      }
    });
  });

  describe("BunHostRuntimeInfo", () => {
    test("detects active native Bun (Full Rust + WebKit/JSC + Riptide GC) capabilities", () => {
      BunHostRuntimeInfo.assertNativeBunHost();
      const snapshot = BunHostRuntimeInfo.inspect();

      expect(snapshot.runtime).toBe("bun");
      expect(snapshot.architecture).toBe(
        "Full Rust (~200 crates) + C++ WebKit/JSC",
      );
      expect(snapshot.engine).toBe("JavaScriptCore (WebKit)");
      expect(snapshot.gc).toBe("Riptide");
      expect(snapshot.bunVersion.length).toBeGreaterThan(0);
      expect(snapshot.bunRevision.length).toBeGreaterThan(0);
      expect(snapshot.ffiReady).toBe(true);
      expect(snapshot.nativeApis.serve).toBe(true);
      expect(snapshot.nativeApis.spawn).toBe(true);
      expect(snapshot.nativeApis.file).toBe(true);
      expect(snapshot.nativeApis.glob).toBe(true);
      expect(snapshot.heapMemoryBytes.rss).toBeGreaterThan(0);
    });
  });

  describe("V8PageIsolateConfig", () => {
    test("builds valid Chromium V8 flag strings and CLI arguments for obscura-js", () => {
      const cfg = new V8PageIsolateConfig({
        maxOldSpaceSizeMb: 4096,
        maxSemiSpaceSizeMb: 64,
        exposeGc: true,
        harmony: true,
        watchdogBudgetMs: 3000,
        customFlags: ["--turbo-fast-api-calls"],
      });

      expect(cfg.toFlagArray()).toEqual([
        "--max-old-space-size=4096",
        "--max-semi-space-size=64",
        "--expose-gc",
        "--harmony",
        "--turbo-fast-api-calls",
      ]);
      expect(cfg.toFlagString()).toBe(
        "--max-old-space-size=4096 --max-semi-space-size=64 --expose-gc --harmony --turbo-fast-api-calls",
      );
      expect(cfg.toCliArgs()).toEqual([
        "--v8-flags=--max-old-space-size=4096 --max-semi-space-size=64 --expose-gc --harmony --turbo-fast-api-calls",
      ]);
      expect(cfg.getWatchdogBudgetMs()).toBe(3000);
    });

    test("tracks one-shot platform initialization state", () => {
      const cfg = new V8PageIsolateConfig();
      expect(cfg.isPlatformStarted()).toBe(false);
      cfg.markPlatformStarted();
      expect(cfg.isPlatformStarted()).toBe(true);
    });

    test("rejects out-of-range memory bounds and disallowed V8 security flags", () => {
      expect(() => new V8PageIsolateConfig({ maxOldSpaceSizeMb: 4 })).toThrow(
        RangeError,
      );
      expect(
        () => new V8PageIsolateConfig({ maxSemiSpaceSizeMb: 2048 }),
      ).toThrow(RangeError);
      expect(() => new V8PageIsolateConfig({ watchdogBudgetMs: 10 })).toThrow(
        RangeError,
      );
      expect(
        () =>
          new V8PageIsolateConfig({ customFlags: ["--allow-natives-syntax"] }),
      ).toThrow(/Security violation/);
      expect(
        () => new V8PageIsolateConfig({ customFlags: ["invalid flag"] }),
      ).toThrow(/Invalid V8 custom flag/);
    });
  });

  describe("DualEngineCoordinator", () => {
    test("packages sanitized guest V8 Runtime.evaluate commands with watchdog budgets", () => {
      const coordinator = new DualEngineCoordinator(
        new V8PageIsolateConfig({
          maxOldSpaceSizeMb: 2048,
          watchdogBudgetMs: 4500,
        }),
      );

      const cmd = coordinator.buildRuntimeEvaluate({
        expression: "document.querySelectorAll('a[href]').length",
        world: "main",
      });

      expect(cmd.id).toBe(1);
      expect(cmd.method).toBe("Runtime.evaluate");
      expect(cmd.params.expression).toBe(
        "document.querySelectorAll('a[href]').length",
      );
      expect(cmd.params.contextType).toBe("main");
      expect(cmd.params.timeout).toBe(4500);
      expect(cmd.meta).toEqual({
        sourcePlane: "host-bun-webkit",
        targetPlane: "guest-browser-v8",
        world: "main",
        watchdogBudgetMs: 4500,
      });
    });

    test("serializes arguments across the Bun (JSC) -> Browser (V8) boundary without closure leakage", () => {
      const coordinator = new DualEngineCoordinator();
      const cmd = coordinator.buildSerializedV8Call(
        "(selector, minLen) => Array.from(document.querySelectorAll(selector)).filter(el => (el.textContent || '').length >= minLen).length",
        ["p.article-body", 42] as const,
        { world: "isolated", budgetMs: 2500 },
      );

      expect(cmd.params.expression).toContain('("p.article-body", 42)');
      expect(cmd.params.contextType).toBe("isolated");
      expect(cmd.meta.watchdogBudgetMs).toBe(2500);
    });

    test("registers Page.addScriptToEvaluateOnNewDocument preload scripts for V8 contexts", () => {
      const coordinator = new DualEngineCoordinator();
      const preload = coordinator.buildPreloadDocumentScript(
        "Object.defineProperty(navigator, 'webdriver', { get: () => false });",
      );

      expect(preload.method).toBe("Page.addScriptToEvaluateOnNewDocument");
      expect(coordinator.getRegisteredPreloadScripts()).toHaveLength(1);
    });

    test("blocks accidental Host Bun or process.env leakage into Guest V8 page scripts", () => {
      const coordinator = new DualEngineCoordinator();

      expect(() =>
        coordinator.buildRuntimeEvaluate({
          expression: "Bun.file('/etc/passwd').text()",
        }),
      ).toThrow(/Dual-Runtime boundary violation/);

      expect(() =>
        coordinator.buildRuntimeEvaluate({
          expression: "console.log(process.env.SECRET_TOKEN)",
        }),
      ).toThrow(/Dual-Runtime boundary violation/);

      expect(() =>
        coordinator.buildPreloadDocumentScript("import('bun:sqlite')"),
      ).toThrow(/Dual-Runtime boundary violation/);
    });

    test("executes host tasks on the Bun (WebKit/JSC) plane", async () => {
      const coordinator = new DualEngineCoordinator();
      const res = await coordinator.runOnBunHost(() => 21 * 2);

      expect(res.plane).toBe("host-bun-webkit");
      expect(res.bunVersion).toBe(Bun.version);
      expect(res.result).toBe(42);
    });
  });
});
