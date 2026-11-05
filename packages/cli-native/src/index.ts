/**
 * Zero-dependency subset of the `commander` API used by YOLO-Web CLIs:
 * nested subcommands, value/boolean/negatable/variadic options, positional
 * arguments (required, optional, variadic), defaults, requiredOption,
 * allowUnknownOption, exitOverride, --help and --version.
 */

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
    readonly code = "cli.error",
  ) {
    super(message);
    this.name = "CliError";
  }
}

interface OptionDef {
  short?: string;
  long: string;
  key: string;
  takesValue: boolean;
  variadic: boolean;
  negate: boolean;
  required: boolean;
  optionalValue: boolean;
  description: string;
  defaultValue?: unknown;
  mandatory: boolean;
}

interface ArgDef {
  name: string;
  required: boolean;
  variadic: boolean;
  description: string;
  defaultValue?: unknown;
}

type Action = (...args: any[]) => unknown | Promise<unknown>;

const camel = (s: string) =>
  s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function parseOptionFlags(
  flags: string,
  description: string,
  defaultValue: unknown,
  mandatory: boolean,
): OptionDef {
  const parts = flags.split(/[ ,|]+/).filter(Boolean);
  let short: string | undefined;
  let long = "";
  let takesValue = false;
  let variadic = false;
  let required = false;
  let optionalValue = false;
  for (const part of parts) {
    if (part.startsWith("--")) long = part.slice(2);
    else if (part.startsWith("-")) short = part.slice(1);
    else if (part.startsWith("<")) {
      takesValue = true;
      required = true;
      variadic = part.endsWith("...>");
    } else if (part.startsWith("[")) {
      takesValue = true;
      optionalValue = true;
      variadic = part.endsWith("...]");
    }
  }
  if (!long) throw new Error(`Option '${flags}' needs a long flag`);
  const negate = long.startsWith("no-");
  const key = camel(negate ? long.slice(3) : long);
  return {
    short,
    long,
    key,
    takesValue,
    variadic,
    negate,
    required,
    optionalValue,
    description,
    defaultValue: defaultValue ?? (negate ? true : undefined),
    mandatory,
  };
}

function parseArgSpec(
  spec: string,
  description: string,
  defaultValue: unknown,
): ArgDef {
  const required = spec.startsWith("<");
  const inner = spec.slice(1, -1);
  const variadic = inner.endsWith("...");
  return {
    name: variadic ? inner.slice(0, -3) : inner,
    required,
    variadic,
    description,
    defaultValue,
  };
}

export class Command {
  readonly commands: Command[] = [];
  parent?: Command;
  private _name: string;
  private _desc = "";
  private _version?: string;
  private _options: OptionDef[] = [];
  private _args: ArgDef[] = [];
  private _action?: Action;
  private _allowUnknown = false;
  private _exitOverride = false;
  private _values: Record<string, unknown> = {};

  constructor(name = "") {
    this._name = name;
  }

  name(): string;
  name(value: string): this;
  name(value?: string): string | this {
    if (value === undefined) return this._name;
    this._name = value;
    return this;
  }

  description(): string;
  description(value: string): this;
  description(value?: string): string | this {
    if (value === undefined) return this._desc;
    this._desc = value;
    return this;
  }

  version(value: string): this {
    this._version = value;
    return this;
  }

  /** Define a subcommand; `"status [id]"` declares positionals inline. */
  command(nameAndArgs: string): Command {
    const [name, ...specs] = nameAndArgs.trim().split(/\s+/);
    const sub = new Command(name);
    sub.parent = this;
    sub._exitOverride = this._exitOverride;
    for (const spec of specs) sub.argument(spec);
    this.commands.push(sub);
    return sub;
  }

  argument(spec: string, description = "", defaultValue?: unknown): this {
    this._args.push(parseArgSpec(spec, description, defaultValue));
    return this;
  }

  option(flags: string, description = "", defaultValue?: unknown): this {
    this._options.push(
      parseOptionFlags(flags, description, defaultValue, false),
    );
    return this;
  }

