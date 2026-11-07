import { describe, expect, test } from "bun:test";
import {
  compareTags,
  openWatchDb,
  parseGitiles,
  renderReport,
  runWatch,
  watchAosp,
  watchChromium,
  watchGithubOrg,
  type FetchLike,
} from "./upstream-watch";

const node = (id: number, name: string, stars: number, sha: string, extra = {}) => ({
  databaseId: id, nameWithOwner: `google/${name}`, stargazerCount: stars,
  pushedAt: "2026-11-01T00:00:00Z", isArchived: false,
  defaultBranchRef: { name: "main", target: { oid: sha } },
  latestRelease: { tagName: "v1" }, refs: { nodes: [{ name: "v1" }] }, ...extra,
});

const gql = (nodes: unknown[]): Response =>
  Response.json({ data: { organization: { repositories: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } });

describe("github org watch", () => {
  test("baseline then diff: new, rename, archive, head, stars", async () => {
    const db = openWatchDb(":memory:");
    let call = 0;
    const fetchImpl: FetchLike = async () =>
      call++ === 0
        ? gql([node(1, "a", 1000, "aaa"), node(2, "b", 50, "bbb")])
        : gql([
            node(1, "a2", 1500, "aab"),
            node(2, "b", 50, "bbb", { isArchived: true }),
            node(3, "c", 10, "ccc"),
          ]);
    const o = { db, fetchImpl, token: "t", top: 10 };
    const first = await watchGithubOrg("google", "google", o);
    expect(first.baseline).toBe(true);
    expect(first.changes).toEqual([]);
    const second = await watchGithubOrg("google", "google", o);
    const kinds = second.changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(["archived", "head", "new-repo", "renamed", "stars"]);
  });

  test("rate limit waits then retries", async () => {
    const db = openWatchDb(":memory:");
    let n = 0;
    const slept: number[] = [];
    const fetchImpl: FetchLike = async () =>
      n++ === 0
        ? new Response("{}", { status: 403, headers: { "retry-after": "2" } })
        : gql([node(1, "a", 1, "x")]);
    const r = await watchGithubOrg("google", "google", {
      db, fetchImpl, token: "t", sleep: async (ms) => void slept.push(ms),
    });
    expect(r.repos?.length).toBe(1);
    expect(slept[0]).toBeGreaterThanOrEqual(2000);
  });

  test("missing token throws, captured by runWatch", async () => {
    const db = openWatchDb(":memory:");
    const [r] = await runWatch(["google"], { db, token: null });
    expect(r!.errors[0]).toContain("token");
  });
});

describe("googlesource", () => {
  test("parseGitiles strips XSSI prefix", () => {
    expect(parseGitiles<{ a: number }>(`)]}'\n{"a":1}`).a).toBe(1);
  });

  test("chromium: heads and channels, ETag cached on 304", async () => {
    const db = openWatchDb(":memory:");
    let sha = "1".repeat(40);
    const seen: Array<string | null> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      if (url.includes("chromiumdash"))
        return Response.json([{ version: "150.0.1.2" }]);
      const inm = new Headers(init?.headers).get("If-None-Match");
      seen.push(inm);
      if (inm === `"${sha}"`) return new Response(null, { status: 304 });
      return new Response(`)]}'\n${JSON.stringify({ log: [{ commit: sha }] })}`, {
        headers: { etag: `"${sha}"` },
      });
    };
    const o = { db, fetchImpl };
    const a = await watchChromium(o);
    expect(a.errors).toEqual([]);
    expect(a.refs!["channel:Stable"]).toBe("150.0.1.2");
    await watchChromium(o);
    expect(seen.some((s) => s !== null)).toBe(true);
    sha = "2".repeat(40);
    const c = await watchChromium(o);
    expect(c.changes.some((x) => x.kind === "moved" && x.key === "v8@main")).toBe(true);
  });

  test("aosp: new tag detected after baseline", async () => {
    const db = openWatchDb(":memory:");
    let tags: Record<string, { value: string }> = { "refs/tags/android-15.0.0_r1": { value: "a" } };
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("source.android.com")) return new Response("page");
      const body = url.includes("refs/tags") ? tags : { "refs/heads/main": { value: "m" } };
      return new Response(`)]}'\n${JSON.stringify(body)}`);
    };
    await watchAosp({ db, fetchImpl });
    tags = { ...tags, "refs/tags/android-16.0.0_r1": { value: "b" } };
    const r = await watchAosp({ db, fetchImpl });
    expect(r.changes.map((c) => c.kind)).toEqual(["new-tag"]);
    expect(r.refs!["latest-android-tag"]).toBe("android-16.0.0_r1");
  });
});

test("compareTags orders numerically", () => {
  expect(compareTags("android-15.0.0_r10", "android-15.0.0_r9")).toBeGreaterThan(0);
});

test("renderReport lists repos", () => {
  const md = renderReport(
    [{ target: "google", baseline: true, fetchedAt: "x", changes: [], errors: [],
       repos: [{ id: 1, fullName: "google/a", stars: 5, defaultBranch: "main", headSha: "abcdef0123456", latestRelease: null, latestTag: null, pushedAt: null, archived: false }] }],
    "2026-11-07",
  );
  expect(md).toContain("google/a");
});
