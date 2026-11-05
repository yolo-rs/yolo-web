/**
 * Ordered Chromium patch queue (quilt-style `series` + `series.json` metadata).
 *
 * Layout under `patches/chromium/<queue>/`:
 *   series        ordered patch paths, one per line; `#` comments and blank lines ignored
 *   series.json   queue base revision and per-patch provenance
 *   <paths>       unified-diff patches relative to `${CHROMIUM_ROOT}/src`
 *
 * `checkQueue` applies the whole series cumulatively to a throwaway Git index
 * built from the checkout's HEAD, so it never touches the working tree or the
 * real index. `applyQueue` / `revertQueue` change the working tree and require
 * an explicit caller decision.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PatchProvenance = {
  path: string;
  upstream: string;
  upstreamRevision: string;
  upstreamPath: string;
  license: string;
  rationale: string;
  removal: string;
};

export type PatchQueueMeta = {
  schema: 1;
  queue: string;
  owner: string;
  base: { chromiumRevision: string; chromiumVersion?: string; checkedAt?: string };
  patches: PatchProvenance[];
};

export type PatchQueue = { dir: string; series: string[]; meta: PatchQueueMeta };

export type QueueFinding = { level: "error" | "warning"; patch?: string; message: string };

export type PatchCheckResult = { patch: string; ok: boolean; files: string[]; detail?: string };

const REQUIRED_PROVENANCE: (keyof PatchProvenance)[] = [
  "upstream",
  "upstreamRevision",
  "upstreamPath",
  "license",
  "rationale",
  "removal",
];

export function parseSeries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** Files touched by a unified diff (`+++ b/<path>` / `--- a/<path>` for deletions). */
export function patchedFiles(diff: string): string[] {
  const files = new Set<string>();
  let minus: string | null = null;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("--- ")) {
      minus = stripPrefix(line.slice(4));
    } else if (line.startsWith("+++ ")) {
      const plus = stripPrefix(line.slice(4));
      const file = plus ?? minus;
      if (file) files.add(file);
      minus = null;
    }
  }
  return [...files].sort();
}

function stripPrefix(raw: string): string | null {
  const path = raw.split("\t")[0]!.trim();
  if (path === "/dev/null") return null;
  return path.replace(/^[ab]\//, "");
}

export async function loadQueue(dir: string): Promise<PatchQueue> {
  const seriesFile = Bun.file(join(dir, "series"));
  const metaFile = Bun.file(join(dir, "series.json"));
  if (!(await seriesFile.exists())) throw new Error(`${dir}: missing series file`);
  if (!(await metaFile.exists())) throw new Error(`${dir}: missing series.json`);
  return { dir, series: parseSeries(await seriesFile.text()), meta: (await metaFile.json()) as PatchQueueMeta };
}

export async function validateQueue(queue: PatchQueue): Promise<QueueFinding[]> {
  const findings: QueueFinding[] = [];
  const { meta, series } = queue;
  if (meta.schema !== 1) findings.push({ level: "error", message: `unsupported schema ${meta.schema}` });
  if (!meta.owner) findings.push({ level: "error", message: "queue owner is required" });
  if (!/^[0-9a-f]{40}$/.test(meta.base?.chromiumRevision ?? "")) {
    findings.push({ level: "error", message: "base.chromiumRevision must be a 40-hex Chromium commit" });
  }
  const seen = new Set<string>();
  for (const patch of series) {
    if (seen.has(patch)) findings.push({ level: "error", patch, message: "listed twice in series" });
    seen.add(patch);
    if (patch.includes("..") || patch.startsWith("/") || patch.includes("\\")) {
      findings.push({ level: "error", patch, message: "series paths must be relative POSIX paths inside the queue" });
      continue;
    }
    const file = Bun.file(join(queue.dir, patch));
    if (!(await file.exists())) {
      findings.push({ level: "error", patch, message: "patch file missing" });
      continue;
    }
    if (patchedFiles(await file.text()).length === 0) {
      findings.push({ level: "error", patch, message: "patch touches no files" });
    }
    const provenance = meta.patches.find((p) => p.path === patch);
    if (!provenance) {
      findings.push({ level: "error", patch, message: "no provenance entry in series.json" });
      continue;
    }
    for (const key of REQUIRED_PROVENANCE) {
      if (!provenance[key]) findings.push({ level: "error", patch, message: `provenance.${key} is required` });
    }
  }
  for (const entry of meta.patches) {
    if (!seen.has(entry.path)) findings.push({ level: "warning", patch: entry.path, message: "provenance entry not in series" });
  }
  return findings;
}

async function git(args: string[], cwd: string, env?: Record<string, string>, stdin?: Blob) {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdin: stdin ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout: stdout.trim(), stderr: stderr.trim() };
}

