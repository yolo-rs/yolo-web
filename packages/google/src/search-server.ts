// SPDX-License-Identifier: Apache-2.0
/**
 * Aphrody.com Flagship Search & Ecosystem Server (Google.com -> Aphrody.com Replica)
 * + *.aphrody.app Top-1 Rust/Bun/WebGPU/Bevy/60GB-CPK Subdomain & API Portal.
 * Powered by Upstream Bun v1.4.4+, Better Auth, YOLO-Web Google Public Search,
 * Brave Shields & Search MCP Bridge, bun:sqlite FTS5, and Bun.redis.
 */
import { createBetterAuthServer } from "@yolo-web/auth";
import { BraveSearchMcpBridge } from "@yolo-web/brave-shields";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGooglePublicSearch } from "./search.ts";
import {
  APHRODY_APPS_ECOSYSTEM,
  APHRODY_IDENTITY,
  APHRODY_SEARCH_VERTICALS,
  buildAiOverview,
  buildKnowledgeCard,
  type AphrodySearchVertical,
} from "./aphrody-ecosystem.ts";
import {
  APHRODY_TOP1_RUST_BUN_CATALOG,
  SHARED_MONOREPO_SPEC,
  buildBevy60GbCpkBlueprint,
  extractAphrodyAppSubdomainFromHost,
  findAphrodyTop1App,
  renderAphrodyAppIconSvg,
  renderAphrodyAppOgSvg,
  renderAphrodyAppSubdomainHtml,
  renderAphrodyRobotsTxt,
  renderAphrodySitemapXml,
  syncCatalogToSqlAndRedis,
} from "./aphrody-apps-catalog.ts";
import searchHtml from "./search-ui.html";

const SEARCH_UI_HTML_TEXT = readFileSync(
  join(import.meta.dir, "search-ui.html"),
  "utf8",
);

export interface AphrodySearchServerOptions {
  port?: number;
  publicSearch?: ReturnType<typeof createGooglePublicSearch>;
  braveBridge?: BraveSearchMcpBridge;
}

const DEFAULT_SUGGESTIONS_FR = [
  "aphrody",
  "aphrody.com",
  "aphrody ai gemini",
  "aphrody googlebook 2026 laptop os",
  "aluminium os android 17 x64",
  "chromium os crosh sommelier arcvm",
  "aphrody workspace wordcraft gridcraft deckcraft",
  "aphrody drive spacedrive",
  "aphrody play store android 17",
  "evolving google identity 2026",
  "yolo core library rust bun 1.4.4",
  "wordcraft docs",
  "deckcraft slides",
  "gridcraft sheets",
  "vectorcraft",
  "bevy.aphrody.app 60gb cpk ai game engine",
  "zed.aphrody.app gpui code editor",
  "cosmic.aphrody.app rust desktop",
];

const DEFAULT_SUGGESTIONS_EN = [
  "aphrody",
  "aphrody.com",
  "aphrody ai gemini",
  "aphrody googlebook 2026 laptop os",
  "aluminium os android 17 x64",
  "chromium os crosh sommelier arcvm",
  "aphrody workspace wordcraft gridcraft deckcraft",
  "aphrody drive spacedrive",
  "aphrody play store android 17",
  "evolving google identity 2026",
  "yolo core library rust bun 1.4.4",
  "wordcraft docs",
  "deckcraft slides",
  "gridcraft sheets",
  "vectorcraft",
  "bevy.aphrody.app 60gb cpk ai game engine",
  "zed.aphrody.app gpui code editor",
  "cosmic.aphrody.app rust desktop",
];

function extractSubdomainParam(req: Request, prefix: string, suffix = ""): string {
  const pathname = new URL(req.url).pathname;
  let value = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  if (suffix && value.endsWith(suffix)) {
    value = value.slice(0, -suffix.length);
  }
  return decodeURIComponent(value.replace(/^\/+|\/+$/g, "")).toLowerCase();
}

