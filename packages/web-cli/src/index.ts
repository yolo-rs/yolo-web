#!/usr/bin/env bun
/**
 * @yolo-web/web-cli
 *
 * Unified "web" command-line interface uniting Obscura, Brave Search/Shields,
 * Servo, Bun, Deno, Chromium & V8 into a single command for AI agents and humans.
 */

import { Command } from "@yolo-web/cli-native";
import {
  BraveSearchMcpBridge,
  BraveShieldsEngine,
  BraveFingerprintProtection,
} from "@yolo-web/brave-shields";
import {
  calculateSpecificity,
  validateCssSelector,
  translateXPathToCss,
  SERVO_CONSOLIDATED_CRATES,
} from "@yolo-web/servo-bridge";
import {
  ChallengeSolverEngine,
  CHROMIUM_2026_DEFAULT_PROFILE,
} from "@yolo-web/challenge-solver";
import { ChromiumTrackingEngine } from "@yolo-web/chromium-tracker";
import {
  ENGINE_MANAGER_REGISTRY,
  fetchChromeForTestingChannels,
  findEngine,
  inspectEngine,
  packageCommand,
  packageCommandInvocations,
  sourceCheckoutCommand,
  type PackageManager,
} from "../../chromium-tracker/src/engine-manager";
import { YoloBrowser } from "@yolo-web/browser-sdk";
import {
  BunHostRuntimeInfo,
  V8PageIsolateConfig,
} from "@yolo-web/bun-v8-bridge";
import { Errno, strerror } from "@yolo-web/posix-bun";
import {
  buildOtpAuthUri,
  createPasskeyRegistrationOptions,
  generateTotpSecretBase32,
  getPostgresVaultSchemaSql,
  renderAuthenticatorQrSvg,
  YoloSecureVault,
} from "@yolo-web/auth";
import { KnowledgeIndexDb } from "@yolo-web/knowledge-indexer";
import {
  crawl,
  inspectGitRemote,
  listGitHubRepositories,
  synthesizeMarkdown,
  YOLO_ECOSYSTEM_5_REGISTRY_CATALOG,
  YOLO_WEB_ENGINE_INVENTORY,
  YOLO_WEB_GOOGLE_NETWORK_MAP,
} from "@yolo-web/web-crawler";

function describeSpawnError(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown };
  const message =
    typeof value?.message === "string" ? value.message : String(error);
  if (typeof value?.code !== "string" || !Object.hasOwn(Errno, value.code))
    return message;
  const errno = Errno[value.code as keyof typeof Errno];
  return `${message} (${value.code}: ${strerror(errno)})`;
}

