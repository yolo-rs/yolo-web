/**
 * @yolo-web/brave-shields
 *
 * Pure Bun TypeScript implementation of:
 * 1. BraveShieldsEngine: Adblock & tracker filter rule parser/matcher compatible with
 *    `brave/adblock-rust`, `brave/adblock-lists`, `brave/adblock-resources`, and
 *    `brave/cookiecrumbler` (ABP/uBlock syntax: `||example.com^`, `$third-party`,
 *    `$script,image,xmlhttprequest`, cosmetic `##.ad-banner`, exception `@@||...`,
 *    and cookie-consent notice blocking).
 * 2. BraveFingerprintProtection: Stealth & anti-fingerprinting shield profiles
 *    (Canvas/WebGL/AudioContext farbling, referrer trimming, GPC & DNT headers,
 *    and tracker query parameter stripping like `utm_*`, `fbclid`, `gclid`, `mc_eid`, `msclkid`).
 * 3. BraveSearchMcpBridge: Pure Bun client & MCP tool handler for Brave Web, Local,
 *    and News Search (`brave_web_search`, `brave_local_search`, `brave_news_search`)
 *    consolidated from `brave/brave-search-mcp-server`.
 */

export type ResourceType =
  | "main_frame"
  | "sub_frame"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "object"
  | "xmlhttprequest"
  | "ping"
  | "csp_report"
  | "media"
  | "websocket"
  | "other";

export interface NetworkFilterRule {
  raw: string;
  isException: boolean;
  isDomainAnchored: boolean;
  pattern: string;
  regex: RegExp;
  thirdParty: boolean | null; // true = $third-party, false = $~third-party / $first-party, null = any
  resourceTypes: Set<ResourceType> | null;
  excludedResourceTypes: Set<ResourceType> | null;
  domains: Set<string> | null;
  excludedDomains: Set<string> | null;
  redirectResource: string | null;
  isImportant: boolean;
  category: "ads" | "trackers" | "cookie-consent" | "custom";
}

export interface CosmeticFilterRule {
  raw: string;
  isException: boolean; // #@#.selector
  domains: Set<string> | null; // null = global
  excludedDomains: Set<string> | null;
  selector: string;
  category: "ads" | "cookie-consent" | "custom";
}

export interface NetworkCheckRequest {
  url: string;
  sourceUrl?: string;
  resourceType?: ResourceType;
}

export interface NetworkCheckResult {
  matched: boolean;
  blocked: boolean;
  isException: boolean;
  matchedRule: string | null;
  redirectResource: string | null;
  category: "ads" | "trackers" | "cookie-consent" | "custom" | null;
}

const RESOURCE_TYPE_ALIASES: Record<string, ResourceType> = {
  script: "script",
  image: "image",
  img: "image",
  stylesheet: "stylesheet",
  css: "stylesheet",
  xmlhttprequest: "xmlhttprequest",
  xhr: "xmlhttprequest",
  subdocument: "sub_frame",
  sub_frame: "sub_frame",
  document: "main_frame",
  main_frame: "main_frame",
  font: "font",
  media: "media",
  websocket: "websocket",
  ping: "ping",
  beacon: "ping",
  object: "object",
  other: "other",
};

/**
 * Built-in default Brave Shields + CookieCrumbler rules for zero-config protection.
 */
export const DEFAULT_BRAVE_SHIELD_RULES: readonly string[] = [
  // Core Ad & Tracker Networks (adblock-lists)
  "||doubleclick.net^",
  "||googlesyndication.com^",
  "||google-analytics.com^",
  "||googletagmanager.com^$third-party",
  "||connect.facebook.net^$third-party",
  "||pixel.facebook.com^",
  "||analytics.tiktok.com^",
  "||ads-twitter.com^",
  "||bat.bing.com^",
  "||scorecardresearch.com^",
  "||quantserve.com^",
  "||criteo.com^$third-party",
  "||taboola.com^$third-party",
  "||outbrain.com^$third-party",
  "||hotjar.com^$script,xmlhttprequest",
  "||adservice.google.com^",
  // Cosmetic Ad Selectors
  "##.ad-banner",
  "##.adsbygoogle",
  '##[id^="google_ads_iframe_"]',
  "##.sponsored-content",
  "##div[data-ad-slot]",
];

