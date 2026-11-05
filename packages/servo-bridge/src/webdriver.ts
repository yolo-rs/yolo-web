// Minimal W3C WebDriver client for the Servo `servoshell --webdriver=<port>` server (Servo has no CDP server).
export interface ServoWebDriverOptions {
  endpoint?: string;
  timeoutMs?: number;
}

export class ServoWebDriver {
  private sessionId: string | undefined;

  private constructor(
    private readonly endpoint: string,
    private readonly timeoutMs: number,
  ) {}

  static async connect(
    options: ServoWebDriverOptions = {},
  ): Promise<ServoWebDriver> {
    const client = new ServoWebDriver(
      (options.endpoint ?? "http://127.0.0.1:7002").replace(/\/$/, ""),
      options.timeoutMs ?? 30_000,
    );
    const created = await client.request<{ sessionId: string }>(
      "POST",
      "/session",
      {
        capabilities: { alwaysMatch: {} },
      },
    );
    client.sessionId = created.sessionId;
    return client;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(this.endpoint + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const payload = (await response.json()) as {
      value: T & { error?: string; message?: string };
    };
    if (!response.ok || payload.value?.error) {
      throw new Error(
        `WebDriver ${method} ${path}: ${payload.value?.error ?? response.status} ${payload.value?.message ?? ""}`.trim(),
      );
    }
    return payload.value;
  }

  private session(path: string): string {
    if (!this.sessionId) throw new Error("WebDriver session is closed");
    return `/session/${this.sessionId}${path}`;
  }

  async navigate(url: string): Promise<void> {
    await this.request("POST", this.session("/url"), { url });
  }

  async title(): Promise<string> {
    return this.request("GET", this.session("/title"));
  }

  async currentUrl(): Promise<string> {
    return this.request("GET", this.session("/url"));
  }

  async pageSource(): Promise<string> {
    return this.request("GET", this.session("/source"));
  }

  async execute<T = unknown>(script: string, args: unknown[] = []): Promise<T> {
    return this.request("POST", this.session("/execute/sync"), {
      script,
      args,
    });
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    const path = this.session("");
    this.sessionId = undefined;
    await this.request("DELETE", path);
  }
}
