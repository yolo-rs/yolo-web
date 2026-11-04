import { describe, expect, test } from "bun:test";
import {
  BraveFingerprintProtection,
  BraveSearchMcpBridge,
  BraveShieldsEngine,
  getBaseDomain,
  isThirdPartyRequest,
} from "./index.ts";

describe("BraveShieldsEngine — Network & Cosmetic Rule Engine (adblock-rust + cookiecrumbler)", () => {
  test("blocks default third-party ad & tracker domains", () => {
    const engine = new BraveShieldsEngine();

    const doubleclick = engine.checkNetworkRequest({
      url: "https://ad.doubleclick.net/ddm/adj/N1234.site/B5678",
      sourceUrl: "https://news.example.com/article",
      resourceType: "script",
    });
    expect(doubleclick.blocked).toBe(true);
    expect(doubleclick.matchedRule).toBe("||doubleclick.net^");

    const gtmFirstParty = engine.checkNetworkRequest({
      url: "https://www.googletagmanager.com/gtm.js?id=GTM-XXXX",
      sourceUrl: "https://www.googletagmanager.com/ index.html",
      resourceType: "script",
    });
    expect(gtmFirstParty.blocked).toBe(false);

    const gtmThirdParty = engine.checkNetworkRequest({
      url: "https://www.googletagmanager.com/gtm.js?id=GTM-XXXX",
      sourceUrl: "https://shop.example.com/checkout",
      resourceType: "script",
    });
    expect(gtmThirdParty.blocked).toBe(true);
    expect(gtmThirdParty.matchedRule).toBe(
      "||googletagmanager.com^$third-party",
    );
  });

  test("enforces resource type modifiers ($script,image,xmlhttprequest)", () => {
    const engine = new BraveShieldsEngine({
      loadDefaultRules: false,
      enableCookieCrumbler: false,
      customRules: [
        "||cdn.tracker.example^$script,xmlhttprequest",
        "||ads.media.example/banner/*.jpg$image,third-party",
      ],
    });

    expect(
      engine.checkNetworkRequest({
        url: "https://cdn.tracker.example/collect.js",
        sourceUrl: "https://app.example.com",
        resourceType: "script",
      }).blocked,
    ).toBe(true);

    expect(
      engine.checkNetworkRequest({
        url: "https://cdn.tracker.example/logo.png",
        sourceUrl: "https://app.example.com",
        resourceType: "image",
      }).blocked,
    ).toBe(false);

    expect(
      engine.checkNetworkRequest({
        url: "https://ads.media.example/banner/hero-728x90.jpg",
        sourceUrl: "https://blog.other.org/post",
        resourceType: "image",
      }).blocked,
    ).toBe(true);
  });

  test("honors exception rules (@@||...) and $important override rules", () => {
    const engine = new BraveShieldsEngine({
      loadDefaultRules: false,
      enableCookieCrumbler: false,
      customRules: [
        "||analytics.example.com^",
        "@@||analytics.example.com/ essential-healthcheck.js$script",
        "@@||analytics.example.com/allow.js",
        "||analytics.example.com/override.js$important",
        "@@||analytics.example.com/override.js",
      ],
    });

    const blockedReq = engine.checkNetworkRequest({
      url: "https://analytics.example.com/beacon.js",
      sourceUrl: "https://site.org",
      resourceType: "script",
    });
    expect(blockedReq.blocked).toBe(true);

    const allowedReq = engine.checkNetworkRequest({
      url: "https://analytics.example.com/allow.js",
      sourceUrl: "https://site.org",
      resourceType: "script",
    });
    expect(allowedReq.blocked).toBe(false);
    expect(allowedReq.isException).toBe(true);
    expect(allowedReq.matchedRule).toBe("@@||analytics.example.com/allow.js");

    const importantReq = engine.checkNetworkRequest({
      url: "https://analytics.example.com/override.js",
      sourceUrl: "https://site.org",
      resourceType: "script",
    });
    expect(importantReq.blocked).toBe(true);
    expect(importantReq.isException).toBe(false);
  });

  test("extracts global, domain-scoped, and exception cosmetic filters + CookieCrumbler selectors", () => {
    const engine = new BraveShieldsEngine({
      loadDefaultRules: true,
      enableCookieCrumbler: true,
      customRules: [
        "news.example.com##.paywall-overlay",
        "~allow.example.com##.floating-promo",
        "news.example.com#@#.ad-banner",
      ],
    });

    const newsSelectors = engine.getCosmeticFiltersForUrl(
      "https://news.example.com/story",
    );
    expect(newsSelectors).toContain(".paywall-overlay");
    expect(newsSelectors).toContain(".floating-promo");
    expect(newsSelectors).toContain("#onetrust-consent-sdk");
    // Excluded via `#@#` on news.example.com
    expect(newsSelectors).not.toContain(".ad-banner");

    const allowSelectors = engine.getCosmeticFiltersForUrl(
      "https://allow.example.com/",
    );
    expect(allowSelectors).toContain(".ad-banner");
    expect(allowSelectors).not.toContain(".floating-promo");

    const css = engine.getCosmeticStylesheetForUrl(
      "https://news.example.com/story",
    );
    expect(css).toContain("display: none !important;");
  });

  test("toggles CookieCrumbler consent blocking dynamically", () => {
    const engine = new BraveShieldsEngine({
      loadDefaultRules: false,
      enableCookieCrumbler: true,
    });

    expect(
      engine.checkNetworkRequest({
        url: "https://cdn.cookielaw.org/scripttemplates/otSDKStub.js",
        sourceUrl: "https://publisher.com",
        resourceType: "script",
      }).blocked,
    ).toBe(true);

    engine.setCookieCrumblerEnabled(false);

    expect(
      engine.checkNetworkRequest({
        url: "https://cdn.cookielaw.org/scripttemplates/otSDKStub.js",
        sourceUrl: "https://publisher.com",
        resourceType: "script",
      }).blocked,
    ).toBe(false);
  });
});

