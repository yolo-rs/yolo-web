// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "bun:test";
import { readTokenThenWatch } from "../src/host.ts";

test("first stdin line is the token; EOF fires the watch callback", async () => {
  const enc = new TextEncoder();
  let eof = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode("abcdef0123456789abcdef\nrest"));
      controller.close();
    },
  });
  const token = await readTokenThenWatch(stream, () => {
    eof = true;
  });
  expect(token).toBe("abcdef0123456789abcdef");
  await Bun.sleep(10);
  expect(eof).toBe(true);
});

test("EOF before any line yields an empty token", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  expect(await readTokenThenWatch(stream, () => undefined)).toBe("");
});
