#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * Static page audit approximating Lighthouse categories plus a copy/typography check.
 * It does not replace Lighthouse: it checks markup and header rules we control and reports
 * pass ratios per category.
 *
 *   bun scripts/audit-lighthouse-humanizer.ts                 start a local server and audit it
 *   bun scripts/audit-lighthouse-humanizer.ts --live URL...   audit deployed URLs (headers included)
 */
import { startAphrodySearchServer } from "../packages/google/src/search-server.ts";

type Check = { category: string; name: string; ok: boolean };

const BANNED_WORDS =
  /\b(revolutionary|cutting-edge|seamless(ly)?|next-generation|unparalleled|delve|empower|game-changing|tapestry|unleash)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

export function auditHtml(html: string, headers: Headers, checkHeaders: boolean): Check[] {
  const c = (category: string, name: string, ok: boolean): Check => ({ category, name, ok });
  const out: Check[] = [
    c("performance", "no render-blocking external scripts in head", !/<head[\s\S]*?<script[^>]+src=[^>]*>(?![\s\S]*<\/head>)/i.test(html.split("</head>")[0] ?? "")),
    c("performance", "svg elements declare size or viewBox", !/<svg(?![^>]*(viewBox|width))/i.test(html)),
    c("accessibility", "html lang attribute", /<html[^>]+lang=/i.test(html)),
    c("accessibility", "skip link", /class="skip-link"/.test(html)),
    c("accessibility", "main landmark", /<main[^>]+id="main-content"/.test(html)),
    c("accessibility", "reduced motion media query", /prefers-reduced-motion/.test(html)),
    c("accessibility", "visible focus style", /:focus-visible/.test(html)),
    c("best-practices", "theme-color meta", /name="theme-color"/.test(html)),
    c("best-practices", "manifest link", /rel="manifest"/.test(html)),
    c("seo", "title", /<title>[^<]+<\/title>/.test(html)),
    c("seo", "meta description", /name="description"/.test(html)),
    c("seo", "viewport", /name="viewport"/.test(html)),
    c("copy", "no emojis", !EMOJI.test(html)),
    c("copy", "no filler words", !BANNED_WORDS.test(html.replace(/<style[\s\S]*?<\/style>/g, ""))),
    c("copy", "no banned fonts", !/font-family:[^;]*\b(Roboto|Inter)\b/.test(html)),
  ];
  if (checkHeaders) {
    for (const h of [
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
      "cross-origin-opener-policy",
    ]) {
      out.push(c("best-practices", `header ${h}`, headers.has(h)));
    }
  }
  return out;
}

export function summarize(checks: Check[]): Record<string, { passed: number; total: number; score: number }> {
  const res: Record<string, { passed: number; total: number; score: number }> = {};
  for (const k of checks) {
    const e = (res[k.category] ??= { passed: 0, total: 0, score: 0 });
    e.total++;
    if (k.ok) e.passed++;
  }
  for (const e of Object.values(res)) e.score = Math.round((e.passed / e.total) * 100);
  return res;
}

async function auditUrl(url: string, checkHeaders: boolean): Promise<number> {
  const res = await fetch(url, { headers: { "user-agent": "yolo-audit/1.0" } });
  const html = await res.text();
  const checks = auditHtml(html, res.headers, checkHeaders);
  const summary = summarize(checks);
  console.log(`\n${url} -> HTTP ${res.status}`);
  for (const [cat, e] of Object.entries(summary)) {
    console.log(`  ${cat.padEnd(15)} ${String(e.score).padStart(3)}  (${e.passed}/${e.total})`);
  }
  for (const k of checks.filter((x) => !x.ok)) console.log(`  FAIL [${k.category}] ${k.name}`);
  return checks.filter((x) => !x.ok).length;
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  let failures = 0;
  if (args[0] === "--live") {
    for (const u of args.slice(1)) failures += await auditUrl(u, true);
  } else {
    const server = startAphrodySearchServer({ port: 0 });
    try {
      failures += await auditUrl(`http://127.0.0.1:${server.port}/`, false);
      failures += await auditUrl(`http://127.0.0.1:${server.port}/app/bevy`, false);
    } finally {
      await server.stop(true);
    }
  }
  console.log(`\ntotal failed checks: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}
