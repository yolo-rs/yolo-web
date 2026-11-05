#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * yolo-agent CLI. Subcommands:
 *   serve   launch (or attach to) Chromium, start the bridge (HTTP MCP + WS)
 *   mcp     same tool surface over MCP stdio (stderr carries logs)
 *   run     one-shot agent run with a streaming model (needs ANTHROPIC_API_KEY)
 *   launch  start Chromium with the extension preloaded and print the endpoint
 */
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileAuditSink } from "./audit-file.ts";
import { ExtensionBackend, startBridge } from "./bridge.ts";
import { Browser, CdpTargetBackend } from "./browser.ts";
import { WsCdpTransport } from "./cdp.ts";
import { EMBEDDED_EXTENSION } from "./embedded-extension.ts";
import {
  type LaunchedBrowser,
  defaultProfileDir,
  launchBrowser,
} from "./launcher.ts";
import { runAgent } from "./loop.ts";
import {
  CompositeBackend,
  DesktopProxy,
  McpHandler,
  SessionBackend,
  serveStdio,
  type ToolBackend,
} from "./mcp.ts";
import { AnthropicClient } from "./model.ts";
import { provisionExtension } from "./provision.ts";
import {
  type Autonomy,
  AuditLog,
  isLoopbackHost,
  resolveAutonomy,
} from "./safety.ts";
import { AgentSession } from "./tools.ts";

export interface Flags {
  _: string[];
  [key: string]: string | boolean | string[];
}

export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s, 2) as [
        string,
        string | undefined,
      ];
      if (inline !== undefined) flags[key] = inline;
      else if (
        argv[i + 1] !== undefined &&
        (RAW_VALUE_FLAGS.has(key) ||
          (!(argv[i + 1] as string).startsWith("--") &&
            !BOOLEAN_FLAGS.has(key)))
      )
        flags[key] = argv[++i] as string;
      else flags[key] = true;
    } else flags._.push(arg);
  }
  return flags;
}

/** Flags whose value is a list of switches and may itself start with "--". */
const RAW_VALUE_FLAGS = new Set(["browser-args"]);

const BOOLEAN_FLAGS = new Set([
  "headless",
  "launch",
  "nhitl",
  "no-sandbox",
  "print-token",
  "screenshot",
  "help",
  "allow-remote-cdp",
  "no-extension",
]);

const HELP = `yolo-agent <serve|mcp|run|launch> [options]

Browser:
  --launch                 start Chromium (default when --cdp is absent)
  --cdp <http://127.0.0.1:port>   attach to a running browser (loopback only)
  --chromium <path>        yolo-chromium launcher or any Chromium-family binary (or YOLO_CHROMIUM)
  --headless               no window
  --profile <dir>          profile directory (default ~/.yolo-web/agent-profile)
  --extension <dir>        unpacked extension (default: embedded or dist/extension)
  --no-extension           do not load the extension
  --url <url>              first page (default about:blank); chrome-extension:// pages
                           are navigated after the extension has loaded
  --browser-args "<args>"  extra browser switches, space separated
                           (e.g. "--ozone-platform=headless")

Agent:
  --driver cdp|extension   who executes tools (default cdp)
  --autonomy ask|auto|nhitl   approval policy (default ask)
  --nhitl                  explicit opt-in required for autonomy=nhitl
  --no-sandbox             pass --no-sandbox to the browser (needs --nhitl)
  --audit-log <file>       JSONL audit trail (default <profile>/audit.jsonl)

Bridge (serve):
  --port <n>               loopback port (default random)
  --token <t>              bearer token (default random)
  --desktop-cmd "<cmd>" --desktop-allow a,b   expose allowlisted yolo-desktop tools
  --print-token            print the bridge token on stderr

Run:
  yolo-agent run "<goal>" [--screenshot] [--max-turns 20]  (ANTHROPIC_API_KEY from env)
`;

const log = (message: string) => process.stderr.write(`${message}\n`);

async function resolveExtensionDir(
  flags: Flags,
  profileDir: string,
): Promise<string | undefined> {
  if (flags["no-extension"]) return undefined;
  if (typeof flags.extension === "string") return resolve(flags.extension);
  if (EMBEDDED_EXTENSION) {
    const dir = join(profileDir, "extension");
    for (const [name, b64] of Object.entries(EMBEDDED_EXTENSION)) {
      const path = join(dir, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(b64, "base64"));
    }
    return dir;
  }
  const dev = resolve(import.meta.dir, "..", "dist", "extension");
  if (await Bun.file(join(dev, "manifest.json")).exists()) return dev;
  log(
    "extension not built: run `bun run build:ext` in packages/yolo-agent (continuing without it)",
  );
  return undefined;
}

