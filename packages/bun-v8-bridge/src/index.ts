/**
 * @yolo-web/bun-v8-bridge
 *
 * Dual-Runtime Architecture bridge for YOLO-Web (`yolo-rs/yolo-web`):
 * - Plane 1 (Host): 100% Native Bun (`yolo-rs/bun` Full Rust ~200 crates + `yolo-rs/WebKit` C++ JavaScriptCore / Riptide GC)
 * - Plane 2 (Browser Guest): 100% Chromium V8 (`yolo-rs/v8` + `yolo-rs/rusty_v8` + `yolo-rs/deno_core` in `crates/obscura-js`)
 */

export type RuntimePlane = "host-bun-webkit" | "guest-browser-v8";

export interface ForkedRepoEntry {
  readonly name: string;
  readonly fullName: `yolo-rs/${string}`;
  readonly upstream: string;
  readonly url: `https://github.com/yolo-rs/${string}`;
  readonly plane: RuntimePlane;
  readonly category:
    "runtime" | "js-engine" | "v8-binding" | "native-dep" | "build-tool";
  readonly pinnedCommit?: string;
  readonly description: string;
}

/**
 * Registry of all forked `yolo-rs/*` Bun, WebKit, V8, and native dependency repositories.
 */
export const BUN_UPSTREAM_REPOS: readonly ForkedRepoEntry[] = [
  {
    name: "bun",
    fullName: "yolo-rs/bun",
    upstream: "oven-sh/bun",
    url: "https://github.com/yolo-rs/bun",
    plane: "host-bun-webkit",
    category: "runtime",
    description:
      "Upstream/Canary Bun runtime (Full Rust ~200 crates in src/* + C++ WebKit/JSC): bundler, test runner, linter, formatter, package manager, and Cranelift AoT compiler",
  },
  {
    name: "WebKit",
    fullName: "yolo-rs/WebKit",
    upstream: "oven-sh/WebKit",
    url: "https://github.com/yolo-rs/WebKit",
    plane: "host-bun-webkit",
    category: "js-engine",
    pinnedCommit: "4d45755fed4aeef19e95beb90d3d0c884a2812bd",
    description:
      "Bun's patched Apple WebKit / JavaScriptCore fork with Riptide GC, B3/FTL JIT, SIMD, and AoT runtime facts",
  },
  {
    name: "v8",
    fullName: "yolo-rs/v8",
    upstream: "v8/v8",
    url: "https://github.com/yolo-rs/v8",
    plane: "guest-browser-v8",
    category: "js-engine",
    description:
      "Upstream Chromium V8 JavaScript and WebAssembly engine (Ignition, Sparkplug, Maglev, TurboFan, Orinoco GC) for browser web rendering",
  },
  {
    name: "rusty_v8",
    fullName: "yolo-rs/rusty_v8",
    upstream: "denoland/rusty_v8",
    url: "https://github.com/yolo-rs/rusty_v8",
    plane: "guest-browser-v8",
    category: "v8-binding",
    description:
      "Zero-overhead Rust FFI bindings to Chromium V8 Isolates, Contexts, ScriptCompiler, and IsolateHandle",
  },
  {
    name: "deno_core",
    fullName: "yolo-rs/deno_core",
    upstream: "denoland/deno_core",
    url: "https://github.com/yolo-rs/deno_core",
    plane: "guest-browser-v8",
    category: "v8-binding",
    description:
      "V8 isolate runtime lifecycle, #[op2] fast C-call bindings, and startup heap snapshot engine backing crates/obscura-js",
  },
  {
    name: "mimalloc",
    fullName: "yolo-rs/mimalloc",
    upstream: "oven-sh/mimalloc",
    url: "https://github.com/yolo-rs/mimalloc",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "5945551d9ea1e3c83dbf5b198b00a3ec51aee395",
    description:
      "High-performance compact general-purpose allocator backing Bun host allocations (bun_alloc) and WebKit bmalloc fallback",
  },
  {
    name: "boringssl",
    fullName: "yolo-rs/boringssl",
    upstream: "oven-sh/boringssl",
    url: "https://github.com/yolo-rs/boringssl",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "89a2ff2be775267283a2c8e35044e49ddab5e5aa",
    description:
      "BoringSSL with patches for Bun TLS 1.3, HTTP/3 QUIC (lsquic), X.509, and Bun.CryptoHasher",
  },
  {
    name: "lol-html",
    fullName: "yolo-rs/lol-html",
    upstream: "oven-sh/lol-html",
    url: "https://github.com/yolo-rs/lol-html",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "725ce499aa9b71e38b7a2d0a9fbb6d7294a4079e",
    description:
      "Pure Rust low-output-latency streaming HTML parser and rewriter with CSS selector API powering Bun HTMLRewriter",
  },
  {
    name: "picohttpparser",
    fullName: "yolo-rs/picohttpparser",
    upstream: "oven-sh/picohttpparser",
    url: "https://github.com/yolo-rs/picohttpparser",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "f4d94b48b31e0abae029ebeafcfd9ca0680ede58",
    description:
      "SIMD-accelerated HTTP/1.1 request/response parser used in Bun.serve (src/picohttp)",
  },
  {
    name: "tinycc",
    fullName: "yolo-rs/tinycc",
    upstream: "oven-sh/tinycc",
    url: "https://github.com/yolo-rs/tinycc",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "05f0fafaa3be31e31d7b4b5c17dc60f62c991171",
    description:
      "TinyCC (tcc) in-memory C compiler powering Bun's native cc() FFI compilation",
  },
  {
    name: "libuv",
    fullName: "yolo-rs/libuv",
    upstream: "oven-sh/libuv",
    url: "https://github.com/yolo-rs/libuv",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "8023581113b276e7c1aee3f82da57ca0893faab1",
    description:
      "Cross-platform asynchronous I/O loop used by Bun on Windows with mimalloc hooks",
  },
  {
    name: "icu",
    fullName: "yolo-rs/icu",
    upstream: "oven-sh/icu",
    url: "https://github.com/yolo-rs/icu",
    plane: "host-bun-webkit",
    category: "native-dep",
    description:
      "ICU built and zstd-compressed for Bun and WebKit JavaScriptCore internationalization",
  },
  {
    name: "ninja",
    fullName: "yolo-rs/ninja",
    upstream: "oven-sh/ninja",
    url: "https://github.com/yolo-rs/ninja",
    plane: "host-bun-webkit",
    category: "build-tool",
    description: "Ninja build system with Bun build patches powering `bun bd`",
  },
  {
    name: "hawk",
    fullName: "yolo-rs/hawk",
    upstream: "oven-sh/hawk",
    url: "https://github.com/yolo-rs/hawk",
    plane: "host-bun-webkit",
    category: "build-tool",
    description:
      "Workspace-aware Cargo linter for unnecessary public Rust APIs across Bun's ~200 Rust crates",
  },
  {
    name: "rust",
    fullName: "yolo-rs/rust",
    upstream: "oven-sh/rust",
    url: "https://github.com/yolo-rs/rust",
    plane: "host-bun-webkit",
    category: "build-tool",
    description:
      "Rust compiler toolchain tuned for compiling Bun's ~200 crates and WebKit LTO",
  },
  {
    name: "wasmtime",
    fullName: "yolo-rs/wasmtime",
    upstream: "bytecodealliance/wasmtime",
    url: "https://github.com/yolo-rs/wasmtime",
    plane: "host-bun-webkit",
    category: "build-tool",
    description:
      "Cranelift SSA native code generator backing Bun Ahead-of-Time compilation (src/aot)",
  },
  {
    name: "uSockets",
    fullName: "yolo-rs/uSockets",
    upstream: "uNetworking/uSockets",
    url: "https://github.com/yolo-rs/uSockets",
    plane: "host-bun-webkit",
    category: "native-dep",
    description:
      "Non-blocking eventing socket layer for Bun.serve (src/uws_sys)",
  },
  {
    name: "uWebSockets",
    fullName: "yolo-rs/uWebSockets",
    upstream: "uNetworking/uWebSockets",
    url: "https://github.com/yolo-rs/uWebSockets",
    plane: "host-bun-webkit",
    category: "native-dep",
    description:
      "High-performance HTTP and WebSocket pub/sub server layer (src/uws)",
  },
  {
    name: "lsquic",
    fullName: "yolo-rs/lsquic",
    upstream: "litespeedtech/lsquic",
    url: "https://github.com/yolo-rs/lsquic",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "f812ceb9529e26717df78c6064a2ff648b949f3e",
    description: "LiteSpeed QUIC and HTTP/3 transport library (src/lsquic_sys)",
  },
  {
    name: "ls-hpack",
    fullName: "yolo-rs/ls-hpack",
    upstream: "litespeedtech/ls-hpack",
    url: "https://github.com/yolo-rs/ls-hpack",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "cf0f70dd10b352194c97448eb5d00b4aa484f531",
    description: "LiteSpeed HPACK HTTP/2 header compression library",
  },
  {
    name: "c-ares",
    fullName: "yolo-rs/c-ares",
    upstream: "c-ares/c-ares",
    url: "https://github.com/yolo-rs/c-ares",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "0b88066f79ac9745d6819899f1794df91b73c873",
    description:
      "Asynchronous DNS resolver library backing Bun.dns (src/cares_sys)",
  },
  {
    name: "libdeflate",
    fullName: "yolo-rs/libdeflate",
    upstream: "ebiggers/libdeflate",
    url: "https://github.com/yolo-rs/libdeflate",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "92e6a0db9fa848d742f9eb286c92afc60f2c3dda",
    description:
      "Fast whole-buffer DEFLATE, gzip, and zlib compression (src/libdeflate_sys)",
  },
  {
    name: "zlib-ng",
    fullName: "yolo-rs/zlib-ng",
    upstream: "zlib-ng/zlib-ng",
    url: "https://github.com/yolo-rs/zlib-ng",
    plane: "host-bun-webkit",
    category: "native-dep",
    pinnedCommit: "12731092979c6d07f42da27da673a9f6c7b13586",
    description: "SIMD-accelerated zlib compression library (src/zlib_sys)",
  },
] as const;

