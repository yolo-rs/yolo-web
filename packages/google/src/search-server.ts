// SPDX-License-Identifier: Apache-2.0
/**
 * Aphrody.com Flagship Search & Ecosystem Server (Google.com -> Aphrody.com Replica)
 * Powered by Upstream Bun v1.4.4+, Better Auth, YOLO-Web Google Public Search,
 * Brave Shields & Search MCP Bridge, and Vercel AI SDK.
 */
import { createBetterAuthServer } from "@yolo-web/auth";
import { BraveSearchMcpBridge } from "@yolo-web/brave-shields";
import { createGooglePublicSearch } from "./search.ts";
import {
  APHRODY_APPS_ECOSYSTEM,
  APHRODY_IDENTITY,
  APHRODY_SEARCH_VERTICALS,
  buildAiOverview,
  buildKnowledgeCard,
  type AphrodySearchVertical,
} from "./aphrody-ecosystem.ts";
import searchHtml from "./search-ui.html";

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
];

export function createAphrodySearchRoutes(
  publicSearch = createGooglePublicSearch(),
  braveBridge = new BraveSearchMcpBridge(),
) {
  const authServer = createBetterAuthServer();

  return {
    "/": searchHtml,
    "/search": searchHtml,
    ...authServer.routes,
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
      const combined = [...new Set([...defaultSuggestions, ...appSuggestions])];
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

      const fallbackOrganic = isFr
        ? [
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
    development: { hmr: true },
  });
}

if (import.meta.main) {
  const server = startAphrodySearchServer();
  console.log(`Aphrody.com Search & Apps Hub running at ${server.url}`);
}
