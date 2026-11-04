import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeIndexDb, type TargetDomain } from "./index.js";

const tempRoot = (
  Bun.env.TMPDIR ??
  Bun.env.TEMP ??
  Bun.env.TMP ??
  `${process.cwd()}/.tmp`
).replace(/[\/]$/, "");

// Unique file names per run: a stale database still held open by another
// process (EBUSY on Windows) can then never break setup or teardown.
const RUN_ID = crypto.randomUUID();
const TEST_DB = `${tempRoot}/yolo-web-test-indexer-${RUN_ID}.sqlite`;
const TEST_DOCS = `${tempRoot}/yolo-web-test-indexer-${RUN_ID}-docs.md`;
const TEST_SKILL = `${tempRoot}/yolo-web-test-indexer-${RUN_ID}-skill.md`;

async function removeIfPresent(path: string): Promise<void> {
  try {
    await Bun.file(path).delete();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    // ENOENT: already gone. EBUSY/EPERM: Windows may keep the SQLite -wal/-shm
    // handles for a moment after close(); the per-run name keeps leftovers harmless.
    if (code !== "ENOENT" && code !== "EBUSY" && code !== "EPERM") throw error;
  }
}

describe("@yolo-web/knowledge-indexer - SQLite DB & RAG Feeder", () => {
  let db: KnowledgeIndexDb;

  beforeAll(() => {
    db = new KnowledgeIndexDb(TEST_DB);
  });

  afterAll(async () => {
    db.close();
    await Promise.all(
      [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`, TEST_DOCS, TEST_SKILL].map(
        removeIfPresent,
      ),
    );
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
    await db.syncToDocsAndSkill(TEST_DOCS, TEST_SKILL);
    expect(await Bun.file(TEST_DOCS).exists()).toBe(true);
    expect(await Bun.file(TEST_SKILL).exists()).toBe(true);

    const content = await Bun.file(TEST_DOCS).text();
    expect(content).toContain("## Target: `google.com`");
    expect(content).toContain("## Target: `cloudflare.com`");
    expect(content).toContain("## Target: `chromium.org`");
    expect(content).toContain("## Target: `chromiumos.org`");
  });
});
