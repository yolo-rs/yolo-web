import puppeteer from "/home/ubuntu/aot/node_modules/puppeteer-core";
import { mkdtempSync } from "node:fs";
const O = "https://craft.aphrody.app";
const UA = "YoloWebAudit/1.0 (+https://github.com/yolo-rs/yolo-web; read-only)";
const out: any = { range: {}, css: {} };
// Range probe on word wasm (1 byte each) and css GET per encoding
const wasm = O + "/word/wordcraft_web_bg-51359c2e.wasm";
for (const ae of ["identity", "gzip", "br", "zstd"]) {
  const r = await fetch(wasm, { headers: { "user-agent": UA, "accept-encoding": ae, range: "bytes=0-0" } });
  out.range[ae] = { status: r.status, enc: r.headers.get("content-encoding"), cr: r.headers.get("content-range"), cl: r.headers.get("content-length"), cf: r.headers.get("cf-cache-status") };
  await r.body?.cancel(); await Bun.sleep(250);
}
const css = O + "/word/theme-8feb0fbf.css";
for (const ae of ["identity", "gzip", "br", "zstd"]) {
  const r = await fetch(css, { headers: { "user-agent": UA, "accept-encoding": ae } });
  const b = new Uint8Array(await r.arrayBuffer());
  out.css[ae] = { status: r.status, enc: r.headers.get("content-encoding"), len: b.length, cl: r.headers.get("content-length") };
  await Bun.sleep(250);
}
// persistent-profile word first + repeat (same browser session, disk cache)
const dir = mkdtempSync("/tmp/cwprof-");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, userDataDir: dir, args: ["--no-sandbox", "--disable-gpu"] });
async function load(url: string, hashWasm: boolean) {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  const reqs = new Map<string, any>();
  const errors: string[] = [];
  cdp.on("Network.requestWillBeSent", (e: any) => reqs.set(e.requestId, { url: e.request.url, dec: 0, id: e.requestId }));
  cdp.on("Network.responseReceived", (e: any) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.fromDisk = e.response.fromDiskCache; r.enc = e.response.headers["content-encoding"]; } });
  cdp.on("Network.dataReceived", (e: any) => { const r = reqs.get(e.requestId); if (r) r.dec += e.dataLength; });
  cdp.on("Network.loadingFinished", (e: any) => { const r = reqs.get(e.requestId); if (r) { r.encoded = e.encodedDataLength; r.done = true; } });
  page.on("console", (m: any) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e: any) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await Bun.sleep(6000);
  let wasmSha: any = null;
  if (hashWasm) wasmSha = await page.evaluate(async (u: string) => { const b = await (await fetch(u)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return { len: b.byteLength, sha256: [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("") }; }, O + "/word/wordcraft_web_bg-51359c2e.wasm");
  const list = [...reqs.values()].filter(r => r.status).map(r => ({ url: r.url, status: r.status, fromDisk: r.fromDisk, enc: r.enc, encoded: r.encoded ?? 0, decoded: r.dec }));
  await page.close();
  return { total: list.reduce((a, r) => a + (r.fromDisk ? 0 : r.encoded), 0), requests: list, errors, wasmSha };
}
out.first = await load(O + "/word/", false);
await Bun.sleep(1000);
out.repeat = await load(O + "/word/", true);
out.repeat2 = await load(O + "/word/", false);
await browser.close();
await Bun.write("probe2.json", JSON.stringify(out, null, 1));
console.log("done");
