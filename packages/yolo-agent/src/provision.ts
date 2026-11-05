// SPDX-License-Identifier: Apache-2.0
/**
 * Hands bridge coordinates to the loaded extension. The values go into
 * chrome.storage.session (memory only) through the loopback DevTools port of
 * the extension's service worker; nothing is written to disk.
 */
import { WsCdpTransport } from "./cdp.ts";

export interface ExtensionTarget {
  id: string;
  url: string;
  extensionId: string;
  webSocketDebuggerUrl: string;
}

export interface ProvisionConfig {
  bridgeUrl: string;
  bridgeToken: string;
  nhitlOptIn?: boolean;
  autonomy?: string;
}

/** Waits for the YOLO extension's service worker target to appear. */
export async function findExtensionWorker(
  endpoint: string,
  timeoutMs = 15_000,
): Promise<ExtensionTarget> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      const targets = (await response.json()) as {
        id: string;
        type: string;
        url: string;
        webSocketDebuggerUrl: string;
      }[];
      const hit = targets.find(
        (t) =>
          t.type === "service_worker" &&
          /^chrome-extension:\/\/[a-p]{32}\/service-worker\.js$/.test(t.url),
      );
      if (hit) {
        return {
          id: hit.id,
          url: hit.url,
          extensionId: new URL(hit.url).hostname,
          webSocketDebuggerUrl: hit.webSocketDebuggerUrl,
        };
      }
    } catch {
      // endpoint not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    "extension service worker target not found (extension not loaded?)",
  );
}

export async function provisionExtension(
  endpoint: string,
  config: ProvisionConfig,
): Promise<ExtensionTarget> {
  const target = await findExtensionWorker(endpoint);
  const transport = await WsCdpTransport.connect(target.webSocketDebuggerUrl);
  try {
    // The worker's execution context can exist a moment before `chrome` is injected.
    let failure = "";
    for (let attempt = 0; attempt < 25; attempt++) {
      const res = await transport.send("Runtime.evaluate", {
        expression: `chrome.storage.session.set(${JSON.stringify(config)}).then(() => "ok")`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!res.exceptionDetails) return target;
      failure =
        res.exceptionDetails.exception?.description ??
        res.exceptionDetails.text;
      if (!failure.includes("chrome is not defined")) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`provisioning failed: ${failure}`);
  } finally {
    transport.close();
  }
  return target;
}
