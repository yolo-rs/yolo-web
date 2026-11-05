import { validateMDNCompat } from "../src/validators.ts";

const joinPath = (...parts: string[]): string => {
  const separator = parts[0]?.includes("\\") ? "\\" : "/";
  return parts.reduce((path, part) => {
    if (path.length === 0) return part;
    return `${path.replace(/[\\/]+$/, "")}${separator}${part.replace(/^[\\/]+/, "")}`;
  }, "");
};

const dataDir = joinPath(
  import.meta.dir,
  "..",
  "..",
  "..",
  "data",
  "standards",
  "web",
);

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return await response.json();
}

async function writeValidated(
  relativePath: string,
  data: unknown,
  validate: (value: unknown) => boolean,
): Promise<void> {
  if (!validate(data))
    throw new Error(
      `Refusing to replace invalid standards snapshot: ${relativePath}`,
    );
  const path = joinPath(dataDir, relativePath);
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateMdn(): Promise<void> {
  const data = await fetchJson(
    "https://raw.githubusercontent.com/mdn/browser-compat-data/main/javascript/builtins/Array.json",
  );
  if (!data || typeof data !== "object")
    throw new Error("MDN BCD response is not an object");
  const root = data as Record<string, unknown>;
  const javascript = root.javascript as Record<string, unknown> | undefined;
  const builtins = javascript?.builtins as Record<string, unknown> | undefined;
  const array = builtins?.Array as Record<string, unknown> | undefined;
  const prototype = array?.prototype as Record<string, unknown> | undefined;
  const feature = prototype?.toSorted;
  if (!feature || typeof feature !== "object")
    throw new Error("MDN BCD Array.prototype.toSorted feature is absent");
  const compat = (feature as Record<string, unknown>).__compat;
  if (!compat || typeof compat !== "object")
    throw new Error("MDN BCD __compat record is absent");
  const entry = compat as Record<string, unknown>;
  if (!entry.support || typeof entry.support !== "object")
    throw new Error("MDN BCD support matrix is absent");
  const rawSupport = entry.support as Record<string, unknown>;
  const browserAliases: Record<string, string> = {
    chrome_android: "chrome",
    firefox_android: "firefox",
    safari_ios: "safari",
    webview_android: "chrome",
    webview_ios: "safari",
  };
  const support: Record<string, unknown> = {};
  for (const [browser, statement] of Object.entries(rawSupport)) {
    if (statement === "mirror") {
      const alias = browserAliases[browser];
      if (
        alias &&
        rawSupport[alias] !== undefined &&
        rawSupport[alias] !== "mirror"
      ) {
        support[browser] = rawSupport[alias];
      }
    } else if (Array.isArray(statement)) {
      support[browser] = statement[0];
    } else {
      support[browser] = statement;
    }
  }
  const record = {
    feature: "javascript.builtins.Array.toSorted",
    mdn_url:
      "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted",
    support,
  };
  await writeValidated(
    "mdn/mdn-compat.current.json",
    record,
    validateMDNCompat,
  );
}

await updateMdn();
console.log("Updated the MDN browser compatibility snapshot.");
console.log(
  "TC39, WebAssembly, and MCP data remain curated profiles; upstream sources do not expose matching stable JSON shapes.",
);
