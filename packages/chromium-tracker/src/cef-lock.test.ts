import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cefCrateMatchesCargo,
  cefCrateSatisfies,
  cefPlatformFromHost,
  checkCefCrateAgainstCargo,
  latestStableCefVersion,
  parseCargoCefVersion,
  parseCefLock,
  parseCefVersion,
  readCefLock,
  validateCefLock,
  type CefLock,
  type CefLockFinding,
} from "./cef-lock";
import { parseCefLock as parseCefLockFromIndex, type CefIndex } from "./index";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const CEF_VERSION = "156.0.15+gcf671c0+chromium-156.0.8078.80";
const CHROMIUM_VERSION = "156.0.8078.80";
const COMMIT_HASH = "cf671c0d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b";
const API_HASH = "5b1c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c";
const SANDBOX_COMPAT = "3b66cadf26145637";
const ARCHIVE_NAME = `cef_binary_${CEF_VERSION}_windows64_minimal.tar.bz2`;
const ARCHIVE_SHA1 = "b690e035689ee20ba9d2500ac8953815bc7ed46a";

const CARGO_TOML = `[package]
name = "yolo-chromium"
version.workspace = true

[features]
default = ["sandbox"]
sandbox = ["cef/sandbox"]

[dependencies]
cef = { version = "156.3.0", default-features = false, features = ["resources"] }
serde = { workspace = true }
`;

function validLock(): CefLock {
  return {
    schemaVersion: 1,
    engine: "cef",
    capturedAt: "2026-11-04T10:00:00.000Z",
    host: { os: "windows", arch: "x86_64", target: "x86_64-pc-windows-msvc" },
    build: {
      crateVersion: "0.3.0",
      cefCrate: "156.3.0+156.0.15",
      target: "x86_64-pc-windows-msvc",
      sandbox: true,
      cef: {
        version: CEF_VERSION,
        major: 156,
        minor: 0,
        patch: 15,
        commitNumber: 3368,
        commitHash: COMMIT_HASH,
        chromiumVersion: CHROMIUM_VERSION,
        apiVersion: 15600,
        apiHash: API_HASH,
        sandboxCompatHash: SANDBOX_COMPAT,
        distributionDir: "C:\\cef\\cef_binary_156.0.15_windows64_minimal",
        archiveName: ARCHIVE_NAME,
        archiveSha1: ARCHIVE_SHA1,
      },
    },
    runtime: {
      cefVersion: CEF_VERSION,
      chromiumVersion: CHROMIUM_VERSION,
      apiHashPlatform: API_HASH,
      commitHash: COMMIT_HASH,
      sandboxCompatHash: SANDBOX_COMPAT,
      matchesBuild: true,
    },
    shell: {
      runtimeStyle: "chrome",
      views: true,
      sandbox: true,
      cachePath: null,
      remoteDebuggingPort: 9222,
      hostExecutable: "C:\\yolo-web\\target\\release\\yolo-chromium.exe",
    },
    smoke: {
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example Domain",
      httpStatus: 200,
      loadMs: 412,
      outcome: "loaded",
      error: null,
      exitCode: 0,
    },
  };
}

/** Receipt for a different published build, keeping every cross-field invariant intact. */
function lockFor(
  version: string,
  commitHash: string,
  chromiumVersion: string,
): CefLock {
  const lock = validLock();
  const parsed = parseCefVersion(version);
  if (!parsed) throw new Error(`fixture version ${version} is malformed`);
  lock.build.cefCrate = `156.3.0+${parsed.major}.${parsed.minor}.${parsed.patch}`;
  lock.build.cef.version = version;
  lock.build.cef.major = parsed.major;
  lock.build.cef.minor = parsed.minor;
  lock.build.cef.patch = parsed.patch;
  lock.build.cef.commitHash = commitHash;
  lock.build.cef.chromiumVersion = chromiumVersion;
  lock.build.cef.apiVersion = parsed.major * 100;
  lock.build.cef.archiveName = `cef_binary_${version}_windows64_minimal.tar.bz2`;
  lock.runtime.cefVersion = version;
  lock.runtime.commitHash = commitHash;
  lock.runtime.chromiumVersion = chromiumVersion;
  return lock;
}

