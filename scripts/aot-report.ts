#!/usr/bin/env bun
/**
 * Builds every AOT target with `bun build --compile` and writes
 * dist/aot-report.json: binary size, build time, cold-start (N runs of
 * `--help`), and peak RSS. Pure Bun.spawn; no external tools.
 *
 *   bun scripts/aot-report.ts                 # shipped flags (AOT_FLAGS)
 *   bun scripts/aot-report.ts --matrix        # also every experimental variant
 *   bun scripts/aot-report.ts --runs 20 --out dist/aot-report.json
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface AotTarget {
  name: string;
  entry: string;
  outfile: string;
}

export const TARGETS: AotTarget[] = [
  { name: "web", entry: "packages/web-cli/src/index.ts", outfile: "web" },
  {
    name: "web-mcp",
    entry: "packages/web-mcp/src/index.ts",
    outfile: "web-mcp",
  },
  {
    name: "human-browser",
    entry: "apps/human-browser/src/server.ts",
    outfile: "yolo-human-browser",
  },
  {
    name: "agent-runner",
    entry: "apps/ai-agent-runner/src/index.ts",
    outfile: "yolo-agent-runner",
  },
];

/** Flags shipped by the root `aot:*` scripts. Keep in sync with package.json. */
export const AOT_FLAGS = ["--compile", "--bytecode", "--minify"];

export const VARIANTS: Record<string, string[]> = {
  "compile-only": ["--compile"],
  shipped: AOT_FLAGS,
  "shipped+sourcemap": [...AOT_FLAGS, "--sourcemap=none"],
  "shipped+production": [...AOT_FLAGS, "--production"],
  "shipped+drop-console": [...AOT_FLAGS, "--drop=console"],
  "shipped+no-compile-autoload": [
    ...AOT_FLAGS,
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
  ],
  "shipped+splitting": [...AOT_FLAGS, "--splitting"],
  "shipped+no-autoload-all": [
    ...AOT_FLAGS,
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
    "--no-compile-autoload-tsconfig",
    "--no-compile-autoload-package-json",
  ],
  "shipped+bytecode-depth2": [...AOT_FLAGS, "--bytecode-depth=2"],
  "shipped+no-optimize-bytecode": [...AOT_FLAGS, "--no-optimize-bytecode"],
  "shipped+jit-policy-2": [...AOT_FLAGS, "--compile-jit-policy=2"],
  "shipped+jit-policy-0.5": [...AOT_FLAGS, "--compile-jit-policy=0.5"],
  "shipped+keep-names": [...AOT_FLAGS, "--keep-names"],
  "shipped+target-modern": [...AOT_FLAGS, "--target=bun-linux-x64-modern"],
  "shipped+target-baseline": [...AOT_FLAGS, "--target=bun-linux-x64-baseline"],
};

export interface Measurement {
  target: string;
  variant: string;
  flags: string[];
  ok: boolean;
  error?: string;
  sizeBytes?: number;
  buildMs?: number;
  coldStartMsMedian?: number;
  coldStartMsMin?: number;
  coldStartMsP95?: number;
  maxRssBytes?: number;
  helpExitCode?: number;
}

function arg(name: string, fallback: string): string {
  const i = Bun.argv.indexOf(`--${name}`);
  return i >= 0 && Bun.argv[i + 1] ? Bun.argv[i + 1]! : fallback;
}

async function run(cmd: string[]): Promise<{ code: number; stderr: string }> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stderr };
}

export async function measureStart(
  binary: string,
  runs: number,
): Promise<{
  median: number;
  min: number;
  p95: number;
  maxRss: number;
  exitCode: number;
}> {
  const times: number[] = [];
  let maxRss = 0;
  let exitCode = 0;
  // One warm-up run populates the page cache and is discarded.
  for (let i = 0; i < runs + 1; i++) {
    const t0 = performance.now();
    const proc = Bun.spawn([binary, "--help"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const code = await proc.exited;
    const dt = performance.now() - t0;
    if (code !== 0) exitCode = code;
    maxRss = Math.max(maxRss, proc.resourceUsage()?.maxRSS ?? 0);
    if (i > 0) times.push(dt);
  }
  times.sort((a, b) => a - b);
  const at = (q: number) =>
    times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
  return { median: at(0.5), min: times[0]!, p95: at(0.95), maxRss, exitCode };
}

export async function measure(
  target: AotTarget,
  variant: string,
  flags: string[],
  runs: number,
  distDir: string,
): Promise<Measurement> {
  const exe = process.platform === "win32" ? ".exe" : "";
  const outfile = join(
    distDir,
    `${target.outfile}.${variant.replace(/\W+/g, "_")}`,
  );
  const out: Measurement = { target: target.name, variant, flags, ok: false };
  const t0 = performance.now();
  const build = await run([
    process.execPath,
    "build",
    ...flags,
    target.entry,
    "--outfile",
    outfile,
  ]);
  out.buildMs = Math.round(performance.now() - t0);
  if (build.code !== 0) {
    out.error = build.stderr.trim().split("\n").slice(-3).join(" | ");
    return out;
  }
  const binary = outfile + exe;
  out.sizeBytes = Bun.file(binary).size;
  const start = await measureStart(binary, runs);
  out.coldStartMsMedian = +start.median.toFixed(1);
  out.coldStartMsMin = +start.min.toFixed(1);
  out.coldStartMsP95 = +start.p95.toFixed(1);
  out.maxRssBytes = start.maxRss;
  out.helpExitCode = start.exitCode;
  out.ok = start.exitCode === 0;
  return out;
}

if (import.meta.main) {
  const runs = Number(arg("runs", "20"));
  const outPath = arg("out", "dist/aot-report.json");
  const matrix = Bun.argv.includes("--matrix");
  const distDir = join("dist", "aot-tmp");
  mkdirSync(distDir, { recursive: true });
  const variants = matrix ? VARIANTS : { shipped: AOT_FLAGS };
  const results: Measurement[] = [];
  for (const target of TARGETS) {
    for (const [name, flags] of Object.entries(variants)) {
      const m = await measure(target, name, flags, runs, distDir);
      results.push(m);
      console.log(
        `${target.name.padEnd(14)} ${name.padEnd(28)} ${
          m.ok
            ? `${(m.sizeBytes! / 1048576).toFixed(1)} MiB  build ${m.buildMs}ms  start ${m.coldStartMsMedian}ms  rss ${(m.maxRssBytes! / 1048576).toFixed(0)} MiB`
            : `FAIL ${m.error ?? `exit ${m.helpExitCode}`}`
        }`,
      );
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    bun: Bun.version,
    platform: `${process.platform}-${process.arch}`,
    runs,
    results,
  };
  mkdirSync(join(outPath, ".."), { recursive: true });
  await Bun.write(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`wrote ${outPath}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
