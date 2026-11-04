import { describe, expect, it } from "bun:test";
import { ChromiumTrackingEngine } from "./index";

describe("@yolo-web/chromium-tracker - 2026 Chromium & Google Upstream Monitoring", () => {
  const tracker = new ChromiumTrackingEngine();

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
    expect(status.author).toContain("@google.com");
    expect(status.repoUrl).toBe("https://chromium.googlesource.com/chromium/tools/depot_tools.git");
  });

  it("tracks downstream Chromium releases for Brave and Helium", async () => {
    const downstreams = await tracker.fetchDownstreamReleases();
    expect(downstreams.brave.project).toBe("Brave");
    expect(downstreams.brave.targetChromiumVersion).toBeDefined();
    expect(downstreams.helium.project).toBe("Helium");
    expect(downstreams.helium.repoUrl).toContain("imputnet/helium");
  });

  it("manages and audits YOLO-Web Chromium patches", () => {
    const patches = tracker.getManagedPatches();
    expect(patches.length).toBeGreaterThanOrEqual(5);
    const blinkPatch = patches.find((p) => p.id === "yolo-webdriver-mask");
    expect(blinkPatch).toBeDefined();
    expect(blinkPatch?.applied).toBe(true);
    expect(blinkPatch?.patchStrategy).toBe("chromium_src_override");
  });

  it("generates a complete upstream status report", async () => {
    const report = await tracker.generateStatusReport();
    expect(report.timestamp).toBeDefined();
    expect(report.channels).toBeDefined();
    expect(report.patches.length).toBeGreaterThanOrEqual(5);
  });
});
