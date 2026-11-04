import type { MCPSchema2026, MDNCompatSchema, TC39ProposalsSchema, WebAssemblySchema } from "./types.ts";
import { validateMCP2026, validateMDNCompat, validateTC39, validateWebAssembly } from "./validators.ts";

function joinPath(...parts: string[]): string {
  const separator = parts[0]?.includes("\\") ? "\\" : "/";
  return parts.reduce((path, part) => {
    if (path.length === 0) return part;
    return `${path.replace(/[\\/]+$/, "")}${separator}${part.replace(/^[\\/]+/, "")}`;
  }, "");
}

export interface StandardsLoaderOptions {
  schemaDir?: string;
}

export class StandardsLoader {
  readonly schemaDir: string;

  constructor(options: StandardsLoaderOptions = {}) {
    this.schemaDir = options.schemaDir ?? joinPath(import.meta.dir, "..", "..", "..", "data", "standards", "web");
  }

  private async loadJson(category: string, filename: string): Promise<unknown> {
    for (const suffix of ["current", "default"]) {
      const path = joinPath(this.schemaDir, category, `${filename}.${suffix}.json`);
      const file = Bun.file(path);
      if (await file.exists()) return await file.json();
    }
    throw new Error(`Standard not found: category=${category}, name=${filename}`);
  }

  async loadWebAssembly(): Promise<WebAssemblySchema> {
    const data = await this.loadJson("webassembly", "webassembly");
    if (!validateWebAssembly(data)) throw new Error("Invalid WebAssembly schema data");
    return data;
  }

  async loadMDNCompat(): Promise<MDNCompatSchema> {
    const data = await this.loadJson("mdn", "mdn-compat");
    if (!validateMDNCompat(data)) throw new Error("Invalid MDN compatibility data");
    return data;
  }

  async loadTC39(): Promise<TC39ProposalsSchema> {
    const data = await this.loadJson("tc39", "tc39");
    if (!validateTC39(data)) throw new Error("Invalid TC39 proposal data");
    return data;
  }

  async loadMCP2026(): Promise<MCPSchema2026> {
    const data = await this.loadJson("mcp", "mcp-2026");
    if (!validateMCP2026(data)) throw new Error("Invalid MCP registry profile");
    return data;
  }
}
