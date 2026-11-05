// SPDX-License-Identifier: Apache-2.0
/**
 * Builds the unpacked MV3 extension into dist/extension with Bun.build:
 * ES module bundles for the service worker and pages, IIFE bundles for the
 * content scripts, generated entry documents, copied manifest.
 */
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const DIST = join(ROOT, "dist", "extension");

const MODULES = {
  "service-worker": "extension/service-worker.ts",
  offscreen: "extension/offscreen.ts",
  sidepanel: "extension/sidepanel.ts",
} as const;
const CONTENT = {
  "webmcp-main": "extension/webmcp-main.ts",
  "webmcp-relay": "extension/webmcp-relay.ts",
} as const;

const CSS = `:root{color-scheme:light dark;font:13px system-ui,sans-serif}body{margin:0;padding:12px;display:grid;gap:8px}
h1{font-size:15px;margin:0}label{display:grid;gap:2px}textarea,input[type=text],input[type=password],select{width:100%;box-sizing:border-box}
.row{display:flex;gap:8px;align-items:center}#log{display:grid;gap:2px;max-height:50vh;overflow:auto;font-family:ui-monospace,monospace;font-size:12px}
.err{color:#b3261e}.warn{color:#8a5a00}.final{font-weight:600}.approval{display:flex;gap:6px;align-items:center;padding:6px;border:1px solid currentColor}
.note{opacity:.7}pre{overflow:auto;max-height:30vh;font-size:11px}`;

const page = (title: string, script: string, css = false) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${css ? '<link rel="stylesheet" href="sidepanel.css">' : ""}</head><body><script type="module" src="${script}"></script></body></html>`;

export async function buildExtension(outDir: string = DIST): Promise<string[]> {
  const manifest = (await Bun.file(
    join(ROOT, "extension", "manifest.json"),
  ).json()) as { version: string };
  const pkg = (await Bun.file(join(ROOT, "package.json")).json()) as {
    version: string;
  };
  if (manifest.version !== pkg.version)
    throw new Error(
      `manifest version ${manifest.version} != package version ${pkg.version}`,
    );
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files: string[] = [];
  const run = async (
    entries: Record<string, string>,
    format: "esm" | "iife",
  ) => {
    for (const [name, entry] of Object.entries(entries)) {
      const result = await Bun.build({
        entrypoints: [join(ROOT, entry)],
        target: "browser",
        format,
        minify: false,
        sourcemap: "none",
      });
      if (!result.success)
        throw new Error(
          `build failed for ${entry}:\n${result.logs.map(String).join("\n")}`,
        );
      const out = join(outDir, `${name}.js`);
      await Bun.write(out, await (result.outputs[0] as Blob).text());
      files.push(out);
    }
  };
  await run(MODULES, "esm");
  await run(CONTENT, "iife");

  const writes: [string, string][] = [
    ["offscreen.html", page("YOLO Agent offscreen", "offscreen.js")],
    ["sidepanel.html", page("YOLO Agent", "sidepanel.js", true)],
    ["sidepanel.css", CSS],
    ["manifest.json", `${JSON.stringify(manifest, null, 2)}\n`],
  ];
  const sourceManifest = await Bun.file(
    join(ROOT, "extension", "manifest.json"),
  ).text();
  for (const [name, body] of writes) {
    const out = join(outDir, name);
    await Bun.write(out, name === "manifest.json" ? sourceManifest : body);
    files.push(out);
  }
  return files;
}

if (import.meta.main) {
  const files = await buildExtension();
  let total = 0;
  for (const f of files) total += Bun.file(f).size;
  console.log(
    `built ${files.length} files, ${(total / 1024).toFixed(1)} KiB -> ${DIST}`,
  );
}
