/**
 * Advanced Bot Detection Evasion & Stealth Fingerprint Engine.
 * Features:
 * - Navigator webdriver masking
 * - WebGL vendor & renderer spoofing
 * - Canvas micro-perturbation (defeats static canvas fingerprinting)
 * - AudioContext noise injection
 * - Chrome runtime, CSI, loadTimes emulation
 * - Plugins, MIME types, languages, and permissions spoofing
 * - Human-like Bezier curve mouse trajectory generator
 */

export interface StealthOptions {
  maskWebdriver?: boolean;
  spoofWebGL?: boolean;
  spoofCanvas?: boolean;
  spoofAudio?: boolean;
  spoofChrome?: boolean;
  languages?: string[];
  vendor?: string;
  renderer?: string;
}

export const DEFAULT_STEALTH_OPTIONS: StealthOptions = {
  maskWebdriver: true,
  spoofWebGL: true,
  spoofCanvas: true,
  spoofAudio: true,
  spoofChrome: true,
  languages: ["fr-FR", "fr", "en-US", "en"],
  vendor: "Google Inc. (NVIDIA)",
  renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)",
};

export class ObscuraStealthEngine {
  generateFingerprint(profile: { os?: string; browser?: string } = {}) {
    return {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      webglVendor: DEFAULT_STEALTH_OPTIONS.vendor,
      webglRenderer: DEFAULT_STEALTH_OPTIONS.renderer,
      secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
      languages: DEFAULT_STEALTH_OPTIONS.languages,
    };
  }

  getInjectionScript(options?: StealthOptions): string {
    return buildStealthInjectionScript(options);
  }
}

/**
 * Builds the JavaScript snippet injected on every document navigation.
 */
export function buildStealthInjectionScript(options: StealthOptions = DEFAULT_STEALTH_OPTIONS): string {
  const opts = { ...DEFAULT_STEALTH_OPTIONS, ...options };

  return `
(() => {
  try {
    // 1. Mask navigator.webdriver
    ${
      opts.maskWebdriver
        ? `
      if (Object.defineProperty) {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true,
          enumerable: true
        });
        delete Object.getPrototypeOf(navigator).webdriver;
      }
    `
        : ""
    }

    // 2. Emulate window.chrome
    ${
      opts.spoofChrome
        ? `
      if (!window.chrome) {
        window.chrome = {
          app: {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
          },
          runtime: {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
            connect: function() {},
            sendMessage: function() {}
          },
          csi: function() { return { startE: Date.now(), onloadT: Date.now() + 100, pageT: 120.4, tran: 15 }; },
          loadTimes: function() {
            return {
              requestTime: Date.now() / 1000 - 0.2,
              startLoadTime: Date.now() / 1000 - 0.1,
              commitLoadTime: Date.now() / 1000,
              finishDocumentLoadTime: Date.now() / 1000 + 0.1,
              firstPaintTime: Date.now() / 1000 + 0.05,
              firstPaintAfterLoadTime: 0,
              navigationType: 'Other',
              wasFetchedViaSpdy: true,
              wasNpnNegotiated: true,
              npnNegotiatedProtocol: 'h2',
              wasAlternateProtocolAvailable: false,
              connectionInfo: 'h2'
            };
          }
        };
      }
    `
        : ""
    }

    // 3. Languages and platform
    Object.defineProperty(navigator, 'languages', {
      get: () => ${JSON.stringify(opts.languages)},
      configurable: true
    });

    // 4. WebGL Vendor & Renderer Masking
    ${
      opts.spoofWebGL
        ? `
      const targetVendor = ${JSON.stringify(opts.vendor)};
      const targetRenderer = ${JSON.stringify(opts.renderer)};
      const getParameterOld = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return targetVendor; // UNMASKED_VENDOR_WEBGL
        if (parameter === 37446) return targetRenderer; // UNMASKED_RENDERER_WEBGL
        return getParameterOld.call(this, parameter);
      };
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2Old = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return targetVendor;
          if (parameter === 37446) return targetRenderer;
          return getParameter2Old.call(this, parameter);
        };
      }
    `
        : ""
    }

    // 5. Canvas Micro-Perturbation
    ${
      opts.spoofCanvas
        ? `
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imgData = ctx.getImageData(0, 0, Math.min(10, this.width), Math.min(10, this.height));
            // Tiny imperceptible 1-bit shift in the first pixel to randomize hash
            imgData.data[0] = (imgData.data[0] ^ 1);
            ctx.putImageData(imgData, 0, 0);
          } catch (_) {}
        }
        return origToDataURL.apply(this, args);
      };

      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const data = origGetImageData.apply(this, args);
        if (data && data.data && data.data.length > 0) {
          data.data[0] = (data.data[0] ^ 1);
        }
        return data;
      };
    `
        : ""
    }

    // 6. Permissions Spoofing
    if (navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query;
      navigator.permissions.query = function(param) {
        if (param && param.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return origQuery.apply(this, arguments);
      };
    }

    // 7. Plugins length non-zero
    if (navigator.plugins && navigator.plugins.length === 0) {
      const fakePlugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' }
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => fakePlugins,
        configurable: true
      });
    }

  } catch (err) {
    // Fail closed quietly without exposing exceptions to the page
  }
})();
  `.trim();
}

export interface MousePoint {
  x: number;
  y: number;
  timestampOffsetMs: number;
}

export interface TrajectoryOptions {
  steps?: number;
  durationMs?: number;
  jitter?: number;
}

/**
 * Generate human-like mouse movement coordinates using a cubic Bezier curve
 * with natural acceleration, deceleration, and micro-jitter.
 */
export function generateHumanMouseTrajectory(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  options: TrajectoryOptions = {}
): MousePoint[] {
  const steps = Math.max(8, options.steps ?? 25);
  const durationMs = options.durationMs ?? 200;
  const jitter = options.jitter ?? 1.5;

  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.hypot(dx, dy);

  // Control points for cubic Bezier
  const deviation = Math.min(60, dist * 0.2);
  const cp1X = startX + dx * 0.25 + (Math.random() - 0.5) * deviation;
  const cp1Y = startY + dy * 0.25 + (Math.random() - 0.5) * deviation;
  const cp2X = startX + dx * 0.75 + (Math.random() - 0.5) * deviation;
  const cp2Y = startY + dy * 0.75 + (Math.random() - 0.5) * deviation;

  const points: MousePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const rawT = i / steps;
    // Ease-in / ease-out cubic pacing
    const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    let x = uuu * startX + 3 * uu * t * cp1X + 3 * u * tt * cp2X + ttt * targetX;
    let y = uuu * startY + 3 * uu * t * cp1Y + 3 * u * tt * cp2Y + ttt * targetY;

    // Apply micro-jitter except at the endpoints
    if (i > 0 && i < steps) {
      x += (Math.random() - 0.5) * jitter;
      y += (Math.random() - 0.5) * jitter;
    }

    points.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      timestampOffsetMs: Math.round(rawT * durationMs),
    });
  }

  return points;
}
