// SPDX-License-Identifier: Apache-2.0
/**
 * @yolo-web/web-crawler — Consolidated Network Mapper, Cookie & WIZ Token Engine,
 * Obscura + Brave + Servo + Agent Browser/Desktop Inventory, and 5-Registry Indexer
 * (GitHub, npm, crates.io, PyPI, Go pkg.go.dev).
 */

export interface RustEnginePillarInventory {
  obscuraCrates: Array<{ name: string; path: string; capability: string }>;
  braveCrates: Array<{ name: string; path: string; capability: string }>;
  servoCratesCount: number;
  denoV8CratesCount: number;
  agentBrowserAndDesktop: Array<{
    component: string;
    protocol: string;
    capability: string;
  }>;
}

export const YOLO_WEB_ENGINE_INVENTORY: RustEnginePillarInventory = {
  obscuraCrates: [
    {
      name: "obscura",
      path: "crates/obscura",
      capability: "Unified headless browser facade & stealth orchestration",
    },
    {
      name: "obscura-browser",
      path: "crates/obscura-browser",
      capability: "Page lifecycle, navigation, tabs, and cookie jar state",
    },
    {
      name: "obscura-cdp",
      path: "crates/obscura-cdp",
      capability:
        "Chrome DevTools Protocol (CDP) WebSocket multiplexer & session flattening",
    },
    {
      name: "obscura-cli",
      path: "crates/obscura-cli",
      capability: "Native Rust CLI for headless rendering & snapshot capture",
    },
    {
      name: "obscura-dom",
      path: "crates/obscura-dom",
      capability:
        "High-speed DOM tree arena, Shadow DOM traversal & interactive element ref (e1) tagging",
    },
    {
      name: "obscura-js",
      path: "crates/obscura-js",
      capability:
        "Isolated Chromium V8 runtime bridge with panic=unwind safety",
    },
    {
      name: "obscura-mcp",
      path: "crates/obscura-mcp",
      capability:
        "Native Rust Model Context Protocol server for browser automation",
    },
    {
      name: "obscura-net",
      path: "crates/obscura-net",
      capability:
        "HTTP/2 & TLS client with cookie rotation, header ordering & proxy routing",
    },
    {
      name: "obscura-render",
      path: "crates/obscura-render",
      capability:
        "Taffy layout + Tiny-Skia rasterization + PDF/PNG visual diffing",
    },
    {
      name: "obscura-ssrf",
      path: "crates/obscura-ssrf",
      capability:
        "Zero-trust SSRF guard blocking loopback/RFC1918/link-local targets",
    },
  ],
  braveCrates: [
    {
      name: "brave-adblock",
      path: "crates/brave-adblock",
      capability:
        "EasyList / EasyPrivacy network filter engine & cosmetic scriptlet injection",
    },
    {
      name: "brave-kuchikiki",
      path: "crates/brave-kuchikiki",
      capability:
        "HTML5 DOM tree manipulation & CSS selector matching over html5ever",
    },
    {
      name: "brave-search-cli",
      path: "crates/brave-search-cli",
      capability: "Independent Brave Web Search & LLM RAG context extraction",
    },
    {
      name: "brave-star",
      path: "crates/brave-star",
      capability:
        "STAR (Threshold Aggregation for Privacy-Preserving Telemetry, ADSS, PPOPRF, Shamir Sharks)",
    },
    {
      name: "brave-bot",
      path: "crates/brave-bot",
      capability:
        "Automated security triage, tracker stripping & CookieCrumbler consent blocking",
    },
  ],
  servoCratesCount: 35,
  denoV8CratesCount: 8,
  agentBrowserAndDesktop: [
    {
      component: "crates/agent-browser (yolo-web binary)",
      protocol: "CDP WebSocket + Obscura DOM Snapshot",
      capability:
        "Autonomous browser navigation, form filling, Passkey/2FA flow orchestration",
    },
    {
      component: "packages/obscura-chrome",
      protocol: "Chrome DevTools Protocol (Target.attachToTarget flatten:true)",
      capability:
        "Deep Shadow DOM walker, chrome:// WebUI crawler & active profile cookie sync",
    },
    {
      component: "yolo-desktop MCP",
      protocol: "Win32 UI Automation / Desktop Capturer / Clipboard",
      capability:
        "Native OS window focus, QR code screen capture, Speak-to-Window & hardware security key prompt handling",
    },
  ],
};

