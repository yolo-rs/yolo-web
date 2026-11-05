// SPDX-License-Identifier: Apache-2.0
/**
 * Runs the scripted E2E (deterministic model stub, no network) in headless and
 * GUI modes and writes dist/agent-latency.json.
 *
 *   bun run scripts/e2e.ts [modes=headless,gui] [runs=3]
 *
 * Browser: YOLO_CHROMIUM (yolo-chromium launcher), else CHROME_PATH, else a
 * system Chromium-family install.
 */
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type ScenarioReport, runScenario } from "../src/e2e.ts";

const root = resolve(import.meta.dir, "..");
const executable = Bun.env.YOLO_CHROMIUM ?? Bun.env.CHROME_PATH;
const modes = (Bun.argv[2] ?? "headless,gui").split(",") as (
  "headless" | "gui"
)[];
const runs = Number(Bun.argv[3] ?? 3);
const median = (values: number[]): number | null =>
  values.length
    ? ([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? null)
    : null;

const reports: ScenarioReport[] = [];
const aggregate: Record<string, Record<string, number | null>> = {};
for (const mode of modes) {
  const modeReports: ScenarioReport[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      modeReports.push(await runScenario(mode, { executable }));
    } catch (error) {
      console.error(
        `${mode} run ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  }
  reports.push(...modeReports);
  const ok = modeReports.filter((r) => r.run.stopped === "done");
  aggregate[mode] = {
    runs: modeReports.length,
    succeeded: ok.length,
    medianTotalMs: median(ok.map((r) => r.run.totalMs)),
    medianBatchExecMs: median(ok.map((r) => r.summary.medianExecMs)),
    medianObserveToActMs: median(
      ok.flatMap((r) =>
        r.summary.medianObserveToActMs === undefined
          ? []
          : [r.summary.medianObserveToActMs],
      ),
    ),
    medianActToObserveMs: median(
      ok.flatMap((r) =>
        r.summary.medianActToObserveMs === undefined
          ? []
          : [r.summary.medianActToObserveMs],
      ),
    ),
    medianOverlapSavedMs: median(ok.map((r) => r.summary.overlapSavedMs)),
  };
}
await mkdir(join(root, "dist"), { recursive: true });
const out = join(root, "dist", "agent-latency.json");
await Bun.write(
  out,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      host: `${process.platform}-${process.arch}`,
      bun: Bun.version,
      model: "scripted stub (callDelayMs=40, tailDelayMs=80); no network",
      note: "observeToAct includes the stub's 40 ms generation delay; overlapSaved is execution time hidden behind model generation",
      aggregate,
      reports,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(aggregate, null, 2));
console.log(`wrote ${out}`);