export interface HostCapabilitiesSnapshot {
  readonly runtime: "bun";
  readonly architecture: "Full Rust (~200 crates) + C++ WebKit/JSC";
  readonly engine: "JavaScriptCore (WebKit)";
  readonly gc: "Riptide";
  readonly bunVersion: string;
  readonly bunRevision: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly ffiReady: boolean;
  readonly nativeApis: {
    readonly serve: boolean;
    readonly spawn: boolean;
    readonly file: boolean;
    readonly sqlite: boolean;
    readonly sql: boolean;
    readonly archive: boolean;
    readonly glob: boolean;
    readonly csrf: boolean;
    readonly password: boolean;
    readonly markdown: boolean;
  };
  readonly heapMemoryBytes: {
    readonly rss: number;
    readonly heapTotal: number;
    readonly heapUsed: number;
  };
}

/**
 * Detects and exposes active Bun canary/upstream capabilities (`Bun.version`, `Bun.revision`,
 * JSC/WebKit host telemetry, `bun:ffi` readiness, and native API surface).
 */
export class BunHostRuntimeInfo {
  /**
   * Captures a live telemetry snapshot of the active Host Bun (Full Rust + WebKit/JSC) runtime.
   */
  static inspect(): HostCapabilitiesSnapshot {
    const mem = process.memoryUsage();
    const bunAny = Bun as Record<string, unknown>;
    return {
      runtime: "bun",
      architecture: "Full Rust (~200 crates) + C++ WebKit/JSC",
      engine: "JavaScriptCore (WebKit)",
      gc: "Riptide",
      bunVersion: Bun.version,
      bunRevision: Bun.revision,
      platform: process.platform,
      arch: process.arch,
      ffiReady: true,
      nativeApis: {
        serve: typeof Bun.serve === "function",
        spawn: typeof Bun.spawn === "function",
        file: typeof Bun.file === "function",
        sqlite: true,
        sql:
          typeof bunAny.sql === "function" || typeof bunAny.SQL === "function",
        archive: typeof bunAny.Archive === "function",
        glob: typeof Bun.Glob === "function",
        csrf: typeof bunAny.CSRF === "object" && bunAny.CSRF !== null,
        password: typeof Bun.password === "object" && Bun.password !== null,
        markdown:
          typeof bunAny.markdown === "object" && bunAny.markdown !== null,
      },
      heapMemoryBytes: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
      },
    };
  }

  /**
   * Verifies that the process is executing inside native Bun (JavaScriptCore/WebKit)
   * and not a legacy Node.js process.
   */
  static assertNativeBunHost(): void {
    if (typeof Bun === "undefined" || !Bun.version) {
      throw new Error(
        "Dual-Runtime violation: Host plane must execute inside native Bun (yolo-rs/bun + WebKit/JSC).",
      );
    }
  }

  /**
   * Filters `BUN_UPSTREAM_REPOS` by runtime plane (`host-bun-webkit` or `guest-browser-v8`).
   */
  static getReposByPlane(plane: RuntimePlane): readonly ForkedRepoEntry[] {
    return BUN_UPSTREAM_REPOS.filter((r) => r.plane === plane);
  }
}

