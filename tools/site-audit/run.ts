#!/usr/bin/env bun
// Replayable, read-only site audit: crawl + headers + TLS + Lighthouse (mobile and desktop).
//
//   bun tools/site-audit/run.ts <site|url> [--out docs/audit] [--max-pages 60] [--depth 2]
//        [--lh-heavy 5] [--lh-sitemap 2] [--lh-urls u1,u2,...] [--lh-desktop-all] [--no-lh] [--allow-rosegriffon]
//
// Politeness: GET only, no login, no cookies, max 2 concurrent requests per host plus a gap,
// robots.txt honoured for crawling. Lighthouse drives a real browser, so a single page load can
// open more than 2 connections; runs are sequential and the number of pages is capped.
//
// Lighthouse sends no custom request header: an extra header triggers CORS preflight failures on cross-origin calls and fakes console errors.
// --name <n> overrides the output basename (e.g. rosegriffon-before).
// Lighthouse: set SITE_AUDIT_LH to the launcher command (default "bun x lighthouse") and
// CHROME_PATH to a Chrome/Chromium binary. SITE_AUDIT_CHROME_FLAGS overrides the chrome flags.
// The crawl design (sitemap seeds, entity decoding, manual redirect chains, robots longest-match)
// follows rosegriffon/tools/crawl (read, not modified).

export const UA = "YoloWebAudit/1.0 (+https://github.com/yolo-rs/yolo-web; read-only)";

export const SITES: Record<string, { origin: string; extra?: string[]; note?: string }> = {
  dragonballfr: { origin: "https://dragonballfr.com", extra: ["/mcp", "/api/health"], note: "shenron" },
  aphrody: { origin: "https://aphrody.com" },
  "aphrody-app": { origin: "https://aphrody.app", note: "behind Cloudflare Access" },
  auto: { origin: "https://auto.aphrody.com", extra: ["/health", "/mcp"], note: "auto SaaS" },
  craft: { origin: "https://craft.aphrody.app", note: "yolo-ui-aa site map" },
  cdn: { origin: "https://cdn.aphrody.com", note: "secondary, light" },
  deploy: { origin: "https://deploy.aphrody.app", note: "secondary, light" },
  downloads: { origin: "https://downloads.aphrody.com", note: "secondary, light" },
  nie: { origin: "https://nie.aphrody.app", note: "secondary, light" },
  video: { origin: "https://video.aphrody.app", note: "secondary, light" },
  omar: { origin: "https://omar.aphrody.com", note: "secondary, light" },
  creator: { origin: "https://creator.aphrody.com", note: "disabled since 11-03, light" },
  play: { origin: "https://play.aphrody.app", note: "disabled since 11-03, light" },
  os: { origin: "https://os.aphrody.com", note: "disabled since 11-03, light" },
  yolo: { origin: "https://yolo.aphrody.com", note: "yolo-ui wrangler custom domain" },
  rosegriffon: { origin: "https://rosegriffon.fr", note: "blocked until owner confirms deploy" },
};

const argv = Bun.argv.slice(2);
const flag = (k: string) => argv.includes(k);
const opt = (k: string, d: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1]! : d);
const target = argv.find(a => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true) ?? "";
const known = SITES[target];
const siteName = opt("--name", known ? target : target.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_"));
const ORIGIN = (known?.origin ?? target).replace(/\/$/, "");
const HOST = new URL(ORIGIN).host;
const OUT = opt("--out", "docs/audit");
const LIGHT = flag("--light") || (known?.note ?? "").includes("light");
const MAX_PAGES = LIGHT ? 1 : Number(opt("--max-pages", "60"));
const MAX_DEPTH = Number(opt("--depth", "2"));
const LH_HEAVY = Number(opt("--lh-heavy", "5"));
const LH_SITEMAP = Number(opt("--lh-sitemap", "2"));
const MAX_LINK_CHECKS = LIGHT ? 0 : Number(opt("--link-checks", "150"));
const MAX_ASSET_CHECKS = LIGHT ? 0 : Number(opt("--asset-checks", "120"));

if (!target || argv.includes("--help")) {
  console.log(`usage: bun tools/site-audit/run.ts <${Object.keys(SITES).join("|")}|https://url>`);
  process.exit(target ? 0 : 2);
}
if (target === "rosegriffon" && !flag("--allow-rosegriffon")) {
  console.error("rosegriffon.fr is blocked until its owner (rosegriffon-4a) confirms the deploy; pass --allow-rosegriffon to override.");
  process.exit(3);
}

// ---------- politeness gate ----------
let active = 0;
const waiters: Array<() => void> = [];
async function gated<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(r => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    await Bun.sleep(250);
    active--;
    waiters.shift()?.();
  }
}