const INDEX: CefIndex = {
  windows64: {
    versions: [
      {
        cef_version: "150.0.23+g4ccc4ca+chromium-150.0.7871.287",
        channel: "stable",
        chromium_version: "150.0.7871.287",
        sandbox_compat: "6c5b35ad81055c14",
        files: [],
      },
      {
        cef_version: CEF_VERSION,
        channel: "stable",
        chromium_version: CHROMIUM_VERSION,
        sandbox_compat: SANDBOX_COMPAT,
        files: [
          {
            type: "minimal",
            name: ARCHIVE_NAME,
            sha1: ARCHIVE_SHA1,
            size: 1,
            last_modified: "2026-10-30T00:00:00.000000Z",
          },
          {
            type: "standard",
            name: `cef_binary_${CEF_VERSION}_windows64.tar.bz2`,
            sha1: "dec540c7236c7c98c033f78618c010e3ae322f82",
          },
        ],
      },
      {
        cef_version: "156.0.14+g4fa4ab5+chromium-156.0.8078.48",
        channel: "stable",
        chromium_version: "156.0.8078.48",
        sandbox_compat: SANDBOX_COMPAT,
        files: [],
      },
      {
        cef_version: "157.0.3+gabcdef0+chromium-157.0.8100.20",
        channel: "beta",
        chromium_version: "157.0.8100.20",
        sandbox_compat: SANDBOX_COMPAT,
        files: [],
      },
    ],
  },
};

const codes = (findings: CefLockFinding[]) =>
  findings.map((finding) => `${finding.severity}:${finding.code}`);

describe("CEF lock receipt parsing", () => {
  test("accepts a valid receipt as JSON text or as a decoded value", () => {
    const lock = validLock();
    expect(parseCefLock(JSON.stringify(lock))).toEqual(lock);
    expect(parseCefLock(JSON.parse(JSON.stringify(lock)))).toEqual(lock);
    expect(parseCefLockFromIndex(lock)).toEqual(lock);
    // The Rust writer adds keys beyond this schema (e.g. `cdp`); they are ignored.
    expect(parseCefLock({ ...lock, cdp: null })).toEqual(lock);
  });

  test("names the missing or mistyped field in the error", () => {
    const missing = validLock() as unknown as {
      build: { cef: Record<string, unknown> };
    };
    delete missing.build.cef.archiveSha1;
    expect(() => parseCefLock(missing)).toThrow(
      "build.cef.archiveSha1 must be a non-empty string (got missing)",
    );

    const mistyped = validLock() as unknown as {
      smoke: Record<string, unknown>;
    };
    mistyped.smoke.exitCode = "0";
    expect(() => parseCefLock(mistyped)).toThrow(
      'smoke.exitCode must be an integer (got string "0")',
    );

    const noError = validLock() as unknown as {
      smoke: Record<string, unknown>;
    };
    delete noError.smoke.error;
    expect(() => parseCefLock(noError)).toThrow(
      "smoke.error must be present (null when unset)",
    );

    expect(() => parseCefLock({ ...validLock(), schemaVersion: 2 })).toThrow(
      "schemaVersion must be one of 1",
    );
    expect(() => parseCefLock({ ...validLock(), engine: "chromium" })).toThrow(
      'engine must be one of "cef"',
    );
    const outcome = validLock();
    (outcome.smoke as { outcome: string }).outcome = "crashed";
    expect(() => parseCefLock(outcome)).toThrow(
      'smoke.outcome must be one of "loaded", "load-error", "timeout"',
    );
    expect(() => parseCefLock("{")).toThrow("not valid JSON");
    expect(() => parseCefLock([])).toThrow("receipt must be an object");
    expect(() => parseCefLock({ ...validLock(), host: null })).toThrow(
      "host must be an object (got null)",
    );
  });

  test("readCefLock explains a missing receipt", async () => {
    await expect(
      readCefLock(join(tmpdir(), "yolo-web-no-such-cef.lock.json")),
    ).rejects.toThrow("CEF lock receipt not found");
  });
});

