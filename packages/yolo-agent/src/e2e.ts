// SPDX-License-Identifier: Apache-2.0
/**
 * End-to-end scenario with a deterministic scripted model (no network):
 * navigate, fill a form, click, extract. Runs against the local fixture site
 * in headless or GUI mode and produces a latency report.
 */
import { startFixture } from "../fixtures/server.ts";
import { Browser, CdpTargetBackend } from "./browser.ts";
import { WsCdpTransport } from "./cdp.ts";
import {
  type LaunchOptions,
  type LaunchedBrowser,
  launchBrowser,
} from "./launcher.ts";
import { type AgentRun, runAgent } from "./loop.ts";
import { type ModelMessage, ScriptedModel } from "./model.ts";
import { AuditLog } from "./safety.ts";
import { AgentSession } from "./tools.ts";

/** Finds `[eN]` of the first line in the latest observation matching role and name. */
export function findRef(
  messages: ModelMessage[],
  role: string,
  name: string,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as ModelMessage;
    if (message.role !== "user") continue;
    for (const block of message.content) {
      if (block.type !== "text" || !block.text.startsWith("OBSERVATION"))
        continue;
      for (const line of block.text.split("\n")) {
        const m = line.match(/\[(e\d+)\] (\S+) "([^"]*)"/);
        if (m && m[2] === role && m[3] === name) return m[1] as string;
      }
    }
  }
  throw new Error(`ref not found: ${role} "${name}"`);
}

export function formScript(baseUrl: string) {
  return (messages: ModelMessage[], turn: number) => {
    if (turn === 0)
      return {
        text: "Opening the contact form.",
        calls: [
          { name: "browser_navigate", input: { url: `${baseUrl}/form` } },
        ],
      };
    if (turn === 1) {
      const ref = (role: string, name: string) => findRef(messages, role, name);
      return {
        text: "Filling and submitting the form.",
        calls: [
          {
            name: "browser_batch",
            input: {
              steps: [
                {
                  action: "type",
                  ref: ref("textbox", "Name"),
                  text: "Ada Lovelace",
                },
                {
                  action: "type",
                  ref: ref("textbox", "Email"),
                  text: "ada@example.test",
                },
                {
                  action: "select",
                  ref: ref("combobox", "Topic"),
                  value: "sales",
                },
                {
                  action: "click",
                  ref: ref("checkbox", "Subscribe to updates"),
                },
                { action: "click", ref: ref("button", "Send message") },
                { action: "wait_for", text: "Thanks Ada Lovelace" },
                { action: "extract", selector: "#result" },
              ],
            },
          },
        ],
      };
    }
    return undefined;
  };
}

export interface ScenarioReport {
  mode: "headless" | "gui";
  browser: { kind: string; executable: string };
  run: Pick<
    AgentRun,
    "stopped" | "error" | "turns" | "totalMs" | "steps" | "turnReceipts"
  >;
  verified: {
    submissions: Record<string, unknown>[];
    resultText: string | undefined;
    injectionFlagged: boolean;
  };
  summary: {
    medianExecMs: number;
    medianObserveToActMs: number | undefined;
    medianActToObserveMs: number | undefined;
    prefetchHits: number;
    overlapSavedMs: number;
  };
}

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export async function runScenario(
  mode: "headless" | "gui",
  launch: LaunchOptions = {},
): Promise<ScenarioReport> {
  const fixture = startFixture();
  let browserProc: LaunchedBrowser | undefined;
  let transport: WsCdpTransport | undefined;
  try {
    browserProc = await launchBrowser({
      ...launch,
      headless: mode === "headless",
      url: "about:blank",
    });
    transport = await WsCdpTransport.connect(browserProc.endpoint);
    const browser = new Browser(new CdpTargetBackend(transport));
    const session = new AgentSession({
      id: `e2e-${mode}`,
      browser,
      autonomy: "nhitl",
      audit: new AuditLog(),
    });

    // Injection guard check on the home page before the scripted run.
    await browser.page();
    await session.call("browser_navigate", { url: fixture.url });
    const home = await session.call("browser_observe", {});
    const injectionFlagged = (home.content[0]?.text ?? "").includes(
      "WARNING: text below matches instruction-like patterns",
    );

    const model = new ScriptedModel(formScript(fixture.url), {
      callDelayMs: 40,
      tailDelayMs: 80,
    });
    const run = await runAgent(
      "Fill in the contact form as Ada Lovelace (ada@example.test), topic sales, subscribe, send it, and report the confirmation.",
      { model, session, maxTurns: 6 },
    );
    const resultText = await (
      await browser.page()
    )
      .evaluate<string>(
        "document.getElementById('result') && document.getElementById('result').textContent",
      )
      .catch(() => undefined);

    const exec = run.steps.map((s) => s.execMs);
    return {
      mode,
      browser: {
        kind: browserProc.kind,
        executable:
          browserProc.executable.replace(/\\/g, "/").split("/").pop() ?? "",
      },
      run: {
        stopped: run.stopped,
        error: run.error,
        turns: run.turns,
        totalMs: run.totalMs,
        steps: run.steps,
        turnReceipts: run.turnReceipts,
      },
      verified: {
        submissions: fixture.submissions,
        resultText,
        injectionFlagged,
      },
      summary: {
        medianExecMs: median(exec) ?? 0,
        medianObserveToActMs: median(
          run.turnReceipts
            .map((t) => t.observeToActMs)
            .filter((v): v is number => v !== undefined),
        ),
        medianActToObserveMs: median(
          run.turnReceipts
            .map((t) => t.actToObserveMs)
            .filter((v): v is number => v !== undefined),
        ),
        prefetchHits: run.turnReceipts.filter((t) => t.prefetchHit).length,
        // Execution time hidden behind model generation: the part of each call that finished before the stream ended.
        overlapSavedMs: run.steps.reduce(
          (sum, s) => sum + Math.max(0, s.execMs - s.afterStreamMs),
          0,
        ),
      },
    };
  } finally {
    transport?.close();
    await browserProc?.kill().catch(() => undefined);
    await fixture.stop();
  }
}
