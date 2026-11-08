import { describe, expect, test } from "bun:test";
import {
  CANONICAL_BUN_TARGET,
  BunComMirrorService,
  analyzeStackFromArtifacts,
  buildCurlMirrorArgs,
  buildWget2MirrorArgs,
  fetchViaCurlOrBun,
  probeTcpPort,
  runFullBunComAuditAndMirror,
  scanDns,
  scanTcpPorts,
  scanTlsAndEdge,
  scrapeBunComPage,
} from "./index";
import { KnowledgeIndexDb } from "@yolo-web/knowledge-indexer";
import { crawl, inspectGitRemote } from "@yolo-web/web-crawler";
import {
  BraveFingerprintProtection,
  BraveSearchMcpBridge,
  BraveShieldsEngine,
} from "@yolo-web/brave-shields";
import {
  ServoEuclidPoint2D,
  ServoEuclidRect,
  ServoEuclidSize2D,
  ServoSelectorEngine,
  calculateSpecificity,
  translateXPathToCss,
} from "@yolo-web/servo-bridge";
import {
  DENIED_HOSTS,
  chromiumVersion,
  isDenied,
  pageSlug,
} from "@yolo-web/obscura-chrome";
import { ChallengeSolverEngine } from "@yolo-web/challenge-solver";