describe("CEF lock receipt validation", () => {
  test("reports nothing for a consistent receipt from a healthy smoke run", () => {
    expect(validateCefLock(validLock(), { now: NOW })).toEqual([]);
  });

  test("flags malformed archive SHA-1 and API hashes", () => {
    const lock = validLock();
    lock.build.cef.archiveSha1 = "abc";
    lock.build.cef.apiHash = "ZZ" + API_HASH.slice(2);
    const findings = validateCefLock(lock, { now: NOW });
    expect(codes(findings)).toEqual(
      expect.arrayContaining(["error:cef.archive-sha1", "error:cef.api-hash"]),
    );

    const upper = validLock();
    upper.build.cef.archiveSha1 = ARCHIVE_SHA1.toUpperCase();
    expect(validateCefLock(upper, { now: NOW })).toEqual([]);
  });

  test("flags a failed smoke run", () => {
    const failed = validLock();
    failed.smoke.outcome = "load-error";
    failed.smoke.error = { code: -105, text: "ERR_NAME_NOT_RESOLVED" };
    failed.smoke.exitCode = 1;
    const findings = validateCefLock(failed, { now: NOW });
    expect(codes(findings)).toEqual([
      "error:smoke.outcome",
      "error:smoke.exit-code",
    ]);
    expect(findings[0]?.message).toContain("ERR_NAME_NOT_RESOLVED");

    const timeout = validLock();
    timeout.smoke.outcome = "timeout";
    expect(codes(validateCefLock(timeout, { now: NOW }))).toEqual([
      "error:smoke.outcome",
    ]);

    const noisy = validLock();
    noisy.smoke.error = { code: 0, text: "" };
    noisy.smoke.httpStatus = 404;
    expect(codes(validateCefLock(noisy, { now: NOW }))).toEqual([
      "warn:smoke.error",
      "warn:smoke.http-status",
    ]);
  });

  test("flags build/runtime version mismatches", () => {
    const runtime = validLock();
    runtime.runtime.matchesBuild = false;
    runtime.runtime.chromiumVersion = "156.0.8078.48";
    runtime.runtime.cefVersion = "156.0.14+g4fa4ab5+chromium-156.0.8078.48";
    expect(codes(validateCefLock(runtime, { now: NOW }))).toEqual([
      "error:runtime.matches-build",
      "error:runtime.cef-version",
      "error:runtime.chromium-version",
    ]);

    const build = validLock();
    build.build.cef.chromiumVersion = "156.0.8078.48";
    expect(codes(validateCefLock(build, { now: NOW }))).toEqual([
      "error:cef.chromium-version",
      "error:runtime.chromium-version",
    ]);

    const numbers = validLock();
    numbers.build.cef.major = 155;
    expect(codes(validateCefLock(numbers, { now: NOW }))).toEqual([
      "error:cef.version-numbers",
      "error:cef.chromium-major",
      "warn:cef.api-version",
    ]);

    const commit = validLock();
    commit.build.cef.commitHash = "deadbeef".repeat(5);
    expect(codes(validateCefLock(commit, { now: NOW }))).toEqual([
      "error:cef.commit-hash",
      "error:runtime.commit-hash",
    ]);

    const malformed = validLock();
    malformed.build.cef.version = "156.0.15";
    malformed.runtime.cefVersion = "156.0.15";
    expect(codes(validateCefLock(malformed, { now: NOW }))).toEqual([
      "error:cef.version",
    ]);

    const renamed = validLock();
    renamed.build.cef.archiveName = "cef_binary_windows64_minimal.tar.bz2";
    expect(codes(validateCefLock(renamed, { now: NOW }))).toEqual([
      "warn:cef.archive-name",
    ]);
  });

  test("warns when the sandbox is disabled", () => {
    const disabled = validLock();
    disabled.build.sandbox = false;
    disabled.shell.sandbox = false;
    expect(codes(validateCefLock(disabled, { now: NOW }))).toEqual([
      "warn:sandbox.build",
      "warn:sandbox.shell",
    ]);

    const inconsistent = validLock();
    inconsistent.build.sandbox = false;
    expect(codes(validateCefLock(inconsistent, { now: NOW }))).toEqual([
      "warn:sandbox.build",
      "warn:sandbox.mismatch",
    ]);
  });

  test("rejects capturedAt values that are unparseable or in the future", () => {
    const garbage = validLock();
    garbage.capturedAt = "yesterday";
    expect(codes(validateCefLock(garbage, { now: NOW }))).toEqual([
      "error:captured-at",
    ]);

    const nonIso = validLock();
    nonIso.capturedAt = "Nov 4 2026 10:00";
    expect(codes(validateCefLock(nonIso, { now: NOW }))).toEqual([
      "error:captured-at",
    ]);

    const future = validLock();
    future.capturedAt = "2026-11-04T12:30:00.000Z";
    const findings = validateCefLock(future, { now: NOW });
    expect(codes(findings)).toEqual(["error:captured-at"]);
    expect(findings[0]?.message).toContain("in the future");

    const skew = validLock();
    skew.capturedAt = "2026-11-04T12:00:30.000Z";
    expect(validateCefLock(skew, { now: NOW })).toEqual([]);
    expect(codes(validateCefLock(skew, { now: NOW, clockSkewMs: 0 }))).toEqual([
      "error:captured-at",
    ]);

    const offset = validLock();
    offset.capturedAt = "2026-11-04T13:00:00+01:00";
    expect(validateCefLock(offset, { now: NOW })).toEqual([]);
  });

  test("warns on experimental or foreign CEF API versions", () => {
    const experimental = validLock();
    experimental.build.cef.apiVersion = 999999;
    const findings = validateCefLock(experimental, { now: NOW });
    expect(codes(findings)).toEqual(["warn:cef.api-version"]);
    expect(findings[0]?.message).toContain("experimental");

    const foreign = validLock();
    foreign.build.cef.apiVersion = 15500;
    expect(codes(validateCefLock(foreign, { now: NOW }))).toEqual([
      "warn:cef.api-version",
    ]);
  });

  test("accepts the short MAJOR.MINOR.PATCH form of runtime.cefVersion", () => {
    const short = validLock();
    short.runtime.cefVersion = "156.0.15";
    expect(validateCefLock(short, { now: NOW })).toEqual([]);

    const stale = validLock();
    stale.runtime.cefVersion = "156.0.14";
    expect(codes(validateCefLock(stale, { now: NOW }))).toEqual([
      "error:runtime.cef-version",
    ]);

    const garbage = validLock();
    garbage.runtime.cefVersion = "unknown";
    expect(codes(validateCefLock(garbage, { now: NOW }))).toEqual([
      "error:runtime.cef-version",
    ]);
  });

  test("warns when the runtime platform hash disagrees with the build hash", () => {
    const lock = validLock();
    lock.runtime.apiHashPlatform = "0".repeat(40);
    expect(codes(validateCefLock(lock, { now: NOW }))).toEqual([
      "warn:runtime.api-hash",
    ]);
  });

  test("rejects a foreign engine on hand-built receipts", () => {
    const lock = { ...validLock(), engine: "chromium" as "cef" };
    expect(codes(validateCefLock(lock, { now: NOW }))).toEqual([
      "error:engine",
    ]);
  });
});

