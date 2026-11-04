/**
 * CEF lock receipt (`engines/cef.lock.json`) parsing and validation.
 *
 * `crates/yolo-chromium` embeds upstream Chromium through the official CEF
 * (Chromium Embedded Framework) binary distribution and writes this receipt at
 * the end of its smoke run. `parseCefLock` is strict about shape and throws
 * with the offending JSON path; `validateCefLock` never throws and instead
 * returns every finding so a CLI can print the complete picture at once.
 */
import {
  compareDottedVersions,
  type CefIndex,
  type CefIndexVersion,
  type CefPlatform,
} from "./index";

export interface CefLockHost {
  os: string;
  arch: string;
  /** Rust target triple, e.g. `x86_64-pc-windows-msvc`. */
  target: string;
}

export interface CefLockCefBuild {
  /** Full CEF version, e.g. `156.0.15+gcf671c0+chromium-156.0.8078.80`. */
  version: string;
  major: number;
  minor: number;
  patch: number;
  commitNumber: number;
  commitHash: string;
  /** Chromium `MAJOR.MINOR.BUILD.PATCH`, e.g. `156.0.8078.80`. */
  chromiumVersion: string;
  /** CEF API version selected at build time, e.g. `15600`. */
  apiVersion: number;
  apiHash: string;
  sandboxCompatHash: string;
  distributionDir: string;
  archiveName: string;
  archiveSha1: string;
}

export interface CefLockBuild {
  crateVersion: string;
  /** `cef` crate version including build metadata, e.g. `156.3.0+156.0.15`. */
  cefCrate: string;
  target: string;
  sandbox: boolean;
  cef: CefLockCefBuild;
}

export interface CefLockRuntime {
  /** Either the short `MAJOR.MINOR.PATCH` that `cef_version_info` reports or the full build version string. */
  cefVersion: string;
  chromiumVersion: string;
  apiHashPlatform: string;
  commitHash: string;
  sandboxCompatHash: string;
  /** Whether the loaded libcef matched the build-time headers. */
  matchesBuild: boolean;
}

export type CefRuntimeStyle = "chrome" | "alloy";

export interface CefLockShell {
  runtimeStyle: CefRuntimeStyle;
  views: boolean;
  sandbox: boolean;
  cachePath: string | null;
  remoteDebuggingPort: number | null;
  hostExecutable: string;
}

export type CefSmokeOutcome = "loaded" | "load-error" | "timeout";

export interface CefLockSmokeError {
  code: number;
  text: string;
}

export interface CefLockSmoke {
  url: string;
  finalUrl: string;
  title: string;
  httpStatus: number;
  loadMs: number;
  outcome: CefSmokeOutcome;
  error: CefLockSmokeError | null;
  exitCode: number;
}

export interface CefLock {
  schemaVersion: 1;
  engine: "cef";
  /** ISO-8601 capture timestamp. */
  capturedAt: string;
  host: CefLockHost;
  build: CefLockBuild;
  runtime: CefLockRuntime;
  shell: CefLockShell;
  smoke: CefLockSmoke;
}

type JsonObject = Record<string, unknown>;

const RUNTIME_STYLES = ["chrome", "alloy"] as const;
const SMOKE_OUTCOMES = ["loaded", "load-error", "timeout"] as const;

function describeValue(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  const text =
    typeof value === "string" ? JSON.stringify(value) : String(value);
  return `${typeof value} ${text.length > 48 ? `${text.slice(0, 45)}...` : text}`;
}

function invalid(path: string, expectation: string, value: unknown): never {
  throw new Error(
    `Invalid CEF lock receipt: ${path} must be ${expectation} (got ${describeValue(value)}).`,
  );
}

function child(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function readObject(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "an object", value);
  }
  return value as JsonObject;
}

function readString(
  source: JsonObject,
  key: string,
  path: string,
  allowEmpty = false,
): string {
  const value = source[key];
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    invalid(
      child(path, key),
      allowEmpty ? "a string" : "a non-empty string",
      value,
    );
  }
  return value;
}

