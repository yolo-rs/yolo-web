#!/usr/bin/env bun
/**
 * Micro-benchmark backing the base64 frame/screenshot changes in
 * packages/cdp-client, apps/human-browser and packages/web-mcp.
 * Compares the previous atob/Buffer round-trips with Uint8Array.fromBase64.
 *
 *   bun scripts/bench-zero-copy.ts
 */
const bytes = crypto.getRandomValues(new Uint8Array(400_000));
const b64 = Buffer.from(bytes).toString("base64");

/** captureScreenshot (decode) + human-browser re-encode + broadcastFrame decode. */
function framePipelineOld(): number {
  const frame = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const reencoded = Buffer.from(frame).toString("base64");
  const binary = Uint8Array.from(atob(reencoded), (c) => c.charCodeAt(0));
  return binary.byteLength + reencoded.length;
}

/** Raw base64 straight from CDP, one native decode. */
function framePipelineNew(): number {
  const binary = Uint8Array.fromBase64(b64);
  return binary.byteLength + b64.length;
}

function decodeOld(): number {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).length;
}

function decodeNew(): number {
  return Uint8Array.fromBase64(b64).length;
}

/** web-mcp browser_screenshot without `path`: decode then re-encode. */
function mcpOld(): number {
  const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return Buffer.from(decoded).toString("base64").length;
}

function mcpNew(): number {
  return b64.length;
}

function bench(name: string, fn: () => number, iterations = 200): void {
  for (let i = 0; i < 20; i++) fn();
  Bun.gc(true);
  const baseline = process.memoryUsage().rss;
  let peak = baseline;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
    if (i % 10 === 0) peak = Math.max(peak, process.memoryUsage().rss);
  }
  const perOp = (performance.now() - start) / iterations;
  console.log(
    `${name.padEnd(30)} ${perOp.toFixed(3)} ms/op  peak RSS +${((peak - baseline) / 1048576).toFixed(1)} MiB`,
  );
}

bench("frame pipeline old", framePipelineOld);
bench("frame pipeline new", framePipelineNew);
bench("decode old (atob+from)", decodeOld);
bench("decode new (fromBase64)", decodeNew);
bench("mcp screenshot old", mcpOld);
bench("mcp screenshot new (raw)", mcpNew);
const same =
  Buffer.compare(
    Uint8Array.fromBase64(b64),
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  ) === 0;
console.log(`decode equivalence: ${same}`);

// Multipart frame assembly: previous broadcastFrame body vs buildMultipartFrame.
import { buildMultipartFrame } from "../apps/human-browser/src/server.ts";
const textEncoder = new TextEncoder();
function multipartOld(): number {
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const header = textEncoder.encode(
    `--yolo-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${binary.byteLength}\r\n\r\n`,
  );
  const trailer = textEncoder.encode("\r\n");
  const frame = new Uint8Array(header.length + binary.length + trailer.length);
  frame.set(header, 0);
  frame.set(binary, header.length);
  frame.set(trailer, header.length + binary.length);
  return frame.length;
}
bench("multipart frame old", multipartOld);
bench("multipart frame new", () => buildMultipartFrame(b64).length);
