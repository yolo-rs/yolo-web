/** Minimal CDP client over WebSocket: navigate and extract DOM, CSS and JS inventory. Works with any CDP endpoint. */
export type Recon = {
  endpoint: string;
  browser: string;
  url: string;
  finalUrl: string;
  title: string;
  domNodes: number;
  htmlBytes: number;
  headings: string[];
  scripts: { src: string | null; inlineBytes: number }[];
  stylesheets: { href: string | null; rules: number | null }[];
  inlineStyleBytes: number;
  jsGlobals: number;
  elapsedMs: number;
};

const EXTRACT = `(() => {
  const sheets = [...document.styleSheets].map(s => { let rules = null; try { rules = s.cssRules.length } catch {} return { href: s.href, rules } });
  const scripts = [...document.scripts].map(s => ({ src: s.src || null, inlineBytes: s.src ? 0 : s.textContent.length }));
  return JSON.stringify({
    finalUrl: location.href, title: document.title, domNodes: document.getElementsByTagName('*').length,
    htmlBytes: document.documentElement.outerHTML.length,
    headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 12).map(h => h.textContent.trim().slice(0, 80)),
    scripts, stylesheets: sheets,
    inlineStyleBytes: [...document.querySelectorAll('style')].reduce((n, s) => n + s.textContent.length, 0),
    jsGlobals: Object.keys(window).length });
})()`;

export async function cdpRecon(
  endpoint: string,
  url: string,
  timeoutMs = 30000,
): Promise<Recon> {
  const t0 = Date.now();
  const version = (await (await fetch(`${endpoint}/json/version`)).json()) as {
    Browser?: string;
    webSocketDebuggerUrl: string;
  };
  // Browser-level socket: create a target, attach with a flat session.
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise<void>((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = () => rej(new Error("cdp ws connect failed"));
  });
  let id = 0;
  const pending = new Map<number, (m: any) => void>();
  const events: any[] = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && pending.has(m.id)) pending.get(m.id)!(m);
    else events.push(m);
  };
  const send = (method: string, params: any = {}, sessionId?: string) =>
    new Promise<any>((res, rej) => {
      const i = ++id;
      const to = setTimeout(
        () => rej(new Error(`cdp timeout ${method}`)),
        timeoutMs,
      );
      pending.set(i, (m) => {
        clearTimeout(to);
        m.error
          ? rej(new Error(`${method}: ${m.error.message}`))
          : res(m.result);
      });
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
  try {
    const { targetId } = await send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    await send("Page.enable", {}, sessionId);
    await send("Page.navigate", { url }, sessionId);
    const deadline = Date.now() + timeoutMs;
    while (
      Date.now() < deadline &&
      !events.some(
        (m) => m.method === "Page.loadEventFired" && m.sessionId === sessionId,
      )
    )
      await Bun.sleep(100);
    const r = await send(
      "Runtime.evaluate",
      { expression: EXTRACT, returnByValue: true },
      sessionId,
    );
    const data = JSON.parse(r.result.value);
    await send("Target.closeTarget", { targetId }).catch(() => {});
    return {
      endpoint,
      browser: version.Browser ?? "unknown",
      url,
      elapsedMs: Date.now() - t0,
      ...data,
    };
  } finally {
    ws.close();
  }
}