function readInteger(source: JsonObject, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    invalid(child(path, key), "an integer", value);
  }
  return value;
}

function readBoolean(source: JsonObject, key: string, path: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") invalid(child(path, key), "a boolean", value);
  return value;
}

function readLiteral<T extends string | number>(
  source: JsonObject,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = source[key];
  if (!allowed.includes(value as T)) {
    invalid(
      child(path, key),
      `one of ${allowed.map((item) => JSON.stringify(item)).join(", ")}`,
      value,
    );
  }
  return value as T;
}

/** Nullable fields must be present; `null` means "unset", a missing key is a schema violation. */
function readNullable<T>(
  source: JsonObject,
  key: string,
  path: string,
  read: () => T,
): T | null {
  if (!(key in source)) {
    invalid(child(path, key), "present (null when unset)", undefined);
  }
  return source[key] === null ? null : read();
}

/**
 * Parse and validate the shape of a CEF lock receipt. Accepts either the raw
 * JSON text or an already-decoded value and throws a descriptive error that
 * names the offending JSON path on any schema violation.
 */
export function parseCefLock(json: unknown): CefLock {
  let value = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid CEF lock receipt: not valid JSON (${reason}).`);
    }
  }
  const root = readObject(value, "receipt");
  const schemaVersion = readLiteral(root, "schemaVersion", "", [1] as const);
  const engine = readLiteral(root, "engine", "", ["cef"] as const);
  const capturedAt = readString(root, "capturedAt", "");

  const hostSource = readObject(root.host, "host");
  const host: CefLockHost = {
    os: readString(hostSource, "os", "host"),
    arch: readString(hostSource, "arch", "host"),
    target: readString(hostSource, "target", "host"),
  };

  const buildSource = readObject(root.build, "build");
  const cefSource = readObject(buildSource.cef, "build.cef");
  const cef: CefLockCefBuild = {
    version: readString(cefSource, "version", "build.cef"),
    major: readInteger(cefSource, "major", "build.cef"),
    minor: readInteger(cefSource, "minor", "build.cef"),
    patch: readInteger(cefSource, "patch", "build.cef"),
    commitNumber: readInteger(cefSource, "commitNumber", "build.cef"),
    commitHash: readString(cefSource, "commitHash", "build.cef"),
    chromiumVersion: readString(cefSource, "chromiumVersion", "build.cef"),
    apiVersion: readInteger(cefSource, "apiVersion", "build.cef"),
    apiHash: readString(cefSource, "apiHash", "build.cef"),
    sandboxCompatHash: readString(cefSource, "sandboxCompatHash", "build.cef"),
    distributionDir: readString(cefSource, "distributionDir", "build.cef"),
    archiveName: readString(cefSource, "archiveName", "build.cef"),
    archiveSha1: readString(cefSource, "archiveSha1", "build.cef"),
  };
  const build: CefLockBuild = {
    crateVersion: readString(buildSource, "crateVersion", "build"),
    cefCrate: readString(buildSource, "cefCrate", "build"),
    target: readString(buildSource, "target", "build"),
    sandbox: readBoolean(buildSource, "sandbox", "build"),
    cef,
  };

  const runtimeSource = readObject(root.runtime, "runtime");
  const runtime: CefLockRuntime = {
    cefVersion: readString(runtimeSource, "cefVersion", "runtime"),
    chromiumVersion: readString(runtimeSource, "chromiumVersion", "runtime"),
    apiHashPlatform: readString(runtimeSource, "apiHashPlatform", "runtime"),
    commitHash: readString(runtimeSource, "commitHash", "runtime"),
    sandboxCompatHash: readString(
      runtimeSource,
      "sandboxCompatHash",
      "runtime",
    ),
    matchesBuild: readBoolean(runtimeSource, "matchesBuild", "runtime"),
  };

  const shellSource = readObject(root.shell, "shell");
  const shell: CefLockShell = {
    runtimeStyle: readLiteral(
      shellSource,
      "runtimeStyle",
      "shell",
      RUNTIME_STYLES,
    ),
    views: readBoolean(shellSource, "views", "shell"),
    sandbox: readBoolean(shellSource, "sandbox", "shell"),
    cachePath: readNullable(shellSource, "cachePath", "shell", () =>
      readString(shellSource, "cachePath", "shell"),
    ),
    remoteDebuggingPort: readNullable(
      shellSource,
      "remoteDebuggingPort",
      "shell",
      () => readInteger(shellSource, "remoteDebuggingPort", "shell"),
    ),
    hostExecutable: readString(shellSource, "hostExecutable", "shell"),
  };

  const smokeSource = readObject(root.smoke, "smoke");
  const smoke: CefLockSmoke = {
    url: readString(smokeSource, "url", "smoke"),
    finalUrl: readString(smokeSource, "finalUrl", "smoke", true),
    title: readString(smokeSource, "title", "smoke", true),
    httpStatus: readInteger(smokeSource, "httpStatus", "smoke"),
    loadMs: readInteger(smokeSource, "loadMs", "smoke"),
    outcome: readLiteral(smokeSource, "outcome", "smoke", SMOKE_OUTCOMES),
    error: readNullable(smokeSource, "error", "smoke", () => {
      const errorSource = readObject(smokeSource.error, "smoke.error");
      return {
        code: readInteger(errorSource, "code", "smoke.error"),
        text: readString(errorSource, "text", "smoke.error", true),
      };
    }),
    exitCode: readInteger(smokeSource, "exitCode", "smoke"),
  };

  return {
    schemaVersion,
    engine,
    capturedAt,
    host,
    build,
    runtime,
    shell,
    smoke,
  };
}

/** Read `engines/cef.lock.json` (or any receipt path) from disk and parse it. */
export async function readCefLock(path: string): Promise<CefLock> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(
      `CEF lock receipt not found at ${path}; run the crates/yolo-chromium smoke to generate it.`,
    );
  }
  return parseCefLock(await file.text());
}

export type CefLockFindingSeverity = "error" | "warn";

export interface CefLockFinding {
  severity: CefLockFindingSeverity;
  /** Stable machine-readable identifier, e.g. `smoke.outcome`. */
  code: string;
  /** JSON path of the field the finding is about. */
  path: string;
  message: string;
}

export interface ValidateCefLockOptions {
  /**
   * Spotify CEF index (`https://cef-builds.spotifycdn.com/index.json`). When
   * present, the receipt is also checked against the published builds.
   */
  cefIndex?: CefIndex;
  /** Platform key for index lookups; derived from `lock.host` when omitted. */
  platform?: CefPlatform;
  /** Reference clock for the `capturedAt` check; defaults to now. */
  now?: Date;
  /** Tolerance before `capturedAt` counts as being in the future (default 60s). */
  clockSkewMs?: number;
}

