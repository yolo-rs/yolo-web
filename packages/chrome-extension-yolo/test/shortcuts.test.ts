// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  addShortcut,
  coerceShortcuts,
  displayTitle,
  MAX_SHORTCUTS,
  mostVisited,
  moveShortcut,
  normalizeUrl,
  removeShortcut,
  restoreShortcut,
  type Shortcut,
  SHORTCUTS_KEY,
  ShortcutStore,
  updateShortcut,
  urlKey,
} from "../src/newtab/shortcuts.ts";
import { memoryArea } from "../src/storage.ts";

const list = (...hosts: string[]): Shortcut[] =>
  hosts.map((host, i) => ({
    id: `id${i}`,
    title: host,
    url: `https://${host}/`,
  }));

const ids = (items: readonly Shortcut[]): string[] =>
  items.map((item) => item.id);

describe("normalizeUrl", () => {
  test("adds https and accepts http(s) only", () => {
    expect(normalizeUrl("example.com")).toEqual({
      ok: true,
      value: "https://example.com/",
    });
    expect(normalizeUrl(" http://Example.com/a ")).toEqual({
      ok: true,
      value: "http://example.com/a",
    });
    expect(normalizeUrl("localhost:8080")).toEqual({
      ok: true,
      value: "https://localhost:8080/",
    });
    expect(normalizeUrl("")).toEqual({ ok: false, error: "empty-url" });
    expect(normalizeUrl("javascript:alert(1)")).toEqual({
      ok: false,
      error: "unsupported-scheme",
    });
    expect(normalizeUrl("chrome://settings")).toEqual({
      ok: false,
      error: "unsupported-scheme",
    });
    expect(normalizeUrl("not a url")).toEqual({
      ok: false,
      error: "invalid-url",
    });
    expect(normalizeUrl("intranet")).toEqual({
      ok: false,
      error: "invalid-url",
    });
  });

  test("urlKey ignores scheme, www and trailing slash", () => {
    expect(urlKey("https://www.Example.com/")).toBe(
      urlKey("http://example.com"),
    );
    expect(urlKey("https://example.com/a")).not.toBe(
      urlKey("https://example.com/b"),
    );
  });

  test("displayTitle falls back to the host and trims to 60", () => {
    expect(displayTitle("  ", "https://www.example.com/x")).toBe("example.com");
    expect(displayTitle("x".repeat(80), "https://a.com").length).toBe(60);
  });
});

