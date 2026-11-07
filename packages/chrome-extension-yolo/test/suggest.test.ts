// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { memoryArea } from "../src/storage.ts";
import {
  type Candidate,
  clearQueries,
  findSpan,
  fold,
  frecency,
  loadQueries,
  looksLikeUrl,
  matchQuality,
  MAX_STORED_QUERIES,
  MAX_SUGGESTIONS,
  parseOpenSearch,
  queryCandidates,
  rankSuggestions,
  recordQuery,
  recordQueryIn,
  removeQuery,
  removeQueryIn,
  REMOTE_BACKOFF_MS,
  RemoteSuggestions,
} from "../src/newtab/suggest.ts";

const NOW = Date.UTC(2026, 10, 5, 12);
const DAY = 86_400_000;
const TEMPLATE = "https://example.com/s?q={searchTerms}";

const remote = (...texts: string[]): Candidate[] =>
  texts.map((text, rank) => ({ kind: "query", text, rank, source: "remote" }));

describe("matching", () => {
  test("folds case, accents and spacing", () => {
    expect(fold("  Crème   BRÛLÉE ")).toBe("creme brulee");
  });

  test("prefix beats word start beats inner substring", () => {
    expect(matchQuality("chromium", "chro")?.quality).toBe(0.9);
    expect(matchQuality("google chrome", "chro")?.quality).toBe(0.7);
    expect(matchQuality("synchronize", "chro")?.quality).toBe(0.4);
    expect(matchQuality("synchronize", "ch")).toBeUndefined();
    expect(matchQuality("anything", "")).toBeUndefined();
    expect(matchQuality("x.com/chromium", "chro")?.quality).toBe(0.7);
  });

  test("the span maps back to the original text, accents included", () => {
    expect(findSpan("Crème brûlée recipe", "creme b")).toEqual([0, 7]);
    expect(findSpan("best Brûlée", "brul")).toEqual([5, 9]);
    expect(findSpan("synchronize", "chro")).toEqual([3, 7]);
    expect(findSpan("abc", "z")).toBeUndefined();
  });
});

describe("rankSuggestions", () => {
  test("returns nothing for an empty query", () => {
    expect(rankSuggestions("   ", remote("a", "b"), NOW)).toEqual([]);
  });

  test("keeps remote order for equal matches and marks the typed span", () => {
    const out = rankSuggestions(
      "chro",
      remote("chromium", "chrome", "chrono trigger"),
      NOW,
    );
    expect(out.map((s) => s.text)).toEqual([
      "chromium",
      "chrome",
      "chrono trigger",
    ]);
    expect(out[0]?.match).toEqual([0, 4]);
  });

  test("the person's own frequent query outranks a remote one", () => {
    const own: Candidate = {
      kind: "history-query",
      text: "chrome devtools protocol",
      count: 12,
      last: NOW - DAY,
      source: "queries",
    };
    const out = rankSuggestions(
      "chrome",
      [...remote("chrome download", "chrome os"), own],
      NOW,
    );
    expect(out[0]?.text).toBe("chrome devtools protocol");
    expect(out[0]?.kind).toBe("history-query");
  });

  test("old history decays below fresh remote suggestions", () => {
    const stale: Candidate = {
      kind: "history-query",
      text: "chrome flags list",
      count: 1,
      last: NOW - 200 * DAY,
      source: "queries",
    };
    const out = rankSuggestions(
      "chrome",
      [stale, ...remote("chrome flags")],
      NOW,
    );
    expect(out[0]?.text).toBe("chrome flags");
  });

  test("dedupes case- and accent-insensitively, keeping the best score", () => {
    const out = rankSuggestions(
      "cafe",
      [
        ...remote("Café Paris"),
        {
          kind: "history-query",
          text: "cafe paris",
          count: 4,
          last: NOW,
          source: "queries",
        },
      ],
      NOW,
    );
    expect(out.length).toBe(1);
    expect(out[0]?.kind).toBe("history-query");
  });

  test("drops a query row identical to the input", () => {
    const out = rankSuggestions("chrome", remote("chrome", "chrome os"), NOW);
    expect(out.map((s) => s.text)).toEqual(["chrome os"]);
  });

  test("matches pages by URL and caps them at three rows", () => {
    const pages: Candidate[] = ["a", "b", "c", "d"].map((letter) => ({
      kind: "page",
      text: `Docs ${letter}`,
      url: `https://docs${letter}.example.com/`,
      source: "shortcuts",
    }));
    const out = rankSuggestions(
      "docs",
      [...pages, ...remote("docs search")],
      NOW,
    );
    expect(out.filter((s) => s.kind === "page").length).toBe(3);
    expect(out.some((s) => s.kind === "query")).toBe(true);
    const byUrl = rankSuggestions("docsb", pages, NOW);
    expect(byUrl[0]?.url).toBe("https://docsb.example.com/");
  });

  test("never returns more than eight rows", () => {
    const many = remote(...Array.from({ length: 30 }, (_, i) => `query ${i}`));
    expect(rankSuggestions("query", many, NOW).length).toBe(MAX_SUGGESTIONS);
  });

  test("ranks 500 candidates well inside the 100 ms budget", () => {
    const candidates: Candidate[] = Array.from({ length: 500 }, (_, i) => ({
      kind: i % 2 ? "history-query" : "page",
      text: `result number ${i} about chromium internals`,
      url: `https://example${i}.com/`,
      count: i % 7,
      last: NOW - i * 1000,
      source: i % 2 ? "queries" : "history",
    }));
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      rankSuggestions("chrom", candidates, NOW);
    }
    expect((performance.now() - start) / 10).toBeLessThan(100);
  });
});

