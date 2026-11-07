import { describe, expect, test } from "bun:test";
import {
  APHRODY_APPS_ECOSYSTEM,
  APHRODY_IDENTITY,
  APHRODY_SEARCH_VERTICALS,
  buildAiOverview,
  buildKnowledgeCard,
} from "../src/aphrody-ecosystem.ts";
import { createAphrodySearchRoutes } from "../src/search-server.ts";

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
    };
    expect(appsJson.total).toBe(16);
    expect(appsJson.verticals.length).toBe(10);

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
});
