#!/usr/bin/env bun
/**
 * @yolo-web/web-mcp entrypoint
 */

import { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
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
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Unified Web MCP server running on stdio");
        return;
      }

      if (options.transport !== "http") {
        throw new Error(`Unsupported transport '${options.transport}'. Use stdio or http.`);
      }

      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid HTTP port '${options.port}'.`);
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      await server.connect(transport);

      const httpServer = Bun.serve({
        hostname: options.host,
        port,
        fetch: async (request) => {
          const path = new URL(request.url).pathname;
          if (path === "/health") {
            return Response.json({ status: "ok", service: "yolo-web-mcp", transport: "streamable-http" });
          }
          if (path !== "/mcp") return new Response("Not Found", { status: 404 });
          try {
            return await transport.handleRequest(request);
          } catch (error) {
            console.error("MCP HTTP request failed:", error);
            return Response.json(
              { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal MCP server error" } },
              { status: 500 },
            );
          }
        },
      });

      console.error(`Unified Web MCP Streamable HTTP server listening at http://${options.host}:${httpServer.port}/mcp`);
      const shutdown = async () => {
        await transport.close();
        httpServer.stop(true);
      };
      process.once("SIGINT", () => void shutdown());
      process.once("SIGTERM", () => void shutdown());
    });

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  void main();
}