describe("CEF lock receipt against the Spotify CEF index", () => {
  test("accepts a published stable build with a matching archive digest", () => {
    expect(validateCefLock(validLock(), { now: NOW, cefIndex: INDEX })).toEqual(
      [],
    );
  });

  test("derives the platform from the host or takes an override", () => {
    const override = validateCefLock(validLock(), {
      now: NOW,
      cefIndex: INDEX,
      platform: "linux64",
    });
    expect(codes(override)).toEqual(["error:index.platform"]);
    expect(override[0]?.message).toContain("linux64");

    const unknownHost = validLock();
    unknownHost.host = {
      os: "plan9",
      arch: "mips",
      target: "mips-unknown-plan9",
    };
    const findings = validateCefLock(unknownHost, {
      now: NOW,
      cefIndex: INDEX,
    });
    expect(codes(findings)).toEqual(["error:index.platform"]);
    expect(findings[0]?.message).toContain("pass an explicit platform");
  });

  test("flags unpublished versions, foreign digests and newer stable builds", () => {
    const older = lockFor(
      "156.0.14+g4fa4ab5+chromium-156.0.8078.48",
      "4fa4ab5" + "0".repeat(33),
      "156.0.8078.48",
    );
    const olderFindings = validateCefLock(older, { now: NOW, cefIndex: INDEX });
    expect(codes(olderFindings)).toEqual([
      "warn:index.archive",
      "warn:index.newer-stable",
    ]);
    expect(olderFindings[1]?.message).toContain(CEF_VERSION);

    const unpublished = lockFor(
      "156.0.16+g0123abc+chromium-156.0.8078.80",
      "0123abc" + "0".repeat(33),
      CHROMIUM_VERSION,
    );
    expect(
      codes(validateCefLock(unpublished, { now: NOW, cefIndex: INDEX })),
    ).toEqual(["error:index.version"]);

    const digest = validLock();
    digest.build.cef.archiveSha1 = "f".repeat(40);
    expect(
      codes(validateCefLock(digest, { now: NOW, cefIndex: INDEX })),
    ).toEqual(["error:index.archive-sha1"]);

    const compat = validLock();
    compat.build.cef.sandboxCompatHash = "0123456789abcdef";
    compat.runtime.sandboxCompatHash = "0123456789abcdef";
    expect(
      codes(validateCefLock(compat, { now: NOW, cefIndex: INDEX })),
    ).toEqual(["warn:index.sandbox-compat"]);

    const beta = lockFor(
      "157.0.3+gabcdef0+chromium-157.0.8100.20",
      "abcdef0" + "0".repeat(33),
      "157.0.8100.20",
    );
    expect(codes(validateCefLock(beta, { now: NOW, cefIndex: INDEX }))).toEqual(
      ["warn:index.channel", "warn:index.archive"],
    );
  });

  test("latestStableCefVersion ignores the index order and beta builds", () => {
    expect(latestStableCefVersion(INDEX, "windows64")?.cef_version).toBe(
      CEF_VERSION,
    );
    expect(latestStableCefVersion(INDEX, "linux64")).toBeUndefined();
  });

  test("maps Rust and Node host names to CEF platform IDs", () => {
    expect(
      cefPlatformFromHost({
        os: "windows",
        arch: "x86_64",
        target: "x86_64-pc-windows-msvc",
      }),
    ).toBe("windows64");
    expect(
      cefPlatformFromHost({
        os: "darwin",
        arch: "arm64",
        target: "aarch64-apple-darwin",
      }),
    ).toBe("macosarm64");
    expect(
      cefPlatformFromHost({
        os: "linux",
        arch: "aarch64",
        target: "aarch64-unknown-linux-gnu",
      }),
    ).toBe("linuxarm64");
    expect(
      cefPlatformFromHost({
        os: "linux",
        arch: "armv7",
        target: "armv7-unknown-linux-gnueabihf",
      }),
    ).toBe("linuxarm");
    expect(cefPlatformFromHost({ os: "win32", arch: "ia32", target: "" })).toBe(
      "windows32",
    );
    expect(
      cefPlatformFromHost({
        os: "",
        arch: "",
        target: "x86_64-unknown-linux-gnu",
      }),
    ).toBe("linux64");
    expect(
      cefPlatformFromHost({ os: "windows", arch: "arm", target: "" }),
    ).toBeUndefined();
    expect(
      cefPlatformFromHost({ os: "plan9", arch: "mips", target: "" }),
    ).toBeUndefined();
  });
});

