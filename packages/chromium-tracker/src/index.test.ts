import { describe, expect, it } from "bun:test";
import { ChromiumTrackingEngine, compareDottedVersions } from "./index";

describe("@yolo-web/chromium-tracker - 2026 Chromium & Google Upstream Monitoring", () => {
  const tracker = new ChromiumTrackingEngine();

  it("orders complete dotted versions numerically", () => {
    expect(compareDottedVersions("120.0.1.9", "120.0.1.10")).toBeLessThan(0);
    expect(compareDottedVersions("120.0.1", "120.0.1.0")).toBe(0);
    expect(compareDottedVersions("121.0.0.0", "120.99.99.99")).toBeGreaterThan(
      0,
    );
    expect(() => compareDottedVersions("120.bad.1", "120.1.1")).toThrow();
  });

  it("fetches active Chrome for Testing channels (Stable, Beta, Dev, Canary)", async () => {
    const channels = await tracker.fetchChromiumChannels();
    expect(channels).toBeDefined();
    expect(channels.Stable).toBeDefined();
    expect(channels.Canary).toBeDefined();
    expect(channels.Stable.milestone).toBeGreaterThanOrEqual(140);
    expect(typeof channels.Stable.version).toBe("string");
    expect(typeof channels.Canary.version).toBe("string");
  });

  it("fetches detailed commit hashes from ChromiumDash", async () => {
    const details = await tracker.fetchChannelDetails("Stable");
    expect(details.channel).toBe("Stable");
    expect(details.milestone).toBeGreaterThanOrEqual(140);
    expect(details.hashes).toBeDefined();
    expect(details.hashes?.v8).toBeDefined();
    expect(details.hashes?.chromium).toBeDefined();
  });

  it("fetches latest CEF (Chromium Embedded Framework) release metadata", async () => {
    const cef = await tracker.fetchLatestCef("windows64");
    expect(cef.cefVersion).toBeDefined();
    expect(cef.chromiumVersion).toBeDefined();
    expect(cef.channel).toBe("stable");
    expect(cef.downloadUrl).toContain("cef_binary");
  });

  it("inspects Google depot_tools repository latest commit", async () => {
    const status = await tracker.fetchDepotToolsStatus();
    expect(status.latestCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(status.author).toMatch(/^.+ <[^<>\s@]+@[^<>\s@]+>$/);
    expect(status.repoUrl).toBe(
      "https://chromium.googlesource.com/chromium/tools/depot_tools.git",
    );
  });

  it("tracks downstream Chromium releases for Brave and Helium", async () => {
    const downstreams = await tracker.fetchDownstreamReleases();
    expect(downstreams.brave.project).toBe("Brave");
    expect(downstreams.brave.targetChromiumVersion).toBeDefined();
    expect(downstreams.helium.project).toBe("Helium");
    expect(downstreams.helium.repoUrl).toContain("imputnet/helium");
  });

  it("manages and audits YOLO-Web Chromium patches", () => {
    const patches = tracker.getPatchProposals();
    expect(patches.length).toBeGreaterThanOrEqual(5);
    const blinkPatch = patches.find((p) => p.id === "yolo-webdriver-mask");
    expect(blinkPatch).toBeDefined();
    expect(blinkPatch?.status).toBe("proposal");
    expect(blinkPatch?.patchStrategy).toBe("chromium_src_override");
  });

  it("generates a complete upstream status report", async () => {
    const report = await tracker.generateStatusReport();
    expect(report.timestamp).toBeDefined();
    expect(report.channels).toBeDefined();
    expect(report.patches.length).toBeGreaterThanOrEqual(5);
  });
});
