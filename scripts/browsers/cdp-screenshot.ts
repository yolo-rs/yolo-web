#!/usr/bin/env bun
// Minimal CDP screenshot for agents (Bun, zero deps).
// Connects to a Chrome/Edge DevTools endpoint, opens a tab at <url>, saves a PNG.
// This script touches no profile/User Data; point the browser at a throwaway
// --user-data-dir. Modern Chrome needs --remote-allow-origins=* for CDP WS.
//
// usage: bun scripts/browsers/cdp-screenshot.ts <port> <url> <out.png>
// e.g.:  bun scripts/browsers/cdp-screenshot.ts 9465 about:blank shot.png

const [, , portArg, targetUrl, outPath] = process.argv;
if (!portArg || !targetUrl || !outPath) {
  console.error("usage: bun cdp-screenshot.ts <port> <url> <out.png>");
  process.exit(64);
}
const base = `http://127.0.0.1:${portArg}`;

// Create a fresh tab. Modern Chrome requires HTTP PUT on /json/new.
const res = await fetch(`${base}/json/new?${encodeURIComponent(targetUrl)}`, {
  method: "PUT",
});
const tab = (await res.json()) as { webSocketDebuggerUrl?: string };
const ws = tab.webSocketDebuggerUrl;
if (!ws) {
  console.error("no webSocketDebuggerUrl:", JSON.stringify(tab));
  process.exit(2);
}

const sock = new WebSocket(ws);
let id = 0;
const pending = new Map<number, (m: any) => void>();
const send = (method: string, params: unknown = {}) =>
  new Promise<any>((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    sock.send(JSON.stringify({ id: i, method, params }));
  });

sock.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data as string);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)!(m);
    pending.delete(m.id);
  }
});
sock.addEventListener("error", (e: any) => {
  console.error("ws error:", e?.message ?? e);
  process.exit(3);
});
setTimeout(() => {
  console.error("timeout");
  process.exit(5);
}, 20000);

await new Promise<void>((r) => sock.addEventListener("open", () => r()));
await send("Page.enable");
await send("Page.navigate", { url: targetUrl });
await new Promise((r) => setTimeout(r, 1000));
const shot = await send("Page.captureScreenshot", { format: "png" });
const data = shot.result?.data as string | undefined;
if (!data) {
  console.error("no screenshot data:", JSON.stringify(shot));
  process.exit(4);
}
const buf = Buffer.from(data, "base64");
await Bun.write(outPath, buf);
console.log(`OK wrote ${buf.length} bytes -> ${outPath}`);
process.exit(0);
