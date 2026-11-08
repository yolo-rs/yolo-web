#!/usr/bin/env bun
/**
 * @yolo-web/bun-mirror CLI
 *
 * Sovereign Pure Bun CLI for indexing, mirroring, crawling, scraping,
 * stack scanning, DNS scanning, TCP scanning, and TLS scanning of https://bun.com/.
 */

import {
  CANONICAL_BUN_TARGET,
  BunComMirrorService,
  analyzeStackFromArtifacts,
  buildCurlMirrorArgs,
  buildWget2MirrorArgs,
  fetchViaCurlOrBun,
  runFullBunComAuditAndMirror,
  scanDns,
  scanTcpPorts,
  scanTlsAndEdge,
  scrapeBunComPage,
} from "./index";

export async function runBunMirrorCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const action = argv[0] ?? "audit";
  const dbIdx = argv.indexOf("--db");
  const dbPath = dbIdx !== -1 && argv[dbIdx + 1] ? argv[dbIdx + 1]! : ":memory:";
  const portIdx = argv.indexOf("--port");
  const port = portIdx !== -1 && argv[portIdx + 1] ? Number(argv[portIdx + 1]) : 3145;
  const maxPagesIdx = argv.indexOf("--max-pages");
  const maxPages = maxPagesIdx !== -1 && argv[maxPagesIdx + 1] ? Number(argv[maxPagesIdx + 1]) : 5;

  if (action === "scan") {
    const [dns, tcp, tls, rootRes] = await Promise.all([
      scanDns("bun.com"),
      scanTcpPorts("bun.com", [80, 443]),
      scanTlsAndEdge(CANONICAL_BUN_TARGET),
      fetchViaCurlOrBun(CANONICAL_BUN_TARGET),
    ]);
    const stack = analyzeStackFromArtifacts(
      CANONICAL_BUN_TARGET,
      {
        server: tls.serverHeader ?? "cloudflare",
        ...(tls.strictTransportSecurity
          ? { "strict-transport-security": tls.strictTransportSecurity }
          : {}),
        ...(tls.cfRay ? { "cf-ray": tls.cfRay } : {}),
      },
      rootRes.body,
    );
    console.log(JSON.stringify({ dns, tcp, tls, stack }, null, 2));
    return;
  }

  if (action === "scrape") {
    const targetUrl = argv[1] && !argv[1].startsWith("--") ? argv[1] : CANONICAL_BUN_TARGET;
    const fetched = await fetchViaCurlOrBun(targetUrl);
    const artifact = await scrapeBunComPage(targetUrl, fetched.body);
    console.log(JSON.stringify({ tool: fetched.tool, statusCode: fetched.statusCode, artifact }, null, 2));
    return;
  }

  if (action === "commands") {
    const outDir = argv[1] ?? "/srv/bun-mirror/static";
    console.log(
      JSON.stringify(
        {
          curl: buildCurlMirrorArgs(CANONICAL_BUN_TARGET, `${outDir}/index.html`),
          wget2: buildWget2MirrorArgs(CANONICAL_BUN_TARGET, outDir),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (action === "deploy-prod") {
    const { deployBunMirrorToProd } = await import("./deploy-prod");
    const code = await deployBunMirrorToProd();
    if (code !== 0) process.exit(code);
    return;
  }

  if (action === "serve") {
    const mirror = new BunComMirrorService(dbPath);
    if (mirror.getPageCount() === 0) {
      await mirror.ingestLocalUpstreamBunDocs();
      const rootFetch = await fetchViaCurlOrBun(CANONICAL_BUN_TARGET);
      const scraped = await scrapeBunComPage(CANONICAL_BUN_TARGET, rootFetch.body);
      mirror.upsertPage({
        route: "/",
        sourceUrl: CANONICAL_BUN_TARGET,
        title: scraped.title,
        description: scraped.description,
        text: scraped.headings.map((h) => h.text).join("\n"),
        html: rootFetch.body,
        sha256: scraped.sha256,
        fetchedAt: new Date().toISOString(),
      });
    }
    const server = Bun.serve({
      port,
      hostname: "0.0.0.0",
      fetch: mirror.createFetchHandler(),
    });
    console.log(
      JSON.stringify(
        {
          status: "listening",
          url: `http://0.0.0.0:${server.port}`,
          dbPath,
          mirroredPages: mirror.getPageCount(),
        },
        null,
        2,
      ),
    );
    return;
  }

  // Default: full audit + crawl + index
  const report = await runFullBunComAuditAndMirror({
    dbPath,
    crawlMaxPages: maxPages,
    includeLocalDocs: true,
  });
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) {
  await runBunMirrorCli();
}
