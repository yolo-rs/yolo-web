// SPDX-License-Identifier: MIT
/**
 * `bun:google` compatibility facade on upstream Bun, served by the @yolo-web/google plugin.
 * Same surface as the existing Google runtime (`googleRuntime`, `createClient`, `chromium`, `obscura`,
 * `dns`), plus `adcCredentialProvider` for caller-owned Application Default Credentials.
 */
import chromium from "@yolo-web/chromium/chromium";
import obscura from "@yolo-web/chromium/obscura";
import { adcCredentialProvider } from "./adc.ts";
import { createClient, googleRuntime } from "./client.ts";

export { createClient, googleRuntime } from "./client.ts";
export type { GoogleClient, GoogleClientOptions, GoogleRuntime } from "./client.ts";
export { chromium, obscura };
export const dns = Bun.dns;

export { adcCredentialProvider };

export default { googleRuntime, createClient, chromium, obscura, dns, adcCredentialProvider };