type Report = (
  severity: CefLockFindingSeverity,
  code: string,
  path: string,
  message: string,
) => void;

const HEX = /^[0-9a-f]+$/i;
const HEX_40 = /^[0-9a-f]{40}$/i;
const CHROMIUM_VERSION = /^\d+\.\d+\.\d+\.\d+$/;
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CEF_VERSION =
  /^(\d+)\.(\d+)\.(\d+)\+g([0-9a-f]{7,40})\+chromium-(\d+\.\d+\.\d+\.\d+)$/;
/** `include/cef_api_hash.h`: CEF_API_VERSION_NEXT / CEF_API_VERSION_EXPERIMENTAL. */
const CEF_API_VERSION_NEXT = 999998;
const CEF_API_VERSION_EXPERIMENTAL = 999999;
const DEFAULT_CLOCK_SKEW_MS = 60_000;

export interface ParsedCefVersion {
  major: number;
  minor: number;
  patch: number;
  /** Abbreviated commit hash from the `+g<hash>` segment. */
  commit: string;
  chromiumVersion: string;
}

/** Split `MAJOR.MINOR.PATCH+g<commit>+chromium-<version>`; null when malformed. */
export function parseCefVersion(version: string): ParsedCefVersion | null {
  const match = CEF_VERSION.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    commit: match[4] ?? "",
    chromiumVersion: match[5] ?? "",
  };
}

