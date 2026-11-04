import { expect, test } from "bun:test";
import { createGoogleGeminiClient } from "../src/vertex.ts";

test("creates a client from explicit YOLO-Web Google runtime settings", () => {
  const client = createGoogleGeminiClient({
    project: "yolo-web-test",
    location: "us-central1",
    home: "~/.yolo-web",
    auth: "application-default-credentials",
  });
  expect(typeof client.complete).toBe("function");
});
