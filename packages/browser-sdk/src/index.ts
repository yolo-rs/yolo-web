/**
 * @yolo-web/browser-sdk
 * Unified Bun-native Browser Automation & AI Agent Framework (surpassing Playwright and Puppeteer).
 *
 * Core Features:
 * - Zero heavy external binary downloads (Native Obscura engine 15x faster or custom Chromium)
 * - Playwright-compatible Locators (Accessibility role, aria-label, text, test-id, XPath, CSS)
 * - Resilient human-like mouse trajectories & keystroke timing
 * - Advanced bot detection evasion (Webdriver masking, WebGL vendor spoofing, Canvas micro-noise, Chrome runtime)
 * - Built-in SSRF Guard (RFC1918, loopback, cloud metadata blocking)
 * - Automatic rotating proxy management
 * - First-class AI Vision & semantic DOM accessibility tree snapshots ([e1], [e2])
 * - Integrated Model Context Protocol (MCP) server for autonomous agents
 */

export * from "@yolo-web/shared";
export * from "@yolo-web/cdp-client";
export * from "@yolo-web/mcp-client";
export * from "@yolo-web/bun-v8-bridge";

export * from "./ssrf";
export * from "./proxy";
export * from "./stealth";
export * from "./locator";
export * from "./route";
export * from "./keyboard";
export * from "./mouse";
export * from "./ai-vision";
export * from "./engine";
export * from "./mcp-server";

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

import { SsrfGuard, type SsrfGuardOptions } from "./ssrf";
import { RotatingProxyPool, type ProxyServerConfig, type ProxyRotationStrategy } from "./proxy";
import { buildStealthInjectionScript, type StealthOptions } from "./stealth";
import { Locator, type LocatorOptions } from "./locator";
import { Route, RouteRegistry, type RouteHandler, type RoutePattern } from "./route";
import { Keyboard } from "./keyboard";
import { Mouse } from "./mouse";
import { AiVisionEngine, type AiVisionObservation } from "./ai-vision";

export interface YoloBrowserConnectOptions {
  cdpUrl: string;
  mcpUrl?: string;
  token?: string;
  mode?: EngineMode;
  viewport?: ViewportConfig;
  stealth?: StealthConfig & StealthOptions;
  ssrfGuard?: SsrfGuardOptions | boolean;
  proxies?: Array<string | ProxyServerConfig>;
  proxyStrategy?: ProxyRotationStrategy;
}

export class YoloPage {
  readonly targetId: string;
  readonly sessionId: string;
  readonly cdp: YoloCdpClient;
  readonly mcp: YoloMcpClient | null;
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  readonly routes: RouteRegistry = new RouteRegistry();
  readonly ssrfGuard: SsrfGuard;
  private currentUrl = "about:blank";
  private isClosed = false;

  constructor(
    targetId: string,
    sessionId: string,
    cdp: YoloCdpClient,
    mcp: YoloMcpClient | null,
    ssrfGuard: SsrfGuard
  ) {
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.cdp = cdp;
    this.mcp = mcp;
    this.ssrfGuard = ssrfGuard;
    this.keyboard = new Keyboard(cdp);
    this.mouse = new Mouse(cdp);

    this.setupRouteHandling();
  }

  private setupRouteHandling(): void {
    this.cdp.on("Fetch.requestPaused", async (params: any) => {
      const { requestId, request, resourceType } = params;
      const handler = this.routes.matches(request.url);

      const route = new Route(this.cdp, {
        requestId,
        url: request.url,
        method: request.method,
        headers: request.headers ?? {},
        postData: request.postData,
        resourceType,
      });

      if (handler) {
        try {
          await handler(route);
        } catch {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Intercept and route requests matching `pattern`.
   */
  async route(pattern: RoutePattern, handler: RouteHandler): Promise<void> {
    if (!this.routes.isEnabled) {
      await this.cdp.send("Fetch.enable", {
        patterns: [{ urlPattern: "*" }],
      });
      this.routes.enabled = true;
    }
    this.routes.add(pattern, handler);
  }

  /**
   * Remove route handler for `pattern`.
   */
  async unroute(pattern: RoutePattern): Promise<void> {
    this.routes.remove(pattern);
  }

  /**
   * Create a lazy, auto-waiting `Locator` supporting CSS, XPath, Role, Text, Label, and TestId.
   */
  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  /**
   * Locate an element by its accessibility role.
   */
  getByRole(role: string, options?: { name?: string; exact?: boolean }): Locator {
    const sel = options?.name ? `role=${role}[name="${options.name}"]` : `role=${role}`;
    return new Locator(this, sel);
  }

  /**
   * Locate an element by text content.
   */
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    if (text instanceof RegExp) {
      return new Locator(this, `text=/${text.source}/${text.flags}`);
    }
    return new Locator(this, `text="${text}"`);
  }

  /**
   * Locate a form input by its associated <label> or aria-label.
   */
  getByLabel(text: string, options?: { exact?: boolean }): Locator {
    return new Locator(this, `label="${text}"`);
  }

  /**
   * Locate an input by its placeholder attribute.
   */
  getByPlaceholder(text: string): Locator {
    return new Locator(this, `placeholder="${text}"`);
  }

  /**
   * Locate an image by its alt text.
   */
  getByAltText(text: string): Locator {
    return new Locator(this, `alt="${text}"`);
  }

  /**
   * Locate an element by its title attribute.
   */
  getByTitle(text: string): Locator {
    return new Locator(this, `title="${text}"`);
  }

  /**
   * Locate an element by test ID (`data-testid`).
   */
  getByTestId(testId: string): Locator {
    return new Locator(this, `testid="${testId}"`);
  }

  /**
   * Locate an element using XPath expression.
   */
  locatorXPath(xpath: string): Locator {
    return new Locator(this, `xpath=${xpath}`);
  }

  /**
   * Navigate to URL with integrated SSRF protection and lifecycle wait.
   */
  async goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle0" }
  ): Promise<void> {
    // SSRF Guard assertion
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await this.ssrfGuard.validateUrl(url);
    }

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
      (await this.cdp.evaluate<string>("document.documentElement.outerHTML")) ?? ""
    );
  }

  async evaluate<T = unknown>(
    pageFunctionOrExpression: string | (() => T | Promise<T>)
  ): Promise<T> {
    const expr =
      typeof pageFunctionOrExpression === "function"
        ? `(${pageFunctionOrExpression.toString()})()`
        : pageFunctionOrExpression;
    return this.cdp.evaluate<T>(expr);
  }

  async click(selectorOrX: string | number, y?: number, options?: { humanLike?: boolean }): Promise<void> {
    if (typeof selectorOrX === "number" && typeof y === "number") {
      await this.mouse.move(selectorOrX, y, { humanLike: options?.humanLike });
      await this.mouse.click(selectorOrX, y);
      return;
    }

    const loc = this.locator(String(selectorOrX));
    await loc.click({ humanLike: options?.humanLike });
  }

  async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    const loc = this.locator(selector);
    await loc.type(text, options);
  }