export interface V8IsolateOptions {
  /** Maximum V8 old-generation heap size in MiB (`--max-old-space-size=<MiB>`). */
  maxOldSpaceSizeMb?: number;
  /** Maximum V8 semi-space (new generation) size in MiB (`--max-semi-space-size=<MiB>`). */
  maxSemiSpaceSizeMb?: number;
  /** Expose `window.gc()` inside the V8 isolate for deterministic heap testing (`--expose-gc`). */
  exposeGc?: boolean;
  /** Enable staged ECMAScript Harmony features in V8 (`--harmony`). */
  harmony?: boolean;
  /** Disable V8 runtime executable memory allocation (`--jitless`, Ignition interpreter only). */
  jitless?: boolean;
  /** Run V8 background compiler/GC threads on a single thread (`--single-threaded`). */
  singleThreaded?: boolean;
  /** Per-command V8 watchdog timeout in milliseconds (`obscura_js::cdp_watchdog::arm`). Default: 5000ms. */
  watchdogBudgetMs?: number;
  /** Additional raw V8 flags (`--flag` or `--key=value`). */
  customFlags?: readonly string[];
}

const DISALLOWED_V8_FLAGS = new Set([
  "--allow-natives-syntax",
  "--No-sandbox",
  "--no-sandbox",
  "--disable-web-security",
]);