/** Order CEF builds by their Chromium version first, then by the CEF patch line. */
export function compareCefVersions(
  left: ParsedCefVersion,
  right: ParsedCefVersion,
): number {
  const chromium = compareDottedVersions(
    left.chromiumVersion,
    right.chromiumVersion,
  );
  if (chromium !== 0) return chromium;
  return compareDottedVersions(
    `${left.major}.${left.minor}.${left.patch}`,
    `${right.major}.${right.minor}.${right.patch}`,
  );
}

/** Newest stable-channel build for a platform; the index itself is not sorted. */
export function latestStableCefVersion(
  index: CefIndex,
  platform: CefPlatform,
): CefIndexVersion | undefined {
  let best: { entry: CefIndexVersion; parsed: ParsedCefVersion } | undefined;
  for (const entry of index[platform]?.versions ?? []) {
    if (entry.channel !== "stable") continue;
    const parsed = parseCefVersion(entry.cef_version);
    if (!parsed) continue;
    if (!best || compareCefVersions(parsed, best.parsed) > 0) {
      best = { entry, parsed };
    }
  }
  return best?.entry;
}

type CefOs = "windows" | "linux" | "macos";
type CefArch = "32" | "64" | "arm" | "arm64";

const CEF_ARCHES: Record<string, CefArch> = {
  x86_64: "64",
  x64: "64",
  amd64: "64",
  aarch64: "arm64",
  arm64: "arm64",
  x86: "32",
  i386: "32",
  i586: "32",
  i686: "32",
  ia32: "32",
  arm: "arm",
  armv7: "arm",
  armv7l: "arm",
  thumbv7neon: "arm",
};

const CEF_PLATFORM_BY_HOST: Record<
  `${CefOs}/${CefArch}`,
  CefPlatform | undefined
> = {
  "windows/32": "windows32",
  "windows/64": "windows64",
  "windows/arm": undefined,
  "windows/arm64": "windowsarm64",
  "linux/32": "linux32",
  "linux/64": "linux64",
  "linux/arm": "linuxarm",
  "linux/arm64": "linuxarm64",
  "macos/32": undefined,
  "macos/64": "macosx64",
  "macos/arm": undefined,
  "macos/arm64": "macosarm64",
};

function normalizeOs(text: string): CefOs | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("windows") || lower === "win32") return "windows";
  if (lower.includes("linux")) return "linux";
  if (["darwin", "macos", "apple"].some((token) => lower.includes(token))) {
    return "macos";
  }
  return undefined;
}

function normalizeArch(text: string): CefArch | undefined {
  return CEF_ARCHES[text.toLowerCase()];
}

/**
 * Map the receipt's host (Rust `std::env::consts` names or Node-style names,
 * plus the target triple as a fallback) to a CEF distribution platform ID.
 */
export function cefPlatformFromHost(
  host: Pick<CefLockHost, "os" | "arch" | "target">,
): CefPlatform | undefined {
  const os = normalizeOs(host.os) ?? normalizeOs(host.target);
  const arch =
    normalizeArch(host.arch) ?? normalizeArch(host.target.split("-")[0] ?? "");
  if (!os || !arch) return undefined;
  return CEF_PLATFORM_BY_HOST[`${os}/${arch}`];
}

/** Case-insensitive hash equality that tolerates an abbreviated form on either side. */
function sameHash(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = shorter === a ? b : a;
  return shorter.length >= 7 && longer.startsWith(shorter);
}

/**
 * Check a parsed receipt for internal consistency, a healthy smoke run, and
 * (when `options.cefIndex` is given) agreement with the published CEF builds.
 * Returns findings instead of throwing; `error` findings should fail a gate.
 */
