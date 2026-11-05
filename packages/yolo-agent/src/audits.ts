// SPDX-License-Identifier: Apache-2.0
/**
 * Best-practice checks the agent can run as tools. They encode a subset of
 * modern-web-guidance guides and Chrome DevTools practice (Tracing domain,
 * console and network capture, accessibility tree audit). They are
 * heuristics, not Lighthouse: scores are not computed.
 */
import type { CdpResult } from "./cdp.ts";
import type { AxNode } from "./observe.ts";
import { INTERACTIVE_ROLES } from "./observe.ts";
import type { PageSession } from "./page.ts";

export type Severity = "error" | "warning" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  count: number;
  examples: string[];
  /** Path under .agents/skills/modern-web-guidance/guides when a guide covers it. */
  guide?: string;
}

// ------------------------------------------------------------ page audit

const PAGE_AUDIT_SCRIPT = `(() => {
  const out = [];
  const add = (id, severity, message, nodes, guide) => {
    const list = Array.isArray(nodes) ? nodes : [];
    if (list.length === 0 && nodes !== true) return;
    out.push({ id, severity, message, count: list.length || 1, examples: list.slice(0, 3).map(n => typeof n === "string" ? n : (n.outerHTML || "").slice(0, 120)), guide });
  };
  const q = (s) => [...document.querySelectorAll(s)];
  const vh = innerHeight;
  add("document-title", "error", "Document has no <title>", !document.title.trim() ? true : []);
  add("html-lang", "error", "<html> has no lang attribute", !document.documentElement.lang ? true : [], "accessibility/accessibility");
  const vp = document.querySelector('meta[name="viewport"]');
  add("viewport-meta", "warning", "No viewport meta tag (mobile layout)", !vp ? true : []);
  add("viewport-zoom-disabled", "error", "Viewport meta disables zoom", vp && /user-scalable\\s*=\\s*(no|0)|maximum-scale\\s*=\\s*1(\\.0)?\\b/.test(vp.content) ? true : [], "accessibility/respect-os-text-scale");
  add("meta-description", "info", "No meta description", !document.querySelector('meta[name="description"]') ? true : []);
  add("h1-count", "warning", "Page should have exactly one <h1>", q("h1").length !== 1 ? [\`found \${q("h1").length}\`] : []);
  const heads = q("h1,h2,h3,h4,h5,h6").map(h => +h.tagName[1]);
  const skips = []; for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i-1] > 1) skips.push(\`h\${heads[i-1]} -> h\${heads[i]}\`);
  add("heading-order", "warning", "Heading levels skip", skips);
  add("img-alt", "error", "Images without alt attribute", q("img:not([alt])"), "accessibility/accessibility");
  add("img-dimensions", "warning", "Images without width/height or aspect-ratio (layout shift)", q("img").filter(i => !(i.getAttribute("width") && i.getAttribute("height")) && !getComputedStyle(i).aspectRatio.match(/\\d/)), "performance/optimize-image-priority");
  add("img-lazy-offscreen", "info", "Below-the-fold images without loading=lazy", q("img").filter(i => i.getBoundingClientRect().top > vh * 1.5 && i.loading !== "lazy"), "performance/optimize-image-priority");
  add("render-blocking-script", "warning", "Synchronous scripts in <head> block rendering", q("head script[src]:not([async]):not([defer]):not([type=module])"), "performance/optimize-script-priority");
  add("button-name", "error", "Buttons without an accessible name", q("button,[role=button]").filter(b => !(b.innerText || b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.title || b.querySelector("img[alt]:not([alt=''])")).trim()), "accessibility/accessibility");
  add("link-name", "error", "Links without an accessible name", q("a[href]").filter(a => !(a.innerText || a.getAttribute("aria-label") || a.getAttribute("aria-labelledby") || a.title || a.querySelector("img[alt]:not([alt=''])")).trim()), "accessibility/accessibility");
  const fields = q("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]),select,textarea");
  add("form-label", "error", "Form fields without a label", fields.filter(f => !(f.labels && f.labels.length) && !f.getAttribute("aria-label") && !f.getAttribute("aria-labelledby") && !f.title), "forms/forms");
  const ac = { email: "email", tel: "tel", password: "current-password" };
  add("autocomplete", "info", "Email, phone and password fields without autocomplete", fields.filter(f => ac[f.type] && !f.autocomplete), "forms/autofill-sign-in-form");
  add("fake-dialog", "warning", "role=dialog on a non-<dialog> element (prefer <dialog> or popover)", q("[role=dialog]:not(dialog),[role=alertdialog]:not(dialog)"), "ui-components");
  add("duplicate-id", "error", "Duplicate id attributes", (() => { const seen = new Set(), dup = new Set(); q("[id]").forEach(e => seen.has(e.id) ? dup.add(e.id) : seen.add(e.id)); return [...dup]; })(), "accessibility/accessibility");
  const nodes = document.getElementsByTagName("*").length;
  add("dom-size", "warning", \`Large DOM (\${nodes} elements; budget 1500)\`, nodes > 1500 ? [String(nodes)] : []);
  add("insecure-form", "error", "Form posts to http:// or password field on non-HTTPS page", q("form[action^='http://']").concat(location.protocol === "http:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1" ? q("input[type=password]") : []), "security");
  const mixed = location.protocol === "https:" ? performance.getEntriesByType("resource").filter(e => e.name.startsWith("http://")).map(e => e.name) : [];
  add("mixed-content", "error", "HTTP subresources on an HTTPS page", mixed, "security");
  const forms = q("form[toolname]").map(f => f.getAttribute("toolname"));
  const mc = document.modelContext || navigator.modelContext;
  out.push({ id: "webmcp", severity: "info", message: "WebMCP: " + (mc ? "modelContext present" : "no modelContext") + ", " + forms.length + " declarative tool form(s)", count: forms.length, examples: forms.slice(0, 3), guide: "webmcp/agentic-forms" });
  return out;
})()`;

