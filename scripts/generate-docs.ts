#!/usr/bin/env bun
/**
 * @yolo-web/docs-generator
 * Automated documentation generator, manifest compiler & wiki indexer
 * Scans repository Markdown and MDX with Bun-native filesystem APIs.
 */

interface DocEntry {
  title: string;
  path: string;
  category: string;
  sizeBytes: number;
  lastModified: string;
}

async function scanDocs(rootDir: string): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  const ignoredDirectories = new Set([
    ".git",
    "node_modules",
    "dist",
    "target",
    "out",
  ]);
  const glob = new Bun.Glob("**/*");

  for await (const filePath of glob.scan({ cwd: rootDir, onlyFiles: true })) {
    const relPath = filePath.replace(/\\/g, "/");
    if (relPath.split("/").some((part) => ignoredDirectories.has(part)))
      continue;
    if (!/\.mdx?$/i.test(relPath)) continue;

    const pathParts = relPath.split("/");
    const fileName = pathParts.at(-1)!;
    const title = fileName.replace(/\.mdx?$/i, "").replace(/_/g, " ");
    const category = pathParts.length > 1 ? pathParts[0] : "root";
    const file = Bun.file(`${rootDir}/${relPath}`);
    const metadata = await file.stat();

    entries.push({
      title,
      path: relPath,
      category,
      sizeBytes: metadata.size,
      lastModified: metadata.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  return entries;
}

async function main() {
  const rootDir = process.cwd();
  console.log(`[docs-generator] Scanning documentation across ${rootDir}...`);

  const docs = await scanDocs(rootDir);
  const manifest = {
    generatedAt: new Date().toISOString(),
    standard: "YOLO-Web MDX and Markdown catalog",
    totalDocuments: docs.length,
    documents: docs,
  };

  const outputPath = `${rootDir.replace(/[\\/]$/, "")}/docs/manifest.json`;
  await Bun.write(outputPath, JSON.stringify(manifest, null, 2));
  console.log(
    `[docs-generator] Wrote ${docs.length} document entries to ${outputPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
