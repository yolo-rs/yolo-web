// SPDX-License-Identifier: Apache-2.0
import { type BuildResult, build } from "../scripts/build.ts";

export { DIST_DIR, MANIFEST_PATH, PACKAGE_ROOT } from "../scripts/build.ts";

/** Upper bound for tests that wait for the shared build. */
export const BUILD_TIMEOUT_MS = 60_000;

let pending: Promise<BuildResult> | undefined;

/** Runs the build once per test process; every test file shares it. */
export function ensureBuilt(): Promise<BuildResult> {
  pending ??= build();
  return pending;
}