export function validateCefLock(
  lock: CefLock,
  options: ValidateCefLockOptions = {},
): CefLockFinding[] {
  const findings: CefLockFinding[] = [];
  const report: Report = (severity, code, path, message) => {
    findings.push({ severity, code, path, message });
  };
  const { build, runtime, shell, smoke } = lock;
  const cef = build.cef;

  if ((lock.engine as string) !== "cef") {
    report(
      "error",
      "engine",
      "engine",
      `engine must be "cef" (got ${JSON.stringify(lock.engine)}).`,
    );
  }

  const captured = ISO_8601.test(lock.capturedAt)
    ? new Date(lock.capturedAt)
    : undefined;
  if (!captured || Number.isNaN(captured.getTime())) {
    report(
      "error",
      "captured-at",
      "capturedAt",
      `capturedAt must be an ISO-8601 timestamp (got ${JSON.stringify(lock.capturedAt)}).`,
    );
  } else {
    const now = options.now ?? new Date();
    const skew = options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
    if (captured.getTime() - now.getTime() > skew) {
      report(
        "error",
        "captured-at",
        "capturedAt",
        `capturedAt ${lock.capturedAt} is in the future (now ${now.toISOString()}).`,
      );
    }
  }

  const parsed = parseCefVersion(cef.version);
  if (!parsed) {
    report(
      "error",
      "cef.version",
      "build.cef.version",
      `${cef.version} is not a CEF version of the form MAJOR.MINOR.PATCH+g<commit>+chromium-<version>.`,
    );
  } else {
    if (
      parsed.major !== cef.major ||
      parsed.minor !== cef.minor ||
      parsed.patch !== cef.patch
    ) {
      report(
        "error",
        "cef.version-numbers",
        "build.cef.major",
        `build.cef.major/minor/patch ${cef.major}.${cef.minor}.${cef.patch} disagree with build.cef.version ${cef.version}.`,
      );
    }
    if (parsed.chromiumVersion !== cef.chromiumVersion) {
      report(
        "error",
        "cef.chromium-version",
        "build.cef.chromiumVersion",
        `build.cef.chromiumVersion ${cef.chromiumVersion} disagrees with build.cef.version ${cef.version}.`,
      );
    }
    if (!cef.commitHash.toLowerCase().startsWith(parsed.commit.toLowerCase())) {
      report(
        "error",
        "cef.commit-hash",
        "build.cef.commitHash",
        `build.cef.commitHash ${cef.commitHash} does not start with the +g${parsed.commit} segment of build.cef.version.`,
      );
    }
  }
  if (!CHROMIUM_VERSION.test(cef.chromiumVersion)) {
    report(
      "error",
      "cef.chromium-version",
      "build.cef.chromiumVersion",
      `build.cef.chromiumVersion must be MAJOR.MINOR.BUILD.PATCH (got ${JSON.stringify(cef.chromiumVersion)}).`,
    );
  } else if (Number(cef.chromiumVersion.split(".")[0]) !== cef.major) {
    report(
      "error",
      "cef.chromium-major",
      "build.cef.chromiumVersion",
      `Chromium ${cef.chromiumVersion} does not belong to CEF major ${cef.major}; CEF shares Chromium's major version.`,
    );
  }
  if (!HEX.test(cef.commitHash)) {
    report(
      "error",
      "cef.commit-hash",
      "build.cef.commitHash",
      `build.cef.commitHash must be a hexadecimal git commit (got ${JSON.stringify(cef.commitHash)}).`,
    );
  }
  if (!HEX_40.test(cef.archiveSha1)) {
    report(
      "error",
      "cef.archive-sha1",
      "build.cef.archiveSha1",
      `build.cef.archiveSha1 must be 40 hexadecimal characters (got ${JSON.stringify(cef.archiveSha1)}).`,
    );
  }
  if (!HEX_40.test(cef.apiHash)) {
    report(
      "error",
      "cef.api-hash",
      "build.cef.apiHash",
      `build.cef.apiHash must be 40 hexadecimal characters (got ${JSON.stringify(cef.apiHash)}).`,
    );
  }
  if (
    cef.apiVersion === CEF_API_VERSION_EXPERIMENTAL ||
    cef.apiVersion === CEF_API_VERSION_NEXT
  ) {
    const label =
      cef.apiVersion === CEF_API_VERSION_EXPERIMENTAL ? "experimental" : "next";
    report(
      "warn",
      "cef.api-version",
      "build.cef.apiVersion",
      `apiVersion ${cef.apiVersion} selects the ${label} CEF API, which has no stability guarantee across CEF updates.`,
    );
  } else if (Math.floor(cef.apiVersion / 100) !== cef.major) {
    report(
      "warn",
      "cef.api-version",
      "build.cef.apiVersion",
      `apiVersion ${cef.apiVersion} does not belong to CEF ${cef.major} (expected ${cef.major}00-${cef.major}99).`,
    );
  }
  if (!cef.archiveName.includes(cef.version)) {
    report(
      "warn",
      "cef.archive-name",
      "build.cef.archiveName",
      `archiveName ${cef.archiveName} does not embed build.cef.version ${cef.version}.`,
    );
  }

  if (!runtime.matchesBuild) {
    report(
      "error",
      "runtime.matches-build",
      "runtime.matchesBuild",
      "The loaded libcef did not match the build-time CEF headers (runtime.matchesBuild is false).",
    );
  }
  // libcef only exposes numeric version parts at runtime, so the receipt may
  // record the short `MAJOR.MINOR.PATCH` form instead of the full string.
  const buildCore = `${cef.major}.${cef.minor}.${cef.patch}`;
  const runtimeParsed = parseCefVersion(runtime.cefVersion);
  const runtimeCore = runtimeParsed
    ? `${runtimeParsed.major}.${runtimeParsed.minor}.${runtimeParsed.patch}`
    : runtime.cefVersion;
  if (runtime.cefVersion !== cef.version && runtimeCore !== buildCore) {
    report(
      "error",
      "runtime.cef-version",
      "runtime.cefVersion",
      `runtime.cefVersion ${runtime.cefVersion} differs from build.cef.version ${cef.version}.`,
    );
  }
  if (runtime.chromiumVersion !== cef.chromiumVersion) {
    report(
      "error",
      "runtime.chromium-version",
      "runtime.chromiumVersion",
      `runtime.chromiumVersion ${runtime.chromiumVersion} differs from build.cef.chromiumVersion ${cef.chromiumVersion}.`,
    );
  }
  if (!sameHash(runtime.commitHash, cef.commitHash)) {
    report(
      "error",
      "runtime.commit-hash",
      "runtime.commitHash",
      `runtime.commitHash ${runtime.commitHash} differs from build.cef.commitHash ${cef.commitHash}.`,
    );
  }
  if (!sameHash(runtime.sandboxCompatHash, cef.sandboxCompatHash)) {
    report(
      "error",
      "runtime.sandbox-compat",
      "runtime.sandboxCompatHash",
      `runtime.sandboxCompatHash ${runtime.sandboxCompatHash} differs from build.cef.sandboxCompatHash ${cef.sandboxCompatHash}.`,
    );
  }
  if (!sameHash(runtime.apiHashPlatform, cef.apiHash)) {
    report(
      "warn",
      "runtime.api-hash",
      "runtime.apiHashPlatform",
      `runtime.apiHashPlatform ${runtime.apiHashPlatform} differs from build.cef.apiHash ${cef.apiHash}; confirm build.cef.apiHash is the platform hash for apiVersion ${cef.apiVersion}.`,
    );
  }

  if (smoke.outcome !== "loaded") {
    const detail = smoke.error
      ? ` (${smoke.error.code} ${smoke.error.text})`
      : "";
    report(
      "error",
      "smoke.outcome",
      "smoke.outcome",
      `Smoke navigation to ${smoke.url} ended with ${smoke.outcome}${detail}.`,
    );
  } else if (smoke.error) {
    report(
      "warn",
      "smoke.error",
      "smoke.error",
      `smoke.outcome is loaded but smoke.error is set (${smoke.error.code} ${smoke.error.text}).`,
    );
  }
  if (smoke.exitCode !== 0) {
    report(
      "error",
      "smoke.exit-code",
      "smoke.exitCode",
      `The smoke process exited with code ${smoke.exitCode}.`,
    );
  }
  if (
    smoke.outcome === "loaded" &&
    (smoke.httpStatus < 200 || smoke.httpStatus >= 400)
  ) {
    report(
      "warn",
      "smoke.http-status",
      "smoke.httpStatus",
      `Smoke page ${smoke.finalUrl || smoke.url} answered HTTP ${smoke.httpStatus}.`,
    );
  }
  if (smoke.loadMs < 0) {
    report(
      "error",
      "smoke.load-ms",
      "smoke.loadMs",
      `smoke.loadMs must not be negative (got ${smoke.loadMs}).`,
    );
  }

  if (!build.sandbox) {
    report(
      "warn",
      "sandbox.build",
      "build.sandbox",
      "yolo-chromium was built without the CEF sandbox feature.",
    );
  }
  if (!shell.sandbox) {
    report(
      "warn",
      "sandbox.shell",
      "shell.sandbox",
      "The smoke shell ran with the Chromium sandbox disabled.",
    );
  } else if (!build.sandbox) {
    report(
      "warn",
      "sandbox.mismatch",
      "shell.sandbox",
      "shell.sandbox is true although the build has no sandbox support.",
    );
  }

  if (options.cefIndex) {
    validateAgainstIndex(lock, options.cefIndex, options.platform, report);
  }
  return findings;
}