  requiredOption(
    flags: string,
    description = "",
    defaultValue?: unknown,
  ): this {
    this._options.push(
      parseOptionFlags(flags, description, defaultValue, true),
    );
    return this;
  }

  allowUnknownOption(allow = true): this {
    this._allowUnknown = allow;
    return this;
  }

  action(fn: Action): this {
    this._action = fn;
    return this;
  }

  exitOverride(): this {
    this._exitOverride = true;
    for (const c of this.commands) c.exitOverride();
    return this;
  }

  opts<T extends Record<string, any> = Record<string, any>>(): T {
    return this._values as T;
  }

  helpInformation(): string {
    const path: string[] = [];
    for (let c: Command | undefined = this; c; c = c.parent)
      if (c._name) path.unshift(c._name);
    const usage = [
      path.join(" "),
      this._options.length ? "[options]" : "",
      this.commands.length ? "[command]" : "",
      ...this._args.map((a) =>
        a.required
          ? `<${a.name}${a.variadic ? "..." : ""}>`
          : `[${a.name}${a.variadic ? "..." : ""}]`,
      ),
    ]
      .filter(Boolean)
      .join(" ");
    const lines = [`Usage: ${usage}`];
    if (this._desc) lines.push("", this._desc);
    if (this._options.length) {
      lines.push("", "Options:");
      for (const o of this._options) {
        const flag = `${o.short ? `-${o.short}, ` : ""}--${o.long}${o.takesValue ? (o.required ? " <value>" : " [value]") : ""}`;
        lines.push(`  ${flag.padEnd(30)} ${o.description}`);
      }
    }
    if (this.commands.length) {
      lines.push("", "Commands:");
      for (const c of this.commands)
        lines.push(`  ${c._name.padEnd(30)} ${c._desc}`);
    }
    return `${lines.join("\n")}\n`;
  }

  async parseAsync(
    argv: readonly string[] = Bun.argv,
    opts: { from?: "node" | "user" } = {},
  ): Promise<this> {
    const tokens = opts.from === "user" ? [...argv] : argv.slice(2);
    try {
      await this.dispatch(tokens);
    } catch (error) {
      if (this._exitOverride || !(error instanceof CliError)) throw error;
      console.error(`error: ${error.message}`);
      process.exit(error.exitCode);
    }
    return this;
  }

  /** Synchronous parse for commands whose actions are synchronous (or absent). */
  parse(
    argv: readonly string[] = Bun.argv,
    opts: { from?: "node" | "user" } = {},
  ): this {
    const tokens = opts.from === "user" ? [...argv] : argv.slice(2);
    try {
      void this.run(tokens);
    } catch (error) {
      if (this._exitOverride || !(error instanceof CliError)) throw error;
      console.error(`error: ${error.message}`);
      process.exit(error.exitCode);
    }
    return this;
  }

  private async dispatch(tokens: string[]): Promise<void> {
    const pending = this.run(tokens);
    if (pending) await pending;
  }