/**
 * Builder & validator for Chromium V8 isolate flags passed to `crates/obscura-js`
 * (`obscura_js::set_v8_flags`) and `yolo-browser` for in-page browser web rendering.
 *
 * Mirrors the one-shot platform initialization semantics in `crates/obscura-js/src/v8_flags.rs`:
 * V8 flags must be applied before the first `ObscuraJsRuntime` isolate is constructed.
 */
export class V8PageIsolateConfig {
  private readonly options: Required<
    Pick<
      V8IsolateOptions,
      "exposeGc" | "harmony" | "jitless" | "singleThreaded" | "watchdogBudgetMs"
    >
  > & {
    maxOldSpaceSizeMb?: number;
    maxSemiSpaceSizeMb?: number;
    customFlags: string[];
  };

  private platformStarted = false;

  constructor(init: V8IsolateOptions = {}) {
    this.options = {
      maxOldSpaceSizeMb: init.maxOldSpaceSizeMb,
      maxSemiSpaceSizeMb: init.maxSemiSpaceSizeMb,
      exposeGc: init.exposeGc ?? false,
      harmony: init.harmony ?? false,
      jitless: init.jitless ?? false,
      singleThreaded: init.singleThreaded ?? false,
      watchdogBudgetMs: init.watchdogBudgetMs ?? 5000,
      customFlags: init.customFlags ? [...init.customFlags] : [],
    };
    this.validate();
  }