interface Hop {
  url: string;
  status: number;
  location?: string;
}
async function chain(url: string, max = 8) {
  const hops: Hop[] = [];
  let cur = url;
  const t0 = performance.now();
  for (let i = 0; i <= max; i++) {
    let res: Response;
    try {
      res = await gated(() =>
        fetch(cur, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8" }, signal: AbortSignal.timeout(30_000) }),
      );
    } catch (e) {
      return { hops, res: null as Response | null, error: String((e as Error).message ?? e), ms: performance.now() - t0 };
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      hops.push({ url: cur, status: res.status, location: loc });
      await res.body?.cancel();
      cur = new URL(loc, cur).href;
      continue;
    }
    hops.push({ url: cur, status: res.status });
    return { hops, res, ms: performance.now() - t0 } as { hops: Hop[]; res: Response | null; error?: string; ms: number };
  }
  return { hops, res: null as Response | null, error: "redirect loop", ms: performance.now() - t0 };
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e.toLowerCase()] ?? m),
  );
const norm = (href: string, base: string) => {
  try {
    const u = new URL(decode(href.trim()), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
};

// ---------- robots ----------
async function robots() {
  const { res, hops } = await chain(`${ORIGIN}/robots.txt`);
  const body = res && res.ok ? await res.text() : "";
  const disallow: string[] = [];
  const allow: string[] = [];
  const sitemaps: string[] = [];
  let star = false;
  let saw = false;
  for (const raw of body.split(/\r?\n/)) {
    const m = raw.replace(/#.*/, "").trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1]!.toLowerCase();
    const v = m[2]!.trim();
    if (k === "sitemap") sitemaps.push(v);
    else if (k === "user-agent") {
      if (saw) star = false;
      saw = false;
      if (v === "*") star = true;
    } else if (k === "allow" || k === "disallow") {
      saw = true;
      if (star && v) (k === "allow" ? allow : disallow).push(v);
    }
  }
  const ok = (path: string) => {
    let best = -1;
    let allowed = true;
    for (const p of allow) if (path.startsWith(p) && p.length >= best) ((best = p.length), (allowed = true));
    for (const p of disallow) if (path.startsWith(p) && p.length > best) ((best = p.length), (allowed = false));
    return allowed;
  };
  return { status: hops.at(-1)?.status ?? 0, hops, body: body.slice(0, 2000), sitemaps, disallow, ok };
}

// ---------- page parsing ----------
interface PageRec {
  url: string;
  depth: number;
  status: number;
  finalUrl: string;
  hops: Hop[];
  contentType: string;
  ms: number;
  htmlBytes: number;
  lang: string | null;
  title: string;
  description: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: boolean;
  h1Count: number;
  og: Record<string, string>;
  twitterCard: string | null;
  hreflang: Array<{ lang: string; href: string }>;
  jsonLd: number;
  links: string[];
  assets: string[];
  mixed: string[];
  imgNoAlt: number;
  imgNoDims: number;
  copy: Array<{ kind: string; match: string }>;
}
const COPY: Array<{ kind: string; re: RegExp }> = [
  { kind: "broken", re: /\bundefined\b|\bNaN\b|\[object Object\]|\{\{[^}]*\}\}|\$\{[^}]*\}/g },
  { kind: "placeholder", re: /lorem ipsum|\bTODO\b|\bFIXME\b|\bTBD\b/gi },
  { kind: "mojibake", re: /Ã[©¨ª«]|â€[™œ“”]|Â[ «»]|�/g },
  { kind: "garbled-double", re: /\b(\p{Lu}\p{Ll}{2,})\s+\1\b/gu },
  { kind: "english-ui", re: /\b(Read more|Learn more|See all|View all|Show more|Load more|Sign in|Sign up|Log in|Log out|Loading\.\.\.|No results|Coming soon|Click here|Get started|Not found|Something went wrong|Try again|Skip to content)\b/g },
];
async function parse(html: string, base: string) {
  const o = {
    lang: null as string | null, title: "", description: null as string | null, canonical: null as string | null,
    robotsMeta: null as string | null, viewport: false, h1: 0, og: {} as Record<string, string>, tw: null as string | null,
    hreflang: [] as Array<{ lang: string; href: string }>, ld: 0, links: new Set<string>(), assets: new Set<string>(),
    imgNoAlt: 0, imgNoDims: 0, text: [] as string[],
  };
  let inTitle = false;
  let skip = 0;
  const asset = (v: string | null) => {
    if (!v || v.startsWith("data:")) return;
    const n = norm(v, base);
    if (n) o.assets.add(n);
  };
  await new HTMLRewriter()
    .on("html", { element: e => void (o.lang = e.getAttribute("lang")) })
    .on("title", { element: e => { inTitle = true; e.onEndTag(() => void (inTitle = false)); }, text: t => void (inTitle && (o.title += t.text)) })
    .on('link[rel="canonical"]', { element: e => void (o.canonical = e.getAttribute("href")) })
    .on('link[rel="alternate"][hreflang]', { element: e => void o.hreflang.push({ lang: e.getAttribute("hreflang")!, href: e.getAttribute("href") ?? "" }) })
    .on("meta", { element: e => {
      const n = (e.getAttribute("name") ?? "").toLowerCase();
      const p = (e.getAttribute("property") ?? "").toLowerCase();
      const c = e.getAttribute("content") ?? "";
      if (n === "description") o.description = c;
      else if (n === "robots") o.robotsMeta = c;
      else if (n === "viewport") o.viewport = true;
      else if (n === "twitter:card") o.tw = c;
      if (p.startsWith("og:")) o.og[p] = c;
    } })
    .on('script[type="application/ld+json"]', { element: () => void o.ld++ })
    .on("h1", { element: () => void o.h1++ })
    .on("a[href]", { element: e => { const n = norm(e.getAttribute("href")!, base); if (n) o.links.add(n); } })
    .on("script[src]", { element: e => asset(e.getAttribute("src")) })
    .on("link[href]", { element: e => { if (/stylesheet|icon|modulepreload|manifest/i.test(e.getAttribute("rel") ?? "")) asset(e.getAttribute("href")); } })
    .on("img", { element: e => {
      asset(e.getAttribute("src"));
      if (e.getAttribute("alt") === null) o.imgNoAlt++;
      if (!(e.hasAttribute("width") && e.hasAttribute("height"))) o.imgNoDims++;
    } })
    .on("iframe[src], video[src], audio[src], source[src]", { element: e => asset(e.getAttribute("src")) })
    .on("script, style, noscript, template, svg", { element: e => { skip++; e.onEndTag(() => void skip--); } })
    .onDocument({ text: t => { if (!skip) { o.text.push(t.text); if (t.lastInTextNode) o.text.push(" "); } } })
    .transform(new Response(html))
    .text();
  return o;
}

async function fetchPage(url: string, depth: number): Promise<PageRec> {
  const { hops, res, error, ms } = await chain(url);
  const last = hops.at(-1);
  const rec: PageRec = {
    url, depth, status: last?.status ?? 0, finalUrl: last?.url ?? url, hops, contentType: res?.headers.get("content-type") ?? error ?? "",
    ms: Math.round(ms), htmlBytes: 0, lang: null, title: "", description: null, canonical: null, robotsMeta: null, viewport: false, h1Count: 0,
    og: {}, twitterCard: null, hreflang: [], jsonLd: 0, links: [], assets: [], mixed: [], imgNoAlt: 0, imgNoDims: 0, copy: [],
  };
  if (!res || !rec.contentType.includes("html")) {
    await res?.body?.cancel();
    return rec;
  }
  const html = await res.text();
  rec.htmlBytes = new TextEncoder().encode(html).length;
  const p = await parse(html, rec.finalUrl);
  Object.assign(rec, {
    lang: p.lang, title: decode(p.title.trim()), description: p.description && decode(p.description), canonical: p.canonical,
    robotsMeta: p.robotsMeta, viewport: p.viewport, h1Count: p.h1, og: p.og, twitterCard: p.tw, hreflang: p.hreflang, jsonLd: p.ld,
    links: [...p.links], assets: [...p.assets], imgNoAlt: p.imgNoAlt, imgNoDims: p.imgNoDims,
  });
  rec.mixed = rec.finalUrl.startsWith("https:") ? rec.assets.filter(a => a.startsWith("http:")) : [];
  const text = p.text.join("").replace(/\s+/g, " ");
  const seen = new Set<string>();
  for (const { kind, re } of COPY) {
    if (kind === "english-ui" && !(p.lang ?? "").toLowerCase().startsWith("fr")) continue;
    for (const m of text.matchAll(re)) {
      const k = `${kind}:${m[0]}`;
      if (!seen.has(k)) (seen.add(k), rec.copy.push({ kind, match: m[0] }));
    }
  }
  return rec;
}

// ---------- TLS ----------
async function tls(host: string) {
  const run = async (args: string[], input = "") => {
    try {
      const p = Bun.spawn(args, { stdin: new Response(input), stdout: "pipe", stderr: "pipe" });
      const out = await new Response(p.stdout).text();
      await p.exited;
      return out;
    } catch (e) {
      return `ERR ${(e as Error).message}`;
    }
  };
  const s = await run(["openssl", "s_client", "-connect", `${host}:443`, "-servername", host, "-brief"], "");
  const full = await run(["openssl", "s_client", "-connect", `${host}:443`, "-servername", host], "");
  const pem = full.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0] ?? "";
  const x = pem ? await run(["openssl", "x509", "-noout", "-subject", "-issuer", "-dates", "-ext", "subjectAltName"], pem) : "";
  const g = (re: RegExp, t: string) => t.match(re)?.[1]?.trim() ?? null;
  return {
    protocol: g(/Protocol version:\s*(.+)/, s) ?? g(/Protocol\s*:\s*(.+)/, full), cipher: g(/Ciphersuite:\s*(.+)/, s) ?? g(/Cipher\s*:\s*(.+)/, full),
    verify: g(/Verification:\s*(.+)/, s) ?? g(/Verify return code:\s*(.+)/, full), subject: g(/subject=(.+)/, x), issuer: g(/issuer=(.+)/, x),
    notBefore: g(/notBefore=(.+)/, x), notAfter: g(/notAfter=(.+)/, x), san: g(/DNS:.+/, x) ? x.match(/DNS:[^\n]+/)?.[0] ?? null : null,
  };
}

