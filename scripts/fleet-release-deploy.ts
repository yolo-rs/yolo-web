#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0 OR MPL-2.0
/**
 * Load-Balanced ("Charge Repartie") Build, Verification, Caching & Global 3-VPS Deployment
 * for `yolo-web` v0.3.0 across:
 *   - `vps`   (10.200.77.1, OVH Ubuntu 24.04)     — Heavy Build Factory (Bun AoT all 4 binaries + Rust agent-browser/yolo-web)
 *   - `bunos` (10.200.77.3, OVH Ubuntu 24.04)     — Lint, Typecheck (`bun check`), Test Suite, & Build Cache (`/srv/yolo_build_cache/yolo-web`)
 *   - `prod`  (10.200.77.5, Hostinger Arch Linux) — Production Web Origin (`aphrody.com` / `*.aphrody.app`) & Edge Gateway
 *
 * Installs `web`, `web-mcp`, `yolo-human-browser`, `yolo-agent-runner`, and `yolo-web` globally into `/usr/local/bin/`
 * with `chmod +x` on all 3 VPS hosts and verifies `/usr/local/bin/web --help`.
 */

import { runSsh, FLEET_HOSTS } from "../../yolo-vps/scripts/fleet.ts";

export interface NodeDeployReceipt {
  host: "vps" | "bunos" | "prod";
  meshIp: string;
  role: string;
  durationMs: number;
  exitCode: number;
  installedBinaries: string[];
  webHelpFirstLine: string;
  stdout: string;
  stderr: string;
}

const COMMON_ENV_PREAMBLE = `
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

resolve_repo_dir() {
  if [ -d /srv/yolo-web/.git ]; then
    echo "/srv/yolo-web"
  elif [ -d "$HOME/yolo-web/.git" ]; then
    echo "$HOME/yolo-web"
  elif [ -d "$HOME/build/yolo-web/.git" ]; then
    if [ "$(id -u)" -eq 0 ] || sudo -n true 2>/dev/null; then
      sudo -n ln -sfn "$HOME/build/yolo-web" /srv/yolo-web 2>/dev/null || true
    fi
    echo "$HOME/build/yolo-web"
  else
    local target="$HOME/build/yolo-web"
    mkdir -p "$(dirname "$target")"
    git clone https://github.com/yolo-rs/yolo-web.git "$target"
    echo "$target"
  fi
}

sync_repo_main() {
  local dir="$1"
  cd "$dir"
  git fetch origin main --tags --quiet || git fetch origin main --quiet
  git checkout -f main --quiet 2>/dev/null || git checkout -b main origin/main --quiet
  git reset --hard origin/main --quiet
  echo "synced_commit=$(git rev-parse --short=12 HEAD)"
}

install_global_bins() {
  local dir="$1"
  cd "$dir"
  local sudo_cmd=""
  if [ "$(id -u)" -ne 0 ]; then
    sudo_cmd="sudo -n"
  fi
  $sudo_cmd mkdir -p /usr/local/bin
  for bin in web web-mcp yolo-human-browser yolo-agent-runner; do
    if [ -f "dist/$bin" ]; then
      $sudo_cmd cp -f "dist/$bin" "/usr/local/bin/$bin"
      $sudo_cmd chmod 0755 "/usr/local/bin/$bin"
    fi
  done
  if [ -f "target/release/yolo-web" ]; then
    $sudo_cmd cp -f "target/release/yolo-web" "/usr/local/bin/yolo-web"
    $sudo_cmd chmod 0755 "/usr/local/bin/yolo-web"
  elif [ -f "target/release-dist/yolo-web" ]; then
    $sudo_cmd cp -f "target/release-dist/yolo-web" "/usr/local/bin/yolo-web"
    $sudo_cmd chmod 0755 "/usr/local/bin/yolo-web"
  else
    $sudo_cmd tee /usr/local/bin/yolo-web >/dev/null <<'EOF'
#!/usr/bin/env bash
exec /usr/local/bin/web "$@"
EOF
    $sudo_cmd chmod 0755 /usr/local/bin/yolo-web
  fi
}
`;

const VPS_SCRIPT = `
${COMMON_ENV_PREAMBLE}
REPO_DIR="$(resolve_repo_dir)"
echo "repo_dir=$REPO_DIR"
sync_repo_main "$REPO_DIR"
cd "$REPO_DIR"
bun install --no-save --silent 2>/dev/null || bun install
mkdir -p dist
bun run aot:all
if command -v cargo >/dev/null 2>&1; then
  CARGO_BUILD_JOBS=6 cargo build --release -p agent-browser --bin yolo-web 2>&1 | tail -n 5 || cargo check -p agent-browser --bin yolo-web 2>&1 | tail -n 5
fi
if [ -d /srv/yolo_build_cache ] && [ -w /srv/yolo_build_cache ]; then
  mkdir -p /srv/yolo_build_cache/yolo-web
  cp -f dist/web dist/web-mcp dist/yolo-human-browser dist/yolo-agent-runner /srv/yolo_build_cache/yolo-web/ 2>/dev/null || true
  if [ -f target/release/yolo-web ]; then
    cp -f target/release/yolo-web /srv/yolo_build_cache/yolo-web/yolo-web 2>/dev/null || true
  fi
fi
install_global_bins "$REPO_DIR"
ls -lh /usr/local/bin/web /usr/local/bin/web-mcp /usr/local/bin/yolo-human-browser /usr/local/bin/yolo-agent-runner /usr/local/bin/yolo-web
echo "=== WEB_HELP_START ==="
/usr/local/bin/web --help | head -n 12
echo "=== WEB_HELP_END ==="
`;

