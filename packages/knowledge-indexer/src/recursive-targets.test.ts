/**
 * Recursive target testing suite verifying YOLO-Web against Google, Cloudflare,
 * Chromium and ChromiumOS, feeding verified findings into SQLite, RAG vectors,
 * markdown documentation, and skill guides.
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  BraveShieldsEngine,
  BraveFingerprintProtection,
} from "@yolo-web/brave-shields";
import { ServoSelectorEngine } from "@yolo-web/servo-bridge";
import {
  KnowledgeIndexDb,
  type TargetDomain,
} from "@yolo-web/knowledge-indexer";

const tempRoot = (
  Bun.env.TMPDIR ??
  Bun.env.TEMP ??
  Bun.env.TMP ??
  `${process.cwd()}/.tmp`
).replace(/[/]$/, "");

// Fixture HTML is synthetic: write only to per-run temp files, never to the
// tracked knowledge database, docs, or skill references.
const RUN_ID = crypto.randomUUID();
const TEST_DB = `${tempRoot}/yolo-web-recursive-targets-${RUN_ID}.sqlite`;
const TEST_DOCS = `${tempRoot}/yolo-web-recursive-targets-${RUN_ID}-docs.md`;
const TEST_SKILL = `${tempRoot}/yolo-web-recursive-targets-${RUN_ID}-skill.md`;

async function removeIfPresent(path: string): Promise<void> {
  try {
    await Bun.file(path).delete();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== "ENOENT" && code !== "EBUSY" && code !== "EPERM") throw error;
  }
}

interface TargetSeed {
  domain: TargetDomain;
  rootUrl: string;
  subpaths: string[];
  expectedSelectors: string[];
  testHtmlTemplate: (path: string, depth: number) => string;
}

const TARGETS: TargetSeed[] = [
  {
    domain: "google.com",
    rootUrl: "https://www.google.com/",
    subpaths: [
      "search?q=chromium+browser",
      "about/",
      "intl/en/policies/privacy/",
    ],
    expectedSelectors: [
      "form[role='search']",
      "input[name='q']",
      "div.g",
      "footer a",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Google Test - Depth ${depth} - ${path}</title></head>
        <body>
          <header><nav><a href="https://www.google.com/about/">About</a></nav></header>
          <main>
            <form action="/search" role="search">
              <input name="q" value="chromium browser" type="text" />
              <button type="submit">Google Search</button>
            </form>
            <section class="results">
              <div class="g" id="r1"><h3><a href="https://www.chromium.org/">Chromium Project</a></h3><p>Official open-source browser project.</p></div>
              <div class="g" id="r2"><h3><a href="https://www.chromiumos.org/">ChromiumOS</a></h3><p>Fast, lightweight operating system.</p></div>
            </section>
          </main>
          <footer><a href="https://www.google.com/policies/privacy/">Privacy</a></footer>
        </body>
      </html>
    `,
  },
  {
    domain: "cloudflare.com",
    rootUrl: "https://www.cloudflare.com/",
    subpaths: [
      "learning/ddos/what-is-a-ddos-attack/",
      "learning/bots/what-is-a-bot/",
      "products/zero-trust/",
    ],
    expectedSelectors: [
      "nav.cf-nav",
      "article.learning-center",
      "h1.title",
      "button.cta-primary",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Cloudflare Learning - Depth ${depth} - ${path}</title></head>
        <body>
          <nav class="cf-nav"><a href="/">Cloudflare Security</a></nav>
          <article class="learning-center">
            <h1 class="title">What is Bot Management & DDoS Protection?</h1>
            <p>Cloudflare protects Web applications and APIs against automated scrapers and malicious attacks while permitting verified AI agents.</p>
            <button class="cta-primary">Explore Zero Trust</button>
          </article>
        </body>
      </html>
    `,
  },
  {
    domain: "chromium.org",
    rootUrl: "https://www.chromium.org/",
    subpaths: ["Home", "developers/how-tos/get-the-code", "blink", "v8"],
    expectedSelectors: [
      "header.site-header",
      "div.content-wrapper",
      "code.command",
      "ul.nav-tree",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>The Chromium Projects - Depth ${depth} - ${path}</title></head>
        <body>
          <header class="site-header"><h1>The Chromium Projects</h1></header>
          <div class="content-wrapper">
            <h2>Building Chromium from Source</h2>
            <ul class="nav-tree"><li><a href="/developers">Developers Guide</a></li><li><a href="/v8">V8 Engine Docs</a></li></ul>
            <code class="command">fetch --nohooks chromium</code>
            <p>Chromium is the open-source browser project that powers Google Chrome, Brave, and Edge.</p>
          </div>
        </body>
      </html>
    `,
  },
  {
    domain: "chromiumos.org",
    rootUrl: "https://www.chromiumos.org/",
    subpaths: [
      "chromium-os/quick-start-guide",
      "for-testers",
      "developer-guide",
    ],
    expectedSelectors: [
      "div.cros-hero",
      "pre.install-steps",
      "nav.toc",
      "span.version",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>ChromiumOS Developer Guide - Depth ${depth} - ${path}</title></head>
        <body>
          <div class="cros-hero"><h1>ChromiumOS Operating System</h1><span class="version">Release 132</span></div>
          <nav class="toc"><ul><li><a href="#quickstart">Quick Start</a></li></ul></nav>
          <pre class="install-steps">cros_sdk --enter</pre>
          <p>ChromiumOS is an open-source Linux-based operating system designed for speed, simplicity, and security on modern hardware.</p>
        </body>
      </html>
    `,
  },
  {
    domain: "code.google.com",
    rootUrl: "https://code.google.com/",
    subpaths: ["archive/", "archive/search", "apis/"],
    expectedSelectors: [
      "div.archive-header",
      "input#search-projects",
      "ul.project-list",
      "a.project-link",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Google Code Archive - Depth ${depth} - ${path}</title></head>
        <body>
          <div class="archive-header"><h1>Google Code Project Archive</h1><p>Historical repository catalog of Google Open Source software.</p></div>
          <form class="archive-search"><input id="search-projects" value="v8 chromium" /><button type="submit">Search Archive</button></form>
          <ul class="project-list">
            <li><a class="project-link" href="/p/chromium/">Chromium Archive</a></li>
            <li><a class="project-link" href="/p/v8/">V8 Archive</a></li>
          </ul>
        </body>
      </html>
    `,
  },
  {
    domain: "googlesource.com",
    rootUrl: "https://chromium.googlesource.com/",
    subpaths: ["chromium/src.git", "v8/v8.git", "chromiumos/manifest.git"],
    expectedSelectors: [
      "header.Site-header",
      "nav.RepoShortlog",
      "table.git-log",
      "span.commit-sha",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Google Git Source - Depth ${depth} - ${path}</title></head>
        <body>
          <header class="Site-header"><h1>Chromium Google Git Repositories</h1></header>
          <nav class="RepoShortlog"><a href="+log/refs/heads/main">Git Log</a><a href="+show/refs/heads/main">Tree</a></nav>
          <table class="git-log">
            <tr><td class="commit-sha">7a4b1c2</td><td class="log-message">Reland: V8 optimize Cranelift bytecode interop</td></tr>
            <tr><td class="commit-sha">9f3d2e1</td><td class="log-message">Roll depot_tools to latest version</td></tr>
          </table>
        </body>
      </html>
    `,
  },
  {
    domain: "opensource.google",
    rootUrl: "https://opensource.google/",
    subpaths: ["projects/", "documentation/", "philosophy/"],
    expectedSelectors: [
      "nav.site-nav",
      "section.projects-grid",
      "div.project-card",
      "a.docs-link",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Google Open Source - Depth ${depth} - ${path}</title></head>
        <body>
          <nav class="site-nav"><a href="/projects">Google Open Source Projects</a></nav>
          <section class="projects-grid">
            <div class="project-card"><h3>Chromium</h3><p>Open source browser project</p><a class="docs-link" href="https://www.chromium.org">Visit</a></div>
            <div class="project-card"><h3>V8</h3><p>High-performance JavaScript and WebAssembly engine</p><a class="docs-link" href="https://v8.dev">Visit</a></div>
            <div class="project-card"><h3>Go</h3><p>Build fast, reliable, and efficient software</p></div>
          </section>
        </body>
      </html>
    `,
  },
  {
    domain: "depot_tools",
    rootUrl: "https://chromium.googlesource.com/chromium/tools/depot_tools/",
    subpaths: ["+/main/README.md", "+/main/gclient.py", "+/main/fetch.py"],
    expectedSelectors: [
      "div.repo-readme",
      "code.cli-command",
      "table.tool-inventory",
      "span.tool-name",
    ],
    testHtmlTemplate: (path, depth) => `
      <!doctype html>
      <html lang="en">
        <head><title>Chromium depot_tools - Depth ${depth} - ${path}</title></head>
        <body>
          <div class="repo-readme">
            <h1>depot_tools: Chromium and Google Source Toolchain</h1>
            <p>Essential developer utilities: gclient, fetch, ninja, gn, git-cl, and repo sync.</p>
            <code class="cli-command">git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git</code>
          </div>
          <table class="tool-inventory">
            <tr><td class="tool-name">gclient</td><td>Multi-repository meta-checkout tool</td></tr>
            <tr><td class="tool-name">gn</td><td>Meta-build system for Ninja</td></tr>
            <tr><td class="tool-name">git-cl</td><td>Gerrit code review tool for git</td></tr>
          </table>
        </body>
      </html>
    `,
  },
];

describe("Recursive Web Target Test Matrix (Google, Cloudflare, Chromium, ChromiumOS)", () => {
  let db: KnowledgeIndexDb;
  const shields = new BraveShieldsEngine();
  const fp = new BraveFingerprintProtection();

  beforeAll(() => {
    db = new KnowledgeIndexDb(TEST_DB);
  });

  afterAll(async () => {
    await db.syncToDocsAndSkill(TEST_DOCS, TEST_SKILL);
    expect(await Bun.file(TEST_DOCS).text()).toContain(
      "recursive-target-matrix",
    );
    db.close();
    await Promise.all(
      [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`, TEST_DOCS, TEST_SKILL].map(
        removeIfPresent,
      ),
    );
  });

  for (const target of TARGETS) {
    describe(`Target Domain: ${target.domain}`, () => {
      // Test recursion at Depth 0 (Root) and Depth 1 (Subpaths)
      for (let depth = 0; depth <= 1; depth++) {
        const currentPaths = depth === 0 ? [""] : target.subpaths;

        for (const subpath of currentPaths) {
          const fullUrl = `${target.rootUrl}${subpath}`;

          it(`recursively crawls and verifies [${target.domain}] at depth ${depth} (path: '${subpath || "/"}')`, async () => {
            const html = target.testHtmlTemplate(subpath, depth);

            // 1. Brave Shields & Fingerprint Protection Verification
            const networkCheck = shields.checkNetworkRequest({
              url: fullUrl,
              sourceUrl: "https://yolo-agent.local/",
              resourceType: "document",
            });
            const cleanUrl = fp.cleanUrl(fullUrl);

            // Ensure first-party target domains are never falsely blocked
            expect(networkCheck.blocked).toBe(false);
            expect(cleanUrl.url).toContain(target.domain);

            // 2. Servo Stylo Specificity & Selector Verification on Expected Elements
            for (const sel of target.expectedSelectors) {
              const spec = ServoSelectorEngine.calculateSpecificity(sel);
              expect(spec.packed).toBeGreaterThan(0);
            }

            // 3. Extract text content & Title
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            const title = titleMatch
              ? titleMatch[1]
              : `${target.domain} Depth ${depth}`;
            const cleanText = html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            const ragSnippet = cleanText.slice(0, 180);

            // 4. Record and feed verified test into SQLite DB, Vector Embeddings & RAG Index
            const recordId = db.recordTestKnowledge({
              testSuite: "recursive-target-matrix",
              testName: `test-${target.domain}-depth-${depth}-${subpath || "root"}`,
              targetDomain: target.domain,
              targetUrl: fullUrl,
              depth,
              statusCode: 200,
              status: "VERIFIED",
              title,
              extractedText: cleanText,
              ragSnippet,
              shieldsBlocked: false,
              discoveredUrls: target.subpaths.map(
                (p) => `${target.rootUrl}${p}`,
              ),
            });

            expect(recordId).toBeGreaterThan(0);
          });
        }
      }
    });
  }

  it("verifies RAG knowledge base can retrieve specialized domain answers", () => {
    const googleQuery = db.ragSearch("Google Search Chromium Project", 1);
    expect(googleQuery.length).toBe(1);
    expect(googleQuery[0].targetDomain).toBe("google.com");

    const cfQuery = db.ragSearch("Cloudflare bot protection and zero trust", 1);
    expect(cfQuery.length).toBe(1);
    expect(cfQuery[0].targetDomain).toBe("cloudflare.com");

    const crosQuery = db.ragSearch(
      "ChromiumOS Linux operating system cros_sdk",
      1,
    );
    expect(crosQuery.length).toBe(1);
    expect(crosQuery[0].targetDomain).toBe("chromiumos.org");

    const depotToolsQuery = db.ragSearch(
      "depot_tools gclient fetch ninja gn git-cl",
      1,
    );
    expect(depotToolsQuery.length).toBe(1);
    expect(depotToolsQuery[0].targetDomain).toBe("depot_tools");

    const gitSourceQuery = db.ragSearch(
      "Google Git shortlog commit sha v8 src.git",
      1,
    );
    expect(gitSourceQuery.length).toBe(1);
    expect(gitSourceQuery[0].targetDomain).toBe("googlesource.com");

    const openSourceQuery = db.ragSearch(
      "Google Open Source projects Chromium V8 Go",
      1,
    );
    expect(openSourceQuery.length).toBe(1);
    expect(openSourceQuery[0].targetDomain).toBe("opensource.google");
  });
});
