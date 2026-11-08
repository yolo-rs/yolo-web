// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  APHRODY_FLAGSHIP_APPS,
  autonomousConvergenceAgent,
  humanizerEngine,
  modernWebEngine,
} from "../src/index.ts";

describe("@google-bun/modern-web-humanizer: Lighthouse 100/100, Modern Web Guidelines & Zero AI Slop", () => {
  test("detects and strips banned AI slop vocabulary while preserving technical prose", () => {
    const slopSample =
      "Moreover, this revolutionary game-changing hyper-scale platform delves into a tapestry of cutting-edge features.";
    const before = humanizerEngine.auditText(slopSample);
    expect(before.score).toBeLessThan(50);
    expect(before.violations.length).toBeGreaterThanOrEqual(5);

    const cleaned = humanizerEngine.humanize(slopSample);
    const after = humanizerEngine.auditText(cleaned);
    expect(after.score).toBe(100);
    expect(after.violations.length).toBe(0);
  });

  test("converges all 7 flagship apps (aphrody-yolo, google-bun, gcloud-learn, shenron, rosegriffon, wii-os, auto) to 100/100 across all 5 metrics", () => {
    expect(APHRODY_FLAGSHIP_APPS.length).toBe(7);
    const results = autonomousConvergenceAgent.convergeAllAppsTo100();
    expect(results.length).toBe(7);

    for (const item of results) {
      expect(item.beforeAudit.passedAll100).toBe(false);
      expect(item.afterAudit.passedAll100).toBe(true);
      expect(item.afterAudit.scores.performance).toBe(100);
      expect(item.afterAudit.scores.accessibility).toBe(100);
      expect(item.afterAudit.scores.bestPractices).toBe(100);
      expect(item.afterAudit.scores.seo).toBe(100);
      expect(item.afterAudit.humanizerScore).toBe(100);
      expect(item.iterationsRequired).toBe(1);
    }
  });

  test("auto-fixes arbitrary HTML into a 100/100 Lighthouse & Humanizer document", () => {
    const fixedHtml = modernWebEngine.autoFixAndHumanizeHtml(
      "<html><head></head><body><h1>YOLO Web Sovereign Portal</h1><div>Hello World</div></body></html>",
      {
        appId: "yolo-web",
        title: "YOLO Web Sovereign Portal — Chromium 144 & Obscura Engine",
        description:
          "Chromium 144, Obscura CDP, Servo Euclid, and Brave Shields orchestration portal built on Upstream Bun v1.4.4+.",
        canonicalUrl: "https://web.aphrody.com/",
        lang: "en",
      },
    );
    const audit = modernWebEngine.auditHtml("yolo-web", fixedHtml);
    expect(audit.issues).toEqual([]);
    expect(audit.slopViolations).toEqual([]);
    expect(audit.scores).toEqual({
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    });
    expect(audit.humanizerScore).toBe(100);
    expect(audit.passedAll100).toBe(true);
  });
});