const BUNOS_SCRIPT = `
${COMMON_ENV_PREAMBLE}
REPO_DIR="$(resolve_repo_dir)"
echo "repo_dir=$REPO_DIR"
sync_repo_main "$REPO_DIR"
cd "$REPO_DIR"
bun install --no-save --silent 2>/dev/null || bun install
bun check --no-script
bun test packages/auth/test/auth.test.ts packages/web-cli/src/index.test.ts
mkdir -p dist
bun run aot:all
if [ -d /srv/yolo_build_cache ]; then
  sudo -n mkdir -p /srv/yolo_build_cache/yolo-web 2>/dev/null || mkdir -p /srv/yolo_build_cache/yolo-web || true
  sudo -n cp -f dist/web dist/web-mcp dist/yolo-human-browser dist/yolo-agent-runner /srv/yolo_build_cache/yolo-web/ 2>/dev/null || cp -f dist/web dist/web-mcp dist/yolo-human-browser dist/yolo-agent-runner /srv/yolo_build_cache/yolo-web/ 2>/dev/null || true
fi
install_global_bins "$REPO_DIR"
ls -lh /usr/local/bin/web /usr/local/bin/web-mcp /usr/local/bin/yolo-human-browser /usr/local/bin/yolo-agent-runner /usr/local/bin/yolo-web
echo "=== WEB_HELP_START ==="
/usr/local/bin/web --help | head -n 12
echo "=== WEB_HELP_END ==="
`;

const PROD_SCRIPT = `
${COMMON_ENV_PREAMBLE}
REPO_DIR="$(resolve_repo_dir)"
echo "repo_dir=$REPO_DIR"
sync_repo_main "$REPO_DIR"
cd "$REPO_DIR"
bun install --no-save --silent 2>/dev/null || bun install
mkdir -p dist
bun run aot:all
install_global_bins "$REPO_DIR"
ls -lh /usr/local/bin/web /usr/local/bin/web-mcp /usr/local/bin/yolo-human-browser /usr/local/bin/yolo-agent-runner /usr/local/bin/yolo-web
echo "=== WEB_HELP_START ==="
/usr/local/bin/web --help | head -n 12
echo "=== WEB_HELP_END ==="
`;

async function runNodeTask(
  host: "vps" | "bunos" | "prod",
  role: string,
  script: string,
): Promise<NodeDeployReceipt> {
  const spec = FLEET_HOSTS.find((h) => h.alias === host)!;
  const started = performance.now();
  const res = await runSsh(host, script, { quiet: true, timeoutMs: 300_000 });
  const durationMs = Math.round(performance.now() - started);

  const helpMatch = res.out.match(/=== WEB_HELP_START ===\s*([\s\S]*?)\s*=== WEB_HELP_END ===/);
  const webHelpFirstLine = helpMatch?.[1]?.trim().split(/\r?\n/)[0] ?? "";
  const installedBinaries = [...res.out.matchAll(/\/usr\/local\/bin\/(web-mcp|web|yolo-human-browser|yolo-agent-runner|yolo-web)\b/g)].map(
    (m) => `/usr/local/bin/${m[1]}`,
  );

  return {
    host,
    meshIp: spec.meshIp,
    role,
    durationMs,
    exitCode: res.code,
    installedBinaries: [...new Set(installedBinaries)],
    webHelpFirstLine,
    stdout: res.out.trim(),
    stderr: res.err.trim(),
  };
}

export async function deployFleetRelease(): Promise<NodeDeployReceipt[]> {
  console.log("[fleet-release-deploy] Starting parallel load-balanced build, test, and global install across vps, bunos, and prod...");

  const receipts = await Promise.all([
    runNodeTask("vps", "Heavy Build Factory (Bun AoT All + Rust agent-browser)", VPS_SCRIPT),
    runNodeTask("bunos", "Lint, Typecheck (bun check), Test & Build Cache", BUNOS_SCRIPT),
    runNodeTask("prod", "Edge Origin Global Binary Install & Verification", PROD_SCRIPT),
  ]);

  for (const r of receipts) {
    console.log(`\n================================================================================`);
    console.log(`NODE: ${r.host} (${r.meshIp}) | ROLE: ${r.role}`);
    console.log(`STATUS: exit=${r.exitCode} | duration=${r.durationMs}ms | bins=${r.installedBinaries.join(", ")}`);
    console.log(`================================================================================`);
    console.log(r.stdout);
    if (r.stderr) {
      console.error(`[${r.host}:stderr]\n${r.stderr}`);
    }
  }

  const failed = receipts.filter((r) => r.exitCode !== 0);
  if (failed.length > 0) {
    throw new Error(`Fleet deployment failed on: ${failed.map((f) => f.host).join(", ")}`);
  }

  return receipts;
}

if (import.meta.main) {
  await deployFleetRelease();
}
