// SPDX-License-Identifier: Apache-2.0
/**
 * Side panel UI (plain DOM, no framework): mode toggle (human + AI or AI
 * only), autonomy level (ask, auto, no-human-in-the-loop with an explicit
 * per-session opt-in), goal input, live step feed, approvals, audit tail.
 */
const port = chrome.runtime.connect({ name: "sidepanel" });

const el = <T extends HTMLElement>(
  tag: string,
  props: Record<string, unknown> = {},
  ...children: (Node | string)[]
): T => {
  const node = document.createElement(tag) as T;
  Object.assign(node, props);
  node.append(...children);
  return node;
};

const log = el<HTMLDivElement>("div", {
  id: "log",
  role: "log",
  ariaLive: "polite",
});
const approvals = el<HTMLDivElement>("div", { id: "approvals" });
const status = el<HTMLParagraphElement>("p", {
  id: "status",
  textContent: "idle",
});
const goal = el<HTMLTextAreaElement>("textarea", {
  id: "goal",
  rows: 3,
  placeholder: "What should the agent do?",
});
const runButton = el<HTMLButtonElement>("button", {
  id: "run",
  textContent: "Run",
});
const stopButton = el<HTMLButtonElement>("button", {
  id: "stop",
  textContent: "Stop",
});
const shot = el<HTMLInputElement>("input", { id: "shot", type: "checkbox" });

const mode = el<HTMLSelectElement>("select", { id: "mode" });
mode.append(
  el("option", {
    value: "human+ai",
    textContent: "Human + AI (works in this window)",
  }),
  el("option", { value: "ai", textContent: "AI only (separate window)" }),
);
const autonomy = el<HTMLSelectElement>("select", { id: "autonomy" });
autonomy.append(
  el("option", { value: "ask", textContent: "Ask: approve every action" }),
  el("option", {
    value: "auto",
    textContent: "Auto: ask only for risky actions",
  }),
  el("option", { value: "nhitl", textContent: "No human in the loop" }),
);
const nhitl = el<HTMLInputElement>("input", { id: "nhitl", type: "checkbox" });
const apiKey = el<HTMLInputElement>("input", {
  id: "apikey",
  type: "password",
  placeholder: "Model API key (session memory only)",
  autocomplete: "off",
});
const model = el<HTMLInputElement>("input", {
  id: "model",
  type: "text",
  placeholder: "model id (default claude-sonnet-5-5)",
});
const bridgeUrl = el<HTMLInputElement>("input", {
  id: "bridge-url",
  type: "text",
  placeholder: "Bridge URL, e.g. http://127.0.0.1:7777",
});
const bridgeToken = el<HTMLInputElement>("input", {
  id: "bridge-token",
  type: "password",
  placeholder: "Bridge token",
  autocomplete: "off",
});
const save = el<HTMLButtonElement>("button", {
  id: "save",
  textContent: "Save settings",
});
const auditView = el<HTMLPreElement>("pre", { id: "audit" });

document.body.append(
  el("h1", { textContent: "YOLO Agent" }),
  el("label", {}, "Mode ", mode),
  el("label", {}, "Autonomy ", autonomy),
  el(
    "label",
    { id: "nhitl-row" },
    nhitl,
    " Allow no-human mode for this browser session (loopback only, audited)",
  ),
  goal,
  el(
    "div",
    { className: "row" },
    runButton,
    stopButton,
    el("label", {}, shot, " screenshots"),
  ),
  status,
  approvals,
  log,
  el(
    "details",
    {},
    el("summary", { textContent: "Settings" }),
    apiKey,
    model,
    bridgeUrl,
    bridgeToken,
    save,
  ),
  el(
    "details",
    {},
    el("summary", { textContent: "Audit log (last 20)" }),
    auditView,
  ),
  el("p", {
    className: "note",
    textContent:
      "Page content is untrusted data. The agent does not use credentials you did not provide.",
  }),
);

function line(text: string, className = ""): void {
  log.prepend(el("div", { className, textContent: text }));
  while (log.childElementCount > 200) log.lastElementChild?.remove();
}

runButton.addEventListener("click", () => {
  if (!goal.value.trim()) return;
  log.replaceChildren();
  port.postMessage({ type: "run", goal: goal.value, screenshot: shot.checked });
});
stopButton.addEventListener("click", () => port.postMessage({ type: "stop" }));
mode.addEventListener(
  "change",
  () => void chrome.storage.local.set({ mode: mode.value }),
);
autonomy.addEventListener("change", () => {
  if (autonomy.value === "nhitl" && !nhitl.checked) {
    line("Tick the no-human opt-in first.", "warn");
    autonomy.value = "ask";
    return;
  }
  port.postMessage({ type: "autonomy", level: autonomy.value });
});
save.addEventListener("click", async () => {
  const session: Record<string, unknown> = { nhitlOptIn: nhitl.checked };
  if (apiKey.value) session.apiKey = apiKey.value;
  if (bridgeUrl.value) session.bridgeUrl = bridgeUrl.value;
  if (bridgeToken.value) session.bridgeToken = bridgeToken.value;
  await chrome.storage.session.set(session);
  await chrome.storage.local.set({ mode: mode.value, model: model.value });
  apiKey.value = "";
  bridgeToken.value = "";
  line("Settings saved (secrets stay in session memory).");
  port.postMessage({ type: "state" });
});

port.onMessage.addListener((message: Record<string, any>) => {
  switch (message.type) {
    case "state":
      mode.value = message.mode;
      autonomy.value = message.autonomy;
      nhitl.checked = message.nhitlOptIn;
      model.value = message.model;
      bridgeUrl.value = message.bridgeUrl;
      status.textContent = `${message.running ? "running" : "idle"} | key ${message.hasApiKey ? "set" : "missing"} | bridge ${message.hasBridgeToken ? "configured" : "not configured"}`;
      auditView.textContent = (message.audit as string[]).join("");
      break;
    case "run_start":
      status.textContent = `running (${message.mode})`;
      break;
    case "text":
      line(message.text, "text");
      break;
    case "step":
      line(
        `${message.tool} ${message.execMs}ms${message.isError ? " ERROR" : ""}`,
        message.isError ? "err" : "step",
      );
      break;
    case "run_end":
      status.textContent = `${message.stopped} in ${message.turns} turns, ${message.totalMs}ms`;
      if (message.finalText) line(message.finalText, "final");
      if (message.error) line(message.error, "err");
      port.postMessage({ type: "state" });
      break;
    case "autonomy":
      autonomy.value = message.level;
      break;
    case "error":
      line(message.message, "err");
      break;
    case "approval_request": {
      const row = el<HTMLDivElement>(
        "div",
        { className: "approval" },
        `Approve ${message.action}? ${message.summary}`,
      );
      const answer = (approved: boolean) => {
        port.postMessage({
          type: "approval_response",
          id: message.id,
          approved,
        });
        row.remove();
      };
      row.append(
        el("button", { textContent: "Approve", onclick: () => answer(true) }),
        el("button", { textContent: "Deny", onclick: () => answer(false) }),
      );
      approvals.append(row);
      break;
    }
    default:
      break;
  }
});

port.postMessage({ type: "state" });
setInterval(() => port.postMessage({ type: "state" }), 20_000); // also keeps the service worker alive
