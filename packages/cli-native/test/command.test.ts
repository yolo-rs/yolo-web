import { describe, expect, test } from "bun:test";
import { CliError, Command } from "../src/index.ts";

const run = (program: Command, ...args: string[]) =>
  program.parseAsync(["bun", "x", ...args]);

describe("cli-native Command", () => {
  test("options, defaults, camelCase and positionals", async () => {
    let seen: unknown[] = [];
    const p = new Command().exitOverride();
    p.command("crawl")
      .argument("<urls...>")
      .option("--max-pages <n>", "", "50")
      .option("--include-body")
      .option("-o, --output <path>", "", "crawl.json")
      .action((...a) => void (seen = a));
    await run(
      p,
      "crawl",
      "https://a",
      "https://b",
      "--max-pages=7",
      "--include-body",
      "-o",
      "x.json",
    );
    expect(seen[0]).toEqual(["https://a", "https://b"]);
    expect(seen[1]).toMatchObject({
      maxPages: "7",
      includeBody: true,
      output: "x.json",
    });
  });

  test("negatable option defaults to true and flips with --no-", async () => {
    const seen: Record<string, unknown>[] = [];
    const p = new Command().exitOverride();
    p.command("fetch")
      .argument("<url>")
      .option("--no-shields")
      .action((_u, o) => void seen.push({ ...o }));
    await run(p, "fetch", "u");
    await run(p, "fetch", "u", "--no-shields");
    expect(seen[0]!.shields).toBe(true);
    expect(seen[1]!.shields).toBe(false);
  });

  test("nested subcommands with optional positional and requiredOption", async () => {
    const calls: unknown[] = [];
    const p = new Command().exitOverride();
    const engines = p.command("engines");
    engines
      .command("status [id]")
      .action((id) => void calls.push(["status", id]));
    engines
      .command("install <id>")
      .requiredOption("--manager <m>")
      .option("--execute")
      .action(
        (id, o) => void calls.push(["install", id, o.manager, o.execute]),
      );
    await run(p, "engines", "status");
    await run(p, "engines", "status", "chrome");
    await run(
      p,
      "engines",
      "install",
      "brave",
      "--manager",
      "winget",
      "--execute",
    );
    expect(calls).toEqual([
      ["status", undefined],
      ["status", "chrome"],
      ["install", "brave", "winget", true],
    ]);
    await expect(run(p, "engines", "install", "brave")).rejects.toBeInstanceOf(
      CliError,
    );
  });

  test("variadic options and sync root parse with allowUnknownOption", () => {
    const p = new Command()
      .option("--enabled-tools <names...>", "", ["x"])
      .option("--port <n>", "", "8080")
      .allowUnknownOption()
      .parse([
        "bun",
        "x",
        "--enabled-tools",
        "a",
        "b",
        "--other",
        "--port",
        "9",
      ]);
    expect(p.opts()).toMatchObject({ enabledTools: ["a", "b"], port: "9" });
    const d = new Command()
      .option("--enabled-tools <names...>", "", ["x"])
      .parse(["bun", "x"]);
    expect(d.opts().enabledTools).toEqual(["x"]);
  });

  test("unknown option and missing argument raise CliError under exitOverride", async () => {
    const p = new Command().exitOverride();
    p.command("a")
      .argument("<x>")
      .action(() => {});
    await expect(run(p, "a", "--nope")).rejects.toMatchObject({
      code: "cli.unknownOption",
    });
    await expect(run(p, "a")).rejects.toMatchObject({
      code: "cli.missingArgument",
    });
  });

  test("passthrough args for allowUnknownOption subcommand", async () => {
    let got: unknown;
    const p = new Command().exitOverride();
    p.command("zig")
      .argument("[args...]")
      .allowUnknownOption(true)
      .action((a) => void (got = a));
    await run(p, "zig", "build", "--release");
    expect(got).toEqual(["build", "--release"]);
  });
});
