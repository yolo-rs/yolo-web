// SPDX-License-Identifier: MIT
/**
 * `bun:google` compatibility facade on upstream Bun, served by the @yolo-web/google plugin.
 * Same surface as the existing Google runtime (`googleRuntime`, `createClient`, `chromium`, `obscura`,
 * `dns`), plus `adcCredentialProvider` for caller-owned Application Default Credentials.
 */
import chromium from "@yolo-web/chromium/chromium";
import obscura from "@yolo-web/chromium/obscura";
import { createClient, googleRuntime } from "./client.ts";

export { createClient, googleRuntime } from "./client.ts";
export type { GoogleClient, GoogleClientOptions, GoogleRuntime } from "./client.ts";
export { chromium, obscura };
export const dns = Bun.dns;

/**
 * Credential provider over Application Default Credentials (google-auth-library), for
 * `createClient({ credentialProvider })`. Tokens stay in the auth library's cache.
 */
export function adcCredentialProvider(
  scopes: string | string[] = "https://www.googleapis.com/auth/cloud-platform",
): (signal?: AbortSignal) => Promise<string> {
  let client: Promise<{ getAccessToken(): Promise<{ token?: string | null }> }> | undefined;
  return async signal => {
    signal?.throwIfAborted();
    client ??= import("google-auth-library").then(({ GoogleAuth }) => new GoogleAuth({ scopes }).getClient());
    const { token } = await (await client).getAccessToken();
    if (!token) throw new Error("Application Default Credentials returned no access token");
    return token;
  };
}

export default { googleRuntime, createClient, chromium, obscura, dns, adcCredentialProvider };
