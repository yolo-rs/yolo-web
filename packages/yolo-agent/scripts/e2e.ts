// SPDX-License-Identifier: Apache-2.0
/** Runs the scripted E2E in headless and GUI modes and writes dist/agent-latency.json. */
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type ScenarioReport, runScenario } from "../src/e2e.ts";

const root = resolve(import.meta.dir, "..");
const executable = Bun.env.YOLO_CHROMIUM ?? Bun.env.CHROME_PATH;
const modes = (Bun.argv[2] ?? "headless,gui").split(",") as (
  "headless" | "gui"
)[];
const reports: ScenarioReport[] = [];
for (const mode of modes) {
  try {
    reports.push(await runScenario(mode, { executable }));
  } catch (error) {
    console.error(`${mode}: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
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
      model: "scripted (no network)",
      reports,
    },
    null,
    2,
  ),
);
for (const r of reports) {
  console.log(
    `${r.mode}: ${r.run.stopped} turns=${r.run.turns} total=${r.run.totalMs}ms medianExec=${r.summary.medianExecMs}ms observeToAct=${r.summary.medianObserveToActMs}ms prefetchHits=${r.summary.prefetchHits} result=${JSON.stringify(r.verified.resultText)}`,
  );
}
console.log(`wrote ${out}`);
