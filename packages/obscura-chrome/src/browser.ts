/**
 * Starts a `--headless` yolo-chromium (CEF windowless rendering) with a
 * DevTools port, or describes an already running endpoint.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface LaunchOptions {
  /** yolo-chromium launcher or runtime host executable. */
  exe: string;
  port: number;
  /** Profile directory; a fresh one under the temp directory by default. */
  profileDir?: string;
  /** `--webui-patch-dir` forwarded to the shell. */
  patchDir?: string;
  windowSize?: string;
  /**
   * `headless` (default): Chromium headless mode with the Chrome runtime
   * style; every WebUI host loads. `windowless`: CEF off-screen rendering,
   * which forces the Alloy style, and Alloy style blocks Chrome-UI hosts such
   * as chrome://settings, chrome://extensions, and chrome://flags.
   */
  mode?: "headless" | "windowless";
  /** Extra switches forwarded unchanged. */
  extraArgs?: string[];
  /** File receiving the browser's stdout and stderr. */
  logFile?: string;
  startupTimeoutMs?: number;
}

export interface RunningBrowser {
  endpoint: string;
  version: BrowserVersion;
  stop(): Promise<void>;
}

export interface BrowserVersion {
  Browser: string;
  "Protocol-Version"?: string;
  "User-Agent"?: string;
  "V8-Version"?: string;
  webSocketDebuggerUrl: string;
}

/** Default executable: `$YOLO_CHROMIUM_EXE`, else the cargo debug launcher. */
export function defaultExecutable(): string | undefined {
  const fromEnv = Bun.env.YOLO_CHROMIUM_EXE?.trim();
  if (fromEnv) return fromEnv;
  const exe =
    process.platform === "win32" ? "yolo-chromium.exe" : "yolo-chromium";
  const targetDir =
    Bun.env.CARGO_TARGET_DIR?.trim() ||
    join(import.meta.dir, "..", "..", "..", "target");
  for (const profile of ["debug", "release"]) {
    const candidate = join(targetDir, profile, exe);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export async function fetchVersion(
  endpoint: string,
  timeoutMs = 2_000,
): Promise<BrowserVersion> {
  const base = endpoint.replace(/\/+$/, "");
  const response = await fetch(`${base}/json/version`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(`${base}/json/version returned HTTP ${response.status}`);
  return (await response.json()) as BrowserVersion;
}

/** `Chrome/156.0.8078.80` -> `156.0.8078.80`. */
export function chromiumVersion(
  version: Pick<BrowserVersion, "Browser">,
): string {
  return /([0-9]+(?:\.[0-9]+){1,3})/.exec(version.Browser)?.[1] ?? "unknown";
}

export async function launchHeadless(
  options: LaunchOptions,
): Promise<RunningBrowser> {
  const profileDir =
    options.profileDir ??
    join(tmpdir(), "obscura-chrome", `profile-${process.pid}-${Date.now()}`);
  mkdirSync(profileDir, { recursive: true });
  const args = [
    options.exe,
    options.mode === "windowless" ? "--windowless" : "--headless",
    `--remote-debugging-port=${options.port}`,
    "--remote-allow-origins=*",
    "--url=about:blank",
    `--cache-path=${profileDir}`,
    `--window-size=${options.windowSize ?? "1280x800"}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(options.patchDir ? [`--webui-patch-dir=${options.patchDir}`] : []),
    ...(options.extraArgs ?? []),
  ];
  const child = Bun.spawn(args, {
    stdout: options.logFile ? Bun.file(`${options.logFile}.out`) : "ignore",
    stderr: options.logFile ? Bun.file(options.logFile) : "ignore",
    stdin: "ignore",
  });
  const endpoint = `http://127.0.0.1:${options.port}`;
  const deadline = Date.now() + (options.startupTimeoutMs ?? 30_000);
  let version: BrowserVersion | undefined;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      version = await fetchVersion(endpoint, 1_000);
      break;
    } catch {
      await Bun.sleep(250);
    }
  }
  const stop = async () => {
    if (child.exitCode !== null) return;
    if (version) {
      // Graceful first: Browser.close lets Chromium flush the profile and
      // end its sub-processes before the launcher exits.
      await closeOverCdp(version.webSocketDebuggerUrl);
      await Promise.race([child.exited, Bun.sleep(8_000)]);
      if (child.exitCode !== null) return;
    }
    if (process.platform === "win32") {
      // The launcher spawns the CEF host, which spawns Chromium's
      // sub-processes; end the whole tree.
      const kill = Bun.spawn(
        ["taskkill", "/T", "/F", "/PID", String(child.pid)],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      await kill.exited;
    } else {
      child.kill("SIGTERM");
    }
    await Promise.race([child.exited, Bun.sleep(5_000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  };
  if (!version) {
    await stop();
    throw new Error(
      `yolo-chromium did not expose DevTools on ${endpoint} (exit code ${child.exitCode ?? "none"})` +
        (options.logFile ? `; see ${options.logFile}` : ""),
    );
  }
  return { endpoint, version, stop };
}

/** Sends Browser.close on the browser endpoint; errors are ignored. */
async function closeOverCdp(webSocketDebuggerUrl: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, 3_000);
    let socket: WebSocket | undefined;
    function done() {
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // already closed
      }
      resolve();
    }
    try {
      socket = new WebSocket(webSocketDebuggerUrl);
      socket.addEventListener("open", () =>
        socket?.send(JSON.stringify({ id: 1, method: "Browser.close" })),
      );
      socket.addEventListener("message", done);
      socket.addEventListener("close", done);
      socket.addEventListener("error", done);
    } catch {
      done();
    }
  });
}
