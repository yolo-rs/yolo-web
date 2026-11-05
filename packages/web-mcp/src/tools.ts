/**
 * @yolo-web/web-mcp - Unified Tool Catalog
 * Fuses Obscura MCP tools, Brave Search MCP tools, Servo Bridge tools, and V8/Chromium inspection tools.
 */

import {
  BraveShieldsEngine,
  BraveFingerprintProtection,
  BraveSearchMcpBridge,
} from "@yolo-web/brave-shields";
import {
  calculateSpecificity,
  validateCssSelector,
  translateXPathToCss,
  parseWebVtt,
} from "@yolo-web/servo-bridge";
import {
  BunHostRuntimeInfo,
  V8PageIsolateConfig,
} from "@yolo-web/bun-v8-bridge";
import {
  ChallengeSolverEngine,
  CHROMIUM_2026_DEFAULT_PROFILE,
} from "@yolo-web/challenge-solver";
import { ChromiumTrackingEngine } from "@yolo-web/chromium-tracker";
import { executeBrowserTool } from "./cdp-tools";

export interface UnifiedTool {
  name: string;
  description: string;
  category:
    | "browser-automation"
    | "search-intelligence"
    | "servo-dom-geometry"
    | "v8-chromium-engine";
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const UNIFIED_WEB_PROMPTS = [
  {
    name: "web_deep_research",
    description:
      "Multi-step web research combining Brave search grounding with live Obscura/Chromium page scraping and markdown synthesis",
    arguments: [
      {
        name: "query",
        description: "The topic or research question",
        required: true,
      },
      {
        name: "max_sources",
        description: "Maximum number of distinct web sources to visit",
        required: false,
      },
    ],
  },
  {
    name: "web_visual_audit",
    description:
      "Navigate to a page, apply Brave Shields adblock, inspect Servo layout geometry, and capture full viewport screenshot and PDF",
    arguments: [
      { name: "url", description: "The URL to visually audit", required: true },
    ],
  },
];

export const UNIFIED_WEB_RESOURCES = [
  {
    uri: "web://engine/info",
    name: "Unified Web Engine Status",
    description:
      "Live runtime information across Host Bun (WebKit/JSC) and Guest Browser (Chromium V8 + Servo + Obscura + Brave)",
    mimeType: "application/json",
  },
  {
    uri: "web://shields/rules",
    name: "Active Brave Shields Rules",
    description:
      "Catalog of active adblock, tracker, and cookie banner rules in effect",
    mimeType: "application/json",
  },
  {
    uri: "web://architecture/blueprint",
    name: "2026 Scraper, Crawler, and Dual-Runtime Blueprint",
    description: "Architectural specification for the unified browser monorepo",
    mimeType: "text/markdown",
  },
];

/**
 * All 38 Obscura browser automation tools consolidated from `crates/obscura-mcp/src/lib.rs`.
 */
export const OBSCURA_EXTENDED_TOOLS: UnifiedTool[] = [
  {
    name: "browser_navigate",
    description: "Navigate current tab to an HTTP/HTTPS or file URL",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "browser_snapshot",
    description:
      "Take an accessibility/DOM snapshot assigning stable ref identifiers (e.g. 'e1')",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_click",
    description: "Click an interactive element by ref or CSS selector",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" }, ref: { type: "string" } },
    },
  },
  {
    name: "browser_fill",
    description: "Clear and set value of form inputs or textareas",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        ref: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
    },
  },
  {
    name: "browser_type",
    description: "Type text character-by-character into an element",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        ref: { type: "string" },
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "browser_press_key",
    description: "Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
  },
  {
    name: "browser_select_option",
    description: "Select an option from a <select> dropdown by value",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        ref: { type: "string" },
        value: { type: "string" },
      },
      required: ["value"],
    },
  },
  {
    name: "browser_evaluate",
    description: "Evaluate JavaScript in the Chromium V8 page isolate",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["script"],
    },
  },
  {
    name: "browser_wait_for_function",
    description: "Poll until a JS predicate function returns truthy",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { script: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["script"],
    },
  },
  {
    name: "browser_wait_for",
    description: "Wait for a CSS selector to appear or a timeout in seconds",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" }, seconds: { type: "number" } },
    },
  },
  {
    name: "browser_network_requests",
    description:
      "Retrieve recent network requests, status codes, and mime-types",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_console_messages",
    description:
      "Retrieve console.log / console.error messages from page execution",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_close",
    description: "Close the browser context or current tab",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_markdown",
    description: "Extract clean, article-focused markdown content from page",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_links",
    description:
      "Extract all hyperlinks (<a href>) with resolved targets and anchor text",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_interactive_elements",
    description:
      "List all clickable, form, and interactive elements with coordinates",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_back",
    description: "Navigate back in session history",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_forward",
    description: "Navigate forward in session history",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_reload",
    description: "Reload the current page",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { ignoreCache: { type: "boolean" } },
    },
  },
  {
    name: "browser_get_cookies",
    description: "Inspect current cookies scoped to page origin or all domains",
    category: "browser-automation",
    inputSchema: { type: "object", properties: { domain: { type: "string" } } },
  },
  {
    name: "browser_set_cookie",
    description: "Set a cookie name, value, domain, path, and security flags",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "string" },
        domain: { type: "string" },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "browser_clear_cookies",
    description: "Delete all stored cookies in the session",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_wait_for_text",
    description: "Wait until specific substring or text pattern appears in DOM",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, timeoutMs: { type: "number" } },
      required: ["text"],
    },
  },
  {
    name: "browser_detect_forms",
    description: "Find all <form> tags, inputs, buttons, and action endpoints",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_fill_form",
    description:
      "Fill multiple form fields simultaneously by mapping names/selectors to values",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        formSelector: { type: "string" },
        fields: { type: "object" },
      },
      required: ["fields"],
    },
  },
  {
    name: "browser_scroll",
    description:
      "Scroll viewport vertically or horizontally (top, bottom, delta)",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        direction: { type: "string" },
      },
    },
  },
  {
    name: "browser_get_attribute",
    description:
      "Get the value of an attribute (e.g. href, src, aria-label) from an element",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        attribute: { type: "string" },
      },
      required: ["selector", "attribute"],
    },
  },
  {
    name: "browser_count",
    description: "Count how many DOM elements match a CSS selector",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "browser_extract",
    description:
      "Extract structured data from page using CSS selectors and property paths",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { schema: { type: "object" } },
      required: ["schema"],
    },
  },
  {
    name: "browser_tab_new",
    description: "Open a new browser tab with optional URL",
    category: "browser-automation",
    inputSchema: { type: "object", properties: { url: { type: "string" } } },
  },
  {
    name: "browser_tab_list",
    description: "List all open tabs with IDs, titles, and active status",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_tab_switch",
    description: "Switch active focus to a specific tab ID",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "string" } },
      required: ["tabId"],
    },
  },
  {
    name: "browser_tab_close",
    description: "Close a specific tab ID",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "string" } },
      required: ["tabId"],
    },
  },
  {
    name: "browser_search",
    description: "Find text occurrences in page with element bounding boxes",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "browser_storage_state",
    description: "Export localStorage and sessionStorage state as JSON",
    category: "browser-automation",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "browser_set_storage_state",
    description: "Import localStorage or sessionStorage entries",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: { state: { type: "object" } },
      required: ["state"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Capture PNG screenshot of the viewport or element",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        fullPage: { type: "boolean" },
      },
    },
  },
  {
    name: "browser_pdf",
    description: "Export page as a PDF document with page formatting options",
    category: "browser-automation",
    inputSchema: {
      type: "object",
      properties: {
        landscape: { type: "boolean" },
        print_background: { type: "boolean" },
      },
    },
  },
];

