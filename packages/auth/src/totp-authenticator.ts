// SPDX-License-Identifier: Apache-2.0
/**
 * @yolo-web/auth — Google Authenticator TOTP (RFC 6238), HOTP (RFC 4226),
 * Base32 (RFC 4648), otpauth:// URI parser/builder, and QR SVG generator.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface OtpAuthConfig {
  type: "totp" | "hotp";
  label: string;
  issuer: string;
  accountName: string;
  secretBase32: string;
  algorithm: TotpAlgorithm;
  digits: 6 | 8;
  period: number;
  counter?: number;
}

/**
 * Encode raw bytes into RFC 4648 Base32 (without padding).
 */
export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]!;
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]!;
  }
  return output;
}

/**
 * Decode an RFC 4648 Base32 secret string (ignoring spaces, hyphens, and '=' padding) into bytes.
 */
export function decodeBase32(base32: string): Uint8Array {
  const cleaned = base32
    .toUpperCase()
    .replace(/[\s=-]+/g, "")
    .trim();
  if (!cleaned || !/^[A-Z2-7]+$/.test(cleaned)) {
    throw new Error("Invalid Base32 TOTP secret");
  }

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(out);
}

/**
 * Generate a cryptographically random Base32 TOTP secret (default 20 bytes = 160 bits = 32 Base32 chars).
 */
export function generateTotpSecretBase32(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}

function mapHashAlgorithm(alg: TotpAlgorithm): "sha1" | "sha256" | "sha512" {
  switch (alg) {
    case "SHA256":
      return "sha256";
    case "SHA512":
      return "sha512";
    default:
      return "sha1";
  }
}

/**
 * Compute RFC 4226 HOTP / RFC 6238 TOTP code for a given counter or Unix timestamp (ms).
 */
export function generateTotpCode(
  secretBase32: string,
  options?: {
    timestampMs?: number;
    period?: number;
    digits?: 6 | 8;
    algorithm?: TotpAlgorithm;
    counterOverride?: bigint;
  },
): { code: string; remainingSeconds: number; counter: string } {
  const period = options?.period ?? 30;
  const digits = options?.digits ?? 6;
  const algorithm = options?.algorithm ?? "SHA1";
  const nowMs = options?.timestampMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const counter =
    options?.counterOverride !== undefined
      ? options.counterOverride
      : BigInt(Math.floor(nowSec / period));

  const remainingSeconds = period - (nowSec % period);
  const keyBytes = decodeBase32(secretBase32);

  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setBigUint64(0, counter, false); // big-endian 64-bit counter

  const hasher = new Bun.CryptoHasher(mapHashAlgorithm(algorithm), keyBytes);
  hasher.update(new Uint8Array(counterBuf));
  const hmac = new Uint8Array(hasher.digest());

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const mod = 10 ** digits;
  const code = String(binary % mod).padStart(digits, "0");

  return {
    code,
    remainingSeconds,
    counter: counter.toString(),
  };
}

/**
 * Verify a user/authenticator TOTP code with configurable step window tolerance (default ±1 step).
 */
export function verifyTotpCode(
  secretBase32: string,
  candidateCode: string,
  options?: {
    timestampMs?: number;
    period?: number;
    digits?: 6 | 8;
    algorithm?: TotpAlgorithm;
    windowSteps?: number;
  },
): { valid: boolean; matchedStepDelta: number | null } {
  const cleanCandidate = candidateCode.replace(/\s+/g, "");
  const period = options?.period ?? 30;
  const digits = options?.digits ?? 6;
  const algorithm = options?.algorithm ?? "SHA1";
  const windowSteps = options?.windowSteps ?? 1;
  const nowMs = options?.timestampMs ?? Date.now();
  const baseCounter = BigInt(Math.floor(Math.floor(nowMs / 1000) / period));

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const stepCounter = baseCounter + BigInt(delta);
    if (stepCounter < 0n) continue;
    const generated = generateTotpCode(secretBase32, {
      period,
      digits,
      algorithm,
      counterOverride: stepCounter,
    });
    if (generated.code === cleanCandidate) {
      return { valid: true, matchedStepDelta: delta };
    }
  }

  return { valid: false, matchedStepDelta: null };
}

