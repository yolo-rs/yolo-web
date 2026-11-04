/**
 * @yolo-web/chromium-tracker
 *
 * 2026 Chromium & Google Upstream Automated Tracking, Forking & Patching Pipeline
 * Monitors Google Chromium, Depot Tools, CEF, cef-rs, Brave, and Helium browser stacks.
 */

export interface ChromiumChannelRelease {
  channel: "Stable" | "Beta" | "Dev" | "Canary";
  version: string;
  revision: string | number;
  milestone: number;
  hashes?: {
    chromium?: string;
    v8?: string;
    skia?: string;
    dawn?: string;
    angle?: string;
    webrtc?: string;
    devtools?: string;
    pdfium?: string;
  };
  time?: number;
}

export interface CefReleaseInfo {
  cefVersion: string;
  chromiumVersion: string;
  channel: string;
  sandboxCompat?: string;
  downloadUrl?: string;
}

export type CefPlatform =
  | "windows32"
  | "windows64"
  | "windowsarm64"
  | "linux32"
  | "linux64"
  | "linuxarm"
  | "linuxarm64"
  | "macosx64"
  | "macosarm64";

/** Map the active OS/CPU pair to the CEF distribution's published platform IDs. */
export function detectCefPlatform(
  os = process.platform,
  arch = process.arch,
): CefPlatform {
  const platforms: Partial<
    Record<
      typeof process.platform,
      Partial<Record<typeof process.arch, CefPlatform>>
    >
  > = {
    win32: { ia32: "windows32", x64: "windows64", arm64: "windowsarm64" },
    linux: {
      ia32: "linux32",
      x64: "linux64",
      arm: "linuxarm",
      arm64: "linuxarm64",
    },
    darwin: { x64: "macosx64", arm64: "macosarm64" },
  };
  const platform = platforms[os]?.[arch];
  if (!platform)
    throw new Error(
      `CEF does not publish a supported build for ${os}/${arch}.`,
    );
  return platform;
}

/** One published archive within a Spotify CEF index entry. */
export interface CefIndexFile {
  /** `standard`, `minimal`, `client`, `signed`, `tools`, `debug_symbols` or `release_symbols`. */
  type: string;
  name: string;
  sha1: string;
  size?: number;
  last_modified?: string;
}

/** One CEF build within the Spotify CEF index (`index.json`). */
export interface CefIndexVersion {
  cef_version: string;
  chromium_version: string;
  channel: string;
  sandbox_compat?: string;
  files?: CefIndexFile[];
}

/** Spotify CEF index keyed by distribution platform ID; entries are not sorted. */
export type CefIndex = Partial<
  Record<CefPlatform, { versions: CefIndexVersion[] }>
>;

export interface DownstreamBrowserRelease {
  project: "Brave" | "Helium";
  tag: string;
  title: string;
  targetChromiumVersion: string;
  repoUrl: string;
  publishedAt?: string;
}

export interface DepotToolsStatus {
  latestCommit: string;
  author: string;
  message: string;
  repoUrl: string;
}

export interface ChromiumPatchSpec {
  id: string;
  targetSubsystem: "v8" | "content" | "net" | "chrome" | "blink" | "cdp";
  name: string;
  description: string;
  upstreamFile: string;
  patchStrategy:
    | "chromium_src_override"
    | "cxx_subclass"
    | "preprocessor_hook"
    | "deno_v8_binding";
  status: "proposal" | "applied";
}

