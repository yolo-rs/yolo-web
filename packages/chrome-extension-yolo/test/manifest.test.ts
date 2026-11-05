// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SEARCH_URL_TEMPLATE } from "../src/navigation.ts";
import {
  BUILD_TIMEOUT_MS,
  DIST_DIR,
  MANIFEST_PATH,
  PACKAGE_ROOT,
  ensureBuilt,
} from "./helpers.ts";

interface Manifest {
  manifest_version: number;
  name: string;
  version: string;
  description?: string;
  icons?: Record<string, string>;
  action?: {
    default_title?: string;
    default_popup?: string;
    default_icon?: Record<string, string>;
  };
  background?: { service_worker?: string; type?: string };
  chrome_url_overrides?: { newtab?: string };
  chrome_settings_overrides?: {
    homepage?: string;
    search_provider?: Record<string, unknown>;
  };
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  content_security_policy?: { extension_pages?: string };
  side_panel?: { default_path?: string };
  content_scripts?: { js?: string[]; world?: string }[];
}

const manifest = (await Bun.file(MANIFEST_PATH).json()) as Manifest;
const pkg = (await Bun.file(join(PACKAGE_ROOT, "package.json")).json()) as {
  version: string;
};
const workspace = (await Bun.file(
  join(PACKAGE_ROOT, "..", "..", "package.json"),
).json()) as { version: string };

describe("manifest.json", () => {
  test("declares the required Manifest V3 fields", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("YOLO-Web");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.description?.length ?? 0).toBeLessThanOrEqual(132);
    expect(manifest.background?.service_worker).toBe("service-worker.js");
    // No popup: the toolbar button opens the agent side panel.
    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.chrome_url_overrides?.newtab).toBe("newtab.html");
    const sizes = Object.keys(manifest.icons ?? {}).sort(
      (a, b) => Number(a) - Number(b),
    );
    expect(sizes).toEqual(["16", "32", "48", "128"]);
  });

  test("version matches package.json and the workspace", () => {
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.version).toBe(workspace.version);
  });

  test("sets aphrody.com as the default search engine and homepage", () => {
    const provider = manifest.chrome_settings_overrides?.search_provider ?? {};
    expect(provider["search_url"]).toBe(SEARCH_URL_TEMPLATE);
    expect(provider["is_default"]).toBe(true);
    expect(provider["encoding"]).toBe("UTF-8");
    expect(provider["favicon_url"]).toMatch(/^https:\/\/aphrody\.com\//);
    expect(typeof provider["name"]).toBe("string");
    expect(typeof provider["keyword"]).toBe("string");
    if (provider["suggest_url"] !== undefined) {
      expect(provider["suggest_url"]).toMatch(/^https:\/\/.+\{searchTerms\}/);
    }
    expect(manifest.chrome_settings_overrides?.homepage).toBe(
      "https://aphrody.com/",
    );
  });

  test("wires the yolo-agent: debugger, side panel, offscreen, WebMCP", () => {
    expect([...(manifest.permissions ?? [])].sort()).toEqual(
      [
        "debugger",
        "favicon",
        "offscreen",
        "sidePanel",
        "storage",
        "tabs",
        "topSites",
      ].sort(),
    );
    expect(manifest.optional_permissions ?? []).toEqual(["history"]);
    expect(manifest.host_permissions ?? []).toEqual([
      "https://api.anthropic.com/*",
    ]);
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
    const scripts = manifest.content_scripts ?? [];
    expect(scripts.flatMap((entry) => entry.js ?? []).sort()).toEqual([
      "webmcp-main.js",
      "webmcp-relay.js",
    ]);
    expect(
      scripts.find((entry) => entry.js?.[0] === "webmcp-main.js")?.world,
    ).toBe("MAIN");
  });

  test(
    "forbids eval in the policy and in the bundles",
    async () => {
      const policy = manifest.content_security_policy?.extension_pages ?? "";
      expect(policy).not.toContain("unsafe-eval");
      await ensureBuilt();
      for (const file of ["newtab.js", "popup.js", "service-worker.js"]) {
        const code = await Bun.file(join(DIST_DIR, file)).text();
        expect(code).not.toMatch(/\beval\s*\(/);
        expect(code).not.toMatch(/new\s+Function\s*\(/);
      }
    },
    BUILD_TIMEOUT_MS,
  );

  test(
    "every file the manifest references exists after the build",
    async () => {
      await ensureBuilt();
      const referenced = [
        ...Object.values(manifest.icons ?? {}),
        ...Object.values(manifest.action?.default_icon ?? {}),
        manifest.side_panel?.default_path,
        ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? []),
        manifest.background?.service_worker,
        manifest.chrome_url_overrides?.newtab,
      ].filter((path): path is string => typeof path === "string");
      expect(referenced.length).toBeGreaterThanOrEqual(8);
      for (const path of referenced) {
        expect(await Bun.file(join(DIST_DIR, path)).exists()).toBe(true);
      }
    },
    BUILD_TIMEOUT_MS,
  );
});
