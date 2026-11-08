/**
 * @yolo-web/knowledge-indexer
 *
 * High-performance SQLite database, RAG vector index, and dynamic Markdown docs/skill
 * aggregator for YOLO-Web test runs targeting Google, Cloudflare, Chromium & ChromiumOS.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const join = (...parts: string[]): string => {
  const separator = parts[0]?.includes("\\") ? "\\" : "/";
  return parts.reduce((path, part) => {
    if (path.length === 0) return part;
    return `${path.replace(/[\\/]+$/, "")}${separator}${part.replace(/^[\\/]+/, "")}`;
  }, "");
};

export type TargetDomain =
  | "bun.com"
  | "google.com"
  | "cloudflare.com"
  | "chromium.org"
  | "chromiumos.org"
  | "code.google.com"
  | "googlesource.com"
  | "opensource.google"
  | "depot_tools";

export interface TestKnowledgeRecord {
  id?: number;
  testSuite: string;
  testName: string;
  targetDomain: TargetDomain;
  targetUrl: string;
  depth: number;
  statusCode: number;
  status: "PASSED" | "FAILED" | "VERIFIED";
  title?: string;
  extractedText: string;
  ragSnippet: string;
  embeddingVector?: number[]; // Simple float embedding for lightweight vector similarity
  shieldsBlocked?: boolean;
  discoveredUrls?: string[];
  recordedAt?: string;
}

export class KnowledgeIndexDb {
  private db: Database;
  readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath =
      customPath ??
      join(
        import.meta.dir,
        "../../../data/knowledge/yolo_web_knowledge.sqlite",
      );
    const parentDir = dirname(this.dbPath);
    if (parentDir && parentDir !== "." && parentDir !== "/") {
      try {
        mkdirSync(parentDir, { recursive: true });
      } catch {
        // Ignore if already exists or permission
      }
    }
    this.db = new Database(this.dbPath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL;");
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS test_knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_suite TEXT NOT NULL,
        test_name TEXT NOT NULL,
        target_domain TEXT NOT NULL,
        target_url TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        status_code INTEGER NOT NULL,
        status TEXT NOT NULL,
        title TEXT,
        extracted_text TEXT,
        rag_snippet TEXT,
        embedding_json TEXT,
        shields_blocked INTEGER DEFAULT 0,
        discovered_urls_json TEXT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_domain_depth 
      ON test_knowledge(target_domain, depth);
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_url 
      ON test_knowledge(target_url);
    `);
  }

  /**
   * Generates a deterministic normalized bag-of-words / character n-gram embedding vector.
   */
  static generateEmbedding(text: string, dimensions = 64): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word === undefined) continue;
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash * 31 + word.charCodeAt(j)) >>> 0;
      }
      const index = hash % dimensions;
      vector[index] = (vector[index] ?? 0) + 1.0;
    }

    // Normalize to unit vector
    const norm = Math.hypot(...vector);
    if (norm > 0) {
      for (let k = 0; k < dimensions; k++) {
        vector[k] = (vector[k] ?? 0) / norm;
      }
    }
    return vector;
  }

  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return dot;
  }

  recordTestKnowledge(record: TestKnowledgeRecord): number {
    const embedding =
      record.embeddingVector ??
      KnowledgeIndexDb.generateEmbedding(record.extractedText);
    const stmt = this.db.prepare(`
      INSERT INTO test_knowledge (
        test_suite, test_name, target_domain, target_url, depth,
        status_code, status, title, extracted_text, rag_snippet,
        embedding_json, shields_blocked, discovered_urls_json, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      record.testSuite,
      record.testName,
      record.targetDomain,
      record.targetUrl,
      record.depth,
      record.statusCode,
      record.status,
      record.title ?? null,
      record.extractedText,
      record.ragSnippet,
      JSON.stringify(embedding),
      record.shieldsBlocked ? 1 : 0,
      JSON.stringify(record.discoveredUrls ?? []),
      record.recordedAt ?? new Date().toISOString(),
    );

    return Number(result.lastInsertRowid);
  }

  /**
   * Performs semantic / RAG vector similarity search over accumulated test knowledge.
   */
  ragSearch(
    query: string,
    limit = 5,
  ): Array<TestKnowledgeRecord & { score: number }> {
    const queryVec = KnowledgeIndexDb.generateEmbedding(query);
    const rows = this.db
      .query(
        `
      SELECT id, test_suite, test_name, target_domain, target_url, depth,
             status_code, status, title, extracted_text, rag_snippet,
             embedding_json, shields_blocked, discovered_urls_json, recorded_at
      FROM test_knowledge
      ORDER BY id DESC LIMIT 200
    `,
      )
      .all() as any[];

    const scored = rows.map((r) => {
      const vec = JSON.parse(r.embedding_json ?? "[]") as number[];
      const score = KnowledgeIndexDb.cosineSimilarity(queryVec, vec);
      return {
        id: r.id,
        testSuite: r.test_suite,
        testName: r.test_name,
        targetDomain: r.target_domain as TargetDomain,
        targetUrl: r.target_url,
        depth: r.depth,
        statusCode: r.status_code,
        status: r.status,
        title: r.title,
        extractedText: r.extracted_text,
        ragSnippet: r.rag_snippet,
        embeddingVector: vec,
        shieldsBlocked: Boolean(r.shields_blocked),
        discoveredUrls: JSON.parse(r.discovered_urls_json ?? "[]"),
        recordedAt: r.recorded_at,
        score,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  getAllRecords(): TestKnowledgeRecord[] {
    const rows = this.db
      .query("SELECT * FROM test_knowledge ORDER BY depth ASC, id ASC")
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      testSuite: r.test_suite,
      testName: r.test_name,
      targetDomain: r.target_domain as TargetDomain,
      targetUrl: r.target_url,
      depth: r.depth,
      statusCode: r.status_code,
      status: r.status,
      title: r.title,
      extractedText: r.extracted_text,
      ragSnippet: r.rag_snippet,
      embeddingVector: JSON.parse(r.embedding_json ?? "[]"),
      shieldsBlocked: Boolean(r.shields_blocked),
      discoveredUrls: JSON.parse(r.discovered_urls_json ?? "[]"),
      recordedAt: r.recorded_at,
    }));
  }

  getCount(): number {
    const res = this.db
      .query("SELECT COUNT(*) as count FROM test_knowledge")
      .get() as { count: number };
    return res.count;
  }

  /**
   * Synchronizes verified test findings into Documentation and Skill Reference files.
   */
  async syncToDocsAndSkill(
    docsPath = join(
      import.meta.dir,
      "../../../docs/VERIFIED_TEST_KNOWLEDGE_BASE.md",
    ),
    skillRefPath = join(
      import.meta.dir,
      "../../../packages/web-plugin/skills/web/references/verified-targets-knowledge.md",
    ),
  ): Promise<void> {
    const records = this.getAllRecords();
    if (records.length === 0) return;

    const domains: TargetDomain[] = [
      "bun.com",
      "google.com",
      "cloudflare.com",
      "chromium.org",
      "chromiumos.org",
      "code.google.com",
      "googlesource.com",
      "opensource.google",
      "depot_tools",
    ];
    let md = `# YOLO-Web Verified Test Knowledge Base (RAG & Index Feeder)\n\n`;
    md += `*Generated automatically from recursive test suites targeting Google, Cloudflare, Chromium, and ChromiumOS.*\n\n`;
    md += `**Total Verified Test Artifacts**: ${records.length} records | **Last Updated**: ${new Date().toISOString()}\n\n`;

    for (const domain of domains) {
      const group = records.filter((r) => r.targetDomain === domain);
      md += `## Target: \`${domain}\` (${group.length} recursive passes)\n\n`;
      md += `| Test Suite | Depth | Target URL | HTTP | Status | Shields | RAG Grounding Summary |\n`;
      md += `| :--- | :---: | :--- | :---: | :---: | :---: | :--- |\n`;

      for (const item of group) {
        const titleOrSnippet = item.title ? `**${item.title}**: ` : "";
        const cleanSnippet = item.ragSnippet
          .replace(/[\r\n]+/g, " ")
          .slice(0, 100);
        md += `| \`${item.testSuite}\` | ${item.depth} | \`${item.targetUrl}\` | ${item.statusCode} | **${item.status}** | ${item.shieldsBlocked ? "Blocked" : "Allowed"} | ${titleOrSnippet}${cleanSnippet}... |\n`;
      }
      md += `\n`;
    }

    await Bun.write(docsPath, md);
    await Bun.write(skillRefPath, md);

    // An optional caller-provided path enables global mirroring cross-platform.
    const globalSkillRef = Bun.env.YOLO_WEB_GLOBAL_SKILL_REF;
    if (globalSkillRef) {
      try {
        await Bun.write(globalSkillRef, md);
      } catch {
        // A caller-provided optional path may not be writable.
      }
    }
  }

  close(): void {
    this.db.close();
  }
}