/** Compare dotted numeric versions without lexicographic ordering. */
export function compareDottedVersions(left: string, right: string): number {
  const parse = (version: string) => {
    if (!/^\d+(?:\.\d+)*$/.test(version))
      throw new Error(`Invalid dotted version: ${version}`);
    return version.split(".").map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export class ChromiumTrackingEngine {
  private static CFT_URL =
    "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json";
  private static CHROMIUM_DASH_URL =
    "https://chromiumdash.appspot.com/fetch_releases";
  private static CEF_INDEX_URL = "https://cef-builds.spotifycdn.com/index.json";
  private static DEPOT_TOOLS_LOG_URL =
    "https://chromium.googlesource.com/chromium/tools/depot_tools/+log?format=JSON&n=1";

  /**
   * Fetches real-time Chromium release channels (Stable, Beta, Dev, Canary)
   */
  async fetchChromiumChannels(): Promise<
    Record<string, ChromiumChannelRelease>
  > {
    const res = await fetch(ChromiumTrackingEngine.CFT_URL);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch Chrome for Testing channels: ${res.statusText}`,
      );
    }
    const data = (await res.json()) as {
      channels: Record<
        string,
        { channel: string; version: string; revision: string }
      >;
    };

    if (!data?.channels || typeof data.channels !== "object") {
      throw new Error(
        "Invalid Chrome for Testing response: missing channels map",
      );
    }

    const results: Record<string, ChromiumChannelRelease> = {};
    for (const [key, ch] of Object.entries(data.channels)) {
      if (!["Stable", "Beta", "Dev", "Canary"].includes(key)) continue;
      if (
        !ch ||
        typeof ch.version !== "string" ||
        !/^\d+(?:\.\d+){3}$/.test(ch.version) ||
        typeof ch.revision !== "string"
      ) {
        throw new Error(`Invalid Chrome for Testing release entry: ${key}`);
      }
      const milestone = Number(ch.version.split(".")[0]);
      results[key] = {
        channel: key as ChromiumChannelRelease["channel"],
        version: ch.version,
        revision: ch.revision,
        milestone,
      };
    }
    return results;
  }

  /**
   * Fetches detailed component commit hashes (v8, skia, angle, dawn, webrtc) from ChromiumDash with timeout
   */
  async fetchChannelDetails(
    channel: "Stable" | "Canary" = "Stable",
    timeoutMs = 2500,
  ): Promise<ChromiumChannelRelease> {
    const url = `${ChromiumTrackingEngine.CHROMIUM_DASH_URL}?channel=${channel}&platform=Windows&num=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch ChromiumDash details for ${channel}: ${res.statusText}`,
        );
      }
      const list = (await res.json()) as Array<{
        channel: string;
        version: string;
        milestone: number;
        chromium_main_branch_position: number;
        hashes: ChromiumChannelRelease["hashes"];
        time: number;
      }>;

      if (!list || list.length === 0) {
        throw new Error(`No releases found for channel ${channel}`);
      }

      const item = list[0];
      if (
        !item ||
        typeof item.version !== "string" ||
        !/^\d+(?:\.\d+){3}$/.test(item.version) ||
        typeof item.milestone !== "number" ||
        typeof item.chromium_main_branch_position !== "number"
      ) {
        throw new Error(`Invalid ChromiumDash release entry for ${channel}`);
      }
      return {
        channel,
        version: item.version,
        milestone: item.milestone,
        revision: item.chromium_main_branch_position,
        hashes: item.hashes,
        time: item.time,
      };
    } catch (error) {
      clearTimeout(timer);
      throw new Error(`Unable to fetch ChromiumDash details for ${channel}`, {
        cause: error,
      });
    }
  }

  /**
   * Fetches the complete Spotify CEF index (every platform and published build)
   */
  async fetchCefIndex(): Promise<CefIndex> {
    const res = await fetch(ChromiumTrackingEngine.CEF_INDEX_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch CEF index: ${res.statusText}`);
    }
    const index = (await res.json()) as CefIndex;
    if (!index || typeof index !== "object" || Array.isArray(index)) {
      throw new Error("Invalid CEF index response: expected a platform map");
    }
    return index;
  }

  /**
   * Fetches latest CEF (Chromium Embedded Framework) release metadata
   */
  async fetchLatestCef(
    platform: CefPlatform = detectCefPlatform(),
  ): Promise<CefReleaseInfo> {
    const index = await this.fetchCefIndex();

    const plat = index[platform];
    if (!plat || !plat.versions || plat.versions.length === 0) {
      throw new Error(`No CEF versions found for platform ${platform}`);
    }

    const latest = [...plat.versions].sort((a, b) =>
      compareDottedVersions(b.chromium_version, a.chromium_version),
    )[0];
    if (!latest)
      throw new Error(`No valid CEF release found for platform ${platform}`);

    return {
      cefVersion: latest.cef_version,
      chromiumVersion: latest.chromium_version,
      channel: latest.channel,
      sandboxCompat: latest.sandbox_compat,
      downloadUrl: `https://cef-builds.spotifycdn.com/cef_binary_${latest.cef_version}_${platform}_minimal.tar.bz2`,
    };
  }

  /**
   * Inspects Google depot_tools repository latest git commit
   */
  async fetchDepotToolsStatus(): Promise<DepotToolsStatus> {
    const res = await fetch(ChromiumTrackingEngine.DEPOT_TOOLS_LOG_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch depot_tools log: ${res.statusText}`);
    }
    const raw = await res.text();
    // Google Gitiles prefixes JSON with )]}'
    const clean = raw.startsWith(")]}'") ? raw.slice(4).trim() : raw.trim();
    const data = JSON.parse(clean) as {
      log: Array<{
        commit: string;
        author: { name: string; email: string };
        message: string;
      }>;
    };

    if (!data.log || data.log.length === 0) {
      throw new Error("No commits returned from depot_tools log");
    }

    const latest = data.log[0];
    if (!latest) throw new Error("No commits returned from depot_tools log");
    return {
      latestCommit: latest.commit,
      author: `${latest.author.name} <${latest.author.email}>`,
      message: latest.message.split("\n", 1)[0] ?? latest.message,
      repoUrl:
        "https://chromium.googlesource.com/chromium/tools/depot_tools.git",
    };
  }

  /**
   * Tracks downstream Chromium browser forks (Brave, Helium)
   */
  async fetchDownstreamReleases(): Promise<{
    brave: DownstreamBrowserRelease;
    helium: DownstreamBrowserRelease;
  }> {
    const [braveRes, heliumRes] = await Promise.all([
      fetch(
        "https://api.github.com/repos/brave/brave-browser/releases/latest",
        {
          headers: { "User-Agent": "YOLO-Web/0.3.0 ChromiumTracker" },
        },
      ),
      fetch("https://api.github.com/repos/imputnet/helium/releases/latest", {
        headers: { "User-Agent": "YOLO-Web/0.3.0 ChromiumTracker" },
      }),
    ]);

    let brave: DownstreamBrowserRelease = {
      project: "Brave",
      tag: "unknown",
      title: "Brave release metadata unavailable",
      targetChromiumVersion: "unknown",
      repoUrl: "https://github.com/brave/brave-browser",
    };

    if (braveRes.ok) {
      const data = (await braveRes.json()) as {
        tag_name: string;
        name: string;
        published_at?: string;
      };
      const match = data.name.match(/Chromium\s+([0-9.]+)/i);
      brave = {
        project: "Brave",
        tag: data.tag_name,
        title: data.name,
        targetChromiumVersion: match?.[1] ?? "unknown",
        repoUrl: "https://github.com/brave/brave-browser",
        publishedAt: data.published_at,
      };
    }

    let helium: DownstreamBrowserRelease = {
      project: "Helium",
      tag: "unknown",
      title: "Helium release metadata unavailable",
      targetChromiumVersion: "unknown",
      repoUrl: "https://github.com/imputnet/helium",
    };

    if (heliumRes.ok) {
      const data = (await heliumRes.json()) as {
        tag_name: string;
        name: string;
        published_at?: string;
      };
      helium = {
        project: "Helium",
        tag: data.tag_name,
        title: data.name || `Helium ${data.tag_name}`,
        targetChromiumVersion: "unknown",
        repoUrl: "https://github.com/imputnet/helium",
        publishedAt: data.published_at,
      };
    }

    return { brave, helium };
  }

  /**
   * Standard YOLO-Web 2026 Chromium Patches for Stealth, V8 and Performance
   */
  getPatchProposals(): ChromiumPatchSpec[] {
    return [
      {
        id: "yolo-webdriver-mask",
        targetSubsystem: "blink",
        name: "Navigator.webdriver Hardware Mask",
        description:
          "Enforces undefined for navigator.webdriver on standard execution contexts without breaking automation controls",
        upstreamFile: "third_party/blink/renderer/core/frame/navigator.cc",
        patchStrategy: "chromium_src_override",
        status: "proposal",
      },
      {
        id: "yolo-client-hints-align",
        targetSubsystem: "chrome",
        name: "Chromium 157+ Desktop Client Hints Alignment",
        description:
          "Harmonizes sec-ch-ua brand array and sec-ch-ua-platform with native host Windows 11 / Linux",
        upstreamFile: "chrome/browser/profiles/profile.h",
        patchStrategy: "cxx_subclass",
        status: "proposal",
      },
      {
        id: "yolo-v8-isolate-zero-leak",
        targetSubsystem: "v8",
        name: "V8 Isolate Context Separation & Zero Host Leakage",
        description:
          "Enforces strict isolation between Bun JSC host environment and guest V8 contexts",
        upstreamFile: "crates/obscura-js/src/lib.rs",
        patchStrategy: "deno_v8_binding",
        status: "proposal",
      },
      {
        id: "yolo-brave-shields-intercept",
        targetSubsystem: "net",
        name: "Brave AdBlock & CookieCrumbler Native Hook",
        description:
          "Hooks URL request stream to filter trackers with adblock-rust and strip cosmetic cookie banners",
        upstreamFile: "crates/brave-adblock/src/lib.rs",
        patchStrategy: "preprocessor_hook",
        status: "proposal",
      },
      {
        id: "yolo-servo-stylo-geometry",
        targetSubsystem: "content",
        name: "Servo Stylo CSS & Euclid Geometry Accelerator",
        description:
          "Provides parallel CSS selector matching and sub-pixel DOM bounds calculation",
        upstreamFile: "crates/servo-engine/src/lib.rs",
        patchStrategy: "cxx_subclass",
        status: "proposal",
      },
    ];
  }

  /**
   * Generates a complete 2026 Upstream Chromium Matrix Report
   */
  async generateStatusReport() {
    const [
      channels,
      canaryDetails,
      stableDetails,
      cef,
      depotTools,
      downstreams,
    ] = await Promise.all([
      this.fetchChromiumChannels(),
      this.fetchChannelDetails("Canary").catch(() => null),
      this.fetchChannelDetails("Stable").catch(() => null),
      this.fetchLatestCef().catch(() => null),
      this.fetchDepotToolsStatus().catch(() => null),
      this.fetchDownstreamReleases().catch(() => null),
    ]);

    const patches = this.getPatchProposals();

    return {
      timestamp: new Date().toISOString(),
      channels,
      stableDetails,
      canaryDetails,
      cef,
      depotTools,
      downstreams,
      patches,
    };
  }
}

// CEF lock receipt (`engines/cef.lock.json`) parsing and validation.
export * from "./cef-lock";
