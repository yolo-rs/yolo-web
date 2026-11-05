/** Provenance-first HTML crawler. It stays within seed origins and applies robots.txt rules. */

export type CrawlPage = {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  text: string;
  links: string[];
  status: number;
  contentType: string;
  fetchedAt: string;
  sha256: string;
  rawBody?: string;
  error?: string;
};

export type CrawlOptions = {
  seeds: string[];
  maxDepth?: number;
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  respectRobots?: boolean;
  allowOrigins?: string[];
  includeBody?: boolean;
};

export type CrawlResult = {
  schemaVersion: 1;
  generatedAt: string;
  crawler: "@yolo-web/web-crawler";
  policy: {
    maxDepth: number;
    maxPages: number;
    delayMs: number;
    respectRobots: boolean;
    origins: string[];
  };
  pages: CrawlPage[];
};

export type GitHubRepository = {
  fullName: string;
  htmlUrl: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  archived: boolean;
  pushedAt: string | null;
  defaultBranch: string;
  license: { name: string; spdxId: string | null } | null;
};

export type GitHubListingResult = {
  schemaVersion: 1;
  source: string;
  owner: string;
  ownerType: "org" | "user";
  sort: "stargazers";
  direction: "desc";
  generatedAt: string;
  pageCount: number;
  truncated: boolean;
  pages: Array<{
    page: number;
    fetchedAt: string;
    itemCount: number;
    sha256: string;
    etag: string | null;
    rawBody: string;
  }>;
  repositories: GitHubRepository[];
};

export type GitRemoteHead = {
  schemaVersion: 1;
  remote: string;
  symbolicHead: string | null;
  commit: string;
  fetchedAt: string;
  sha256: string;
  rawBody?: string;
  rawOutput: string;
};

const DEFAULT_UA =
  "YOLO-Web-ResearchBot/0.1 (+https://github.com/yolo-rs/yolo-web)";
const GITHUB_ROUTE_PREFIXES = new Set([
  "about",
  "collections",
  "enterprise",
  "events",
  "features",
  "login",
  "marketplace",
  "new",
  "notifications",
  "open-source",
  "orgs",
  "pricing",
  "resources",
  "search",
  "security",
  "settings",
  "site",
  "sponsors",
  "solutions",
  "staff",
  "topics",
  "trending",
]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeUrl(raw: string, base?: string): URL {
  const url = new URL(raw, base);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  if (url.username || url.password)
    throw new Error("URLs with embedded credentials are not allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    /^(?:fc|fd|fe[89ab])/.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error(`Private or loopback host is not allowed: ${host}`);
  }
  url.hash = "";
  return url;
}

export function validatePublicHttpUrl(raw: string, base?: string): URL {
  return safeUrl(raw, base);
}

function plainText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(
      /<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.replace(/&amp;/gi, "&");
}

function extract(html: string, pageUrl: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? "";
  const description =
    [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map(([tag]) => ({
        name: attr(tag, "name")?.toLowerCase(),
        content: attr(tag, "content"),
      }))
      .find((m) => m.name === "description")?.content ?? "";
  const links = new Set<string>();
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(tag, "href");
    if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const target = safeUrl(href, pageUrl);
      if (
        new URL(pageUrl).hostname === "github.com" &&
        (!/^\/[\w.-]+\/[\w.-]+\/?$/.test(target.pathname) ||
          GITHUB_ROUTE_PREFIXES.has(
            target.pathname.split("/")[1]?.toLowerCase() ?? "",
          )) &&
        !/^\/orgs\/[\w.-]+\/repositories\/?$/.test(target.pathname)
      )
        continue;
      links.add(target.toString());
    } catch {
      /* Ignore invalid or disallowed schemes. */
    }
  }
  return {
    title: plainText(title),
    description: plainText(description),
    text: plainText(html),
    links: [...links],
  };
}

type RobotsRule = { allow: boolean; path: string };
const robotsCache = new Map<
  string,
  Promise<{ rules: RobotsRule[]; delay: number }>
>();

