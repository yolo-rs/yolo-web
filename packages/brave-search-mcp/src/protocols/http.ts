import config from '../config.js';
import createMcpServer from '../server.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ListToolsRequest } from '@modelcontextprotocol/sdk/types.js';
import { createDnsRebindingGuard } from './rebinding.js';

const genericServerError = () =>
  Response.json(
    {
      id: null,
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
    },
    { status: 500 }
  );

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

const isListToolsRequest = (value: unknown): value is ListToolsRequest =>
  ListToolsRequestSchema.safeParse(value).success;

const getTransport = async (
  request: Request
): Promise<WebStandardStreamableHTTPServerTransport> => {
  // Check for an existing session
  const sessionId = request.headers.get('mcp-session-id');

  if (sessionId && transports.has(sessionId)) {
    return transports.get(sessionId)!;
  }

  // We have a special case where we'll permit ListToolsRequest w/o a session ID
  let body: unknown;
  if (!sessionId) {
    try {
      body = await request.clone().json();
    } catch {
      body = undefined;
    }
  }

  if (!sessionId && isListToolsRequest(body)) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    return transport;
  }

  let transport: WebStandardStreamableHTTPServerTransport;

  if (config.stateless) {
    // Some contexts (e.g. AgentCore) may prefer or require a stateless transport
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
  } else {
    // Otherwise, start a new transport/session
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
      onsessionclosed: (sessionId) => {
        transports.delete(sessionId);
      },
    });
  }

  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);
  return transport;
};

const guardRequest = createDnsRebindingGuard({
  allowedHosts: config.allowedHosts,
  allowedOrigins: config.allowedOrigins,
});

export const createApp = async (request: Request): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/ping') return Response.json({ message: 'pong' });
  if (pathname !== '/mcp') return new Response('Not found', { status: 404 });

  const denied = guardRequest(request);
  if (denied) return denied;

  try {
    const transport = await getTransport(request);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error(error);
    return genericServerError();
  }
};

const start = () => {
  if (!config.ready) {
    throw new Error('Invalid configuration');
  }

  try {
    Bun.serve({ hostname: config.host, port: config.port, fetch: createApp });
    console.log(`Server is running on http://${config.host}:${config.port}/mcp`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Unable to start HTTP server: ${detail}`);
    throw error;
  }
};

export default { start, createApp };
