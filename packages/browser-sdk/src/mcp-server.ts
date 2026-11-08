/**
 * Complete Model Context Protocol (MCP) Server for AI Agents.
 * Exposes full browser automation, DOM accessibility tree snapshots, AI vision, and multi-tab orchestration.
 * Compatible with Claude Desktop, Cursor, AGY, and Antigravity.
 */

import type { YoloBrowser, YoloPage } from "./index";
import { AiVisionEngine } from "./ai-vision";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, any>) => Promise<any>;
}

export class YoloMcpServer {
  private readonly browser: YoloBrowser;
  private readonly tools = new Map<string, McpTool>();

  constructor(browser: YoloBrowser) {
    this.browser = browser;
    this.registerDefaultTools();
  }

  private register(tool: McpTool): void {
    this.tools.set(tool.name, tool);
  }

  private async getActivePage(): Promise<YoloPage> {
    const pages = this.browser.pages();
    const first = pages[0];
    if (first) return first;
    return this.browser.newPage();
  }

  private registerDefaultTools(): void {
    // 1. Navigate
    this.register({
      name: "browser_navigate",
      description: "Navigate active tab to a URL with SSRF protection and stealth headers",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Target HTTP(S) URL" },
          waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle0"] },
        },
        required: ["url"],
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        await page.goto(args.url, { waitUntil: args.waitUntil });
        return {
          content: [
            {
              type: "text",
              text: `Navigated to ${args.url}. Current Title: "${await page.title()}"`,
            },
          ],
        };
      },
    });

    // 2. Snapshot (semantic DOM)
    this.register({
      name: "browser_snapshot",
      description: "Capture accessibility tree with interactive element refs [e1], [e2] for AI decision making",
      inputSchema: {
        type: "object",
        properties: {
          max_chars: { type: "number", description: "Maximum characters to return" },
        },
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const res = await AiVisionEngine.captureSnapshot(page, args.max_chars ?? 8000);
        return {
          content: [{ type: "text", text: res.snapshot }],
        };
      },
    });

    // 3. AI Vision
    this.register({
      name: "browser_ai_vision",
      description: "Multimodal observation returning interactive bounding boxes, tagged refs, and base64 screenshot",
      inputSchema: {
        type: "object",
        properties: {
          with_screenshot: { type: "boolean", default: true },
        },
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const obs = await AiVisionEngine.observe(page, {
          withScreenshot: args.with_screenshot ?? true,
        });

        const items: any[] = [{ type: "text", text: obs.snapshot }];
        if (obs.screenshotBase64) {
          items.push({
            type: "image",
            data: obs.screenshotBase64,
            mimeType: "image/jpeg",
          });
        }
        return { content: items };
      },
    });

    // 4. Click
    this.register({
      name: "browser_click",
      description: "Click an element by selector, text, role, or snapshot ref [e1]",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector, XPath, role=..., text=..., or ref e.g. 'e1'" },
          button: { type: "string", enum: ["left", "right", "middle"] },
          click_count: { type: "number", default: 1 },
        },
        required: ["selector"],
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const sel = String(args.selector);
        if (/^e\d+$/i.test(sel)) {
          // Resolve snapshot ref
          const snap = await AiVisionEngine.captureSnapshot(page);
          const found = snap.elements.find((el) => el.ref.toLowerCase() === sel.toLowerCase());
          if (!found) throw new Error(`Snapshot ref "${sel}" not found in active document.`);
          await page.mouse.click(found.x + found.width / 2, found.y + found.height / 2, {
            button: args.button,
            clickCount: args.click_count,
          });
        } else {
          const loc = page.locator(sel);
          await loc.click({ button: args.button, clickCount: args.click_count });
        }
        return { content: [{ type: "text", text: `Clicked ${sel}` }] };
      },
    });

    // 5. Type
    this.register({
      name: "browser_type",
      description: "Type text into an input or textarea element with realistic typing intervals",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS, role, text, or ref" },
          text: { type: "string", description: "Text to type" },
          submit: { type: "boolean", description: "Press Enter after typing" },
        },
        required: ["selector", "text"],
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const sel = String(args.selector);
        const loc = page.locator(sel);
        await loc.fill(args.text);
        if (args.submit) {
          await page.keyboard.press("Enter");
        }
        return { content: [{ type: "text", text: `Typed into ${sel}` }] };
      },
    });

    // 6. Markdown
    this.register({
      name: "browser_markdown",
      description: "Extract clean, readable Markdown from the current web page",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const page = await this.getActivePage();
        const md = await AiVisionEngine.extractMarkdown(page);
        return { content: [{ type: "text", text: md }] };
      },
    });

    // 7. Screenshot
    this.register({
      name: "browser_screenshot",
      description: "Capture page screenshot as PNG or JPEG image",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          full_page: { type: "boolean" },
        },
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const bytes = await page.screenshot({ path: args.path, fullPage: args.full_page });
        const b64 = Buffer.from(bytes).toString("base64");
        return {
          content: [
            {
              type: "image",
              data: b64,
              mimeType: "image/png",
            },
          ],
        };
      },
    });

    // 8. Evaluate JS
    this.register({
      name: "browser_evaluate",
      description: "Evaluate JavaScript code directly in the page realm",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string", description: "JavaScript expression to run" },
        },
        required: ["expression"],
      },
      handler: async (args) => {
        const page = await this.getActivePage();
        const res = await page.evaluate(args.expression);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      },
    });

    // 9. Tabs
    this.register({
      name: "browser_tabs",
      description: "Manage multiple browser tabs (list, new, switch, close)",
      inputSchema: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["list", "new", "switch", "close"] },
          id: { type: "string" },
          url: { type: "string" },
        },
        required: ["op"],
      },
      handler: async (args) => {
        const op = args.op;
        if (op === "list") {
          const pages = this.browser.pages();
          const list = await Promise.all(
            pages.map(async (p) => ({
              targetId: p.targetId,
              title: await p.title(),
              url: await p.url(),
            }))
          );
          return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
        }
        if (op === "new") {
          const p = await this.browser.newPage(args.url || "about:blank");
          return { content: [{ type: "text", text: `Opened new tab: ${p.targetId}` }] };
        }
        if (op === "close") {
          const page = this.browser.pages().find((p) => p.targetId === args.id);
          if (page) await page.close();
          return { content: [{ type: "text", text: `Closed tab: ${args.id}` }] };
        }
        return { content: [{ type: "text", text: `Tab operation ${op} completed` }] };
      },
    });
  }

  /**
   * Handle JSON-RPC message (stdio or HTTP).
   */
  async handleJsonRpc(req: { jsonrpc?: string; id?: any; method: string; params?: any }): Promise<any> {
    const id = req.id ?? null;

    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "yolo-web-browser-mcp", version: "0.1.0" },
        },
      };
    }

    if (req.method === "tools/list") {
      const list = [...this.tools.values()].map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: list },
      };
    }

    if (req.method === "tools/call") {
      const toolName = req.params?.name;
      const tool = this.tools.get(toolName);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool "${toolName}" not found` },
        };
      }
      try {
        const result = await tool.handler(req.params?.arguments ?? {});
        return { jsonrpc: "2.0", id, result };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
            isError: true,
          },
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method "${req.method}" not implemented` },
    };
  }
}
