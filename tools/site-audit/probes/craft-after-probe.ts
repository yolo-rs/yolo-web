// craft after probe: headers, encodings, browser loads. HTML GET once per page, wasm fetched once (in browser). Sequential, 250 ms gap.
import puppeteer from "/home/ubuntu/aot/node_modules/puppeteer-core";
import { createHash } from "node:crypto";
const O = "https://craft.aphrody.app";
const UA = "YoloWebAudit/1.0 (+https://github.com/yolo-rs/yolo-web; read-only)";
const sleep = (n: number) => Bun.sleep(n);
const out: any = { startedAt: new Date().toISOString(), headers: {}, assets: {}, encodings: {}, studios: {}, word: {} };
const SEC = ["content-security-policy", "content-security-policy-report-only", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cross-origin-embedder-policy", "cross-origin-resource-policy", "cache-control", "content-encoding", "content-type", "content-length", "etag", "age", "cf-cache-status", "vary", "server"];
async function head(url: string, ae?: string, method = "HEAD") {
  const h: Record<string, string> = { "user-agent": UA };
  if (ae) h["accept-encoding"] = ae;
  const r = await fetch(url, { method, headers: h, redirect: "manual" } as any);
  const o: Record<string, string> = { status: String(r.status) };
  for (const k of SEC) {
    const v = r.headers.get(k);
    if (v) o[k] = v;
  }
  await r.body?.cancel();
  await sleep(250);
  return o;
}
const studios = ["photo", "vector", "film", "design", "fig", "effect", "light", "sound", "cad", "deck", "grid", "pdf", "art"];
const pages = ["/", ...studios.slice(0, 9).map(s => `/${s}/`), "/word/", ...studios.slice(9).map(s => `/${s}/`)];
const assetSet = new Map<string, string>();
for (const p of pages) {
  const r = await fetch(O + p, { headers: { "user-agent": UA }, redirect: "manual" });
  const html = await r.text();
  await sleep(250);
  const hd: Record<string, string> = { status: String(r.status) };
  for (const k of SEC) {
    const v = r.headers.get(k);
    if (v) hd[k] = v;
  }
  const g = (re: RegExp) => html.match(re)?.[1] ?? null;
  const meta = {
    title: g(/<title[^>]*>([^<]*)/i),
    canonical: g(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i) ?? g(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical/i),
    description: g(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i),
    ogTitle: g(/property=["']og:title["'][^>]*content=["']([^"']*)/i),
    ogImage: g(/property=["']og:image["'][^>]*content=["']([^"']*)/i),
    ogUrl: g(/property=["']og:url["'][^>]*content=["']([^"']*)/i),
    twitter: g(/name=["']twitter:card["'][^>]*content=["']([^"']*)/i),
    h1: (html.match(/<h1[\s>]/gi) ?? []).length,
    htmlBytes: html.length,
  };
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css|wasm|mjs)(?:\?[^"']*)?)["']/gi)].map(m => m[1]!);
  const inl = [...html.matchAll(/["']([^"' ]+\.wasm(?:\?[^"']*)?)["']/gi)].map(m => m[1]!);
  const urls = [...new Set([...refs, ...inl])].map(u => new URL(u, O + p).href);
  for (const u of urls) assetSet.set(u, p);
  out.headers[p] = { hd, meta, refs: urls };
}
for (const p of ["/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/favicon.ico"]) out.headers[p] = { hd: await head(O + p, undefined, "GET") };
for (const u of assetSet.keys()) out.assets[u] = { page: assetSet.get(u), br: await head(u, "br") };
const wordAssets = [...assetSet.entries()].filter(([, p]) => p === "/word/").map(([u]) => u);
for (const u of wordAssets) {
  out.encodings[u] = {};
  for (const ae of ["identity", "gzip", "br", "zstd", "br, zstd, gzip"]) out.encodings[u][ae] = await head(u, ae);
}
for (const u of wordAssets) {
  out.assets[u].again1 = await head(u, "br");
  out.assets[u].again2 = await head(u, "br");
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
async function load(url: string, ctx: any, opts: { waitMs: number; hashBodies: boolean }) {
  const page = await ctx.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  const reqs = new Map<string, any>();
  const errors: string[] = [];
  const failed: string[] = [];
  cdp.on("Network.requestWillBeSent", (e: any) => reqs.set(e.requestId, { url: e.request.url, type: e.type, id: e.requestId }));
  cdp.on("Network.responseReceived", (e: any) => {
    const r = reqs.get(e.requestId);
    if (r) {
      r.status = e.response.status;
      r.fromDisk = e.response.fromDiskCache;
      r.enc = e.response.headers["content-encoding"] ?? e.response.headers["Content-Encoding"];
      r.cc = e.response.headers["cache-control"] ?? e.response.headers["Cache-Control"];
    }
  });
  cdp.on("Network.loadingFinished", (e: any) => {
    const r = reqs.get(e.requestId);
    if (r) {
      r.encoded = e.encodedDataLength;
      r.done = true;
    }
  });
  cdp.on("Network.loadingFailed", (e: any) => failed.push(`${reqs.get(e.requestId)?.url ?? "?"} ${e.errorText}`));
  page.on("console", (m: any) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e: any) => errors.push("pageerror: " + String(e.message ?? e).slice(0, 300)));
  const t0 = Date.now();
  let navErr = "";
  try {
    await page.goto(url, { waitUntil: "load", timeout: 90000 });
  } catch (e: any) {
    navErr = String(e.message);
  }
  await sleep(opts.waitMs);
  const loadMs = Date.now() - t0;
  const state = await Promise.race([
    page.evaluate(() => ({
      ready: document.readyState,
      canvases: [...document.querySelectorAll("canvas")].map(x => [x.width, x.height]),
      gpu: !!(navigator as any).gpu,
      title: document.title,
      text: document.body?.innerText.slice(0, 200),
    })),
    sleep(10000).then(() => ({ evalTimeout: true })),
  ]).catch((e: any) => ({ evalErr: String(e.message) }));
  let adapter: any = null;
  try {
    adapter = await Promise.race([
      page.evaluate(async () => {
        try {
          const a = await (navigator as any).gpu?.requestAdapter();
          return a ? "adapter" : "null";
        } catch (e: any) {
          return "err " + e.message;
        }
      }),
      sleep(5000).then(() => "timeout"),
    ]);
  } catch {
    adapter = "evalerr";
  }
  const hashes: Record<string, any> = {};
  if (opts.hashBodies)
    for (const r of reqs.values())
      if (r.done && r.status === 200 && /\.(wasm|js|css)(\?|$)/.test(r.url) && r.url.startsWith(O)) {
        try {
          const b = await cdp.send("Network.getResponseBody", { requestId: r.id });
          const buf = b.base64Encoded ? Buffer.from(b.body, "base64") : Buffer.from(b.body);
          hashes[r.url] = { decoded: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), sha1: createHash("sha1").update(buf).digest("hex"), md5: createHash("md5").update(buf).digest("hex"), sha512: createHash("sha512").update(buf).digest("hex"), blake2b: createHash("blake2b512").update(buf).digest("hex") };
        } catch (e: any) {
          hashes[r.url] = { err: String(e.message).slice(0, 80) };
        }
      }
  const list = [...reqs.values()].filter(r => r.done || r.status).map(r => ({ url: r.url, type: r.type, status: r.status, fromDisk: r.fromDisk, enc: r.enc, cc: r.cc, encoded: r.encoded ?? 0 }));
  const total = list.reduce((a, r) => a + (r.fromDisk ? 0 : r.encoded), 0);
  await page.close();
  return { url, loadMs, navErr, total, requests: list, errors, failed, state, adapter, hashes };
}
for (const s of studios) {
  const ctx = await browser.createBrowserContext();
  out.studios[s] = await load(`${O}/${s}/`, ctx, { waitMs: 8000, hashBodies: true });
  await ctx.close();
  await sleep(250);
}
{
  const ctx = await browser.createBrowserContext();
  out.word.first = await load(`${O}/word/`, ctx, { waitMs: 8000, hashBodies: true });
  out.word.repeat = await load(`${O}/word/`, ctx, { waitMs: 8000, hashBodies: false });
  await ctx.close();
}
await browser.close();
out.finishedAt = new Date().toISOString();
await Bun.write("probe.json", JSON.stringify(out, null, 1));
console.log("done");
