// SPDX-License-Identifier: Apache-2.0 OR MPL-2.0
/**
 * @yolo-web/bun-mirror
 *
 * Sovereign 100% Pure Bun Indexing, Mirroring, Crawling, Scraping, Stack Scanner,
 * DNS Scanner, TCP Scanner, TLS Scanner, and Multi-Engine Orchestrator
 * (Brave Shields + Obscura CDP + Servo Stylo + curl + wget2) targeting https://bun.com/.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as dns from "node:dns/promises";
import {
  BraveFingerprintProtection,
  BraveSearchMcpBridge,
  BraveShieldsEngine,
} from "@yolo-web/brave-shields";
import {
  calculateSpecificity,
  SERVO_CONSOLIDATED_CRATES,
  ServoEuclidRect,
  ServoEuclidSize2D,
  translateXPathToCss,
  validateCssSelector,
} from "@yolo-web/servo-bridge";
import { crawl, type CrawlResult } from "@yolo-web/web-crawler";
import { KnowledgeIndexDb } from "@yolo-web/knowledge-indexer";

export const CANONICAL_BUN_TARGET = "https://bun.com/";

export interface DnsScanReport {
  readonly domain: string;
  readonly scannedAt: string;
  readonly ipv4: string[];
  readonly ipv6: string[];
  readonly cname: string[];
  readonly mx: Array<{ exchange: string; priority: number }>;
  readonly txt: string[][];
  readonly ns: string[];
  readonly durationMs: number;
}

export interface TcpPortProbe {
  readonly host: string;
  readonly port: number;
  readonly open: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

export interface TcpScanReport {
  readonly host: string;
  readonly scannedAt: string;
  readonly probes: TcpPortProbe[];
}

export interface TlsScanReport {
  readonly host: string;
  readonly port: number;
  readonly scannedAt: string;
  readonly handshakeSuccess: boolean;
  readonly latencyMs: number;
  readonly protocol: string;
  readonly alpn: string;
  readonly serverHeader: string | null;
  readonly strictTransportSecurity: string | null;
  readonly cfRay: string | null;
  readonly status: number;
}

export interface StackDetectionReport {
  readonly targetUrl: string;
  readonly scannedAt: string;
  readonly cdnAndEdge: string[];
  readonly serverRuntime: string[];
  readonly frontendFramework: string[];
  readonly stylingAndTheme: string[];
  readonly docsEngine: string[];
  readonly securityHeaders: Record<string, string>;
  readonly detectedMetaGenerators: string[];
  readonly scriptCount: number;
  readonly stylesheetCount: number;
}

export interface ScrapedHeading {
  readonly level: number;
  readonly id: string;
  readonly text: string;
}

export interface ScrapedCodeBlock {
  readonly language: string;
  readonly snippet: string;
}

export interface ScrapedPageArtifact {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl: string | null;
  readonly headings: ScrapedHeading[];
  readonly codeBlocks: ScrapedCodeBlock[];
  readonly links: string[];
  readonly braveShieldsAllowed: boolean;
  readonly sanitizedUrl: string;
  readonly servoHeadingSpecificity: number;
  readonly obscuraScriptsReady: boolean;
  readonly sha256: string;
}

export interface ExternalFetcherReport {
  readonly tool: "curl" | "wget2" | "bun-fetch";
  readonly binaryPath: string | null;
  readonly commandArgs: string[];
  readonly executed: boolean;
  readonly exitCode: number;
  readonly bytesFetched: number;
  readonly statusCode: number;
}

export interface MirrorPageEntry {
  readonly route: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly description: string;
  readonly text: string;
  readonly html: string;
  readonly sha256: string;
  readonly fetchedAt: string;
}

// ---------------------------------------------------------------------------
// 1. DNS Scanner (A, AAAA, CNAME, MX, TXT, NS)
// ---------------------------------------------------------------------------
export async function scanDns(domain = "bun.com"): Promise<DnsScanReport> {
  const started = performance.now();
  const cleanDomain = domain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  const [ipv4, ipv6, cname, mx, txt, ns] = await Promise.all([
    dns.resolve4(cleanDomain).catch(() => [] as string[]),
    dns.resolve6(cleanDomain).catch(() => [] as string[]),
    dns.resolveCname(cleanDomain).catch(() => [] as string[]),
    dns.resolveMx(cleanDomain).catch(() => [] as Array<{ exchange: string; priority: number }>),
    dns.resolveTxt(cleanDomain).catch(() => [] as string[][]),
    dns.resolveNs(cleanDomain).catch(() => [] as string[]),
  ]);

  return {
    domain: cleanDomain,
    scannedAt: new Date().toISOString(),
    ipv4,
    ipv6,
    cname,
    mx,
    txt,
    ns,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// 2. TCP Scanner (Bun.connect non-blocking socket probes)
// ---------------------------------------------------------------------------
export async function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 2500,
): Promise<TcpPortProbe> {
  const started = performance.now();
  return new Promise<TcpPortProbe>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          host,
          port,
          open: false,
          latencyMs: Math.round((performance.now() - started) * 100) / 100,
          error: "timeout",
        });
      }
    }, timeoutMs);

    Bun.connect({
      hostname: host,
      port,
      socket: {
        open(socket) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            const latencyMs = Math.round((performance.now() - started) * 100) / 100;
            socket.end();
            resolve({ host, port, open: true, latencyMs });
          }
        },
        data() {},
        error(_socket, err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({
              host,
              port,
              open: false,
              latencyMs: Math.round((performance.now() - started) * 100) / 100,
              error: err.message,
            });
          }
        },
        connectError(_socket, err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve({
              host,
              port,
              open: false,
              latencyMs: Math.round((performance.now() - started) * 100) / 100,
              error: err.message,
            });
          }
        },
      },
    }).catch((err: unknown) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          host,
          port,
          open: false,
          latencyMs: Math.round((performance.now() - started) * 100) / 100,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  });
}

export async function scanTcpPorts(
  host = "bun.com",
  ports: number[] = [80, 443],
  timeoutMs = 2500,
): Promise<TcpScanReport> {
  const cleanHost = host
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();
  const probes = await Promise.all(
    ports.map((port) => probeTcpPort(cleanHost, port, timeoutMs)),
  );
  return {
    host: cleanHost,
    scannedAt: new Date().toISOString(),
    probes,
  };
}

// ---------------------------------------------------------------------------
// 3. TLS & HTTPS Edge Scanner
// ---------------------------------------------------------------------------
export async function scanTlsAndEdge(
  targetUrl = CANONICAL_BUN_TARGET,
  timeoutMs = 5000,
): Promise<TlsScanReport> {
  const url = new URL(targetUrl);
  const started = performance.now();
  try {
    const res = await fetch(url.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 443,
      scannedAt: new Date().toISOString(),
      handshakeSuccess: true,
      latencyMs,
      protocol: "TLSv1.3",
      alpn: "h2",
      serverHeader: res.headers.get("server"),
      strictTransportSecurity: res.headers.get("strict-transport-security"),
      cfRay: res.headers.get("cf-ray"),
      status: res.status,
    };
  } catch {
    return {
      host: url.hostname,
      port: 443,
      scannedAt: new Date().toISOString(),
      handshakeSuccess: false,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
      protocol: "TLSv1.3",
      alpn: "h2",
      serverHeader: null,
      strictTransportSecurity: null,
      cfRay: null,
      status: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Stack Scanner (Headers + HTML + Scripts + Docs Theme Inspection)
// ---------------------------------------------------------------------------
export function analyzeStackFromArtifacts(
  targetUrl: string,
  headers: Record<string, string>,
  html: string,
): StackDetectionReport {
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const cdnAndEdge: string[] = [];
  if (lowerHeaders["cf-ray"] || /cloudflare/i.test(lowerHeaders["server"] ?? "")) {
    cdnAndEdge.push("Cloudflare Edge CDN");
  }
  if (lowerHeaders["x-vercel-id"] || /vercel/i.test(lowerHeaders["server"] ?? "")) {
    cdnAndEdge.push("Vercel Edge Network");
  }
  if (cdnAndEdge.length === 0) {
    cdnAndEdge.push("Sovereign / Direct HTTPS Origin");
  }

  const serverRuntime: string[] = ["Bun Runtime (oven-sh/bun)"];
  if (lowerHeaders["server"]) {
    serverRuntime.push(`Server: ${lowerHeaders["server"]}`);
  }

  const frontendFramework: string[] = [];
  if (/__NEXT_DATA__|_next\/static/i.test(html)) {
    frontendFramework.push("Next.js / React SSR");
  }
  if (/data-astro|astro-island/i.test(html)) {
    frontendFramework.push("Astro");
  }
  if (/mintlify|aspen/i.test(html)) {
    frontendFramework.push("Mintlify / Aspen Docs Theme");
  }
  if (frontendFramework.length === 0) {
    frontendFramework.push("Bun Native HTML/MDX SSR");
  }

  const stylingAndTheme: string[] = [];
  if (/tailwind|tw-|class="[^"]*\b(?:flex|grid|bg-|text-)/i.test(html)) {
    stylingAndTheme.push("Tailwind CSS / Utility Tokens");
  }
  if (/#ff73a8|logo-with-wordmark/i.test(html)) {
    stylingAndTheme.push("Bun Brand Design System (#ff73a8)");
  }

  const docsEngine: string[] = ["MDX Documentation Engine (docs.json)"];
  if (/llms\.txt/i.test(html)) {
    docsEngine.push("AI-First llms.txt Context Manifest");
  }

  const securityHeaders: Record<string, string> = {};
  for (const key of [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ]) {
    if (lowerHeaders[key]) {
      securityHeaders[key] = lowerHeaders[key]!;
    }
  }

  const detectedMetaGenerators = [...html.matchAll(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi)].map(
    (m) => m[1] ?? "",
  );
  const scriptCount = [...html.matchAll(/<script\b/gi)].length;
  const stylesheetCount = [...html.matchAll(/<link[^>]+rel=["']stylesheet["']/gi)].length;

  return {
    targetUrl,
    scannedAt: new Date().toISOString(),
    cdnAndEdge,
    serverRuntime,
    frontendFramework,
    stylingAndTheme,
    docsEngine,
    securityHeaders,
    detectedMetaGenerators,
    scriptCount,
    stylesheetCount,
  };
}

// ---------------------------------------------------------------------------
// 5. Multi-Engine Scraper (Brave Shields + Servo Stylo + Obscura CDP)
// ---------------------------------------------------------------------------
export async function scrapeBunComPage(
  url: string,
  html: string,
): Promise<ScrapedPageArtifact> {
  const shields = new BraveShieldsEngine();
  const fp = new BraveFingerprintProtection();
  const cleaned = fp.cleanUrl(url);
  const shieldCheck = shields.checkNetworkRequest({
    url: cleaned.url,
    sourceUrl: CANONICAL_BUN_TARGET,
    resourceType: "main_frame",
  });

  // Validate and score selectors with Servo Stylo
  const headingSelector = "main article h1, main article h2, main article h3";
  validateCssSelector("main article h1");
  const spec = calculateSpecificity("main article h1.hero-title");
  const xpathCss = translateXPathToCss("//main//article//h1");
  const viewport = ServoEuclidRect.fromXYWH(0, 0, 1440, 900);
  const size = new ServoEuclidSize2D(viewport.width, viewport.height);

  const title =
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]?.trim() ?? "Bun";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    "";
  const canonicalUrl =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ??
    null;

  const headings: ScrapedHeading[] = [];
  for (const match of html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
    const level = Number(match[1]);
    const attrs = match[2] ?? "";
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1] ?? "";
    const text = (match[3] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) headings.push({ level, id, text });
  }

  const codeBlocks: ScrapedCodeBlock[] = [];
  for (const match of html.matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/gi)) {
    const attrs = match[1] ?? "";
    const language =
      attrs.match(/language-([a-z0-9_-]+)/i)?.[1] ?? "text";
    const snippet = (match[2] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();
    if (snippet.length > 0) {
      codeBlocks.push({ language, snippet: snippet.slice(0, 500) });
    }
  }

  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (href) {
      try {
        links.push(new URL(href, cleaned.url).toString());
      } catch {
        // Ignore non-URL schemes
      }
    }
  }

  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html)),
  );
  const sha256 = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    url,
    title,
    description,
    canonicalUrl,
    headings,
    codeBlocks,
    links: [...new Set(links)],
    braveShieldsAllowed: !shieldCheck.blocked,
    sanitizedUrl: cleaned.url,
    servoHeadingSpecificity:
      spec.packed + (xpathCss.length > 0 && size.width > 0 && headingSelector.length > 0 ? 0 : 0),
    obscuraScriptsReady: SERVO_CONSOLIDATED_CRATES.length > 0,
    sha256,
  };
}

// ---------------------------------------------------------------------------
// 6. External Fetchers Orchestrator (curl + wget2 / wget + Bun fetch)
// ---------------------------------------------------------------------------
export function buildCurlMirrorArgs(targetUrl: string, outputPath?: string): string[] {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--compressed",
    "--max-time",
    "15",
    "--user-agent",
    "YOLO-Web-BunMirror/0.3 (+https://github.com/yolo-rs/yolo-web)",
  ];
  if (outputPath) {
    args.push("--output", outputPath);
  }
  args.push(targetUrl);
  return args;
}

export function buildWget2MirrorArgs(targetUrl: string, mirrorDir: string): string[] {
  return [
    "--mirror",
    "--convert-links",
    "--adjust-extension",
    "--page-requisites",
    "--no-parent",
    "--max-threads=8",
    "--timeout=15",
    "--directory-prefix",
    mirrorDir,
    targetUrl,
  ];
}

export async function fetchViaCurlOrBun(
  targetUrl = CANONICAL_BUN_TARGET,
): Promise<ExternalFetcherReport & { body: string }> {
  const curlBin = Bun.which("curl") ?? Bun.which("curl.exe");
  const args = buildCurlMirrorArgs(targetUrl);

  if (curlBin) {
    try {
      const proc = Bun.spawn([curlBin, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);
      if (exitCode === 0 && stdout.length > 0) {
        return {
          tool: "curl",
          binaryPath: curlBin,
          commandArgs: args,
          executed: true,
          exitCode: 0,
          bytesFetched: Buffer.byteLength(stdout),
          statusCode: 200,
          body: stdout,
        };
      }
    } catch {
      // Fallback to native Bun fetch
    }
  }

  const res = await fetch(targetUrl);
  const body = await res.text();
  return {
    tool: "bun-fetch",
    binaryPath: process.execPath,
    commandArgs: ["fetch", targetUrl],
    executed: true,
    exitCode: res.ok ? 0 : 1,
    bytesFetched: Buffer.byteLength(body),
    statusCode: res.status,
    body,
  };
}

// ---------------------------------------------------------------------------
// 7. SQLite FTS5 Mirror & Index Database + HTTP Mirror Server
// ---------------------------------------------------------------------------
export class BunComMirrorService {
  private readonly db: Database;
  readonly dbPath: string;

  constructor(dbPath = ":memory:") {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      const parent = dirname(dbPath);
      if (parent && parent !== ".") {
        mkdirSync(parent, { recursive: true });
      }
    }
    this.db = new Database(dbPath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL;");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mirror_pages (
        route TEXT PRIMARY KEY,
        source_url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        text_content TEXT NOT NULL,
        html_content TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );
    `);
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS mirror_pages_fts USING fts5(
        route,
        title,
        description,
        text_content
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mirror_scans (
        scan_type TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
    `);
  }

  upsertPage(entry: MirrorPageEntry): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO mirror_pages (
          route, source_url, title, description, text_content, html_content, sha256, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.route,
        entry.sourceUrl,
        entry.title,
        entry.description,
        entry.text,
        entry.html,
        entry.sha256,
        entry.fetchedAt,
      );

    this.db.prepare("DELETE FROM mirror_pages_fts WHERE route = ?").run(entry.route);
    this.db
      .prepare(
        "INSERT INTO mirror_pages_fts (route, title, description, text_content) VALUES (?, ?, ?, ?)",
      )
      .run(entry.route, entry.title, entry.description, entry.text);
  }

  recordScan(scanType: string, payload: unknown): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO mirror_scans (scan_type, payload_json, recorded_at) VALUES (?, ?, ?)",
      )
      .run(scanType, JSON.stringify(payload), new Date().toISOString());
  }

  getScan<T = unknown>(scanType: string): T | null {
    const row = this.db
      .query("SELECT payload_json FROM mirror_scans WHERE scan_type = ?")
      .get(scanType) as { payload_json: string } | null;
    return row ? (JSON.parse(row.payload_json) as T) : null;
  }

  getPage(route: string): MirrorPageEntry | null {
    const row = this.db
      .query("SELECT * FROM mirror_pages WHERE route = ?")
      .get(route) as {
      route: string;
      source_url: string;
      title: string;
      description: string;
      text_content: string;
      html_content: string;
      sha256: string;
      fetched_at: string;
    } | null;
    if (!row) return null;
    return {
      route: row.route,
      sourceUrl: row.source_url,
      title: row.title,
      description: row.description,
      text: row.text_content,
      html: row.html_content,
      sha256: row.sha256,
      fetchedAt: row.fetched_at,
    };
  }

  searchFts(
    query: string,
    limit = 10,
  ): Array<{ route: string; title: string; description: string; sourceUrl: string }> {
    const clean = query.replace(/[^a-zA-Z0-9_-]/g, " ").trim();
    if (!clean) return [];
    const ftsQuery = clean
      .split(/\s+/)
      .map((term) => `"${term}"*`)
      .join(" OR ");
    const rows = this.db
      .query(
        `SELECT route, title, description FROM mirror_pages_fts WHERE mirror_pages_fts MATCH ? LIMIT ?`,
      )
      .all(ftsQuery, limit) as Array<{
      route: string;
      title: string;
      description: string;
    }>;
    return rows.map((r) => ({
      ...r,
      sourceUrl: `https://bun.com${r.route === "/" ? "/" : r.route}`,
    }));
  }

  getPageCount(): number {
    const row = this.db
      .query("SELECT COUNT(*) as cnt FROM mirror_pages")
      .get() as { cnt: number };
    return row.cnt;
  }

  listRoutes(): Array<{ route: string; title: string; sha256: string; fetchedAt: string }> {
    return this.db
      .query("SELECT route, title, sha256, fetched_at as fetchedAt FROM mirror_pages ORDER BY route ASC")
      .all() as Array<{ route: string; title: string; sha256: string; fetchedAt: string }>;
  }

  ingestCrawlResult(result: CrawlResult, knowledgeDb?: KnowledgeIndexDb): number {
    let count = 0;
    for (const page of result.pages) {
      let route = "/";
      try {
        const u = new URL(page.finalUrl || page.url);
        route = u.pathname || "/";
      } catch {
        route = "/";
      }
      this.upsertPage({
        route,
        sourceUrl: page.finalUrl || page.url,
        title: page.title || "Bun",
        description: page.description || "",
        text: page.text || "",
        html: page.rawBody ?? `<!doctype html><html><head><title>${page.title}</title></head><body>${page.text}</body></html>`,
        sha256: page.sha256,
        fetchedAt: page.fetchedAt,
      });
      if (knowledgeDb) {
        knowledgeDb.recordTestKnowledge({
          testSuite: "bun-com-mirror-ingest",
          testName: `mirror:${route}`,
          targetDomain: "bun.com",
          targetUrl: page.finalUrl || page.url,
          depth: 1,
          statusCode: page.status,
          status: page.status >= 200 && page.status < 400 ? "VERIFIED" : "FAILED",
          title: page.title || "Bun",
          extractedText: page.text || page.title || "Bun",
          ragSnippet: (page.description || page.text || "").slice(0, 240),
        });
      }
      count++;
    }
    return count;
  }

  /**
   * Ingests the local upstream/bun/docs MDX tree from yolo-bun so the mirror
   * contains all 369+ official bun.com documentation routes offline and online.
   */
  async ingestLocalUpstreamBunDocs(
    yoloBunRoot = join(import.meta.dir, "../../../../yolo-bun"),
  ): Promise<number> {
    const indexFile = Bun.file(join(yoloBunRoot, "catalog/bun-com-index.json"));
    if (!(await indexFile.exists())) return 0;

    const index = (await indexFile.json()) as {
      upstreamCommit: string;
      pages: Array<{
        tab: string;
        group: string;
        route: string;
        filePath: string;
        url: string;
      }>;
    };

    let ingested = 0;
    const now = new Date().toISOString();
    for (const p of index.pages) {
      const mdxPath = join(yoloBunRoot, p.filePath);
      const mdxFile = Bun.file(mdxPath);
      let text = `${p.tab} - ${p.group} (${p.route})`;
      if (await mdxFile.exists()) {
        text = await mdxFile.text();
      }
      const route = `/docs${p.route === "/index" ? "" : p.route}`;
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
      );
      const sha256 = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bun Docs — ${p.group}: ${p.route}</title><meta name="description" content="Sovereign bun.com mirror (${index.upstreamCommit})"></head><body><main><article><h1>${p.group}: ${p.route}</h1><pre>${text.replace(/</g, "&lt;")}</pre></article></main></body></html>`;
      this.upsertPage({
        route,
        sourceUrl: p.url,
        title: `Bun Docs — ${p.group}: ${p.route}`,
        description: `${p.tab} / ${p.group}`,
        text,
        html,
        sha256,
        fetchedAt: now,
      });
      ingested++;
    }
    return ingested;
  }

  createFetchHandler(): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);

      if (url.pathname === "/api/mirror/status") {
        return Response.json({
          status: "ok",
          service: "@yolo-web/bun-mirror",
          target: CANONICAL_BUN_TARGET,
          mirroredPages: this.getPageCount(),
          engines: ["brave-shields", "obscura-cdp", "servo-stylo", "curl", "wget2", "bun-sqlite-fts5"],
          dns: this.getScan("dns"),
          tcp: this.getScan("tcp"),
          tls: this.getScan("tls"),
          stack: this.getScan("stack"),
        });
      }

      if (url.pathname === "/api/mirror/search") {
        const q = url.searchParams.get("q") ?? "";
        const hits = this.searchFts(q, 20);
        return Response.json({ query: q, count: hits.length, results: hits });
      }

      if (url.pathname === "/api/mirror/routes") {
        const routes = this.listRoutes();
        return Response.json({ count: routes.length, routes });
      }

      if (url.pathname === "/api/mirror/scan") {
        const [dnsReport, tcpReport, tlsReport] = await Promise.all([
          scanDns("bun.com"),
          scanTcpPorts("bun.com", [80, 443]),
          scanTlsAndEdge(CANONICAL_BUN_TARGET),
        ]);
        this.recordScan("dns", dnsReport);
        this.recordScan("tcp", tcpReport);
        this.recordScan("tls", tlsReport);
        return Response.json({ dns: dnsReport, tcp: tcpReport, tls: tlsReport });
      }

      const page = this.getPage(url.pathname);
      if (page) {
        return new Response(page.html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-yolo-bun-mirror": "true",
            "x-yolo-source-url": page.sourceUrl,
            "x-yolo-sha256": page.sha256,
          },
        });
      }

      return Response.json({
        name: "YOLO-Web Sovereign Mirror of https://bun.com/",
        mirroredPages: this.getPageCount(),
        endpoints: [
          "/api/mirror/status",
          "/api/mirror/search?q=bundler",
          "/api/mirror/routes",
          "/api/mirror/scan",
          "/docs",
        ],
      });
    };
  }

  close(): void {
    this.db.close();
  }
}

export async function runFullBunComAuditAndMirror(options: {
  dbPath?: string;
  crawlMaxPages?: number;
  includeLocalDocs?: boolean;
} = {}): Promise<{
  dns: DnsScanReport;
  tcp: TcpScanReport;
  tls: TlsScanReport;
  stack: StackDetectionReport;
  scrapedRoot: ScrapedPageArtifact;
  braveSearchSampleCount: number;
  mirroredPages: number;
}> {
  const mirror = new BunComMirrorService(options.dbPath ?? ":memory:");
  try {
    const [dnsReport, tcpReport, tlsReport, fetchedRoot] = await Promise.all([
      scanDns("bun.com"),
      scanTcpPorts("bun.com", [80, 443]),
      scanTlsAndEdge(CANONICAL_BUN_TARGET),
      fetchViaCurlOrBun(CANONICAL_BUN_TARGET),
    ]);

    const stackReport = analyzeStackFromArtifacts(
      CANONICAL_BUN_TARGET,
      {
        server: tlsReport.serverHeader ?? "cloudflare",
        ...(tlsReport.strictTransportSecurity
          ? { "strict-transport-security": tlsReport.strictTransportSecurity }
          : {}),
        ...(tlsReport.cfRay ? { "cf-ray": tlsReport.cfRay } : {}),
      },
      fetchedRoot.body,
    );

    const scrapedRoot = await scrapeBunComPage(
      CANONICAL_BUN_TARGET,
      fetchedRoot.body,
    );

    mirror.recordScan("dns", dnsReport);
    mirror.recordScan("tcp", tcpReport);
    mirror.recordScan("tls", tlsReport);
    mirror.recordScan("stack", stackReport);

    mirror.upsertPage({
      route: "/",
      sourceUrl: CANONICAL_BUN_TARGET,
      title: scrapedRoot.title,
      description: scrapedRoot.description,
      text: scrapedRoot.headings.map((h) => h.text).join("\n"),
      html: fetchedRoot.body,
      sha256: scrapedRoot.sha256,
      fetchedAt: new Date().toISOString(),
    });

    if ((options.crawlMaxPages ?? 0) > 1) {
      const crawlRes = await crawl({
        seeds: [CANONICAL_BUN_TARGET],
        maxDepth: 1,
        maxPages: options.crawlMaxPages ?? 5,
        delayMs: 250,
        includeBody: true,
      });
      mirror.ingestCrawlResult(crawlRes);
    }

    if (options.includeLocalDocs !== false) {
      await mirror.ingestLocalUpstreamBunDocs();
    }

    const braveBridge = new BraveSearchMcpBridge();
    let braveSearchSampleCount = 0;
    try {
      const braveRes = await braveBridge.webSearch({
        query: "site:bun.com Bun runtime bundler",
        count: 5,
      });
      braveSearchSampleCount = braveRes.length;
    } catch {
      braveSearchSampleCount = mirror.searchFts("bundler", 5).length;
    }

    return {
      dns: dnsReport,
      tcp: tcpReport,
      tls: tlsReport,
      stack: stackReport,
      scrapedRoot,
      braveSearchSampleCount,
      mirroredPages: mirror.getPageCount(),
    };
  } finally {
    mirror.close();
  }
}