/**
 * Built-in CookieCrumbler (brave/cookiecrumbler) consent notice blocking rules.
 */
export const DEFAULT_COOKIECRUMBLER_RULES: readonly string[] = [
  "||cdn.cookielaw.org^$third-party",
  "||consent.cookiebot.com^$third-party",
  "||consent.trustarc.com^$third-party",
  "||sdk.privacy-center.org^$third-party",
  "||cmp.quantcast.com^$third-party",
  "##?#onetrust-consent-sdk",
  "###onetrust-consent-sdk",
  "###onetrust-banner-sdk",
  "###CybotCookiebotDialog",
  "##.qc-cmp2-container",
  "##.cc-window.cc-banner",
  "###didomi-host",
  "##.osano-cm-window",
  '##[aria-label="cookieconsent"]',
];

/**
 * Extracts the registrable base domain (eTLD+1 approximation) for third-party checks.
 */
export function getBaseDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/\.$/, "");
  if (!clean || /^\d+\.\d+\.\d+\.\d+$/.test(clean) || clean.includes(":")) {
    return clean;
  }
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;
  // Common multi-part public suffixes
  const lastTwo = parts.slice(-2).join(".");
  const multiPartTlds = new Set([
    "co.uk",
    "org.uk",
    "gov.uk",
    "ac.uk",
    "com.au",
    "co.jp",
    "co.kr",
    "com.br",
    "co.in",
  ]);
  if (multiPartTlds.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export function isThirdPartyRequest(
  requestUrl: string,
  sourceUrl?: string,
): boolean {
  if (!sourceUrl) return false;
  try {
    const reqHost = new URL(requestUrl).hostname;
    const srcHost = new URL(sourceUrl).hostname;
    if (!reqHost || !srcHost) return false;
    return getBaseDomain(reqHost) !== getBaseDomain(srcHost);
  } catch {
    return false;
  }
}

export function domainMatches(hostname: string, targetDomain: string): boolean {
  const h = hostname.toLowerCase();
  const d = targetDomain.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Compiles an ABP/uBlock pattern into a JavaScript RegExp compatible with `adblock-rust`.
 */
export function compileAdblockPattern(
  pattern: string,
  isDomainAnchored: boolean,
): RegExp {
  let raw = pattern;
  let anchorStart = false;
  let anchorEnd = false;

  if (!isDomainAnchored && raw.startsWith("|")) {
    anchorStart = true;
    raw = raw.slice(1);
  }
  if (raw.endsWith("|")) {
    anchorEnd = true;
    raw = raw.slice(0, -1);
  }

  // Regex literal rule /.../
  if (
    !isDomainAnchored &&
    raw.startsWith("/") &&
    raw.endsWith("/") &&
    raw.length > 2
  ) {
    try {
      return new RegExp(raw.slice(1, -1), "i");
    } catch {
      // Fall through to standard escaping
    }
  }

  let escaped = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === "*") {
      escaped += ".*";
    } else if (ch === "^") {
      // ABP separator character: anything except alphanumeric, _, -, ., % or end of string
      escaped += "(?:[^a-zA-Z0-9_.%-]|$)";
    } else if ("+?^${}()|[]\\.".includes(ch)) {
      escaped += `\\${ch}`;
    } else {
      escaped += ch;
    }
  }

  if (isDomainAnchored) {
    return new RegExp(
      `^[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\/(?:[^/?#]*\\.)?${escaped}`,
      "i",
    );
  }
  const prefix = anchorStart ? "^" : "";
  const suffix = anchorEnd ? "$" : "";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i");
}

export interface BraveShieldsEngineOptions {
  loadDefaultRules?: boolean;
  enableCookieCrumbler?: boolean;
  customRules?: readonly string[];
}

export class BraveShieldsEngine {
  private readonly networkRules: NetworkFilterRule[] = [];
  private readonly exceptionRules: NetworkFilterRule[] = [];
  private readonly cosmeticRules: CosmeticFilterRule[] = [];
  private cookieCrumblerEnabled: boolean;