// ---------- main ----------
const t0 = Date.now();
const rb = await robots();
const home = await fetchPage(`${ORIGIN}/`, 0);

// sitemap (first sitemap, follows one level of sitemap index)
async function sitemapLocs(url: string, depth = 0): Promise<{ status: number; locs: string[] }> {
  const { res, hops } = await chain(url);
  const status = hops.at(-1)?.status ?? 0;
  const xml = res && res.ok ? await res.text() : "";
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]!));
  if (depth === 0 && /<sitemapindex/i.test(xml)) {
    const sub = await sitemapLocs(locs[0]!, 1);
    return { status, locs: sub.locs };
  }
  return { status, locs };
}
const smUrl = rb.sitemaps[0] ?? `${ORIGIN}/sitemap.xml`;
const sm = await sitemapLocs(smUrl);
const smOwn = sm.locs.filter(u => { try { return new URL(u).host === HOST; } catch { return false; } });

// BFS
const pages = new Map<string, PageRec>();
pages.set(home.url, home);
const queued = new Set<string>([home.url, ...(home.finalUrl !== home.url ? [home.finalUrl] : [])]);
let frontier: Array<{ url: string; depth: number }> = [];
const sample = (arr: string[], n: number) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
const seeds = [...sample(smOwn, 10), ...(known?.extra ?? []).map(p => ORIGIN + p)];
for (const u of seeds) if (!queued.has(u)) (queued.add(u), frontier.push({ url: u, depth: 1 }));
const pushLinks = (p: PageRec) => {
  if (p.depth >= MAX_DEPTH) return;
  for (const l of p.links) {
    let u: URL;
    try { u = new URL(l); } catch { continue; }
    if (u.host !== HOST || queued.has(l) || !rb.ok(u.pathname)) continue;
    if (/\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|webm|mp3|xml|json|txt|css|js|woff2?)$/i.test(u.pathname)) continue;
    queued.add(l);
    frontier.push({ url: l, depth: p.depth + 1 });
  }
};
pushLinks(home);
while (frontier.length && pages.size < MAX_PAGES) {
  const batch = frontier.splice(0, 2);
  const recs = await Promise.all(batch.map(b => fetchPage(b.url, b.depth)));
  for (const r of recs) {
    pages.set(r.url, r);
    pushLinks(r);
  }
}
const list = [...pages.values()];

