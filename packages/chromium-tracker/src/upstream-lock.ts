import { runUpstreamTool } from "./upstream-tools";

/** Capture a reproducible Chromium + gclient source snapshot without changing it. */
export type ChromiumSourceLock = {
  schemaVersion: 1;
  engine: "chromium";
  capturedAt: string;
  chromium: {
    revision: string;
    branch: string;
    dirty: boolean;
    depsSha256: string;
  };
  depotTools?: { revision?: string };
  build?: { outputDirectory: string; gnArgs: string };
  dependencySnapshot: unknown;
};

async function sha256(filePath: string): Promise<string> {
  const bytes = await Bun.file(filePath).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Read the checked-out Chromium revision, source cleanliness, DEPS digest, and
 * gclient's actual recursive dependency snapshot. The function is read-only.
 */
export async function captureChromiumSourceLock(
  chromiumRoot: string,
  options: { outputDirectory?: string } = {},
): Promise<ChromiumSourceLock> {
  const root = chromiumRoot.replace(/[\\/]$/, "");
  if (!(await Bun.file(`${root}/.gclient`).exists())) {
    throw new Error(
      `No .gclient file at ${root}; pass the Chromium fetch workspace root, not src/.`,
    );
  }
  if (!(await Bun.file(`${root}/src/DEPS`).exists())) {
    throw new Error(
      `No src/DEPS file at ${root}/src; Chromium fetch/gclient sync is incomplete.`,
    );
  }

  const gclient = Bun.which("gclient") ?? "gclient";
  const gclientPath = gclient.replaceAll("\\", "/");
  const toolDirectory = /\/gclient(?:\.bat|\.cmd|\.exe)?$/i.test(gclientPath)
    ? gclientPath.slice(0, gclientPath.lastIndexOf("/"))
    : undefined;
  const [
    revision,
    branch,
    dirtyOutput,
    depsSha256,
    dependencyJson,
    depotRevision,
  ] = await Promise.all([
    runUpstreamTool(
      Bun.which("git") ?? "git",
      ["rev-parse", "HEAD"],
      `${root}/src`,
    ),
    runUpstreamTool(
      Bun.which("git") ?? "git",
      ["branch", "--show-current"],
      `${root}/src`,
    ),
    runUpstreamTool(
      Bun.which("git") ?? "git",
      ["status", "--porcelain"],
      `${root}/src`,
    ),
    sha256(`${root}/src/DEPS`),
    // Avoid --snapshot here: depot_tools recursively tries to pin optional
    // private DEPS entries that are intentionally absent from public checkouts.
    // --actual still returns the resolved revisions for every active checkout.
    runUpstreamTool(
      gclient,
      ["revinfo", "--actual", "--output-json", "-"],
      root,
    ),
    toolDirectory
      ? runUpstreamTool(
          Bun.which("git") ?? "git",
          ["rev-parse", "HEAD"],
          toolDirectory,
        ).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  let dependencySnapshot: unknown;
  try {
    dependencySnapshot = JSON.parse(dependencyJson);
  } catch {
    throw new Error(
      "gclient revinfo --actual did not produce JSON; confirm depot_tools is initialized and the public DEPS sync completed.",
    );
  }

  const lock: ChromiumSourceLock = {
    schemaVersion: 1,
    engine: "chromium",
    capturedAt: new Date().toISOString(),
    chromium: {
      revision,
      branch: branch || "(detached HEAD)",
      dirty: dirtyOutput.length > 0,
      depsSha256,
    },
    ...(toolDirectory ? { depotTools: { revision: depotRevision } } : {}),
    dependencySnapshot,
  };

  if (options.outputDirectory) {
    const gn = Bun.which("gn");
    if (!gn)
      throw new Error(
        "GN was not found on PATH; add depot_tools before capturing GN args.",
      );
    const gnArgs = await runUpstreamTool(
      gn,
      ["args", options.outputDirectory, "--list"],
      `${root}/src`,
    );
    lock.build = { outputDirectory: options.outputDirectory, gnArgs };
  }
  return lock;
}
