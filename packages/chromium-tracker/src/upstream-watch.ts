import { Database } from "bun:sqlite";
import { ChromiumTrackingEngine } from "./index";

export type WatchTarget = "google" | "chromium" | "aosp" | "deepmind";
export const WATCH_TARGETS: WatchTarget[] = [
  "google",
  "chromium",
  "aosp",
  "deepmind",
];

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface WatchChange {
  source: string;
  key: string;
  kind: string;
  detail: string;
}

export interface RepoSnapshot {
  id: number;
  fullName: string;
  stars: number;
  defaultBranch: string | null;
  headSha: string | null;
  latestRelease: string | null;
  latestTag: string | null;
  pushedAt: string | null;
  archived: boolean;
}

export interface WatchResult {
  target: WatchTarget;
  baseline: boolean;
  fetchedAt: string;
  changes: WatchChange[];
  repos?: RepoSnapshot[];
  refs?: Record<string, string>;
  errors: string[];
}

export interface WatchOptions {
  db: Database;
  fetchImpl?: FetchLike;
  token?: string | null;
  top?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  maxRateWaitMs?: number;
}

export function openWatchDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS repos (
    org TEXT NOT NULL, id INTEGER NOT NULL, full_name TEXT NOT NULL,
    stars INTEGER NOT NULL, default_branch TEXT, head_sha TEXT,
    latest_release TEXT, latest_tag TEXT, pushed_at TEXT, archived INTEGER NOT NULL,
    first_seen TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY (org, id))`);
  db.run(`CREATE TABLE IF NOT EXISTS refs (
    source TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
    first_seen TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY (source, key))`);
  db.run(`CREATE TABLE IF NOT EXISTS http_cache (
    url TEXT PRIMARY KEY, etag TEXT NOT NULL, body TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS runs (
    source TEXT PRIMARY KEY, last_run TEXT NOT NULL)`);
  return db;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function resolveGithubToken(): Promise<string | null> {
  const env = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (env) return env;
  try {
    const child = Bun.spawn(["gh", "auth", "token"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      windowsHide: true,
    });
    const out = (await new Response(child.stdout).text()).trim();
    return (await child.exited) === 0 && out ? out : null;
  } catch {
    return null;
  }
}

/** HTTP with retry on 5xx, rate-limit waits, and ETag cache for GET. */
class Http {
  constructor(private opts: WatchOptions) {}

  private get f(): FetchLike {
    return this.opts.fetchImpl ?? ((u, i) => fetch(u, i));
  }

  private async rateWait(res: Response): Promise<boolean> {
    const sleep = this.opts.sleep ?? defaultSleep;
    const cap = this.opts.maxRateWaitMs ?? 120_000;
    let wait = 0;
    const retryAfter = res.headers.get("retry-after");
    const reset = res.headers.get("x-ratelimit-reset");
    if (retryAfter) wait = Number(retryAfter) * 1000;
    else if (res.headers.get("x-ratelimit-remaining") === "0" && reset)
      wait = Number(reset) * 1000 - (this.opts.now?.() ?? new Date()).getTime();
    else if (res.status === 429) wait = 5000;
    else return false;
    if (!Number.isFinite(wait) || wait > cap) return false;
    await sleep(Math.max(wait, 0) + 250);
    return true;
  }

  async request(url: string, init: RequestInit = {}): Promise<Response> {
    let attempt = 0;
    for (;;) {
      let res: Response;
      try {
        res = await this.f(url, init);
      } catch (error) {
        if (attempt++ >= 2) throw error;
        await (this.opts.sleep ?? defaultSleep)(500 * attempt);
        continue;
      }
      if (
        (res.status === 403 || res.status === 429) &&
        attempt < 3 &&
        (await this.rateWait(res))
      ) {
        attempt++;
        continue;
      }
      if (res.status >= 500 && attempt < 2) {
        attempt++;
        await (this.opts.sleep ?? defaultSleep)(500 * attempt);
        continue;
      }
      return res;
    }
  }

  /** Conditional GET; returns body text (cached on 304). */
  async getText(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<{ body: string; notModified: boolean }> {
    const cached = this.opts.db
      .query("SELECT etag, body FROM http_cache WHERE url = ?")
      .get(url) as { etag: string; body: string } | null;
    const h = { ...headers };
    if (cached) h["If-None-Match"] = cached.etag;
    const res = await this.request(url, { headers: h });
    if (res.status === 304 && cached)
      return { body: cached.body, notModified: true };
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    const body = await res.text();
    const etag = res.headers.get("etag");
    if (etag)
      this.opts.db
        .query(
          "INSERT INTO http_cache (url, etag, body) VALUES (?1, ?2, ?3) ON CONFLICT(url) DO UPDATE SET etag = ?2, body = ?3",
        )
        .run(url, etag, body);
    return { body, notModified: false };
  }
}

function isoNow(o: WatchOptions): string {
  return (o.now?.() ?? new Date()).toISOString();
}

function isBaseline(o: WatchOptions, source: string): boolean {
  return !o.db.query("SELECT 1 FROM runs WHERE source = ?").get(source);
}

function markRun(o: WatchOptions, source: string): void {
  o.db
    .query(
      "INSERT INTO runs (source, last_run) VALUES (?1, ?2) ON CONFLICT(source) DO UPDATE SET last_run = ?2",
    )
    .run(source, isoNow(o));
}

interface GqlRepoNode {
  databaseId: number;
  nameWithOwner: string;
  stargazerCount: number;
  pushedAt: string | null;
  isArchived: boolean;
  defaultBranchRef: { name: string; target: { oid: string } | null } | null;
  latestRelease: { tagName: string } | null;
  refs: { nodes: Array<{ name: string }> } | null;
}

const REPO_QUERY = `query($org:String!,$first:Int!,$after:String){
  organization(login:$org){ repositories(first:$first, after:$after, privacy:PUBLIC, orderBy:{field:STARGAZERS,direction:DESC}){
    pageInfo{hasNextPage endCursor}
    nodes{ databaseId nameWithOwner stargazerCount pushedAt isArchived
      defaultBranchRef{ name target{ oid } }
      latestRelease{ tagName }
      refs(refPrefix:"refs/tags/", first:1, orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){ nodes{ name } } } } } }`;

export async function watchGithubOrg(
  org: string,
  target: WatchTarget,
  opts: WatchOptions,
): Promise<WatchResult> {
  const http = new Http(opts);
  const want = opts.top ?? 100;
  const source = `github:${org}`;
  const baseline = isBaseline(opts, source);
  const now = isoNow(opts);
  const errors: string[] = [];
  const nodes: GqlRepoNode[] = [];
  if (!opts.token) throw new Error("GitHub token required (GITHUB_TOKEN or gh auth login)");

  let after: string | null = null;
  while (nodes.length < want) {
    const first = Math.min(100, want - nodes.length);
    const res = await http.request("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
        "User-Agent": "yolo-web-upstream-watch",
      },
      body: JSON.stringify({ query: REPO_QUERY, variables: { org, first, after } }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL ${org}: HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: {
        organization: {
          repositories: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: GqlRepoNode[];
          };
        } | null;
      };
      errors?: Array<{ message: string; type?: string }>;
    };
    if (json.errors?.length && !json.data?.organization)
      throw new Error(`GitHub GraphQL ${org}: ${json.errors[0]!.message}`);
    const page = json.data?.organization?.repositories;
    if (!page) throw new Error(`GitHub org ${org} not found`);
    nodes.push(...page.nodes.filter(Boolean));
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }

  const changes: WatchChange[] = [];
  const repos: RepoSnapshot[] = [];
  const select = opts.db.query(
    "SELECT * FROM repos WHERE org = ? AND id = ?",
  );
  const upsert = opts.db.query(`INSERT INTO repos
    (org,id,full_name,stars,default_branch,head_sha,latest_release,latest_tag,pushed_at,archived,first_seen,updated)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)
    ON CONFLICT(org,id) DO UPDATE SET full_name=?3,stars=?4,default_branch=?5,head_sha=?6,
      latest_release=?7,latest_tag=?8,pushed_at=?9,archived=?10,updated=?11`);

  for (const n of nodes.slice(0, want)) {
    const snap: RepoSnapshot = {
      id: n.databaseId,
      fullName: n.nameWithOwner,
      stars: n.stargazerCount,
      defaultBranch: n.defaultBranchRef?.name ?? null,
      headSha: n.defaultBranchRef?.target?.oid ?? null,
      latestRelease: n.latestRelease?.tagName ?? null,
      latestTag: n.refs?.nodes?.[0]?.name ?? null,
      pushedAt: n.pushedAt,
      archived: n.isArchived,
    };
    repos.push(snap);
    const prev = select.get(org, snap.id) as Record<string, unknown> | null;
    const key = snap.fullName;
    if (!prev) {
      if (!baseline)
        changes.push({ source, key, kind: "new-repo", detail: `${snap.stars} stars` });
    } else {
      if (prev.full_name !== snap.fullName)
        changes.push({ source, key, kind: "renamed", detail: `${prev.full_name} -> ${snap.fullName}` });
      if (Boolean(prev.archived) !== snap.archived)
        changes.push({ source, key, kind: snap.archived ? "archived" : "unarchived", detail: "" });
      if (prev.latest_release !== snap.latestRelease)
        changes.push({ source, key, kind: "release", detail: `${prev.latest_release ?? "none"} -> ${snap.latestRelease ?? "none"}` });
      if (prev.latest_tag !== snap.latestTag)
        changes.push({ source, key, kind: "tag", detail: `${prev.latest_tag ?? "none"} -> ${snap.latestTag ?? "none"}` });
      if (prev.head_sha !== snap.headSha)
        changes.push({ source, key, kind: "head", detail: `${String(prev.head_sha ?? "none").slice(0, 10)} -> ${(snap.headSha ?? "none").slice(0, 10)}` });
      const delta = snap.stars - Number(prev.stars);
      if (Math.abs(delta) >= 100 || (Number(prev.stars) > 0 && Math.abs(delta) / Number(prev.stars) >= 0.05))
        changes.push({ source, key, kind: "stars", detail: `${prev.stars} -> ${snap.stars} (${delta >= 0 ? "+" : ""}${delta})` });
    }
    upsert.run(
      org, snap.id, snap.fullName, snap.stars, snap.defaultBranch, snap.headSha,
      snap.latestRelease, snap.latestTag, snap.pushedAt, snap.archived ? 1 : 0, now,
    );
  }
  markRun(opts, source);
  return { target, baseline, fetchedAt: now, changes, repos, errors };
}

function upsertRefs(
  opts: WatchOptions,
  source: string,
  values: Record<string, string>,
  baseline: boolean,
  label: (key: string) => string,
): WatchChange[] {
  const now = isoNow(opts);
  const changes: WatchChange[] = [];
  const sel = opts.db.query("SELECT value FROM refs WHERE source = ? AND key = ?");
  const up = opts.db.query(
    `INSERT INTO refs (source,key,value,first_seen,updated) VALUES (?1,?2,?3,?4,?4)
     ON CONFLICT(source,key) DO UPDATE SET value=?3, updated=?4`,
  );
  const tx = opts.db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      const prev = sel.get(source, key) as { value: string } | null;
      if (!prev) {
        if (!baseline)
          changes.push({ source, key, kind: `new-${label(key)}`, detail: value.slice(0, 12) });
      } else if (prev.value !== value) {
        changes.push({ source, key, kind: "moved", detail: `${prev.value.slice(0, 10)} -> ${value.slice(0, 10)}` });
      }
      up.run(source, key, value, now);
    }
  });
  tx();
  return changes;
}

const GOOGLESOURCE_REPOS: Array<[string, string]> = [
  ["chromium/src", "https://chromium.googlesource.com/chromium/src"],
  ["depot_tools", "https://chromium.googlesource.com/chromium/tools/depot_tools"],
  ["skia", "https://skia.googlesource.com/skia"],
  ["angle", "https://chromium.googlesource.com/angle/angle"],
  ["dawn", "https://dawn.googlesource.com/dawn"],
  ["v8", "https://chromium.googlesource.com/v8/v8"],
  ["devtools-frontend", "https://chromium.googlesource.com/devtools/devtools-frontend"],
];

export function parseGitiles<T>(text: string): T {
  return JSON.parse(text.replace(/^\)\]\}'\s*/, "")) as T;
}

export async function watchChromium(opts: WatchOptions): Promise<WatchResult> {
  const http = new Http(opts);
  const source = "chromium";
  const baseline = isBaseline(opts, source);
  const errors: string[] = [];
  const refs: Record<string, string> = {};

  await Promise.all(
    GOOGLESOURCE_REPOS.map(async ([name, base]) => {
      try {
        const { body } = await http.getText(
          `${base}/+log/refs/heads/main?format=JSON&n=1`,
        );
        const sha = parseGitiles<{ log: Array<{ commit: string }> }>(body).log[0]?.commit;
        if (sha) refs[`${name}@main`] = sha;
      } catch (error) {
        errors.push(`${name}: ${(error as Error).message}`);
      }
    }),
  );

  for (const channel of ["Stable", "Beta", "Dev", "Canary"] as const) {
    try {
      const res = await http.request(
        `https://chromiumdash.appspot.com/fetch_releases?channel=${channel}&platform=Windows&num=1`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = (await res.json()) as Array<{ version: string }>;
      if (list[0]?.version) refs[`channel:${channel}`] = list[0].version;
    } catch (error) {
      errors.push(`chromiumdash ${channel}: ${(error as Error).message}`);
    }
  }
  if (!Object.keys(refs).some((k) => k.startsWith("channel:"))) {
    try {
      const engine = new ChromiumTrackingEngine();
      for (const [ch, r] of Object.entries(await engine.fetchChromiumChannels()))
        refs[`channel:${ch}`] = r.version;
    } catch (error) {
      errors.push(`chrome-for-testing fallback: ${(error as Error).message}`);
    }
  }

  const changes = upsertRefs(opts, source, refs, baseline, () => "ref");
  markRun(opts, source);
  return { target: "chromium", baseline, fetchedAt: isoNow(opts), changes, refs, errors };
}

