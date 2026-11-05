// SPDX-License-Identifier: Apache-2.0
/**
 * Search suggestions (recon entity Suggestion): candidates from the
 * configured suggestion endpoint, the local search history, shortcuts and
 * most visited sites, and (with the optional `history` permission) recently
 * visited pages, ranked into one list of at most eight rows.
 *
 * Ranking is synchronous and pure so it runs on every keystroke well under
 * the 100 ms budget the recon set; remote results merge in when they arrive.
 */
import type { KeyValueArea } from "../storage.ts";
import { expandTemplate } from "./settings.ts";

export const MAX_SUGGESTIONS = 8;
export const QUERIES_KEY = "ntp.queries";
export const MAX_STORED_QUERIES = 200;
export const MAX_QUERY_LENGTH = 512;
/** Remote suggestions arriving later than this are dropped. */
export const REMOTE_BUDGET_MS = 400;
/** After a failed remote call, stop calling for this long. */
export const REMOTE_BACKOFF_MS = 5 * 60_000;

export type SuggestionKind = "query" | "history-query" | "page";

export interface Candidate {
  readonly kind: SuggestionKind;
  /** The text shown and matched (a query, or a page title). */
  readonly text: string;
  /** Pages only: where Enter goes. */
  readonly url?: string;
  /** How often the person used it (queries) or visited it (pages). */
  readonly count?: number;
  /** Last use, ms since epoch. */
  readonly last?: number;
  /** Source rank from the remote endpoint (0 is best). */
  readonly rank?: number;
  readonly source: "remote" | "queries" | "shortcuts" | "history";
}

export interface Suggestion {
  readonly kind: SuggestionKind;
  readonly text: string;
  readonly url?: string;
  /**
   * `[start, end)` of the part the person typed, so the rest of the text can
   * be shown in bold as the completion. `undefined` when it does not occur.
   */
  readonly match?: readonly [number, number];
  readonly score: number;
}

/** Lowercase, accents folded, inner whitespace collapsed. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Where `query` matches inside `text`, and how well. */
export function matchQuality(
  text: string,
  query: string,
): { readonly quality: number; readonly at: number } | undefined {
  const t = fold(text);
  const q = fold(query);
  if (!q) {
    return undefined;
  }
  if (t === q) {
    return { quality: 1, at: 0 };
  }
  if (t.startsWith(q)) {
    return { quality: 0.9, at: 0 };
  }
  // Start of a later word ("new york" for "york").
  const wordStart = t.search(
    new RegExp(`(^|[\\s./_-])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  if (wordStart >= 0) {
    const at = t[wordStart] === q[0] ? wordStart : wordStart + 1;
    return { quality: 0.7, at };
  }
  const inner = t.indexOf(q);
  if (inner >= 0 && q.length >= 3) {
    return { quality: 0.4, at: inner };
  }
  return undefined;
}

const SOURCE_WEIGHT: Record<Candidate["source"], number> = {
  queries: 1.15,
  remote: 1,
  shortcuts: 1.1,
  history: 0.85,
};

const DAY_MS = 86_400_000;

/** Frecency in [0, 1): use count, decayed by age with a 14 day half-life. */
export function frecency(count = 0, last = 0, now = Date.now()): number {
  if (count <= 0) {
    return 0;
  }
  const ageDays = Math.max(0, (now - last) / DAY_MS);
  const decay = 0.5 ** (ageDays / 14);
  return (1 - 1 / (1 + count)) * decay;
}

function dedupeKey(candidate: Candidate): string {
  return candidate.kind === "page" && candidate.url
    ? `page:${candidate.url.replace(/\/+$/, "").toLowerCase()}`
    : `query:${fold(candidate.text)}`;
}

/**
 * Merges, scores and orders candidates. Score = match quality x source
 * weight + frecency bonus + remote position bonus. Equal texts keep the best
 * score and pages from shortcuts or history are capped at three rows so
 * queries stay the main content of the list.
 */
export function rankSuggestions(
  query: string,
  candidates: readonly Candidate[],
  now: number = Date.now(),
  limit: number = MAX_SUGGESTIONS,
): Suggestion[] {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const foldedQuery = fold(q);
  const best = new Map<string, Suggestion>();
  for (const candidate of candidates) {
    const text = candidate.text.trim();
    if (!text || text.length > MAX_QUERY_LENGTH) {
      continue;
    }
    const match =
      matchQuality(text, q) ??
      (candidate.url
        ? matchQuality(candidate.url.replace(/^https?:\/\/(www\.)?/, ""), q)
        : undefined);
    if (!match) {
      continue;
    }
    // A query row identical to what is typed adds nothing.
    if (candidate.kind !== "page" && fold(text) === foldedQuery) {
      continue;
    }
    const remoteBonus =
      candidate.source === "remote" && candidate.rank !== undefined
        ? 0.2 / (1 + candidate.rank)
        : 0;
    const score =
      match.quality * SOURCE_WEIGHT[candidate.source] +
      0.5 * frecency(candidate.count, candidate.last, now) +
      remoteBonus;
    const span = findSpan(text, q);
    const suggestion: Suggestion = {
      kind: candidate.kind,
      text,
      ...(candidate.url ? { url: candidate.url } : {}),
      ...(span ? { match: span } : {}),
      score,
    };
    const key = dedupeKey(candidate);
    const existing = best.get(key);
    if (!existing || existing.score < score) {
      best.set(key, suggestion);
    }
  }
  const ordered = [...best.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.text.length - b.text.length ||
      (a.text < b.text ? -1 : 1),
  );
  const out: Suggestion[] = [];
  let pages = 0;
  for (const suggestion of ordered) {
    if (suggestion.kind === "page") {
      if (pages >= 3) {
        continue;
      }
      pages++;
    }
    out.push(suggestion);
    if (out.length === limit) {
      break;
    }
  }
  return out;
}

/** Case- and accent-insensitive span of `query` in `text`, by code unit. */
export function findSpan(
  text: string,
  query: string,
): readonly [number, number] | undefined {
  const q = fold(query);
  if (!q) {
    return undefined;
  }
  // Fold each character on its own so indexes map back to `text`.
  const folded: string[] = [];
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const piece = text[i]!.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    for (const char of piece) {
      folded.push(char === "\t" || char === "\n" ? " " : char);
      index.push(i);
    }
  }
  const haystack = folded.join("");
  let at = haystack.startsWith(q) ? 0 : -1;
  if (at < 0) {
    const word = haystack.search(
      new RegExp(`[\\s./_-]${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    at = word >= 0 ? word + 1 : haystack.indexOf(q);
  }
  if (at < 0) {
    return undefined;
  }
  const start = index[at] ?? 0;
  const endIndex = index[at + q.length - 1];
  return [start, endIndex === undefined ? text.length : endIndex + 1];
}

// ------------------------------------------------------------ search history

export interface QueryStat {
  readonly text: string;
  readonly count: number;
  readonly last: number;
}

export function coerceQueries(value: unknown): QueryStat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): QueryStat[] => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const { text, count, last } = item as Record<string, unknown>;
    return typeof text === "string" &&
      typeof count === "number" &&
      typeof last === "number" &&
      text.trim()
      ? [{ text, count, last }]
      : [];
  });
}

