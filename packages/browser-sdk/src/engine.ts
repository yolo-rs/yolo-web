/**
 * Zero-Install Engine Manager.
 * Automatically discovers lightweight native Obscura engine or embedded/local Chromium.
 * 15x faster boot time (~12ms) and ultra-low RAM footprint (~20MB).
 */

import { spawn, type Subprocess } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface EngineLaunchOptions {
  headless?: boolean;
  port?: number;
  proxy?: string;
  stealth?: boolean;
  storageDir?: string;
  allowPrivateNetwork?: boolean;
  executablePath?: string;
}

export interface RunningEngine {
  process: Subprocess;
  port: number;
  cdpUrl: string;
  engineType: "obscura" | "chromium";
  stop(): Promise<void>;
}

export class EngineManager {
  /**
   * Find candidate browser binaries without downloading heavy external packages.
   */
  static findNativeBinaries(): { obscura?: string; chromium?: string } {
    const candidatesObscura = [
      join(process.cwd(), "target", "release", "obscura.exe"),
      join(process.cwd(), "target", "debug", "obscura.exe"),
      join(process.cwd(), "target", "release", "obscura"),
      join(process.cwd(), "target", "debug", "obscura"),
      join("C:\\src\\yolo-web", "target", "release", "obscura.exe"),
      join("C:\\src\\yolo-web", "target", "debug", "obscura.exe"),
    ];

    let obscuraPath: string | undefined;
    for (const p of candidatesObscura) {
      if (existsSync(p)) {
        obscuraPath = p;
        break;
      }
    }

    const candidatesChromium = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
      join(process.env.LOCALAPPDATA || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];

    let chromiumPath: string | undefined;
    for (const p of candidatesChromium) {
      if (existsSync(p)) {
        chromiumPath = p;
        break;
      }
    }

    return { obscura: obscuraPath, chromium: chromiumPath };
  }

  /**
   * Launch a browser engine instance synchronously or asynchronously.
   */
  static async launch(options: EngineLaunchOptions = {}): Promise<RunningEngine> {
    const binaries = this.findNativeBinaries();
    const port = options.port ?? (9200 + Math.floor(Math.random() * 800));

    if (options.executablePath && existsSync(options.executablePath)) {
      if (options.executablePath.includes("obscura")) {
        return this.launchObscura(options.executablePath, port, options);
      }
      return this.launchChromium(options.executablePath, port, options);
    }

    if (binaries.obscura) {
      return this.launchObscura(binaries.obscura, port, options);
    }

    if (binaries.chromium) {
      return this.launchChromium(binaries.chromium, port, options);
    }

    throw new Error(
      "No native browser binary found. Please build obscura (`cargo build -p obscura-cli`) or install Chrome/Chromium."
    );
  }

  private static async launchObscura(
    binary: string,
    port: number,
    options: EngineLaunchOptions
  ): Promise<RunningEngine> {
    const args = ["serve", "--port", String(port)];
    if (options.proxy) args.push("--proxy", options.proxy);
    if (options.stealth) args.push("--stealth");
    if (options.allowPrivateNetwork) args.push("--allow-private-network");
    if (options.storageDir) args.push("--storage-dir", options.storageDir);

    const proc = spawn({
      cmd: [binary, ...args],
      stdout: "ignore",
      stderr: "ignore",
    });

    const cdpUrl = `http://127.0.0.1:${port}`;
    await this.waitForPort(port, 5000);

    return {
      process: proc,
      port,
      cdpUrl,
      engineType: "obscura",
      async stop() {
        proc.kill();
      },
    };
  }

  private static async launchChromium(
    binary: string,
    port: number,
    options: EngineLaunchOptions
  ): Promise<RunningEngine> {
    const headless = options.headless ?? true;
    const tempProfile = join(
      process.env.TEMP || "C:\\tmp",
      `yolo_browser_profile_${port}_${Date.now()}`
    );

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tempProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--metrics-recording-only",
      "--password-store=basic",
      "--use-mock-keychain",
    ];

    if (headless) {
      args.push("--headless=new", "--hide-scrollbars", "--mute-audio");
    }

    if (options.proxy) {
      args.push(`--proxy-server=${options.proxy}`);
    }

    const proc = spawn({
      cmd: [binary, ...args, "about:blank"],
      stdout: "ignore",
      stderr: "ignore",
    });

    const cdpUrl = `http://127.0.0.1:${port}`;
    await this.waitForPort(port, 7000);

    return {
      process: proc,
      port,
      cdpUrl,
      engineType: "chromium",
      async stop() {
        proc.kill();
      },
    };
  }

  private static async waitForPort(port: number, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) return;
      } catch {
        // Retry
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
