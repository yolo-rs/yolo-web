import { describe, expect, it } from "bun:test";
import {
  createUnifiedWebTools,
  handleUnifiedWebToolCall,
  UNIFIED_WEB_PROMPTS,
  UNIFIED_WEB_RESOURCES,
} from "./tools.js";
import { createWebMcpServer } from "./server.js";

describe("@yolo-web/web-mcp - Unified MCP Server", () => {
  it("initializes MCP server instance with required capabilities", () => {
    const server = createWebMcpServer();
    expect(server).toBeDefined();
  });

  it("lists all unified tools spanning Obscura, Brave, Servo, and V8", () => {
    const tools = createUnifiedWebTools();
    expect(tools.length).toBeGreaterThanOrEqual(40);

    const names = tools.map((t) => t.name);
    // Obscura tools
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_screenshot");
    expect(names).toContain("browser_markdown");
    expect(names).toContain("browser_evaluate");

    // Brave tools
    expect(names).toContain("brave_web_search");
    expect(names).toContain("brave_llm_context");
    expect(names).toContain("brave_shields_check");

    // Servo tools
    expect(names).toContain("servo_css_specificity");
    expect(names).toContain("servo_xpath_to_css");
    expect(names).toContain("servo_parse_webvtt");

    // V8 tools
    expect(names).toContain("v8_runtime_info");
    expect(names).toContain("v8_evaluate_safe");
    expect(names).toContain("web_engine_status");
  });

  it("executes servo_css_specificity tool with accurate results", async () => {
    const res = await handleUnifiedWebToolCall("servo_css_specificity", {
      selector: "#nav > li.active",
    });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("servo-stylo");
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.components.id).toBe(1);
    expect(parsed.components.classAttrPseudo).toBe(1);
    expect(parsed.components.elementPseudoElement).toBe(1);
  });

  it("executes brave_shields_check tool and verifies tracker blocking and URL sanitization", async () => {
    const res = await handleUnifiedWebToolCall("brave_shields_check", {
      url: "https://ad.doubleclick.net/ddm/adj/N1234.site/B5678?fbclid=xyz123",
      source_url: "https://news.example.com/article",
      resource_type: "script",
    });
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.blocked).toBe(true);
    expect(parsed.sanitizedUrl).toBe(
      "https://ad.doubleclick.net/ddm/adj/N1234.site/B5678",
    );
  });

  it("executes web_engine_status tool and reports dual-runtime architecture", async () => {
    const res = await handleUnifiedWebToolCall("web_engine_status", {});
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.name).toBe("yolo-web");
    expect(parsed.monorepoPillars.servo).toBeDefined();
    expect(parsed.monorepoPillars.obscura).toBeDefined();
    expect(parsed.monorepoPillars.brave).toBeDefined();
    expect(parsed.monorepoPillars.bun).toBeDefined();
    expect(parsed.hostRuntime.runtime).toBe("bun");
  });

  it("executes chromium_upstream_status tool and audits upstream channels", async () => {
    const res = await handleUnifiedWebToolCall("chromium_upstream_status", {});
    expect(res.isError).toBeUndefined();
    const data = JSON.parse(res.content[0].text);
    expect(data.channels).toBeDefined();
    expect(data.channels.Stable).toBeDefined();
    expect(data.patches.length).toBeGreaterThanOrEqual(5);
  }, 15000);

  it("exposes prompts and resources", () => {
    expect(UNIFIED_WEB_PROMPTS.length).toBeGreaterThanOrEqual(2);
    expect(UNIFIED_WEB_RESOURCES.length).toBeGreaterThanOrEqual(3);
    const uris = UNIFIED_WEB_RESOURCES.map((r) => r.uri);
    expect(uris).toContain("web://engine/info");
    expect(uris).toContain("web://shields/rules");
  });
});
