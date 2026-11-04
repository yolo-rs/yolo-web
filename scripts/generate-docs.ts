#!/usr/bin/env bun
/**
 * @yolo-web/docs-generator
 * Automated documentation generator, manifest compiler & wiki indexer
 * Follows Google Documentation standards and Bun native markdown tooling.
 */

import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

interface DocEntry {
  title: string;
  path: string;
  category: string;
  sizeBytes: number;
  lastModified: string;
}

async function scanDocs(dir: string, baseDir: string): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);
    if (file.isDirectory() && file.name !== "node_modules" && file.name !== ".git") {
      const sub = await scanDocs(fullPath, baseDir);
      entries.push(...sub);
    } else if (file.isFile() && (file.name.endsWith(".md") || file.name.endsWith(".mdx"))) {
      const fileStat = await stat(fullPath);
      const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");
      const title = file.name.replace(/\.(md|mdx)$/, "").replace(/_/g, " ");
      const category = relPath.includes("/") ? relPath.split("/")[0] : "root";

      entries.push({
        title,
        path: relPath,
        category,
        sizeBytes: fileStat.size,
        lastModified: fileStat.mtime.toISOString(),
      });
    }
  }

  return entries;
}

async function main() {
  const rootDir = process.cwd();
  console.log(`[docs-generator] Scanning documentation across ${rootDir}...`);

  const docs = await scanDocs(rootDir, rootDir);
  const manifest = {
    generatedAt: new Date().toISOString(),
    standard: "Google Open Source & Chromium Documentation Guidelines",
    totalDocuments: docs.length,
    documents: docs,
  };

  const outputPath = join(rootDir, "docs", "manifest.json");
  await Bun.write(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`[docs-generator] Wrote ${docs.length} document entries to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