export function createUnifiedWebTools(): UnifiedTool[] {
  const tools: UnifiedTool[] = [];

  // 1. Obscura Browser Automation Tools (38 tools)
  tools.push(...OBSCURA_EXTENDED_TOOLS);

  // 2. Brave Search Intelligence Tools (9 tools)
  const braveTools: UnifiedTool[] = [
    {
      name: "brave_web_search",
      description:
        "[Search Intelligence] Search the Web using Brave's independent, private index",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          count: {
            type: "number",
            description: "Number of results (1-20)",
            default: 10,
          },
          offset: {
            type: "number",
            description: "Pagination offset",
            default: 0,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "brave_llm_context",
      description:
        "[Search Intelligence] Retrieve clean, pre-extracted, token-budgeted web snippets optimized for AI grounding",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Question or topic for LLM grounding",
          },
          max_tokens: {
            type: "number",
            description: "Total token budget for returned snippets",
            default: 4096,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "brave_image_search",
      description:
        "[Search Intelligence] Search for high-resolution images across the Web via Brave Search",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Image search terms" },
          count: {
            type: "number",
            description: "Number of images (1-50)",
            default: 20,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "brave_video_search",
      description:
        "[Search Intelligence] Search for video content across video platforms via Brave Search",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Video query" },
          count: {
            type: "number",
            description: "Number of video results (1-20)",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "brave_news_search",
      description:
        "[Search Intelligence] Search real-time global news headlines with publication dates",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "News topic" },
          freshness: {
            type: "string",
            description: "Time filter (pd: 24h, pw: week, pm: month)",
            default: "pw",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "brave_summarizer",
      description:
        "[Search Intelligence] Fetch Brave AI's synthesized web summary and citation list",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Summary key returned by brave_web_search",
          },
        },
        required: ["key"],
      },
    },
    {
      name: "brave_shields_check",
      description:
        "[Search Intelligence] Test if a URL is blocked or altered by Brave Shields (adblock-rust + CookieCrumbler)",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Request URL to test" },
          source_url: {
            type: "string",
            description: "Source page URL",
            default: "https://example.com/",
          },
          resource_type: {
            type: "string",
            description:
              "Resource type (script, image, stylesheet, xmlhttprequest)",
            default: "script",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "brave_answers",
      description:
        "[Search Intelligence] Direct question-answering with citations synthesized from Brave Index",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The natural language question",
          },
        },
        required: ["question"],
      },
    },
    {
      name: "brave_suggest",
      description:
        "[Search Intelligence] Autocomplete query suggestions from Brave Search engine",
      category: "search-intelligence",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Partial query string" },
        },
        required: ["query"],
      },
    },
  ];
  tools.push(...braveTools);

  // 3. Servo DOM & CSS Geometry Tools (3 tools)
  const servoTools: UnifiedTool[] = [
    {
      name: "servo_css_specificity",
      description:
        "[Servo DOM & Layout] Compute Stylo CSS selector specificity tuple (a, b, c) and 30-bit packed integer",
      category: "servo-dom-geometry",
      inputSchema: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS selector string (e.g. 'div.card > a:hover')",
          },
        },
        required: ["selector"],
      },
    },
    {
      name: "servo_xpath_to_css",
      description:
        "[Servo DOM & Layout] Translate an XPath 1.0 query to equivalent CSS3 selector",
      category: "servo-dom-geometry",
      inputSchema: {
        type: "object",
        properties: {
          xpath: {
            type: "string",
            description: "XPath query (e.g. '//div[@id=\"main\"]//button')",
          },
        },
        required: ["xpath"],
      },
    },
    {
      name: "servo_parse_webvtt",
      description:
        "[Servo DOM & Layout] Parse WebVTT subtitle track into cue objects with timing and styled payload",
      category: "servo-dom-geometry",
      inputSchema: {
        type: "object",
        properties: {
          vtt: { type: "string", description: "WebVTT file content or string" },
        },
        required: ["vtt"],
      },
    },
  ];
  tools.push(...servoTools);

  // 4. Chromium & V8 Engine Inspection Tools (3 tools)
  const v8Tools: UnifiedTool[] = [
    {
      name: "v8_runtime_info",
      description:
        "[V8 & Chromium Engine] Inspect Host Bun (WebKit/JSC) and Guest Browser (Chromium V8) runtime planes",
      category: "v8-chromium-engine",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "v8_evaluate_safe",
      description:
        "[V8 & Chromium Engine] Prepare and validate a script evaluation payload for the guest Chromium V8 isolate",
      category: "v8-chromium-engine",
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "JavaScript expression to evaluate",
          },
          timeoutMs: {
            type: "number",
            description: "Timeout budget in milliseconds",
            default: 5000,
          },
        },
        required: ["expression"],
      },
    },
    {
      name: "web_engine_status",
      description:
        "[V8 & Chromium Engine] Unified report of all monorepo engines (Servo + Obscura + Brave + Bun + V8)",
      category: "v8-chromium-engine",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "browser_resolve_challenge",
      description:
        "Detect common verification challenge markers. This tool does not solve challenges or generate verification tokens; report unsupported types for user-driven verification.",
      category: "browser-automation",
      inputSchema: {
        type: "object",
        properties: {
          html: {
            type: "string",
            description: "HTML content of current page or interstitial",
          },
          url: {
            type: "string",
            description: "Current page URL",
          },
        },
        required: ["html"],
      },
    },
    {
      name: "browser_chromium_legitimacy_script",
      description:
        "[Legitimate Chromium 2026] Retrieve authentic Chromium desktop legitimacy script (masking webdriver, ANGLE WebGL2, client hints)",
      category: "browser-automation",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "chromium_upstream_status",
      description:
        "[Chromium & Google Upstream] Real-time tracking of Chrome channels (Stable 157, Canary 159), CEF, Brave, Helium and Google depot_tools",
      category: "v8-chromium-engine",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "chromium_managed_patches",
      description:
        "[Chromium & Google Upstream] Audit YOLO-Web managed patches, overrides (chromium_src), and C++ subclasses across Chromium subsystems",
      category: "v8-chromium-engine",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
  tools.push(...v8Tools);

  return tools;
}

