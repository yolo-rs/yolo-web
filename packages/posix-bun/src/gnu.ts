/**
 * GNU Extensions: getopt_long, asprintf, canonicalize_file_name, program_invocation_name
 */

export const HasArg = {
  NoArgument: 0,
  RequiredArgument: 1,
  OptionalArgument: 2,
} as const;

export type HasArgType = (typeof HasArg)[keyof typeof HasArg];

export interface LongOption {
  name: string;
  hasArg: HasArgType;
  val: number | string;
}

export type GetoptItem =
  | { type: "opt"; val: number | string; arg?: string }
  | { type: "non-opt"; val: string }
  | { type: "unknown"; char: string }
  | { type: "missing-arg"; char: string };

/**
 * Pure Bun/TS implementation of GNU getopt_long
 */
export function getoptLong(
  args: string[],
  optstring: string,
  longopts: LongOption[],
): GetoptItem[] {
  const results: GetoptItem[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i]!;

    if (arg === "--") {
      i++;
      while (i < args.length) {
        results.push({ type: "non-opt", val: arg });
        i++;
      }
      break;
    }

    // Long option
    if (arg.startsWith("--") && arg.length > 2) {
      const full = arg.slice(2);
      const eqIdx = full.indexOf("=");
      const name = eqIdx >= 0 ? full.slice(0, eqIdx) : full;
      const inlineVal = eqIdx >= 0 ? full.slice(eqIdx + 1) : undefined;

      const opt = longopts.find((o) => o.name === name);
      if (!opt) {
        results.push({ type: "unknown", char: name });
        i++;
        continue;
      }

      i++;
      if (opt.hasArg === HasArg.NoArgument) {
        results.push({ type: "opt", val: opt.val });
      } else if (opt.hasArg === HasArg.RequiredArgument) {
        if (inlineVal !== undefined) {
          results.push({ type: "opt", val: opt.val, arg: inlineVal });
        } else if (i < args.length) {
          results.push({ type: "opt", val: opt.val, arg: args[i]! });
          i++;
        } else {
          results.push({ type: "missing-arg", char: name });
        }
      } else if (opt.hasArg === HasArg.OptionalArgument) {
        results.push({ type: "opt", val: opt.val, arg: inlineVal });
      }
      continue;
    }

    // Short option
    if (arg.startsWith("-") && arg.length > 1 && arg !== "-") {
      const optChar = arg[1]!;
      const pos = optstring.indexOf(optChar);

      if (pos === -1) {
        results.push({ type: "unknown", char: optChar });
        i++;
        continue;
      }

      const rest = optstring.slice(pos + 1);
      const isRequired = rest.startsWith(":") && !rest.startsWith("::");
      const isOptional = rest.startsWith("::");

      if (isRequired) {
        if (arg.length > 2) {
          results.push({ type: "opt", val: optChar, arg: arg.slice(2) });
          i++;
        } else if (i + 1 < args.length) {
          results.push({ type: "opt", val: optChar, arg: args[i + 1]! });
          i += 2;
        } else {
          results.push({ type: "missing-arg", char: optChar });
          i++;
        }
      } else if (isOptional) {
        if (arg.length > 2) {
          results.push({ type: "opt", val: optChar, arg: arg.slice(2) });
        } else {
          results.push({ type: "opt", val: optChar });
        }
        i++;
      } else {
        results.push({ type: "opt", val: optChar });
        i++;
      }
      continue;
    }

    // Non option
    results.push({ type: "non-opt", val: arg });
    i++;
  }

  return results;
}

/**
 * GNU asprintf equivalent in TS
 */
export function asprintf(formatStr: string, ...args: unknown[]): string {
  let idx = 0;
  return formatStr.replace(/%[sdjif%]/g, (match) => {
    if (match === "%%") return "%";
    if (idx >= args.length) return match;
    const val = args[idx++];
    if (match === "%s") return String(val);
    if (match === "%d" || match === "%i") return Number(val).toFixed(0);
    if (match === "%f") return Number(val).toString();
    if (match === "%j") return JSON.stringify(val);
    return String(val);
  });
}

/**
 * GNU program_invocation_name
 */
export function programInvocationName(): string {
  return process.argv[1] || "bun";
}

export function programInvocationShortName(): string {
  const full = programInvocationName();
  const parts = full.split(/[\\/]/);
  return parts[parts.length - 1] || "bun";
}
