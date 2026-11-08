#!/usr/bin/env bun
/**
 * YOLO Sovereign Search MCP Server
 * Exposes multi-provider search & doc intelligence over MCP JSON-RPC 2.0 (stdio or SSE HTTP)
 */

import { SovereignSearchEngine } from './engine.ts';

const engine = new SovereignSearchEngine();

const TOOLS = [
  {
    name: 'sovereign_search',
    description: 'Unified multi-provider web & doc search (FreeContext7, Exa, SearXNG, Google). Zero cost on local/free routes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or question' },
        provider: {
          type: 'string',
          enum: ['fastest', 'free-context7', 'searxng', 'exa', 'google-sovereign', 'all'],
          description: 'Provider to target. "fastest" uses local-first then cloud fallback.',
        },
        limit: { type: 'number', description: 'Maximum number of results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'resolve_code_doc',
    description: 'Fast local resolution of code signatures, guides, and verified examples from local SQLite database.',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Name of the library (e.g. bun, gvisor, react)' },
        symbol: { type: 'string', description: 'Function, class, or symbol name' },
      },
      required: ['library'],
    },
  },
];

async function handleRpc(msg: any): Promise<any> {
  if (msg.method === 'tools/list') {
    return {
      tools: TOOLS,
    };
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    if (name === 'sovereign_search') {
      const res = await engine.search(args.query, {
        provider: args.provider || 'fastest',
        limit: args.limit || 5,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    if (name === 'resolve_code_doc') {
      const res = engine.resolveDocs({
        library: args.library,
        symbol: args.symbol,
      });
      return {
        content: [
          {
            type: 'text',
            text: res ? JSON.stringify(res, null, 2) : `No verified documentation found for ${args.library}:${args.symbol}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  return {};
}

// Check if running on stdio
if (process.argv.includes('--stdio') || !process.argv.includes('--http')) {
  process.stdin.setEncoding('utf8');
  let buffer = '';

  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line);
        const res = await handleRpc(req);
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: res }) + '\n');
      } catch (e: any) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32603, message: e.message },
          }) + '\n'
        );
      }
    }
  });
}
