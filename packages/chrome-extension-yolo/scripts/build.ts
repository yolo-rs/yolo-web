// SPDX-License-Identifier: Apache-2.0
/**
 * Builds the unpacked extension into `dist/`: bundles each entry with
 * `Bun.build` (`target: "browser"`), generates the two entry documents,
 * copies `manifest.json`, and renders the icons.
 */
import { rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { entryDocument } from "./html.ts";
import { writeIcons } from "./icons.ts";

export const PACKAGE_ROOT = resolve(import.meta.dir, "..");
export const DIST_DIR = join(PACKAGE_ROOT, "dist");
export const MANIFEST_PATH = join(PACKAGE_ROOT, "manifest.json");

/** Bundle entry points, keyed by output base name. */
export const ENTRY_SOURCES = {
  newtab: "src/newtab.tsx",
  popup: "src/popup.tsx",
  "service-worker": "src/service-worker.ts",
} as const;

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

  const result = await Bun.build({
    entrypoints: Object.values(ENTRY_SOURCES).map((source) =>
      join(PACKAGE_ROOT, source),
    ),
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

  const files: string[] = result.outputs.map((output) => output.path);
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