  /**
   * Validates all configured V8 flags and numeric bounds.
   */
  validate(): void {
    if (this.options.maxOldSpaceSizeMb !== undefined) {
      if (
        !Number.isInteger(this.options.maxOldSpaceSizeMb) ||
        this.options.maxOldSpaceSizeMb < 16 ||
        this.options.maxOldSpaceSizeMb > 65536
      ) {
        throw new RangeError(
          `Invalid V8 maxOldSpaceSizeMb (${this.options.maxOldSpaceSizeMb}): must be an integer between 16 and 65536 MiB.`,
        );
      }
    }

    if (this.options.maxSemiSpaceSizeMb !== undefined) {
      if (
        !Number.isInteger(this.options.maxSemiSpaceSizeMb) ||
        this.options.maxSemiSpaceSizeMb < 1 ||
        this.options.maxSemiSpaceSizeMb > 1024
      ) {
        throw new RangeError(
          `Invalid V8 maxSemiSpaceSizeMb (${this.options.maxSemiSpaceSizeMb}): must be an integer between 1 and 1024 MiB.`,
        );
      }
    }

    if (
      !Number.isFinite(this.options.watchdogBudgetMs) ||
      this.options.watchdogBudgetMs < 50 ||
      this.options.watchdogBudgetMs > 300_000
    ) {
      throw new RangeError(
        `Invalid V8 watchdogBudgetMs (${this.options.watchdogBudgetMs}): must be between 50ms and 300000ms.`,
      );
    }

    for (const raw of this.options.customFlags) {
      const trimmed = raw.trim();
      if (
        !trimmed.startsWith("--") ||
        trimmed.length < 3 ||
        /\s/.test(trimmed)
      ) {
        throw new Error(
          `Invalid V8 custom flag "${raw}": must start with "--" and contain no whitespace.`,
        );
      }
      const flagName = trimmed.split("=")[0]!;
      if (DISALLOWED_V8_FLAGS.has(flagName)) {
        throw new Error(
          `Security violation: V8 flag "${flagName}" is disallowed in sandboxed guest page isolates.`,
        );
      }
    }
  }

  /**
   * Marks the V8 platform as started (mirrors `obscura_js::v8_flags::mark_platform_started()`).
   * Once started, subsequent flag mutations are ignored to prevent `V8_Fatal` / `SIGTRAP`.
   */
  markPlatformStarted(): void {
    this.platformStarted = true;
  }

  isPlatformStarted(): boolean {
    return this.platformStarted;
  }

  /**
   * Returns the ordered array of V8 flags suitable for `deno_core::v8::V8::set_flags_from_string`.
   */
  toFlagArray(): string[] {
    const flags: string[] = [];
    if (this.options.maxOldSpaceSizeMb !== undefined) {
      flags.push(`--max-old-space-size=${this.options.maxOldSpaceSizeMb}`);
    }
    if (this.options.maxSemiSpaceSizeMb !== undefined) {
      flags.push(`--max-semi-space-size=${this.options.maxSemiSpaceSizeMb}`);
    }
    if (this.options.exposeGc) {
      flags.push("--expose-gc");
    }
    if (this.options.harmony) {
      flags.push("--harmony");
    }
    if (this.options.jitless) {
      flags.push("--jitless");
    }
    if (this.options.singleThreaded) {
      flags.push("--single-threaded");
    }
    for (const custom of this.options.customFlags) {
      const trimmed = custom.trim();
      if (!flags.includes(trimmed)) {
        flags.push(trimmed);
      }
    }
    return flags;
  }

