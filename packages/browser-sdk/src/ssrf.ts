/**
 * SSRF Guard for Browser Automation & AI Agents.
 * Blocks requests to loopback, RFC1918, link-local, cloud metadata, and private networks.
 */

import { lookup } from "node:dns/promises";

export interface SsrfGuardOptions {
  allowPrivateNetwork?: boolean;
  allowedHosts?: string[];
  blockedHosts?: string[];
}

/** Check if an IPv4 address belongs to a forbidden private/internal range. */
export function isForbiddenIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [b0, b1, b2, b3] = parts as [number, number, number, number];

  // 0.0.0.0/8 (Broadcast/this host)
  if (b0 === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;
  // 10.0.0.0/8 (RFC1918)
  if (b0 === 10) return true;
  // 172.16.0.0/12 (RFC1918)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16 (RFC1918)
  if (b0 === 192 && b1 === 168) return true;
  // 169.254.0.0/16 (Link-local & AWS/Azure/GCP metadata e.g. 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;
  // 100.64.0.0/10 (CGNAT & Alibaba cloud metadata 100.100.100.200)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;
  // 192.88.99.0/24 (6to4 relay anycast)
  if (b0 === 192 && b1 === 88 && b2 === 99) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0 && b3 !== 9 && b3 !== 10) return true;
  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future use & 255.255.255.255 broadcast)
  if (b0 >= 240) return true;

  return false;
}

/** Check if an IPv6 address belongs to a forbidden private/internal range. */
export function isForbiddenIpv6(ip: string): boolean {
  const norm = ip.toLowerCase().trim();
  // Loopback
  if (norm === "::1" || norm === "0:0:0:0:0:0:0:1") return true;
  // Unspecified
  if (norm === "::" || norm === "0:0:0:0:0:0:0:0") return true;
  // Unique-Local (fc00::/7 -> fc00:: to fdff::)
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true;
  // Link-Local (fe80::/10)
  if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) {
    return true;
  }
  // IPv4-mapped (::ffff:a.b.c.d)
  if (norm.includes("::ffff:")) {
    const v4 = norm.split("::ffff:")[1];
    if (v4 && isForbiddenIpv4(v4)) return true;
  }
  return false;
}

export class SsrfGuard {
  readonly allowPrivateNetwork: boolean;
  private readonly allowedHosts: Set<string>;
  private readonly blockedHosts: Set<string>;

  constructor(options: SsrfGuardOptions = {}) {
    this.allowPrivateNetwork =
      options.allowPrivateNetwork ??
      (process.env.OBSCURA_ALLOW_PRIVATE_NETWORK === "1");
    this.allowedHosts = new Set((options.allowedHosts ?? []).map((h) => h.toLowerCase()));
    this.blockedHosts = new Set((options.blockedHosts ?? []).map((h) => h.toLowerCase()));
  }

  /**
   * Validate a target URL against SSRF policy. Throws an error if URL targets an internal address.
   */
  async validateUrl(targetUrl: string | URL): Promise<void> {
    const url = typeof targetUrl === "string" ? new URL(targetUrl) : targetUrl;
    const hostname = url.hostname.toLowerCase();

    // Check custom blocked hosts
    if (this.blockedHosts.has(hostname)) {
      throw new Error(`SSRF Guard: Host "${hostname}" is explicitly blocked.`);
    }

    // Check custom allowed hosts
    if (this.allowedHosts.has(hostname)) {
      return;
    }

    if (this.allowPrivateNetwork) {
      return;
    }

    // Direct loopback / localhost names
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "instance-data"
    ) {
      throw new Error(`SSRF Guard: Target host "${hostname}" resolves to an internal network.`);
    }

    // Direct IPv4 literal
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      if (isForbiddenIpv4(hostname)) {
        throw new Error(`SSRF Guard: Target IP "${hostname}" is a private or forbidden IP address.`);
      }
      return;
    }

    // Direct IPv6 literal (e.g. [::1])
    const cleanV6 = hostname.replace(/^\[|\]$/g, "");
    if (cleanV6.includes(":")) {
      if (isForbiddenIpv6(cleanV6)) {
        throw new Error(`SSRF Guard: Target IPv6 "${cleanV6}" is a private or loopback address.`);
      }
      return;
    }

    // Resolve DNS to verify IP addresses
    try {
      const records = await lookup(hostname, { all: true });
      for (const record of records) {
        if (record.family === 4 && isForbiddenIpv4(record.address)) {
          throw new Error(
            `SSRF Guard: Host "${hostname}" resolved to forbidden private IPv4: ${record.address}`
          );
        }
        if (record.family === 6 && isForbiddenIpv6(record.address)) {
          throw new Error(
            `SSRF Guard: Host "${hostname}" resolved to forbidden private IPv6: ${record.address}`
          );
        }
      }
    } catch (err: unknown) {
      // If DNS resolution fails, let network layer handle NXDOMAIN or rethrow SSRF error
      if (err instanceof Error && err.message.startsWith("SSRF Guard:")) {
        throw err;
      }
    }
  }

  isSafe(targetUrl: string | URL): Promise<boolean> {
    return this.validateUrl(targetUrl)
      .then(() => true)
      .catch(() => false);
  }
}