function validateAgainstIndex(
  lock: CefLock,
  index: CefIndex,
  platformOverride: CefPlatform | undefined,
  report: Report,
): void {
  const cef = lock.build.cef;
  const platform = platformOverride ?? cefPlatformFromHost(lock.host);
  if (!platform) {
    report(
      "error",
      "index.platform",
      "host",
      `Cannot map host ${lock.host.os}/${lock.host.arch} (${lock.host.target}) to a CEF platform; pass an explicit platform.`,
    );
    return;
  }
  const versions = index[platform]?.versions;
  if (!versions || versions.length === 0) {
    report(
      "error",
      "index.platform",
      "host",
      `The CEF index has no builds for platform ${platform}.`,
    );
    return;
  }

  const entry = versions.find(
    (candidate) => candidate.cef_version === cef.version,
  );
  if (!entry) {
    report(
      "error",
      "index.version",
      "build.cef.version",
      `CEF ${cef.version} is not published for ${platform} in the Spotify CEF index.`,
    );
  } else {
    if (entry.channel !== "stable") {
      report(
        "warn",
        "index.channel",
        "build.cef.version",
        `CEF ${cef.version} is published on the ${entry.channel} channel for ${platform}.`,
      );
    }
    if (entry.chromium_version !== cef.chromiumVersion) {
      report(
        "error",
        "index.chromium-version",
        "build.cef.chromiumVersion",
        `The CEF index lists Chromium ${entry.chromium_version} for ${cef.version}, not ${cef.chromiumVersion}.`,
      );
    }
    if (
      entry.sandbox_compat &&
      !sameHash(entry.sandbox_compat, cef.sandboxCompatHash)
    ) {
      report(
        "warn",
        "index.sandbox-compat",
        "build.cef.sandboxCompatHash",
        `The CEF index lists sandbox_compat ${entry.sandbox_compat} for ${cef.version}, not ${cef.sandboxCompatHash}.`,
      );
    }
    const file = entry.files?.find(
      (candidate) => candidate.name === cef.archiveName,
    );
    if (!file) {
      report(
        "warn",
        "index.archive",
        "build.cef.archiveName",
        `Archive ${cef.archiveName} is not listed for ${cef.version} on ${platform}; its SHA-1 could not be cross-checked.`,
      );
    } else if (!sameHash(file.sha1, cef.archiveSha1)) {
      report(
        "error",
        "index.archive-sha1",
        "build.cef.archiveSha1",
        `Archive SHA-1 ${cef.archiveSha1} differs from the published ${file.sha1} for ${cef.archiveName}.`,
      );
    }
  }

  const current = parseCefVersion(cef.version);
  const latest = latestStableCefVersion(index, platform);
  const latestParsed = latest ? parseCefVersion(latest.cef_version) : null;
  if (
    current &&
    latest &&
    latestParsed &&
    compareCefVersions(latestParsed, current) > 0
  ) {
    report(
      "warn",
      "index.newer-stable",
      "build.cef.version",
      `A newer stable CEF is published for ${platform}: ${latest.cef_version} (Chromium ${latest.chromium_version}).`,
    );
  }
}

