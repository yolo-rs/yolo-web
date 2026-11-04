import { expect, test } from "bun:test";
import { resolveGoogleBinary, resolveGoogleCommand } from "../src/auth.ts";

test("Google facade reports a native binary when one is configured or installed", () => {
  const previous = Bun.env.YOLO_WEB_GOOGLE_BIN;
  try {
    Bun.env.YOLO_WEB_GOOGLE_BIN = "C:/native/yolo-web-google.exe";
    expect(resolveGoogleBinary()).toBe("C:/native/yolo-web-google.exe");
  } finally {
    if (previous === undefined) delete Bun.env.YOLO_WEB_GOOGLE_BIN;
    else Bun.env.YOLO_WEB_GOOGLE_BIN = previous;
  }
});

test("Google CLI resolves the canonical multi-call owner before legacy links", () => {
  const previous = Bun.env.YOLO_WEB_GOOGLE_BIN;
  delete Bun.env.YOLO_WEB_GOOGLE_BIN;
  try {
    const which = (name: string) => (name === "yolo-web" ? "/native/yolo-web" : "/legacy/google");
    expect(resolveGoogleCommand(which)).toEqual(["/native/yolo-web", "google"]);
    expect(resolveGoogleCommand(name => (name === "google" ? "/native/google" : null))).toEqual(["/native/google"]);
    expect(() => resolveGoogleCommand(() => null)).toThrow("install yolo-web-google");
    Bun.env.YOLO_WEB_GOOGLE_BIN = "/configured/google";
    expect(resolveGoogleCommand(() => null)).toEqual(["/configured/google"]);
  } finally {
    if (previous === undefined) delete Bun.env.YOLO_WEB_GOOGLE_BIN;
    else Bun.env.YOLO_WEB_GOOGLE_BIN = previous;
  }
});