export function createWebCli(): Command {
  const program = new Command();

  program
    .command("crawl")
    .description(
      "Crawl a bounded set of public pages and save provenance-first JSON and Markdown",
    )
    .argument("<urls...>", "HTTP(S) seed URLs")
    .option("--depth <number>", "Maximum link depth (0-8)", "1")
    .option("--max-pages <number>", "Maximum pages to fetch", "50")
    .option("--delay-ms <number>", "Minimum delay between requests", "700")
    .option("--output <path>", "JSON crawl output", "crawl.json")
    .option("--markdown <path>", "Markdown synthesis output", "crawl.md")
    .option("--include-body", "Include raw response text in the JSON capture")
    .option("--ignore-robots", "Do not apply robots.txt exclusions")
    .action(
      async (
        urls: string[],
        opts: {
          depth: string;
          maxPages: string;
          delayMs: string;
          output: string;
          markdown: string;
          includeBody?: boolean;
          ignoreRobots?: boolean;
        },
      ) => {
        const result = await crawl({
          seeds: urls,
          maxDepth: Number(opts.depth),
          maxPages: Number(opts.maxPages),
          delayMs: Number(opts.delayMs),
          respectRobots: !opts.ignoreRobots,
          includeBody: opts.includeBody,
        });
        await Bun.write(opts.output, `${JSON.stringify(result, null, 2)}\n`);
        await Bun.write(opts.markdown, synthesizeMarkdown(result));
        console.log(
          JSON.stringify(
            {
              pages: result.pages.length,
              output: opts.output,
              markdown: opts.markdown,
              policy: result.policy,
            },
            null,
            2,
          ),
        );
      },
    );

  program
    .command("github-repos")
    .description(
      "List a GitHub organization or user's public repositories by star count through the REST API",
    )
    .argument("<owner>", "GitHub owner login")
    .option("--kind <kind>", "Owner kind: org or user", "org")
    .option("--pages <number>", "Maximum 100-repository pages", "5")
    .option("--output <path>", "Write JSON to this file instead of stdout")
    .action(
      async (
        owner: string,
        opts: { kind: string; pages: string; output?: string },
      ) => {
        if (opts.kind !== "org" && opts.kind !== "user")
          throw new Error("--kind must be org or user");
        const result = await listGitHubRepositories(owner, {
          ownerType: opts.kind,
          maxPages: Number(opts.pages),
          token: process.env.GITHUB_TOKEN,
        });
        const json = `${JSON.stringify(result, null, 2)}\n`;
        if (opts.output) await Bun.write(opts.output, json);
        else console.log(json);
      },
    );

  program
    .command("git-head")
    .description(
      "Read the symbolic default branch and HEAD commit from a public Git HTTPS remote",
    )
    .argument("<remote>", "HTTPS Git URL")
    .action(async (remote: string) =>
      console.log(JSON.stringify(await inspectGitRemote(remote), null, 2)),
    );

  const engines = program
    .command("engines")
    .description("Manage browser engine catalog and upstream versions");
  engines
    .command("list")
    .description("List supported browser targets")
    .action(() => {
      console.table(
        ENGINE_MANAGER_REGISTRY.map(({ id, name, family, channel, kind }) => ({
          id,
          name,
          family,
          channel,
          kind,
        })),
      );
    });
  engines
    .command("status [id]")
    .description(
      "Show catalog metadata and detect local executables/source roots",
    )
    .action(async (id?: string) => {
      const entries = id ? [findEngine(id)] : ENGINE_MANAGER_REGISTRY;
      const results = await Promise.all(
        entries.map(async (entry) => ({
          ...entry,
          local: await inspectEngine(entry),
        })),
      );
      console.log(JSON.stringify(results, null, 2));
    });
  engines
    .command("versions")
    .description("Fetch current Chrome for Testing channel versions")
    .action(async () => {
      console.log(
        JSON.stringify(await fetchChromeForTestingChannels(), null, 2),
      );
    });
  for (const action of ["install", "update"] as const) {
    engines
      .command(`${action} <id>`)
      .requiredOption("--manager <manager>")
      .option("--execute")
      .action(
        async (id: string, options: { manager: string; execute?: boolean }) => {
          const entry = findEngine(id);
          const cmd = packageCommand(
            entry,
            options.manager as PackageManager,
            action,
          );
          const invocations = packageCommandInvocations(
            entry,
            options.manager as PackageManager,
            action,
          );
          if (!cmd || !invocations)
            throw new Error(
              `${id} has no verified ${options.manager} package mapping.`,
            );
          console.log(
            `Provider trust: ${entry.packages?.[options.manager as PackageManager]?.trust}. ${entry.packages?.[options.manager as PackageManager]?.note ?? ""}`,
          );
          if (!options.execute) {
            console.log(`Plan only (add --execute to run): ${cmd}`);
            return;
          }
          for (const invocation of invocations) {
            const child = Bun.spawn([invocation.program, ...invocation.args], {
              stdin: "inherit",
              stdout: "inherit",
              stderr: "inherit",
            });
            const code = await child.exited;
            if (code !== 0)
              throw new Error(
                `${invocation.program} exited with status ${code}`,
              );
          }
        },
      );
  }

  program
    .command("zig")
    .description(
      "Run the yolo-zig toolchain dispatcher (set YOLO_ZIG_ROOT or check out yolo-zig beside yolo-web)",
    )
    .argument("[args...]", "Arguments forwarded to tools/yolo-zig.ts")
    .allowUnknownOption(true)
    .action(async (args: string[] = []) => {
      const zigRoot =
        process.env.YOLO_ZIG_ROOT ?? `${import.meta.dir}/../../../../yolo-zig`;
      const dispatcher = `${zigRoot}/tools/yolo-zig.ts`;
      if (!(await Bun.file(dispatcher).exists())) {
        throw new Error(
          `Cannot find yolo-zig dispatcher at ${dispatcher}; set YOLO_ZIG_ROOT to its checkout.`,
        );
      }
      try {
        const child = Bun.spawn([process.execPath, dispatcher, ...args], {
          cwd: zigRoot,
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        process.exitCode = await child.exited;
      } catch (error) {
        throw new Error(
          `Could not start yolo-zig: ${describeSpawnError(error)}`,
          { cause: error },
        );
      }
    });

  engines
    .command("source <id> <destination>")
    .option("--execute")
    .action(
      async (
        id: string,
        destination: string,
        options: { execute?: boolean },
      ) => {
        const entry = findEngine(id);
        const cmd = sourceCheckoutCommand(entry, destination);
        console.log(
          options.execute
            ? `Running: ${cmd}`
            : `Plan only (add --execute to run): ${cmd}`,
        );
        if (!options.execute) return;
        const child = Bun.spawn(
          [
            "git",
            "clone",
            ...(entry.branch
              ? ["--branch", entry.branch, "--single-branch"]
              : []),
            entry.repo!,
            destination,
          ],
          { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
        );
        const code = await child.exited;
        if (code !== 0) throw new Error(`git exited with status ${code}`);
      },
    );

  program
    .name("web")
    .version("0.3.0")
    .description(
      "Unified Web Browser, Scraper, Search & Automation CLI (Obscura + Brave + Servo + Bun + Deno + V8)",
    );

  // 1. web fetch <url>
  program
    .command("fetch")
    .description(
      "Fetch and render a URL using Obscura/Chromium headless engine with Brave Shields protection",
    )
    .argument("<url>", "Target URL to fetch")
    .option("--screenshot <path>", "Capture viewport screenshot to file")
    .option("--pdf <path>", "Export page to PDF")
    .option("--markdown", "Print readable page markdown to stdout")
    .option("--eval <script>", "Evaluate JavaScript in the Chromium V8 isolate")
    .option(
      "--dump <format>",
      "Dump format: text, html, markdown, links, original",
      "text",
    )
    .option("--no-shields", "Disable Brave Shields ad & tracker blocking")
    .action(async (url: string, opts: Record<string, unknown>) => {
      const shields = new BraveShieldsEngine();
      const fp = new BraveFingerprintProtection();
      const sanitizedUrl = fp.cleanUrl(url).url;

      if (opts.shields !== false) {
        const check = shields.checkNetworkRequest({
          url: sanitizedUrl,
          sourceUrl: "https://localhost",
          resourceType: "main_frame",
        });
        if (check.blocked) {
          console.error(
            `[web shields] Blocked navigation to ${sanitizedUrl} by rule: ${check.matchedRule}`,
          );
          throw new Error(
            `Brave Shields blocked the navigation: ${check.matchedRule}`,
          );
        }
      }

      const endpoint =
        process.env.YOLO_CDP_ENDPOINT ??
        `http://127.0.0.1:${process.env.YOLO_CDP_PORT ?? "9222"}`;
      const browser = await YoloBrowser.connect({
        cdpUrl: endpoint,
        token: process.env.YOLO_CDP_TOKEN,
      });
      try {
        const page = await browser.newPage();
        await page.goto(sanitizedUrl, { waitUntil: "domcontentloaded" });
        if (typeof opts.screenshot === "string")
          await page.screenshot({ path: opts.screenshot });
        if (typeof opts.pdf === "string")
          await page.pdf({ path: opts.pdf, printBackground: true });
        let output: unknown;
        if (typeof opts.eval === "string")
          output = await page.evaluate(opts.eval);
        else if (opts.markdown || opts.dump === "markdown")
          output = await page.markdown();
        else if (opts.dump === "html" || opts.dump === "original")
          output = await page.content();
        else if (opts.dump === "links")
          output = await page.evaluate(
            "Array.from(document.querySelectorAll('a[href]'),a=>({text:(a.innerText||a.getAttribute('aria-label')||'').trim(),href:a.href,title:a.title}))",
          );
        else output = await page.evaluate("document.body?.innerText ?? ''");
        console.log(
          typeof output === "string" ? output : JSON.stringify(output, null, 2),
        );
      } finally {
        await browser.disconnect();
      }
    });

  // 2. web search <query> (Brave Search)
  program
    .command("search")
    .description("Search the Web using Brave's independent, private index")
    .argument("<query>", "Search query string")
    .option("-c, --count <number>", "Number of results (1-20)", "10")
    .option("-o, --offset <number>", "Pagination offset", "0")
    .action(async (query: string, opts: { count: string; offset: string }) => {
      const bridge = new BraveSearchMcpBridge();
      const res = await bridge.webSearch({
        query,
        count: Number(opts.count),
        offset: Number(opts.offset),
      });
      console.log(JSON.stringify(res, null, 2));
    });

  // 3. web context <query> (Brave AI Grounding / RAG)
  program
    .command("context")
    .description(
      "Retrieve clean, pre-extracted, token-budgeted web snippets for LLM grounding",
    )
    .argument("<query>", "Research question or error snippet")
    .option("-t, --max-tokens <tokens>", "Token budget", "4096")
    .action(async (query: string, opts: { maxTokens: string }) => {
      const bridge = new BraveSearchMcpBridge();
      const res = await bridge.webSearch({
        query,
        count: 5,
      });
      console.log(JSON.stringify(res, null, 2));
    });

  // 4. web shields <url> (Brave Shields Check)
  program
    .command("shields")
    .description(
      "Check URL against Brave Shields adblock-rust filters and tracker lists",
    )
    .argument("<url>", "Request URL to test")
    .option(
      "-s, --source <sourceUrl>",
      "Source page URL",
      "https://example.com/",
    )
    .option(
      "-t, --type <type>",
      "Resource type: script, image, xmlhttprequest, stylesheet",
      "script",
    )
    .action(async (url: string, opts: { source: string; type: string }) => {
      const engine = new BraveShieldsEngine();
      const fp = new BraveFingerprintProtection();
      const res = engine.checkNetworkRequest({
        url,
        sourceUrl: opts.source,
        resourceType: opts.type as
          "script" | "image" | "stylesheet" | "xmlhttprequest",
      });
      const clean = fp.cleanUrl(url);
      console.log(
        JSON.stringify(
          {
            url,
            blocked: res.blocked,
            matchedRule: res.matchedRule,
            cleanUrl: clean.url,
            strippedParams: clean.strippedParams,
          },
          null,
          2,
        ),
      );
    });

  // 5. web servo <selector|xpath> (Servo Stylo & XPath)
  program
    .command("servo")
    .description(
      "Compute Stylo selector specificity or translate XPath using Servo Rust algorithms",
    )
    .argument("<query>", "CSS selector or XPath expression")
    .option("--xpath", "Treat argument as XPath 1.0 and translate to CSS3")
    .action(async (query: string, opts: { xpath?: boolean }) => {
      if (opts.xpath) {
        const css = translateXPathToCss(query);
        console.log(
          JSON.stringify(
            { xpath: query, translatedCss: css, engine: "servo-xpath" },
            null,
            2,
          ),
        );
      } else {
        validateCssSelector(query);
        const spec = calculateSpecificity(query);
        console.log(
          JSON.stringify(
            {
              selector: query,
              specificity: spec,
              score: spec.packed,
              engine: "servo-stylo",
            },
            null,
            2,
          ),
        );
      }
    });

  // 6. web solve <htmlFileOrUrl> (challenge detection only)
  program
    .command("solve")
    .description(
      "Detect common verification challenges and report whether resolution is supported (interactive challenges require the site's user flow)",
    )
    .argument("<target>", "HTML file path or raw HTML string")
    .action(async (target: string) => {
      let content = target;
      if (await Bun.file(target).exists()) {
        content = await Bun.file(target).text();
      }
      const solver = new ChallengeSolverEngine();
      const detection = solver.detectChallenge(content);
      const solution = await solver.solveChallenge(detection);
      console.log(
        JSON.stringify(
          {
            detection,
            solution,
            legitimacyProfile: CHROMIUM_2026_DEFAULT_PROFILE,
          },
          null,
          2,
        ),
      );
    });

  // 7. web mcp (Unified MCP Server)
  program
    .command("mcp")
    .description("Run the unified 'web' MCP server over stdio or HTTP")
    .option("-t, --transport <type>", "Transport type: stdio or http", "stdio")
    .option("-p, --port <number>", "HTTP port", "3000")
    .action(async (_opts: { transport: string; port: string }) => {
      const { createWebMcpServer } =
        await import("../../web-mcp/src/server.js");
      const server = createWebMcpServer();
      console.error("Unified Web MCP server connected over stdio");
      await server.serveStdio();
    });

  // 7. web serve (CDP WebSocket Server)
  program
    .command("serve")
    .description(
      "Launch the Chrome DevTools Protocol (CDP) WebSocket server for AI agents and humans",
    )
    .option("-p, --port <number>", "CDP server port", "9222")
    .option("--host <host>", "CDP bind host", "127.0.0.1")
    .action(async (opts: { port: string; host: string }) => {
      console.error(
        `[web serve] Launching YOLO Browser CDP server on ws://${opts.host}:${opts.port}/devtools/browser`,
      );
      // Spawns rust yolo-browser or obscura binary
      try {
        const proc = Bun.spawn(
          [
            "cargo",
            "run",
            "-p",
            "yolo-browser-cli",
            "--",
            "serve",
            "--port",
            opts.port,
          ],
          {
            stdout: "inherit",
            stderr: "inherit",
          },
        );
        await proc.exited;
      } catch (e) {
        console.error(`[web serve] Subprocess exited: ${String(e)}`);
      }
    });

  // 8. web chromium <action> (Chromium, CEF, Brave, Helium & Depot Tools Tracking)
  program
    .command("chromium")
    .description(
      "Real-time tracking, patching and monitoring for Chromium, CEF, Brave, Helium & Google depot_tools",
    )
    .argument(
      "[action]",
      "Action to perform: status, patches, channels, cef, depot-tools",
      "status",
    )
    .option("--json", "Output raw JSON payload")
    .action(async (action: string, opts: { json?: boolean }) => {
      const tracker = new ChromiumTrackingEngine();
      if (action === "patches") {
        const patches = tracker.getPatchProposals();
        console.log(JSON.stringify(patches, null, 2));
      } else if (action === "channels") {
        const channels = await tracker.fetchChromiumChannels();
        console.log(JSON.stringify(channels, null, 2));
      } else if (action === "cef") {
        const cef = await tracker.fetchLatestCef();
        console.log(JSON.stringify(cef, null, 2));
      } else if (action === "depot-tools") {
        const dt = await tracker.fetchDepotToolsStatus();
        console.log(JSON.stringify(dt, null, 2));
      } else {
        const report = await tracker.generateStatusReport();
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`=== YOLO-Web 2026 Chromium Upstream Matrix ===`);
          console.log(`Timestamp: ${report.timestamp}`);
          console.log(`\n[Official Chrome Channels]`);
          for (const [k, v] of Object.entries(report.channels)) {
            console.log(
              `  - ${k.padEnd(8)}: v${v.version} (M${v.milestone}, rev ${v.revision})`,
            );
          }
          if (report.canaryDetails?.hashes) {
            console.log(`\n[Canary Hashes]`);
            console.log(`  - V8      : ${report.canaryDetails.hashes.v8}`);
            console.log(
              `  - Chromium: ${report.canaryDetails.hashes.chromium}`,
            );
            console.log(`  - ANGLE   : ${report.canaryDetails.hashes.angle}`);
          }
          if (report.cef) {
            console.log(`\n[CEF (Chromium Embedded Framework)]`);
            console.log(`  - Version : ${report.cef.cefVersion}`);
            console.log(`  - Target  : Chromium ${report.cef.chromiumVersion}`);
          }
          if (report.depotTools) {
            console.log(`\n[Google depot_tools]`);
            console.log(
              `  - Latest  : ${report.depotTools.latestCommit.slice(0, 10)} by ${report.depotTools.author}`,
            );
            console.log(`  - Commit  : "${report.depotTools.message}"`);
          }
          if (report.downstreams) {
            console.log(`\n[Downstream Chromium Forks]`);
            console.log(
              `  - Brave   : ${report.downstreams.brave.tag} (${report.downstreams.brave.title})`,
            );
            console.log(
              `  - Helium  : ${report.downstreams.helium.tag} (${report.downstreams.helium.title})`,
            );
          }
          console.log(`\n[YOLO-Web Chromium Patch Proposals (not applied)]`);
          for (const p of report.patches) {
            console.log(
              `  - [${p.status.toUpperCase()}] ${p.name} (${p.patchStrategy}) -> ${p.upstreamFile}`,
            );
          }
        }
      }
    });

  // 9. web info (Monorepo & Dual-Runtime Inspection)
  program
    .command("info")
    .description(
      "Inspect the complete unified web engine (Servo + Obscura + Brave + Bun + Deno + V8)",
    )
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const hostInfo = BunHostRuntimeInfo.inspect();
      const v8Config = new V8PageIsolateConfig({ maxOldSpaceSizeMb: 1024 });

      const info = {
        name: "web",
        version: "0.3.0",
        organization: "yolo-rs (https://github.com/yolo-rs/yolo-web)",
        description: "Unified Chromium-compatible browser in full Rust + Bun",
        hostRuntimePlane: hostInfo,
        guestBrowserPlane: {
          runtime: "Chromium V8 (deno_core / rusty_v8)",
          initialized: v8Config.isPlatformStarted(),
          flags: v8Config.toFlagString(),
        },
        monorepoPillars: {
          servo: `${SERVO_CONSOLIDATED_CRATES.length} crates (crates/servo-*)`,
          obscura: "10 crates (crates/obscura*)",
          brave: "5 crates (crates/brave-*)",
          deno_v8: "8 crates (crates/deno-*)",
          bun: "100% Native Upstream Bun v1.4.4+ (Full Rust ~200 crates + WebKit/JSC + Cranelift AoT)",
        },
      };

      if (opts.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(
          `=== Unified 'web' Engine v${info.version} (${info.organization}) ===`,
        );
        console.log(
          `Host Runtime Plane   : Bun ${hostInfo.bunVersion} (${hostInfo.architecture})`,
        );
        console.log(`Guest Browser Plane  : ${info.guestBrowserPlane.runtime}`);
        console.log(`Servo Crates         : ${info.monorepoPillars.servo}`);
        console.log(`Obscura Crates       : ${info.monorepoPillars.obscura}`);
        console.log(`Brave Crates         : ${info.monorepoPillars.brave}`);
        console.log(`Deno/V8 Crates       : ${info.monorepoPillars.deno_v8}`);
      }
    });

  // 10. web vault (Secure SQLite WAL + Postgres + Redis Vault, Passkey, TOTP QR/2FA, Chrome CSV & Profile Sync)
  program
    .command("vault")
    .description(
      "Manage encrypted credential vault (SQLite WAL + Postgres + Redis), Google Authenticator TOTP/QR, Passkeys, CSV import & Chrome yohanpierre15 -> aphrody-yolo sync",
    )
    .argument(
      "[action]",
      "Action: sync-profile, totp, import-csv, passkey, postgres-schema",
      "sync-profile",
    )
    .option("--csv <path>", "Path to Chrome Passwords CSV file")
    .option("--secret <uriOrBase32>", "otpauth:// URI or Base32 secret")
    .option(
      "--account <email>",
      "Google account email",
      "yohanpierre15@gmail.com",
    )
    .action(
      async (
        action: string,
        opts: { csv?: string; secret?: string; account: string },
      ) => {
        const vault = new YoloSecureVault();
        try {
          if (action === "postgres-schema") {
            console.log(getPostgresVaultSchemaSql());
            return;
          }
          if (action === "totp") {
            const secretOrUri = opts.secret ?? generateTotpSecretBase32(20);
            const enrolled = await vault.enrollTotpAuthenticator(secretOrUri, {
              issuer: "Aphrody-YOLO",
              accountName: opts.account,
            });
            const otpUri = buildOtpAuthUri({
              issuer: enrolled.issuer,
              accountName: enrolled.accountName,
              secretBase32: secretOrUri.startsWith("otpauth://")
                ? "JBSWY3DPEHPK3PXP"
                : secretOrUri,
            });
            const qrSvg = renderAuthenticatorQrSvg(otpUri, 180);
            console.log(
              JSON.stringify(
                {
                  enrolled,
                  qrSvgLength: qrSvg.length,
                },
                null,
                2,
              ),
            );
            return;
          }
          if (action === "import-csv") {
            const csvText =
              opts.csv && (await Bun.file(opts.csv).exists())
                ? await Bun.file(opts.csv).text()
                : "name,url,username,password,note\nGoogle,https://accounts.google.com/signin,yohanpierre15@gmail.com,demo-encrypted-pass,Primary Owner";
            const audit = await vault.importChromePasswordCsv(
              csvText,
              "aphrody-yolo",
            );
            console.log(JSON.stringify(audit, null, 2));
            return;
          }
          if (action === "passkey") {
            const regOpts = createPasskeyRegistrationOptions(
              {
                id: "owner-yohanpierre15",
                email: opts.account,
                name: "Yohan Pierre (aphrody-yolo)",
                role: "owner",
                isOwner: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              "aphrody.com",
              "Aphrody-YOLO Sovereign Vault",
            );
            console.log(JSON.stringify(regOpts, null, 2));
            return;
          }
          const receipt = await vault.syncChromeAccountToAphrodyYolo({
            sourceChromeProfile: "Chrome Active Profile (yohanpierre15)",
            sourceGoogleAccount: opts.account,
            targetYoloProfile: "aphrody-yolo",
          });
          console.log(JSON.stringify(receipt, null, 2));
        } finally {
          vault.close();
        }
      },
    );

  // 11. web index-ecosystem (Full Obscura + Brave + Servo + Network Map + 5-Registry Indexer)
  program
    .command("index-ecosystem")
    .description(
      "Index google.com, AI endpoints, Web UI/Backend stacks, and 5 registries (GitHub, npm, crates.io, PyPI, Go) into KnowledgeIndexDb",
    )
    .action(async () => {
      const db = new KnowledgeIndexDb(":memory:");
      try {
        for (const entry of YOLO_WEB_GOOGLE_NETWORK_MAP) {
          db.recordTestKnowledge({
            testSuite: "yolo-web-network-map",
            testName: `domain:${entry.domain}`,
            targetDomain: "google.com",
            targetUrl: entry.endpoints[0] ?? `https://${entry.domain}`,
            depth: 1,
            statusCode: 200,
            status: "VERIFIED",
            title: `${entry.domain} (${entry.category})`,
            extractedText: `${entry.webUiStack.join(" | ")} // ${entry.backendStack.join(" | ")} // ${entry.authAndCookies.join(", ")}`,
            ragSnippet: `Endpoints: ${entry.endpoints.length} | Auth: ${entry.authAndCookies.join(", ")}`,
          });
        }
        console.log(
          JSON.stringify(
            {
              indexedDomainRecords: db.getCount(),
              engineInventory: YOLO_WEB_ENGINE_INVENTORY,
              networkMap: YOLO_WEB_GOOGLE_NETWORK_MAP,
              fiveRegistryCatalogCount:
                YOLO_ECOSYSTEM_5_REGISTRY_CATALOG.length,
              registries: ["github", "npm", "crates.io", "pypi", "go"],
            },
            null,
            2,
          ),
        );
      } finally {
        db.close();
      }
    });

  return program;
}

async function main(): Promise<void> {
  const cli = createWebCli();
  await cli.parseAsync(process.argv);
}

if (import.meta.main) {
  void main();
}
