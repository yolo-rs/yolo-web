#!/usr/bin/env bun
/**
 * CLI command runner for Chromium tracking, sync, and patch inspection
 */
import { join } from "node:path";
import { ChromiumTrackingEngine, type CefPlatform } from "./index";
import {
  cefPlatformFromHost,
  checkCefCrateAgainstCargo,
  readCefLock,
  validateCefLock,
} from "./cef-lock";
import {
  ENGINE_MANAGER_REGISTRY,
  fetchChromeForTestingChannels,
  findEngine,
  inspectEngine,
  packageCommand,
  packageCommandInvocations,
  sourceCheckoutCommand,
  type PackageManager,
} from "./engine-manager";
import { captureChromiumSourceLock } from "./upstream-lock";
import {
  buildChromiumTarget,
  generateChromiumBuild,
  inspectChromiumWorkspace,
  syncChromiumWorkspace,
} from "./chromium-workflow";
import { runUpstreamTool } from "./upstream-tools";

const tracker = new ChromiumTrackingEngine();
const command = process.argv[2] || "status";
const CEF_PLATFORMS: CefPlatform[] = [
  "windows32",
  "windows64",
  "windowsarm64",
  "linux32",
  "linux64",
  "linuxarm",
  "linuxarm64",
  "macosx64",
  "macosarm64",
];
/** Monorepo root (`packages/chromium-tracker/src` -> `../../..`) for default receipt and manifest paths. */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

async function main() {
  if (command === "engines") {
    await engines(process.argv.slice(3));
    return;
  }
  if (command === "status" || command === "track") {
    console.log(
      "Fetching live upstream Chromium, CEF, Brave, Helium & Depot Tools matrix...",
    );
    const report = await tracker.generateStatusReport();
    console.log(JSON.stringify(report, null, 2));
  } else if (command === "patches" || command === "patch") {
    const patches = tracker.getPatchProposals();
    console.log(JSON.stringify(patches, null, 2));
  } else if (command === "channels") {
    const channels = await tracker.fetchChromiumChannels();
    console.log(JSON.stringify(channels, null, 2));
  } else if (command === "cef") {
    if (process.argv[3] === "lock") {
      await cefLock(process.argv.slice(4));
      return;
    }
    const platformIndex = process.argv.indexOf("--platform");
    const platformValue =
      platformIndex >= 0 ? process.argv[platformIndex + 1] : undefined;
    if (
      platformIndex >= 0 &&
      (!platformValue || !isCefPlatform(platformValue))
    ) {
      throw new Error(`Specify --platform ${CEF_PLATFORMS.join("|")}.`);
    }
    const cef = await tracker.fetchLatestCef(
      platformValue as CefPlatform | undefined,
    );
    console.log(JSON.stringify(cef, null, 2));
  } else if (command === "depot-tools") {
    const dt = await tracker.fetchDepotToolsStatus();
    console.log(JSON.stringify(dt, null, 2));
  } else {
    console.log(
      `Usage: bun run packages/chromium-tracker/src/cli.ts [status|patches|channels|cef [--platform <id>]|cef lock [path] [--online] [--platform <id>] [--cargo <Cargo.toml>] [--strict] [--json]|depot-tools|engines]`,
    );
  }
}

function isCefPlatform(value: string): value is CefPlatform {
  return (CEF_PLATFORMS as string[]).includes(value);
}

/**
 * `cef lock [path] [--online] [--platform <id>] [--cargo <Cargo.toml>] [--strict] [--json]`
 * Validates a `crates/yolo-chromium` smoke receipt (default `engines/cef.lock.json`).
 * Offline by default; `--online` also compares it with the Spotify CEF index.
 * Exits non-zero on any error finding (or any warning with `--strict`).
 */
