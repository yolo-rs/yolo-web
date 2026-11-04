import { describe, expect, test } from "bun:test";
import {
  sanitizeUrlWithBraveShields,
  startHumanBrowserServer,
} from "./server.ts";

describe("@yolo-web/human-browser workbench", () => {
  test("Brave Shields URL sanitizer strips tracking parameters", () => {
    const result = sanitizeUrlWithBraveShields(
      "https://example.com/article?id=42&utm_source=newsletter&fbclid=IwAR123&gclid=abc",
    );
    expect(result.cleanUrl).toBe("https://example.com/article?id=42");
    expect(result.strippedParams).toEqual(["utm_source", "fbclid", "gclid"]);
  });

  test("Bun.serve workbench serves UI, status, and Brave-sanitized navigation", async () => {
    const workbench = startHumanBrowserServer({
      cdpPort: 9222,
      httpPort: 0,
      stealth: true,
      braveShields: true,
    });

    try {
      const baseUrl = `http://127.0.0.1:${workbench.server.port}`;

      const htmlRes = await fetch(`${baseUrl}/`);
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain("YOLO-WEB");
      expect(html).toContain("Brave Shields");

      const navRes = await fetch(`${baseUrl}/api/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://servo.org/?utm_campaign=launch&msclkid=999&page=1",
        }),
      });
      const navJson = (await navRes.json()) as {
        ok: boolean;
        navigatedUrl: string;
        braveShieldsStripped: string[];
      };
      expect(navJson.ok).toBe(true);
      expect(navJson.navigatedUrl).toBe("https://servo.org/?page=1");
      expect(navJson.braveShieldsStripped).toEqual(["utm_campaign", "msclkid"]);

      const statusRes = await fetch(`${baseUrl}/api/status`);
      const statusJson = (await statusRes.json()) as {
        strippedTrackerCount: number;
      };
      expect(statusJson.strippedTrackerCount).toBe(2);
    } finally {
      workbench.stop();
    }
  });
});
