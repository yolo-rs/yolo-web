// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { indexer, GCLOUD_LEARN_AND_GVISOR_MODULES } from "../src/index.ts";

describe("google-indexer: Real-time Google Search, SQLite WAL RAG DB, Robots.txt & LLMs.txt Indexer", () => {
  test("searches indexed documents by query keyword", () => {
    const res = indexer.search("chromium");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].title).toContain("Google Bun");
  });

  test("seeds SQLite WAL RAG database with gcloud-learn and gVisor modules", () => {
    expect(indexer.ragDb.countChunks()).toBe(
      GCLOUD_LEARN_AND_GVISOR_MODULES.length,
    );
    const parisHits = indexer.ragDb.querySemanticRag(
      "europe-west9 Paris sovereign KMS",
    );
    expect(parisHits.length).toBeGreaterThan(0);
    expect(parisHits[0].track).toBe("paris-europe-west9");

    const gvisorHits = indexer.ragDb.querySemanticRag(
      "gVisor Sentry syscall Gofer LISAFS",
    );
    expect(gvisorHits[0].track).toBe("gvisor-sandbox");
  });

  test("generates robots.txt fully opened for Googlebot and LLMs", () => {
    const robots = indexer.generateRobotsTxt();
    expect(robots).toContain("User-agent: Googlebot");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("User-agent: Google-Extended");
  });

  test("generates llms.txt following official AI specification", () => {
    const llms = indexer.generateLlmsTxt();
    expect(llms).toContain(
      "# Google Bun: Sovereign Google Infrastructure Runtime",
    );
    expect(llms).toContain("Chromium Third-Party Management");
    expect(llms).toContain("Compiler & Sandbox Benchmark Suite");
  });
});
