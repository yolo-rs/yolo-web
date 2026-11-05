// SPDX-License-Identifier: Apache-2.0
/**
 * Minimal PNG encoder and decoder (8-bit RGBA, filter type 0) on top of
 * Bun's raw DEFLATE. `Bun.deflateSync` emits a raw stream, so the zlib
 * container (RFC 1950) is written here: header bytes plus an Adler-32 trailer.
 */

/** Bytes backed by a plain `ArrayBuffer`, as Bun's compression APIs require. */
export type Bytes = Uint8Array<ArrayBuffer>;

export const PNG_SIGNATURE: readonly number[] = [
  137, 80, 78, 71, 13, 10, 26, 10,
];

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

/** CRC-32 (IEEE 802.3) as used by PNG chunks and ZIP entries. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0;
    crc = ((CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Adler-32 checksum of the zlib container. */
export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function concat(parts: readonly Uint8Array[]): Bytes {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32be(value: number): Bytes {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  );
}

function readU32be(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

/** Wraps Bun's raw DEFLATE output in a zlib stream. */
export function zlibCompress(data: Bytes): Bytes {
  const raw = Bun.deflateSync(data, { level: 9 });
  return concat([Uint8Array.of(0x78, 0xda), raw, u32be(adler32(data))]);
}

/** Inverse of `zlibCompress`; verifies the header and the checksum. */
export function zlibDecompress(stream: Bytes): Bytes {
  if (stream.length < 6 || stream[0] !== 0x78) {
    throw new Error("not a zlib stream");
  }
  const data = Bun.inflateSync(stream.subarray(2, stream.length - 4));
  if (adler32(data) !== readU32be(stream, stream.length - 4)) {
    throw new Error("zlib checksum mismatch");
  }
  return data;
}

function chunk(type: string, data: Uint8Array): Bytes {
  const body = concat([new TextEncoder().encode(type), data]);
  return concat([u32be(data.length), body, u32be(crc32(body))]);
}

/** Encodes straight-alpha RGBA pixels (row-major, top-left origin). */
export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Bytes {
  if (rgba.length !== width * height * 4) {
    throw new Error(
      `expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`,
    );
  }
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), row + 1);
  }
  const ihdr = concat([
    u32be(width),
    u32be(height),
    Uint8Array.of(8, 6, 0, 0, 0),
  ]);
  return concat([
    Uint8Array.from(PNG_SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibCompress(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export interface PngImage {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly rgba: Bytes;
}

/** Decodes files produced by `encodePng` (and any 8-bit RGBA, filter 0 PNG). */
export function decodePng(bytes: Bytes): PngImage {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("not a PNG file");
    }
  }
  let header:
    | { width: number; height: number; bitDepth: number; colorType: number }
    | undefined;
  const idat: Bytes[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readU32be(bytes, offset);
    const type = new TextDecoder().decode(
      bytes.subarray(offset + 4, offset + 8),
    );
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = readU32be(bytes, offset + 8 + length);
    if (
      crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc
    ) {
      throw new Error(`bad CRC in ${type} chunk`);
    }
    if (type === "IHDR") {
      header = {
        width: readU32be(data, 0),
        height: readU32be(data, 4),
        bitDepth: data[8] ?? 0,
        colorType: data[9] ?? 0,
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!header) {
    throw new Error("missing IHDR chunk");
  }
  if (header.bitDepth !== 8 || header.colorType !== 6) {
    throw new Error("decoder supports 8-bit RGBA only");
  }
  const raw = zlibDecompress(concat(idat));
  const stride = header.width * 4;
  const rgba = new Uint8Array(header.width * header.height * 4);
  for (let y = 0; y < header.height; y++) {
    const row = y * (stride + 1);
    const filter = raw[row];
    if (filter !== 0) {
      throw new Error(`unsupported scanline filter ${filter}`);
    }
    rgba.set(raw.subarray(row + 1, row + 1 + stride), y * stride);
  }
  return { ...header, rgba };
}