export function chromiumSourceDir(root: string): string {
  return join(root, "src");
}

/**
 * Apply the series cumulatively to a temporary index seeded from HEAD.
 * Stops reporting cumulative success after the first failure but still checks
 * each remaining patch on top of the last good state.
 */
export async function checkQueue(queue: PatchQueue, chromiumSrc: string): Promise<{ head: string; results: PatchCheckResult[] }> {
  const head = (await git(["rev-parse", "HEAD"], chromiumSrc)).stdout;
  const scratch = mkdtempSync(join(tmpdir(), "yolo-patch-queue-"));
  const env = { GIT_INDEX_FILE: join(scratch, "index") };
  try {
    const seeded = await git(["read-tree", "HEAD"], chromiumSrc, env);
    if (seeded.code !== 0) throw new Error(`git read-tree failed: ${seeded.stderr}`);
    const results: PatchCheckResult[] = [];
    for (const patch of queue.series) {
      const file = Bun.file(join(queue.dir, patch));
      const files = patchedFiles(await file.text());
      const run = await git(["apply", "--cached", "--whitespace=nowarn", "-"], chromiumSrc, env, file);
      results.push({ patch, ok: run.code === 0, files, ...(run.code === 0 ? {} : { detail: run.stderr }) });
    }
    return { head, results };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function assertTouchedFilesClean(queue: PatchQueue, chromiumSrc: string) {
  const touched = new Set<string>();
  for (const patch of queue.series) {
    for (const f of patchedFiles(await Bun.file(join(queue.dir, patch)).text())) touched.add(f);
  }
  const status = await git(["status", "--porcelain", "--untracked-files=no", "--", ...touched], chromiumSrc);
  if (status.stdout) throw new Error(`Chromium files touched by the queue have local changes:\n${status.stdout}`);
}

export async function applyQueue(queue: PatchQueue, chromiumSrc: string): Promise<string[]> {
  await assertTouchedFilesClean(queue, chromiumSrc);
  const applied: string[] = [];
  for (const patch of queue.series) {
    const run = await git(["apply", "--whitespace=nowarn", "-"], chromiumSrc, undefined, Bun.file(join(queue.dir, patch)));
    if (run.code !== 0) {
      throw new Error(`${patch} failed after ${applied.length} applied patches; run revert to roll back.\n${run.stderr}`);
    }
    applied.push(patch);
  }
  return applied;
}

export async function revertQueue(queue: PatchQueue, chromiumSrc: string): Promise<string[]> {
  const reverted: string[] = [];
  for (const patch of [...queue.series].reverse()) {
    const file = Bun.file(join(queue.dir, patch));
    const probe = await git(["apply", "-R", "--check", "-"], chromiumSrc, undefined, file);
    if (probe.code !== 0) continue; // not applied
    const run = await git(["apply", "-R", "--whitespace=nowarn", "-"], chromiumSrc, undefined, file);
    if (run.code !== 0) throw new Error(`${patch} could not be reverted: ${run.stderr}`);
    reverted.push(patch);
  }
  return reverted;
}

export async function listQueues(patchesRoot: string): Promise<string[]> {
  const glob = new Bun.Glob("*/series.json");
  const queues: string[] = [];
  for await (const match of glob.scan({ cwd: patchesRoot })) queues.push(match.split(/[\\/]/)[0]!);
  return queues.sort();
}
