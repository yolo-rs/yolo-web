export type VersionState = string | boolean | null;

export interface WebAssemblySchema {
  version: string;
  coreSpecUrl: string;
  componentModelSpecUrl: string;
  valTypes: string[];
  componentTypes: string[];
  sections: Array<{ id: number; name: string; description: string }>;
  canonicalAbis?: string[];
}

export interface BrowserSupport {
  version_added?: VersionState;
  version_removed?: VersionState;
  prefix?: string;
  notes?: string | string[];
  [key: string]: unknown;
}

export interface MDNCompatSchema {
  feature: string;
  mdn_url?: string;
  support: Record<string, BrowserSupport>;
  subfeatures?: Record<string, unknown>;
}

export interface TC39Proposal {
  name: string;
  stage: number;
  champions: string[];
  url: string;
  tags?: string[];
  notes?: string;
}

export interface TC39ProposalsSchema {
  proposals: TC39Proposal[];
}

export type MCPMethodKind = "request" | "notification";

export interface MCPSchema2026 {
  version: string;
  protocolVersion: string;
  transports: Array<"stdio" | "sse" | "websocket" | "memory">;
  capabilities: {
    server: {
      tools?: boolean;
      resources?: boolean;
      prompts?: boolean;
      logging?: boolean;
      streaming?: boolean;
    };
    client: {
      roots?: boolean;
      sampling?: boolean;
      experimental?: Record<string, unknown>;
    };
  };
  methods: Array<{
    name: string;
    kind: MCPMethodKind;
    paramsSchema?: Record<string, unknown>;
    resultSchema?: Record<string, unknown>;
  }>;
}