describe("BraveFingerprintProtection — URL Cleaning, Headers & Shield Profiles", () => {
  test("strips tracking query parameters (fbclid, gclid, utm_source, mc_eid, msclkid) while preserving app params", () => {
    const shield = new BraveFingerprintProtection("standard");
    const dirtyUrl =
      "https://example.com/products/laptop?id=42&sort=price&utm_source=newsletter&utm_medium=email&fbclid=IwAR123456&gclid=Cj0KCQ&msclkid=998877#specs";

    const result = shield.cleanUrl(dirtyUrl);
    expect(result.url).toBe(
      "https://example.com/products/laptop?id=42&sort=price#specs",
    );
    expect(result.strippedParams).toEqual([
      "utm_source",
      "utm_medium",
      "fbclid",
      "gclid",
      "msclkid",
    ]);
  });

  test("applies Sec-GPC, DNT, and cross-origin referrer trimming according to Shield profile", () => {
    const standardShield = new BraveFingerprintProtection("standard", 12345);
    const strictShield = new BraveFingerprintProtection("strict", 12345);
    const offShield = new BraveFingerprintProtection("off", 12345);

    expect(standardShield.getProfile().farbleCanvas).toBe(true);
    expect(strictShield.getProfile().spoofedHardwareConcurrency).toBe(2);
    expect(offShield.getProfile().farbleCanvas).toBe(false);

    const headers = standardShield.sanitizeHeaders(
      { Accept: "text/html" },
      "https://analytics-cdn.other.com/Resource",
      "https://bank.example.com/account/secret-token?session=xyz",
    );
    expect(headers["Sec-GPC"]).toBe("1");
    expect(headers["DNT"]).toBe("1");
    expect(headers["Referer"]).toBe("https://bank.example.com/");

    // Deterministic domain farbling offset within [-1, 0, 1]
    const offset1 = standardShield.computeDomainFarbleOffset("example.com", 0);
    const offset2 = standardShield.computeDomainFarbleOffset("example.com", 0);
    expect(offset1).toBe(offset2);
    expect([-1, 0, 1]).toContain(offset1);
  });

  test("resolves base domains and third-party classification accurately", () => {
    expect(getBaseDomain("sub.tracker.example.co.uk")).toBe("example.co.uk");
    expect(getBaseDomain("api.brave.com")).toBe("brave.com");
    expect(
      isThirdPartyRequest(
        "https://cdn.brave.com/app.js",
        "https://search.brave.com/",
      ),
    ).toBe(false);
    expect(
      isThirdPartyRequest(
        "https://doubleclick.net/ad.js",
        "https://search.brave.com/",
      ),
    ).toBe(true);
  });
});

describe("BraveSearchMcpBridge — Pure Bun MCP Client & Tool Handler", () => {
  test("executes brave_web_search and formats MCP tool response via native fetch", async () => {
    const bridge = new BraveSearchMcpBridge({
      apiKey: "test-brave-key",
      fetchImpl: (async (input: RequestInfo | URL) => {
        const reqUrl = new URL(String(input));
        expect(reqUrl.pathname).toEndWith("/web/search");
        expect(reqUrl.searchParams.get("q")).toBe("bun runtime");
        return Response.json({
          web: {
            results: [
              {
                title: "Bun — A fast all-in-one JavaScript runtime",
                url: "https://bun.com",
                description:
                  "Bundle, test, and run TypeScript & JavaScript natively.",
              },
            ],
          },
        });
      }) as typeof fetch,
    });

    expect(bridge.getToolDefinitions().map((t) => t.name)).toEqual([
      "brave_web_search",
      "brave_local_search",
      "brave_news_search",
    ]);

    const mcpResp = await bridge.callMcpTool("brave_web_search", {
      query: "bun runtime",
      count: 5,
    });
    expect(mcpResp.content[0]?.text).toContain("https://bun.com");
  });
});
