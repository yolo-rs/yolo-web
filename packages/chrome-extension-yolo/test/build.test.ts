// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { join, relative } from "node:path";
import { ICON_SIZES, iconFileName } from "../scripts/icons.ts";
import { decodePng } from "../scripts/png.ts";
import { buildZip, readZip } from "../scripts/zip.ts";
import {
  BUILD_TIMEOUT_MS,
  DIST_DIR,
  PACKAGE_ROOT,
  ensureBuilt,
} from "./helpers.ts";

describe("build", () => {
  test(
    "writes every output file into dist",
    async () => {
      const { outDir, files } = await ensureBuilt();
      expect(outDir).toBe(DIST_DIR);
      const expected = [
        "manifest.json",
        "newtab.html",
        "newtab.js",
        "popup.html",
        "popup.js",
        "service-worker.js",
        ...ICON_SIZES.map((size) => join("icons", iconFileName(size))),
        join("fonts", "InstrumentSans-Variable.ttf"),
        join("fonts", "OFL.txt"),
      ];
      for (const name of expected) {
        expect(await Bun.file(join(DIST_DIR, name)).exists()).toBe(true);
      }
      expect(files.length).toBe(expected.length);
    },
    BUILD_TIMEOUT_MS,
  );

  test(
    "entry documents are a single root element plus the bundle",
    async () => {
      await ensureBuilt();
      for (const page of ["newtab", "popup"]) {
        const html = await Bun.file(join(DIST_DIR, `${page}.html`)).text();
        expect(html.match(/<div id="root"><\/div>/g)?.length).toBe(1);
        expect(html.match(/<script/g)?.length).toBe(1);
        expect(html).toContain(
          `<script type="module" src="${page}.js"></script>`,
        );
        expect(html).not.toMatch(/<style|<link| style=| on[a-z]+=/);
      }
    },
    BUILD_TIMEOUT_MS,
  );

  test(
    "bundles are self-contained and carry no host paths",
    async () => {
      await ensureBuilt();
      for (const file of ["newtab.js", "popup.js", "service-worker.js"]) {
        const code = await Bun.file(join(DIST_DIR, file)).text();
        expect(code.length).toBeGreaterThan(0);
        expect(code).not.toContain(PACKAGE_ROOT);
        expect(code).not.toMatch(/^\s*import\s/m);
      }
    },
    BUILD_TIMEOUT_MS,
  );

  test(
    "icons are RGBA PNG files at their declared sizes",
    async () => {
      await ensureBuilt();
      for (const size of ICON_SIZES) {
        const bytes = new Uint8Array(
          await Bun.file(
            join(DIST_DIR, "icons", iconFileName(size)),
          ).arrayBuffer(),
        );
        const image = decodePng(bytes);
        expect(image.width).toBe(size);
        expect(image.height).toBe(size);
        const center = ((size / 2) * size + size / 2) * 4;
        expect(image.rgba[center + 3]).toBe(255);
        // Rounded corners: the first pixel is (nearly) transparent.
        expect(image.rgba[3] ?? 255).toBeLessThan(64);
      }
    },
    BUILD_TIMEOUT_MS,
  );

  test(
    "the zip archive round-trips every dist file",
    async () => {
      const { files } = await ensureBuilt();
      const entries = await Promise.all(
        files.map(async (file) => ({
          name: relative(DIST_DIR, file).replace(/\\/g, "/"),
          data: new Uint8Array(await Bun.file(file).arrayBuffer()),
        })),
      );
      const archive = buildZip(entries, new Date(2026, 0, 1, 12));
      const records = readZip(archive);
      expect(records.map((record) => record.name).sort()).toEqual(
        entries.map((entry) => entry.name).sort(),
      );
      for (const record of records) {
        const source = entries.find((entry) => entry.name === record.name);
        if (!source) {
          throw new Error(`unexpected archive entry ${record.name}`);
        }
        expect(record.data).toEqual(source.data);
      }
    },
    BUILD_TIMEOUT_MS,
  );
});
