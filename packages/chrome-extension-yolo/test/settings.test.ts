// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  MAX_IMAGE_BYTES,
  validateImage,
} from "../src/newtab/background-image.ts";
import {
  coerceSettings,
  DEFAULT_SETTINGS,
  expandTemplate,
  isUrlTemplate,
  loadSettings,
  SETTINGS_KEY,
  updateSettings,
  watchSettings,
} from "../src/newtab/settings.ts";
import { memoryArea } from "../src/storage.ts";

describe("settings", () => {
  test("defaults search on aphrody.com", () => {
    expect(DEFAULT_SETTINGS.searchUrl).toBe(
      "https://aphrody.com/search?q={searchTerms}",
    );
    expect(expandTemplate(DEFAULT_SETTINGS.searchUrl, "a&b c")).toBe(
      "https://aphrody.com/search?q=a%26b%20c",
    );
  });

  test("templates must be https with one {searchTerms}", () => {
    expect(isUrlTemplate("https://x.org/?q={searchTerms}")).toBe(true);
    expect(isUrlTemplate("http://x.org/?q={searchTerms}")).toBe(false);
    expect(isUrlTemplate("https://x.org/")).toBe(false);
    expect(isUrlTemplate("https://x.org/{searchTerms}/{searchTerms}")).toBe(
      false,
    );
    expect(isUrlTemplate("javascript:{searchTerms}")).toBe(false);
  });

  test("coerce repairs every field independently", () => {
    expect(coerceSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(
      coerceSettings({
        seed: "#ABCDEF",
        mode: "sepia",
        shortcutsVisible: "yes",
        shortcutsMode: "mine",
        cardsVisible: { resume: false },
        footerVisible: false,
        background: "video",
        backgroundStamp: -4,
        searchUrl: "ftp://x/{searchTerms}",
        suggestUrl: "",
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      seed: "#abcdef",
      shortcutsMode: "mine",
      cardsVisible: { resume: false },
      footerVisible: false,
      suggestUrl: "",
    });
  });

  test("update merges, validates and notifies watchers", async () => {
    const area = memoryArea();
    const seen: string[] = [];
    watchSettings(area, (settings) => seen.push(settings.mode));
    await updateSettings(area, { mode: "dark" });
    const next = await updateSettings(area, { footerVisible: false });
    expect(next.mode).toBe("dark");
    expect(next.footerVisible).toBe(false);
    expect(seen).toEqual(["dark", "dark"]);
    expect((await area.get(SETTINGS_KEY))[SETTINGS_KEY]).toEqual(next);
    expect(await loadSettings(area)).toEqual(next);
  });
});

describe("background image", () => {
  test("accepts common image types up to 8 MB", () => {
    expect(validateImage({ type: "image/webp", size: 1024 })).toBeUndefined();
    expect(validateImage({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(
      validateImage({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    ).toBe("size");
  });
});
