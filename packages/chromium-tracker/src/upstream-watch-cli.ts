import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  WATCH_TARGETS,
  openWatchDb,
  renderReport,
  resolveGithubToken,
  runWatch,
  type WatchTarget,
} from "./upstream-watch";

const args = Bun.argv.slice(2).filter((a) => a !== "--");
const flag = (name: string): string | undefined => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return undefined;
  return args[i]!.includes("=") ? args[i]!.split("=")[1] : args[i + 1];
};
const positional = args.find((a, i) => !a.startsWith("--") && !(args[i - 1]?.startsWith("--") && !args[i - 1]!.includes("=")));
const which = positional ?? "all";
if (which !== "all" && !WATCH_TARGETS.includes(which as WatchTarget)) {
  console.error("usage: upstream:watch -- google|chromium|aosp|deepmind|all [--top N] [--db path] [--out dir]");
  process.exit(2);
}
const targets = which === "all" ? WATCH_TARGETS : [which as WatchTarget];
const root = resolve(import.meta.dir, "../../..");
const dbPath = resolve(flag("--db") ?? process.env.UPSTREAM_WATCH_DB ?? join(root, "data/upstream-watch.sqlite"));
const outDir = resolve(flag("--out") ?? join(root, "docs/upstream"));
const top = flag("--top") ? Number(flag("--top")) : undefined;

mkdirSync(dirname(dbPath), { recursive: true });
const db = openWatchDb(dbPath);
const results = await runWatch(targets, { db, token: await resolveGithubToken(), top });
const date = new Date().toISOString().slice(0, 10);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `google-watch-${date}.md`), renderReport(results, date));
writeFileSync(join(outDir, `google-watch-${date}.json`), JSON.stringify({ date, results }, null, 2));
for (const r of results)
  console.log(`${r.target}: ${r.changes.length} changes${r.baseline ? " (baseline)" : ""}${r.errors.length ? `, ${r.errors.length} errors` : ""}`);
if (results.some((r) => r.errors.length)) process.exitCode = 1;