  constructor(options: BraveShieldsEngineOptions = {}) {
    this.cookieCrumblerEnabled = options.enableCookieCrumbler ?? true;
    if (options.loadDefaultRules ?? true) {
      this.addRules(DEFAULT_BRAVE_SHIELD_RULES, "ads");
    }
    if (this.cookieCrumblerEnabled) {
      this.addRules(DEFAULT_COOKIECRUMBLER_RULES, "cookie-consent");
    }
    if (options.customRules) {
      this.addRules(options.customRules, "custom");
    }
  }

  public setCookieCrumblerEnabled(enabled: boolean): void {
    this.cookieCrumblerEnabled = enabled;
  }

  public addRules(
    rules: readonly string[] | string,
    category: "ads" | "trackers" | "cookie-consent" | "custom" = "custom",
  ): number {
    const lines = typeof rules === "string" ? rules.split(/\r?\n/) : rules;
    let added = 0;
    for (const line of lines) {
      if (this.addRule(line, category)) {
        added++;
      }
    }
    return added;
  }

  public addRule(
    rawLine: string,
    category: "ads" | "trackers" | "cookie-consent" | "custom" = "custom",
  ): boolean {
    const line = rawLine.trim();
    if (!line || line.startsWith("!") || line.startsWith("[Adblock")) {
      return false;
    }

    // Check for cosmetic filter (`##`, `#@#`, `#?#`)
    const cosmeticMatch = /^(.*?)(#@?#|#\?#)(.+)$/.exec(line);
    if (cosmeticMatch) {
      const domainPart = cosmeticMatch[1]!.trim();
      const marker = cosmeticMatch[2]!;
      const selector = cosmeticMatch[3]!.trim();
      if (!selector) return false;

      let domains: Set<string> | null = null;
      let excludedDomains: Set<string> | null = null;

      if (domainPart) {
        for (const d of domainPart.split(",")) {
          const clean = d.trim().toLowerCase();
          if (!clean) continue;
          if (clean.startsWith("~")) {
            excludedDomains ??= new Set();
            excludedDomains.add(clean.slice(1));
          } else {
            domains ??= new Set();
            domains.add(clean);
          }
        }
      }

      this.cosmeticRules.push({
        raw: line,
        isException: marker === "#@#",
        domains,
        excludedDomains,
        selector,
        category: category === "cookie-consent" ? "cookie-consent" : "ads",
      });
      return true;
    }

    // Network filter rule
    let working = line;
    let isException = false;
    if (working.startsWith("@@")) {
      isException = true;
      working = working.slice(2);
    }

    let optionsPart = "";
    const dollarIdx = working.lastIndexOf("$");
    if (dollarIdx !== -1 && !working.endsWith("/")) {
      optionsPart = working.slice(dollarIdx + 1);
      working = working.slice(0, dollarIdx);
    }

    let isDomainAnchored = false;
    if (working.startsWith("||")) {
      isDomainAnchored = true;
      working = working.slice(2);
    }

    let thirdParty: boolean | null = null;
    let resourceTypes: Set<ResourceType> | null = null;
    let excludedResourceTypes: Set<ResourceType> | null = null;
    let domains: Set<string> | null = null;
    let excludedDomains: Set<string> | null = null;
    let redirectResource: string | null = null;
    let isImportant = false;

    if (optionsPart) {
      for (const rawOpt of optionsPart.split(",")) {
        const opt = rawOpt.trim().toLowerCase();
        if (!opt) continue;

        if (opt === "third-party" || opt === "3p") {
          thirdParty = true;
        } else if (
          opt === "~third-party" ||
          opt === "first-party" ||
          opt === "1p" ||
          opt === "~3p"
        ) {
          thirdParty = false;
        } else if (opt === "important") {
          isImportant = true;
        } else if (opt.startsWith("domain=")) {
          const domList = opt.slice("domain=".length).split("|");
          for (const dom of domList) {
            const cleanDom = dom.trim();
            if (!cleanDom) continue;
            if (cleanDom.startsWith("~")) {
              excludedDomains ??= new Set();
              excludedDomains.add(cleanDom.slice(1));
            } else {
              domains ??= new Set();
              domains.add(cleanDom);
            }
          }
        } else if (
          opt.startsWith("redirect=") ||
          opt.startsWith("redirect-rule=")
        ) {
          redirectResource = opt.split("=")[1] ?? null;
        } else if (opt.startsWith("~")) {
          const mapped = RESOURCE_TYPE_ALIASES[opt.slice(1)];
          if (mapped) {
            excludedResourceTypes ??= new Set();
            excludedResourceTypes.add(mapped);
          }
        } else {
          const mapped = RESOURCE_TYPE_ALIASES[opt];
          if (mapped) {
            resourceTypes ??= new Set();
            resourceTypes.add(mapped);
          }
        }
      }
    }

    const regex = compileAdblockPattern(working, isDomainAnchored);
    const rule: NetworkFilterRule = {
      raw: line,
      isException,
      isDomainAnchored,
      pattern: working,
      regex,
      thirdParty,
      resourceTypes,
      excludedResourceTypes,
      domains,
      excludedDomains,
      redirectResource,
      isImportant,
      category,
    };

    if (isException) {
      this.exceptionRules.push(rule);
    } else {
      this.networkRules.push(rule);
    }
    return true;
  }

  public checkNetworkRequest(request: NetworkCheckRequest): NetworkCheckResult {
    const { url, sourceUrl, resourceType = "other" } = request;
    const is3p = isThirdPartyRequest(url, sourceUrl);
    let sourceHostname = "";
    if (sourceUrl) {
      try {
        sourceHostname = new URL(sourceUrl).hostname.toLowerCase();
      } catch {
        sourceHostname = "";
      }
    }

    const matchesRule = (rule: NetworkFilterRule): boolean => {
      if (rule.category === "cookie-consent" && !this.cookieCrumblerEnabled) {
        return false;
      }
      if (rule.thirdParty !== null && rule.thirdParty !== is3p) {
        return false;
      }
      if (rule.resourceTypes && !rule.resourceTypes.has(resourceType)) {
        return false;
      }
      if (
        rule.excludedResourceTypes &&
        rule.excludedResourceTypes.has(resourceType)
      ) {
        return false;
      }
      if (rule.excludedDomains && sourceHostname) {
        for (const ex of rule.excludedDomains) {
          if (domainMatches(sourceHostname, ex)) return false;
        }
      }
      if (rule.domains) {
        if (!sourceHostname) return false;
        let matchedDomain = false;
        for (const d of rule.domains) {
          if (domainMatches(sourceHostname, d)) {
            matchedDomain = true;
            break;
          }
        }
        if (!matchedDomain) return false;
      }
      return rule.regex.test(url);
    };

    // 1. Check `$important` blocking rules first (override exceptions just like adblock-rust)
    for (const rule of this.networkRules) {
      if (rule.isImportant && matchesRule(rule)) {
        return {
          matched: true,
          blocked: true,
          isException: false,
          matchedRule: rule.raw,
          redirectResource: rule.redirectResource,
          category: rule.category,
        };
      }
    }

    // 2. Check exception rules (`@@`)
    for (const exRule of this.exceptionRules) {
      if (matchesRule(exRule)) {
        return {
          matched: true,
          blocked: false,
          isException: true,
          matchedRule: exRule.raw,
          redirectResource: null,
          category: exRule.category,
        };
      }
    }

    // 3. Check standard blocking rules
    for (const rule of this.networkRules) {
      if (!rule.isImportant && matchesRule(rule)) {
        return {
          matched: true,
          blocked: true,
          isException: false,
          matchedRule: rule.raw,
          redirectResource: rule.redirectResource,
          category: rule.category,
        };
      }
    }

    return {
      matched: false,
      blocked: false,
      isException: false,
      matchedRule: null,
      redirectResource: null,
      category: null,
    };
  }

  /**
   * Returns active CSS selectors to hide on the given hostname or URL.
   */
  public getCosmeticFiltersForUrl(urlOrHostname: string): string[] {
    let hostname = urlOrHostname.toLowerCase();
    if (hostname.includes("://")) {
      try {
        hostname = new URL(hostname).hostname.toLowerCase();
      } catch {
        // use raw
      }
    }

    const excludedSelectors = new Set<string>();
    for (const rule of this.cosmeticRules) {
      if (!rule.isException) continue;
      if (this.cosmeticRuleAppliesToHost(rule, hostname)) {
        excludedSelectors.add(rule.selector);
      }
    }

    const activeSelectors = new Set<string>();
    for (const rule of this.cosmeticRules) {
      if (rule.isException) continue;
      if (rule.category === "cookie-consent" && !this.cookieCrumblerEnabled) {
        continue;
      }
      if (excludedSelectors.has(rule.selector)) continue;
      if (this.cosmeticRuleAppliesToHost(rule, hostname)) {
        activeSelectors.add(rule.selector);
      }
    }

    return Array.from(activeSelectors);
  }

  public getCosmeticStylesheetForUrl(urlOrHostname: string): string {
    const selectors = this.getCosmeticFiltersForUrl(urlOrHostname);
    if (selectors.length === 0) return "";
    return `${selectors.join(", ")} { display: none !important; visibility: hidden !important; }`;
  }

  private cosmeticRuleAppliesToHost(
    rule: CosmeticFilterRule,
    hostname: string,
  ): boolean {
    if (rule.excludedDomains && hostname) {
      for (const ex of rule.excludedDomains) {
        if (domainMatches(hostname, ex)) return false;
      }
    }
    if (!rule.domains) {
      return true;
    }
    if (!hostname) return false;
    for (const d of rule.domains) {
      if (domainMatches(hostname, d)) return true;
    }
    return false;
  }

  public getStats(): {
    networkRuleCount: number;
    exceptionRuleCount: number;
    cosmeticRuleCount: number;
    cookieCrumblerEnabled: boolean;
  } {
    return {
      networkRuleCount: this.networkRules.length,
      exceptionRuleCount: this.exceptionRules.length,
      cosmeticRuleCount: this.cosmeticRules.length,
      cookieCrumblerEnabled: this.cookieCrumblerEnabled,
    };
  }
}

/**
 * Tracking query parameters stripped by Brave Shields (`brave-core` query filter list).
 */
export const TRACKING_QUERY_PARAMETERS: ReadonlySet<string> = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "ttclid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "_hsenc",
  "_hsmi",
  "hsCtaTracking",
  "igshid",
  "vero_id",
  "oly_enc_id",
  "oly_anon_id",
  "rb_clickid",
  "s_kwcid",
  "spm",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_reader",
  "utm_viz_id",
  "utm_pubreferrer",
  "utm_swu",
]);