export interface DomainStackMapEntry {
  domain: string;
  category:
    | "google_core"
    | "ai_inference"
    | "identity_auth"
    | "design_system"
    | "aphrody_sovereign";
  endpoints: string[];
  webUiStack: string[];
  backendStack: string[];
  authAndCookies: string[];
}

export const YOLO_WEB_GOOGLE_NETWORK_MAP: DomainStackMapEntry[] = [
  {
    domain: "gemini.google.com",
    category: "ai_inference",
    endpoints: [
      "https://gemini.google.com/app",
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
      "https://gemini.google.com/_/BardChatUi/data/batchexecute",
      "https://gemini.google.com/saved-info",
      "https://gemini.google.com/gems/view",
      "https://gemini.google.com/extensions",
      "https://gemini.google.com/canvas",
    ],
    webUiStack: [
      "Angular / Wiz Closure Signals",
      "Material 3 Expressive HCT/CAM16 Dark Surfaces",
      "Google Sans / Google Sans Mono",
    ],
    backendStack: [
      "Google Boq (boq_assistant-bard-web-server)",
      "Pathways / TPU v6e Sparse MoE Router",
      "BardFrontendService gRPC-Web StreamGenerate",
    ],
    authAndCookies: [
      "__Secure-1PSID",
      "__Secure-1PSIDTS (Rotated every 540s via RotateCookies)",
      "__Secure-1PSIDCC",
      "SNlM0e (WIZ_global_data XSRF at token)",
    ],
  },
  {
    domain: "accounts.google.com",
    category: "identity_auth",
    endpoints: [
      "https://accounts.google.com/RotateCookies",
      "https://accounts.google.com/o/oauth2/v2/auth",
      "https://oauth2.googleapis.com/token",
      "https://accounts.google.com/signin/v2/challenge/totp",
      "https://accounts.google.com/signin/v2/challenge/pk",
    ],
    webUiStack: [
      "Google Identity Services (GIS)",
      "WebAuthn navigator.credentials.get / create (Passkeys)",
      "otpauth://totp QR Enrollment UI",
    ],
    backendStack: [
      "Gaia Identity Authority",
      "FIDO2 / WebAuthn Relying Party (rpId: google.com)",
      "RFC 6238 TOTP & Titan Security Key Verifier",
    ],
    authAndCookies: [
      "SID / HSID / SSID / APISID / SAPISID",
      "__Host-GAPS",
      "LSID",
      "Passkey Resident Credential + 2FA TOTP",
    ],
  },
  {
    domain: "cloud.google.com / vertex-ai (europe-west9 Paris)",
    category: "ai_inference",
    endpoints: [
      "https://europe-west9-aiplatform.googleapis.com/v1/projects/carbon-intelligence-2026/locations/europe-west9/publishers/google/models/gemini-4-argon:streamGenerateContent",
      "https://europe-west9-aiplatform.googleapis.com/v1/projects/carbon-intelligence-2026/locations/europe-west9/publishers/google/models/gemini-4-carbon:streamGenerateContent",
      "https://us-central1-aiplatform.googleapis.com/v1",
    ],
    webUiStack: [
      "Cloud Console Material 3",
      "Vertex AI Studio Prompt & Tunix Fine-Tuning Workbench",
    ],
    backendStack: [
      "Vertex AI Model Garden & Provisioned Throughput",
      "Cloud Run Gen2 (europe-west9 Paris Beta Hub)",
      "WireGuard 10.66.0.0/24 Multi-Region Mesh",
    ],
    authAndCookies: [
      "Application Default Credentials (ADC)",
      "OAuth2 Bearer Token (cloud-platform scope)",
      "Windows Credential Manager (advapi32 CredReadW)",
    ],
  },
  {
    domain: "design.google & www.google.com",
    category: "design_system",
    endpoints: [
      "https://design.google/",
      "https://design.google/library/evolving-google-identity",
      "https://www.google.com/search",
      "https://www.googleapis.com/customsearch/v1",
    ],
    webUiStack: [
      "4-Color Identity (#4285F4, #EA4335, #FBBC04, #34A853)",
      "Evolving 4-Stop Gradient (#4285F4 -> #9B72CB -> #D96570 -> #F4B400)",
      "Product Sans / Google Sans Geometric Lockup",
    ],
    backendStack: [
      "Google Web Server (GWS)",
      "Knowledge Graph & AI Overview Synthesizer",
      "Local SQLite FTS5 Public Index (@yolo-web/google)",
    ],
    authAndCookies: ["NID", "AEC", "SOCS"],
  },
  {
    domain: "aphrody.com (aphrody-yolo Sovereign Stack)",
    category: "aphrody_sovereign",
    endpoints: [
      "https://aphrody.com/search",
      "https://ai.aphrody.com/v1/chat/completions",
      "http://127.0.0.1:4040/v1/chat/completions",
      "http://127.0.0.1:4040/mcp",
    ],
    webUiStack: [
      "Rust RSX (Dioxus / GPUI / WGPU) & Bun TSX",
      "Servo Stylo CSS3 + Taffy Layout + Phosphor Vector Icons",
      "M3 Expressive HCT/CAM16 Aphrody Preset",
    ],
    backendStack: [
      "Upstream Bun v1.4.4+ AoT + Rust 2024 FFI (crates/carbon_ffi)",
      "SQLite WAL (bun:sqlite) + PostgreSQL (Bun.sql) + Redis (Bun.redis)",
      "AES-256-GCM Encrypted Vault (@yolo-web/auth)",
    ],
    authAndCookies: [
      "yolo_web_session (HMAC-SHA256 Owner Verified)",
      "WebAuthn Passkey (rpId: aphrody.com / localhost)",
      "Synced Chrome Profile: yohanpierre15@gmail.com -> aphrody-yolo",
    ],
  },
];