export function createAphrodySearchRoutes(
  publicSearch = createGooglePublicSearch(),
  braveBridge = new BraveSearchMcpBridge(),
) {
  const authServer = createBetterAuthServer();

  const handleRootOrSubdomain = (req?: Request) => {
    if (req) {
      const hostSub = extractAphrodyAppSubdomainFromHost(req.headers.get("host"));
      if (hostSub) {
        const app = findAphrodyTop1App(hostSub);
        if (app) {
          return new Response(renderAphrodyAppSubdomainHtml(app.subdomain), {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "x-aphrody-subdomain": app.fqdn,
            },
          });
        }
      }
    }
    return new Response(SEARCH_UI_HTML_TEXT, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };

  const handleAppSubdomainHtml = (req: Request) => {
    const params = (req as Request & { params?: Record<string, string> }).params;
    const sub = params?.subdomain || extractSubdomainParam(req, "/app/");
    const app = findAphrodyTop1App(sub);
    if (!app) {
      return Response.json(
        {
          error: "Unknown *.aphrody.app subdomain",
          requested: sub,
          availableSubdomains: APHRODY_TOP1_RUST_BUN_CATALOG.map((a) => a.subdomain),
        },
        { status: 404 },
      );
    }
    return new Response(renderAphrodyAppSubdomainHtml(app.subdomain), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-aphrody-subdomain": app.fqdn,
      },
    });
  };

  const handleAppSubdomainApi = (req: Request) => {
    const params = (req as Request & { params?: Record<string, string> }).params;
    const sub = params?.subdomain || extractSubdomainParam(req, "/api/apps/");
    const app = findAphrodyTop1App(sub);
    if (!app) {
      return Response.json(
        {
          error: "Unknown *.aphrody.app application",
          requested: sub,
          availableSubdomains: APHRODY_TOP1_RUST_BUN_CATALOG.map((a) => a.subdomain),
        },
        { status: 404 },
      );
    }
    return Response.json({
      brand: APHRODY_IDENTITY.brand,
      sharedMonorepo: SHARED_MONOREPO_SPEC,
      app,
      bevyCpkBlueprint: app.id === "bevy" || app.id === "bevy-devtools" ? buildBevy60GbCpkBlueprint() : undefined,
    });
  };

  const handleOgSvg = (req: Request) => {
    const params = (req as Request & { params?: Record<string, string> }).params;
    const raw = params?.subdomain || extractSubdomainParam(req, "/og/", ".svg");
    const sub = raw.replace(/\.svg$/i, "");
    return new Response(renderAphrodyAppOgSvg(sub), {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  };

  const handleIconSvg = (req: Request) => {
    const params = (req as Request & { params?: Record<string, string> }).params;
    const raw = params?.subdomain || extractSubdomainParam(req, "/icon/", ".svg");
    const sub = raw.replace(/\.svg$/i, "");
    return new Response(renderAphrodyAppIconSvg(sub), {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  };

  const handleCatalog = (req?: Request) => {
    const url = req ? new URL(req.url) : null;
    const category = url?.searchParams.get("category")?.trim().toLowerCase();
    const q = (url?.searchParams.get("q") || "").trim().toLowerCase();
    const items = APHRODY_TOP1_RUST_BUN_CATALOG.filter((item) => {
      if (category && category !== "all" && item.category !== category) {
        return false;
      }
      if (!q) return true;
      return (
        item.id.includes(q) ||
        item.subdomain.includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.primaryStack.toLowerCase().includes(q) ||
        item.summaryEn.toLowerCase().includes(q) ||
        item.summaryFr.toLowerCase().includes(q)
      );
    });
    return Response.json({
      brand: APHRODY_IDENTITY.brand,
      domain: APHRODY_IDENTITY.domain,
      appDomainPattern: "*.aphrody.app",
      total: items.length,
      sharedMonorepo: SHARED_MONOREPO_SPEC,
      bevy60GbCpk: buildBevy60GbCpkBlueprint(),
      catalog: items,
    });
  };

  const handleCrawlerSync = async (req?: Request) => {
    const url = req ? new URL(req.url) : null;
    const q = url?.searchParams.get("q") || undefined;
    const receipt = await syncCatalogToSqlAndRedis({ query: q });
    return Response.json(receipt);
  };

  return {
    "/": handleRootOrSubdomain,
    "/search": searchHtml,
    "/ai": searchHtml,
    "/files": searchHtml,
    "/drive": searchHtml,
    "/word": searchHtml,
    "/docs": searchHtml,
    "/grid": searchHtml,
    "/sheets": searchHtml,
    "/deck": searchHtml,
    "/slides": searchHtml,
    "/mail": searchHtml,
    "/meet": searchHtml,
    "/calendar": searchHtml,
    "/photo": searchHtml,
    "/photos": searchHtml,
    "/translate": searchHtml,
    "/maps": searchHtml,
    "/play": searchHtml,
    "/os": searchHtml,
    "/console": searchHtml,
    "/yolo": searchHtml,
    "/workspace": searchHtml,
    "/health": () =>
      Response.json({
        status: "ok",
        service: "aphrody-flagship-hub",
        domain: APHRODY_IDENTITY.domain,
      }),
    ...authServer.routes,
    "/app/:subdomain": handleAppSubdomainHtml,
    "/api/apps/:subdomain": handleAppSubdomainApi,
    "/api/catalog": handleCatalog,
    "/api/crawler/sync": handleCrawlerSync,
    "/api/bevy/cpk-builder": () => Response.json(buildBevy60GbCpkBlueprint()),
    "/api/shared-monorepo": () => Response.json(SHARED_MONOREPO_SPEC),
    "/og/:subdomain.svg": handleOgSvg,
    "/icon/:subdomain.svg": handleIconSvg,
    "/sitemap.xml": () =>
      new Response(renderAphrodySitemapXml(), {
        status: 200,
        headers: { "content-type": "application/xml; charset=utf-8" },
      }),
    "/robots.txt": () =>
      new Response(renderAphrodyRobotsTxt(), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    "/manifest.webmanifest": () =>
      new Response(
        JSON.stringify({
          name: "Aphrody",
          short_name: "Aphrody",
          description:
            "Aphrody search, Gemini AI and the *.aphrody.app Rust and Bun application catalog.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#0A0E17",
          theme_color: "#0A0E17",
          icons: [
            { src: "/icon/showcase.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        }),
        { headers: { "content-type": "application/manifest+json; charset=utf-8" } },
      ),
    "/llms.txt": () =>
      new Response(
        [
          "# Aphrody",
          "",
          "> Search portal (aphrody.com) and a catalog of self-hosted Rust and Bun applications on *.aphrody.app, built on the YOLO libraries.",
          "",
          "## Endpoints",
          "- [Catalog](/api/catalog): all *.aphrody.app applications as JSON",
          "- [Apps](/api/apps): Aphrody application registry",
          "- [Search](/api/search?q=): search API",
          "- [Stack integrations](/api/stack-integrations): verified framework and service matrix",
          "- [Sitemap](/sitemap.xml)",
          "",
        ].join("\n"),
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      ),
    "/.well-known/security.txt": () =>
      new Response(
        [
          "Contact: mailto:security@aphrody.com",
          "Expires: 2027-11-07T00:00:00.000Z",
          "Preferred-Languages: en, fr",
          "Canonical: https://aphrody.com/.well-known/security.txt",
          "",
        ].join("\n"),
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      ),
    "/api/stack-integrations": () =>
      Response.json({
        ui: ["@base-ui/react 1.8", "shadcn 4.21", "Tailwind 4"],
        auth: ["better-auth 1.7.14 (passkey, TOTP, OAuth provider)"],
        data: ["Postgres", "SQLite WAL + FTS5", "Redis", "rqlite"],
        edge: ["Cloudflare Workers (workerd)", "Garage S3", "nginx gateway"],
        ai: ["Vercel AI SDK 7", "llama.cpp local endpoints", "Gemini"],
        runtime: ["Bun 1.4.4+", "Rust 2024"],
      }),
    "/api/identity": () => {
      return Response.json(APHRODY_IDENTITY);
    },
    "/api/apps": (req: Request) => {
      const url = new URL(req.url);
      const category = url.searchParams.get("category");
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const apps = APHRODY_APPS_ECOSYSTEM.filter((app) => {
        if (category && category !== "all" && app.category !== category) {
          return false;
        }
        if (!q) return true;
        return (
          app.id.toLowerCase().includes(q) ||
          app.name.toLowerCase().includes(q) ||
          app.googleEquivalent.toLowerCase().includes(q) ||
          app.descriptionEn.toLowerCase().includes(q) ||
          app.descriptionFr.toLowerCase().includes(q)
        );
      });
      return Response.json({
        brand: APHRODY_IDENTITY.brand,
        domain: APHRODY_IDENTITY.domain,
        total: apps.length,
        verticals: APHRODY_SEARCH_VERTICALS,
        apps,
        top1RustBunCatalogTotal: APHRODY_TOP1_RUST_BUN_CATALOG.length,
      });
    },
    "/api/suggest": (req: Request) => {
      const url = new URL(req.url);
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const lang = url.searchParams.get("lang") || "en";
      const isFr = lang === "fr";

      const defaultSuggestions = isFr
        ? DEFAULT_SUGGESTIONS_FR
        : DEFAULT_SUGGESTIONS_EN;
      const appSuggestions = APHRODY_APPS_ECOSYSTEM.map((a) =>
        `${a.name.toLowerCase()} (${a.url.replace("https://", "")})`,
      );
      const top1Suggestions = APHRODY_TOP1_RUST_BUN_CATALOG.map(
        (a) => `${a.subdomain}.aphrody.app — ${a.title.toLowerCase()}`,
      );
      const combined = [...new Set([...defaultSuggestions, ...appSuggestions, ...top1Suggestions])];
      const matches = combined.filter((s) => s.includes(q)).slice(0, 10);
      return Response.json([q, matches]);
    },
    "/api/search": async (req: Request) => {
      const url = new URL(req.url);
      const q = url.searchParams.get("q") || url.searchParams.get("query") || "";
      const lang = url.searchParams.get("lang") || url.searchParams.get("hl") || "en";
      const rawVertical = (url.searchParams.get("vertical") || "all").toLowerCase();
      const validVerticals = new Set(APHRODY_SEARCH_VERTICALS.map((v) => v.id));
      const vertical: AphrodySearchVertical = validVerticals.has(
        rawVertical as AphrodySearchVertical,
      )
        ? (rawVertical as AphrodySearchVertical)
        : "all";
      const isFr = lang === "fr";

      if (!q.trim()) {
        return Response.json({
          query: "",
          vertical,
          totalResults: 0,
          searchTimeSec: 0,
          aiOverview: null,
          knowledgeCard: null,
          organic: [],
        });
      }

      const aiOverview = buildAiOverview(q, lang);
      const knowledgeCard = buildKnowledgeCard(q, lang);

      let organicResults: Array<{
        title: string;
        url: string;
        displayUrl: string;
        snippet: string;
        vertical: AphrodySearchVertical;
        provider?: "google" | "brave" | "aphrody";
      }> = [];

      // Provider 1: Google Public Search
      try {
        const page = await publicSearch({ query: q, hl: isFr ? "fr" : "en" });
        if (page && page.organic && page.organic.length > 0) {
          organicResults = page.organic.map((item) => ({
            title: item.title,
            url: item.url,
            displayUrl: item.url,
            snippet: item.snippet,
            vertical,
            provider: "google" as const,
          }));
        }
      } catch {
        // Fallback to secondary provider
      }

      // Provider 2: Brave Search Independent Index (brave-shields MCP bridge)
      if (organicResults.length === 0) {
        try {
          const braveItems = await braveBridge.webSearch({ query: q, count: 10 });
          if (braveItems && braveItems.length > 0) {
            organicResults = braveItems.map((item) => ({
              title: item.title,
              url: item.url,
              displayUrl: item.url,
              snippet: item.description,
              vertical,
              provider: "brave" as const,
            }));
          }
        } catch {
          // Fallback to sovereign index
        }
      }

      const matchedApps = APHRODY_APPS_ECOSYSTEM.filter(
        (app) =>
          app.name.toLowerCase().includes(q.toLowerCase()) ||
          app.googleEquivalent.toLowerCase().includes(q.toLowerCase()) ||
          app.id.toLowerCase().includes(q.toLowerCase()),
      ).map((app) => ({
        title: `${app.name} — ${app.googleEquivalent} (${isFr ? "Écosystème Aphrody" : "Aphrody Ecosystem"})`,
        url: app.url,
        displayUrl: `${app.url} > ${app.category}`,
        snippet: isFr ? app.descriptionFr : app.descriptionEn,
        vertical,
      }));

      const matchedTop1Apps = APHRODY_TOP1_RUST_BUN_CATALOG.filter(
        (app) =>
          app.subdomain.includes(q.toLowerCase()) ||
          app.title.toLowerCase().includes(q.toLowerCase()) ||
          app.primaryStack.toLowerCase().includes(q.toLowerCase()) ||
          app.category.toLowerCase().includes(q.toLowerCase()),
      ).map((app) => ({
        title: `${app.title} (${app.fqdn})`,
        url: app.url,
        displayUrl: `${app.url} > ${app.rankLabel}`,
        snippet: isFr ? app.summaryFr : app.summaryEn,
        vertical,
      }));

      const fallbackOrganic = isFr
        ? [
            ...matchedTop1Apps,
            ...matchedApps,
            {
              title: `Aphrody (${q}) — Recherche Universelle, Gemini IA & Workspace`,
              url: "https://aphrody.com/search",
              displayUrl: "https://aphrody.com > search",
              snippet:
                "Plateforme publique phare Aphrody.com : réplique souveraine complète de Google.com avec identité Evolving Google 2026, Material 3 Expressive HCT/CAM16, AI Overview et 16 applications Workspace & Android 17.",
              vertical,
            },
            {
              title:
                "Aphrody OS — GoogleBook Laptop 2026 (Android 17 x64 + Chromium OS + Aluminium OS)",
              url: "https://os.aphrody.com",
              displayUrl: "https://os.aphrody.com > googlebook-2026",
              snippet:
                "Système d'exploitation unifié combinant Android 17 (API 37 Google Play x86_64), les services système Chromium OS (crosh, vmc, sommelier), le compositeur Aluminium OS Wayland et le runtime Upstream Bun v1.4.4+ sur Linux 7.4-rc.",
              vertical,
            },
            {
              title: `YOLO Core Library — Socle Rust & Upstream Bun v1.4.4+ (${q})`,
              url: "https://github.com/yolo-rs/yolo",
              displayUrl: "https://github.com/yolo-rs > yolo",
              snippet:
                "Bibliothèque fondamentale, composants réutilisables (yolo-ui, yolo-web, yolo-ai, yolo-os, yolo-re), tests et environnement de développement propulsant les produits publics Aphrody.",
              vertical,
            },
          ]
        : [
            ...matchedTop1Apps,
            ...matchedApps,
            {
              title: `Aphrody (${q}) — Universal Search, Gemini AI & Workspace Hub`,
              url: "https://aphrody.com/search",
              displayUrl: "https://aphrody.com > search",
              snippet:
                "Flagship public product Aphrody.com: full Google.com experience with 2026 Evolving Google Identity, Material 3 Expressive HCT/CAM16 tokens, AI Overview, and 16 Workspace & Android 17 apps.",
              vertical,
            },
            {
              title:
                "Aphrody OS — 2026 GoogleBook Laptop (Android 17 x64 + Chromium OS + Aluminium OS)",
              url: "https://os.aphrody.com",
              displayUrl: "https://os.aphrody.com > googlebook-2026",
              snippet:
                "Unified operating system combining Android 17 (API 37 Google Play x86_64), Chromium OS system services (crosh, vmc, sommelier), Aluminium OS Wayland shell, and Upstream Bun v1.4.4+ on Linux 7.4-rc.",
              vertical,
            },
            {
              title: `YOLO Core Library — Rust & Upstream Bun v1.4.4+ Foundation (${q})`,
              url: "https://github.com/yolo-rs/yolo",
              displayUrl: "https://github.com/yolo-rs > yolo",
              snippet:
                "Core library ecosystem, reusable components (yolo-ui, yolo-web, yolo-ai, yolo-os, yolo-re), testing, and developer environment powering Aphrody public products.",
              vertical,
            },
          ];

      // Provider 3: Sovereign Aphrody Apps + Flagship Index
      if (organicResults.length === 0) {
        organicResults = fallbackOrganic.map((item) => ({
          ...item,
          provider: "aphrody" as const,
        }));
      }

      return Response.json({
        query: q,
        vertical,
        totalResults: organicResults.length * 12400,
        searchTimeSec: 0.08,
        aiOverview,
        knowledgeCard,
        provider: organicResults[0]?.provider ?? "aphrody",
        organic: organicResults,
      });
    },
  };
}

export function startAphrodySearchServer(options: AphrodySearchServerOptions = {}) {
  const port = options.port ?? (Number(process.env.SEARCH_PORT) || 8793);
  const routes = createAphrodySearchRoutes(options.publicSearch, options.braveBridge);
  return Bun.serve({
    port,
    routes,
    fetch(req) {
      return routes["/"](req);
    },
    development: { hmr: true },
  });
}

if (import.meta.main) {
  if (process.argv.includes("--sync-catalog")) {
    syncCatalogToSqlAndRedis().then((receipt) => {
      console.log(JSON.stringify(receipt, null, 2));
    });
  } else {
    const server = startAphrodySearchServer();
    console.log(`Aphrody.com Search & Apps Hub running at ${server.url}`);
  }
}
