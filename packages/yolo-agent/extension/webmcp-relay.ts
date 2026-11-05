// SPDX-License-Identifier: Apache-2.0
/**
 * Isolated-world relay: reports the number of WebMCP tools (imperative via
 * the MAIN-world provider or native, plus declarative `form[toolname]`) to the
 * service worker, which shows it as the action badge. Counts only; no tool
 * definitions or page text leave the page here.
 */
let last = -1;

function report(imperative: number): void {
  const declarative = document.querySelectorAll("form[toolname]").length;
  const count = imperative + declarative;
  if (count === last) return;
  last = count;
  void chrome.runtime
    .sendMessage({ type: "webmcp-count", count })
    .catch(() => undefined);
}

document.addEventListener("yolo:webmcp:toolchange", (event) => {
  report((event as CustomEvent<{ count: number }>).detail?.count ?? 0);
});
addEventListener("DOMContentLoaded", () => report(0), { once: true });
