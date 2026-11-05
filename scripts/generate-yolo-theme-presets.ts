#!/usr/bin/env bun

type DtcgValue = { $value?: string };
type ThemeDocument = {
  preset: string;
  name: string;
  color?: Record<string, unknown>;
  dimension?: Record<string, unknown>;
};

const presets = [
  "neutral",
  "m3",
  "fluent",
  "apple",
  "omarchy",
  "hyprland",
  "aphrody",
  "chromium",
] as const;
const uiRoot = process.env.YOLO_UI_ROOT ?? `${import.meta.dir}/../../yolo-ui`;

async function run(program: string, args: string[], cwd: string) {
  const child = Bun.spawn([program, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `${program} ${args.join(" ")} failed (${exitCode}): ${stderr.trim()}`,
    );
  return stdout;
}

function token(document: ThemeDocument, path: string): string {
  let value: unknown = document;
  for (const part of path.split(".")) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  const result = (value as DtcgValue | undefined)?.$value;
  if (typeof result !== "string")
    throw new Error(`${document.preset} is missing DTCG color token ${path}`);
  return result;
}

const themes: Record<string, unknown> = {};
for (const preset of presets) {
  const output = await run(
    "bun",
    ["scripts/ui.ts", "theme", "--preset", preset, "--target", "dtcg"],
    uiRoot,
  );
  const jsonStart = output.indexOf("{");
  if (jsonStart < 0)
    throw new Error(`yolo-ui returned no DTCG JSON for ${preset}`);
  const document = JSON.parse(output.slice(jsonStart)) as ThemeDocument;
  themes[document.preset] = {
    name: document.name,
    colors: {
      canvas: token(document, "color.background.primary"),
      panel: token(document, "color.background.secondary"),
      raised: token(document, "color.background.elevated"),
      text: token(document, "color.text.primary"),
      mutedText: token(document, "color.text.muted"),
      accent: token(document, "color.accent.primary"),
      accentSecondary: token(document, "color.accent.secondary"),
      success: token(document, "color.accent.success"),
      warning: token(document, "color.accent.warning"),
      danger: token(document, "color.accent.danger"),
      border: token(document, "color.border.subtle"),
    },
    dimensions: document.dimension,
  };
}

const sourceCommit = (await run("git", ["rev-parse", "HEAD"], uiRoot)).trim();
const result = {
  schemaVersion: 1,
  generatedBy: "yolo-ui ui_theme_emit --target dtcg",
  sourceRepository: "https://github.com/yolo-rs/yolo-ui",
  sourceCommit,
  generatedAt: new Date().toISOString(),
  themes,
};
const destination = `${import.meta.dir}/../apps/human-browser/src/theme-presets.json`;
await Bun.write(destination, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `Generated ${presets.length} yolo-ui HCT theme presets from ${sourceCommit} plus working-tree edits at ${destination}`,
);
