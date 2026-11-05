import { expect, test } from "bun:test";
import { googleRuntime } from "../src/runtime.ts";

test("requires an explicit Google Cloud project and does not read credentials", () => {
  expect(() => googleRuntime({})).toThrow("GOOGLE_CLOUD_PROJECT");
  expect(googleRuntime({ GOOGLE_CLOUD_PROJECT: "yolo-web-test" }).project).toBe(
    "yolo-web-test",
  );
  expect(
    googleRuntime({ YOLO_WEB_GOOGLE_PROJECT: "research-project" }).project,
  ).toBe("research-project");
});