export interface Runtime {
  backend: ToolBackend;
  session: AgentSession;
  launched?: LaunchedBrowser;
  endpoint: string;
  profileDir: string;
  extensionDir?: string;
  autonomy: Autonomy;
  nhitl: boolean;
  extension?: ExtensionBackend;
  desktop?: DesktopProxy;
  close(): Promise<void>;
}

export async function setup(flags: Flags): Promise<Runtime> {
  const nhitl = flags.nhitl === true;
  const autonomy = resolveAutonomy(flags.autonomy as Autonomy | undefined, {
    nhitlOptIn: nhitl,
  });
  if (flags["no-sandbox"] === true && !nhitl)
    throw new Error("--no-sandbox requires the explicit --nhitl opt-in");
  const profileDir = resolve(
    typeof flags.profile === "string" ? flags.profile : defaultProfileDir(),
  );
  await mkdir(profileDir, { recursive: true });
  const extensionDir = await resolveExtensionDir(flags, profileDir);

  let launched: LaunchedBrowser | undefined;
  let endpoint: string;
  if (typeof flags.cdp === "string") {
    endpoint = flags.cdp;
    if (
      !isLoopbackHost(new URL(endpoint).hostname) &&
      flags["allow-remote-cdp"] !== true
    ) {
      throw new Error(
        "refusing non-loopback --cdp endpoint (pass --allow-remote-cdp to override)",
      );
    }
  } else {
    launched = await launchBrowser({
      executable:
        typeof flags.chromium === "string" ? flags.chromium : undefined,
      extensionDir,
      profileDir: join(profileDir, "browser"),
      headless: flags.headless === true,
      noSandbox: flags["no-sandbox"] === true,
      url: typeof flags.url === "string" ? flags.url : undefined,
      extraArgs:
        typeof flags["browser-args"] === "string"
          ? flags["browser-args"].split(/\s+/).filter(Boolean)
          : undefined,
      port:
        typeof flags["cdp-port"] === "string"
          ? Number(flags["cdp-port"])
          : undefined,
    });
    endpoint = launched.endpoint;
    log(
      `browser: ${launched.kind} ${launched.executable} on ${endpoint}${flags.headless ? " (headless)" : ""}`,
    );
  }

  const transport = await WsCdpTransport.connect(endpoint);
  const browser = new Browser(new CdpTargetBackend(transport));
  const auditPath =
    typeof flags["audit-log"] === "string"
      ? resolve(flags["audit-log"])
      : join(profileDir, "audit.jsonl");
  const session = new AgentSession({
    id: crypto.randomUUID(),
    browser,
    autonomy,
    audit: new AuditLog(fileAuditSink(auditPath)),
  });

  const extension =
    flags.driver === "extension" ? new ExtensionBackend() : undefined;
  let desktop: DesktopProxy | undefined;
  if (typeof flags["desktop-cmd"] === "string") {
    const allow =
      typeof flags["desktop-allow"] === "string"
        ? flags["desktop-allow"]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (allow.length === 0)
      throw new Error("--desktop-cmd needs a non-empty --desktop-allow list");
    desktop = new DesktopProxy(
      { command: (flags["desktop-cmd"] as string).split(/\s+/), allow },
      session,
    );
    await desktop.start();
  }
  const browserBackend: ToolBackend = extension ?? new SessionBackend(session);
  const backend = new CompositeBackend(browserBackend, desktop);
  return {
    backend,
    session,
    launched,
    endpoint,
    profileDir,
    extensionDir,
    autonomy,
    nhitl,
    extension,
    desktop,
    async close() {
      transport.close();
      desktop?.stop();
      await launched?.kill().catch(() => undefined);
    },
  };
}