export type EcosystemRegistryType =
  "github" | "npm" | "crates.io" | "pypi" | "go";

export interface MultiRegistryPackageEntry {
  registry: EcosystemRegistryType;
  packageName: string;
  version: string;
  repositoryUrl: string;
  registryApiUrl: string;
  domainUseCase:
    | "browser_cdp_crawler"
    | "auth_passkey_totp_2fa"
    | "secure_db_postgres_sqlite_redis"
    | "gemini_vertex_ai_gateway";
  description: string;
}

/**
 * Verified 5-Registry (GitHub, npm, crates.io, PyPI, Go) Catalog for Browser Automation,
 * Cookie/Session Sync, Passkey/TOTP 2FA, Secure Databases, and Gemini/Vertex AI Gateways.
 */
export const YOLO_ECOSYSTEM_5_REGISTRY_CATALOG: MultiRegistryPackageEntry[] = [
  // 1. GitHub
  {
    registry: "github",
    packageName: "yolo-rs/yolo-web",
    version: "0.3.0",
    repositoryUrl: "https://github.com/yolo-rs/yolo-web",
    registryApiUrl: "https://api.github.com/repos/yolo-rs/yolo-web",
    domainUseCase: "browser_cdp_crawler",
    description:
      "Unified Rust + Upstream Bun v1.4.4 browser engine fusing Obscura, Brave Shields, Servo Stylo, and CDP",
  },
  {
    registry: "github",
    packageName: "HanaokaYuzu/Gemini-API",
    version: "1.12.0",
    repositoryUrl: "https://github.com/HanaokaYuzu/Gemini-API",
    registryApiUrl: "https://api.github.com/repos/HanaokaYuzu/Gemini-API",
    domainUseCase: "gemini_vertex_ai_gateway",
    description:
      "Reverse-engineered asynchronous Gemini Web App client supporting RotateCookies, SNlM0e, and Gems",
  },
  {
    registry: "github",
    packageName: "BerriAI/litellm",
    version: "1.65.0",
    repositoryUrl: "https://github.com/BerriAI/litellm",
    registryApiUrl: "https://api.github.com/repos/BerriAI/litellm",
    domainUseCase: "gemini_vertex_ai_gateway",
    description:
      "OpenAI-compatible proxy gateway routing to Vertex AI, Gemini, OpenRouter, and local models",
  },

  // 2. npm / Bun
  {
    registry: "npm",
    packageName: "@google/genai",
    version: "1.4.0",
    repositoryUrl: "https://github.com/googleapis/js-genai",
    registryApiUrl: "https://registry.npmjs.org/@google/genai",
    domainUseCase: "gemini_vertex_ai_gateway",
    description:
      "Official Google GenAI TypeScript/Bun SDK for Gemini and Vertex AI",
  },
  {
    registry: "npm",
    packageName: "@simplewebauthn/server",
    version: "13.1.0",
    repositoryUrl: "https://github.com/MasterKale/SimpleWebAuthn",
    registryApiUrl: "https://registry.npmjs.org/@simplewebauthn/server",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "FIDO2 / WebAuthn Passkey registration and assertion verification reference",
  },
  {
    registry: "npm",
    packageName: "otpauth",
    version: "9.3.6",
    repositoryUrl: "https://github.com/hectorm/otpauth",
    registryApiUrl: "https://registry.npmjs.org/otpauth",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "RFC 6238 TOTP & RFC 4226 HOTP Google Authenticator URI specification reference",
  },

  // 3. crates.io (Rust)
  {
    registry: "crates.io",
    packageName: "chromiumoxide",
    version: "0.7.0",
    repositoryUrl: "https://github.com/mattsse/chromiumoxide",
    registryApiUrl: "https://crates.io/api/v1/crates/chromiumoxide",
    domainUseCase: "browser_cdp_crawler",
    description:
      "Async Rust Chrome DevTools Protocol (CDP) driver superseded in yolo-web by crates/obscura-cdp",
  },
  {
    registry: "crates.io",
    packageName: "webauthn-rs",
    version: "0.5.1",
    repositoryUrl: "https://github.com/kanidm/webauthn-rs",
    registryApiUrl: "https://crates.io/api/v1/crates/webauthn-rs",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "Pure Rust WebAuthn / Passkey FIDO2 cryptographic relying party library",
  },
  {
    registry: "crates.io",
    packageName: "totp-rs",
    version: "5.7.0",
    repositoryUrl: "https://github.com/constantoine/totp-rs",
    registryApiUrl: "https://crates.io/api/v1/crates/totp-rs",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "RFC 6238 compliant TOTP generator and otpauth:// QR code builder in Rust",
  },
  {
    registry: "crates.io",
    packageName: "sqlx",
    version: "0.8.3",
    repositoryUrl: "https://github.com/launchbadge/sqlx",
    registryApiUrl: "https://crates.io/api/v1/crates/sqlx",
    domainUseCase: "secure_db_postgres_sqlite_redis",
    description:
      "Async pure-Rust SQL crate supporting PostgreSQL and SQLite with compile-time checked queries",
  },

  // 4. PyPI (Python uv)
  {
    registry: "pypi",
    packageName: "gemini-webapi",
    version: "1.12.0",
    repositoryUrl: "https://github.com/HanaokaYuzu/Gemini-API",
    registryApiUrl: "https://pypi.org/pypi/gemini-webapi/json",
    domainUseCase: "gemini_vertex_ai_gateway",
    description:
      "Async Python wrapper for Gemini Web App using __Secure-1PSID and RotateCookies",
  },
  {
    registry: "pypi",
    packageName: "google-genai",
    version: "1.5.0",
    repositoryUrl: "https://github.com/googleapis/python-genai",
    registryApiUrl: "https://pypi.org/pypi/google-genai/json",
    domainUseCase: "gemini_vertex_ai_gateway",
    description: "Official Google GenAI Python SDK for Gemini 4 and Vertex AI",
  },
  {
    registry: "pypi",
    packageName: "pyotp",
    version: "2.9.0",
    repositoryUrl: "https://github.com/pyauth/pyotp",
    registryApiUrl: "https://pypi.org/pypi/pyotp/json",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "Python RFC 6238 TOTP & RFC 4226 HOTP implementation for Google Authenticator",
  },

  // 5. Go (pkg.go.dev / proxy.golang.org)
  {
    registry: "go",
    packageName: "github.com/chromedp/chromedp",
    version: "v0.13.0",
    repositoryUrl: "https://github.com/chromedp/chromedp",
    registryApiUrl:
      "https://proxy.golang.org/github.com/chromedp/chromedp/@latest",
    domainUseCase: "browser_cdp_crawler",
    description:
      "Go Chrome DevTools Protocol driver for headless browser automation and cookie extraction",
  },
  {
    registry: "go",
    packageName: "github.com/go-webauthn/webauthn",
    version: "v0.12.1",
    repositoryUrl: "https://github.com/go-webauthn/webauthn",
    registryApiUrl:
      "https://proxy.golang.org/github.com/go-webauthn/webauthn/@latest",
    domainUseCase: "auth_passkey_totp_2fa",
    description: "Go FIDO2 / WebAuthn Passkey server library",
  },
  {
    registry: "go",
    packageName: "github.com/pquerna/otp",
    version: "v1.4.0",
    repositoryUrl: "https://github.com/pquerna/otp",
    registryApiUrl: "https://proxy.golang.org/github.com/pquerna/otp/@latest",
    domainUseCase: "auth_passkey_totp_2fa",
    description:
      "Go TOTP / HOTP Google Authenticator library supporting otpauth:// URLs",
  },
  {
    registry: "go",
    packageName: "google.golang.org/genai",
    version: "v1.2.0",
    repositoryUrl: "https://github.com/googleapis/go-genai",
    registryApiUrl: "https://proxy.golang.org/google.golang.org/genai/@latest",
    domainUseCase: "gemini_vertex_ai_gateway",
    description: "Official Google GenAI Go SDK for Gemini and Vertex AI",
  },
];