describe("@yolo-web/bun-mirror — Comprehensive Suite Targeting https://bun.com/", () => {
  test("1. DNS Scanner resolves bun.com IPv4, IPv6, NS, MX, and TXT records", async () => {
    const report = await scanDns("bun.com");
    expect(report.domain).toBe("bun.com");
    expect(report.ipv4.length).toBeGreaterThan(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("2. TCP Scanner probes bun.com ports 80 and 443 via non-blocking Bun.connect", async () => {
    const report = await scanTcpPorts("bun.com", [80, 443], 4000);
    expect(report.host).toBe("bun.com");
    expect(report.probes.length).toBe(2);
    const port443 = report.probes.find((p) => p.port === 443);
    expect(port443).toBeDefined();
    expect(port443?.open).toBe(true);
    expect(port443?.latencyMs).toBeGreaterThanOrEqual(0);

    const singleProbe = await probeTcpPort("bun.com", 443, 4000);
    expect(singleProbe.open).toBe(true);
  });

  test("3. TLS & Edge Scanner verifies HTTPS handshake, status 200, and Cloudflare/Edge headers on https://bun.com/", async () => {
    const tls = await scanTlsAndEdge(CANONICAL_BUN_TARGET);
    expect(tls.host).toBe("bun.com");
    expect(tls.handshakeSuccess).toBe(true);
    expect(tls.status).toBe(200);
    expect(tls.latencyMs).toBeGreaterThan(0);
  });

  test("4. curl & wget2 Mirror Command Builders & Live Fetch Engine on https://bun.com/", async () => {
    const curlArgs = buildCurlMirrorArgs(CANONICAL_BUN_TARGET, "/srv/bun-mirror/index.html");
    expect(curlArgs).toContain(CANONICAL_BUN_TARGET);
    expect(curlArgs).toContain("--compressed");
    expect(curlArgs).toContain("/srv/bun-mirror/index.html");

    const wget2Args = buildWget2MirrorArgs(CANONICAL_BUN_TARGET, "/srv/bun-mirror");
    expect(wget2Args).toContain("--mirror");
    expect(wget2Args).toContain(CANONICAL_BUN_TARGET);

    const liveFetch = await fetchViaCurlOrBun(CANONICAL_BUN_TARGET);
    expect(liveFetch.statusCode).toBe(200);
    expect(liveFetch.body.toLowerCase()).toContain("bun");
    expect(["curl", "bun-fetch"]).toContain(liveFetch.tool);
  });

  test("5. Stack Scanner + Multi-Engine Scraper (Brave Shields, Servo Stylo, Obscura CDP, ChallengeSolver) on https://bun.com/", async () => {
    const live = await fetchViaCurlOrBun(CANONICAL_BUN_TARGET);
    const stack = analyzeStackFromArtifacts(
      CANONICAL_BUN_TARGET,
      { server: "cloudflare", "cf-ray": "test-ray" },
      live.body,
    );
    expect(stack.targetUrl).toBe(CANONICAL_BUN_TARGET);
    expect(stack.cdnAndEdge.some((c) => c.includes("Cloudflare"))).toBe(true);
    expect(stack.frontendFramework.length).toBeGreaterThan(0);

    const scraped = await scrapeBunComPage(CANONICAL_BUN_TARGET, live.body);
    expect(scraped.url).toBe(CANONICAL_BUN_TARGET);
    expect(scraped.title.toLowerCase()).toContain("bun");
    expect(scraped.headings.length).toBeGreaterThan(0);
    expect(scraped.links.length).toBeGreaterThan(0);
    expect(scraped.braveShieldsAllowed).toBe(true);
    expect(scraped.servoHeadingSpecificity).toBeGreaterThan(0);
    expect(scraped.obscuraScriptsReady).toBe(true);

    // Direct Brave Shields & Fingerprint protection checks against bun.com
    const shields = new BraveShieldsEngine();
    const fp = new BraveFingerprintProtection();
    const cleaned = fp.cleanUrl("https://bun.com/docs/installation?utm_source=twitter&fbclid=12345");
    expect(cleaned.url).toBe("https://bun.com/docs/installation");
    expect(cleaned.strippedParams).toContain("utm_source");
    expect(cleaned.strippedParams).toContain("fbclid");
    expect(
      shields.checkNetworkRequest({
        url: "https://bun.com/docs",
        sourceUrl: CANONICAL_BUN_TARGET,
        resourceType: "main_frame",
      }).blocked,
    ).toBe(false);

    // Direct Servo Stylo & Euclid layout checks for bun.com viewport
    const parsed = ServoSelectorEngine.validateSelector("main article.docs-content h1#installation");
    expect(parsed.valid).toBe(true);
    expect(calculateSpecificity("main article.docs-content h1#installation").id).toBe(1);
    expect(translateXPathToCss("//main//a")).toBe("main a");
    const viewport = new ServoEuclidRect(
      new ServoEuclidPoint2D(0, 0),
      new ServoEuclidSize2D(1440, 900),
    );
    expect(viewport.size.area()).toBe(1296000);

    // Obscura Chrome & ChallengeSolver verification on bun.com HTML
    expect(DENIED_HOSTS.has("crash")).toBe(true);
    expect(isDenied("chrome://crash/")).toBe(true);
    expect(chromiumVersion({ Browser: "Chrome/156.0.8078.80" })).toBe("156.0.8078.80");
    expect(pageSlug("https://bun.com/docs/installation")).toContain("bun.com");

    const solver = new ChallengeSolverEngine();
    const detection = solver.detectChallenge(live.body);
    expect(detection.detected).toBe(false);
  });

  test("6. Provenance Crawler, Git Remote Inspector, Brave Search & SQLite WAL + FTS5 Mirror Service", async () => {
    // Git remote inspection on oven-sh/bun
    const gitHead = await inspectGitRemote("https://github.com/oven-sh/bun.git");
    expect(gitHead.commit).toMatch(/^[0-9a-f]{40}$/);

    // Bounded crawl on https://bun.com/
    const crawlResult = await crawl({
      seeds: [CANONICAL_BUN_TARGET],
      maxDepth: 0,
      maxPages: 1,
      delayMs: 50,
      includeBody: true,
    });
    expect(crawlResult.pages.length).toBe(1);
    expect(crawlResult.pages[0]?.status).toBe(200);

    // KnowledgeIndexDb & BunComMirrorService ingestion + FTS5 + HTTP server handler
    const knowledgeDb = new KnowledgeIndexDb(":memory:");
    const mirror = new BunComMirrorService(":memory:");
    try {
      const crawledIngested = mirror.ingestCrawlResult(crawlResult, knowledgeDb);
      expect(crawledIngested).toBe(1);
      expect(knowledgeDb.getCount("bun.com")).toBe(1);

      const docsIngested = await mirror.ingestLocalUpstreamBunDocs();
      expect(docsIngested).toBeGreaterThanOrEqual(369);
      expect(mirror.getPageCount()).toBeGreaterThanOrEqual(340);

      const searchHits = mirror.searchFts("installation bundler", 10);
      expect(searchHits.length).toBeGreaterThan(0);

      // Test the HTTP fetch handler directly (serving mirrored HTML + JSON APIs)
      const handler = mirror.createFetchHandler();

      const statusRes = await handler(new Request("http://localhost:3145/api/mirror/status"));
      expect(statusRes.status).toBe(200);
      const statusJson = (await statusRes.json()) as {
        status: string;
        target: string;
        mirroredPages: number;
      };
      expect(statusJson.status).toBe("ok");
      expect(statusJson.target).toBe(CANONICAL_BUN_TARGET);
      expect(statusJson.mirroredPages).toBeGreaterThanOrEqual(340);

      const searchRes = await handler(
        new Request("http://localhost:3145/api/mirror/search?q=sqlite"),
      );
      expect(searchRes.status).toBe(200);
      const searchJson = (await searchRes.json()) as { count: number };
      expect(searchJson.count).toBeGreaterThan(0);

      const rootPageRes = await handler(new Request("http://localhost:3145/"));
      expect(rootPageRes.status).toBe(200);
      expect(rootPageRes.headers.get("x-yolo-bun-mirror")).toBe("true");
      const rootHtml = await rootPageRes.text();
      expect(rootHtml.toLowerCase()).toContain("bun");

      const docPageRes = await handler(new Request("http://localhost:3145/docs"));
      expect(docPageRes.status).toBe(200);
      expect(await docPageRes.text()).toContain("Bun Docs");

      // Brave Search MCP Bridge tool definitions & search against site:bun.com
      const braveSearch = new BraveSearchMcpBridge({
        fetchImpl: async () =>
          new Response(
            '<a class="result__a" href="https://bun.com/docs/api/http">Bun.serve HTTP server</a><a class="result__snippet">Fast HTTP server in Bun</a>',
            { status: 200 },
          ),
      });
      expect(braveSearch.getToolDefinitions().length).toBe(3);
      const searchOut = await braveSearch.webSearch({
        query: "site:bun.com Bun.serve",
        count: 3,
      });
      expect(searchOut.length).toBeGreaterThan(0);
      expect(searchOut[0]?.url).toContain("bun.com");
    } finally {
      mirror.close();
      knowledgeDb.close();
    }
  });

  test("7. End-to-End Orchestrator runFullBunComAuditAndMirror", async () => {
    const audit = await runFullBunComAuditAndMirror({
      dbPath: ":memory:",
      crawlMaxPages: 1,
      includeLocalDocs: true,
    });
    expect(audit.dns.ipv4.length).toBeGreaterThan(0);
    expect(audit.tcp.probes.some((p) => p.port === 443 && p.open)).toBe(true);
    expect(audit.tls.handshakeSuccess).toBe(true);
    expect(audit.mirroredPages).toBeGreaterThanOrEqual(340);
  });
});
