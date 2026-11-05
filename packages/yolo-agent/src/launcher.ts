// SPDX-License-Identifier: Apache-2.0
/**
 * Launches a Chromium-family browser with the YOLO extension preloaded, a
 * dedicated profile, and the DevTools port bound to loopback. Prefers
 * yolo-chromium (CEF shell); falls back to a system Chrome/Chromium/Edge
 * for development and CI. The fallback is not the shipped engine.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { WsCdpTransport } from "./cdp.ts";
import { Browser, CdpTargetBackend } from "./browser.ts";

export type BrowserKind = "yolo-chromium" | "chromium-family";

export interface LaunchOptions {
  /** Path to yolo-chromium launcher or any Chromium-family binary. */
  executable?: string;
  extensionDir?: string;
  profileDir?: string;
  headless?: boolean;
  /** Fixed DevTools port; a free port is chosen when omitted. */
  port?: number;
  url?: string;
  /** Disables the Chromium sandbox. Only for the owner's own dev setup with the explicit nhitl opt-in. */
  noSandbox?: boolean;
  extraArgs?: string[];
  readyTimeoutMs?: number;
}

export interface LaunchedBrowser {
  kind: BrowserKind;
  executable: string;
  port: number;
  endpoint: string;
  profileDir: string;
  args: string[];
  kill(): Promise<void>;
  exited: Promise<number>;
}

export function candidateExecutables(
  env: Record<string, string | undefined> = Bun.env,
  platform: string = process.platform,
): string[] {
  const list: string[] = [];
  if (env.YOLO_CHROMIUM) list.push(env.YOLO_CHROMIUM);
  if (env.CHROME_PATH) list.push(env.CHROME_PATH);
  if (platform === "win32") {
    const roots = [
      env["ProgramFiles"],
      env["ProgramFiles(x86)"],
      env.LOCALAPPDATA,
    ].filter(Boolean) as string[];
    for (const root of roots) {
      list.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
      list.push(join(root, "Chromium", "Application", "chrome.exe"));
      list.push(join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
  } else if (platform === "darwin") {
    list.push(
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
  } else {
    list.push(
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/opt/google/chrome/chrome",
    );
  }
  return list;
}

export function findExecutable(explicit?: string): string {
  const found = (explicit ? [explicit] : candidateExecutables()).find((p) =>
    existsSync(p),
  );
  if (!found)
    throw new Error(
      "no Chromium executable found: pass --chromium, or set YOLO_CHROMIUM / CHROME_PATH",
    );
  return found;
}

export function kindOf(executable: string): BrowserKind {
  return basename(executable).toLowerCase().startsWith("yolo-chromium")
    ? "yolo-chromium"
    : "chromium-family";
}

/** Builds the argument list; pure so it can be unit tested. */
export function buildArgs(
  kind: BrowserKind,
  opts: Required<Pick<LaunchOptions, "port" | "profileDir">> & LaunchOptions,
): string[] {
  const args: string[] = [];
  if (kind === "yolo-chromium") {
    args.push(
      `--cache-path=${opts.profileDir}`,
      `--remote-debugging-port=${opts.port}`,
    );
    if (opts.extensionDir)
      args.push(
        `--load-extension=${opts.extensionDir}`,
        `--disable-extensions-except=${opts.extensionDir}`,
      );
    if (opts.headless) args.push("--headless");
    if (opts.noSandbox) args.push("--no-sandbox");
    args.push(`--url=${opts.url ?? "about:blank"}`);
  } else {
    args.push(
      `--user-data-dir=${opts.profileDir}`,
      `--remote-debugging-port=${opts.port}`,
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
    );
    if (opts.extensionDir) {
      // Branded Chrome 137+ ignores --load-extension unless this feature is disabled.
      args.push(
        `--load-extension=${opts.extensionDir}`,
        `--disable-extensions-except=${opts.extensionDir}`,
        "--disable-features=DisableLoadExtensionCommandLineSwitch",
      );
    }
    if (opts.headless) args.push("--headless=new");
    if (opts.noSandbox) args.push("--no-sandbox");
    args.push(opts.url ?? "about:blank");
  }
  args.push(...(opts.extraArgs ?? []));
  return args;
}

async function freePort(): Promise<number> {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(""),
  });
  const port = server.port as number;
  await server.stop(true);
  return port;
}

export async function launchBrowser(
  options: LaunchOptions = {},
): Promise<LaunchedBrowser> {
  const executable = findExecutable(options.executable);
  const kind = kindOf(executable);
  const port = options.port ?? (await freePort());
  const profileDir =
    options.profileDir ?? join(tmpdir(), `yolo-agent-profile-${port}`);
  await mkdir(profileDir, { recursive: true });
  const args = buildArgs(kind, { ...options, port, profileDir });
  // YOLO_AGENT_BROWSER_LOG=<file> keeps the browser's output for diagnosis.
  const logPath = Bun.env.YOLO_AGENT_BROWSER_LOG;
  const sink = logPath ? Bun.file(logPath) : "ignore";
  const proc = Bun.spawn([executable, ...args], {
    stdout: sink,
    stderr: sink,
    stdin: "ignore",
  });
  const endpoint = `http://127.0.0.1:${port}`;

  const deadline = Date.now() + (options.readyTimeoutMs ?? 30_000);
  let ready = false;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null)
      throw new Error(`browser exited early with code ${proc.exitCode}`);
    try {
      const res = await fetch(`${endpoint}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!ready) {
    proc.kill();
    throw new Error(`DevTools endpoint did not come up on ${endpoint}`);
  }
  return {
    kind,
    executable,
    port,
    endpoint,
    profileDir,
    args,
    exited: proc.exited,
    async kill() {
      proc.kill();
      await proc.exited;
    },
  };
}

/** Connects the agent core to a running browser's DevTools endpoint. */
export async function connectBrowser(
  endpoint: string,
): Promise<{ browser: Browser; transport: WsCdpTransport }> {
  const transport = await WsCdpTransport.connect(endpoint);
  const browser = new Browser(new CdpTargetBackend(transport));
  return { browser, transport };
}

export function defaultProfileDir(): string {
  return join(homedir(), ".yolo-web", "agent-profile");
}