describe("cef crate version against Cargo.toml", () => {
  test("reads the cef dependency in every supported TOML form", () => {
    expect(parseCargoCefVersion(CARGO_TOML)).toBe("156.3.0");
    expect(parseCargoCefVersion('[dependencies]\ncef = "156.3.0"\n')).toBe(
      "156.3.0",
    );
    expect(
      parseCargoCefVersion('[dependencies]\ncef.version = "^156.3"\n'),
    ).toBe("^156.3");
    expect(
      parseCargoCefVersion(
        '[dependencies.cef]\nversion = "156.3.0"\ndefault-features = false\n\n[dev-dependencies]\nserde = "1"\n',
      ),
    ).toBe("156.3.0");
    expect(
      parseCargoCefVersion(
        "[target.'cfg(windows)'.dependencies.cef]\nversion = \"156.3.0\"\n",
      ),
    ).toBe("156.3.0");
    expect(parseCargoCefVersion('[dependencies]\nserde = "1"\n')).toBeNull();
  });

  test("verifies build.cefCrate against the manifest requirement", () => {
    expect(cefCrateMatchesCargo(validLock(), CARGO_TOML)).toBe(true);
    expect(
      cefCrateMatchesCargo(
        validLock(),
        '[dependencies]\ncef = { version = "157.0.0" }\n',
      ),
    ).toBe(false);
    expect(() =>
      cefCrateMatchesCargo(validLock(), '[dependencies]\nserde = "1"\n'),
    ).toThrow("No `cef` dependency version found");
  });

  test("compares requirement components, not raw string prefixes", () => {
    expect(cefCrateSatisfies("156.3.0+156.0.15", "^156.3")).toBe(true);
    expect(cefCrateSatisfies("156.3.0+156.0.15", "=156.3.0")).toBe(true);
    expect(cefCrateSatisfies("156.3.0+156.0.15", "~156.3.0")).toBe(true);
    expect(cefCrateSatisfies("156.3.0+156.0.15", "156.*")).toBe(true);
    expect(cefCrateSatisfies("156.3.0-beta.1+156.0.15", "156.3.0")).toBe(true);
    expect(cefCrateSatisfies("156.30.1+156.0.15", "156.3")).toBe(false);
    expect(cefCrateSatisfies("156.3.0+156.0.15", "156.3.1")).toBe(false);
    expect(() => cefCrateSatisfies("156.3.0", ">=156, <157")).toThrow(
      "Unsupported cef version requirement",
    );
  });

  test("renders the manifest check as findings", () => {
    expect(checkCefCrateAgainstCargo(validLock(), CARGO_TOML)).toEqual([]);
    const mismatch = checkCefCrateAgainstCargo(
      validLock(),
      '[dependencies]\ncef = "157.0.0"\n',
      "crates/yolo-chromium/Cargo.toml",
    );
    expect(codes(mismatch)).toEqual(["error:cargo.cef-crate"]);
    expect(mismatch[0]?.message).toContain("crates/yolo-chromium/Cargo.toml");
    expect(
      codes(
        checkCefCrateAgainstCargo(validLock(), '[dependencies]\nserde = "1"\n'),
      ),
    ).toEqual(["warn:cargo.cef-version"]);
  });
});