// internal link + asset checks (GET, body cancelled)
async function probe(url: string) {
  const { hops, error, res } = await chain(url, 5);
  const len = res?.headers.get("content-length");
  await res?.body?.cancel();
  return { status: hops.at(-1)?.status ?? 0, error, hops: hops.length - 1, bytes: len ? Number(len) : null };
}
const linkSrc = new Map<string, string>();
for (const p of list) for (const l of p.links) { try { if (new URL(l).host === HOST && !pages.has(l) && !linkSrc.has(l)) linkSrc.set(l, p.url); } catch {} }
const brokenLinks: Array<{ url: string; status: number; from: string; error?: string }> = [];
let linkChecked = 0;
for (const [l, from] of [...linkSrc].slice(0, MAX_LINK_CHECKS)) {
  const r = await probe(l);
  linkChecked++;
  if (r.status === 0 || r.status >= 400) brokenLinks.push({ url: l, status: r.status, from, error: r.error });
}
for (const p of list) if (p.status === 0 || p.status >= 400) brokenLinks.push({ url: p.url, status: p.status, from: "(crawl frontier)", error: p.contentType });
const assetSrc = new Map<string, string>();
for (const p of list) for (const a of p.assets) { try { if (new URL(a).host === HOST && !assetSrc.has(a)) assetSrc.set(a, p.url); } catch {} }
const badAssets: Array<{ url: string; status: number; from: string }> = [];
let assetChecked = 0;
for (const [a, from] of [...assetSrc].slice(0, MAX_ASSET_CHECKS)) {
  const r = await probe(a);
  assetChecked++;
  if (r.status === 0 || r.status >= 400) badAssets.push({ url: a, status: r.status, from });
}