/**
 * Extract the `cef` dependency version requirement from Cargo.toml text.
 * Supports `cef = "X"`, `cef = { version = "X", ... }`, `cef.version = "X"`
 * and `[dependencies.cef]` / `[target.'...'.dependencies.cef]` tables.
 */
export function parseCargoCefVersion(cargoTomlText: string): string | null {
  const inline = /^\s*cef\s*=\s*\{[^}\n]*\bversion\s*=\s*"([^"]+)"/m.exec(
    cargoTomlText,
  );
  if (inline?.[1]) return inline[1];
  const simple = /^\s*cef\s*=\s*"([^"]+)"/m.exec(cargoTomlText);
  if (simple?.[1]) return simple[1];
  const dotted = /^\s*cef\.version\s*=\s*"([^"]+)"/m.exec(cargoTomlText);
  if (dotted?.[1]) return dotted[1];
  const table =
    /^\s*\[[^\]\n]*dependencies\.cef\]\s*$([\s\S]*?)(?=^\s*\[|(?![\s\S]))/m.exec(
      cargoTomlText,
    );
  const version = table?.[1]
    ? /^\s*version\s*=\s*"([^"]+)"/m.exec(table[1])
    : null;
  return version?.[1] ?? null;
}

/**
 * Whether a receipt's `build.cefCrate` (e.g. `156.3.0+156.0.15`) starts with
 * the Cargo requirement (e.g. `156.3.0`, `^156.3`, `=156.3.0`, `156.*`).
 * Comparison is per dotted component so `156.3` never matches `156.30.x`.
 */
