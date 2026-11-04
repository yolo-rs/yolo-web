import { describe, expect, test } from "bun:test";
import { YoloAiAgentRunner } from "./index.ts";

describe("@yolo-web/ai-agent-runner", () => {
  test("executes multi-step plan with Brave Shields adblock and URL hygiene", async () => {
    const runner = new YoloAiAgentRunner();
    const report = await runner.executePlan("Extract clean article markdown", [
      {
        action: "navigate",
        target: "https://servo.org/blog/?utm_medium=social&gclid=xyz987",
      },
      {
        action: "navigate",
        target: "https://stats.g.doubleclick.net/r/collect",
      },
      {
        action: "click",
        target: "main article h1",
      },
      {
        action: "extract-markdown",
      },
    ]);

    expect(report.stepsExecuted).toBe(3);
    expect(report.braveBlockedCount).toBe(1);
    expect(report.transcript[0]?.sanitizedTarget).toBe(
      "https://servo.org/blog/",
    );
    expect(report.transcript[1]?.status).toBe("blocked");
  });
});
