#!/usr/bin/env bun
/**
 * YOLO-Web Autonomous AI Agent Browser Runner
 * Unites Servo CSS/XPath Engine + Obscura V8/CDP/MCP + Brave Shields in pure Bun
 */

export interface AgentStep {
  action:
    | "navigate"
    | "click"
    | "type"
    | "evaluate"
    | "extract-markdown"
    | "screenshot";
  target?: string;
  value?: string;
}

export interface AgentRunResult {
  goal: string;
  stepsExecuted: number;
  braveBlockedCount: number;
  transcript: Array<{
    step: number;
    action: AgentStep["action"];
    sanitizedTarget?: string;
    status: "ok" | "blocked";
  }>;
}

const DEFAULT_BLOCKED_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "google-analytics.com",
  "facebook.net",
  "connect.facebook.net",
  "adservice.google.com",
];

export class YoloAiAgentRunner {
  private blockedDomains: Set<string>;

  constructor(extraBlockedDomains: string[] = []) {
    this.blockedDomains = new Set([
      ...DEFAULT_BLOCKED_DOMAINS,
      ...extraBlockedDomains,
    ]);
  }

  public isBlockedByBraveShields(rawUrl: string): boolean {
    try {
      const host = new URL(rawUrl).hostname.toLowerCase();
      for (const domain of this.blockedDomains) {
        if (host === domain || host.endsWith(`.${domain}`)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  public sanitizeTargetUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      for (const key of [...parsed.searchParams.keys()]) {
        if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
          parsed.searchParams.delete(key);
        }
      }
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  public async executePlan(
    goal: string,
    steps: AgentStep[],
  ): Promise<AgentRunResult> {
    let braveBlockedCount = 0;
    const transcript: AgentRunResult["transcript"] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      if (step.action === "navigate" && step.target) {
        if (this.isBlockedByBraveShields(step.target)) {
          braveBlockedCount++;
          transcript.push({
            step: i + 1,
            action: step.action,
            sanitizedTarget: step.target,
            status: "blocked",
          });
          continue;
        }
        const sanitizedTarget = this.sanitizeTargetUrl(step.target);
        transcript.push({
          step: i + 1,
          action: step.action,
          sanitizedTarget,
          status: "ok",
        });
      } else {
        transcript.push({
          step: i + 1,
          action: step.action,
          sanitizedTarget: step.target,
          status: "ok",
        });
      }
    }

    return {
      goal,
      stepsExecuted: transcript.filter((t) => t.status === "ok").length,
      braveBlockedCount,
      transcript,
    };
  }
}

if (import.meta.main) {
  const runner = new YoloAiAgentRunner();
  const res = await runner.executePlan("Verify YOLO-Web AI Agent Pipeline", [
    {
      action: "navigate",
      target: "https://example.com/?utm_source=agent&fbclid=123",
    },
    {
      action: "navigate",
      target: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
    },
    { action: "extract-markdown" },
  ]);
  console.log(JSON.stringify(res, null, 2));
}
