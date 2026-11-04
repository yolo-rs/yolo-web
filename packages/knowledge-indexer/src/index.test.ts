import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeIndexDb, type TargetDomain } from "./index.js";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = join(process.cwd(), "data", "knowledge", "test_indexer.sqlite");

describe("@yolo-web/knowledge-indexer - SQLite DB & RAG Feeder", () => {
  let db: KnowledgeIndexDb;

  beforeAll(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new KnowledgeIndexDb(TEST_DB);
  });

  afterAll(() => {
    db.close();
    try {
      if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
      const wal = `${TEST_DB}-wal`;
      const shm = `${TEST_DB}-shm`;
      if (existsSync(wal)) unlinkSync(wal);
      if (existsSync(shm)) unlinkSync(shm);
    } catch {
      // Ignored on Windows if file handle is delayed
    }
  });

  it("inserts verified test knowledge records across the 4 key target domains", () => {
    const targets: Array<{ domain: TargetDomain; url: string; title: string }> =
      [
        {
          domain: "google.com",
          url: "https://www.google.com/search?q=servo+browser",
          title: "Google Search",
        },
        {
          domain: "cloudflare.com",
          url: "https://www.cloudflare.com/learning/bots/what-is-a-bot/",
          title: "Cloudflare Bot Defense",
        },
        {
          domain: "chromium.org",
          url: "https://www.chromium.org/developers/how-tos/get-the-code/",
          title: "Chromium Source Architecture",
        },
        {
          domain: "chromiumos.org",
          url: "https://www.chromiumos.org/chromium-os/quick-start-guide",
          title: "ChromiumOS Core System",
        },
      ];

    for (let depth = 0; depth < 2; depth++) {
      for (const t of targets) {
        const id = db.recordTestKnowledge({
          testSuite: "recursive-target-suite",
          testName: `verify-${t.domain}-depth-${depth}`,
          targetDomain: t.domain,
          targetUrl: `${t.url}&depth=${depth}`,
          depth,
          statusCode: 200,
          status: "PASSED",
          title: t.title,
          extractedText: `Grounding text for ${t.domain} at recursion depth ${depth} verified via Chromium V8 & Obscura engine.`,
          ragSnippet: `Snippet: ${t.domain} verified at depth ${depth}`,
          shieldsBlocked: false,
          discoveredUrls: [
            `https://${t.domain}/subpath-1`,
            `https://${t.domain}/subpath-2`,
          ],
        });
        expect(id).toBeGreaterThan(0);
      }
    }

    expect(db.getCount()).toBe(8);
  });

  it("performs semantic / RAG vector cosine similarity search", () => {
    const results = db.ragSearch("Cloudflare bot defense and security", 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].targetDomain).toBe("cloudflare.com");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("exports verified test knowledge to Markdown Docs and Skill references", async () => {
    const tempDocs = join(process.cwd(), "data", "knowledge", "temp_docs.md");
    const tempSkill = join(process.cwd(), "data", "knowledge", "temp_skill.md");

    await db.syncToDocsAndSkill(tempDocs, tempSkill);
    expect(existsSync(tempDocs)).toBe(true);
    expect(existsSync(tempSkill)).toBe(true);

    const content = await Bun.file(tempDocs).text();
    expect(content).toContain("## Target: `google.com`");
    expect(content).toContain("## Target: `cloudflare.com`");
    expect(content).toContain("## Target: `chromium.org`");
    expect(content).toContain("## Target: `chromiumos.org`");

    if (existsSync(tempDocs)) unlinkSync(tempDocs);
    if (existsSync(tempSkill)) unlinkSync(tempSkill);
  });
});