  async fill(selector: string, value: string): Promise<void> {
    const loc = this.locator(selector);
    await loc.fill(value);
  }

  async screenshot(
    options?: ScreenshotOptions & { path?: string; fullPage?: boolean }
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

  /**
   * Capture semantic accessibility snapshot with tagged element refs ([e1], [e2]).
   */
  async snapshot(maxChars = 8000): Promise<string> {
    if (this.mcp) {
      return this.mcp.snapshot({ maxChars });
    }
    const res = await AiVisionEngine.captureSnapshot(this, maxChars);
    return res.snapshot;
  }

  /**
   * Extract readable Markdown from page content.
   */
  async markdown(): Promise<string> {
    if (this.mcp) {
      return this.mcp.extractMarkdown();
    }
    return AiVisionEngine.extractMarkdown(this);
  }

  /**
   * Multimodal AI Vision observation combining annotated tree, interactive bounding boxes, and screenshot.
   */
  async aiVision(options: { withScreenshot?: boolean } = {}): Promise<AiVisionObservation> {
    return AiVisionEngine.observe(this, options);
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      await this.cdp.send("Target.closeTarget", { targetId: this.targetId });
    } catch {
      // Ignored if target is already terminated
    }
  }
}

export class YoloBrowser implements AsyncDisposable {
  readonly cdp: YoloCdpClient;
  readonly mcp: YoloMcpClient | null;
  readonly ssrfGuard: SsrfGuard;
  readonly proxyPool?: RotatingProxyPool;
  private readonly info: BrowserSessionInfo;
  private readonly openedPages = new Map<string, YoloPage>();

  private constructor(
    cdp: YoloCdpClient,
    mcp: YoloMcpClient | null,
    info: BrowserSessionInfo,
    ssrfGuard: SsrfGuard,
    proxyPool?: RotatingProxyPool
  ) {
    this.cdp = cdp;
    this.mcp = mcp;
    this.info = info;
    this.ssrfGuard = ssrfGuard;
    this.proxyPool = proxyPool;
  }

  static async connect(options: YoloBrowserConnectOptions): Promise<YoloBrowser> {
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

    const ssrfOptions =
      typeof options.ssrfGuard === "object"
        ? options.ssrfGuard
        : { allowPrivateNetwork: options.ssrfGuard === false };

    const ssrfGuard = new SsrfGuard(ssrfOptions);

    const proxyPool =
      options.proxies && options.proxies.length > 0
        ? new RotatingProxyPool(options.proxies, options.proxyStrategy ?? "round-robin")
        : undefined;

    const info = createBrowserSessionInfo({
      sessionId: crypto.randomUUID(),
      cdpEndpoint: cdp.wsUrl,
      mcpEndpoint: options.mcpUrl,
      mode: options.mode ?? "hybrid-copilot",
      viewport: options.viewport ?? { ...DEFAULT_VIEWPORT },
      stealth: options.stealth ?? { ...DEFAULT_STEALTH_CONFIG },
    });

    return new YoloBrowser(cdp, mcp, info, ssrfGuard, proxyPool);
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

  pages(): YoloPage[] {
    return [...this.openedPages.values()];
  }

  async newPage(initialUrl = "about:blank"): Promise<YoloPage> {
    const targetId = await this.cdp.createTarget(initialUrl);
    const sessionId = await this.cdp.attachToTarget(targetId, true);

    await this.cdp.send("Page.enable");
    await this.cdp.send("Runtime.enable");
    await this.cdp.send("DOM.enable");

    // Inject stealth scripts on document creation if stealth is active
    if (this.info.stealth?.enabled) {
      const script = buildStealthInjectionScript(this.info.stealth as any);
      await this.cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: script,
      });
    }

    this.info.activeTargetId = targetId;

    const page = new YoloPage(targetId, sessionId, this.cdp, this.mcp, this.ssrfGuard);
    this.openedPages.set(targetId, page);
    return page;
  }

  async disconnect(): Promise<void> {
    for (const page of this.openedPages.values()) {
      await page.close().catch(() => {});
    }
    this.openedPages.clear();
    await this.mcp?.close();
    await this.cdp.close();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect();
  }
}