export type ShieldLevel = "off" | "standard" | "strict";

export interface BraveFingerprintProfile {
  level: ShieldLevel;
  sessionSeed: number;
  farbleCanvas: boolean;
  farbleWebGL: boolean;
  farbleAudioContext: boolean;
  farbleHardwareConcurrency: boolean;
  spoofedHardwareConcurrency: number;
  spoofedDeviceMemory: number;
  trimCrossOriginReferrer: boolean;
  sendGlobalPrivacyControl: boolean;
  sendDoNotTrack: boolean;
  stripTrackingQueryParameters: boolean;
}

export class BraveFingerprintProtection {
  private readonly profile: BraveFingerprintProfile;

  constructor(level: ShieldLevel = "standard", sessionSeed = 0x517cc1b7) {
    this.profile = BraveFingerprintProtection.createProfile(level, sessionSeed);
  }

  public static createProfile(
    level: ShieldLevel = "standard",
    sessionSeed = 0x517cc1b7,
  ): BraveFingerprintProfile {
    if (level === "off") {
      return {
        level: "off",
        sessionSeed,
        farbleCanvas: false,
        farbleWebGL: false,
        farbleAudioContext: false,
        farbleHardwareConcurrency: false,
        spoofedHardwareConcurrency: 8,
        spoofedDeviceMemory: 8,
        trimCrossOriginReferrer: false,
        sendGlobalPrivacyControl: false,
        sendDoNotTrack: false,
        stripTrackingQueryParameters: false,
      };
    }

    const isStrict = level === "strict";
    const coreChoices = [2, 4, 8] as const;
    const spoofedCores = isStrict
      ? 2
      : coreChoices[Math.abs(sessionSeed) % coreChoices.length]!;

    return {
      level,
      sessionSeed,
      farbleCanvas: true,
      farbleWebGL: true,
      farbleAudioContext: true,
      farbleHardwareConcurrency: true,
      spoofedHardwareConcurrency: spoofedCores,
      spoofedDeviceMemory: isStrict ? 4 : 8,
      trimCrossOriginReferrer: true,
      sendGlobalPrivacyControl: true,
      sendDoNotTrack: true,
      stripTrackingQueryParameters: true,
    };
  }