const defaultShields = new BraveShieldsEngine();
const defaultFingerprint = new BraveFingerprintProtection();
const defaultChallengeSolver = new ChallengeSolverEngine();

export async function handleUnifiedWebToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    switch (name) {
      // --- Search Intelligence ---
      case "brave_web_search": {
        const query = String(args.query ?? "");
        const bridge = new BraveSearchMcpBridge();
        const res = await bridge.webSearch({
          query,
          count: typeof args.count === "number" ? args.count : 10,
          offset: typeof args.offset === "number" ? args.offset : 0,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "brave_llm_context": {
        const query = String(args.query ?? "");
        const bridge = new BraveSearchMcpBridge();
        const res = await bridge.webSearch({
          query,
          count: 5,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "brave_shields_check": {
        const url = String(args.url ?? "");
        const sourceUrl = String(args.source_url ?? "https://example.com/");
        const resourceType = String(args.resource_type ?? "script") as
          "script" | "image" | "stylesheet" | "xmlhttprequest";
        const res = defaultShields.checkNetworkRequest({
          url,
          sourceUrl,
          resourceType,
        });
        const cleanRes = defaultFingerprint.cleanUrl(url);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  url,
                  sourceUrl,
                  resourceType,
                  blocked: res.blocked,
                  sanitizedUrl: cleanRes.url,
                  strippedParams: cleanRes.strippedParams,
                  matchedRule: res.matchedRule,
                  engine: "adblock-rust + CookieCrumbler",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // --- Servo DOM & Layout ---
      case "servo_css_specificity": {
        const selector = String(args.selector ?? "*");
        validateCssSelector(selector);
        const spec = calculateSpecificity(selector);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  selector,
                  specificity: spec,
                  score: spec.packed,
                  components: {
                    id: spec.id,
                    classAttrPseudo: spec.class,
                    elementPseudoElement: spec.element,
                  },
                  engine: "servo-stylo (Servo CSSEngine)",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "servo_xpath_to_css": {
        const xpath = String(args.xpath ?? "//body");
        const css = translateXPathToCss(xpath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  xpath,
                  css,
                  engine: "servo-xpath (Servo XPath 1.0 -> CSS3)",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "servo_parse_webvtt": {
        const vtt = String(
          args.vtt ?? "WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nHello World",
        );
        const parsed = parseWebVtt(vtt);
        return {
          content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
        };
      }

      // --- V8 & Chromium Engine ---
      case "v8_runtime_info":
      case "web_engine_status": {
        const hostInfo = BunHostRuntimeInfo.inspect();
        const v8Config = new V8PageIsolateConfig({ maxOldSpaceSizeMb: 1024 });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: "yolo-web",
                  version: "0.3.0",
                  organization: "yolo-rs (https://github.com/yolo-rs/yolo-web)",
                  hostRuntime: hostInfo,
                  guestBrowserV8: {
                    initialized: v8Config.isPlatformStarted(),
                    flags: v8Config.toFlagString(),
                    cliArgs: v8Config.toCliArgs(),
                    runtime: "Chromium V8 (deno_core / rusty_v8)",
                  },
                  monorepoPillars: {
                    servo:
                      "31 crates in crates/servo-* (Stylo, html5ever, euclid, svg, xpath, webvtt)",
                    obscura:
                      "10 crates in crates/obscura* (V8 isolate, CDP, DOM, Taffy layout, stealth)",
                    brave:
                      "5 crates in crates/brave-* (adblock-rust, Shields, kuchikiki, brave-search-cli)",
                    bun: "100% Native Upstream Bun v1.4.4+ (Full Rust ~200 crates + WebKit/JSC + Cranelift AoT)",
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "v8_evaluate_safe": {
        const expression = String(args.expression ?? "");
        const timeoutMs =
          typeof args.timeoutMs === "number" ? args.timeoutMs : 5000;
        const result = await executeBrowserTool("browser_evaluate", {
          script: expression,
          timeoutMs,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "browser_resolve_challenge": {
        const html = String(args.html ?? "");
        const detection = defaultChallengeSolver.detectChallenge(html);
        const solution = await defaultChallengeSolver.solveChallenge(detection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  detection,
                  solution,
                  engine:
                    "YOLO-Web challenge detector (resolution unsupported)",
                  profile: CHROMIUM_2026_DEFAULT_PROFILE,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "browser_chromium_legitimacy_script": {
        const script =
          defaultChallengeSolver.generateChromiumLegitimacyScript();
        return {
          content: [
            {
              type: "text",
              text: script,
            },
          ],
        };
      }

      case "chromium_upstream_status": {
        const tracker = new ChromiumTrackingEngine();
        const report = await tracker.generateStatusReport();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case "chromium_managed_patches": {
        const tracker = new ChromiumTrackingEngine();
        const patches = tracker.getPatchProposals();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(patches, null, 2),
            },
          ],
        };
      }

      // --- Browser automation over the configured live Chromium CDP endpoint ---
      default: {
        if (!OBSCURA_EXTENDED_TOOLS.some((tool) => tool.name === name)) {
          throw new Error(`Unknown web tool '${name}'.`);
        }
        const result = await executeBrowserTool(name, args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `[web-mcp error] ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