/**
 * Extract `SNlM0e` (XSRF `at` token), `cfb2h` (build label), and `FdrFJe` (`f.sid`)
 * from `WIZ_global_data` in `gemini.google.com` or `accounts.google.com`.
 */
export function extractGoogleWizTokens(html: string): {
  snlm0e: string | null;
  cfb2h: string | null;
  fdrFje: string | null;
} {
  const snlm0eMatch = /"SNlM0e"\s*:\s*"([^"]+)"/.exec(html);
  const cfb2hMatch = /"cfb2h"\s*:\s*"([^"]+)"/.exec(html);
  const fdrFjeMatch = /"FdrFJe"\s*:\s*"([^"]+)"/.exec(html);
  return {
    snlm0e: snlm0eMatch?.[1] ?? null,
    cfb2h: cfb2hMatch?.[1] ?? null,
    fdrFje: fdrFjeMatch?.[1] ?? null,
  };
}

/**
 * Query live metadata from npm, PyPI, crates.io, Go Proxy, or GitHub with deterministic fallback.
 */
export async function queryMultiRegistryPackage(
  registry: EcosystemRegistryType,
  packageName: string,
  timeoutMs = 5000,
): Promise<{
  registry: EcosystemRegistryType;
  packageName: string;
  latestVersion: string;
  sourceUrl: string;
  liveFetched: boolean;
}> {
  const fallback = YOLO_ECOSYSTEM_5_REGISTRY_CATALOG.find(
    (e) => e.registry === registry && e.packageName === packageName,
  );

  let url: string;
  if (registry === "npm") {
    url = `https://registry.npmjs.org/${packageName}/latest`;
  } else if (registry === "pypi") {
    url = `https://pypi.org/pypi/${packageName}/json`;
  } else if (registry === "crates.io") {
    url = `https://crates.io/api/v1/crates/${packageName}`;
  } else if (registry === "go") {
    url = `https://proxy.golang.org/${packageName}/@latest`;
  } else {
    url = `https://api.github.com/repos/${packageName}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "YOLO-Web-Registry-Indexer/0.3 (+https://aphrody.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      let version = fallback?.version ?? "latest";
      if (registry === "npm" && typeof data.version === "string") {
        version = data.version;
      } else if (
        registry === "pypi" &&
        data.info &&
        typeof (data.info as Record<string, unknown>).version === "string"
      ) {
        version = String((data.info as Record<string, unknown>).version);
      } else if (
        registry === "crates.io" &&
        data.crate &&
        typeof (data.crate as Record<string, unknown>).max_version === "string"
      ) {
        version = String((data.crate as Record<string, unknown>).max_version);
      } else if (registry === "go" && typeof data.Version === "string") {
        version = data.Version;
      } else if (
        registry === "github" &&
        typeof data.default_branch === "string"
      ) {
        version = `${data.default_branch} (${data.stargazers_count ?? 0} stars)`;
      }
      return {
        registry,
        packageName,
        latestVersion: version,
        sourceUrl: url,
        liveFetched: true,
      };
    }
  } catch {
    // Use verified catalog fallback when offline or rate-limited
  }

  return {
    registry,
    packageName,
    latestVersion: fallback?.version ?? "1.0.0",
    sourceUrl: fallback?.registryApiUrl ?? url,
    liveFetched: false,
  };
}
