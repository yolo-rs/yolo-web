// SPDX-License-Identifier: Apache-2.0
/** Node-free-of-browser helper: append-only JSONL file sink for AuditLog (host side only). */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function fileAuditSink(path: string): (line: string) => Promise<void> {
  let ready: Promise<unknown> | undefined;
  return async (line) => {
    ready ??= mkdir(dirname(path), { recursive: true });
    await ready;
    await appendFile(path, line);
  };
}
