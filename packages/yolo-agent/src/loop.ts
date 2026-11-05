// SPDX-License-Identifier: Apache-2.0
/**
 * Observe-act loop with streamed execution.
 *
 * - Tool calls execute the moment their JSON closes in the model stream, while
 *   the model is still generating (calls run strictly in order).
 * - After an action settles and nothing else is queued, the next observation
 *   is prefetched speculatively; the next turn reuses it when no further
 *   mutation happened.
 * - Every call produces a timing receipt.
 */
import type { ContentBlock, ModelClient, ModelMessage } from "./model.ts";
import { type Observation, formatObservation } from "./observe.ts";
import { SYSTEM_PROMPT, wrapUntrusted } from "./safety.ts";
import { type AgentSession, type ToolContent, allTools } from "./tools.ts";

export interface StepReceipt {
  turn: number;
  tool: string;
  /** ms from request start until the call's JSON closed in the stream. */
  modelCallAtMs: number;
  /** ms the call waited behind earlier calls. */
  queuedMs: number;
  execMs: number;
  /** ms between the stream ending and this call finishing (0 means fully overlapped with generation). */
  afterStreamMs: number;
  isError: boolean;
}

export interface TurnReceipt {
  turn: number;
  /** observation ready -> first action started executing (model latency + parse). */
  observeToActMs?: number;
  /** last action finished -> next observation ready. */
  actToObserveMs?: number;
  prefetchHit: boolean;
  modelStreamMs: number;
  calls: number;
  observationRefs?: number;
}

export interface AgentRun {
  goal: string;
  finalText: string;
  turns: number;
  stopped: "done" | "max_turns" | "error";
  error?: string;
  steps: StepReceipt[];
  turnReceipts: TurnReceipt[];
  totalMs: number;
  messages: ModelMessage[];
}

export interface LoopOptions {
  model: ModelClient;
  session: AgentSession;
  maxTurns?: number;
  screenshot?: boolean;
  speculative?: boolean;
  system?: string;
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStep?: (step: StepReceipt, content: ToolContent[]) => void;
}

const OBS_MARK = "OBSERVATION";

function toBlocks(content: ToolContent[]): ContentBlock[] {
  return content.map((c) =>
    c.type === "image"
      ? {
          type: "image",
          source: {
            type: "base64",
            media_type: c.mimeType ?? "image/jpeg",
            data: c.data ?? "",
          },
        }
      : { type: "text", text: c.text ?? "" },
  );
}

/** Keeps the latest observation in full and elides older ones (and all older images). */
export function pruneHistory(messages: ModelMessage[]): void {
  let seenLatest = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as ModelMessage;
    if (message.role !== "user") continue;
    const hasObs = message.content.some(
      (b) => b.type === "text" && b.text.startsWith(OBS_MARK),
    );
    if (!hasObs) continue;
    if (!seenLatest) {
      seenLatest = true;
      continue;
    }
    message.content = message.content
      .filter((b) => b.type !== "image")
      .map((b) =>
        b.type === "text" && b.text.startsWith(OBS_MARK)
          ? {
              type: "text",
              text: `${OBS_MARK} [elided: superseded by a newer observation]`,
            }
          : b,
      );
  }
}

