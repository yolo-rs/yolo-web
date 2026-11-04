/** Browser/version manager registry and safe command planner. */
export type EngineManagerEntry = {
  id: string;
  name: string;
  family: "chromium" | "gecko" | "webkit" | "servo";
  channel: string;
  kind: "binary" | "source";
  repo?: string;
  branch?: string;
  packages?: Partial<Record<"winget" | "apt" | "pacman" | "flatpak" | "docker", { id: string; trust: "official" | "community"; note?: string }>>;
  docs: string[];
};

export const ENGINE_MANAGER_REGISTRY: EngineManagerEntry[] = [
  { id: "chrome-stable", name: "Google Chrome", family: "chromium", channel: "stable", kind: "binary", packages: { winget: { id: "Google.Chrome", trust: "community", note: "Microsoft winget community manifest; vendor installer." } }, docs: ["https://www.google.com/chrome/", "https://github.com/microsoft/winget-pkgs/tree/master/manifests/g/Google/Chrome"] },
  { id: "chrome-canary", name: "Google Chrome Canary", family: "chromium", channel: "canary", kind: "binary", packages: { winget: { id: "Google.Chrome.Canary", trust: "community", note: "Microsoft winget community manifest; vendor installer." } }, docs: ["https://www.chromium.org/getting-involved/download-chromium/", "https://github.com/microsoft/winget-pkgs/tree/master/manifests/g/Google/Chrome/Canary"] },
  { id: "edge-canary", name: "Microsoft Edge Canary", family: "chromium", channel: "canary", kind: "binary", packages: { winget: { id: "Microsoft.Edge.Canary", trust: "community", note: "Microsoft winget community manifest; vendor installer." } }, docs: ["https://www.microsoft.com/edge/download/insider", "https://learn.microsoft.com/en-us/deployedge/microsoft-edge-channels", "https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Microsoft/Edge/Canary"] },
  { id: "firefox-nightly-source", name: "Firefox Nightly / mozilla-central", family: "gecko", channel: "nightly", kind: "source", repo: "https://github.com/mozilla-firefox/firefox.git", branch: "main", docs: ["https://firefox-source-docs.mozilla.org/setup/linux_build.html", "https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html", "https://firefox-source-docs.mozilla.org/js/build.html", "https://www.mozilla.org/firefox/channel/desktop/"] },
  { id: "webkit-jsc", name: "WebKit / JavaScriptCore", family: "webkit", channel: "main", kind: "source", repo: "https://github.com/WebKit/WebKit.git", branch: "main", docs: ["https://docs.webkit.org/", "https://docs.webkit.org/Build%20&%20Debug/BuildOptions.html", "https://trac.webkit.org/wiki/JSCOnly"] },
  { id: "servo", name: "Servo", family: "servo", channel: "main", kind: "source", repo: "https://github.com/servo/servo.git", branch: "main", docs: ["https://book.servo.org/building/building.html", "https://book.servo.org/building/linux.html", "https://book.servo.org/embedding/overview.html"] },
  { id: "chromium-src", name: "Chromium source (depot_tools)", family: "chromium", channel: "main", kind: "source", repo: "https://chromium.googlesource.com/chromium/tools/depot_tools.git", branch: "main", docs: ["https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md", "https://chromium.googlesource.com/chromium/tools/depot_tools/", "https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/"] },
];

type EngineProbe = { executables?: string[]; rootEnv?: string; rootMarkers?: string[] };
const ENGINE_PROBES: Record<string, EngineProbe> = {
  "chrome-stable": { executables: ["google-chrome", "google-chrome-stable", "chrome", "chrome.exe"] },
  "chrome-canary": { executables: ["google-chrome-unstable", "chrome-canary", "chrome-canary.exe"] },
  "edge-canary": { executables: ["microsoft-edge-canary", "msedge-canary", "msedge-canary.exe"] },
  "firefox-nightly-source": { executables: ["firefox-nightly", "firefox-nightly.exe"], rootEnv: "FIREFOX_ROOT", rootMarkers: ["mach"] },
  "webkit-jsc": { executables: ["jsc", "jsc.exe"], rootEnv: "WEBKIT_ROOT", rootMarkers: ["Tools/Scripts/build-jsc"] },
  servo: { executables: ["servoshell", "servoshell.exe"], rootEnv: "SERVO_ROOT", rootMarkers: ["Cargo.toml"] },
  "chromium-src": { rootEnv: "CHROMIUM_ROOT", rootMarkers: [".gclient", "src/DEPS"] },
};

export type LocalEngineStatus = {
  availability: "found_on_path" | "source_checkout" | "not_detected";
  executable?: string;
  version?: string;
  sourceRoot?: string;
  detail: string;
};