  public getProfile(): BraveFingerprintProfile {
    return { ...this.profile };
  }

  /**
   * Strips known ad-tech / cross-site tracking parameters (`utm_*`, `fbclid`, `gclid`, etc.)
   * while preserving legitimate functional query parameters.
   */
  public cleanUrl(rawUrl: string): { url: string; strippedParams: string[] } {
    if (!this.profile.stripTrackingQueryParameters) {
      return { url: rawUrl, strippedParams: [] };
    }
    try {
      const parsed = new URL(rawUrl);
      const strippedParams: string[] = [];
      const keys = Array.from(parsed.searchParams.keys());
      for (const key of keys) {
        const lower = key.toLowerCase();
        if (TRACKING_QUERY_PARAMETERS.has(lower) || lower.startsWith("utm_")) {
          parsed.searchParams.delete(key);
          strippedParams.push(key);
        }
      }
      return { url: parsed.toString(), strippedParams };
    } catch {
      return { url: rawUrl, strippedParams: [] };
    }
  }

  /**
   * Applies Brave Shields privacy headers (`Sec-GPC: 1`, `DNT: 1`, and cross-origin referrer trimming).
   */
  public sanitizeHeaders(
    headers: Record<string, string>,
    requestUrl: string,
    referrerUrl?: string,
  ): Record<string, string> {
    const out: Record<string, string> = { ...headers };
    if (this.profile.sendGlobalPrivacyControl) {
      out["Sec-GPC"] = "1";
    }
    if (this.profile.sendDoNotTrack) {
      out["DNT"] = "1";
    }
    if (this.profile.trimCrossOriginReferrer && referrerUrl) {
      try {
        const reqOrigin = new URL(requestUrl);
        const refOrigin = new URL(referrerUrl);
        if (
          getBaseDomain(reqOrigin.hostname) !==
          getBaseDomain(refOrigin.hostname)
        ) {
          out["Referer"] = `${refOrigin.origin}/`;
        } else {
          out["Referer"] = referrerUrl;
        }
      } catch {
        delete out["Referer"];
      }
    }
    return out;
  }

