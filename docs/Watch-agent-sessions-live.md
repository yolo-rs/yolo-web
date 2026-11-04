# Watch agent sessions live

Capture frames through the same CDP connection that drives the page. Separate
browser connections have their own targets; opening another connection does
not let a viewer attach to an existing agent session. CLI `fetch` and stdio MCP
also run separate browser sessions.

## Run a viewer with Bun (`Bun.serve`) and Puppeteer / `@yolo-web/browser-sdk`

Use a render-enabled Obscura build and **Bun v1.4+**:

```bash
obscura serve --port 9222
bun add puppeteer-core
```

You can run the built-in viewer directly with `bun run tools/live-view.ts`, or save this as `watch.ts`. Put your automation where the example navigates, using
the same `page` object. The viewer polls for a JPEG twice a second and sends it
to local browser tabs over Server-Sent Events using `Bun.serve`.

```ts
import puppeteer from "puppeteer-core";

const token = Bun.env.OBSCURA_CDP_TOKEN;
const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const page = await browser.newPage();
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();
let latest: string | null = null;
let stopping = false;

const html = `<!doctype html>
<meta charset="utf-8"><title>Obscura live view</title>
<style>body{margin:0;background:#111}img{max-width:100%}</style>
<img id="frame" alt="Current page">
<script>
const image = document.getElementById('frame');
const events = new EventSource('/events');
events.onmessage = event => {
  image.src = 'data:image/jpeg;base64,' + event.data;
};
</script>`;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 8080,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/events") {
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    let activeController: ReadableStreamDefaultController<Uint8Array> | null =
      null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        activeController = controller;
        clients.add(controller);
        if (latest) {
          controller.enqueue(encoder.encode(`data:${latest}\n\n`));
        }
      },
      cancel() {
        if (activeController) clients.delete(activeController);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  },
});

async function capture() {
  try {
    latest = (await page.screenshot({
      type: "jpeg",
      quality: 70,
      encoding: "base64",
    })) as string;
    const payload = encoder.encode(`data:${latest}\n\n`);
    for (const client of clients) client.enqueue(payload);
  } catch (error) {
    if (!stopping) console.error("Capture failed:", (error as Error).message);
  }
  if (!stopping) setTimeout(capture, 500);
}

process.once("SIGINT", async () => {
  stopping = true;
  for (const client of clients) client.close();
  server.stop(true);
  await browser.disconnect();
});

await page.goto("https://example.com");
capture();
// Continue automation here with the same `page` object.
```

Run it, then open http://127.0.0.1:8080:

```bash
bun run watch.ts
```

The HTTP listener binds only to loopback. If the CDP server requires a token,
export the same `OBSCURA_CDP_TOKEN` before running the script.

## Other capture paths

Playwright can use the same pattern with its existing `page.screenshot()`;
convert the returned buffer to base64 before sending it to the viewer.

For CDP screencasting, create an additional session from the existing client
connection. Handle `Page.screencastFrame`, acknowledge each frame with
`Page.screencastFrameAck`, and stop with `Page.stopScreencast`. See the
[Puppeteer](Use-with-Puppeteer.md#screencasting) and
[Playwright](Use-with-Playwright.md#screencasting) examples. Frames are emitted
when the page changes, rather than at a fixed rate.

MCP offers `browser_screenshot` for individual captures. It does not expose a
CDP endpoint for a separate viewer to attach to.

## Verify the viewer

1. Run `bun run watch.ts` (or `bun run tools/live-view.ts`) and open the local viewer.
2. Navigate or scroll using the script's `page` object. The viewer should update
   after the next successful capture.
3. Close and reopen the viewer tab. It should receive the most recent frame.
