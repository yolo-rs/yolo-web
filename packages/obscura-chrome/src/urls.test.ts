import { describe, expect, test } from "bun:test";

import { chromiumVersion } from "./browser.ts";
import { parseStyleCheck } from "./edit.ts";
import {
  DENIED_HOSTS,
  denyReason,
  isDenied,
  normalizeChromeUrl,
  pageSlug,
  parseChromeUrls,
  webuiHost,
} from "./urls.ts";

describe("denylist", () => {
  test("denies every crash, hang, kill, quit, and restart URL", () => {
    for (const url of [
      "chrome://crash",
      "chrome://crash/",
      "chrome://crash/rust",
      "chrome://kill/",
      "chrome://hang",
      "chrome://shorthang",
      "chrome://gpucrash",
      "chrome://gpuhang",
      "chrome://gpuclean",
      "chrome://inducebrowsercrashforrealz/",
      "chrome://inducebrowserdcheckforrealz/",
      "chrome://memory-exhaust/",
      "chrome://quit/",
      "chrome://restart/",
      "CHROME://KILL",
      "chrome://blink-oom/worker",
      "chrome://v8-oom/",
      "chrome://uithreadhang/",
    ]) {
      expect(isDenied(url)).toBe(true);
    }
  });

  test("allows ordinary WebUI pages", () => {
    for (const url of [
      "chrome://version/",
      "chrome://gpu",
      "chrome://flags/",
      "chrome://settings/people",
    ]) {
      expect(denyReason(url)).toBeUndefined();
    }
  });

  test("rejects non-chrome URLs", () => {
    expect(denyReason("https://example.com/")).toBe("not a chrome:// URL");
    expect(denyReason("chrome-extension://abc/")).toBe("not a chrome:// URL");
  });

  test("denylist hosts are plain lowercase labels", () => {
    for (const host of DENIED_HOSTS)
      expect(webuiHost(`chrome://${host}/`)).toBe(host);
  });
});

describe("chrome-urls parsing", () => {
  test("normalizes hosts and keeps paths", () => {
    expect(normalizeChromeUrl("chrome://version")).toBe("chrome://version/");
    expect(normalizeChromeUrl("chrome://Settings/people/?q=1#x")).toBe(
      "chrome://settings/people/",
    );
    expect(normalizeChromeUrl("chrome://crash/rust")).toBe(
      "chrome://crash/rust/",
    );
    expect(normalizeChromeUrl("https://example.com")).toBeUndefined();
    expect(normalizeChromeUrl("chrome://")).toBeUndefined();
    expect(normalizeChromeUrl("chrome://bad host/")).toBeUndefined();
    expect(normalizeChromeUrl("chrome://..evil/")).toBeUndefined();
  });

  test("splits listed pages into crawlable and denied, deduplicated and sorted", () => {
    const hrefs = [
      "chrome://version/",
      "chrome://gpu",
      "chrome://version",
      "chrome://about/",
      "#internal",
      "https://www.chromium.org/",
      "chrome-untrusted://print/",
    ];
    const text = `List of Chrome URLs
chrome://flags
For Debug
The following pages are for debugging purposes only.
chrome://badcastcrash/
chrome://inducebrowsercrashforrealz/
chrome://crash/
chrome://kill/
chrome://hang/
chrome://gpucrash/
chrome://quit/
chrome://restart/`;
    const { urls, denied } = parseChromeUrls(hrefs, text);
    expect(urls).toEqual([
      "chrome://about/",
      "chrome://flags/",
      "chrome://gpu/",
      "chrome://version/",
    ]);
    expect(denied).toEqual([
      "chrome://badcastcrash/",
      "chrome://crash/",
      "chrome://gpucrash/",
      "chrome://hang/",
      "chrome://inducebrowsercrashforrealz/",
      "chrome://kill/",
      "chrome://quit/",
      "chrome://restart/",
    ]);
  });

  test("page slugs are file-system safe", () => {
    expect(pageSlug("chrome://version/")).toBe("version");
    expect(pageSlug("chrome://settings/people/")).toBe("settings_people");
    expect(pageSlug("chrome://a?b:c/")).toBe("a_b_c");
  });
});

describe("helpers", () => {
  test("chromium version from /json/version", () => {
    expect(chromiumVersion({ Browser: "Chrome/156.0.8078.80" })).toBe(
      "156.0.8078.80",
    );
    expect(chromiumVersion({ Browser: "HeadlessChrome/150.0.1.2" })).toBe(
      "150.0.1.2",
    );
    expect(chromiumVersion({ Browser: "unknown" })).toBe("unknown");
  });

  test("style checks parse selector, property, and value", () => {
    expect(parseStyleCheck("body:color=rgb(1, 2, 3)")).toEqual({
      selector: "body",
      property: "color",
      value: "rgb(1, 2, 3)",
    });
    expect(parseStyleCheck("a:hover:outline-color=red")).toEqual({
      selector: "a:hover",
      property: "outline-color",
      value: "red",
    });
    expect(() => parseStyleCheck("body")).toThrow();
  });
});
