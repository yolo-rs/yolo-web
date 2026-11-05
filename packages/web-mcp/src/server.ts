import { McpServer } from "@yolo-web/mcp-native";
import { StandardsLoader } from "@yolo-web/standards";
import {
  createUnifiedWebTools,
  handleUnifiedWebToolCall,
  UNIFIED_WEB_PROMPTS,
  UNIFIED_WEB_RESOURCES,
} from "./tools.js";

const standardsLoader = new StandardsLoader();
const WEB_STANDARD_RESOURCES = [
  {
    uri: "web://standards/webassembly",
    name: "WebAssembly core and component model profile",
    description:
      "Curated WebAssembly type, section, and canonical ABI registry profile",
    mimeType: "application/json",
  },
  {
    uri: "web://standards/mdn-compat",
    name: "MDN browser compatibility profile",
    description:
      "Browser and runtime compatibility snapshot for the toSorted feature",
    mimeType: "application/json",
  },
  {
    uri: "web://standards/tc39",
    name: "TC39 proposal snapshot",
    description: "ECMAScript proposal stage and champion snapshot",
    mimeType: "application/json",
  },
  {
    uri: "web://standards/mcp",
    name: "MCP protocol profile",
    description:
      "YOLO-Web MCP protocol capability and method profile; registry metadata, not a normative upstream schema",
    mimeType: "application/json",
  },
];

async function readWebStandard(uri: string): Promise<unknown | undefined> {
  switch (uri) {
    case "web://standards/webassembly":
      return await standardsLoader.loadWebAssembly();
    case "web://standards/mdn-compat":
      return await standardsLoader.loadMDNCompat();
    case "web://standards/tc39":
      return await standardsLoader.loadTC39();
    case "web://standards/mcp":
      return await standardsLoader.loadMCP2026();
    default:
      return undefined;
  }
}

export function createWebMcpServer(): McpServer {
  const server = new McpServer(
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

  server.setRequestHandler("tools/list", async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler("tools/call", async (params) => {
    return await handleUnifiedWebToolCall(params.name, params.arguments ?? {});
  });

  server.setRequestHandler("prompts/list", async () => {
    return { prompts: UNIFIED_WEB_PROMPTS };
  });

  server.setRequestHandler("prompts/get", async (params) => {
    const prompt = UNIFIED_WEB_PROMPTS.find((p) => p.name === params.name);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${params.name}`);
    }
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute unified web task: ${prompt.description} with arguments: ${JSON.stringify(params.arguments ?? {})}`,
          },
        },
      ],
    };
  });

  server.setRequestHandler("resources/list", async () => {
    return { resources: [...UNIFIED_WEB_RESOURCES, ...WEB_STANDARD_RESOURCES] };
  });

  server.setRequestHandler("resources/read", async (params) => {
    const uri = params.uri;
    const standard = await readWebStandard(uri);
    if (standard !== undefined) {
      const resource = WEB_STANDARD_RESOURCES.find((item) => item.uri === uri)!;
      return {
        contents: [
          {
            uri,
            mimeType: resource.mimeType,
            text: JSON.stringify(standard, null, 2),
          },
        ],
      };
    }
    const res = UNIFIED_WEB_RESOURCES.find((r) => r.uri === uri);
    if (!res) {
      throw new Error(`Unknown resource: ${params.uri}`);
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