describe("search history", () => {
  test("frecency rises with use and halves every 14 days", () => {
    expect(frecency(0, NOW, NOW)).toBe(0);
    expect(frecency(4, NOW, NOW)).toBeGreaterThan(frecency(1, NOW, NOW));
    expect(frecency(3, NOW - 14 * DAY, NOW)).toBeCloseTo(
      frecency(3, NOW, NOW) / 2,
      6,
    );
  });

  test("records, merges and caps queries", () => {
    let list = recordQueryIn([], "  Chrome   flags ", NOW);
    expect(list).toEqual([{ text: "Chrome flags", count: 1, last: NOW }]);
    list = recordQueryIn(list, "chrome flags", NOW + 1);
    expect(list.length).toBe(1);
    expect(list[0]?.count).toBe(2);
    expect(recordQueryIn(list, "   ", NOW)).toEqual(list);
    let big = list;
    for (let i = 0; i < MAX_STORED_QUERIES + 20; i++) {
      big = recordQueryIn(big, `q${i}`, NOW + i);
    }
    expect(big.length).toBe(MAX_STORED_QUERIES);
    expect(queryCandidates(list)[0]).toMatchObject({
      kind: "history-query",
      source: "queries",
    });
  });

  test("persists in the local area and clears", async () => {
    const area = memoryArea();
    await recordQuery(area, "bun test");
    await recordQuery(area, "bun test");
    await recordQuery(area, "yolo chromium");
    expect((await loadQueries(area))[0]).toMatchObject({
      text: "bun test",
      count: 2,
    });
    expect(removeQueryIn(await loadQueries(area), "BUN TEST").length).toBe(1);
    await removeQuery(area, "bun test");
    expect((await loadQueries(area)).map((q) => q.text)).toEqual([
      "yolo chromium",
    ]);
    await clearQueries(area);
    expect(await loadQueries(area)).toEqual([]);
  });
});

describe("remote suggestions", () => {
  test("parses OpenSearch JSON and rejects anything else", () => {
    expect(parseOpenSearch(["chr", ["chrome", "chromium", 3]])).toEqual([
      "chrome",
      "chromium",
    ]);
    expect(parseOpenSearch({ q: "x" })).toEqual([]);
    expect(parseOpenSearch(["x"])).toEqual([]);
  });

  test("expands the template, omits credentials and ranks by position", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new RemoteSuggestions(async (url, init) => {
      calls.push({ url, init });
      return Response.json(["a b", ["a b c", "a b d"]]);
    });
    const out = await client.fetch(TEMPLATE, "a b");
    expect(calls[0]?.url).toBe("https://example.com/s?q=a%20b");
    expect(calls[0]?.init.credentials).toBe("omit");
    expect(out.map((c) => [c.text, c.rank])).toEqual([
      ["a b c", 0],
      ["a b d", 1],
    ]);
  });

  test("backs off for five minutes after a failure", async () => {
    let now = NOW;
    let calls = 0;
    const client = new RemoteSuggestions(
      async () => {
        calls++;
        return new Response("nope", { status: 404 });
      },
      () => now,
    );
    expect(await client.fetch(TEMPLATE, "x")).toEqual([]);
    expect(await client.fetch(TEMPLATE, "xy")).toEqual([]);
    expect(calls).toBe(1);
    now += REMOTE_BACKOFF_MS + 1;
    await client.fetch(TEMPLATE, "xyz");
    expect(calls).toBe(2);
  });

  test("an empty template disables the endpoint", async () => {
    let calls = 0;
    const client = new RemoteSuggestions(async () => {
      calls++;
      return Response.json([]);
    });
    expect(await client.fetch("", "x")).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("looksLikeUrl", () => {
  test("addresses versus queries", () => {
    for (const text of [
      "example.com",
      "https://a.b/c",
      "localhost:3000",
      "sub.domain.co.uk/path?q=1",
    ]) {
      expect({ text, url: looksLikeUrl(text) }).toEqual({ text, url: true });
    }
    for (const text of ["chrome flags", "what is 2.5", "c++", "hello", ""]) {
      expect({ text, url: looksLikeUrl(text) }).toEqual({ text, url: false });
    }
  });
});