async function robots(origin: string, userAgent: string, timeoutMs: number) {
  const cacheKey = `${origin}\0${userAgent.toLowerCase()}`;
  let pending = robotsCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await request(
          new URL(`${origin}/robots.txt`),
          { "user-agent": userAgent },
          timeoutMs,
          (url) => url.origin === origin,
        );
        if (
          response.status === 404 ||
          response.status === 410 ||
          (response.status >= 400 &&
            response.status < 500 &&
            ![401, 403, 429].includes(response.status))
        )
          return { rules: [], delay: 0 };
        if (!response.ok)
          return { rules: [{ allow: false, path: "/" }], delay: 0 };
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > 256_000)
          return { rules: [{ allow: false, path: "/" }], delay: 0 };
        const robotsText = await response.text();
        if (robotsText.length > 256_000)
          return { rules: [{ allow: false, path: "/" }], delay: 0 };
        const lines = robotsText.split(/\r?\n/);
        const rules: RobotsRule[] = [];
        let applies = false;
        let lastWasAgent = false;
        let delay = 0;
        for (const line of lines) {
          const [keyRaw, ...rest] = line.split(":");
          const key = keyRaw?.trim().toLowerCase();
          const value = rest.join(":").trim();
          if (key === "user-agent") {
            const match =
              value === "*" ||
              (value !== "" &&
                userAgent.toLowerCase().includes(value.toLowerCase()));
            applies = lastWasAgent ? applies || match : match;
            lastWasAgent = true;
            continue;
          }
          lastWasAgent = false;
          if (applies && (key === "allow" || key === "disallow") && value)
            rules.push({ allow: key === "allow", path: value });
          else if (
            applies &&
            key === "crawl-delay" &&
            Number.isFinite(Number(value))
          )
            delay = Math.max(delay, Number(value) * 1000);
        }
        return { rules, delay };
      } catch {
        return { rules: [{ allow: false, path: "/" }], delay: 0 };
      }
    })();
    robotsCache.set(cacheKey, pending);
  }
  return pending;
}