  /**
   * Deterministic per-domain + per-session noise perturbation ("farbling") for Canvas/Audio fingerprinting.
   */
  public computeDomainFarbleOffset(domain: string, index: number): number {
    if (!this.profile.farbleCanvas && !this.profile.farbleAudioContext) {
      return 0;
    }
    let hash = this.profile.sessionSeed ^ index;
    for (let i = 0; i < domain.length; i++) {
      hash = Math.imul(hash ^ domain.charCodeAt(i), 0x01000193);
    }
    return ((hash >>> 0) % 3) - 1; // -1, 0, or +1 LSB perturbation
  }
}

/**
 * Pure Bun implementation of Brave Search MCP Bridge (`brave/brave-search-mcp-server`).
 * Supports `brave_web_search`, `brave_local_search`, and `brave_news_search` via native `fetch`.
 */
export interface BraveWebSearchArgs {
  query: string;
  count?: number;
  offset?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
  country?: string;
}

export interface BraveLocalSearchArgs {
  query: string;
  count?: number;
}

export interface BraveNewsSearchArgs {
  query: string;
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
}

export interface BraveSearchResultItem {
  title: string;
  url: string;
  description: string;
  age?: string;
  extraSnippets?: string[];
}

export interface BraveMcpToolDefinition {
  name: "brave_web_search" | "brave_local_search" | "brave_news_search";
  description: string;
  inputSchema: Record<string, unknown>;
}

