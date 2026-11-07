import { describe, expect, test } from "bun:test";
import {
  APHRODY_APPS_ECOSYSTEM,
  APHRODY_IDENTITY,
  APHRODY_SEARCH_VERTICALS,
  buildAiOverview,
  buildKnowledgeCard,
} from "../src/aphrody-ecosystem.ts";
import {
  APHRODY_TOP1_RUST_BUN_CATALOG,
  SHARED_MONOREPO_SPEC,
  buildBevy60GbCpkBlueprint,
  renderAphrodyAppIconSvg,
  renderAphrodyAppOgSvg,
  renderAphrodyAppSubdomainHtml,
  renderAphrodySitemapXml,
  syncCatalogToSqlAndRedis,
} from "../src/aphrody-apps-catalog.ts";
import { createAphrodySearchRoutes } from "../src/search-server.ts";

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

describe("Aphrody Flagship Ecosystem & Search Server", () => {
  test("APHRODY_IDENTITY defines Evolving Google 2026 4-stop gradient and Aphrody brand palette", () => {
    expect(APHRODY_IDENTITY.brand).toBe("Aphrody");
    expect(APHRODY_IDENTITY.domain).toBe("aphrody.com");
    expect(APHRODY_IDENTITY.org).toBe("aphrody-labs");
    expect(APHRODY_IDENTITY.coreLibrary).toBe("yolo");

    const stopHexes = APHRODY_IDENTITY.evolvingGradient.stops.map((s) => s.hex);
    expect(stopHexes).toEqual(["#4285F4", "#9B72CB", "#D96570", "#F4B400"]);

    expect(APHRODY_IDENTITY.aphrodyBrandPalette.gold).toBe("#FFD700");
    expect(APHRODY_IDENTITY.aphrodyBrandPalette.violet).toBe("#7C5CFF");
    expect(APHRODY_IDENTITY.aphrodyBrandPalette.cyan).toBe("#00D4FF");
    expect(APHRODY_IDENTITY.aphrodyBrandPalette.deepNavy).toBe("#17335C");
    expect(APHRODY_IDENTITY.aphrodyBrandPalette.petMauveSeed).toBe("#8C6C88");
    expect(APHRODY_IDENTITY.m3Expressive.colorSpace).toBe("HCT/CAM16");
    expect(APHRODY_IDENTITY.m3Expressive.preset).toBe("aphrody");
  });

  test("APHRODY_SEARCH_VERTICALS defines all 10 instant SERP tabs", () => {
    const ids = APHRODY_SEARCH_VERTICALS.map((v) => v.id);
    expect(ids).toEqual([
      "all",
      "ai",
      "images",
      "videos",
      "news",
      "maps",
      "shopping",
      "books",
      "code",
      "scholar",
    ]);
  });

  test("APHRODY_APPS_ECOSYSTEM includes all 16 Google LLC -> Aphrody.com flagship apps", () => {
    expect(APHRODY_APPS_ECOSYSTEM.length).toBe(16);
    const ids = APHRODY_APPS_ECOSYSTEM.map((app) => app.id);
    expect(ids).toEqual([
      "search",
      "ai",
      "drive",
      "docs",
      "sheets",
      "slides",
      "mail",
      "meet",
      "calendar",
      "photos",
      "translate",
      "maps",
      "video",
      "play",
      "console",
      "os",
    ]);

    for (const app of APHRODY_APPS_ECOSYSTEM) {
      expect(app.url).toContain("aphrody.com");
      expect(app.androidPackage).toBeDefined();
    }
  });

  test("APHRODY_TOP1_RUST_BUN_CATALOG includes all 21 *.aphrody.app subdomains with zero emojis", () => {
    expect(APHRODY_TOP1_RUST_BUN_CATALOG.length).toBe(21);
    const subdomains = APHRODY_TOP1_RUST_BUN_CATALOG.map((item) => item.subdomain);
    expect(subdomains).toEqual([
      "zed",
      "rio",
      "nushell",
      "uncensored",
      "spacedrive",
      "cosmic",
      "bevy",
      "bevy-devtools",
      "tiny-glade",
      "veloren",
      "tunnet",
      "gpui",
      "egui",
      "iced",
      "wgpu",
      "leptos",
      "taffy",
      "awesome",
      "showcase",
      "templates",
      "docs",
    ]);

    for (const item of APHRODY_TOP1_RUST_BUN_CATALOG) {
      expect(item.fqdn).toBe(`${item.subdomain}.aphrody.app`);
      expect(item.url).toBe(`https://${item.subdomain}.aphrody.app`);
      expect(EMOJI_REGEX.test(item.title)).toBe(false);
      expect(EMOJI_REGEX.test(item.summaryEn)).toBe(false);
      expect(EMOJI_REGEX.test(item.summaryFr)).toBe(false);
    }
  });

  test("buildKnowledgeCard and buildAiOverview return structured bilingual payloads", () => {
    const cardEn = buildKnowledgeCard("GoogleBook 2026", "en");
    expect(cardEn.title).toContain("GoogleBook");
    expect(cardEn.attributes.length).toBe(4);

    const aiFr = buildAiOverview("aphrody workspace", "fr");
    expect(aiFr.model).toBe("aphrody-gemini-2.5-pro");
    expect(aiFr.summary).toContain("aphrody workspace");
    expect(aiFr.citations.length).toBe(3);
  });

  test("HTTP routes serve /api/identity, /api/apps, /api/suggest, and /api/search", async () => {
    const mockPublicSearch = async ({ query }: { query: string }) => ({
      query,
      organic: [
        {
          title: `Aphrody Flagship Result for ${query}`,
          url: `https://aphrody.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Official Aphrody.com flagship web result matching ${query}.`,
        },
        {
          title: `WordCraft Docs — ${query}`,
          url: `https://docs.aphrody.com/doc/${encodeURIComponent(query)}`,
          snippet: `Collaborate on ${query} in Aphrody WordCraft with M3 Expressive tokens.`,
        },
      ],
    });

    const routes = createAphrodySearchRoutes(
      mockPublicSearch as unknown as Parameters<typeof createAphrodySearchRoutes>[0],
    );

    // 1. GET /api/identity
    const identityRes = routes["/api/identity"]();
    expect(identityRes.status).toBe(200);
    const identityJson = (await identityRes.json()) as typeof APHRODY_IDENTITY;
    expect(identityJson.domain).toBe("aphrody.com");
    expect(identityJson.brand).toBe("Aphrody");

    // 2. GET /api/apps (all + filtered)
    const appsRes = routes["/api/apps"](new Request("http://localhost/api/apps"));
    const appsJson = (await appsRes.json()) as {
      total: number;
      apps: typeof APHRODY_APPS_ECOSYSTEM;
      verticals: typeof APHRODY_SEARCH_VERTICALS;
      top1RustBunCatalogTotal: number;
    };
    expect(appsJson.total).toBe(16);
    expect(appsJson.verticals.length).toBe(10);
    expect(appsJson.top1RustBunCatalogTotal).toBe(21);

    const workspaceRes = routes["/api/apps"](
      new Request("http://localhost/api/apps?category=workspace&q=wordcraft"),
    );
    const workspaceJson = (await workspaceRes.json()) as {
      total: number;
      apps: typeof APHRODY_APPS_ECOSYSTEM;
    };
    expect(workspaceJson.total).toBe(1);
    expect(workspaceJson.apps[0]?.id).toBe("docs");

    // 3. GET /api/suggest
    const suggestRes = routes["/api/suggest"](
      new Request("http://localhost/api/suggest?q=aphrody&lang=en"),
    );
    const suggestJson = (await suggestRes.json()) as [string, string[]];
    expect(suggestJson[0]).toBe("aphrody");
    expect(suggestJson[1].length).toBeGreaterThan(0);

    // 4. GET /api/search
    const searchRes = await routes["/api/search"](
      new Request("http://localhost/api/search?q=googlebook&lang=en&vertical=ai"),
    );
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as {
      query: string;
      vertical: string;
      organic: unknown[];
      aiOverview: { summary: string };
      knowledgeCard: { title: string } | null;
    };
    expect(searchJson.query).toBe("googlebook");
    expect(searchJson.vertical).toBe("ai");
    expect(searchJson.organic.length).toBe(2);
    expect(searchJson.aiOverview.summary).toContain("googlebook");
    expect(searchJson.knowledgeCard?.title).toContain("GoogleBook");
  });

  test("HTTP routes serve /api/catalog, /app/bevy, /app/zed, Host: bevy.aphrody.app, /api/bevy/cpk-builder, /api/crawler/sync, /og/bevy.svg, and /sitemap.xml", async () => {
    const routes = createAphrodySearchRoutes();

    // 1. GET /api/catalog
    const catalogRes = routes["/api/catalog"](new Request("http://localhost/api/catalog"));
    expect(catalogRes.status).toBe(200);
    const catalogJson = (await catalogRes.json()) as {
      total: number;
      appDomainPattern: string;
      sharedMonorepo: typeof SHARED_MONOREPO_SPEC;
      catalog: typeof APHRODY_TOP1_RUST_BUN_CATALOG;
    };
    expect(catalogJson.total).toBe(21);
    expect(catalogJson.appDomainPattern).toBe("*.aphrody.app");
    expect(catalogJson.sharedMonorepo.sharedGpuBackend.crate).toBe("wgpu");

    // 2. GET /app/bevy and GET /app/zed
    const bevyPageRes = routes["/app/:subdomain"](new Request("http://localhost/app/bevy"));
    expect(bevyPageRes.status).toBe(200);
    expect(bevyPageRes.headers.get("x-aphrody-subdomain")).toBe("bevy.aphrody.app");
    const bevyHtml = await bevyPageRes.text();
    expect(bevyHtml).toContain("Bevy Fullstack Engine");
    expect(bevyHtml).toContain("60 GB (64,424,509,440 bytes)");
    expect(bevyHtml).toContain("#0A0E17");
    expect(bevyHtml).toContain("#17335C");
    expect(bevyHtml).toContain("#FFD700");
    expect(EMOJI_REGEX.test(bevyHtml)).toBe(false);

    const zedPageRes = routes["/app/:subdomain"](new Request("http://localhost/app/zed"));
    expect(zedPageRes.status).toBe(200);
    expect(zedPageRes.headers.get("x-aphrody-subdomain")).toBe("zed.aphrody.app");
    const zedHtml = await zedPageRes.text();
    expect(zedHtml).toContain("Zed Code Editor");
    expect(zedHtml).toContain("gpui-wgpu-sdf");
    expect(EMOJI_REGEX.test(zedHtml)).toBe(false);

    // 3. Host: bevy.aphrody.app on root "/"
    const hostSubRes = routes["/"](
      new Request("http://bevy.aphrody.app/", {
        headers: { host: "bevy.aphrody.app" },
      }),
    );
    expect(hostSubRes.status).toBe(200);
    expect(hostSubRes.headers.get("x-aphrody-subdomain")).toBe("bevy.aphrody.app");
    const hostSubHtml = await hostSubRes.text();
    expect(hostSubHtml).toContain("bevy.aphrody.app");
    expect(hostSubHtml).toContain("Bevy 60 GB CRIWARE CPK");

    // 4. GET /api/apps/bevy
    const bevyApiRes = routes["/api/apps/:subdomain"](
      new Request("http://localhost/api/apps/bevy"),
    );
    expect(bevyApiRes.status).toBe(200);
    const bevyApiJson = (await bevyApiRes.json()) as {
      app: { id: string; fqdn: string };
      bevyCpkBlueprint: ReturnType<typeof buildBevy60GbCpkBlueprint>;
    };
    expect(bevyApiJson.app.id).toBe("bevy");
    expect(bevyApiJson.app.fqdn).toBe("bevy.aphrody.app");
    expect(bevyApiJson.bevyCpkBlueprint.maxArchiveBytes).toBe(64_424_509_440);

    // 5. GET /api/bevy/cpk-builder & /api/shared-monorepo
    const cpkRes = routes["/api/bevy/cpk-builder"]();
    expect(cpkRes.status).toBe(200);
    const cpkJson = (await cpkRes.json()) as ReturnType<typeof buildBevy60GbCpkBlueprint>;
    expect(cpkJson.id).toBe("bevy-cpk-60gb-ai-builder");
    expect(cpkJson.aiPipelineStages.length).toBe(4);
    expect(cpkJson.vpsNodes.length).toBe(3);

    const monoRes = routes["/api/shared-monorepo"]();
    expect(monoRes.status).toBe(200);
    const monoJson = (await monoRes.json()) as typeof SHARED_MONOREPO_SPEC;
    expect(monoJson.workspaceDependencies.wgpu).toBe("24.0.1");

    // 6. GET /api/crawler/sync (SQLite WAL + FTS5 + Redis graceful sync)
    const syncRes = await routes["/api/crawler/sync"](
      new Request("http://localhost/api/crawler/sync"),
    );
    expect(syncRes.status).toBe(200);
    const syncJson = (await syncRes.json()) as Awaited<
      ReturnType<typeof syncCatalogToSqlAndRedis>
    >;
    expect(syncJson.totalAppsSynced).toBe(21);
    expect(syncJson.fts5IndexedCount).toBe(21);
    expect(syncJson.bevyPipelinesSynced).toBe(1);
    expect(syncJson.sqliteWalEnabled).toBe(true);

    // 7. GET /og/bevy.svg and /icon/bevy.svg
    const ogRes = routes["/og/:subdomain.svg"](new Request("http://localhost/og/bevy.svg"));
    expect(ogRes.status).toBe(200);
    expect(ogRes.headers.get("content-type")).toContain("image/svg+xml");
    const ogSvg = await ogRes.text();
    expect(ogSvg).toContain("BEVY.APHRODY.APP");
    expect(EMOJI_REGEX.test(ogSvg)).toBe(false);

    const iconRes = routes["/icon/:subdomain.svg"](
      new Request("http://localhost/icon/bevy.svg"),
    );
    expect(iconRes.status).toBe(200);
    const iconSvg = await iconRes.text();
    expect(iconSvg).toContain("<svg");
    expect(EMOJI_REGEX.test(iconSvg)).toBe(false);

    // 8. GET /sitemap.xml and /robots.txt
    const sitemapRes = routes["/sitemap.xml"]();
    expect(sitemapRes.status).toBe(200);
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain("https://bevy.aphrody.app");
    expect(sitemapXml).toContain("https://zed.aphrody.app");
    expect(sitemapXml).toContain("https://cosmic.aphrody.app");

    const robotsRes = routes["/robots.txt"]();
    expect(robotsRes.status).toBe(200);
    const robotsTxt = await robotsRes.text();
    expect(robotsTxt).toContain("Sitemap: https://aphrody.com/sitemap.xml");

    // Verify helper exports directly
    expect(renderAphrodyAppOgSvg("zed")).toContain("ZED.APHRODY.APP");
    expect(renderAphrodyAppIconSvg("cosmic")).toContain("COSMIC");
    expect(renderAphrodyAppSubdomainHtml("uncensored")).toContain("8081");
    expect(renderAphrodySitemapXml()).toContain("<urlset");
  });

  test("Brave Search and Sovereign Aphrody multi-provider fallbacks", async () => {
    // Failing public search to trigger secondary provider
    const failingPublicSearch = async () => {
      throw new Error("Google upstream unavailable");
    };

    const mockBraveBridge = {
      webSearch: async ({ query }: { query: string }) => [
        {
          title: `Brave Indexed Result for ${query}`,
          url: `https://brave.com/search?q=${encodeURIComponent(query)}`,
          description: `Independent web crawl index result for ${query}.`,
        },
      ],
    };

    // Test Provider 2: Brave Search fallback
    const braveRoutes = createAphrodySearchRoutes(
      failingPublicSearch as unknown as Parameters<typeof createAphrodySearchRoutes>[0],
      mockBraveBridge as unknown as Parameters<typeof createAphrodySearchRoutes>[1],
    );

    const braveRes = await braveRoutes["/api/search"](
      new Request("http://localhost/api/search?q=chromium&lang=en"),
    );
    expect(braveRes.status).toBe(200);
    const braveJson = (await braveRes.json()) as {
      provider: string;
      organic: Array<{ title: string; provider: string }>;
    };
    expect(braveJson.provider).toBe("brave");
    expect(braveJson.organic[0]?.title).toContain("Brave Indexed Result");

    // Test Provider 3: Sovereign Aphrody fallback when both fail
    const failingBraveBridge = {
      webSearch: async () => {
        throw new Error("Brave API rate limit");
      },
    };
    const sovereignRoutes = createAphrodySearchRoutes(
      failingPublicSearch as unknown as Parameters<typeof createAphrodySearchRoutes>[0],
      failingBraveBridge as unknown as Parameters<typeof createAphrodySearchRoutes>[1],
    );

    const sovereignRes = await sovereignRoutes["/api/search"](
      new Request("http://localhost/api/search?q=wordcraft&lang=fr"),
    );
    expect(sovereignRes.status).toBe(200);
    const sovereignJson = (await sovereignRes.json()) as {
      provider: string;
      organic: Array<{ title: string; provider: string }>;
    };
    expect(sovereignJson.provider).toBe("aphrody");
    expect(sovereignJson.organic.length).toBeGreaterThan(0);
    expect(sovereignJson.organic.some((item) => item.title.includes("WordCraft"))).toBe(true);
  });
});