describe("list operations", () => {
  test("add validates, dedupes and caps at ten", () => {
    expect(addShortcut([], "Docs", "docs.example.com", "a")).toEqual({
      ok: true,
      value: [{ id: "a", title: "Docs", url: "https://docs.example.com/" }],
    });
    expect(
      addShortcut(list("example.com"), "", "http://www.example.com"),
    ).toEqual({ ok: false, error: "duplicate" });
    const full = list(
      ...Array.from({ length: MAX_SHORTCUTS }, (_, i) => `s${i}.com`),
    );
    expect(addShortcut(full, "", "new.com")).toEqual({
      ok: false,
      error: "full",
    });
    expect(addShortcut([], "", "javascript:void(0)")).toEqual({
      ok: false,
      error: "unsupported-scheme",
    });
  });

  test("add refuses lists over the sync item quota", () => {
    const long = `https://example.com/${"a".repeat(1000)}`;
    let current: Shortcut[] = [];
    let last: ReturnType<typeof addShortcut> | undefined;
    for (let i = 0; i < MAX_SHORTCUTS; i++) {
      last = addShortcut(current, "", `${long}${i}`, `id${i}`);
      if (!last.ok) {
        break;
      }
      current = last.value;
    }
    expect(last).toEqual({ ok: false, error: "quota" });
  });

  test("update keeps the id and position, rejects duplicates", () => {
    const start = list("a.com", "b.com", "c.com");
    const updated = updateShortcut(start, "id1", "Bee", "bee.com");
    expect(updated.ok && updated.value.map((s) => s.title)).toEqual([
      "a.com",
      "Bee",
      "c.com",
    ]);
    expect(updateShortcut(start, "id1", "", "a.com")).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(updateShortcut(start, "id1", "Same", "https://b.com")).toMatchObject(
      { ok: true },
    );
    expect(updateShortcut(start, "nope", "", "x.com")).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  test("remove then restore puts the tile back where it was", () => {
    const start = list("a.com", "b.com", "c.com");
    const removed = removeShortcut(start, "id1");
    if (!removed.ok) {
      throw new Error("remove failed");
    }
    expect(ids(removed.value.list)).toEqual(["id0", "id2"]);
    expect(ids(restoreShortcut(removed.value.list, removed.value))).toEqual([
      "id0",
      "id1",
      "id2",
    ]);
    // Restoring twice is a no-op.
    expect(ids(restoreShortcut(start, removed.value))).toEqual([
      "id0",
      "id1",
      "id2",
    ]);
    expect(removeShortcut(start, "zzz")).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  test("move reorders and clamps", () => {
    const start = list("a.com", "b.com", "c.com", "d.com");
    expect(ids(moveShortcut(start, 0, 2))).toEqual([
      "id1",
      "id2",
      "id0",
      "id3",
    ]);
    expect(ids(moveShortcut(start, 3, 0))).toEqual([
      "id3",
      "id0",
      "id1",
      "id2",
    ]);
    expect(ids(moveShortcut(start, 1, 99))).toEqual([
      "id0",
      "id2",
      "id3",
      "id1",
    ]);
    expect(ids(moveShortcut(start, -1, 0))).toEqual(ids(start));
  });

  test("coerce drops bad entries from storage", () => {
    expect(
      coerceShortcuts([
        { id: "a", title: "A", url: "a.com" },
        { id: "a", title: "dup id", url: "b.com" },
        { id: "c", url: "javascript:x" },
        { title: "no id", url: "d.com" },
        "junk",
      ]),
    ).toEqual([{ id: "a", title: "A", url: "https://a.com/" }]);
    expect(coerceShortcuts({})).toEqual([]);
  });
});

describe("most visited", () => {
  test("filters non-web URLs, hidden sites and duplicates", () => {
    const sites = [
      { title: "A", url: "https://a.com/" },
      { title: "Settings", url: "chrome://settings/" },
      { title: "A again", url: "https://www.a.com" },
      { title: "B", url: "https://b.com/" },
      { title: "", url: "https://c.com/" },
    ];
    const out = mostVisited(sites, [urlKey("https://b.com/")]);
    expect(out.map((s) => s.title)).toEqual(["A", "c.com"]);
    expect(out[0]?.id).toBe("top:a.com");
  });
});

describe("ShortcutStore", () => {
  test("round-trips through storage and re-reads before each write", async () => {
    const area = memoryArea();
    const store = new ShortcutStore(area);
    await store.add("A", "a.com");
    // Another tab writes to the same storage area.
    await new ShortcutStore(area).add("B", "b.com");
    const result = await store.add("C", "c.com");
    expect(result.ok && result.value.map((s) => s.title)).toEqual([
      "A",
      "B",
      "C",
    ]);
    const b = (await store.list())[1];
    if (!b) {
      throw new Error("missing B");
    }
    await store.move(b.id, 0);
    expect((await store.list()).map((s) => s.title)).toEqual(["B", "A", "C"]);
    const removal = await store.remove(b.id);
    expect(removal.ok).toBe(true);
    if (removal.ok) {
      await store.restore(removal.value);
    }
    expect((await store.list()).map((s) => s.title)).toEqual(["B", "A", "C"]);
    const stored = await area.get(SHORTCUTS_KEY);
    expect(Array.isArray(stored[SHORTCUTS_KEY])).toBe(true);
  });

  test("hides and unhides most-visited sites", async () => {
    const store = new ShortcutStore(memoryArea());
    await store.hideTop("https://www.a.com/");
    expect(await store.hiddenTop()).toEqual(["a.com"]);
    await store.unhideTop("https://a.com");
    expect(await store.hiddenTop()).toEqual([]);
    await store.hideTop("https://b.com/");
    await store.clearHiddenTop();
    expect(await store.hiddenTop()).toEqual([]);
  });
});