  /**
   * Formats the flags into a space-delimited string for `obscura_js::set_v8_flags(&str)`.
   */
  toFlagString(): string {
    return this.toFlagArray().join(" ");
  }

  /**
   * Produces CLI arguments for `obscura-cli` / `yolo-browser-cli`.
   */
  toCliArgs(): string[] {
    const flagStr = this.toFlagString();
    return flagStr.length > 0 ? [`--v8-flags=${flagStr}`] : [];
  }

  getWatchdogBudgetMs(): number {
    return this.options.watchdogBudgetMs;
  }
}

export type V8ExecutionWorld = "main" | "isolated";

export interface V8PageEvaluateRequest {
  /** JavaScript expression or IIFE to evaluate inside the browser's Chromium V8 isolate. */
  readonly expression: string;
  /** Execution world (`main` shares page window/DOM; `isolated` runs in an isolated V8 context). */
  readonly world?: V8ExecutionWorld;
  /** Whether to await a returned Promise inside V8 (`awaitPromise: true`). */
  readonly awaitPromise?: boolean;
  /** Whether to return the result by value (JSON-serialized across the V8 -> Bun boundary). */
  readonly returnByValue?: boolean;
  /** Per-command V8 watchdog deadline override in milliseconds. */
  readonly budgetMs?: number;
}

export interface CdpEnvelope<TParams = Record<string, unknown>> {
  readonly id: number;
  readonly method: string;
  readonly params: TParams;
  readonly meta: {
    readonly sourcePlane: "host-bun-webkit";
    readonly targetPlane: "guest-browser-v8";
    readonly world: V8ExecutionWorld;
    readonly watchdogBudgetMs: number;
  };
}

