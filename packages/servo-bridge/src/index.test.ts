import { describe, expect, test } from "bun:test";
import {
  SERVO_CONSOLIDATED_CRATES,
  ServoEuclidPoint2D,
  ServoEuclidRect,
  ServoEuclidSize2D,
  ServoSelectorEngine,
  ServoViewportScale,
} from "./index";

describe("@yolo-web/servo-bridge — Euclid Geometry & Viewport Scaling", () => {
  test("ServoViewportScale scales CSS pixels to physical DevicePixels accurately", () => {
    const vp = new ServoViewportScale(1440, 900, 2.0);
    const css = vp.cssRect();
    expect(css.width).toBe(1440);
    expect(css.height).toBe(900);
    expect(css.origin.unit).toBe("CssPixel");

    const phys = vp.physicalSize();
    expect(phys.width).toBe(2880);
    expect(phys.height).toBe(1800);
    expect(phys.unit).toBe("DevicePixel");
  });

  test("ServoViewportScale clamps minimum DPR to 0.5 and round-trips points", () => {
    const vp = new ServoViewportScale(1280, 800, 0.1);
    expect(vp.devicePixelRatio).toBe(0.5);
    expect(vp.physicalSize().width).toBe(640);
    expect(vp.physicalSize().height).toBe(400);

    const hiDpi = new ServoViewportScale(1920, 1080, 1.5);
    const cssPt = new ServoEuclidPoint2D(100, 200, "CssPixel");
    const devPt = hiDpi.cssToDevicePoint(cssPt);
    expect(devPt.x).toBe(150);
    expect(devPt.y).toBe(300);
    expect(devPt.unit).toBe("DevicePixel");

    const backPt = hiDpi.deviceToCssPoint(devPt);
    expect(backPt.x).toBeCloseTo(100, 5);
    expect(backPt.y).toBeCloseTo(200, 5);
    expect(backPt.unit).toBe("CssPixel");
  });

  test("ServoEuclidRect hit-testing, center, and intersection match servo-euclid", () => {
    const rectA = ServoEuclidRect.fromXYWH(10, 20, 100, 50);
    const rectB = ServoEuclidRect.fromXYWH(60, 40, 80, 60);
    const rectC = ServoEuclidRect.fromXYWH(200, 200, 40, 40);

    expect(rectA.center().toArray()).toEqual([60, 45]);
    expect(rectA.contains(new ServoEuclidPoint2D(50, 30))).toBe(true);
    expect(rectA.contains(new ServoEuclidPoint2D(110, 70))).toBe(false);
    expect(rectA.intersects(rectB)).toBe(true);
    expect(rectA.intersects(rectC)).toBe(false);
    expect(ServoEuclidSize2D.zero().isEmpty()).toBe(true);
  });
});

describe("@yolo-web/servo-bridge — Stylo Selector Specificity & Validation", () => {
  test("calculates CSS specificity (id, class, element) and 30-bit packed value matching servo-stylo", () => {
    const s1 = ServoSelectorEngine.calculateSpecificity(
      "main#app > ul.nav li.item:hover a::after",
    );
    expect(s1.id).toBe(1);
    expect(s1.class).toBe(3); // .nav, .item, :hover
    expect(s1.element).toBe(5); // main, ul, li, a, ::after
    expect(s1.packed).toBe((1 << 20) | (3 << 10) | 5);

    const unpacked = ServoSelectorEngine.unpackSpecificity(s1.packed);
    expect(unpacked).toEqual(s1);
  });

  test("handles Selectors Level 4 :where(), :is(), :not(), and attribute selectors", () => {
    // :where() contributes 0 specificity
    const whereSpec = ServoSelectorEngine.calculateSpecificity(
      ":where(#hero .title) > span.badge",
    );
    expect(whereSpec.id).toBe(0);
    expect(whereSpec.class).toBe(1);
    expect(whereSpec.element).toBe(1);

    // :is() takes the most specific argument
    const isSpec = ServoSelectorEngine.calculateSpecificity(
      "button:is(.primary, #submit-btn)[disabled]",
    );
    expect(isSpec.id).toBe(1);
    expect(isSpec.class).toBe(1); // [disabled]
    expect(isSpec.element).toBe(1); // button
  });

  test("validates CSS selectors and translates XPath 1.0 to CSS3", () => {
    expect(
      ServoSelectorEngine.validateSelector("div.card > button[data-id='42']")
        .valid,
    ).toBe(true);
    expect(ServoSelectorEngine.validateSelector("").valid).toBe(false);
    expect(ServoSelectorEngine.validateSelector("div[unclosed").valid).toBe(
      false,
    );
    expect(ServoSelectorEngine.validateSelector("> .orphan").valid).toBe(false);

    expect(
      ServoSelectorEngine.xpathToCss(
        "//main[@id='app']/section[contains(@class, 'hero')]//button[1]",
      ),
    ).toBe("main#app > section.hero button:nth-of-type(1)");
  });
});

