import { describe, expect, it } from "bun:test";
import {
  ChallengeSolverEngine,
  CHROMIUM_2026_DEFAULT_PROFILE,
  type ChallengeType,
} from "./index.js";

describe("@yolo-web/challenge-solver - 2026 Chromium Legitimacy & Challenge Engine", () => {
  const solver = new ChallengeSolverEngine();

  it("generates authentic Chromium legitimacy injection script", () => {
    const script = solver.generateChromiumLegitimacyScript();
    expect(script).toContain("Object.defineProperty(navigator, 'webdriver'");
    expect(script).toContain("window.chrome = {");
    expect(script).toContain("ANGLE (NVIDIA");
    expect(script).toContain("hardwareConcurrency");
    expect(script).toContain("deviceMemory");
  });

  it("detects Cloudflare Turnstile in page HTML", () => {
    const html = `
      <div class="login-box">
        <form>
          <div class="cf-turnstile" data-sitekey="0x4AAAAAAAJk0ABC12345XYZ"></div>
          <button type="submit">Log in</button>
        </form>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      </div>
    `;
    const detection = solver.detectChallenge(html);
    expect(detection.detected).toBe(true);
    expect(detection.type).toBe("cloudflare-turnstile");
    expect(detection.siteKey).toBe("0x4AAAAAAAJk0ABC12345XYZ");
  });

  it("detects Cloudflare Managed Challenge interstitial page", () => {
    const html = `
      <!doctype html>
      <html>
        <head><title>Just a moment...</title></head>
        <body class="cf-challenge-running">
          <div id="challenge-stage">
            <p>Checking your browser before accessing cloudflare.com...</p>
          </div>
        </body>
      </html>
    `;
    const detection = solver.detectChallenge(html);
    expect(detection.detected).toBe(true);
    expect(detection.type).toBe("cloudflare-managed-challenge");
  });

  it("detects Google reCAPTCHA v2 and v3 elements", () => {
    const v2Html = `
      <form action="/verify">
        <div class="g-recaptcha" data-sitekey="6Lc_example_v2_sitekey"></div>
        <script src="https://www.google.com/recaptcha/api.js"></script>
      </form>
    `;
    const v2Detection = solver.detectChallenge(v2Html);
    expect(v2Detection.detected).toBe(true);
    expect(v2Detection.type).toBe("google-recaptcha-v2");
    expect(v2Detection.siteKey).toBe("6Lc_example_v2_sitekey");

    const v3Html = `
      <script src="https://www.google.com/recaptcha/enterprise.js?render=6Ld_enterprise_key"></script>
      <script>grecaptcha.enterprise.execute('6Ld_enterprise_key', {action: 'login'});</script>
    `;
    const v3Detection = solver.detectChallenge(v3Html);
    expect(v3Detection.detected).toBe(true);
    expect(v3Detection.type).toBe("google-recaptcha-v3");
  });

  it("detects Google IPP / One Tap Credential Attestation", () => {
    const ippHtml = `
      <div id="g_id_onload"
           data-client_id="123456789-googleclientid.apps.googleusercontent.com"
           data-auto_prompt="false">
      </div>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
    `;
    const ippDetection = solver.detectChallenge(ippHtml);
    expect(ippDetection.detected).toBe(true);
    expect(ippDetection.type).toBe("google-ipp-attestation");
    expect(ippDetection.siteKey).toContain("googleclientid");
  });

  it("reports detected challenges as unsupported without clicking or inventing tokens", async () => {
    const types: ChallengeType[] = [
      "cloudflare-turnstile",
      "cloudflare-managed-challenge",
      "google-recaptcha-v2",
      "google-recaptcha-v3",
      "google-ipp-attestation",
    ];

    for (const type of types) {
      const res = await solver.solveChallenge({ detected: true, type });

      expect(res.success).toBe(false);
      expect(res.supported).toBe(false);
      expect(res.detected).toBe(true);
      expect(res.type).toBe(type);
      expect("token" in res).toBe(false);
      expect(res.reason).toContain("interactive verification is not implemented");
    }

    const noChallenge = await solver.solveChallenge({ detected: false });
    expect(noChallenge.detected).toBe(false);
    expect(noChallenge.supported).toBe(false);
    expect(noChallenge.reason).toContain("No supported challenge marker");
  });

  it("generates authentic 2026 Chromium wire headers with client hints", () => {
    const headers = solver.generateAuthenticHeaders();
    expect(headers["sec-ch-ua"]).toContain("Chromium");
    expect(headers["sec-ch-ua-platform"]).toBe('"Windows"');
    expect(headers["user-agent"]).toContain("146.0.7530.120");
    expect(headers["sec-fetch-dest"]).toBe("document");
    expect(headers["accept-encoding"]).toContain("zstd");
  });
});