// routes, headers, redirects
const probes: Record<string, unknown> = {};
for (const p of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/.well-known/security.txt", "/__audit-404-probe__"]) {
  const r = await probe(ORIGIN + p);
  probes[p] = { status: r.status, redirects: r.hops };
}
const httpHop = await chain(`http://${HOST}/`, 5);
const wwwHop = HOST.split(".").length === 2 ? await chain(`https://www.${HOST}/`, 5) : null;
const hdrRes = await gated(() => fetch(`${ORIGIN}/`, { headers: { "user-agent": UA }, redirect: "manual" }));
const hdr = (n: string) => hdrRes.headers.get(n);
await hdrRes.body?.cancel();
const SEC = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cross-origin-resource-policy", "cache-control", "content-encoding", "server", "cf-cache-status"];
const headers = Object.fromEntries(SEC.map(n => [n, hdr(n)]));
const tlsInfo = await tls(HOST);

// ---------- Lighthouse ----------
interface Lh {
  url: string; form: "mobile" | "desktop"; ok: boolean; error?: string; perf?: number; a11y?: number; bp?: number; seo?: number;
  lcp?: number; cls?: number; tbt?: number; fcp?: number; si?: number; consoleErrors?: number; consoleSample?: string[]; fails?: string[];
}
const lh: Lh[] = [];
let lhNote = "";
if (flag("--no-lh") || LIGHT) lhNote = LIGHT ? "not run (light mode: status, TLS, headers only)" : "not run (--no-lh)";
else if (home.status === 0 || home.status >= 400) lhNote = `not run: homepage status ${home.status}`;
else {
  const heavy = list.filter(p => p.status === 200 && p.contentType.includes("html") && p.url !== home.url).sort((a, b) => b.htmlBytes - a.htmlBytes).slice(0, LH_HEAVY).map(p => p.url);
  const smp = sample(smOwn, LH_SITEMAP + 2).filter(u => !heavy.includes(u) && u !== home.url && u !== home.finalUrl).slice(0, LH_SITEMAP);
  let targets: Array<{ url: string; forms: Array<"mobile" | "desktop"> }> = [
    { url: home.finalUrl, forms: ["mobile", "desktop"] },
    ...[...heavy, ...smp].map(url => ({ url, forms: flag("--lh-desktop-all") ? (["mobile", "desktop"] as const).slice() : (["mobile"] as Array<"mobile">) })),
  ];
  // --lh-urls a,b,c pins the Lighthouse sample (home first, mobile and desktop; others mobile) for before/after comparisons.
  if (opt("--lh-urls", "")) targets = opt("--lh-urls", "").split(",").map((url, i) => ({ url, forms: i === 0 ? ["mobile", "desktop"] : ["mobile"] }));
  const tmp = `${OUT}/.tmp-${siteName}`;
  await Bun.write(`${tmp}/.keep`, "");
  const lhCmd = (process.env.SITE_AUDIT_LH ?? "bun x lighthouse").split(" ");
  const chromeFlags = process.env.SITE_AUDIT_CHROME_FLAGS ?? "--headless=new --no-sandbox --disable-gpu";
  for (const t of targets) for (const form of t.forms) {
    const out = `${tmp}/${form}-${lh.length}.json`;
    const args = [...lhCmd, t.url, "--output=json", `--output-path=${out}`, "--quiet", "--only-categories=performance,accessibility,best-practices,seo", `--chrome-flags=${chromeFlags}`, "--max-wait-for-load=60000"];
    if (form === "desktop") args.push("--preset=desktop");
    const r: Lh = { url: t.url, form, ok: false };
    try {
      const p = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
      const errTxt = new Response(p.stderr).text();
      await p.exited;
      const j = (await Bun.file(out).json()) as any;
      const sc = (c: string) => (j.categories[c]?.score == null ? undefined : Math.round(j.categories[c].score * 100));
      const num = (id: string) => j.audits[id]?.numericValue as number | undefined;
      Object.assign(r, { ok: true, perf: sc("performance"), a11y: sc("accessibility"), bp: sc("best-practices"), seo: sc("seo"), lcp: num("largest-contentful-paint"), cls: num("cumulative-layout-shift"), tbt: num("total-blocking-time"), fcp: num("first-contentful-paint"), si: num("speed-index") });
      const ce = j.audits["errors-in-console"]?.details?.items ?? [];
      r.consoleErrors = ce.length;
      r.consoleSample = ce.slice(0, 3).map((i: any) => String(i.description ?? i.source ?? "").slice(0, 160));
      r.fails = Object.values(j.audits as Record<string, any>).filter((a: any) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "manual").sort((a: any, b: any) => a.score - b.score).slice(0, 6).map((a: any) => `${a.id} (${Math.round(a.score * 100)})`);
      if (!r.ok) r.error = (await errTxt).slice(0, 200);
    } catch (e) {
      r.error = String((e as Error).message ?? e).slice(0, 200);
    }
    lh.push(r);
    console.log(`lh ${form} ${t.url} ${r.ok ? `perf=${r.perf} a11y=${r.a11y} bp=${r.bp} seo=${r.seo}` : `FAILED ${r.error}`}`);
    await Bun.sleep(1500);
  }
}

