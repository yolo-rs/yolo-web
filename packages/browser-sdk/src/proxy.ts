/**
 * Rotating Proxy Pool with health monitoring, automatic failover, and retry strategies.
 */

export interface ProxyServerConfig {
  url: string;
  username?: string;
  password?: string;
  weight?: number;
  maxFailures?: number;
}

export type ProxyRotationStrategy = "round-robin" | "random" | "sticky" | "least-failed";

export class RotatingProxyPool {
  private readonly proxies: Array<ProxyServerConfig & { failures: number; healthy: boolean; lastUsed: number }>;
  private currentIndex = 0;
  private stickyMap = new Map<string, string>(); // sessionId -> proxyUrl
  readonly strategy: ProxyRotationStrategy;

  constructor(
    proxyList: Array<string | ProxyServerConfig>,
    strategy: ProxyRotationStrategy = "round-robin"
  ) {
    this.strategy = strategy;
    this.proxies = proxyList.map((item) => {
      const config = typeof item === "string" ? { url: item } : item;
      return {
        ...config,
        failures: 0,
        healthy: true,
        lastUsed: 0,
      };
    });
  }

  get size(): number {
    return this.proxies.length;
  }

  get healthyCount(): number {
    return this.proxies.filter((p) => p.healthy).length;
  }

  /**
   * Acquire the next proxy server based on configured rotation strategy.
   */
  acquire(sessionId?: string): string | undefined {
    if (this.proxies.length === 0) return undefined;

    if (sessionId && this.strategy === "sticky") {
      const existing = this.stickyMap.get(sessionId);
      if (existing) {
        const found = this.proxies.find((p) => p.url === existing && p.healthy);
        if (found) return found.url;
      }
    }

    const healthyList = this.proxies.filter((p) => p.healthy);
    const pool = healthyList.length > 0 ? healthyList : this.proxies;
    if (pool.length === 0) return undefined;

    let selected: (typeof this.proxies)[0] = pool[0]!;

    switch (this.strategy) {
      case "random": {
        const idx = Math.floor(Math.random() * pool.length);
        selected = pool[idx]!;
        break;
      }
      case "least-failed": {
        selected = pool.reduce((best, curr) =>
          curr.failures < best.failures ? curr : best
        );
        break;
      }
      case "round-robin":
      case "sticky":
      default: {
        const idx = this.currentIndex % pool.length;
        selected = pool[idx]!;
        this.currentIndex = (idx + 1) % pool.length;
        break;
      }
    }

    selected.lastUsed = Date.now();
    if (sessionId) {
      this.stickyMap.set(sessionId, selected.url);
    }
    return selected.url;
  }

  /**
   * Mark a proxy URL as failed. When failures exceed maxFailures, it is marked unhealthy.
   */
  reportFailure(proxyUrl: string): void {
    const item = this.proxies.find((p) => p.url === proxyUrl);
    if (!item) return;
    item.failures++;
    const max = item.maxFailures ?? 3;
    if (item.failures >= max) {
      item.healthy = false;
    }
  }

  /**
   * Mark a proxy as successfully responded. Resets failure count.
   */
  reportSuccess(proxyUrl: string): void {
    const item = this.proxies.find((p) => p.url === proxyUrl);
    if (!item) return;
    item.failures = 0;
    item.healthy = true;
  }

  /**
   * Reset health status of all proxies.
   */
  resetAll(): void {
    for (const p of this.proxies) {
      p.failures = 0;
      p.healthy = true;
    }
  }
}