  private findSubcommand(tokens: string[]): number {
    if (!this.commands.length) return -1;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t === "--") return -1;
      if (t.startsWith("-")) {
        // Skip this command's own option value when it takes one.
        const def = this.lookup(t);
        if (def?.takesValue && !t.includes("=") && tokens[i + 1] !== undefined)
          i++;
        continue;
      }
      return this.commands.some((c) => c._name === t) ? i : -1;
    }
    return -1;
  }

  private lookup(token: string): OptionDef | undefined {
    if (token.startsWith("--")) {
      const long = token.slice(2).split("=")[0]!;
      return this._options.find((o) => o.long === long);
    }
    return this._options.find((o) => o.short === token.slice(1, 2));
  }

  private run(tokens: string[]): Promise<void> | void {
    const subIndex = this.findSubcommand(tokens);
    if (subIndex >= 0) {
      const sub = this.commands.find((c) => c._name === tokens[subIndex])!;
      const own = tokens.slice(0, subIndex);
      this.parseOptions(own, true);
      return sub.run(tokens.slice(subIndex + 1));
    }
    const positionals = this.parseOptions(tokens, false);
    if (this._values.__help) {
      process.stdout.write(this.helpInformation());
      return;
    }
    if (this._values.__version && this._version) {
      console.log(this._version);
      return;
    }
    for (const o of this._options) {
      if (o.mandatory && this._values[o.key] === undefined) {
        throw new CliError(
          `required option '--${o.long}' not specified`,
          1,
          "cli.missingMandatoryOptionValue",
        );
      }
    }
    if (!this._action) {
      if (this.commands.length && !positionals.length) {
        process.stdout.write(this.helpInformation());
      }
      return;
    }
    const callArgs: unknown[] = [];
    let rest = positionals;
    for (const [i, a] of this._args.entries()) {
      if (a.variadic) {
        callArgs.push(
          rest.length
            ? rest
            : (a.defaultValue ?? (a.required ? undefined : [])),
        );
        rest = [];
        continue;
      }
      const v = rest[0];
      if (v === undefined) {
        if (a.required)
          throw new CliError(
            `missing required argument '${a.name}'`,
            1,
            "cli.missingArgument",
          );
        callArgs.push(a.defaultValue);
      } else {
        callArgs.push(v);
        rest = rest.slice(1);
      }
      void i;
    }
    if (rest.length && !this._allowUnknown) {
      throw new CliError(
        `too many arguments for '${this._name}'. Expected ${this._args.length} but got ${positionals.length}.`,
        1,
        "cli.excessArguments",
      );
    }
    return Promise.resolve(this._action(...callArgs, this._values, this)).then(
      () => undefined,
    );
  }

  private parseOptions(tokens: string[], leadingOnly: boolean): string[] {
    const values: Record<string, unknown> = {};
    for (const o of this._options)
      if (o.defaultValue !== undefined) values[o.key] = o.defaultValue;
    const positionals: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t === "--") {
        positionals.push(...tokens.slice(i + 1));
        break;
      }
      if (!t.startsWith("-") || t === "-") {
        positionals.push(t);
        continue;
      }
      if (t === "--help" || (t === "-h" && !this.lookup("-h"))) {
        values.__help = true;
        continue;
      }
      if (t === "--version" || t === "-V") {
        if (this._version) {
          values.__version = true;
          continue;
        }
      }
      let flag = t;
      let inline: string | undefined;
      const eq = t.startsWith("--") ? t.indexOf("=") : -1;
      if (eq > 0) {
        flag = t.slice(0, eq);
        inline = t.slice(eq + 1);
      } else if (!t.startsWith("--") && t.length > 2) {
        flag = t.slice(0, 2);
        inline = t.slice(2);
      }
      let def = this.lookup(flag);
      if (!def && flag.startsWith("--no-"))
        def = this._options.find((o) => o.negate && o.long === flag.slice(2));
      if (!def) {
        if (this._allowUnknown || leadingOnly) {
          positionals.push(t);
          continue;
        }
        throw new CliError(`unknown option '${t}'`, 1, "cli.unknownOption");
      }
      if (!def.takesValue) {
        values[def.key] = !def.negate;
        continue;
      }
      let value: string | undefined = inline;
      if (value === undefined) {
        const next = tokens[i + 1];
        if (next !== undefined && (!next.startsWith("-") || next === "-")) {
          value = next;
          i++;
        } else if (def.required) {
          throw new CliError(
            `option '--${def.long} <value>' argument missing`,
            1,
            "cli.optionMissingArgument",
          );
        }
      }
      if (def.variadic) {
        const list: string[] = [];
        if (value !== undefined) list.push(value);
        while (
          inline === undefined &&
          tokens[i + 1] !== undefined &&
          !tokens[i + 1]!.startsWith("-")
        )
          list.push(tokens[++i]!);
        const prev =
          Array.isArray(values[def.key]) && values[def.key] !== def.defaultValue
            ? (values[def.key] as string[])
            : [];
        values[def.key] = [...prev, ...list];
      } else {
        values[def.key] = value ?? true;
      }
    }
    this._values = values;
    return positionals;
  }
}