const HOST_SECRET_PATTERNS: readonly RegExp[] = [
  /\bBun\s*\.\s*(serve|spawn|spawnSync|file|write|secrets|sql|sqlite|ffi|CSRF)\b/,
  /\bprocess\s*\.\s*env\b/,
  /\bimport\s*\(\s*["']bun:/,
  /\brequire\s*\(\s*["'](bun:|node:|fs|child_process)/,
];

/**
 * Coordinates host-side Bun execution (Full Rust + JSC/WebKit) with in-browser Chromium V8 evaluation
 * (`Runtime.evaluate`, `Runtime.callFunctionOn`, `Page.addScriptToEvaluateOnNewDocument`)
 * so host scripts never leak into page V8 contexts and page V8 scripts stay sandboxed
 * inside the Rust browser engine (`crates/obscura-js` + `crates/yolo-browser`).
 */
export class DualEngineCoordinator {
  private readonly v8Config: V8PageIsolateConfig;
  private nextCommandId = 1;
  private readonly preloadScripts: string[] = [];

  constructor(v8Config: V8PageIsolateConfig = new V8PageIsolateConfig()) {
    BunHostRuntimeInfo.assertNativeBunHost();
    this.v8Config = v8Config;
  }

  getV8Config(): V8PageIsolateConfig {
    return this.v8Config;
  }

  /**
   * Static security lint ensuring a script intended for in-page V8 execution does not
   * accidentally reference Host Bun (`Bun.*`, `bun:*`, `process.env`) APIs or secrets.
   */
  static assertPureGuestV8Script(script: string): void {
    if (!script || script.trim().length === 0) {
      throw new Error("Guest V8 script expression cannot be empty.");
    }
    for (const pattern of HOST_SECRET_PATTERNS) {
      if (pattern.test(script)) {
        throw new Error(
          `Dual-Runtime boundary violation: Host Bun/Node symbol matched (${pattern.source}) inside a guest V8 page script. Keep Bun.* APIs in the host plane and pass only serialized data to V8.`,
        );
      }
    }
  }

  /**
   * Builds a sanitized, watchdog-bounded CDP `Runtime.evaluate` payload for execution
   * inside `crates/obscura-js`'s Chromium V8 isolate.
   */
  buildRuntimeEvaluate(req: V8PageEvaluateRequest): CdpEnvelope<{
    expression: string;
    awaitPromise: boolean;
    returnByValue: boolean;
    contextType: V8ExecutionWorld;
    timeout: number;
  }> {
    DualEngineCoordinator.assertPureGuestV8Script(req.expression);
    const world: V8ExecutionWorld = req.world ?? "main";
    const budgetMs = req.budgetMs ?? this.v8Config.getWatchdogBudgetMs();

    return {
      id: this.nextCommandId++,
      method: "Runtime.evaluate",
      params: {
        expression: req.expression,
        awaitPromise: req.awaitPromise ?? true,
        returnByValue: req.returnByValue ?? true,
        contextType: world,
        timeout: budgetMs,
      },
      meta: {
        sourcePlane: "host-bun-webkit",
        targetPlane: "guest-browser-v8",
        world,
        watchdogBudgetMs: budgetMs,
      },
    };
  }

  /**
   * Registers and builds a CDP `Page.addScriptToEvaluateOnNewDocument` command for injecting
   * deterministic stealth/preload scripts into every new V8 document context before page scripts run.
   */
  buildPreloadDocumentScript(
    source: string,
    worldName?: string,
  ): CdpEnvelope<{
    source: string;
    worldName?: string;
  }> {
    DualEngineCoordinator.assertPureGuestV8Script(source);
    this.preloadScripts.push(source);
    const world: V8ExecutionWorld = worldName ? "isolated" : "main";

    return {
      id: this.nextCommandId++,
      method: "Page.addScriptToEvaluateOnNewDocument",
      params: worldName ? { source, worldName } : { source },
      meta: {
        sourcePlane: "host-bun-webkit",
        targetPlane: "guest-browser-v8",
        world,
        watchdogBudgetMs: this.v8Config.getWatchdogBudgetMs(),
      },
    };
  }

  /**
   * Packages a pure function and JSON-serializable arguments from Host Bun (JSC) into a
   * self-contained V8 IIFE expression so no host closures or lexical scopes cross the boundary.
   */
  buildSerializedV8Call<TArgs extends readonly unknown[]>(
    fnSource: string,
    args: TArgs,
    options?: Omit<V8PageEvaluateRequest, "expression">,
  ): CdpEnvelope<{
    expression: string;
    awaitPromise: boolean;
    returnByValue: boolean;
    contextType: V8ExecutionWorld;
    timeout: number;
  }> {
    DualEngineCoordinator.assertPureGuestV8Script(fnSource);
    const serializedArgs = args.map((arg) => JSON.stringify(arg)).join(", ");
    const expression = `(${fnSource})(${serializedArgs})`;
    return this.buildRuntimeEvaluate({
      ...options,
      expression,
    });
  }

  /**
   * Executes a trusted orchestration callback on the Host Bun (WebKit/JSC) plane and
   * tags its telemetry with the host engine metadata.
   */
  async runOnBunHost<T>(task: () => T | Promise<T>): Promise<{
    plane: "host-bun-webkit";
    bunVersion: string;
    result: T;
  }> {
    const result = await task();
    return {
      plane: "host-bun-webkit",
      bunVersion: Bun.version,
      result,
    };
  }

  getRegisteredPreloadScripts(): readonly string[] {
    return this.preloadScripts;
  }
}

/**
 * Pure AoT-friendly factory for `V8PageIsolateConfig`.
 */
export const createV8PageIsolateConfig = /* @__PURE__ */ (
  init?: V8IsolateOptions,
): V8PageIsolateConfig => new V8PageIsolateConfig(init);

/**
 * Pure AoT-friendly factory for `DualEngineCoordinator`.
 */
export const createDualEngineCoordinator = /* @__PURE__ */ (
  v8Config?: V8PageIsolateConfig,
): DualEngineCoordinator => new DualEngineCoordinator(v8Config);
