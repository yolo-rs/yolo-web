#!/usr/bin/env bun
/**
 * @yolo-web/web-mcp entrypoint
 */

import { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWebMcpServer } from "./server.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("web-mcp")
    .description(
      "Unified 'web' MCP server for Obscura, Brave Search, Servo, and Chromium/V8",
    )
    .option("-t, --transport <type>", "Transport type: stdio or http", "stdio")
    .option("-p, --port <number>", "HTTP port (when transport is http)", "3000")
    .option("-h, --host <host>", "HTTP host", "127.0.0.1")
    .action(async (options) => {
      const server = createWebMcpServer();

      if (options.transport === "stdio") {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Unified Web MCP server running on stdio");
      } else {
        console.error(
          `HTTP transport not yet active on ${options.host}:${options.port}, using stdio`,
        );
        const transport = new StdioServerTransport();
        await server.connect(transport);
      }
    });

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  void main();
}
