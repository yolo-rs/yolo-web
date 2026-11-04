#!/usr/bin/env bun
/** Inventory the official Chromium browser and ChromeOS UI trees in a synced source checkout. */

type CrawlGroup = "chromium-browser-ui" | "chromium-webui" | "chromeos-ash-ui" | "chromeos-shared-ui";
type FileRecord = { path: string; group: CrawlGroup; extension: string; bytes: number };

const source = process.env.CHROMIUM_SRC?.trim();
if (!source) throw new Error("Set CHROMIUM_SRC to the root of a synced chromium/src checkout.");
if (!(await Bun.file(`${source}/DEPS`).exists())) throw new Error(`CHROMIUM_SRC is not a Chromium source root: ${source}`);

const roots: Array<{ path: string; group: CrawlGroup }> = [
  { path: "chrome/browser/ui", group: "chromium-browser-ui" },
  { path: "chrome/browser/resources", group: "chromium-webui" },
  { path: "ui/webui", group: "chromium-webui" },
  { path: "ui/views", group: "chromium-browser-ui" },
  { path: "ui/color", group: "chromium-browser-ui" },
  { path: "components/webui", group: "chromium-webui" },
  { path: "ash", group: "chromeos-ash-ui" },
  { path: "chrome/browser/ash", group: "chromeos-ash-ui" },
  { path: "chromeos", group: "chromeos-shared-ui" },
  { path: "ui/chromeos", group: "chromeos-shared-ui" },
];
const excludes = ["**/.git/**", "**/out/**", "**/gen/**", "**/node_modules/**", "**/target/**", "**/.cache/**"];
const extensionOf = (path: string) => {
  const leaf = path.slice(path.lastIndexOf("/") + 1);
  const dot = leaf.lastIndexOf(".");
  return dot < 0 ? "[no extension]" : leaf.slice(dot).toLowerCase();
};
const getGit = async (args: string[]) => {
  const child = Bun.spawn(["git", ...args], { cwd: source, stdout: "pipe", stderr: "pipe" });
  if (!child.stdout || !child.stderr) throw new Error("git output pipes were not created");
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  return stdout.trim();
};

const records: FileRecord[] = [];
const groupCounts: Record<string, number> = {};
const rootStats: Array<{ path: string; group: CrawlGroup; files: number }> = [];
const glob = new Bun.Glob("**/*");
for (const root of roots) {
  if (!(await Bun.file(`${source}/${root.path}/BUILD.gn`).exists()) && !(await Bun.file(`${source}/${root.path}`).exists())) {
    rootStats.push({ ...root, files: 0 });
    continue;
  }
  let files = 0;
  for await (const relative of glob.scan({ cwd: `${source}/${root.path}`, onlyFiles: true, dot: false, absolute: false })) {
    if (excludes.some((pattern) => new Bun.Glob(pattern).match(relative))) continue;
    const path = `${root.path}/${relative.replaceAll("\\", "/")}`;
    const bytes = Bun.file(`${source}/${path}`).size;
    const group = root.path === "chrome/browser/resources" && /^(chromeos|ash)\//.test(relative)
      ? "chromeos-ash-ui"
      : root.group;
    records.push({ path, group, extension: extensionOf(path), bytes });
    groupCounts[group] = (groupCounts[group] ?? 0) + 1;
    files++;
  }
  rootStats.push({ ...root, files });
}

const extensionCounts: Record<string, number> = {};
let totalBytes = 0;
for (const record of records) {
  extensionCounts[record.extension] = (extensionCounts[record.extension] ?? 0) + 1;
  totalBytes += record.bytes;
}
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceRepository: "https://chromium.googlesource.com/chromium/src",
  sourceRevision: await getGit(["rev-parse", "HEAD"]),
  sourceBranch: await getGit(["branch", "--show-current"]),
  sourcePathRecorded: false,
  crawler: "YOLO-Web Bun filesystem crawler",
  scope: roots,
  exclusions: [".git", "out", "gen", "node_modules", "target", ".cache"],
  totals: { files: records.length, sourceBytes: totalBytes, groups: groupCounts, extensions: extensionCounts },
  roots: rootStats,
  files: records,
};

const output = process.env.CHROMIUM_UI_CRAWL_OUTPUT ?? "engines/chromium-ui-crawl.json";
await Bun.write(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, revision: report.sourceRevision, totals: report.totals, roots: rootStats }, null, 2));
