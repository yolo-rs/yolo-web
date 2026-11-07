#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * Browser-owned agent host. `yolo-chromium --bun-host` spawns this entry under
 * its supervisor (crates/yolo-chromium/src/bun_host.rs).
 *
 * Contract with the supervisor:
 *  - env YOLO_CDP_PORT        loopback DevTools port of the owning browser
 *  - env YOLO_AGENT_PROFILE   profile/audit directory (optional)
 *  - env YOLO_BRIDGE_PORT     fixed bridge port (optional, default random)
 *  - stdin line 1             per-run bridge token (never argv, never logged)
 *  - stdin EOF                the browser is gone: shut down
 *  - stdout                   one JSON line `{"event":"ready","url":...,"bun":...}`
 *                             once the bridge answers; it never contains the token
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { startBridge } from "./bridge.ts";
import { setup } from "./cli.ts";

/** Reads the first stdin line and then resolves `eof` when stdin closes. */
export async function readTokenThenWatch(
  stream: ReadableStream<Uint8Array>,
  onEof: () => void,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let token: string | undefined;
  let resolveToken!: (value: string) => void;
  const first = new Promise<string>((res) => {
    resolveToken = res;
  });
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const newline = buffer.indexOf("\n");
      if (token === undefined && newline >= 0) {
        token = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        resolveToken(token);
      }
    }
    if (token === undefined) resolveToken("");
    onEof();
  })();
  return first;
}

export async function main(): Promise<number> {
  const cdpPort = Number(Bun.env.YOLO_CDP_PORT);
  if (!Number.isInteger(cdpPort) || cdpPort <= 0 || cdpPort > 65535) {
    console.error("host: YOLO_CDP_PORT is missing or invalid");
    return 2;
  }
  let stop: () => Promise<void> = async () => undefined;
  let eof = false;
  const token = await readTokenThenWatch(Bun.stdin.stream(), () => {
    eof = true;
    void stop().then(() => process.exit(0));
  });
  if (token.length < 16) {
    console.error("host: bridge token missing on stdin");
    return 2;
  }
  const profile = Bun.env.YOLO_AGENT_PROFILE
    ? resolve(Bun.env.YOLO_AGENT_PROFILE)
    : undefined;
  if (profile) await mkdir(profile, { recursive: true });
  const rt = await setup({
    _: [],
    cdp: `http://127.0.0.1:${cdpPort}`,
    ...(profile ? { profile } : {}),
  });
  const bridge = startBridge({
    port: Bun.env.YOLO_BRIDGE_PORT
      ? Number(Bun.env.YOLO_BRIDGE_PORT)
      : undefined,
    token,
    backend: rt.backend,
    session: rt.session,
    driver: "cdp",
    nhitlOptIn: false,
  });
  stop = async () => {
    await bridge.stop();
    await rt.close();
  };
  process.on("SIGTERM", () => void stop().then(() => process.exit(0)));
  process.on("SIGINT", () => void stop().then(() => process.exit(0)));
  if (eof) {
    await stop();
    return 0;
  }
  process.stdout.write(
    `${JSON.stringify({ event: "ready", url: bridge.url, port: bridge.port, bun: Bun.version, pid: process.pid })}\n`,
  );
  await new Promise<never>(() => undefined);
  return 0;
}

if (import.meta.main) process.exit(await main());
