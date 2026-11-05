// SPDX-License-Identifier: Apache-2.0
/**
 * Session Cookies, Token Signing, Owner Identity Verification, and CSRF protection.
 * Carries forward session semantics from the archived BunOS server.
 */

import type { OwnerClaims, Session, User } from "./types.ts";

export const SESSION_COOKIE = "yolo_web_session";
export const SESSION_ISSUER = "yolo-web";
export const SESSION_AUDIENCE = "yolo-web";

export const COMPAT_COOKIES = [
  SESSION_COOKIE,
  "aphrody_session",
  "bunos_session",
  "better-auth.session_token",
];

let developmentSecret: string | undefined;

/** Resolve an explicit session key, or a process-local development key outside production. */
export function resolveSessionSecret(
  provided?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const configured =
    provided ?? env.YOLO_WEB_SESSION_KEY ?? env.APHRODY_WEBOS_SESSION_KEY;
  if (configured !== undefined) {
    if (configured.length < 32)
      throw new Error(
        "YOLO_WEB_SESSION_KEY must contain at least 32 characters",
      );
    return configured;
  }
  if (env.NODE_ENV === "production")
    throw new Error("YOLO_WEB_SESSION_KEY must be configured in production");
  if (!developmentSecret) {
    developmentSecret = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
  }
  return developmentSecret;
}

const b64url = (data: Uint8Array | string) =>
  Buffer.from(typeof data === "string" ? Buffer.from(data) : data).toString(
    "base64url",
  );

const unb64url = (str: string): Uint8Array => Buffer.from(str, "base64url");

export async function signSessionToken(
  claims: OwnerClaims,
  secret: string,
): Promise<string> {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const dataToSign = new TextEncoder().encode(`${head}.${payload}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
  return `${head}.${payload}.${b64url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<OwnerClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [head, payload, sig] = parts;
    if (!head || !payload || !sig) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const dataToVerify = new TextEncoder().encode(`${head}.${payload}`);
    const sigBytes = new Uint8Array(unb64url(sig));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      dataToVerify,
    );
    if (!valid) return null;

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    ) as OwnerClaims;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function extractSessionToken(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim().split("="));
  for (const name of COMPAT_COOKIES) {
    const found = cookies.find(([k]) => k === name);
    if (found && found[1]) return decodeURIComponent(found[1]);
  }
  return null;
}

export function createSessionCookie(
  token: string,
  maxAgeSeconds: number = 7 * 86400,
  secure: boolean = true,
): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secureFlag}`;
}

export function createClearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Checks whether the request carries a valid signed owner claim.
 */
export async function verifyOwnerIdentity(
  headers: Headers,
  secret: string,
  options: { allowedOrigins?: readonly string[] } = {},
): Promise<{ isOwner: boolean; claims?: OwnerClaims }> {
  const origin = headers.get("origin");
  if (origin) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return { isOwner: false };
    }
    const localDevOrigin =
      envAllowsLocalOrigin() &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    const allowedOrigins =
      options.allowedOrigins ??
      (process.env.YOLO_WEB_AUTH_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (!localDevOrigin && !allowedOrigins.includes(parsed.origin))
      return { isOwner: false };
  }

  const secSite = headers.get("sec-fetch-site");
  if (secSite === "cross-site") {
    return { isOwner: false };
  }

  const token = extractSessionToken(headers);
  if (!token) {
    return { isOwner: false };
  }

  const claims = await verifySessionToken(token, secret);
  if (!claims) {
    return { isOwner: false };
  }

  const isOwner = Boolean(claims.is_owner || claims.role === "owner");
  return { isOwner, claims };
}

function envAllowsLocalOrigin(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function generateCsrfToken(sessionId: string, secret: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${sessionId}:${secret}:${Date.now()}`);
  return hasher.digest("hex");
}
