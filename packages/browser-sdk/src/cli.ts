#!/usr/bin/env bun
/**
 * Unified CLI & REPL Tool: `yolo-web` / `obscura`.
 * Supports:
 * - Interactive REPL with auto-completion and color status
 * - Headless and GUI execution
 * - Dumping HTML, Markdown, PDF, text, links
 * - Fullpage screenshots
 * - Multi-tab switching
 * - MCP server mode over stdio or HTTP
 */

import { YoloBrowser } from "./index";
import { YoloMcpServer } from "./mcp-server";
import { AiVisionEngine } from "./ai-vision";
import { EngineManager } from "./engine";
import * as readline from "node:readline";

async function main() {
  const args = process.argv.slice(2);

  // Parse basic flags
  let url: string | undefined;
  let dumpFormat: "html" | "markdown" | "pdf" | "text" | undefined;
  let screenshotPath: string | undefined;
  let isHeadless = true;
  let isRepl = false;
  let isMcp = false;
  let stealth = true;
  let cdpUrl = process.env.CDP_URL;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--gui") isHeadless = false;
    else if (arg === "--headless") isHeadless = true;
    else if (arg === "--no-stealth") stealth = false;
    else if (arg === "--repl") isRepl = true;
    else if (arg === "--mcp") isMcp = true;
    else if (arg === "--url" && i + 1 < args.length) url = args[++i];
    else if (arg === "--dump" && i + 1 < args.length) dumpFormat = args[++i] as any;
    else if (arg === "--screenshot" && i + 1 < args.length) screenshotPath = args[++i];
    else if (arg === "--cdp" && i + 1 < args.length) cdpUrl = args[++i];
    else if (!arg.startsWith("-") && !url) url = arg;
  }

  // Connect or launch engine
  let engineProc: any;
  if (!cdpUrl) {
    try {
      engineProc = await EngineManager.launch({ headless: isHeadless, stealth });
      cdpUrl = engineProc.cdpUrl;
    } catch {
      cdpUrl = "http://127.0.0.1:9222";
    }
  }

  const endpoint = cdpUrl || "http://127.0.0.1:9222";
  const browser = await YoloBrowser.connect({
    cdpUrl: endpoint,
    stealth: { enabled: stealth },
  });

  const page = await browser.newPage();

  // Mode: MCP stdio
  if (isMcp) {
    const mcpServer = new YoloMcpServer(browser);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

    rl.on("line", async (line) => {
      if (!line.trim()) return;
      try {
        const req = JSON.parse(line);
        const res = await mcpServer.handleJsonRpc(req);
        process.stdout.write(JSON.stringify(res) + "\n");
      } catch (err: any) {
        process.stdout.write(
          JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"
        );
      }
    });
    return;
  }

  // If a URL is passed, navigate
  if (url) {
    await page.goto(url);
  }

  // Handle dumps
  if (dumpFormat) {
    if (dumpFormat === "markdown") {
      const md = await AiVisionEngine.extractMarkdown(page);
      process.stdout.write(md + "\n");
    } else if (dumpFormat === "html") {
      const html = await page.content();
      process.stdout.write(html + "\n");
    } else if (dumpFormat === "text") {
      const text = await page.evaluate<string>("document.body ? document.body.innerText : ''");
      process.stdout.write((text || "") + "\n");
    } else if (dumpFormat === "pdf") {
      const path = screenshotPath || "dump.pdf";
      await page.pdf({ path });
      process.stdout.write(`PDF saved to ${path}\n`);
    }
  }

  // Handle screenshot
  if (screenshotPath && dumpFormat !== "pdf") {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    process.stdout.write(`Screenshot saved to ${screenshotPath}\n`);
  }

  // If REPL mode is requested or no commands specified, enter interactive REPL
  if (isRepl || (!dumpFormat && !screenshotPath && !isMcp)) {
    process.stdout.write("\n=======================================================\n");
    process.stdout.write(" yolo-web / obscura interactive browser REPL\n");
    process.stdout.write(" Commands: open <url> | click <sel> | type <sel> <text>\n");
    process.stdout.write("           dump [md|html|text] | shot [path] | vision\n");
    process.stdout.write("           tabs | eval <expr> | exit\n");
    process.stdout.write("=======================================================\n\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "yolo-web> ",
    });

    rl.prompt();

    rl.on("line", async (line) => {
      const trimmed = line.trim();
      const parts = trimmed.split(" ");
      const cmd = parts[0]?.toLowerCase();
      const rest = parts.slice(1).join(" ");

      try {
        if (cmd === "exit" || cmd === "quit") {
          await browser.disconnect();
          if (engineProc) await engineProc.stop();
          process.exit(0);
        } else if (cmd === "open" || cmd === "goto") {
          await page.goto(rest);
          process.stdout.write(`Loaded: ${await page.title()} (${await page.url()})\n`);
        } else if (cmd === "click") {
          const loc = page.locator(rest);
          await loc.click();
          process.stdout.write(`Clicked: ${rest}\n`);
        } else if (cmd === "type") {
          const sel = parts[1];
          const text = parts.slice(2).join(" ");
          if (sel) {
            const loc = page.locator(sel);
            await loc.fill(text);
            process.stdout.write(`Typed into ${sel}: ${text}\n`);
          }
        } else if (cmd === "dump") {
          const fmt = parts[1] || "md";
          if (fmt === "md") {
            process.stdout.write((await AiVisionEngine.extractMarkdown(page)) + "\n");
          } else if (fmt === "html") {
            process.stdout.write((await page.content()) + "\n");
          } else {
            process.stdout.write((await page.evaluate<string>("document.body ? document.body.innerText : ''")) + "\n");
          }
        } else if (cmd === "shot") {
          const file = rest || "screenshot.png";
          await page.screenshot({ path: file });
          process.stdout.write(`Saved screenshot to ${file}\n`);
        } else if (cmd === "vision" || cmd === "snapshot") {
          const snap = await AiVisionEngine.captureSnapshot(page);
          process.stdout.write(snap.snapshot + "\n");
        } else if (cmd === "eval") {
          const result = await page.evaluate(rest);
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else if (cmd === "tabs") {
          const all = browser.pages();
          process.stdout.write(`Active tabs (${all.length}):\n`);
          for (const p of all) {
            process.stdout.write(` - ${p.targetId}: ${await p.title()} (${await p.url()})\n`);
          }
        } else if (trimmed) {
          process.stdout.write(`Unknown command "${cmd}". Type "open <url>", "shot", "vision", "eval <expr>" or "exit".\n`);
        }
      } catch (err: any) {
        process.stdout.write(`Error: ${err?.message || err}\n`);
      }

      rl.prompt();
    });

    return;
  }

  if (!isRepl && !isMcp) {
    await browser.disconnect();
    if (engineProc) await engineProc.stop();
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
