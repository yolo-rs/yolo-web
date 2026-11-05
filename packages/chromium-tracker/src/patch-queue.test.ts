import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyQueue,
  checkQueue,
  loadQueue,
  parseSeries,
  patchedFiles,
  revertQueue,
  validateQueue,
  type PatchQueueMeta,
} from "./patch-queue";

const DIFF_A = `--- a/base/hello.txt
+++ b/base/hello.txt
@@ -1 +1 @@
-hello
+hello yolo
`;
const DIFF_B = `--- a/base/hello.txt
+++ b/base/hello.txt
@@ -1 +1 @@
-hello yolo
+hello yolo web
`;

function sh(args: string[], cwd: string) {
  const r = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return r.stdout.toString().trim();
}

let root: string;
let src: string;
let queueDir: string;
let head: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "patch-queue-test-"));
  src = join(root, "src");
  mkdirSync(join(src, "base"), { recursive: true });
  writeFileSync(join(src, "base", "hello.txt"), "hello\n");
  sh(["init", "-q"], src);
  sh(
    ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "add", "."],
    src,
  );
  sh(
    [
      "-c",
      "user.email=t@example.invalid",
      "-c",
      "user.name=t",
      "commit",
      "-qm",
      "base",
    ],
    src,
  );
  head = sh(["rev-parse", "HEAD"], src);

  queueDir = join(root, "queue");
  mkdirSync(join(queueDir, "core"), { recursive: true });
  writeFileSync(join(queueDir, "core", "a.patch"), DIFF_A);
  writeFileSync(join(queueDir, "core", "b.patch"), DIFF_B);
  writeFileSync(
    join(queueDir, "series"),
    "# order matters\ncore/a.patch\n\ncore/b.patch  # depends on a\n",
  );
  const provenance = (path: string) => ({
    path,
    upstream: "https://example.invalid/repo",
    upstreamRevision: "0".repeat(40),
    upstreamPath: path,
    license: "BSD-3-Clause",
    rationale: "test",
    removal: "test",
  });
  const meta: PatchQueueMeta = {
    schema: 1,
    queue: "test",
    owner: "t@example.invalid",
    base: { chromiumRevision: head },
    patches: [provenance("core/a.patch"), provenance("core/b.patch")],
  };
  writeFileSync(join(queueDir, "series.json"), JSON.stringify(meta));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("patch queue", () => {
  test("parseSeries drops comments and blanks", () => {
    expect(parseSeries("# c\na.patch\n\n b.patch # x\n")).toEqual([
      "a.patch",
      "b.patch",
    ]);
  });

  test("patchedFiles handles additions and deletions", () => {
    expect(patchedFiles(DIFF_A)).toEqual(["base/hello.txt"]);
    expect(
      patchedFiles(
        "--- a/gone.cc\n+++ /dev/null\n--- /dev/null\n+++ b/new.cc\n",
      ),
    ).toEqual(["gone.cc", "new.cc"]);
  });

  test("validateQueue accepts complete metadata", async () => {
    const queue = await loadQueue(queueDir);
    expect(await validateQueue(queue)).toEqual([]);
  });

  test("validateQueue flags missing provenance", async () => {
    const queue = await loadQueue(queueDir);
    queue.meta = { ...queue.meta, patches: [queue.meta.patches[0]!] };
    const findings = await validateQueue(queue);
    expect(
      findings.some((f) => f.patch === "core/b.patch" && f.level === "error"),
    ).toBe(true);
  });

  test("checkQueue applies cumulatively without touching the worktree", async () => {
    const queue = await loadQueue(queueDir);
    const { head: checkedHead, results } = await checkQueue(queue, src);
    expect(checkedHead).toBe(head);
    expect(results.map((r) => r.ok)).toEqual([true, true]);
    expect(await Bun.file(join(src, "base", "hello.txt")).text()).toBe(
      "hello\n",
    );
    expect(sh(["status", "--porcelain"], src)).toBe("");
  });

  test("checkQueue reports order-dependent failure", async () => {
    const queue = await loadQueue(queueDir);
    queue.series = ["core/b.patch"];
    const { results } = await checkQueue(queue, src);
    expect(results[0]!.ok).toBe(false);
  });

  test("apply then revert round-trips", async () => {
    const queue = await loadQueue(queueDir);
    expect(await applyQueue(queue, src)).toEqual([
      "core/a.patch",
      "core/b.patch",
    ]);
    expect(await Bun.file(join(src, "base", "hello.txt")).text()).toBe(
      "hello yolo web\n",
    );
    expect(await revertQueue(queue, src)).toEqual([
      "core/b.patch",
      "core/a.patch",
    ]);
    expect(await Bun.file(join(src, "base", "hello.txt")).text()).toBe(
      "hello\n",
    );
  });
});
