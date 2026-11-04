/**
 * @yolo-web/browser-sdk
 * Unified Bun-native Browser SDK for AI Agents and Humans (Servo + Obscura + Brave).
 * Supports drop-in CDP automation, MCP agent snapshots/markdown, and Hybrid Co-Pilot handoff.
 */

export * from "@yolo-web/shared";
export * from "@yolo-web/cdp-client";
export * from "@yolo-web/mcp-client";
export * from "@yolo-web/bun-v8-bridge";

import {
  type PdfOptions,
  type ScreenshotOptions,
  YoloCdpClient,
} from "@yolo-web/cdp-client";
import { YoloMcpClient } from "@yolo-web/mcp-client";
import {
  type BrowserSessionInfo,
  createBrowserSessionInfo,
  DEFAULT_STEALTH_CONFIG,
  DEFAULT_VIEWPORT,
  type EngineMode,
  type StealthConfig,
  type ViewportConfig,
} from "@yolo-web/shared";

export interface YoloBrowserConnectOptions {
  cdpUrl: string;
  mcpUrl?: string;
  token?: string;
  mode?: EngineMode;
  viewport?: ViewportConfig;
  stealth?: StealthConfig;
}

export class YoloPage {
  readonly targetId: string;
  readonly sessionId: string;
  private readonly cdp: YoloCdpClient;
  private readonly mcp: YoloMcpClient | null;
  private currentUrl = "about:blank";

  constructor(
    targetId: string,
    sessionId: string,
    cdp: YoloCdpClient,
    mcp: YoloMcpClient | null,
  ) {
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.cdp = cdp;
    this.mcp = mcp;
  }

  async goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle0" },
  ): Promise<void> {
    await this.cdp.navigate(url, options);
    this.currentUrl = url;
  }

  async title(): Promise<string> {
    return (await this.cdp.evaluate<string>("document.title")) ?? "";
  }

  async url(): Promise<string> {
    const evaluated = await this.cdp.evaluate<string>("location.href");
    return evaluated || this.currentUrl;
  }

  async content(): Promise<string> {
    return (
      (await this.cdp.evaluate<string>("document.documentElement.outerHTML")) ??
      ""
    );
  }

  async evaluate<T = unknown>(
    pageFunctionOrExpression: string | (() => T | Promise<T>),
  ): Promise<T> {
    const expr =
      typeof pageFunctionOrExpression === "function"
        ? `(${pageFunctionOrExpression.toString()})()`
        : pageFunctionOrExpression;
    return this.cdp.evaluate<T>(expr);
  }

  async click(selectorOrX: string | number, y?: number): Promise<void> {
    if (typeof selectorOrX === "number" && typeof y === "number") {
      await this.cdp.dispatchMouseEvent({
        type: "mousePressed",
        x: selectorOrX,
        y,
        button: "left",
        clickCount: 1,
      });
      await this.cdp.dispatchMouseEvent({
        type: "mouseReleased",
        x: selectorOrX,
        y,
        button: "left",
        clickCount: 1,
      });
      return;
    }

    if (this.mcp) {
      await this.mcp.click(String(selectorOrX));
      return;
    }

    await this.cdp.evaluate(
      `document.querySelector(${JSON.stringify(String(selectorOrX))})?.click()`,
    );
  }

  async type(selector: string, text: string): Promise<void> {
    if (this.mcp) {
      await this.mcp.type(selector, text);
      return;
    }
    await this.cdp.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.focus(); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); } })()`,
    );
  }

  async screenshot(
    options?: ScreenshotOptions & { path?: string },
  ): Promise<Uint8Array> {
    const bytes = await this.cdp.captureScreenshot(options);
    if (options?.path) {
      await Bun.write(options.path, bytes);
    }
    return bytes;
  }

  async pdf(options?: PdfOptions & { path?: string }): Promise<Uint8Array> {
    const bytes = await this.cdp.printToPdf(options);
    if (options?.path) {
      await Bun.write(options.path, bytes);
    }
    return bytes;
  }

  async snapshot(maxChars = 4000): Promise<string> {
    if (this.mcp) {
      return this.mcp.snapshot({ maxChars });
    }
    const title = await this.title();
    const url = await this.url();
    const body =
      (await this.cdp.evaluate<string>("document.body?.innerText ?? ''")) ?? "";
    return `URL: ${url}\nTitle: ${title}\n\n${body.slice(0, maxChars)}`;
  }

  async markdown(): Promise<string> {
    if (this.mcp) {
      return this.mcp.extractMarkdown();
    }
    const title = await this.title();
    const body =
      (await this.cdp.evaluate<string>("document.body?.innerText ?? ''")) ?? "";
    return `# ${title}\n\n${body}`;
  }
}

export class YoloBrowser implements AsyncDisposable {
  readonly cdp: YoloCdpClient;
  readonly mcp: YoloMcpClient | null;
  private readonly info: BrowserSessionInfo;

  private constructor(
    cdp: YoloCdpClient,
    mcp: YoloMcpClient | null,
    info: BrowserSessionInfo,
  ) {
    this.cdp = cdp;
    this.mcp = mcp;
    this.info = info;
  }

  static async connect(
    options: YoloBrowserConnectOptions,
  ): Promise<YoloBrowser> {
    const cdp = await YoloCdpClient.connect({
      endpoint: options.cdpUrl,
      token: options.token,
    });

    const mcp = options.mcpUrl
      ? new YoloMcpClient({
          transport: "http",
          url: options.mcpUrl,
          token: options.token,
        })
      : null;

    const info = createBrowserSessionInfo({
      sessionId: crypto.randomUUID(),
      cdpEndpoint: cdp.wsUrl,
      mcpEndpoint: options.mcpUrl,
      mode: options.mode ?? "hybrid-copilot",
      viewport: options.viewport ?? { ...DEFAULT_VIEWPORT },
      stealth: options.stealth ?? { ...DEFAULT_STEALTH_CONFIG },
    });

    return new YoloBrowser(cdp, mcp, info);
  }

  sessionInfo(): BrowserSessionInfo {
    return { ...this.info };
  }

  requestHumanTakeover(_reason?: string): BrowserSessionInfo {
    this.info.humanTakeoverActive = true;
    this.info.mode = "human-interactive";
    return this.sessionInfo();
  }

  resumeAgentControl(): BrowserSessionInfo {
    this.info.humanTakeoverActive = false;
    this.info.mode = "hybrid-copilot";
    return this.sessionInfo();
  }

  async newPage(initialUrl = "about:blank"): Promise<YoloPage> {
    const targetId = await this.cdp.createTarget(initialUrl);
    const sessionId = await this.cdp.attachToTarget(targetId, true);
    this.info.activeTargetId = targetId;
    return new YoloPage(targetId, sessionId, this.cdp, this.mcp);
  }

  async disconnect(): Promise<void> {
    await this.mcp?.close();
    await this.cdp.close();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect();
  }
}
