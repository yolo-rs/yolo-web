/**
 * @yolo-web/mcp-client
 * Pure Bun Model Context Protocol (MCP) client for Obscura & Yolo-Web AI Agents.
 * Supports both HTTP JSON-RPC (`obscura mcp --http`) and stdio (`Bun.spawn`).
 */

import {
  type McpToolCallResult,
  type McpToolDefinition,
  OBSCURA_MCP_TOOLS,
} from "@yolo-web/shared";

export interface HttpMcpTransportOptions {
  transport: "http";
  url: string;
  token?: string;
}

export interface StdioMcpTransportOptions {
  transport: "stdio";
  command?: string;
  args?: string[];
  env?: Record<string, string | undefined>;
}

export type YoloMcpClientOptions =
  HttpMcpTransportOptions | StdioMcpTransportOptions;

export interface ClickTarget {
  selector?: string;
  ref?: string;
}

export class YoloMcpClient implements AsyncDisposable {
  private readonly options: YoloMcpClientOptions;
  private nextId = 1;
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private stdoutReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private stdoutBuffer = "";

  constructor(options: YoloMcpClientOptions) {
    this.options = options;
  }

  private ensureStdioProcess(): void {
    if (this.options.transport !== "stdio" || this.proc) return;
    const cmd = this.options.command ?? "obscura";
    const args = this.options.args ?? ["mcp"];
    this.proc = Bun.spawn([cmd, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
      env: { ...Bun.env, ...this.options.env },
    });
    if (this.proc.stdout && typeof this.proc.stdout !== "number") {
      this.stdoutReader = this.proc.stdout.getReader();
    }
  }

  async rpc<TResult = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<TResult> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    if (this.options.transport === "http") {
      const token = this.options.token ?? Bun.env.OBSCURA_MCP_TOKEN;
      const res = await fetch(this.options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`MCP HTTP transport failed with status ${res.status}`);
      }

      const json = (await res.json()) as {
        id: number;
        result?: TResult;
        error?: { code: number; message: string };
      };

      if (json.error) {
        throw new Error(
          `MCP RPC Error (${json.error.code}): ${json.error.message}`,
        );
      }

      return json.result as TResult;
    }

    this.ensureStdioProcess();
    if (!this.proc || !this.proc.stdin || typeof this.proc.stdin === "number") {
      throw new Error("MCP stdio process stdin is not writable");
    }

    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
    await this.proc.stdin.flush();

    if (!this.stdoutReader) {
      throw new Error("MCP stdio process stdout is not readable");
    }

    const decoder = new TextDecoder();
    while (true) {
      const newlineIdx = this.stdoutBuffer.indexOf("\n");
      if (newlineIdx !== -1) {
        const line = this.stdoutBuffer.slice(0, newlineIdx).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as {
          id?: number;
          result?: TResult;
          error?: { code: number; message: string };
        };
        if (msg.id === id) {
          if (msg.error) {
            throw new Error(
              `MCP Stdio Error (${msg.error.code}): ${msg.error.message}`,
            );
          }
          return msg.result as TResult;
        }
      }

      const { done, value } = await this.stdoutReader.read();
      if (done) {
        throw new Error("MCP stdio process exited before replying");
      }
      this.stdoutBuffer += decoder.decode(value, { stream: true });
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const res = await this.rpc<{ tools?: McpToolDefinition[] }>(
      "tools/list",
      {},
    );
    return res.tools ?? [...OBSCURA_MCP_TOOLS];
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolCallResult> {
    const result = await this.rpc<McpToolCallResult>("tools/call", {
      name,
      arguments: args,
    });
    if (result.isError) {
      const errText =
        result.content.find((c) => c.type === "text")?.text ??
        `Tool ${name} failed`;
      throw new Error(`MCP Tool Error (${name}): ${errText}`);
    }
    return result;
  }

  private firstText(result: McpToolCallResult): string {
    return result.content.find((c) => c.type === "text")?.text ?? "";
  }

  async navigate(url: string): Promise<string> {
    const res = await this.callTool("browser_navigate", { url });
    return this.firstText(res);
  }

  async snapshot(options?: { maxChars?: number }): Promise<string> {
    const res = await this.callTool("browser_snapshot", {
      ...(options?.maxChars !== undefined
        ? { max_chars: options.maxChars }
        : {}),
    });
    return this.firstText(res);
  }

  async click(target: string | ClickTarget): Promise<string> {
    const args =
      typeof target === "string"
        ? target.startsWith("@") || /^e\d+$/.test(target)
          ? { ref: target }
          : { selector: target }
        : { ...target };
    const res = await this.callTool("browser_click", args);
    return this.firstText(res);
  }

  async type(target: string | ClickTarget, text: string): Promise<string> {
    const base =
      typeof target === "string"
        ? target.startsWith("@") || /^e\d+$/.test(target)
          ? { ref: target }
          : { selector: target }
        : { ...target };
    const res = await this.callTool("browser_type", { ...base, text });
    return this.firstText(res);
  }

  async evaluate(script: string, timeoutMs = 5000): Promise<string> {
    const res = await this.callTool("browser_evaluate", { script, timeoutMs });
    return this.firstText(res);
  }

  async screenshot(options?: {
    width?: number;
    height?: number;
  }): Promise<Uint8Array> {
    const res = await this.callTool("browser_screenshot", { ...options });
    const img = res.content.find((c) => c.type === "image" && c.data);
    if (!img?.data) {
      throw new Error("browser_screenshot did not return an image payload");
    }
    return Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
  }

  async pdf(options?: {
    landscape?: boolean;
    printBackground?: boolean;
    scale?: number;
  }): Promise<Uint8Array> {
    const res = await this.callTool("browser_pdf", {
      ...(options?.landscape !== undefined
        ? { landscape: options.landscape }
        : {}),
      ...(options?.printBackground !== undefined
        ? { print_background: options.printBackground }
        : {}),
      ...(options?.scale !== undefined ? { scale: options.scale } : {}),
    });
    const resource = res.content.find((c) => c.type === "resource")?.resource;
    const b64 =
      resource?.blob ?? res.content.find((c) => c.type === "image")?.data ?? "";
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  async extractMarkdown(): Promise<string> {
    const res = await this.callTool("browser_markdown", {});
    return this.firstText(res);
  }

  async close(): Promise<void> {
    if (this.stdoutReader) {
      try {
        await this.stdoutReader.cancel();
      } catch {
        // Ignore stream cancellation error on shutdown
      }
      this.stdoutReader = null;
    }
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
