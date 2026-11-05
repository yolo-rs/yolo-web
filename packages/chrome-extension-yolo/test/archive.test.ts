// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  PNG_SIGNATURE,
  adler32,
  crc32,
  decodePng,
  encodePng,
  zlibCompress,
  zlibDecompress,
} from "../scripts/png.ts";
import { buildZip, readZip } from "../scripts/zip.ts";

const encoder = new TextEncoder();

describe("png", () => {
  test("checksum reference values", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    expect(adler32(encoder.encode("Wikipedia"))).toBe(0x11e60398);
  });

  test("zlib container round-trips and is verified", () => {
    const data = encoder.encode("yolo ".repeat(100));
    const stream = zlibCompress(data);
    expect(stream[0]).toBe(0x78);
    expect(stream.length).toBeLessThan(data.length);
    expect(zlibDecompress(stream)).toEqual(data);
    const corrupt = Uint8Array.from(stream);
    const last = corrupt.length - 1;
    corrupt[last] = (corrupt[last] ?? 0) ^ 0xff;
    expect(() => zlibDecompress(corrupt)).toThrow("checksum");
  });

  test("encodes and decodes RGBA pixels", () => {
    const width = 3;
    const height = 2;
    const rgba = Uint8Array.from(
      { length: width * height * 4 },
      (_, i) => (i * 37) & 0xff,
    );
    const png = encodePng(width, height, rgba);
    expect(Array.from(png.subarray(0, 8))).toEqual([...PNG_SIGNATURE]);
    const image = decodePng(png);
    expect(image.width).toBe(width);
    expect(image.height).toBe(height);
    expect(image.bitDepth).toBe(8);
    expect(image.colorType).toBe(6);
    expect(image.rgba).toEqual(rgba);
  });
});

describe("zip", () => {
  test("round-trips stored and deflated entries", () => {
    const text = encoder.encode("hello hello hello hello hello");
    const tiny = Uint8Array.of(1, 2, 3);
    const archive = buildZip(
      [
        { name: "a/text.txt", data: text },
        { name: "tiny.bin", data: tiny },
      ],
      new Date(2026, 0, 1, 9, 30),
    );
    const records = readZip(archive);
    expect(records.map((record) => record.name)).toEqual([
      "a/text.txt",
      "tiny.bin",
    ]);
    expect(records[0]?.method).toBe(8);
    expect(records[0]?.data).toEqual(text);
    expect(records[1]?.method).toBe(0);
    expect(records[1]?.data).toEqual(tiny);
  });
});
