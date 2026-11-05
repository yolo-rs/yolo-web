// SPDX-License-Identifier: Apache-2.0
/**
 * Provider-agnostic streaming model client. The first adapter speaks the
 * Anthropic Messages API streaming shape over `fetch`. Tool calls are
 * emitted the moment their JSON input closes, before the rest of the response
 * has arrived, so the agent loop can start acting immediately.
 *
 * The API key is read from the environment (or a caller-supplied getter) on
 * each request. It is never stored on disk, logged or included in errors.
 */
import { redactSecrets } from "./safety.ts";
import type { JsonSchema } from "./spec.ts";

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | ContentBlock[];
      is_error?: boolean;
    };

export interface ModelMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ModelTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

export type ModelEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
      atMs: number;
    }
  | {
      type: "done";
      stopReason: string;
      usage?: { input?: number; output?: number };
      atMs: number;
    };

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
  tools: ModelTool[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ModelClient {
  readonly name: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}

/**
 * Detects the end of a top-level JSON object in a stream of fragments without
 * re-parsing: tracks string/escape state and brace depth.
 */
export class JsonObjectAccumulator {
  private buf = "";
  private depth = 0;
  private inString = false;
  private escaped = false;
  private started = false;
  private closed = false;

  /** Feeds a fragment; returns the parsed object once the top-level object closes. */
  push(fragment: string): Record<string, unknown> | undefined {
    if (this.closed) return undefined;
    for (const ch of fragment) {
      this.buf += ch;
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') this.inString = true;
      else if (ch === "{") {
        this.depth++;
        this.started = true;
      } else if (ch === "}") {
        this.depth--;
        if (this.started && this.depth === 0) {
          this.closed = true;
          return JSON.parse(this.buf) as Record<string, unknown>;
        }
      }
    }
    return undefined;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** For blocks that never streamed any input (empty arguments). */
  finish(): Record<string, unknown> {
    if (this.closed) return JSON.parse(this.buf) as Record<string, unknown>;
    return this.buf.trim()
      ? (JSON.parse(this.buf) as Record<string, unknown>)
      : {};
  }
}

/** Parses an SSE byte stream into `{event, data}` frames. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.search(/\r?\n\r?\n/);
      while (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, "");
        let event = "message";
        const data: string[] = [];
        for (const line of raw.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:"))
            data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length) yield { event, data: data.join("\n") };
        sep = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface AnthropicOptions {
  /** Returns the API key at request time. Defaults to `ANTHROPIC_API_KEY`. */
  getApiKey?: () => string | undefined;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}

export class AnthropicClient implements ModelClient {
  readonly name = "anthropic";
  private readonly getApiKey: () => string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicOptions = {}) {
    this.getApiKey = options.getApiKey ?? (() => Bun.env.ANTHROPIC_API_KEY);
    this.baseUrl = (
      options.baseUrl ??
      Bun.env.ANTHROPIC_BASE_URL ??
      "https://api.anthropic.com"
    ).replace(/\/$/, "");
    this.model =
      options.model ?? Bun.env.YOLO_AGENT_MODEL ?? "claude-sonnet-5-5";
    this.fetchImpl = options.fetch ?? fetch;
  }

  async *stream(request: ModelRequest): AsyncGenerator<ModelEvent> {
    const key = this.getApiKey();
    if (!key)
      throw new Error(
        "no model API key: set ANTHROPIC_API_KEY (it is read from the environment only)",
      );
    const t0 = performance.now();
    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
        system: [
          {
            type: "text",
            text: request.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: request.tools,
        messages: request.messages,
      }),
      signal: request.signal,
    });
    if (!response.ok || !response.body) {
      const detail = redactSecrets(await response.text().catch(() => ""))
        .replaceAll(key, "[redacted]")
        .slice(0, 400);
      throw new Error(`anthropic HTTP ${response.status}: ${detail}`);
    }

    const blocks = new Map<
      number,
      {
        kind: "text" | "tool";
        id?: string;
        name?: string;
        acc?: JsonObjectAccumulator;
        emitted?: boolean;
      }
    >();
    let stopReason = "end_turn";
    let usage: { input?: number; output?: number } | undefined;

    for await (const frame of parseSse(response.body)) {
      if (frame.event === "ping") continue;
      const payload = JSON.parse(frame.data) as Record<string, any>;
      switch (payload.type) {
        case "content_block_start": {
          const block = payload.content_block;
          if (block.type === "tool_use")
            blocks.set(payload.index, {
              kind: "tool",
              id: block.id,
              name: block.name,
              acc: new JsonObjectAccumulator(),
            });
          else blocks.set(payload.index, { kind: "text" });
          break;
        }
        case "content_block_delta": {
          const state = blocks.get(payload.index);
          if (!state) break;
          if (payload.delta.type === "text_delta")
            yield { type: "text_delta", text: payload.delta.text };
          else if (
            payload.delta.type === "input_json_delta" &&
            state.acc &&
            !state.emitted
          ) {
            const input = state.acc.push(payload.delta.partial_json ?? "");
            if (input) {
              state.emitted = true;
              yield {
                type: "tool_call",
                id: state.id as string,
                name: state.name as string,
                input,
                atMs: performance.now() - t0,
              };
            }
          }
          break;
        }
        case "content_block_stop": {
          const state = blocks.get(payload.index);
          if (state?.kind === "tool" && !state.emitted && state.acc) {
            state.emitted = true;
            yield {
              type: "tool_call",
              id: state.id as string,
              name: state.name as string,
              input: state.acc.finish(),
              atMs: performance.now() - t0,
            };
          }
          break;
        }
        case "message_delta":
          stopReason = payload.delta?.stop_reason ?? stopReason;
          if (payload.usage)
            usage = {
              input: payload.usage.input_tokens,
              output: payload.usage.output_tokens,
            };
          break;
        case "error":
          throw new Error(
            `anthropic stream error: ${redactSecrets(String(payload.error?.message ?? "unknown"))}`,
          );
        default:
          break;
      }
    }
    yield { type: "done", stopReason, usage, atMs: performance.now() - t0 };
  }
}

