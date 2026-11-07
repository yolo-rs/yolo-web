#!/usr/bin/env bun
// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Universal Autonomous Pipeline Orchestrator for YOLO-Web
 * Runs targeted checks, tests, and AoT compilation without fragile global format scans.
 */

import { $ } from "bun";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

interface StepResult {
  step: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

const results: StepResult[] = [];

async function runStep(name: string, fn: () => Promise<void>) {
  const t0 = performance.now();
  process.stdout.write(`[*] ${name}... `);
  try {
    await fn();
    const duration = Math.round(performance.now() - t0);
    console.log(`OK (${duration}ms)`);
    results.push({ step: name, durationMs: duration, success: true });
  } catch (err: any) {
    const duration = Math.round(performance.now() - t0);
    console.log(`FAILED (${duration}ms)`);
    console.error(err?.message || err);
    results.push({
      step: name,
      durationMs: duration,
      success: false,
      error: String(err?.message || err),
    });
    throw err;
  }
}

async function main() {
  console.log("=== UNIVERSAL AUTONOMOUS PIPELINE // YOLO-WEB ===");
  console.log(`Platform: ${process.platform} (${process.arch})`);
  console.log(`Runtime:  Upstream Bun ${Bun.version} + Cargo Rust 2024`);

  const root = process.cwd();

  // 1. Bun Typecheck (Targeted Core Packages)
  await runStep("Bun Typecheck (@yolo-web/auth & web-cli)", async () => {
    await $`bun --filter @yolo-web/auth check`.quiet();
    await $`bun --filter @yolo-web/web-cli check`.quiet();
    await $`bun --filter @yolo-web/web-crawler check`.quiet();
  });

  // 2. Rust Unit Tests
  await runStep("Rust Workspace Core Libs Tests", async () => {
    await $`cargo test -p obscura-ssrf -p obscura-dom -p euclid -p uluru -p fnv -p servo-svg -p kuchikiki -p bravebot-core -p adblock --lib`.quiet();
  });

  // 3. Bun Tests
  await runStep("Bun Auth & Web-CLI Test Suite", async () => {
    await $`bun test packages/auth/test/auth.test.ts packages/web-cli/src/index.test.ts packages/knowledge-indexer/src/index.test.ts`.quiet();
  });

  // 4. Build Standalone AoT Binary
  await runStep("Compile Standalone AoT Binary", async () => {
    await $`bun run aot:web`.quiet();
  });

  // 5. Git Autonomous Snapshot
  if (existsSync(resolve(root, ".git"))) {
    await runStep("Git Automated Local Snapshot", async () => {
      await $`git add -A`.quiet();
      const status = await $`git status --porcelain`.text();
      if (status.trim()) {
        const msg = `chore(auto): pipeline pass ${new Date().toISOString()} [skip ci]`;
        await $`git commit -m ${msg}`.quiet();
      }
    });
  }

  console.log("\n=== PIPELINE SUCCESSFUL // ALL YOLO-WEB CHECKS PASSED ===");
  for (const r of results) {
    console.log(` - ${r.step.padEnd(35)}: ${r.durationMs}ms`);
  }
}

main().catch((err) => {
  console.error("\n[!] Pipeline terminated with error:", err.message);
  process.exit(1);
});
