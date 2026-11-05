import { expect, test } from "bun:test";
import { ServoWebDriver } from "./webdriver.ts";

test("ServoWebDriver drives a W3C WebDriver server", async () => {
  const seen: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      seen.push(`${request.method} ${url.pathname}`);
      if (request.method === "POST" && url.pathname === "/session")
        return Response.json({ value: { sessionId: "s1" } });
      if (url.pathname === "/session/s1/title")
        return Response.json({ value: "Example Domain" });
      if (url.pathname === "/session/s1/execute/sync")
        return Response.json({ value: "Servo/0.7.0" });
      if (url.pathname === "/session/s1/url" && request.method === "POST")
        return Response.json({ value: null });
      if (request.method === "DELETE") return Response.json({ value: null });
      return Response.json(
        { value: { error: "unknown command", message: url.pathname } },
        { status: 404 },
      );
    },
  });
  const driver = await ServoWebDriver.connect({
    endpoint: `http://127.0.0.1:${server.port}`,
  });
  await driver.navigate("https://example.com/");
  expect(await driver.title()).toBe("Example Domain");
  expect(await driver.execute("return navigator.userAgent")).toBe(
    "Servo/0.7.0",
  );
  await expect(driver.pageSource()).rejects.toThrow("unknown command");
  await driver.close();
  await expect(driver.title()).rejects.toThrow("closed");
  expect(seen).toContain("DELETE /session/s1");
  void server.stop(true);
});