export async function auditPage(page: PageSession): Promise<Finding[]> {
  return page.evaluate<Finding[]>(PAGE_AUDIT_SCRIPT);
}

// ------------------------------------------------------- accessibility

/** Accessibility-tree audit: nameless interactive nodes and unlabeled landmarks. */
export function auditAxNodes(nodes: AxNode[]): Finding[] {
  const nameless: string[] = [];
  let interactive = 0;
  for (const node of nodes) {
    if (node.ignored) continue;
    const role = String(node.role?.value ?? "");
    if (!INTERACTIVE_ROLES.has(role)) continue;
    interactive++;
    if (!String(node.name?.value ?? "").trim())
      nameless.push(`${role} (backend ${node.backendDOMNodeId ?? "?"})`);
  }
  const findings: Finding[] = [];
  if (nameless.length) {
    findings.push({
      id: "ax-name-missing",
      severity: "error",
      message:
        "Interactive accessibility nodes without an accessible name; an agent cannot target them reliably",
      count: nameless.length,
      examples: nameless.slice(0, 5),
      guide: "accessibility/accessibility",
    });
  }
  const main = nodes.filter(
    (n) => !n.ignored && n.role?.value === "main",
  ).length;
  if (main !== 1) {
    findings.push({
      id: "ax-main-landmark",
      severity: "warning",
      message: `Expected exactly one main landmark, found ${main}`,
      count: 1,
      examples: [],
    });
  }
  findings.push({
    id: "ax-summary",
    severity: "info",
    message: `${interactive} interactive nodes in the accessibility tree`,
    count: interactive,
    examples: [],
  });
  return findings;
}

export async function auditA11y(page: PageSession): Promise<Finding[]> {
  const tree = await page.send("Accessibility.getFullAXTree");
  const dom = (await auditPage(page)).filter((f) =>
    [
      "img-alt",
      "button-name",
      "link-name",
      "form-label",
      "html-lang",
      "heading-order",
      "h1-count",
      "duplicate-id",
      "viewport-zoom-disabled",
    ].includes(f.id),
  );
  return [...auditAxNodes(tree.nodes as AxNode[]), ...dom];
}

// ----------------------------------------------------- console / network

export interface ErrorReport {
  console: {
    level: string;
    text: string;
    source: string;
    url?: string;
    line?: number;
  }[];
  network: {
    url: string;
    status?: number;
    failed?: string;
    blocked?: string;
  }[];
  summary: string;
}

export function auditErrors(page: PageSession): ErrorReport {
  const consoleErrors = page.consoleLog.filter(
    (e) =>
      ["error", "assert", "warning", "warn"].includes(e.level) ||
      e.source === "exception",
  );
  const netErrors = page.network.filter(
    (n) => n.failed || (n.status !== undefined && n.status >= 400),
  );
  return {
    console: consoleErrors.map(({ level, text, source, url, line }) => ({
      level,
      text: text.slice(0, 300),
      source,
      url,
      line,
    })),
    network: netErrors.map(({ url, status, failed, blocked }) => ({
      url: url.slice(0, 200),
      status,
      failed,
      blocked,
    })),
    summary: `${consoleErrors.length} console error/warning entries, ${netErrors.length} failed or 4xx/5xx requests since last navigation`,
  };
}

// ---------------------------------------------------------------- tracing

export interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  args?: CdpResult;
  cat?: string;
}

export type Rating = "good" | "needs-improvement" | "poor";

export interface TraceSummary {
  events: number;
  fcpMs?: number;
  lcpMs?: number;
  cls: number;
  longTasks: number;
  tbtMs: number;
  ratings: { lcp?: Rating; cls: Rating; tbt: Rating };
  note: string;
}

