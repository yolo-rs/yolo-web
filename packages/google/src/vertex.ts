import { adcCredentialProvider } from "./adc.ts";
import {
  googleAuthStatus,
  googleGenerate,
  googleGenerateStream,
} from "./auth.ts";
import { googleRuntime, type GoogleRuntime } from "./runtime.ts";

export interface GoogleGeminiRequest {
  prompt: string;
  signal?: AbortSignal;
  model?: string;
}

export interface GoogleGeminiClient {
  complete(request: GoogleGeminiRequest): Promise<string>;
  stream(request: GoogleGeminiRequest): ReadableStream<string>;
}

export interface GoogleGeminiTransport {
  fetch?: typeof fetch;
  credentialProvider?: (signal?: AbortSignal) => Promise<string>;
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/** Vertex AI `generateContent` endpoint for a publisher model; `global` uses the location-less host. */
export function vertexGenerateContentUrl(
  runtime: Pick<GoogleRuntime, "project" | "location">,
  model: string,
): string {
  const host =
    runtime.location === "global"
      ? "aiplatform.googleapis.com"
      : `${runtime.location}-aiplatform.googleapis.com`;
  const path = `v1/projects/${encodeURIComponent(runtime.project)}/locations/${encodeURIComponent(runtime.location)}`;
  return `https://${host}/${path}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
}

/** Create an ADC-backed Vertex Gemini client from the shared runtime contract. */
export function createGoogleGeminiClient(
  runtime: GoogleRuntime = googleRuntime(),
  transport: GoogleGeminiTransport = {},
): GoogleGeminiClient {
  const doFetch = transport.fetch ?? fetch;
  const token = transport.credentialProvider ?? adcCredentialProvider();

  return {
    async complete({ prompt, signal, model = "gemini-2.5-flash" }) {
      if (signal?.aborted)
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const nativeAuth =
        Bun.env.APHRODY_GOOGLE_AUTH === "antigravity" ||
        (!Bun.env.APHRODY_GOOGLE_AUTH &&
          (await googleAuthStatus().then(
            () => true,
            () => false,
          )));
      if (nativeAuth) {
        const result = await googleGenerate(prompt, model);
        const content = (
          result as GenerateContentResponse
        ).candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("");
        return content ?? "";
      }
      const response = await doFetch(vertexGenerateContentUrl(runtime, model), {
        method: "POST",
        headers: {
          authorization: `Bearer ${await token(signal)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
        signal,
      });
      if (!response.ok) {
        throw new Error(
          `Vertex AI generateContent failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
        );
      }
      const body = (await response.json()) as GenerateContentResponse;
      return (
        body.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? ""
      );
    },
    stream({ prompt, signal, model = "gemini-2.5-flash" }) {
      if (signal?.aborted)
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      return googleGenerateStream(prompt, model, signal);
    },
  };
}