export class BraveSearchMcpBridge {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.apiKey = options?.apiKey ?? Bun.env.BRAVE_API_KEY ?? "";
    this.baseUrl = options?.baseUrl ?? "https://api.search.brave.com/res/v1";
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  public getToolDefinitions(): BraveMcpToolDefinition[] {
    return [
      {
        name: "brave_web_search",
        description:
          "Performs a privacy-preserving web search using the Brave Search API for general queries, documentation, and real-time facts.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (max 400 chars, 50 words)",
            },
            count: {
              type: "number",
              description: "Number of results (1-20, default 10)",
            },
            offset: {
              type: "number",
              description: "Pagination offset (0-9, default 0)",
            },
            freshness: {
              type: "string",
              enum: ["pd", "pw", "pm", "py"],
              description: "Filter by freshness (past day, week, month, year)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "brave_local_search",
        description:
          "Searches for local businesses, places, restaurants, and points of interest using Brave Local Search API.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Local search query (e.g. 'coffee near Shibuya')",
            },
            count: {
              type: "number",
              description: "Number of results (1-20, default 5)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "brave_news_search",
        description:
          "Searches recent news articles using the Brave News Search API.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "News search query" },
            count: {
              type: "number",
              description: "Number of results (1-20, default 10)",
            },
            freshness: {
              type: "string",
              enum: ["pd", "pw", "pm", "py"],
              description: "Freshness filter",
            },
          },
          required: ["query"],
        },
      },
    ];
  }

  public async webSearch(
    args: BraveWebSearchArgs,
  ): Promise<BraveSearchResultItem[]> {
    const url = new URL(`${this.baseUrl}/web/search`);
    url.searchParams.set("q", args.query);
    url.searchParams.set(
      "count",
      String(Math.min(Math.max(args.count ?? 10, 1), 20)),
    );
    if (args.offset !== undefined)
      url.searchParams.set("offset", String(args.offset));
    if (args.freshness) url.searchParams.set("freshness", args.freshness);
    if (args.country) url.searchParams.set("country", args.country);

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Brave Web Search API error (${response.status}): ${await response.text()}`,
      );
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{
          title?: string;
          url?: string;
          description?: string;
          age?: string;
          extra_snippets?: string[];
        }>;
      };
    };

    return (data.web?.results ?? []).map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      description: item.description ?? "",
      age: item.age,
      extraSnippets: item.extra_snippets,
    }));
  }

  public async newsSearch(
    args: BraveNewsSearchArgs,
  ): Promise<BraveSearchResultItem[]> {
    const url = new URL(`${this.baseUrl}/news/search`);
    url.searchParams.set("q", args.query);
    url.searchParams.set(
      "count",
      String(Math.min(Math.max(args.count ?? 10, 1), 20)),
    );
    if (args.freshness) url.searchParams.set("freshness", args.freshness);

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Brave News Search API error (${response.status}): ${await response.text()}`,
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        age?: string;
      }>;
    };

    return (data.results ?? []).map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      description: item.description ?? "",
      age: item.age,
    }));
  }

  public async localSearch(
    args: BraveLocalSearchArgs,
  ): Promise<BraveSearchResultItem[]> {
    return this.webSearch({ query: args.query, count: args.count ?? 5 });
  }

  public async callMcpTool(
    toolName: "brave_web_search" | "brave_local_search" | "brave_news_search",
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const query = String(args.query ?? "");
    const count = typeof args.count === "number" ? args.count : undefined;
    let items: BraveSearchResultItem[];

    if (toolName === "brave_news_search") {
      items = await this.newsSearch({ query, count });
    } else if (toolName === "brave_local_search") {
      items = await this.localSearch({ query, count });
    } else {
      items = await this.webSearch({
        query,
        count,
        offset: typeof args.offset === "number" ? args.offset : undefined,
      });
    }

    const formatted = items
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`,
      )
      .join("\n\n");

    return {
      content: [{ type: "text", text: formatted || "No results found." }],
    };
  }
}