async function executableVersion(executable: string): Promise<string | undefined> {
  // Bun.spawn cannot launch Windows batch wrappers without a shell. Ignore those
  // for version probing; an actual native executable can still be found next.
  if (process.platform === "win32" && /\.(?:bat|cmd)$/i.test(executable)) return undefined;
  try {
    const child = Bun.spawn([executable, "--version"], {
      stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000, windowsHide: true,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    if (exitCode !== 0) return undefined;
    return `${stdout}\n${stderr}`.trim().split(/\r?\n/, 1)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Inspect only PATH and explicitly configured source roots; never guess machine paths. */
export async function inspectEngine(entry: EngineManagerEntry): Promise<LocalEngineStatus> {
  const probe = ENGINE_PROBES[entry.id] ?? {};
  for (const name of probe.executables ?? []) {
    const executable = Bun.which(name);
    if (!executable) continue;
    const version = await executableVersion(executable);
    return {
      availability: "found_on_path",
      executable,
      ...(version ? { version } : {}),
      detail: version ? "Executable found on PATH; version queried." : "Executable found on PATH; version probe unavailable.",
    };
  }

  const sourceRoot = probe.rootEnv ? process.env[probe.rootEnv] : undefined;
  if (sourceRoot && probe.rootMarkers?.length) {
    const root = sourceRoot.replace(/[\\/]$/, "");
    const markersPresent = await Promise.all(probe.rootMarkers.map((marker) => Bun.file(`${root}/${marker}`).exists()));
    if (markersPresent.every(Boolean)) {
      return { availability: "source_checkout", sourceRoot, detail: `Source workspace detected from ${probe.rootEnv}.` };
    }
    return { availability: "not_detected", sourceRoot, detail: `${probe.rootEnv} is set, but expected source markers are missing.` };
  }

  return { availability: "not_detected", detail: "No matching executable on PATH or configured source root." };
}

export type PackageManager = "winget" | "apt" | "pacman" | "flatpak" | "docker";
export type CommandInvocation = { program: string; args: string[] };

/** Return executable arguments separately so callers never need a shell parser. */
export function packageCommandInvocations(entry: EngineManagerEntry, manager: PackageManager, action: "install" | "update"): CommandInvocation[] | null {
  const pkg = entry.packages?.[manager];
  if (!pkg) return null;
  if (manager === "winget") return [{ program: "winget", args: [action === "install" ? "install" : "upgrade", "--id", pkg.id, "--exact"] }];
  if (manager === "apt") return action === "install"
    ? [{ program: "sudo", args: ["apt", "install", pkg.id] }]
    : [{ program: "sudo", args: ["apt", "update"] }, { program: "sudo", args: ["apt", "install", "--only-upgrade", pkg.id] }];
  if (manager === "pacman") return [{ program: "sudo", args: action === "install" ? ["pacman", "-S", pkg.id] : ["pacman", "-Syu", pkg.id] }];
  if (manager === "flatpak") return [{ program: "flatpak", args: action === "install" ? ["install", "flathub", pkg.id] : ["update", pkg.id] }];
  return [{ program: "docker", args: ["pull", pkg.id] }];
}

export function packageCommand(entry: EngineManagerEntry, manager: PackageManager, action: "install" | "update"): string | null {
  const pkg = entry.packages?.[manager];
  if (!pkg) return null;
  if (manager === "winget") return action === "install" ? `winget install --id ${pkg.id} --exact` : `winget upgrade --id ${pkg.id} --exact`;
  if (manager === "apt") return action === "install" ? `sudo apt install ${pkg.id}` : `sudo apt update && sudo apt install --only-upgrade ${pkg.id}`;
  if (manager === "pacman") return action === "install" ? `sudo pacman -S ${pkg.id}` : `sudo pacman -Syu ${pkg.id}`;
  if (manager === "flatpak") return action === "install" ? `flatpak install flathub ${pkg.id}` : `flatpak update ${pkg.id}`;
  return action === "install" ? `docker pull ${pkg.id}` : `docker pull ${pkg.id}`;
}

export function findEngine(id: string): EngineManagerEntry {
  const entry = ENGINE_MANAGER_REGISTRY.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown engine '${id}'. Run 'web engines list'.`);
  return entry;
}

export function sourceCheckoutCommand(entry: EngineManagerEntry, destination: string): string {
  if (entry.kind !== "source" || !entry.repo) throw new Error(`${entry.id} is not a source checkout.`);
  if (entry.id === "chromium-src") throw new Error("Chromium source requires depot_tools fetch/gclient; use the documented workflow instead of git clone.");
  return `git clone${entry.branch ? ` --branch ${entry.branch} --single-branch` : ""} ${entry.repo} ${destination}`;
}

export async function fetchChromeForTestingChannels() {
  const response = await fetch("https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json");
  if (!response.ok) throw new Error(`Chrome for Testing metadata request failed: ${response.status}`);
  const data = await response.json() as { channels?: Record<string, { version?: string; revision?: string; downloads?: Record<string, Array<{ platform: string; url: string }>> }> };
  return Object.entries(data.channels ?? {}).map(([channel, info]) => ({ channel, version: info.version, revision: info.revision, downloads: info.downloads }));
}

export function enginePackageCommand(entry: EngineManagerEntry, manager: PackageManager, action: "install" | "update"): string | null {
  return packageCommand(entry, manager, action);
}
