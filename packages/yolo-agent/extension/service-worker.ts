// SPDX-License-Identifier: Apache-2.0
/**
 * Service worker driver: runs the agent core over chrome.debugger, serves the
 * side panel (long-lived port), and executes tool calls that arrive from the
 * bridge through the offscreen document.
 *
 * Secrets: the model API key lives only in chrome.storage.session (memory,
 * cleared when the browser exits) and is never written to storage.local, logs
 * or the audit trail.
 */
import { Browser } from "../src/browser.ts";
import { runAgent } from "../src/loop.ts";
import { AnthropicClient } from "../src/model.ts";
import {
  type Autonomy,
  AuditLog,
  type ApprovalHandler,
  resolveAutonomy,
} from "../src/safety.ts";
import { AgentSession } from "../src/tools.ts";
import { ExtensionTargetBackend } from "./debugger-transport.ts";

type Mode = "human+ai" | "ai";
interface Port {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: Record<string, any>) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

const backend = new ExtensionTargetBackend();
const browser = new Browser(backend);
const ports = new Set<Port>();
const pendingApprovals = new Map<string, (approved: boolean) => void>();
let approvalSeq = 0;
let abort: AbortController | undefined;
let running = false;

const AUDIT_KEY = "yoloAudit";
const auditTail: string[] = [];
const audit = new AuditLog(async (line) => {
  auditTail.push(line);
  if (auditTail.length > 300) auditTail.shift();
  await chrome.storage.local.set({ [AUDIT_KEY]: auditTail });
});

function broadcast(event: Record<string, unknown>): void {
  for (const port of ports) {
    try {
      port.postMessage(event);
    } catch {
      ports.delete(port);
    }
  }
  // Fan-out to bridge subscribers through the offscreen document.
  void chrome.runtime
    .sendMessage({ type: "agent-event", event })
    .catch(() => undefined);
}

const approver: ApprovalHandler = (request) =>
  new Promise<boolean>((resolve) => {
    const id = `x${++approvalSeq}`;
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve(false);
    }, 60_000);
    pendingApprovals.set(id, (approved) => {
      clearTimeout(timer);
      resolve(approved);
    });
    broadcast({
      type: "approval_request",
      id,
      panel: ports.size > 0,
      ...request,
    });
  });

const session = new AgentSession({
  id: crypto.randomUUID(),
  browser,
  autonomy: "ask",
  audit,
  approve: approver,
});

async function secrets(): Promise<{
  apiKey?: string;
  bridgeUrl?: string;
  bridgeToken?: string;
  nhitlOptIn?: boolean;
  autonomy?: Autonomy;
}> {
  return chrome.storage.session.get([
    "apiKey",
    "bridgeUrl",
    "bridgeToken",
    "nhitlOptIn",
    "autonomy",
  ]);
}

async function setAutonomy(level: Autonomy): Promise<void> {
  const { nhitlOptIn } = await secrets();
  session.autonomy = resolveAutonomy(level, {
    nhitlOptIn: nhitlOptIn === true,
  });
  await chrome.storage.session.set({ autonomy: session.autonomy });
  broadcast({ type: "autonomy", level: session.autonomy });
}

async function ensureOffscreen(): Promise<void> {
  if (!chrome.offscreen) return; // not available in this browser build
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS"],
    justification:
      "Hold the loopback bridge WebSocket and keep-alive while the service worker is suspended",
  });
}

async function startRun(goal: string, screenshot: boolean): Promise<void> {
  if (running) {
    broadcast({ type: "error", message: "a run is already in progress" });
    return;
  }
  const { apiKey } = await secrets();
  if (!apiKey) {
    broadcast({
      type: "error",
      message: "no model API key set (stored in session memory only)",
    });
    return;
  }
  const { mode = "human+ai", model } = (await chrome.storage.local.get([
    "mode",
    "model",
  ])) as {
    mode?: Mode;
    model?: string;
  };
  running = true;
  abort = new AbortController();
  const keepAlive = setInterval(
    () => void chrome.runtime.getPlatformInfo(),
    20_000,
  );
  broadcast({ type: "run_start", goal, mode });
  try {
    if (mode === "ai") {
      // AI-only: work in a separate unfocused window so the user's tabs are left alone.
      const win = await chrome.windows.create({
        url: "about:blank",
        focused: false,
      });
      const tabId = win.tabs?.[0]?.id;
      if (tabId !== undefined) await browser.use(String(tabId));
    }
    const client = new AnthropicClient({
      getApiKey: () => apiKey,
      baseUrl: "https://api.anthropic.com",
      model: model || "claude-sonnet-5-5",
    });
    const result = await runAgent(goal, {
      model: client,
      session,
      screenshot,
      signal: abort.signal,
      onText: (text) => broadcast({ type: "text", text }),
      onStep: (step) => broadcast({ type: "step", ...step }),
    });
    broadcast({
      type: "run_end",
      stopped: result.stopped,
      error: result.error,
      turns: result.turns,
      totalMs: result.totalMs,
      finalText: result.finalText,
    });
  } finally {
    clearInterval(keepAlive);
    running = false;
    abort = undefined;
  }
}