/**
 * Deterministic model for tests and offline runs: a script maps the
 * conversation so far to the tool calls for the next turn. Optional per-call
 * delays simulate token streaming without a network.
 */
export class ScriptedModel implements ModelClient {
  readonly name = "scripted";
  turns = 0;

  constructor(
    private readonly script: (
      messages: ModelMessage[],
      turn: number,
    ) =>
      | {
          text?: string;
          calls: { name: string; input: Record<string, unknown> }[];
        }
      | undefined,
    private readonly options: {
      callDelayMs?: number;
      tailDelayMs?: number;
    } = {},
  ) {}

  async *stream(request: ModelRequest): AsyncGenerator<ModelEvent> {
    const t0 = performance.now();
    const turn = this.turns++;
    const step = this.script(request.messages, turn);
    if (!step) {
      yield {
        type: "done",
        stopReason: "end_turn",
        atMs: performance.now() - t0,
      };
      return;
    }
    if (step.text) yield { type: "text_delta", text: step.text };
    for (const [i, call] of step.calls.entries()) {
      if (this.options.callDelayMs)
        await new Promise((r) => setTimeout(r, this.options.callDelayMs));
      yield {
        type: "tool_call",
        id: `scripted_${turn}_${i}`,
        name: call.name,
        input: call.input,
        atMs: performance.now() - t0,
      };
    }
    // Models keep generating a little after the last tool call closes (stop reason, usage).
    if (this.options.tailDelayMs)
      await new Promise((r) => setTimeout(r, this.options.tailDelayMs));
    yield {
      type: "done",
      stopReason: step.calls.length ? "tool_use" : "end_turn",
      atMs: performance.now() - t0,
    };
  }
}
