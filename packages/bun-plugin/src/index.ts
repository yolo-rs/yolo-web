// SPDX-License-Identifier: MIT
import type { BunPlugin, PluginBuilder } from "bun";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type ModuleTarget = string | URL;

export interface BunPluginSpec {
  name: string;
  modules?: Record<string, ModuleTarget>;
  setup?: (build: PluginBuilder) => void | Promise<void>;
}

function targetPath(target: ModuleTarget): string {
  if (target instanceof URL) return Bun.fileURLToPath(target);
  return target.startsWith("file:") ? Bun.fileURLToPath(target) : target;
}

function forwarder(path: string): string {
  const normalized = JSON.stringify(path.replaceAll("\\", "/"));
  return `export * from ${normalized};\nexport { default } from ${normalized};\n`;
}

function isRuntimeBuiltin(specifier: string): boolean {
  try {
    return Bun.resolveSync(specifier, import.meta.dir) !== undefined;
  } catch {
    return false;
  }
}

function resolvesFrom(specifier: string, dir: string): boolean {
  const parts = specifier.split("/");
  const name = specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0]!;
  for (let current = resolve(dir); ; current = dirname(current)) {
    if (existsSync(join(current, "node_modules", name, "package.json")))
      return true;
    if (dirname(current) === current) return false;
  }
}

/** Define an explicit Bun plugin that maps virtual specifiers to package-owned ESM modules. */
export function defineBunPlugin(spec: BunPluginSpec): BunPlugin {
  return {
    name: spec.name,
    target: "bun",
    async setup(build) {
      for (const [specifier, target] of Object.entries(spec.modules ?? {})) {
        if (specifier.startsWith("bun:") && isRuntimeBuiltin(specifier))
          continue;
        if (
          !specifier.startsWith("bun:") &&
          resolvesFrom(specifier, process.cwd())
        )
          continue;
        const contents = forwarder(targetPath(target));
        build.module(specifier, () => ({ contents, loader: "js" }));
      }
      await spec.setup?.(build);
    },
  };
}
