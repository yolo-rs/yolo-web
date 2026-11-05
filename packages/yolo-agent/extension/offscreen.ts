// SPDX-License-Identifier: Apache-2.0
/**
 * Offscreen document: a persistent page that owns the loopback bridge
 * WebSocket (an MV3 service worker can be suspended; this page is not). It
 * relays `call`, `run`, `autonomy` and approval messages to the service worker
 * and forwards agent events back to bridge subscribers.
 */
let socket: WebSocket | undefined;
let backoff = 500;
let timer: ReturnType<typeof setTimeout> | undefined;

async function connect(): Promise<void> {
  if (timer) clearTimeout(timer);
  socket?.close();
  // Offscreen documents only get chrome.runtime: the service worker owns storage.
  const { bridgeUrl, bridgeToken } = ((await chrome.runtime
    .sendMessage({ type: "bridge-config" })
    .catch(() => undefined)) ?? {}) as {
    bridgeUrl?: string;
    bridgeToken?: string;
  };
  if (!bridgeUrl || !bridgeToken) return; // not configured: stay idle
  const url = `${bridgeUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ext?token=${encodeURIComponent(bridgeToken)}`;
  const ws = new WebSocket(url);
  socket = ws;
  ws.addEventListener("open", () => {
    backoff = 500;
  });
  const onMessage = async (event: MessageEvent) => {
    const message = JSON.parse(String(event.data)) as Record<string, any>;
    switch (message.type) {
      case "call": {
        const result = await chrome.runtime.sendMessage({
          type: "tool-call",
          name: message.name,
          args: message.args,
        });
        ws.send(JSON.stringify({ type: "result", id: message.id, result }));
        break;
      }
      case "run":
        void chrome.runtime.sendMessage({
          type: "run-request",
          goal: message.goal,
          screenshot: message.screenshot,
        });
        break;
      case "autonomy":
        void chrome.runtime.sendMessage({
          type: "set-autonomy",
          level: message.level,
        });
        break;
      case "approval_response":
        void chrome.runtime.sendMessage({
          type: "approval_response",
          id: message.id,
          approved: message.approved,
        });
        break;
      default:
        break;
    }
  };
  ws.addEventListener("message", (event) => {
    onMessage(event).catch((error) =>
      console.error("offscreen message handler failed", error),
    );
  });
  ws.addEventListener("close", () => {
    if (socket !== ws) return;
    timer = setTimeout(() => void connect(), backoff);
    backoff = Math.min(backoff * 2, 5000);
  });
}

chrome.runtime.onMessage.addListener((message: Record<string, any>) => {
  if (message.type === "agent-event" && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "event", event: message.event }));
  } else if (message.type === "reconnect-bridge") {
    void connect();
  }
});

// Keeps both the socket and the service worker alive.
setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ type: "ping" }));
  void chrome.runtime.sendMessage({ type: "keepalive" }).catch(() => undefined);
}, 20_000);

void connect();
