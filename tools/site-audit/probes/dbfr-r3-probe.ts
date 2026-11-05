// dragonballfr r3 probe: fresh profile per page, no consent clicks. puppeteer-core + Chrome for Testing 157.
import puppeteer from "/tmp/lh/node_modules/puppeteer-core";
const B = "https://dragonballfr.com";
const UA = "YoloWebAudit/1.0 (+https://github.com/yolo-rs/yolo-web; read-only)";
const GOOG =
  /googletagmanager|google-analytics|googlesyndication|doubleclick|adservice|adtrafficquality|googleadservices|gstatic\.com|google\.com|googleapis\.com/;
const sleep = (n: number) => Bun.sleep(n);
const mode = process.argv[2] ?? "all";
const out: any = { startedAt: new Date().toISOString() };
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    `--user-data-dir=${process.env.TMPDIR}/prof-${Date.now()}`,
  ],
});
async function visit(
  path: string,
  o: { idle: number; scroll?: boolean; click?: string },
) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({
    width: 412,
    height: 915,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Audits.enable");
  const reqs: any[] = [];
  const setc: any[] = [];
  const issues: any[] = [];
  const viol: any[] = [];
  const cons: string[] = [];
  const t0 = Date.now();
  const T = () => +((Date.now() - t0) / 1000).toFixed(1);
  const byId = new Map<string, any>();
  cdp.on("Network.requestWillBeSent", (e: any) => {
    const r = { t: T(), url: e.request.url, type: e.type, id: e.requestId };
    byId.set(e.requestId, r);
    reqs.push(r);
  });
  cdp.on("Network.responseReceived", (e: any) => {
    const r = byId.get(e.requestId);
    if (r) {
      r.status = e.response.status;
      r.ct =
        e.response.headers["content-type"] ??
        e.response.headers["Content-Type"];
      r.cc = e.response.headers["cache-control"];
    }
  });
  cdp.on("Network.responseReceivedExtraInfo", (e: any) => {
    const h = e.headers;
    const sc = h["set-cookie"] ?? h["Set-Cookie"];
    if (sc) {
      const r = byId.get(e.requestId);
      const names = String(sc)
        .split("\n")
        .map((x: string) => x.split("=")[0]);
      setc.push({
        t: T(),
        url: r?.url?.slice(0, 160),
        host: r ? new URL(r.url).host : "?",
        cookies: names,
      });
    }
  });
  cdp.on("Audits.issueAdded", (e: any) =>
    issues.push({
      code: e.issue.code,
      d: JSON.stringify(e.issue.details).slice(0, 200),
    }),
  );
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      cons.push(m.text().slice(0, 200));
  });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener(
      "securitypolicyviolation",
      (e) =>
        ((window as any).__v = (window as any).__v || []).push(
          e.violatedDirective + " " + e.blockedURI,
        ),
      true,
    );
  });
  await page.goto(B + path, { waitUntil: "domcontentloaded" });
  await sleep(o.idle);
  const idleN = reqs.length;
  if (o.scroll) {
    await page.mouse.wheel({ deltaY: 900 });
    await sleep(3000);
  }
  const preClickN = reqs.length;
  let clicked: any = null;
  if (o.click) {
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        tag: el.tagName,
        text: (el.textContent || "").slice(0, 40),
      };
    }, o.click);
    if (info) {
      await sleep(500);
      await page.mouse.click(info.x, info.y);
      await sleep(10000);
    }
    clicked = info;
  }
  const v = await page.evaluate(() =>
    JSON.stringify({
      v: (window as any).__v || [],
      consent: localStorage.getItem("dbfr_consent"),
      url: location.href,
      iframes: [...document.querySelectorAll("iframe")].map((f) => f.src),
    }),
  );
  const hosts: Record<string, number> = {};
  for (const r of reqs) {
    const h = new URL(r.url).host;
    hosts[h] = (hosts[h] || 0) + 1;
  }
  const res = {
    path,
    total: reqs.length,
    idleCount: idleN,
    preClickCount: preClickN,
    state: JSON.parse(v),
    hosts,
    google: reqs
      .filter((r) => GOOG.test(new URL(r.url).host))
      .map((r) => r.url.slice(0, 140)),
    setCookie: setc,
    cookieIssues: issues.filter((i) => /Cookie/.test(i.code)).length,
    issueCodes: issues.reduce(
      (a: any, i) => ((a[i.code] = (a[i.code] || 0) + 1), a),
      {},
    ),
    cspIssues: issues.filter((i) => /ContentSecurityPolicy/.test(i.code))
      .length,
    console: cons,
    clicked,
    log: reqs.map(
      (r) => `${r.t}s ${r.status ?? "-"} ${r.type} ${r.url.slice(0, 150)}`,
    ),
    proxyReqs: reqs
      .filter((r) => /\/api\/(avatar|ext-image)/.test(r.url))
      .slice(0, 6)
      .map((r) => ({ url: r.url, status: r.status, ct: r.ct, cc: r.cc })),
  };
  await ctx.close();
  return res;
}
if (mode === "tp" || mode === "all") {
  out.tp = {};
  for (const p of ["/", "/wiki/staff", "/wiki/toriyama"])
    out.tp[p] = await visit(p, { idle: 12000, scroll: true });
}
if (mode === "ep669" || mode === "all")
  out.ep669 = await visit("/wiki/episodes/669", { idle: 20000, scroll: true });
if (mode === "click669")
  out.click669 = await visit("/wiki/episodes/669", {
    idle: 5000,
    scroll: true,
    click: process.argv[3],
  });
if (mode === "csp" || mode === "all") {
  out.csp = {};
  for (const p of [
    "/",
    "/wiki",
    "/wiki/episodes",
    "/wiki/timeline",
    "/wiki/manga",
    "/catalog",
    "/wiki/cards",
  ]) {
    const r = await visit(p, { idle: 12000, scroll: true });
    out.csp[p] = {
      viol: r.state.v,
      cspIssues: r.cspIssues,
      console: r.console,
      google: r.google,
      total: r.total,
      hosts: r.hosts,
    };
  }
}
if (mode === "home" || mode === "all")
  out.home = await visit("/", { idle: 20000, scroll: true });
await browser.close();
console.log(JSON.stringify(out, null, 1));
