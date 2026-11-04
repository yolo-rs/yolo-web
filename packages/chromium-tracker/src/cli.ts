#!/usr/bin/env bun
/**
 * CLI command runner for Chromium tracking, sync, and patch inspection
 */
import { ChromiumTrackingEngine } from "./index";

const tracker = new ChromiumTrackingEngine();
const command = process.argv[2] || "status";

async function main() {
  if (command === "status" || command === "track") {
    console.log("Fetching live upstream Chromium, CEF, Brave, Helium & Depot Tools matrix...");
    const report = await tracker.generateStatusReport();
    console.log(JSON.stringify(report, null, 2));
  } else if (command === "patches" || command === "patch") {
    const patches = tracker.getManagedPatches();
    console.log(JSON.stringify(patches, null, 2));
  } else if (command === "channels") {
    const channels = await tracker.fetchChromiumChannels();
    console.log(JSON.stringify(channels, null, 2));
  } else if (command === "cef") {
    const cef = await tracker.fetchLatestCef();
    console.log(JSON.stringify(cef, null, 2));
  } else if (command === "depot-tools") {
    const dt = await tracker.fetchDepotToolsStatus();
    console.log(JSON.stringify(dt, null, 2));
  } else {
    console.log(`Usage: bun run packages/chromium-tracker/src/cli.ts [status|patches|channels|cef|depot-tools]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
