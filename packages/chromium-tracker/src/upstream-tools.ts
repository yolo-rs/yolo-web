export type UpstreamOutputMode = "capture" | "inherit";

/** Run a native tool or a Windows batch wrapper with argv kept out of shell text. */
export async function runUpstreamTool(
  program: string,
  args: string[],
  cwd: string,
  mode: UpstreamOutputMode = "capture",
): Promise<string> {
  const env = { ...process.env, DEPOT_TOOLS_UPDATE: "0" };
  const windowsBatch = process.platform === "win32" && /\.(?:bat|cmd)$/i.test(program);
  const command = windowsBatch
    ? [
      Bun.which("powershell.exe") ?? "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference = 'Stop'; $toolArgs = ConvertFrom-Json -InputObject $env:YOLO_WEB_TOOL_ARGS; & $env:YOLO_WEB_TOOL_PROGRAM @toolArgs; exit $LASTEXITCODE",
    ]
    : [program, ...args];
  const child = Bun.spawn(command, {
    cwd,
    env: windowsBatch
      ? { ...env, YOLO_WEB_TOOL_PROGRAM: program, YOLO_WEB_TOOL_ARGS: JSON.stringify(args) }
      : env,
    stdin: "ignore",
    stdout: mode === "capture" ? "pipe" : "inherit",
    stderr: mode === "capture" ? "pipe" : "inherit",
    windowsHide: true,
  });

  if (mode === "inherit") {
    const exitCode = await child.exited;
    if (exitCode !== 0) throw new Error(`${program} exited with status ${exitCode}.`);
    return "";
  }

  if (!child.stdout || !child.stderr) {
    throw new Error(`${program} capture pipes were not created.`);
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`${program} ${args.join(" ")} failed (${exitCode}): ${stderr.trim() || stdout.trim()}`);
  }
  return stdout.trim();
}