describe("Aphrody audit endpoints", () => {
  const routes = createAphrodySearchRoutes() as unknown as Record<
    string,
    (req: Request) => Response | Promise<Response>
  >;
  const call = async (path: string) =>
    await routes[path]!(new Request(`http://aphrody.test${path}`));

  test("manifest is valid JSON with theme color and icon", async () => {
    const res = await call("/manifest.webmanifest");
    const body = (await res.json()) as { theme_color: string; icons: unknown[] };
    expect(res.status).toBe(200);
    expect(body.theme_color).toBe("#0A0E17");
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test("llms.txt and security.txt are plain text without emojis", async () => {
    for (const path of ["/llms.txt", "/.well-known/security.txt"]) {
      const res = await call(path);
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(EMOJI_REGEX.test(text)).toBe(false);
    }
    expect(await (await call("/.well-known/security.txt")).text()).toContain("Contact:");
  });

  test("stack integrations lists auth and runtime", async () => {
    const body = (await (await call("/api/stack-integrations")).json()) as Record<string, string[]>;
    expect(body.auth?.[0]).toContain("better-auth");
    expect(body.runtime).toContain("Bun 1.4.4+");
  });
});

describe("Aphrody HTML accessibility markers", () => {
  const page = renderAphrodyAppSubdomainHtml(APHRODY_TOP1_RUST_BUN_CATALOG[0]!.subdomain);
  test("generated portal has skip link, main landmark, theme color and manifest", () => {
    expect(page).toContain('class="skip-link"');
    expect(page).toContain('<main id="main-content"');
    expect(page).toContain('name="theme-color"');
    expect(page).toContain('rel="manifest"');
    expect(page).toContain("prefers-reduced-motion");
  });

  test("search-ui has the same landmarks and no banned fonts", async () => {
    const html = await Bun.file(new URL("../src/search-ui.html", import.meta.url)).text();
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('<main id="main-content">');
    expect(html).toContain('rel="manifest"');
    expect(/font-family:[^;]*\b(Roboto|Inter)\b/.test(html)).toBe(false);
  });
});
