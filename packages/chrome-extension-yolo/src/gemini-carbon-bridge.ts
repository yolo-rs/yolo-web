// SPDX-License-Identifier: Apache-2.0
/**
 * Unified Single-Owner Chrome Extension Bridge for YOLO, Aphrody, Gemini Web App,
 * Antigravity CLI (`agy`), Carbon Gateway (`http://127.0.0.1:4040`), Voicebox HD
 * Voice-to-Voice, OpenPets/Mochi 2D/3D Companion, Chrome Built-in AI, and
 * Keyless Google AI Ultra Session Sync.
 */

export interface DomainOwnershipEntry {
  readonly id:
    | "aphrody"
    | "gemini-web"
    | "aistudio"
    | "antigravity"
    | "carbon-gateway";
  readonly origin: string;
  readonly capabilities: readonly string[];
}

export const YOLO_EXTENSION_DOMAINS: readonly DomainOwnershipEntry[] = [
  {
    id: "aphrody",
    origin: "https://aphrody.com",
    capabilities: [
      "default-search",
      "homepage",
      "carbon-newtab",
      "hct-brand-themes",
      "opensearch-suggestions",
    ],
  },
  {
    id: "gemini-web",
    origin: "https://gemini.google.com",
    capabilities: [
      "stream-generate-bridge",
      "cookie-vault-sync",
      "webmcp-agy-tunnel",
      "duplex-voice-orb",
      "openpets-mochi-overlay",
      "shared-web-memory",
    ],
  },
  {
    id: "aistudio",
    origin: "https://aistudio.google.com",
    capabilities: ["webmcp-agy-tunnel", "prompt-export", "theme-sync"],
  },
  {
    id: "antigravity",
    origin: "https://antigravity.google.com",
    capabilities: [
      "agy-cli-session-fusion",
      "token-budget-sync",
      "mcp-skill-forwarding",
    ],
  },
  {
    id: "carbon-gateway",
    origin: "http://127.0.0.1:4040",
    capabilities: [
      "openai-v1-chat-completions",
      "mcp-jsonrpc-server",
      "voicebox-6-hd-voices",
      "gemma4-uncensored-local",
      "openpets-mochi-3d-glb",
      "yolo-re-google-matrix",
    ],
  },
] as const;

export const GEMINI_HD_VOICES = [
  "Aoede",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Orion",
] as const;

export type GeminiHdVoice = (typeof GEMINI_HD_VOICES)[number];

export type PetCharacterId = "gemini-sparkle" | "hoodie-cat" | "mochi";

export interface PetCustomizePayload {
  character?: PetCharacterId;
  reaction?:
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "coding"
    | "happy"
    | "celebrate"
    | "sleep";
  speechText?: string;
  customStyle?: {
    customName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    scale?: number;
    accessory?:
      | "crown"
      | "headphones"
      | "sunglasses"
      | "wizard-hat"
      | "halo"
      | "bowtie"
      | "none";
    is3dMode?: boolean;
  };
}

export interface GeminiCookieSyncPayload {
  psid: string;
  psidts?: string;
  sapisid?: string;
  sapisidHash?: string;
  snlm0e?: string;
  cfb2h?: string;
  rawCookieHeader?: string;
}

export interface AgyMcpTunnelRequest {
  tool: string;
  arguments?: Record<string, unknown>;
  skill?: string;
  syncMemory?: boolean;
}

/**
 * Computes the Google `SAPISIDHASH` authorization token using Web Crypto SHA-1:
 * `SAPISIDHASH <unix_ts>_<sha1(unix_ts + " " + sapisid + " " + origin)>`
 */
export async function computeSapisidHash(
  sapisid: string,
  origin = "https://gemini.google.com",
  timestampSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const input = `${timestampSec} ${sapisid} ${origin}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `SAPISIDHASH ${timestampSec}_${hex}`;
}

/**
 * Client for communicating with the local Carbon & Antigravity 2.0 Unified Gateway
 * (`http://127.0.0.1:4040`) from the YOLO-Web Chrome Extension.
 */
export class GeminiCarbonBridge {
  readonly gatewayUrl: string;

  constructor(gatewayUrl = "http://127.0.0.1:4040") {
    this.gatewayUrl = gatewayUrl.replace(/\/+$/, "");
  }

  async health(): Promise<{
    ok: boolean;
    service?: string;
    version?: string;
    authenticated?: boolean;
  }> {
    try {
      const res = await fetch(`${this.gatewayUrl}/health`);
      if (!res.ok) return { ok: false };
      return (await res.json()) as {
        ok: boolean;
        service?: string;
        version?: string;
        authenticated?: boolean;
      };
    } catch {
      return { ok: false };
    }
  }

  async syncCookies(
    payload: GeminiCookieSyncPayload,
  ): Promise<{ ok: boolean; cookieCount?: number }> {
    const sapisidHash =
      payload.sapisidHash ??
      (payload.sapisid
        ? await computeSapisidHash(payload.sapisid)
        : undefined);
    const res = await fetch(`${this.gatewayUrl}/api/cookies/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, sapisidHash }),
    });
    return (await res.json()) as { ok: boolean; cookieCount?: number };
  }

  async customizePet(
    payload: PetCustomizePayload,
  ): Promise<{ ok: boolean; state?: Record<string, unknown> }> {
    const res = await fetch(`${this.gatewayUrl}/api/pet/customize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as {
      ok: boolean;
      state?: Record<string, unknown>;
    };
  }

  async synthesizeVoice(options: {
    text: string;
    voice?: GeminiHdVoice;
    uncensoredGemma4?: boolean;
  }): Promise<{
    ok: boolean;
    voice: string;
    spectrum32?: number[];
    rms?: number;
  }> {
    const res = await fetch(`${this.gatewayUrl}/api/voicebox/synthesize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: options.text,
        voice: options.voice ?? "Aoede",
        uncensoredGemma4: options.uncensoredGemma4 ?? false,
      }),
    });
    return (await res.json()) as {
      ok: boolean;
      voice: string;
      spectrum32?: number[];
      rms?: number;
    };
  }

  async invokeAgyTunnel(
    request: AgyMcpTunnelRequest,
  ): Promise<{ ok: boolean; result?: unknown }> {
    const res = await fetch(`${this.gatewayUrl}/api/tunnel/agy-mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    return (await res.json()) as { ok: boolean; result?: unknown };
  }
}