function rate(value: number, good: number, poor: number): Rating {
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

/** Derives FCP, LCP, CLS (session windows), long tasks and TBT from raw trace events. */
export function summarizeTrace(events: TraceEvent[]): TraceSummary {
  const nav = events
    .filter((e) => e.name === "navigationStart" && e.args?.frame)
    .sort((a, b) => a.ts - b.ts)
    .at(-1);
  const origin =
    nav?.ts ??
    Math.min(
      ...events.map((e) => e.ts).filter((t) => t > 0),
      Number.POSITIVE_INFINITY,
    );
  const rel = (e: TraceEvent) => (e.ts - origin) / 1000;

  const fcp = events.find(
    (e) =>
      e.name === "firstContentfulPaint" &&
      (!nav || e.args?.frame === nav.args?.frame),
  );
  const lcpCandidates = events
    .filter(
      (e) =>
        e.name === "largestContentfulPaint::Candidate" &&
        (!nav || e.args?.frame === nav.args?.frame),
    )
    .sort((a, b) => a.ts - b.ts);
  const lcp = lcpCandidates.at(-1);

  const shifts = events
    .filter(
      (e) =>
        e.name === "LayoutShift" &&
        e.args?.data &&
        e.args.data.is_main_frame !== false &&
        !e.args.data.had_recent_input,
    )
    .sort((a, b) => a.ts - b.ts);
  let cls = 0;
  let windowSum = 0;
  let windowStart = 0;
  let last = 0;
  for (const shift of shifts) {
    const score = Number(shift.args?.data?.score ?? 0);
    if (
      windowSum > 0 &&
      (shift.ts - last > 1_000_000 || shift.ts - windowStart > 5_000_000)
    ) {
      cls = Math.max(cls, windowSum);
      windowSum = 0;
    }
    if (windowSum === 0) windowStart = shift.ts;
    windowSum += score;
    last = shift.ts;
  }
  cls = Math.max(cls, windowSum);

  const fcpMs = fcp ? rel(fcp) : undefined;
  const tasks = events.filter(
    (e) => e.name === "RunTask" && e.ph === "X" && (e.dur ?? 0) > 50_000,
  );
  const tbtMs = tasks
    .filter((t) => fcp === undefined || t.ts >= fcp.ts)
    .reduce((sum, t) => sum + ((t.dur ?? 0) / 1000 - 50), 0);

  return {
    events: events.length,
    fcpMs: fcpMs === undefined ? undefined : Math.round(fcpMs),
    lcpMs: lcp ? Math.round(rel(lcp)) : undefined,
    cls: Math.round(cls * 1000) / 1000,
    longTasks: tasks.length,
    tbtMs: Math.round(tbtMs),
    ratings: {
      lcp: lcp ? rate(rel(lcp), 2500, 4000) : undefined,
      cls: rate(cls, 0.1, 0.25),
      tbt: rate(tbtMs, 200, 600),
    },
    note: "Lab values from a single trace. INP needs real interactions; TBT is its lab proxy. Thresholds follow web.dev (LCP 2.5s/4s, CLS 0.1/0.25, TBT 200/600ms).",
  };
}

const TRACE_CATEGORIES = [
  "-*",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "loading",
  "blink.user_timing",
  "latencyInfo",
  "v8.execute",
].join(",");

/** Records a trace over a reload (or `durationMs`) and returns the summary. Uses Tracing + IO streams. */
export async function tracePerformance(
  page: PageSession,
  options: { reload?: boolean; durationMs?: number } = {},
): Promise<TraceSummary & { metrics?: Record<string, number> }> {
  let streamHandle = "";
  const complete = new Promise<void>((resolve) => {
    const off = page.transport.on("Tracing.tracingComplete", (params, sid) => {
      if (sid !== page.sessionId) return;
      streamHandle = params.stream ?? "";
      off();
      resolve();
    });
  });
  await page.send("Performance.enable").catch(() => undefined);
  await page.send("Tracing.start", {
    traceConfig: {
      includedCategories: TRACE_CATEGORIES.split(",").filter((c) => c !== "-*"),
    },
    transferMode: "ReturnAsStream",
    streamFormat: "json",
  });
  if (options.reload !== false) {
    const before = page.loadSeq;
    await page.send("Page.reload", { ignoreCache: true });
    const deadline = Date.now() + 15_000;
    while (page.loadSeq === before && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, options.durationMs ?? 500)); // let LCP candidates settle
  } else {
    await new Promise((r) => setTimeout(r, options.durationMs ?? 1500));
  }
  const metricsRes = await page
    .send("Performance.getMetrics")
    .catch(() => undefined);
  await page.send("Tracing.end");
  await complete;
  let text = "";
  if (streamHandle) {
    for (;;) {
      const chunk = await page.send("IO.read", {
        handle: streamHandle,
        size: 1 << 20,
      });
      text += chunk.data as string;
      if (chunk.eof) break;
    }
    await page
      .send("IO.close", { handle: streamHandle })
      .catch(() => undefined);
  }
  const parsed = text
    ? (JSON.parse(text) as { traceEvents?: TraceEvent[] } | TraceEvent[])
    : [];
  const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
  const metrics = metricsRes
    ? Object.fromEntries(
        (metricsRes.metrics as { name: string; value: number }[]).map((m) => [
          m.name,
          m.value,
        ]),
      )
    : undefined;
  return { ...summarizeTrace(events), metrics };
}