function robotsPathMatches(pattern: string, path: string) {
  const terminal = pattern.endsWith("$");
  const source = (terminal ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${terminal ? "$" : ""}`).test(path);
}

function robotsAllows(path: string, rules: RobotsRule[]) {
  const matching = rules
    .filter((rule) => robotsPathMatches(rule.path, path))
    .sort(
      (a, b) =>
        b.path.replace(/[*$]/g, "").length - a.path.replace(/[*$]/g, "").length,
    );
  return matching[0]?.allow ?? true;
}

async function request(
  url: URL,
  headers: HeadersInit,
  timeoutMs: number,
  allowed: (url: URL) => boolean,
): Promise<Response> {
  let current = url;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(current, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = safeUrl(location, current.toString());
    if (!allowed(current))
      throw new Error(
        `Redirect left the configured crawl origins: ${current.origin}`,
      );
  }
  throw new Error("Redirect limit exceeded");
}

export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const maxDepth = Math.max(0, Math.min(8, options.maxDepth ?? 1));
  const maxPages = Math.max(1, Math.min(5000, options.maxPages ?? 100));
  const delayMs = Math.max(0, options.delayMs ?? 700);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15000);
  const maxBytes = Math.max(1024, options.maxBytes ?? 2_000_000);
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const seeds = options.seeds.map((seed) => safeUrl(seed));
  const origins = [
    ...new Set(
      (options.allowOrigins ?? seeds.map((u) => u.origin)).map(
        (origin) => new URL(origin).origin,
      ),
    ),
  ];
  const allowed = (url: URL) => origins.includes(url.origin);
  type QueueItem = { url: URL; depth: number; group: string };
  const groups = [...new Set(seeds.map((url) => url.toString()))];
  const queues = new Map<string, QueueItem[]>();
  for (const group of groups)
    queues.set(group, [{ url: new URL(group), depth: 0, group }]);
  let queueCursor = 0;
  const visited = new Set<string>();
  const pages: CrawlPage[] = [];
  let lastRequestAt = 0;

  while (pages.length < maxPages) {
    let item: QueueItem | undefined;
    for (let tries = 0; tries < groups.length; tries++) {
      const group = groups[queueCursor++ % groups.length]!;
      item = queues.get(group)?.shift();
      if (item) break;
    }
    if (!item) break;
    const normalized = item.url.toString();
    if (visited.has(normalized) || !allowed(item.url)) continue;
    visited.add(normalized);
    try {
      let crawlDelay = 0;
      if (options.respectRobots !== false) {
        const policy = await robots(item.url.origin, userAgent, timeoutMs);
        if (!robotsAllows(item.url.pathname, policy.rules)) continue;
        crawlDelay = policy.delay;
      }
      await sleep(
        Math.max(
          0,
          Math.max(delayMs, crawlDelay) - (Date.now() - lastRequestAt),
        ),
      );
      lastRequestAt = Date.now();
      const response = await request(
        item.url,
        {
          "user-agent": userAgent,
          accept:
            "text/html,application/xhtml+xml,text/plain;q=0.8,application/json;q=0.5",
        },
        timeoutMs,
        allowed,
      );
      const finalUrl = response.url || normalized;
      const contentType = response.headers.get("content-type") ?? "";
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > maxBytes)
        throw new Error(`Response exceeded ${maxBytes} byte limit`);
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new Error(`Response exceeded ${maxBytes} byte limit`);
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const body = new TextDecoder().decode(bytes);
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", bytes),
      );
      const sha256 = [...digest]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const content = /html|xhtml/i.test(contentType)
        ? extract(body, finalUrl)
        : {
            title: "",
            description: "",
            text: plainText(body),
            links: [] as string[],
          };
      pages.push({
        url: normalized,
        finalUrl,
        ...content,
        status: response.status,
        contentType,
        fetchedAt: new Date().toISOString(),
        sha256,
        ...(options.includeBody ? { rawBody: body } : {}),
      });
      if (item.depth < maxDepth)
        for (const raw of content.links) {
          try {
            const next = safeUrl(raw);
            const groupQueue = queues.get(item.group);
            if (allowed(next) && !visited.has(next.toString()) && groupQueue)
              groupQueue.push({
                url: next,
                depth: item.depth + 1,
                group: item.group,
              });
          } catch {
            /* Ignore invalid links. */
          }
        }
    } catch (error) {
      pages.push({
        url: normalized,
        finalUrl: normalized,
        title: "",
        description: "",
        text: "",
        links: [],
        status: 0,
        contentType: "",
        fetchedAt: new Date().toISOString(),
        sha256: "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    crawler: "@yolo-web/web-crawler",
    policy: {
      maxDepth,
      maxPages,
      delayMs,
      respectRobots: options.respectRobots !== false,
      origins,
    },
    pages,
  };
}

export async function listGitHubRepositories(
  owner: string,
  options: {
    ownerType?: "org" | "user";
    maxPages?: number;
    token?: string;
  } = {},
): Promise<GitHubListingResult> {
  if (!/^[A-Za-z0-9-]+$/.test(owner))
    throw new Error(`Invalid GitHub owner: ${owner}`);
  const ownerType = options.ownerType ?? "org";
  const maxPages = Math.max(1, Math.min(10, options.maxPages ?? 5));
  const base = `https://api.github.com/${ownerType === "org" ? "orgs" : "users"}/${owner}/repos`;
  const repositories: GitHubRepository[] = [];
  const pages: GitHubListingResult["pages"] = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}?type=public&per_page=100&page=${page}`;
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": DEFAULT_UA,
      "x-github-api-version": "2022-11-28",
    };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `GitHub API returned HTTP ${response.status} for ${owner} page ${page}: ${(await response.text()).slice(0, 300)}`,
      );
    const responseBytes = new Uint8Array(await response.arrayBuffer());
    const body = JSON.parse(new TextDecoder().decode(responseBytes)) as Array<
      Record<string, unknown>
    >;
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", responseBytes),
    );
    const sha256 = [...digest]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    pages.push({
      page,
      fetchedAt: new Date().toISOString(),
      itemCount: body.length,
      sha256,
      etag: response.headers.get("etag"),
      rawBody: new TextDecoder().decode(responseBytes),
    });
    for (const item of body) {
      const licenseValue =
        item.license && typeof item.license === "object"
          ? (item.license as Record<string, unknown>)
          : null;
      repositories.push({
        fullName: String(item.full_name ?? ""),
        htmlUrl: String(item.html_url ?? ""),
        description:
          typeof item.description === "string" ? item.description : null,
        stars: Number(item.stargazers_count ?? 0),
        forks: Number(item.forks_count ?? 0),
        language: typeof item.language === "string" ? item.language : null,
        archived: item.archived === true,
        pushedAt: typeof item.pushed_at === "string" ? item.pushed_at : null,
        defaultBranch: String(item.default_branch ?? ""),
        license: licenseValue
          ? {
              name: String(licenseValue.name ?? "Unknown"),
              spdxId:
                typeof licenseValue.spdx_id === "string"
                  ? licenseValue.spdx_id
                  : null,
            }
          : null,
      });
    }
    const hasNext = /rel="next"/i.test(response.headers.get("link") ?? "");
    if (!hasNext) break;
    if (page === maxPages) truncated = true;
    await sleep(250);
  }
  repositories.sort(
    (a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName),
  );
  return {
    schemaVersion: 1,
    source: base,
    owner,
    ownerType,
    sort: "stargazers",
    direction: "desc",
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    truncated,
    pages,
    repositories,
  };
}

export async function inspectGitRemote(
  remote: string,
  timeoutMs = 20000,
): Promise<GitRemoteHead> {
  const url = safeUrl(remote);
  if (url.protocol !== "https:" || !url.hostname.includes("."))
    throw new Error(
      "Git metadata collection requires a credential-free public HTTPS remote",
    );
  const child = Bun.spawn(["git", "ls-remote", "--symref", remote, "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  try {
    if (!child.stdout || !child.stderr)
      throw new Error("Git output pipes were not created");
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (exitCode !== 0)
      throw new Error(`git ls-remote failed (${exitCode}): ${stderr.trim()}`);
    const symbolicHead = stdout.match(/^ref:\s+(\S+)\s+HEAD$/m)?.[1] ?? null;
    const commit = stdout.match(/^([\da-f]{40,64})\s+HEAD$/m)?.[1];
    if (!commit)
      throw new Error(
        `Remote did not return a HEAD object id: ${stdout.trim()}`,
      );
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stdout)),
    );
    return {
      schemaVersion: 1,
      remote,
      symbolicHead,
      commit,
      fetchedAt: new Date().toISOString(),
      sha256: [...digest]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      rawOutput: stdout,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function synthesizeMarkdown(
  result: CrawlResult,
  heading = "Crawl synthesis",
): string {
  const lines = [
    `# ${heading}`,
    "",
    `Generated: ${result.generatedAt}`,
    `Pages captured: ${result.pages.length}`,
    "",
    "## Findings",
    "",
  ];
  for (const page of result.pages) {
    lines.push(
      `### ${page.title || page.finalUrl}`,
      "",
      `Source: [${page.finalUrl}](${page.finalUrl})`,
      `Fetched: ${page.fetchedAt} · HTTP ${page.status} · SHA-256 \`${page.sha256 || "unavailable"}\``,
    );
    if (page.description) lines.push("", page.description);
    const excerpt = page.text.replace(/\s+/g, " ").trim().slice(0, 1800);
    if (excerpt) lines.push("", excerpt);
    if (page.error) lines.push("", `Crawl error: ${page.error}`);
    lines.push("");
  }
  lines.push(
    "## Limits",
    "",
    "This report is a deterministic extraction of captured pages. It does not claim that uncrawled links, dynamic content, or inaccessible pages were reviewed.",
    "",
  );
  return lines.join("\n");
}
