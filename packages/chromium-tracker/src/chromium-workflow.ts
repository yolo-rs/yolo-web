import { runUpstreamTool } from "./upstream-tools";

export type ChromiumWorkspaceStatus = {
  root: string;
  state: "workspace-missing" | "sync-incomplete" | "source-ready";
  revision?: string;
  branch?: string;
  dirty?: boolean;
  tools: Record<string, string | null>;
};

function workspacePath(root: string, relative: string) {
  return `${root.replace(/[\\/]$/, "")}/${relative}`;
}

export async function inspectChromiumWorkspace(root: string): Promise<ChromiumWorkspaceStatus> {
  const tools = Object.fromEntries(["git", "gclient", "gn", "autoninja"].map((name) => [name, Bun.which(name)]));
  if (!(await Bun.file(workspacePath(root, ".gclient")).exists())) {
    return { root, state: "workspace-missing", tools };
  }
  if (!(await Bun.file(workspacePath(root, "src/DEPS")).exists())) {
    return { root, state: "sync-incomplete", tools };
  }

  const git = tools.git ?? "git";
  const cwd = workspacePath(root, "src");
  const [revision, branch, dirty] = await Promise.all([
    runUpstreamTool(git, ["rev-parse", "HEAD"], cwd),
    runUpstreamTool(git, ["branch", "--show-current"], cwd),
    runUpstreamTool(git, ["status", "--porcelain", "--untracked-files=no"], cwd),
  ]);
  return {
    root,
    state: "source-ready",
    revision,
    branch: branch || "(detached HEAD)",
    dirty: dirty.length > 0,
    tools,
  };
}

function assertOutputDirectory(outputDirectory: string) {
  const normalized = outputDirectory.replaceAll("\\", "/");
  if (!normalized.startsWith("out/") || normalized.split("/").includes("..")) {
    throw new Error("GN output must be a directory under src/out/, for example out/Default.");
  }
  return normalized;
}

export async function syncChromiumWorkspace(root: string, noHooks = false) {
  if (!(await Bun.file(workspacePath(root, ".gclient")).exists())) {
    throw new Error(`No .gclient file in ${root}; pass the Chromium fetch workspace root.`);
  }
  const gclient = Bun.which("gclient");
  if (!gclient) throw new Error("gclient was not found on PATH; configure depot_tools for this host.");
  await runUpstreamTool(gclient, ["sync", ...(noHooks ? ["--nohooks"] : [])], root, "inherit");
}

export async function generateChromiumBuild(root: string, outputDirectory: string, gnArgs: string) {
  const output = assertOutputDirectory(outputDirectory);
  if (!(await Bun.file(workspacePath(root, "src/DEPS")).exists())) {
    throw new Error(`Chromium sources are not ready under ${root}/src.`);
  }
  const gn = Bun.which("gn");
  if (!gn) throw new Error("gn was not found on PATH; configure depot_tools for this host.");
  await runUpstreamTool(gn, ["gen", output, `--args=${gnArgs}`], workspacePath(root, "src"), "inherit");
}

export async function buildChromiumTarget(root: string, outputDirectory: string, target = "chrome") {
  const output = assertOutputDirectory(outputDirectory);
  if (!/^[A-Za-z0-9_./:-]+$/.test(target) || target.startsWith("//")) {
    throw new Error("Pass a GN/Ninja target name without a leading //.");
  }
  const autoninja = Bun.which("autoninja");
  if (!autoninja) throw new Error("autoninja was not found on PATH; configure depot_tools for this host.");
  await runUpstreamTool(autoninja, ["-C", output, target], workspacePath(root, "src"), "inherit");
}