describe("cef lock CLI", () => {
  const cli = join(import.meta.dir, "cli.ts");
  let dir = "";
  let cargoPath = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "yolo-cef-lock-"));
    cargoPath = join(dir, "Cargo.toml");
    await Bun.write(cargoPath, CARGO_TOML);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function run(args: string[]) {
    const proc = Bun.spawn([process.execPath, cli, "cef", "lock", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }

  test("exits 0 with no findings for a healthy receipt (offline)", async () => {
    const receipt = join(dir, "healthy.cef.lock.json");
    const lock = validLock();
    lock.capturedAt = new Date().toISOString();
    await Bun.write(receipt, JSON.stringify(lock, null, 2));
    const result = await run([receipt, "--json", "--cargo", cargoPath]);
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      platform: string | null;
      index: string;
      findings: CefLockFinding[];
    };
    expect(report.ok).toBe(true);
    expect(report.platform).toBe("windows64");
    expect(report.index).toBe("offline");
    expect(report.findings).toEqual([]);
  });

  test("exits 1 and prints a table when the smoke run failed", async () => {
    const receipt = join(dir, "failed.cef.lock.json");
    const lock = validLock();
    lock.capturedAt = new Date().toISOString();
    lock.smoke.outcome = "timeout";
    lock.smoke.exitCode = 3;
    await Bun.write(receipt, JSON.stringify(lock));
    const result = await run([receipt, "--cargo", cargoPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("smoke.outcome");
    expect(result.stdout).toContain("2 error(s), 0 warning(s) - FAILED");
  });

  test("treats warnings as failures only with --strict", async () => {
    const receipt = join(dir, "nosandbox.cef.lock.json");
    const lock = validLock();
    lock.capturedAt = new Date().toISOString();
    lock.build.sandbox = false;
    lock.shell.sandbox = false;
    await Bun.write(receipt, JSON.stringify(lock));
    const lenient = await run([receipt, "--json", "--cargo", cargoPath]);
    expect(lenient.exitCode).toBe(0);
    const strict = await run([
      receipt,
      "--json",
      "--cargo",
      cargoPath,
      "--strict",
    ]);
    expect(strict.exitCode).toBe(1);
    const report = JSON.parse(strict.stdout) as {
      errors: number;
      warnings: number;
    };
    expect(report).toMatchObject({ errors: 0, warnings: 2 });
  });

  test("fails with a clear message for a missing receipt or Cargo manifest", async () => {
    const missing = await run([
      join(dir, "missing.json"),
      "--cargo",
      cargoPath,
    ]);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("CEF lock receipt not found");

    const receipt = join(dir, "healthy.cef.lock.json");
    const noManifest = await run([receipt, "--cargo", join(dir, "nope.toml")]);
    expect(noManifest.exitCode).toBe(1);
    expect(noManifest.stderr).toContain("Cargo manifest not found");
  });
});