// ---------- findings + output ----------
const ok200 = list.filter(p => p.status === 200 && p.contentType.includes("html"));
const issues = (name: string, fn: (p: PageRec) => boolean) => ({ name, urls: ok200.filter(fn).map(p => p.url) });
const checks = [
  issues("missing <title>", p => !p.title),
  issues("duplicate-looking title (equal to home)", p => p.url !== home.url && !!p.title && p.title === home.title),
  issues("title > 70 chars", p => p.title.length > 70),
  issues("missing meta description", p => !p.description),
  issues("h1 count != 1", p => p.h1Count !== 1),
  issues("missing canonical", p => !p.canonical),
  issues("canonical differs from final URL", p => !!p.canonical && norm(p.canonical, p.finalUrl) !== p.finalUrl && norm(p.canonical, p.finalUrl) !== p.url),
  issues("missing html lang", p => !p.lang),
  issues("missing viewport meta", p => !p.viewport),
  issues("missing og:title/og:image", p => !p.og["og:title"] || !p.og["og:image"]),
  issues("noindex", p => /noindex/i.test(p.robotsMeta ?? "")),
  issues("mixed content", p => p.mixed.length > 0),
  issues("images without alt attribute", p => p.imgNoAlt > 0),
  issues("copy heuristics hit", p => p.copy.length > 0),
];
const result = {
  site: siteName, origin: ORIGIN, ua: UA, startedAt: new Date(t0).toISOString(), durationS: Math.round((Date.now() - t0) / 1000),
  limits: { maxPages: MAX_PAGES, depth: MAX_DEPTH, linkChecks: MAX_LINK_CHECKS, assetChecks: MAX_ASSET_CHECKS, concurrency: 2, gapMs: 250, method: "GET" },
  robots: { status: rb.status, disallow: rb.disallow, sitemaps: rb.sitemaps, body: rb.body }, sitemap: { url: smUrl, status: sm.status, urls: sm.locs.length },
  probes, http: { hops: httpHop.hops }, www: wwwHop?.hops ?? null, homeRedirects: home.hops, headers, tls: tlsInfo,
  crawl: { pages: list.length, statuses: Object.fromEntries([...new Set(list.map(p => p.status))].map(s => [s, list.filter(p => p.status === s).length])), linkChecked, linkTargets: linkSrc.size, assetChecked, assetTargets: assetSrc.size },
  brokenLinks, badAssets, checks, lighthouse: lh, lighthouseNote: lhNote, pages: list,
};
await Bun.write(`${OUT}/${siteName}.json`, JSON.stringify(result, null, 2));

