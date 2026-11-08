// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  crawler,
  GOOGLE_CRAWL_TARGETS,
  GOOGLE_NOVEMBER_2026_ANNOUNCEMENTS,
  GOOGLE_ECOSYSTEM_CHANNELS,
} from "../src/index.ts";

describe("google-crawler: 24/7 Google Ecosystem Multi-Parallel Recursive Web & DNS Crawler", () => {
  test("defines comprehensive targets for Google, DeepMind, AI Studio, Design, Cloud and Chromium", () => {
    expect(GOOGLE_CRAWL_TARGETS.length).toBeGreaterThanOrEqual(6);
    expect(GOOGLE_CRAWL_TARGETS.some((t) => t.name === "Google DeepMind")).toBe(
      true,
    );
    expect(GOOGLE_CRAWL_TARGETS.some((t) => t.name === "Google Design")).toBe(
      true,
    );
    expect(
      GOOGLE_CRAWL_TARGETS.some((t) => t.name === "Chromium & V8 Official"),
    ).toBe(true);
  });

  test("contains official November 2026 Google stack announcements", () => {
    expect(GOOGLE_NOVEMBER_2026_ANNOUNCEMENTS.length).toBeGreaterThanOrEqual(7);
    const compilerReleases =
      crawler.getNovember2026Announcements("compiler-runtime");
    expect(compilerReleases.length).toBeGreaterThan(0);
    expect(compilerReleases[0].title).toContain("TypeScript 7");
  });

  test("catalogs high-value YouTube, X, Discord, email, and portal channels", () => {
    expect(GOOGLE_ECOSYSTEM_CHANNELS.length).toBeGreaterThanOrEqual(15);
    const yt = GOOGLE_ECOSYSTEM_CHANNELS.filter(
      (c) => c.category === "youtube",
    );
    const mail = GOOGLE_ECOSYSTEM_CHANNELS.filter(
      (c) => c.category === "email",
    );
    expect(yt.length).toBeGreaterThan(0);
    expect(mail.length).toBeGreaterThan(0);
  });

  test("crawls target and measures duration with native Bun timer", async () => {
    const target = GOOGLE_CRAWL_TARGETS[0];
    const res = await crawler.crawlTarget(target);
    expect(res.status).toBe("SYNCED");
    expect(res.statusCode).toBe(200);
    expect(res.durationMs).toBeGreaterThan(0);
    expect(res.endpointsFound).toBeGreaterThan(0);
  });

  test("runs full 24/7 cycle across all targets", async () => {
    const cycle = await crawler.runFullCycle();
    expect(cycle.length).toBe(GOOGLE_CRAWL_TARGETS.length);
    expect(cycle.every((c) => c.statusCode === 200)).toBe(true);
  });

  test("executes multi-parallel recursive BFS crawl across Obscura, Chromium, Brave, Servo, agent-browser, Crawlee & Scrapy drivers", async () => {
    const summary = await crawler.runParallelRecursiveCrawl(
      GOOGLE_CRAWL_TARGETS.slice(0, 3),
      {
        maxDepth: 2,
        concurrency: 4,
        enableBraveShields: true,
        enableServoStylo: true,
      },
    );
    expect(summary.totalNodesVisited).toBeGreaterThan(15);
    expect(summary.maxDepthReached).toBe(2);
    expect(summary.totalTrackersBlocked).toBeGreaterThan(0);
    expect(summary.totalStyloMatches).toBeGreaterThan(100);
    expect(summary.driversUsed).toContain("obscura-cdp");
    expect(summary.driversUsed).toContain("vercel-agent-browser");
    expect(summary.driversUsed).toContain("crawlee-pipeline");
    expect(summary.driversUsed).toContain("scrapy-spider");
  });
});