async function serve(flags: Flags): Promise<void> {
  const rt = await setup(flags);
  const model = Bun.env.ANTHROPIC_API_KEY ? new AnthropicClient() : undefined;
  const bridge = startBridge({
    port: typeof flags.port === "string" ? Number(flags.port) : undefined,
    token: typeof flags.token === "string" ? flags.token : undefined,
    backend: rt.backend,
    session: rt.session,
    model,
    driver: rt.extension ? "extension" : "cdp",
    nhitlOptIn: rt.nhitl,
    extension: rt.extension,
  });
  const info = {
    url: bridge.url,
    token: bridge.token,
    desktopToken: rt.desktop ? bridge.desktopToken : undefined,
    pid: process.pid,
    endpoint: rt.endpoint,
  };
  const infoPath = join(rt.profileDir, "bridge.json");
  await writeFile(infoPath, JSON.stringify(info, null, 2));
  await chmod(infoPath, 0o600).catch(() => undefined);
  if (rt.extensionDir && rt.launched) {
    try {
      const target = await provisionExtension(rt.endpoint, {
        bridgeUrl: bridge.url,
        bridgeToken: bridge.token,
        nhitlOptIn: rt.nhitl,
        autonomy: rt.autonomy,
      });
      log(`extension ${target.extensionId} provisioned`);
    } catch (error) {
      log(
        `extension provisioning skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  log(
    `bridge: ${bridge.url} (driver=${rt.extension ? "extension" : "cdp"}, autonomy=${rt.autonomy}${rt.nhitl ? ", nhitl opt-in" : ""})`,
  );
  log(
    `credentials: ${infoPath}${flags["print-token"] ? `\ntoken: ${bridge.token}` : ""}`,
  );
  log(
    `MCP: POST ${bridge.url}/mcp with Authorization: Bearer <token>  |  stdio: yolo-agent mcp`,
  );
  if (rt.autonomy === "nhitl")
    log(
      "WARNING: no-human-in-the-loop mode is active for this session. Every action is written to the audit log.",
    );
  process.on("SIGINT", async () => {
    await bridge.stop();
    await rt.close();
    process.exit(0);
  });
  await rt.launched?.exited;
  await bridge.stop();
}

async function mcp(flags: Flags): Promise<void> {
  const rt = await setup(flags);
  log(`mcp stdio ready (autonomy=${rt.autonomy}); browser on ${rt.endpoint}`);
  await serveStdio(new McpHandler(rt.backend));
  await rt.close();
}

async function run(flags: Flags): Promise<void> {
  const goal = flags._[1];
  if (!goal) throw new Error('usage: yolo-agent run "<goal>"');
  const rt = await setup(flags);
  try {
    const result = await runAgent(goal, {
      model: new AnthropicClient(),
      session: rt.session,
      screenshot: flags.screenshot === true,
      maxTurns:
        typeof flags["max-turns"] === "string"
          ? Number(flags["max-turns"])
          : 20,
      onText: (t) => process.stderr.write(t),
      onStep: (s) =>
        log(
          `\n[step] ${s.tool} exec=${s.execMs}ms${s.isError ? " ERROR" : ""}`,
        ),
    });
    console.log(
      result.finalText ||
        `(${result.stopped}${result.error ? `: ${result.error}` : ""})`,
    );
    if (typeof flags.receipt === "string")
      await Bun.write(
        flags.receipt,
        JSON.stringify(
          {
            steps: result.steps,
            turns: result.turnReceipts,
            totalMs: result.totalMs,
          },
          null,
          2,
        ),
      );
  } finally {
    await rt.close();
  }
}

async function launchOnly(flags: Flags): Promise<void> {
  const profileDir = resolve(
    typeof flags.profile === "string" ? flags.profile : defaultProfileDir(),
  );
  const extensionDir = await resolveExtensionDir(flags, profileDir);
  const launched = await launchBrowser({
    executable: typeof flags.chromium === "string" ? flags.chromium : undefined,
    extensionDir,
    profileDir: join(profileDir, "browser"),
    headless: flags.headless === true,
    noSandbox: flags["no-sandbox"] === true && flags.nhitl === true,
  });
  console.log(
    JSON.stringify({
      kind: launched.kind,
      endpoint: launched.endpoint,
      executable: launched.executable,
      extensionDir,
    }),
  );
  await launched.exited;
}

async function main(): Promise<void> {
  const flags = parseFlags(Bun.argv.slice(2));
  const command = flags._[0];
  try {
    if (!command || flags.help) console.log(HELP);
    else if (command === "serve") await serve(flags);
    else if (command === "mcp") await mcp(flags);
    else if (command === "run") await run(flags);
    else if (command === "launch") await launchOnly(flags);
    else {
      console.error(`unknown command: ${command}\n${HELP}`);
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) void main();