async function cefLock(args: string[]) {
  const usage =
    "Usage: cef lock [path] [--online] [--platform <id>] [--cargo <Cargo.toml>] [--strict] [--json]";
  let lockPath: string | undefined;
  let platform: CefPlatform | undefined;
  let cargoPath: string | undefined;
  let online = false;
  let json = false;
  let strict = false;
  const queue = [...args];
  while (queue.length > 0) {
    const arg = queue.shift()!;
    if (arg === "--online") online = true;
    else if (arg === "--json") json = true;
    else if (arg === "--strict") strict = true;
    else if (arg === "--platform" || arg === "--cargo") {
      const value = queue.shift();
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} requires a value. ${usage}`);
      if (arg === "--cargo") cargoPath = value;
      else if (isCefPlatform(value)) platform = value;
      else throw new Error(`Specify --platform ${CEF_PLATFORMS.join("|")}.`);
    } else if (arg.startsWith("--"))
      throw new Error(`Unknown option ${arg}. ${usage}`);
    else if (lockPath === undefined) lockPath = arg;
    else throw new Error(`Unexpected argument ${arg}. ${usage}`);
  }

  const receiptPath = lockPath ?? join(REPO_ROOT, "engines", "cef.lock.json");
  const lock = await readCefLock(receiptPath);
  const resolvedPlatform = platform ?? cefPlatformFromHost(lock.host);
  const cefIndex = online ? await tracker.fetchCefIndex() : undefined;
  const findings = validateCefLock(lock, {
    cefIndex,
    platform: resolvedPlatform,
  });

  // Cross-check the receipt against the crate manifest when it is available.
  const manifestPath =
    cargoPath ?? join(REPO_ROOT, "crates", "yolo-chromium", "Cargo.toml");
  const manifest = Bun.file(manifestPath);
  const manifestExists = await manifest.exists();
  if (cargoPath && !manifestExists)
    throw new Error(`Cargo manifest not found at ${cargoPath}.`);
  if (manifestExists)
    findings.push(
      ...checkCefCrateAgainstCargo(lock, await manifest.text(), manifestPath),
    );

  const errors = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const warnings = findings.length - errors;
  const ok = errors === 0 && (!strict || warnings === 0);
  const indexSource = online ? "spotify-cdn" : "offline";
  if (json) {
    console.log(
      JSON.stringify(
        {
          receipt: receiptPath,
          platform: resolvedPlatform ?? null,
          index: indexSource,
          cefVersion: lock.build.cef.version,
          chromiumVersion: lock.build.cef.chromiumVersion,
          cefCrate: lock.build.cefCrate,
          errors,
          warnings,
          ok,
          findings,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`CEF lock receipt ${receiptPath}`);
    console.log(
      `CEF ${lock.build.cef.version} (Chromium ${lock.build.cef.chromiumVersion}) via cef crate ${lock.build.cefCrate}; platform ${resolvedPlatform ?? "unknown"}; index ${indexSource}${online ? "" : " (pass --online to compare with the published builds)"}`,
    );
    if (findings.length === 0) console.log("No findings.");
    else console.table(findings);
    console.log(
      `${errors} error(s), ${warnings} warning(s)${ok ? "" : " - FAILED"}`,
    );
  }
  if (!ok) process.exitCode = 1;
}

async function engines(args: string[]) {
  const [sub = "list", id, ...rest] = args;
  if (sub === "list") {
    console.table(
      ENGINE_MANAGER_REGISTRY.map(({ id, name, family, channel, kind }) => ({
        id,
        name,
        family,
        channel,
        kind,
      })),
    );
    return;
  }
  if (sub === "versions" || sub === "cft") {
    console.log(JSON.stringify(await fetchChromeForTestingChannels(), null, 2));
    return;
  }
  if (sub === "status") {
    const entries = id ? [findEngine(id)] : ENGINE_MANAGER_REGISTRY;
    const status = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        local: await inspectEngine(entry),
      })),
    );
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  if (sub === "chromium") {
    await chromiumWorkflow(id, rest);
    return;
  }
  if (sub === "lock") {
    const checkout = id ?? process.env.CHROMIUM_ROOT;
    if (!checkout)
      throw new Error(
        "Usage: set CHROMIUM_ROOT or pass it to engines lock <chromium-root> [--out <out/Default>] [--write <file>]",
      );
    const outAt = rest.indexOf("--out");
    const outputDirectory = outAt >= 0 ? rest[outAt + 1] : undefined;
    if (outAt >= 0 && !outputDirectory)
      throw new Error("--out requires a GN output directory relative to src/.");
    const lock = await captureChromiumSourceLock(checkout, { outputDirectory });
    const writeAt = rest.indexOf("--write");
    if (writeAt >= 0) {
      const destination = rest[writeAt + 1];
      if (!destination) throw new Error("--write requires a file path.");
      await Bun.write(destination, `${JSON.stringify(lock, null, 2)}\n`);
      console.log(`Captured Chromium source lock at ${destination}`);
    } else {
      console.log(JSON.stringify(lock, null, 2));
    }
    return;
  }
  if (sub === "source") {
    if (!id)
      throw new Error("Usage: engines source <id> <destination> [--execute]");
    const entry = findEngine(id);
    const destination = rest.find((arg) => !arg.startsWith("--"));
    if (!destination) throw new Error("A destination path is required.");
    sourceCheckoutCommand(entry, destination); // validates binary/source type and Chromium's depot_tools-only rule
    await runOrPlan(rest.includes("--execute"), Bun.which("git") ?? "git", [
      "clone",
      ...(entry.branch ? ["--branch", entry.branch, "--single-branch"] : []),
      entry.repo!,
      destination,
    ]);
    return;
  }
  if (sub === "install" || sub === "update") {
    if (!id)
      throw new Error(
        `Usage: engines ${sub} <id> --manager <winget|apt|pacman|flatpak|docker> [--execute]`,
      );
    const entry = findEngine(id);
    const managerIndex = rest.indexOf("--manager");
    const manager = rest[managerIndex + 1] as PackageManager | undefined;
    if (
      !manager ||
      !["winget", "apt", "pacman", "flatpak", "docker"].includes(manager)
    )
      throw new Error("Specify a supported --manager.");
    const invocations = packageCommandInvocations(entry, manager, sub);
    const commandText = packageCommand(entry, manager, sub);
    if (!commandText || !invocations)
      throw new Error(
        `${id} has no verified ${manager} package mapping; no command was run.`,
      );
    console.log(
      `Provider trust: ${entry.packages?.[manager]?.trust}. ${entry.packages?.[manager]?.note ?? ""}`,
    );
    const execute = rest.includes("--execute");
    if (!execute) {
      console.log(`Plan only (add --execute to run): ${commandText}`);
      return;
    }
    for (const invocation of invocations)
      await runOrPlan(true, invocation.program, invocation.args);
    return;
  }
  console.log(
    "Usage: engines [list|versions|status [id]|chromium [status|sync|gen|build|lock]|lock [chromium-root] [--out <out/Default>] [--write <file>]|install <id>|update <id>|source <id> <destination>]",
  );
}

async function chromiumWorkflow(action: string | undefined, rawArgs: string[]) {
  const rootIndex = rawArgs.indexOf("--root");
  const root =
    rootIndex >= 0 ? rawArgs[rootIndex + 1] : process.env.CHROMIUM_ROOT;
  if (!root)
    throw new Error("Set CHROMIUM_ROOT or pass --root <Chromium workspace>.");
  const args =
    rootIndex >= 0
      ? rawArgs.filter(
          (value, index) => index !== rootIndex && index !== rootIndex + 1,
        )
      : rawArgs;
  if (rootIndex >= 0 && !rawArgs[rootIndex + 1])
    throw new Error("--root requires a workspace path.");

  if (action === "status") {
    console.log(JSON.stringify(await inspectChromiumWorkspace(root), null, 2));
    return;
  }
  if (action === "sync") {
    await syncChromiumWorkspace(root, args.includes("--nohooks"));
    return;
  }
  if (action === "gen") {
    const output = args.find((value) => !value.startsWith("--"));
    const argsAt = args.findIndex((value) => value === "--args");
    const inlineArgs = args
      .find((value) => value.startsWith("--args="))
      ?.slice("--args=".length);
    const gnArgs = inlineArgs ?? (argsAt >= 0 ? args[argsAt + 1] : undefined);
    if (!output || gnArgs === undefined)
      throw new Error(
        "Usage: engines chromium gen <out/Default> --args '<GN args>' [--root <path>]",
      );
    await generateChromiumBuild(root, output, gnArgs);
    return;
  }
  if (action === "build") {
    const positionals = args.filter((value) => !value.startsWith("--"));
    const output = positionals[0];
    const targetAt = args.indexOf("--target");
    const target =
      targetAt >= 0 ? args[targetAt + 1] : (positionals[1] ?? "chrome");
    if (!output)
      throw new Error(
        "Usage: engines chromium build <out/Default> [target] [--root <path>]",
      );
    if (targetAt >= 0 && !target)
      throw new Error("--target requires a GN/Ninja target name.");
    await buildChromiumTarget(root, output, target);
    return;
  }
  if (action === "lock") {
    const outAt = args.indexOf("--out");
    const outputDirectory = outAt >= 0 ? args[outAt + 1] : undefined;
    const lock = await captureChromiumSourceLock(root, { outputDirectory });
    const writeAt = args.indexOf("--write");
    if (writeAt >= 0) {
      const destination = args[writeAt + 1];
      if (!destination) throw new Error("--write requires a lock file path.");
      await Bun.write(destination, `${JSON.stringify(lock, null, 2)}\n`);
      console.log(`Captured Chromium source lock at ${destination}`);
    } else {
      console.log(JSON.stringify(lock, null, 2));
    }
    return;
  }
  throw new Error(
    "Usage: engines chromium [status|sync [--nohooks]|gen <out/Default> --args '<GN args>'|build <out/Default> [target]|lock] [--root <path>]",
  );
}

async function runOrPlan(execute: boolean, program: string, args: string[]) {
  if (!execute) {
    console.log(
      `Plan only (add --execute to run):\n${JSON.stringify({ program, args }, null, 2)}`,
    );
    return;
  }
  await runUpstreamTool(program, args, process.cwd(), "inherit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
