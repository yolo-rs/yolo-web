// SPDX-License-Identifier: Apache-2.0
/**
 * Minimal ZIP writer and reader (PKWARE APPNOTE 4.4: stored or DEFLATE
 * entries, UTF-8 names, no ZIP64). Run directly to package `dist/` for a
 * manual Chrome Web Store upload: `bun run scripts/zip.ts`.
 */
import { join, relative } from "node:path";
import { type Bytes, concat, crc32 } from "./png.ts";

export const ZIP_FILE_NAME = "yolo-web-extension.zip";

export interface ZipEntry {
  readonly name: string;
  readonly data: Bytes;
}

export interface ZipRecord {
  readonly name: string;
  readonly method: 0 | 8;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly data: Bytes;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_RECORD = 0x06054b50;
const VERSION = 20;
const UTF8_NAMES = 0x0800;

function u16(value: number): Bytes {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Bytes {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Builds an archive in memory. Entries keep the given order. */
export function buildZip(
  entries: readonly ZipEntry[],
  timestamp: Date = new Date(),
): Bytes {
  const stamp = dosDateTime(timestamp);
  const encoder = new TextEncoder();
  const locals: Bytes[] = [];
  const centrals: Bytes[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/\\/g, "/"));
    const deflated = Bun.deflateSync(entry.data, { level: 9 });
    const useDeflate = deflated.length < entry.data.length;
    const payload = useDeflate ? deflated : entry.data;
    const common = concat([
      u16(VERSION),
      u16(UTF8_NAMES),
      u16(useDeflate ? 8 : 0),
      u16(stamp.time),
      u16(stamp.date),
      u32(crc32(entry.data)),
      u32(payload.length),
      u32(entry.data.length),
      u16(name.length),
    ]);
    const local = concat([u32(LOCAL_HEADER), common, u16(0), name, payload]);
    const central = concat([
      u32(CENTRAL_HEADER),
      u16(VERSION),
      common,
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = concat([
    u32(END_RECORD),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, ...centrals, end]);
}

/** Reads an archive written by `buildZip`, verifying sizes and CRCs. */
export function readZip(bytes: Bytes): ZipRecord[] {
  let end = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (readU32(bytes, i) === END_RECORD) {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new Error("end of central directory not found");
  }
  const count = readU16(bytes, end + 10);
  let offset = readU32(bytes, end + 16);
  const decoder = new TextDecoder();
  const records: ZipRecord[] = [];

  for (let i = 0; i < count; i++) {
    if (readU32(bytes, offset) !== CENTRAL_HEADER) {
      throw new Error(`bad central directory header at ${offset}`);
    }
    const method = readU16(bytes, offset + 10);
    const crc = readU32(bytes, offset + 16);
    const compressedSize = readU32(bytes, offset + 20);
    const size = readU32(bytes, offset + 24);
    const nameLength = readU16(bytes, offset + 28);
    const extraLength = readU16(bytes, offset + 30);
    const commentLength = readU16(bytes, offset + 32);
    const localOffset = readU32(bytes, offset + 42);
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (readU32(bytes, localOffset) !== LOCAL_HEADER) {
      throw new Error(`bad local header for ${name}`);
    }
    const dataStart =
      localOffset +
      30 +
      readU16(bytes, localOffset + 26) +
      readU16(bytes, localOffset + 28);
    const payload = bytes.subarray(dataStart, dataStart + compressedSize);
    let data: Bytes;
    if (method === 8) {
      data = Bun.inflateSync(payload);
    } else if (method === 0) {
      data = payload;
    } else {
      throw new Error(`unsupported compression method ${method} for ${name}`);
    }
    if (data.length !== size || crc32(data) !== crc) {
      throw new Error(`corrupt entry ${name}`);
    }
    records.push({ name, method, crc32: crc, compressedSize, size, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return records;
}

/** Archives every file below `dir` (sorted, forward slashes) into `outFile`. */
export async function zipDirectory(
  dir: string,
  outFile: string,
): Promise<{ file: string; entries: string[] }> {
  const skip = relative(dir, outFile).replace(/\\/g, "/");
  const names: string[] = [];
  for await (const path of new Bun.Glob("**/*").scan({
    cwd: dir,
    onlyFiles: true,
  })) {
    const name = path.replace(/\\/g, "/");
    if (name !== skip) {
      names.push(name);
    }
  }
  names.sort();
  const entries: ZipEntry[] = [];
  for (const name of names) {
    entries.push({
      name,
      data: new Uint8Array(await Bun.file(join(dir, name)).arrayBuffer()),
    });
  }
  await Bun.write(outFile, buildZip(entries));
  return { file: outFile, entries: names };
}

if (import.meta.main) {
  const dist = join(import.meta.dir, "..", "dist");
  if (!(await Bun.file(join(dist, "manifest.json")).exists())) {
    console.error("dist/manifest.json is missing; run `bun run build` first");
    process.exit(1);
  }
  const { file, entries } = await zipDirectory(dist, join(dist, ZIP_FILE_NAME));
  console.log(`[chrome-extension-yolo] ${entries.length} files -> ${file}`);
}
