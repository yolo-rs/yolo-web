/**
 * @yolo-web/shared
 * Shared types, protocol schemas, and runtime helpers across Yolo-Web (Servo + Obscura + Brave + Bun).
 */

export type EngineMode = "ai-agent" | "human-interactive" | "hybrid-copilot";

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  mobile?: boolean;
}

export interface StealthConfig {
  enabled: boolean;
  proxyUrl?: string;
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  braveShieldsEnabled?: boolean;
  adblockLists?: string[];
  allowPrivateNetwork?: boolean;
}

export interface CdpTargetInfo {
  targetId: string;
  type: "page" | "iframe" | "worker" | "service_worker" | "browser" | "other";
  title: string;
  url: string;
  attached: boolean;
  browserContextId?: string;
  webSocketDebuggerUrl?: string;
}

export interface CdpVersionInfo {
  Browser: string;
  "Protocol-Version": string;
  "User-Agent": string;
  "V8-Version"?: string;
  webSocketDebuggerUrl?: string;
}

export interface CdpRequest<TParams = Record<string, unknown>> {
  id: number;
  method: string;
  params?: TParams;
  sessionId?: string;
}

export interface CdpError {
  code: number;
  message: string;
  data?: unknown;
}

export interface CdpResponse<TResult = Record<string, unknown>> {
  id: number;
  result?: TResult;
  error?: CdpError;
  sessionId?: string;
}

export interface CdpEvent<TParams = Record<string, unknown>> {
  method: string;
  params: TParams;
  sessionId?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpContentItem {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export interface McpToolCallResult {
  content: McpContentItem[];
  isError?: boolean;
}

export interface BrowserSessionInfo {
  sessionId: string;
  mode: EngineMode;
  cdpEndpoint: string;
  mcpEndpoint?: string;
  viewport: ViewportConfig;
  stealth: StealthConfig;
  activeTargetId?: string;
  humanTakeoverActive: boolean;
  createdAt: string;
}

export const DEFAULT_VIEWPORT: ViewportConfig = /* @__PURE__ */ Object.freeze({
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

export const DEFAULT_STEALTH_CONFIG: StealthConfig =
  /* @__PURE__ */ Object.freeze({
    enabled: true,
    braveShieldsEnabled: true,
    allowPrivateNetwork: false,
  });

export const OBSCURA_MCP_TOOLS: readonly McpToolDefinition[] =
  /* @__PURE__ */ Object.freeze([
    {
      name: "browser_navigate",
      description: "Navigate active tab to a URL",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
    {
      name: "browser_snapshot",
      description:
        "Capture accessibility tree, actionable element refs, URL, title, and visible text",
      inputSchema: {
        type: "object",
        properties: { max_chars: { type: "number" } },
      },
    },
    {
      name: "browser_click",
      description: "Click an element by CSS selector or snapshot ref",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string" },
          ref: { type: "string" },
        },
      },
    },
    {
      name: "browser_type",
      description: "Type text into an input element",
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
      name: "browser_evaluate",
      description: "Evaluate JavaScript in the page context",
      inputSchema: {
        type: "object",
        properties: {
          script: { type: "string" },
          timeoutMs: { type: "number" },
        },
        required: ["script"],
      },
    },
    {
      name: "browser_screenshot",
      description: "Capture current viewport as PNG image",
      inputSchema: {
        type: "object",
        properties: {
          width: { type: "number" },
          height: { type: "number" },
        },
      },
    },
    {
      name: "browser_pdf",
      description: "Export current page as a PDF document",
      inputSchema: {
        type: "object",
        properties: {
          landscape: { type: "boolean" },
          print_background: { type: "boolean" },
          scale: { type: "number" },
        },
      },
    },
    {
      name: "browser_markdown",
      description: "Extract readable Markdown from the current page",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ]);

export function createBrowserSessionInfo(
  partial: Partial<BrowserSessionInfo> & {
    sessionId: string;
    cdpEndpoint: string;
  },
): BrowserSessionInfo {
  return {
    sessionId: partial.sessionId,
    mode: partial.mode ?? "hybrid-copilot",
    cdpEndpoint: partial.cdpEndpoint,
    mcpEndpoint: partial.mcpEndpoint,
    viewport: partial.viewport ?? { ...DEFAULT_VIEWPORT },
    stealth: partial.stealth ?? { ...DEFAULT_STEALTH_CONFIG },
    activeTargetId: partial.activeTargetId,
    humanTakeoverActive: partial.humanTakeoverActive ?? false,
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}

export function isValidEngineMode(mode: unknown): mode is EngineMode {
  return (
    mode === "ai-agent" ||
    mode === "human-interactive" ||
    mode === "hybrid-copilot"
  );
}

export function normalizeCdpWebSocketUrl(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return `ws://${trimmed}`;
}

export function normalizeCdpHttpUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("ws://")) {
    const u = new URL(trimmed);
    return `http://${u.host}`;
  }
  if (trimmed.startsWith("wss://")) {
    const u = new URL(trimmed);
    return `https://${u.host}`;
  }
  return `http://${trimmed}`;
}