/** Adds one use of `text`; keeps the 200 entries with the best frecency. */
export function recordQueryIn(
  list: readonly QueryStat[],
  text: string,
  now: number = Date.now(),
): QueryStat[] {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
  if (!clean) {
    return [...list];
  }
  const key = fold(clean);
  const existing = list.find((item) => fold(item.text) === key);
  const rest = list.filter((item) => fold(item.text) !== key);
  const updated: QueryStat = {
    text: clean,
    count: (existing?.count ?? 0) + 1,
    last: now,
  };
  return [updated, ...rest]
    .sort(
      (a, b) => frecency(b.count, b.last, now) - frecency(a.count, a.last, now),
    )
    .slice(0, MAX_STORED_QUERIES);
}

export async function loadQueries(area: KeyValueArea): Promise<QueryStat[]> {
  const stored = await area.get(QUERIES_KEY);
  return coerceQueries(stored[QUERIES_KEY]);
}

export async function recordQuery(
  area: KeyValueArea,
  text: string,
): Promise<void> {
  const list = await loadQueries(area);
  await area.set({ [QUERIES_KEY]: recordQueryIn(list, text) });
}

export async function clearQueries(area: KeyValueArea): Promise<void> {
  await area.remove(QUERIES_KEY);
}

export function queryCandidates(list: readonly QueryStat[]): Candidate[] {
  return list.map((item) => ({
    kind: "history-query",
    text: item.text,
    count: item.count,
    last: item.last,
    source: "queries",
  }));
}

// ------------------------------------------------------------------- remote

/** Parses OpenSearch suggestions JSON: `["query", ["a", "b", ...], ...]`. */
export function parseOpenSearch(body: unknown): string[] {
  if (!Array.isArray(body) || !Array.isArray(body[1])) {
    return [];
  }
  return (body[1] as unknown[])
    .filter((item): item is string => typeof item === "string")
    .slice(0, 10);
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Remote suggestion client with a time budget and a failure backoff. */
export class RemoteSuggestions {
  private disabledUntil = 0;
  private controller: AbortController | undefined;

  constructor(
    private readonly fetchImpl: FetchLike = (input, init) =>
      globalThis.fetch(input, init),
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** Cancels any request in flight. */
  cancel(): void {
    this.controller?.abort();
    this.controller = undefined;
  }

  async fetch(template: string, query: string): Promise<Candidate[]> {
    this.cancel();
    if (!template || !query.trim() || this.clock() < this.disabledUntil) {
      return [];
    }
    const controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), REMOTE_BUDGET_MS);
    try {
      const response = await this.fetchImpl(expandTemplate(template, query), {
        signal: controller.signal,
        credentials: "omit",
        headers: { accept: "application/x-suggestions+json, application/json" },
      });
      if (!response.ok) {
        this.disabledUntil = this.clock() + REMOTE_BACKOFF_MS;
        return [];
      }
      return parseOpenSearch(await response.json()).map((text, rank) => ({
        kind: "query",
        text,
        rank,
        source: "remote",
      }));
    } catch {
      // Network or CORS failure; an abort (newer keystroke or the time
      // budget) is not the endpoint's fault and does not back off.
      if (!controller.signal.aborted) {
        this.disabledUntil = this.clock() + REMOTE_BACKOFF_MS;
      }
      return [];
    } finally {
      clearTimeout(timer);
      if (this.controller === controller) {
        this.controller = undefined;
      }
    }
  }
}

/** Heuristic: is the typed text an address rather than a query? */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) {
    return false;
  }
  if (/^https?:\/\//i.test(t)) {
    return true;
  }
  return /^(localhost(:\d+)?|[\p{L}\d-]+(\.[\p{L}\d-]+)*\.\p{L}{2,})(:\d+)?(\/\S*)?$/u.test(
    t,
  );
}
