import { describe, expect, test } from "bun:test";
import { buildMultipartFrame } from "./server.ts";

describe("buildMultipartFrame", () => {
  test.each([1, 2, 3, 4, 1000, 65537])(
    "matches the reference encoding for %d bytes",
    (length) => {
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      const frame = buildMultipartFrame(Buffer.from(bytes).toString("base64"));
      const header = new TextEncoder().encode(
        `--yolo-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${length}\r\n\r\n`,
      );
      const expected = new Uint8Array(header.length + length + 2);
      expected.set(header, 0);
      expected.set(bytes, header.length);
      expected.set([0x0d, 0x0a], header.length + length);
      expect(Buffer.compare(frame, expected)).toBe(0);
    },
  );

  test("rejects malformed base64", () => {
    expect(() => buildMultipartFrame("@@@@")).toThrow();
  });
});