describe("@yolo-web/servo-bridge — WebVTT Cue Parser (servo-webvtt)", () => {
  test("parses WebVTT header, cue identifiers, timestamps, settings, and payloads", () => {
    const sampleVtt = [
      "WEBVTT - YOLO Browser Subtitle Track",
      "",
      "NOTE This comment block is ignored by the parser",
      "",
      "cue-1",
      "00:01.500 --> 00:04.250 align:start size:80%",
      "Welcome to <b>YOLO Web</b> powered by Servo!",
      "",
      "01:02:03.000 --> 01:02:06.750 line:90% position:50%",
      "Second subtitle line 1",
      "Second subtitle line 2",
    ].join("\n");

    const cues = ServoSelectorEngine.parseWebVttCues(sampleVtt);
    expect(cues).toHaveLength(2);

    expect(cues[0]!.identifier).toBe("cue-1");
    expect(cues[0]!.startTimeSeconds).toBeCloseTo(1.5, 3);
    expect(cues[0]!.endTimeSeconds).toBeCloseTo(4.25, 3);
    expect(cues[0]!.settings).toEqual({ align: "start", size: "80%" });
    expect(cues[0]!.payload).toBe(
      "Welcome to <b>YOLO Web</b> powered by Servo!",
    );

    expect(cues[1]!.identifier).toBe("");
    expect(cues[1]!.startTimeSeconds).toBeCloseTo(3723.0, 3);
    expect(cues[1]!.endTimeSeconds).toBeCloseTo(3726.75, 3);
    expect(cues[1]!.settings).toEqual({ line: "90%", position: "50%" });
    expect(cues[1]!.payload).toBe(
      "Second subtitle line 1\nSecond subtitle line 2",
    );
  });

  test("rejects invalid WebVTT headers", () => {
    expect(() =>
      ServoSelectorEngine.parseWebVttCues(
        "NOT_WEBVTT\n\n00:00.000 --> 00:01.000\nHi",
      ),
    ).toThrow("Invalid WebVTT header");
  });
});

describe("@yolo-web/servo-bridge — Consolidated Crate Registry Integrity", () => {
  test("contains all 31 consolidated crates in crates/servo-* with unique IDs", () => {
    expect(SERVO_CONSOLIDATED_CRATES).toHaveLength(31);
    const ids = new Set(SERVO_CONSOLIDATED_CRATES.map((c) => c.id));
    expect(ids.size).toBe(31);

    for (const crate of SERVO_CONSOLIDATED_CRATES) {
      expect(crate.id.startsWith("servo-")).toBe(true);
      expect(crate.path).toBe(`crates/${crate.id}`);
      expect(crate.upstreamRepo.startsWith("servo/")).toBe(true);
      expect(crate.stars).toBeGreaterThan(0);
    }
  });
});
