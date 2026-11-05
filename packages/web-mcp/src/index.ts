#!/usr/bin/env bun
/**
 * @yolo-web/web-mcp entrypoint
 */

import { Command } from "@yolo-web/cli-native";
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
    .action(async (options: { transport: string; port: string; host: string }) => {
      const server = createWebMcpServer();

      if (options.transport === "stdio") {
        console.error("Unified Web MCP server running on stdio");
        await server.serveStdio();
        return;
      }

      if (options.transport !== "http") {
        throw new Error(`Unsupported transport '${options.transport}'. Use stdio or http.`);
      }

      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid HTTP port '${options.port}'.`);
      }

      const httpServer = Bun.serve({
        hostname: options.host,
        port,
        routes: {
          "/health": () => Response.json({ status: "ok", service: "yolo-web-mcp", transport: "streamable-http" }),
          "/mcp": async (request) => {
            try {
              return await server.fetch(request);
            } catch (error) {
              console.error("MCP HTTP request failed:", error);
              return Response.json(
                { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal MCP server error" } },
                { status: 500 },
              );
            }
          },
        },
        fetch: () => new Response("Not Found", { status: 404 }),
      });

      console.error(`Unified Web MCP Streamable HTTP server listening at http://${options.host}:${httpServer.port}/mcp`);
      const shutdown = () => void httpServer.stop(true);
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  void main();
}