export async function runAgent(
  goal: string,
  options: LoopOptions,
): Promise<AgentRun> {
  const { model, session } = options;
  const maxTurns = options.maxTurns ?? 20;
  const speculative = options.speculative !== false;
  const tools = allTools().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
  const run: AgentRun = {
    goal,
    finalText: "",
    turns: 0,
    stopped: "max_turns",
    steps: [],
    turnReceipts: [],
    totalMs: 0,
    messages: [],
  };
  const t0 = performance.now();

  const observe = async (): Promise<{
    obs: Observation;
    content: ContentBlock[];
    prefetched: boolean;
    ms: number;
  }> => {
    const start = performance.now();
    const obs = await session.browser.observe({
      screenshot: options.screenshot === true,
    });
    const blocks: ContentBlock[] = [
      { type: "text", text: `${OBS_MARK}\n${formatObservation(obs)}` },
    ];
    if (obs.screenshot)
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: obs.screenshot.mime,
          data: obs.screenshot.data,
        },
      });
    return {
      obs,
      content: blocks,
      prefetched: (obs as { prefetched?: boolean }).prefetched === true,
      ms: performance.now() - start,
    };
  };

  try {
    const first = await observe();
    run.messages.push({
      role: "user",
      content: [
        { type: "text", text: `Task from the user:\n${goal}` },
        ...first.content,
      ],
    });
    let observationReadyAt = performance.now();
    let lastActFinishedAt = 0;

    for (let turn = 1; turn <= maxTurns; turn++) {
      if (options.signal?.aborted) throw new Error("aborted");
      run.turns = turn;
      pruneHistory(run.messages);

      const streamStart = performance.now();
      const calls: {
        id: string;
        name: string;
        input: Record<string, unknown>;
      }[] = [];
      const results = new Map<
        string,
        { content: ToolContent[]; isError: boolean }
      >();
      let text = "";
      let queue: Promise<void> = Promise.resolve();
      let streamEndedAt = 0;
      let firstActStart: number | undefined;
      const turnSteps: StepReceipt[] = [];
      let pendingExec = 0;

      for await (const event of model.stream({
        system: options.system ?? SYSTEM_PROMPT,
        messages: run.messages,
        tools,
        signal: options.signal,
      })) {
        if (event.type === "text_delta") {
          text += event.text;
          options.onText?.(event.text);
        } else if (event.type === "tool_call") {
          calls.push({ id: event.id, name: event.name, input: event.input });
          const enqueuedAt = performance.now();
          pendingExec++;
          // Chain: executes as soon as earlier calls finish, concurrently with model generation.
          queue = queue.then(async () => {
            const startedAt = performance.now();
            firstActStart ??= startedAt;
            // The loop attaches one fresh observation per turn, so batches skip their own.
            const input =
              event.name === "browser_batch"
                ? { ...event.input, observe: false }
                : event.input;
            const result = await session.call(event.name, input);
            const finishedAt = performance.now();
            lastActFinishedAt = finishedAt;
            results.set(event.id, {
              content: result.content,
              isError: result.isError,
            });
            const step: StepReceipt = {
              turn,
              tool: event.name,
              modelCallAtMs: Math.round(event.atMs),
              queuedMs: Math.round(startedAt - enqueuedAt),
              execMs: Math.round(finishedAt - startedAt),
              afterStreamMs: 0,
              isError: result.isError,
            };
            turnSteps.push({ ...step, afterStreamMs: -finishedAt }); // fixed up after the stream ends
            options.onStep?.(step, result.content);
            pendingExec--;
            if (
              speculative &&
              pendingExec === 0 &&
              !result.isError &&
              !event.name.startsWith("audit_") &&
              event.name !== "browser_observe"
            ) {
              session.browser.prefetch(options.screenshot === true);
            }
          });
        } else if (event.type === "done") {
          streamEndedAt = performance.now();
        }
      }
      await queue;
      if (!streamEndedAt) streamEndedAt = performance.now();
      for (const step of turnSteps) {
        const finishedAt = -step.afterStreamMs;
        step.afterStreamMs = Math.max(
          0,
          Math.round(finishedAt - streamEndedAt),
        );
        run.steps.push(step);
      }

      const assistant: ContentBlock[] = [];
      if (text) assistant.push({ type: "text", text });
      for (const call of calls)
        assistant.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.input,
        });
      if (assistant.length)
        run.messages.push({ role: "assistant", content: assistant });

      if (calls.length === 0) {
        run.finalText = text;
        run.stopped = "done";
        run.turnReceipts.push({
          turn,
          prefetchHit: false,
          modelStreamMs: Math.round(streamEndedAt - streamStart),
          calls: 0,
        });
        break;
      }

      const next = await observe();
      const toolResults: ContentBlock[] = calls.map((call) => {
        const r = results.get(call.id) ?? {
          content: [
            { type: "text", text: "ERROR: call did not run" } as ToolContent,
          ],
          isError: true,
        };
        const blocks = toBlocks(r.content.filter((c) => c.type === "text"));
        return {
          type: "tool_result",
          tool_use_id: call.id,
          content: blocks.length ? blocks : [{ type: "text", text: "ok" }],
          ...(r.isError ? { is_error: true } : {}),
        } as ContentBlock;
      });
      run.messages.push({
        role: "user",
        content: [...toolResults, ...next.content],
      });

      const readyAt = performance.now();
      run.turnReceipts.push({
        turn,
        observeToActMs:
          firstActStart === undefined
            ? undefined
            : Math.round(firstActStart - observationReadyAt),
        actToObserveMs: lastActFinishedAt
          ? Math.round(readyAt - lastActFinishedAt)
          : undefined,
        prefetchHit: next.prefetched,
        modelStreamMs: Math.round(streamEndedAt - streamStart),
        calls: calls.length,
        observationRefs: next.obs.refs,
      });
      observationReadyAt = readyAt;
    }
  } catch (error) {
    run.stopped = "error";
    run.error = error instanceof Error ? error.message : String(error);
  }
  run.totalMs = Math.round(performance.now() - t0);
  return run;
}

export { wrapUntrusted };