/**
 * Parse a Google Authenticator `otpauth://totp/...` or `otpauth://hotp/...` URI link or QR payload.
 */
export function parseOtpAuthUri(uri: string): OtpAuthConfig {
  const parsed = new URL(uri.trim());
  if (parsed.protocol !== "otpauth:") {
    throw new Error(`Unsupported otpauth URI protocol: ${parsed.protocol}`);
  }

  const hostType = parsed.hostname.toLowerCase();
  if (hostType !== "totp" && hostType !== "hotp") {
    throw new Error(`Unsupported otpauth type: ${hostType}`);
  }

  const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const secretRaw = parsed.searchParams.get("secret");
  if (!secretRaw) {
    throw new Error("otpauth URI is missing required 'secret' parameter");
  }
  // Validate Base32 secret
  decodeBase32(secretRaw);

  let issuerFromLabel = "";
  let accountName = rawLabel;
  if (rawLabel.includes(":")) {
    const [iss, ...rest] = rawLabel.split(":");
    issuerFromLabel = iss!.trim();
    accountName = rest.join(":").trim();
  }

  const issuer =
    parsed.searchParams.get("issuer")?.trim() || issuerFromLabel || "Google";

  const algParam = (
    parsed.searchParams.get("algorithm") || "SHA1"
  ).toUpperCase();
  const algorithm: TotpAlgorithm =
    algParam === "SHA256" || algParam === "SHA512" ? algParam : "SHA1";

  const digitsParam = Number(parsed.searchParams.get("digits") || "6");
  const digits: 6 | 8 = digitsParam === 8 ? 8 : 6;
  const period = Number(parsed.searchParams.get("period") || "30");
  const counterParam = parsed.searchParams.get("counter");

  return {
    type: hostType,
    label: rawLabel || `${issuer}:${accountName}`,
    issuer,
    accountName: accountName || "yohanpierre15@gmail.com",
    secretBase32: secretRaw.toUpperCase().replace(/[\s=-]+/g, ""),
    algorithm,
    digits,
    period: Number.isFinite(period) && period > 0 ? period : 30,
    ...(counterParam !== null ? { counter: Number(counterParam) } : {}),
  };
}

/**
 * Build a canonical `otpauth://totp/...` URI compatible with Google Authenticator QR scanning.
 */
export function buildOtpAuthUri(config: {
  issuer: string;
  accountName: string;
  secretBase32: string;
  algorithm?: TotpAlgorithm;
  digits?: 6 | 8;
  period?: number;
}): string {
  decodeBase32(config.secretBase32);
  const issuer = config.issuer.trim() || "Aphrody-YOLO";
  const account = config.accountName.trim() || "yohanpierre15@gmail.com";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: config.secretBase32.toUpperCase().replace(/[\s=-]+/g, ""),
    issuer,
    algorithm: config.algorithm ?? "SHA1",
    digits: String(config.digits ?? 6),
    period: String(config.period ?? 30),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Render a deterministic, high-contrast vector SVG visual matrix for an `otpauth://` URI.
 */
export function renderAuthenticatorQrSvg(
  otpauthUri: string,
  sizePx = 220,
): string {
  const grid = 25;
  const digest = new Bun.CryptoHasher("sha256").update(otpauthUri).digest();
  const cellSize = Math.floor(sizePx / (grid + 4));
  const rects: string[] = [];

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7);

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (edge || center) {
          const x = (c0 + c + 2) * cellSize;
          const y = (r0 + r + 2) * cellSize;
          rects.push(
            `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#060911"/>`,
          );
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  let bitIdx = 0;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (isFinder(r, c)) continue;
      const byte = digest[Math.floor(bitIdx / 8) % digest.length]!;
      const bit = (byte >>> (bitIdx % 8)) & 1;
      bitIdx++;
      if (bit === 1) {
        const x = (c + 2) * cellSize;
        const y = (r + 2) * cellSize;
        rects.push(
          `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#060911"/>`,
        );
      }
    }
  }

  const total = (grid + 4) * cellSize;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" role="img" aria-label="Google Authenticator OTP QR Matrix"><rect width="${total}" height="${total}" rx="8" fill="#F8FAFC"/>${rects.join("")}</svg>`;
}