chrome.runtime.onConnect.addListener((port: Port & { name: string }) => {
  if (port.name !== "sidepanel") return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener(async (message) => {
    try {
      switch (message.type) {
        case "run":
          await startRun(String(message.goal), message.screenshot === true);
          break;
        case "stop":
          abort?.abort();
          break;
        case "autonomy":
          await setAutonomy(message.level as Autonomy);
          break;
        case "approval_response":
          pendingApprovals.get(message.id)?.(message.approved === true);
          pendingApprovals.delete(message.id);
          break;
        case "state": {
          const stored = await chrome.storage.local.get([
            "mode",
            "model",
            AUDIT_KEY,
          ]);
          const s = await secrets();
          port.postMessage({
            type: "state",
            autonomy: session.autonomy,
            mode: stored.mode ?? "human+ai",
            model: stored.model ?? "",
            hasApiKey: Boolean(s.apiKey),
            bridgeUrl: s.bridgeUrl ?? "",
            hasBridgeToken: Boolean(s.bridgeToken),
            nhitlOptIn: s.nhitlOptIn === true,
            running,
            audit: ((stored[AUDIT_KEY] as string[] | undefined) ?? []).slice(
              -20,
            ),
          });
          break;
        }
        default:
          break;
      }
    } catch (error) {
      port.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

chrome.runtime.onMessage.addListener(
  (
    message: Record<string, any>,
    sender: { tab?: { id?: number } },
    sendResponse: (response: unknown) => void,
  ) => {
    switch (message.type) {
      case "tool-call":
        void session.call(message.name, message.args ?? {}).then(sendResponse);
        return true;
      case "run-request":
        void startRun(String(message.goal), message.screenshot === true);
        return false;
      case "set-autonomy":
        void setAutonomy(message.level as Autonomy).catch((error) =>
          broadcast({ type: "error", message: String(error) }),
        );
        return false;
      case "approval_response":
        pendingApprovals.get(message.id)?.(message.approved === true);
        pendingApprovals.delete(message.id);
        return false;
      case "webmcp-count":
        if (sender.tab?.id !== undefined) {
          void chrome.action.setBadgeText({
            tabId: sender.tab.id,
            text: message.count > 0 ? String(message.count) : "",
          });
        }
        return false;
      case "bridge-config":
        void (async () => {
          try {
            const s = await secrets();
            (globalThis as { __bc?: unknown }).__bc = s;
            sendResponse({
              bridgeUrl: s.bridgeUrl,
              bridgeToken: s.bridgeToken,
            });
          } catch (error) {
            sendResponse({ error: String(error) });
          }
        })();
        return true;
      case "keepalive":
        sendResponse({ ok: true });
        return false;
      default:
        return false;
    }
  },
);

chrome.storage.onChanged.addListener(
  (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== "session") return;
    if (
      changes.autonomy?.newValue &&
      changes.autonomy.newValue !== session.autonomy
    ) {
      // setAutonomy re-validates the nhitl opt-in before applying.
      void setAutonomy(changes.autonomy.newValue as Autonomy).catch(
        () => undefined,
      );
    }
    if (changes.bridgeUrl || changes.bridgeToken) {
      void chrome.runtime
        .sendMessage({ type: "reconnect-bridge" })
        .catch(() => undefined);
    }
  },
);

chrome.runtime.onInstalled.addListener(() => {
  void ensureOffscreen().catch(() => undefined);
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
});
chrome.runtime.onStartup.addListener(
  () => void ensureOffscreen().catch(() => undefined),
);
void ensureOffscreen().catch(() => undefined);
void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
secrets().then((s) => {
  const level = s.autonomy;
  if (level) void setAutonomy(level).catch(() => undefined);
});

// Test hook for the launcher / smoke checks.
(globalThis as { __yoloAgent?: unknown }).__yoloAgent = {
  session,
  browser,
  backend,
  secrets,
};
