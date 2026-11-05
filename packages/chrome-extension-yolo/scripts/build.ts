// SPDX-License-Identifier: Apache-2.0
/**
 * Builds the unpacked extension into `dist/`: bundles each entry with
 * `Bun.build` (`target: "browser"`), generates the two entry documents,
 * copies `manifest.json` and the self-hosted font with its license, and
 * renders the icons.
 */
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { buildExtension } from "../../yolo-agent/scripts/build-extension.ts";
import { entryDocument } from "./html.ts";
import { writeIcons } from "./icons.ts";

export const PACKAGE_ROOT = resolve(import.meta.dir, "..");
export const DIST_DIR = join(PACKAGE_ROOT, "dist");
export const MANIFEST_PATH = join(PACKAGE_ROOT, "manifest.json");
/** Copied verbatim into `dist/`: the font and its OFL license. */
export const ASSETS_DIR = join(PACKAGE_ROOT, "assets");

/** Bundle entry points, keyed by output base name. */
export const ENTRY_SOURCES = {
  newtab: "src/newtab.tsx",
  popup: "src/popup.tsx",
  "service-worker": "src/service-worker.ts",
} as const;

/** Agent files copied from the yolo-agent extension build (the service worker is bundled with ours). */
export const AGENT_FILES = [
  "offscreen.html",
  "offscreen.js",
  "sidepanel.html",
  "sidepanel.js",
  "sidepanel.css",
  "webmcp-main.js",
  "webmcp-relay.js",
] as const;

const AGENT_SERVICE_WORKER = resolve(
  PACKAGE_ROOT,
  "..",
  "yolo-agent",
  "extension",
  "service-worker.ts",
);

/** Entries that also get an HTML document. */
export const PAGES = [
  { name: "newtab", title: "New tab" },
  { name: "popup", title: "YOLO-Web" },
] as const;

export interface BuildResult {
  readonly outDir: string;
  /** Absolute paths of every file written. */
  readonly files: readonly string[];
}

export async function readManifest(): Promise<{ version: string }> {
  return (await Bun.file(MANIFEST_PATH).json()) as { version: string };
}

export async function build(outDir: string = DIST_DIR): Promise<BuildResult> {
  const manifest = await readManifest();
  const pkg = (await Bun.file(join(PACKAGE_ROOT, "package.json")).json()) as {
    version: string;
  };
  if (manifest.version !== pkg.version) {
    throw new Error(
      `manifest.json version ${manifest.version} does not match package.json version ${pkg.version}`,
    );
  }

  await rm(outDir, { recursive: true, force: true });

  // One service worker serves the extension: the theme/first-run worker and
  // the yolo-agent driver are bundled from a generated entry so neither
  // package type-checks the other's chrome typings.
  const scratch = await mkdtemp(join(tmpdir(), "yolo-ext-"));
  const swEntry = join(scratch, "service-worker.ts");
  const slash = (path: string) => JSON.stringify(path.replaceAll("\\", "/"));
  await Bun.write(
    swEntry,
    [
      `import * as theme from ${slash(join(PACKAGE_ROOT, ENTRY_SOURCES["service-worker"]))};`,
      `import * as agent from ${slash(AGENT_SERVICE_WORKER)};`,
      // Referenced so the packages' "sideEffects": false does not drop the
      // workers' top-level listener registration.
      "(globalThis as { __yoloModules?: unknown }).__yoloModules = [theme, agent];",
      "",
    ].join(String.fromCharCode(10)),
  );
  const entrypoints = Object.entries(ENTRY_SOURCES).map(([name, source]) =>
    name === "service-worker" ? swEntry : join(PACKAGE_ROOT, source),
  );

  const result = await Bun.build({
    entrypoints,
    outdir: outDir,
    target: "browser",
    format: "esm",
    naming: "[name].[ext]",
    sourcemap: "none",
    minify: false,
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(String(log));
    }
    throw new Error("bundling failed");
  }

  await rm(scratch, { recursive: true, force: true });
  const files: string[] = result.outputs.map((output) => output.path);
  const agentDir = await mkdtemp(join(tmpdir(), "yolo-agent-ext-"));
  try {
    await buildExtension(agentDir);
    await mkdir(outDir, { recursive: true });
    for (const name of AGENT_FILES) {
      const target = join(outDir, name);
      await Bun.write(target, Bun.file(join(agentDir, name)));
      files.push(target);
    }
  } finally {
    await rm(agentDir, { recursive: true, force: true });
  }
  for (const page of PAGES) {
    const path = join(outDir, `${page.name}.html`);
    await Bun.write(
      path,
      entryDocument({ title: page.title, script: `${page.name}.js` }),
    );
    files.push(path);
  }
  const manifestOut = join(outDir, "manifest.json");
  await Bun.write(manifestOut, Bun.file(MANIFEST_PATH));
  files.push(manifestOut);
  files.push(...(await writeIcons(join(outDir, "icons"))));
  for (const entry of await readdir(ASSETS_DIR, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) {
      continue;
    }
    const source = join(entry.parentPath, entry.name);
    const target = join(outDir, relative(ASSETS_DIR, source));
    await Bun.write(target, Bun.file(source));
    files.push(target);
  }
  return { outDir, files };
}

if (import.meta.main) {
  const { outDir, files } = await build();
  console.log(
    `[chrome-extension-yolo] wrote ${files.length} files to ${outDir}`,
  );
  for (const file of files) {
    console.log(`  ${relative(outDir, file).replace(/\\/g, "/")}`);
  }
}