function versionKey(tag: string): number[] {
  return (tag.match(/\d+/g) ?? []).map(Number);
}

export function compareTags(a: string, b: string): number {
  const x = versionKey(a);
  const y = versionKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export async function watchAosp(opts: WatchOptions): Promise<WatchResult> {
  const http = new Http(opts);
  const source = "aosp";
  const baseline = isBaseline(opts, source);
  const errors: string[] = [];
  const refs: Record<string, string> = {};
  const base = "https://android.googlesource.com/platform/manifest";

  for (const [kind, prefix] of [["branch", "refs/heads"], ["tag", "refs/tags"]] as const) {
    try {
      const { body } = await http.getText(`${base}/+${prefix}?format=JSON`);
      const map = parseGitiles<Record<string, { value: string }>>(body);
      for (const [name, v] of Object.entries(map))
        refs[`${kind}:${name.replace(/^refs\/(heads|tags)\//, "")}`] = v.value;
    } catch (error) {
      errors.push(`manifest ${kind}s: ${(error as Error).message}`);
    }
  }

  try {
    const { body } = await http.getText("https://source.android.com/docs/setup/reference/build-numbers");
    refs["page:build-numbers"] = String(Bun.hash(body));
  } catch (error) {
    errors.push(`release notes page: ${(error as Error).message}`);
  }

  const changes = upsertRefs(opts, source, refs, baseline, (k) => k.split(":")[0]!);
  const tags = Object.keys(refs).filter((k) => k.startsWith("tag:")).map((k) => k.slice(4)).filter((t) => /^android-\d/.test(t));
  const newest = tags.sort(compareTags).at(-1);
  if (newest) refs["latest-android-tag"] = newest;
  markRun(opts, source);
  const summary: Record<string, string> = {
    "latest-android-tag": newest ?? "none",
    branches: String(Object.keys(refs).filter((k) => k.startsWith("branch:")).length),
    tags: String(Object.keys(refs).filter((k) => k.startsWith("tag:")).length),
  };
  return { target: "aosp", baseline, fetchedAt: isoNow(opts), changes, refs: summary, errors };
}

export async function runWatch(
  targets: WatchTarget[],
  opts: WatchOptions,
): Promise<WatchResult[]> {
  const out: WatchResult[] = [];
  for (const t of targets) {
    try {
      if (t === "google") out.push(await watchGithubOrg("google", t, opts));
      else if (t === "deepmind") out.push(await watchGithubOrg("google-deepmind", t, opts));
      else if (t === "chromium") out.push(await watchChromium(opts));
      else out.push(await watchAosp(opts));
    } catch (error) {
      out.push({
        target: t, baseline: false, fetchedAt: isoNow(opts), changes: [],
        errors: [(error as Error).message],
      });
    }
  }
  return out;
}

export function renderReport(results: WatchResult[], date: string, topShown = 30): string {
  const lines = [`# Upstream watch ${date}`, ""];
  for (const r of results) {
    lines.push(`## ${r.target}${r.baseline ? " (baseline run, changes suppressed)" : ""}`, "");
    if (r.errors.length) lines.push(...r.errors.map((e) => `- error: ${e}`), "");
    if (r.refs) {
      lines.push("| ref | value |", "| --- | --- |");
      for (const [k, v] of Object.entries(r.refs)) lines.push(`| ${k} | ${v.slice(0, 40)} |`);
      lines.push("");
    }
    if (r.repos) {
      lines.push("| # | repo | stars | latest release | latest tag | HEAD | pushed |", "| --- | --- | --- | --- | --- | --- | --- |");
      r.repos.slice(0, topShown).forEach((p, i) =>
        lines.push(`| ${i + 1} | ${p.fullName}${p.archived ? " (archived)" : ""} | ${p.stars} | ${p.latestRelease ?? ""} | ${p.latestTag ?? ""} | ${p.headSha?.slice(0, 10) ?? ""} | ${p.pushedAt?.slice(0, 10) ?? ""} |`),
      );
      lines.push("");
    }
    lines.push(`### Changes (${r.changes.length})`, "");
    for (const c of r.changes) lines.push(`- ${c.kind}: ${c.key} ${c.detail}`.trimEnd());
    lines.push("");
  }
  return lines.join("\n");
}
