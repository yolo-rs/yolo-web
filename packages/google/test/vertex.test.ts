import { afterEach, expect, test } from "bun:test";
import {
  createGoogleGeminiClient,
  vertexGenerateContentUrl,
} from "../src/vertex.ts";

const runtime = {
  project: "yolo-web-test",
  location: "us-central1",
  home: "~/.yolo-web",
  auth: "application-default-credentials",
} as const;

const saved = Bun.env.APHRODY_GOOGLE_AUTH;
afterEach(() => {
  if (saved === undefined) delete Bun.env.APHRODY_GOOGLE_AUTH;
  else Bun.env.APHRODY_GOOGLE_AUTH = saved;
});

test("creates a client from explicit YOLO-Web Google runtime settings", () => {
  const client = createGoogleGeminiClient({ ...runtime });
  expect(typeof client.complete).toBe("function");
});

test("builds regional and global Vertex endpoints", () => {
  expect(vertexGenerateContentUrl(runtime, "gemini-2.5-flash")).toBe(
    "https://us-central1-aiplatform.googleapis.com/v1/projects/yolo-web-test/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent",
  );
  expect(
    vertexGenerateContentUrl({ ...runtime, location: "global" }, "m"),
  ).toStartWith("https://aiplatform.googleapis.com/v1/");
});

test("ADC path posts generateContent with a bearer token and returns the text", async () => {
  Bun.env.APHRODY_GOOGLE_AUTH = "adc";
  const seen: { url: string; init: RequestInit }[] = [];
  const client = createGoogleGeminiClient(
    { ...runtime },
    {
      credentialProvider: async () => "tok",
      fetch: (async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return Response.json({
          candidates: [
            { content: { parts: [{ text: "he" }, { text: "llo" }] } },
          ],
        });
      }) as unknown as typeof fetch,
    },
  );
  expect(await client.complete({ prompt: "hi", model: "gemini-x" })).toBe(
    "hello",
  );
  expect(seen[0]!.url).toContain("/models/gemini-x:generateContent");
  expect((seen[0]!.init.headers as Record<string, string>).authorization).toBe(
    "Bearer tok",
  );
  expect(JSON.parse(String(seen[0]!.init.body))).toEqual({
    contents: [{ role: "user", parts: [{ text: "hi" }] }],
  });
});

test("ADC path surfaces HTTP errors", async () => {
  Bun.env.APHRODY_GOOGLE_AUTH = "adc";
  const client = createGoogleGeminiClient(
    { ...runtime },
    {
      credentialProvider: async () => "t",
      fetch: (async () =>
        new Response("denied", { status: 403 })) as unknown as typeof fetch,
    },
  );
  await expect(client.complete({ prompt: "x" })).rejects.toThrow(
    "failed (403): denied",
  );
});
