import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createUnifiedWebTools,
  handleUnifiedWebToolCall,
  UNIFIED_WEB_PROMPTS,
  UNIFIED_WEB_RESOURCES,
} from "./tools.js";

export function createWebMcpServer(): Server {
  const server = new Server(
    {
      name: "io.github.yolo-rs/web-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    },
  );

  const tools = createUnifiedWebTools();

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await handleUnifiedWebToolCall(
      request.params.name,
      request.params.arguments ?? {},
    );
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: UNIFIED_WEB_PROMPTS };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = UNIFIED_WEB_PROMPTS.find(
      (p) => p.name === request.params.name,
    );
    if (!prompt) {
      throw new Error(`Unknown prompt: ${request.params.name}`);
    }
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute unified web task: ${prompt.description} with arguments: ${JSON.stringify(request.params.arguments ?? {})}`,
          },
        },
      ],
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: UNIFIED_WEB_RESOURCES };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const res = UNIFIED_WEB_RESOURCES.find((r) => r.uri === request.params.uri);
    if (!res) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          uri: res.uri,
          mimeType: res.mimeType,
          text: JSON.stringify(
            {
              name: res.name,
              uri: res.uri,
              description: res.description,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  });

  return server;
}