export function cefCrateSatisfies(
  cefCrate: string,
  requirement: string,
): boolean {
  const trimmed = requirement.trim();
  if (/[<>,\s]/.test(trimmed)) {
    throw new Error(
      `Unsupported cef version requirement ${JSON.stringify(requirement)}; only plain, caret, tilde, exact and wildcard requirements are recognised.`,
    );
  }
  const expected = trimmed
    .replace(/^[\^=~]/, "")
    .replace(/\.\*$/, "")
    .split(".");
  const core = cefCrate.split("+")[0]?.split("-")[0] ?? "";
  const actual = core.split(".");
  return (
    expected.length > 0 &&
    expected.every((segment, index) => actual[index] === segment)
  );
}

/**
 * Verify `build.cefCrate` against the `cef` dependency declared in
 * `crates/yolo-chromium/Cargo.toml`. Throws when the text has no `cef` entry.
 */
export function cefCrateMatchesCargo(
  lock: CefLock,
  cargoTomlText: string,
): boolean {
  const requirement = parseCargoCefVersion(cargoTomlText);
  if (!requirement) {
    throw new Error(
      'No `cef` dependency version found in Cargo.toml text; expected a line such as cef = { version = "156.3.0", ... }.',
    );
  }
  return cefCrateSatisfies(lock.build.cefCrate, requirement);
}

/** Findings-style wrapper around `cefCrateMatchesCargo` for CLI tables. */
export function checkCefCrateAgainstCargo(
  lock: CefLock,
  cargoTomlText: string,
  source = "Cargo.toml",
): CefLockFinding[] {
  const requirement = parseCargoCefVersion(cargoTomlText);
  if (!requirement) {
    return [
      {
        severity: "warn",
        code: "cargo.cef-version",
        path: "build.cefCrate",
        message: `No cef dependency version found in ${source}; build.cefCrate ${lock.build.cefCrate} could not be cross-checked.`,
      },
    ];
  }
  if (cefCrateSatisfies(lock.build.cefCrate, requirement)) return [];
  return [
    {
      severity: "error",
      code: "cargo.cef-crate",
      path: "build.cefCrate",
      message: `build.cefCrate ${lock.build.cefCrate} does not satisfy cef = "${requirement}" in ${source}.`,
    },
  ];
}