const f = (n?: number, d = 0) => (n == null ? "-" : n.toFixed(d));
const md: string[] = [];
md.push(`# ${siteName} measured data`, "", `Generated by \`bun tools/site-audit/run.ts ${target}\` at ${result.startedAt} (${result.durationS}s). UA \`${UA}\`. GET only, 2 concurrent, 250 ms gap, no login. Raw: \`${siteName}.json\`.`, "");
md.push("## Routes", "", "| Path | Status | Redirects |", "|---|---|---|", `| / | ${home.status} | ${home.hops.length - 1} |`);
for (const [k, v] of Object.entries(probes)) md.push(`| ${k} | ${(v as any).status} | ${(v as any).redirects} |`);
md.push(`| http://${HOST}/ | ${httpHop.hops.map(h => h.status).join(" -> ")} | ${httpHop.hops.at(-1)?.url} |`);
if (wwwHop) md.push(`| https://www.${HOST}/ | ${wwwHop.error ?? wwwHop.hops.map(h => h.status).join(" -> ")} | ${wwwHop.hops.at(-1)?.url ?? ""} |`);
md.push("", `robots.txt disallow: ${rb.disallow.join(", ") || "none"}; sitemap ${smUrl}: status ${sm.status}, ${sm.locs.length} URLs.`, "");
md.push("## Security headers (GET /)", "", "| Header | Value |", "|---|---|");
for (const [k, v] of Object.entries(headers)) md.push(`| ${k} | ${v ? `\`${v.slice(0, 140).replace(/\|/g, "\\|")}\`` : "**absent**"} |`);
md.push("", "## TLS", "", "```", JSON.stringify(tlsInfo, null, 1), "```", "");
md.push("## Crawl", "", `Pages fetched ${list.length} (cap ${MAX_PAGES}, depth ${MAX_DEPTH}); statuses ${JSON.stringify(result.crawl.statuses)}. Internal link targets ${linkSrc.size}, checked ${linkChecked}, broken ${brokenLinks.length}. Own-host assets ${assetSrc.size}, checked ${assetChecked}, 4xx/5xx ${badAssets.length}.`, "");
if (brokenLinks.length) md.push("Broken links:", "", ...brokenLinks.slice(0, 25).map(b => `- ${b.status} ${b.url} (from ${b.from})${b.error ? ` ${b.error}` : ""}`), "");
if (badAssets.length) md.push("Bad assets:", "", ...badAssets.slice(0, 25).map(b => `- ${b.status} ${b.url} (from ${b.from})`), "");
md.push("| Check | Pages | Examples |", "|---|---|---|");
for (const c of checks) md.push(`| ${c.name} | ${c.urls.length}/${ok200.length} | ${c.urls.slice(0, 2).join(" ")} |`);
const copyHits = ok200.flatMap(p => p.copy.map(c => `${c.kind} "${c.match}" @ ${p.url}`));
if (copyHits.length) md.push("", "Copy heuristics:", "", ...copyHits.slice(0, 20).map(c => `- ${c}`));
md.push("", "## Meta (home)", "", "```", JSON.stringify({ title: home.title, description: home.description, canonical: home.canonical, lang: home.lang, robots: home.robotsMeta, og: home.og, twitterCard: home.twitterCard, hreflang: home.hreflang, jsonLd: home.jsonLd }, null, 1), "```", "");
md.push("## Lighthouse", "");
if (lhNote) md.push(lhNote, "");
else {
  md.push("Lab data only (INP needs field data; TBT is the lab proxy). Real Chrome opens several connections per page, so this exceeds the 2-request cap during each page load.", "", "| Form | URL | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | Console errors |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const r of lh) md.push(r.ok ? `| ${r.form} | ${r.url} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${f((r.lcp ?? 0) / 1000, 1)} | ${f(r.cls, 3)} | ${f(r.tbt)} | ${r.consoleErrors} |` : `| ${r.form} | ${r.url} | failed: ${r.error} | | | | | | | |`);
  md.push("", ...lh.filter(r => r.ok && r.fails?.length).slice(0, 3).map(r => `- ${r.form} ${r.url} lowest audits: ${r.fails!.join(", ")}${r.consoleSample?.length ? `; console: ${r.consoleSample.join(" | ")}` : ""}`));
}
await Bun.write(`${OUT}/${siteName}.measured.md`, md.join("\n") + "\n");
console.log(`wrote ${OUT}/${siteName}.json and ${siteName}.measured.md`);
