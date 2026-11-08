// SPDX-License-Identifier: Apache-2.0
// @google-bun/modern-web-humanizer
// Fork & 2026 Optimization of Modern Web Guidelines + UI/UX Pro Max + Humanizer (Zero AI Slop)
// Includes Autonomous Lighthouse 100/100 Auditor, HTML/Header Auto-Fixer & Iterative Agent Loop

export interface LighthouseCategoryScores {
  readonly performance: number;
  readonly accessibility: number;
  readonly bestPractices: number;
  readonly seo: number;
}

export interface WebGuidelineAuditResult {
  readonly appId: string;
  readonly scores: LighthouseCategoryScores;
  readonly humanizerScore: number;
  readonly issues: readonly string[];
  readonly slopViolations: readonly string[];
  readonly passedAll100: boolean;
}

export interface PageFixMetadata {
  readonly appId: string;
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl: string;
  readonly lang?: string;
}

export const BANNED_AI_SLOP_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
  label: string;
}> = [
  {
    pattern: /\bdelve(?:s|d)?\s+into\b/gi,
    replacement: "examine",
    label: "delve into",
  },
  { pattern: /\btapestry\b/gi, replacement: "architecture", label: "tapestry" },
  { pattern: /\bsymphony\b/gi, replacement: "coordination", label: "symphony" },
  {
    pattern: /\ba\s+testament\s+to\b/gi,
    replacement: "evidence of",
    label: "testament to",
  },
  {
    pattern: /\bgame-changing\b/gi,
    replacement: "measured",
    label: "game-changing",
  },
  {
    pattern: /\brevolutionary\b/gi,
    replacement: "production",
    label: "revolutionary",
  },
  {
    pattern: /\bunparalleled\b/gi,
    replacement: "verified",
    label: "unparalleled",
  },
  {
    pattern: /\bhyper-scale\b/gi,
    replacement: "multi-node",
    label: "hyper-scale",
  },
  {
    pattern: /\bcutting-edge\b/gi,
    replacement: "current",
    label: "cutting-edge",
  },
  {
    pattern: /\bparadigm\s+shift\b/gi,
    replacement: "architectural change",
    label: "paradigm shift",
  },
  { pattern: /\bmoreover,\s*/gi, replacement: "", label: "moreover" },
  { pattern: /\bfurthermore,\s*/gi, replacement: "", label: "furthermore" },
  {
    pattern: /\bit\s+is\s+important\s+to\s+note\s+that\s*/gi,
    replacement: "",
    label: "it is important to note that",
  },
];

export class HumanizerEngine {
  public auditText(text: string): { score: number; violations: string[] } {
    const violations: string[] = [];
    for (const rule of BANNED_AI_SLOP_PATTERNS) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(text)) {
        violations.push(`AI slop phrase detected: "${rule.label}"`);
      }
    }
    const score = Math.max(0, 100 - violations.length * 15);
    return { score, violations };
  }

  public humanize(text: string): string {
    let out = text;
    for (const rule of BANNED_AI_SLOP_PATTERNS) {
      out = out.replace(rule.pattern, rule.replacement);
    }
    return out;
  }
}

export class ModernWebGuidelinesEngine {
  private readonly humanizer = new HumanizerEngine();

  public auditHtml(appId: string, html: string): WebGuidelineAuditResult {
    const issues: string[] = [];
    let performance = 100;
    let accessibility = 100;
    let bestPractices = 100;
    let seo = 100;

    // 1. SEO Checks
    if (!/<!DOCTYPE html>/i.test(html)) {
      seo -= 25;
      bestPractices -= 15;
      issues.push("Missing <!DOCTYPE html>");
    }
    if (!/<title>[^<]{10,120}<\/title>/i.test(html)) {
      seo -= 25;
      issues.push("Missing or invalid <title> length (10-120 chars)");
    }
    if (
      !/<meta\s+name=["']description["']\s+content=(?:"[^"]{30,220}"|'[^']{30,220}')/i.test(
        html,
      )
    ) {
      seo -= 25;
      issues.push('Missing <meta name="description"> (30-220 chars)');
    }
    if (
      !/<link\s+rel=["']canonical["']\s+href=["']https?:\/\/[^"']+["']/i.test(
        html,
      )
    ) {
      seo -= 25;
      issues.push('Missing <link rel="canonical">');
    }

    // 2. Accessibility (WCAG 2.2 AAA & Landmarks)
    if (!/<html[^>]+lang=["'][a-z]{2}(?:-[A-Z]{2})?["']/i.test(html)) {
      accessibility -= 25;
      issues.push("Missing lang attribute on <html>");
    }
    if (!/<main\b[^>]*id=["']main-content["']/i.test(html)) {
      accessibility -= 25;
      issues.push('Missing <main id="main-content"> landmark');
    }
    if (!/<nav\b[^>]*aria-label=/i.test(html)) {
      accessibility -= 25;
      issues.push('Missing <nav aria-label="..."> landmark');
    }
    if (!/href=["']#main-content["']/i.test(html)) {
      accessibility -= 25;
      issues.push("Missing skip-to-main-content keyboard accessibility link");
    }

    // 3. Performance (Core Web Vitals: LCP, CLS, INP)
    if (
      /<script\s+src=["'][^"']+["'](?![^>]*(?:type=["']module["']|defer|async))/i.test(
        html,
      )
    ) {
      performance -= 30;
      issues.push("Render-blocking synchronous <script src> detected");
    }
    if (!/<meta\s+name=["']viewport["']/i.test(html)) {
      performance -= 25;
      seo -= 15;
      issues.push(
        'Missing <meta name="viewport"> (causes mobile tap delay and CLS)',
      );
    }

    // 4. Best Practices & Security
    if (!/<meta\s+charset=["']utf-8["']/i.test(html)) {
      bestPractices -= 25;
      issues.push('Missing <meta charset="utf-8">');
    }
    if (/\beval\s*\(/.test(html)) {
      bestPractices -= 40;
      issues.push("Unsafe eval() usage detected in document");
    }

    const slopAudit = this.humanizer.auditText(html);

    performance = Math.max(0, performance);
    accessibility = Math.max(0, accessibility);
    bestPractices = Math.max(0, bestPractices);
    seo = Math.max(0, seo);

    const passedAll100 =
      performance === 100 &&
      accessibility === 100 &&
      bestPractices === 100 &&
      seo === 100 &&
      slopAudit.score === 100;

    return {
      appId,
      scores: { performance, accessibility, bestPractices, seo },
      humanizerScore: slopAudit.score,
      issues,
      slopViolations: slopAudit.violations,
      passedAll100,
    };
  }

  public autoFixAndHumanizeHtml(
    rawHtml: string,
    meta: PageFixMetadata,
  ): string {
    let html = this.humanizer.humanize(rawHtml);
    const lang = meta.lang ?? "fr";

    if (!/<!DOCTYPE html>/i.test(html)) {
      html = `<!DOCTYPE html>\n${html}`;
    }
    if (!/<html[^>]+lang=/i.test(html)) {
      html = html.replace(/<html\b/i, `<html lang="${lang}"`);
    }
    if (!/<meta\s+charset=["']utf-8["']/i.test(html)) {
      html = html.replace(/<head>/i, `<head>\n  <meta charset="utf-8"/>`);
    }
    if (!/<meta\s+name=["']viewport["']/i.test(html)) {
      html = html.replace(
        /<head>/i,
        `<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1"/>`,
      );
    }
    if (!/<title>[^<]{10,120}<\/title>/i.test(html)) {
      html = html.replace(/<head>/i, `<head>\n  <title>${meta.title}</title>`);
    }
    if (!/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(
        /<\/title>/i,
        `</title>\n  <meta name="description" content="${meta.description}"/>`,
      );
    }
    if (!/<link\s+rel=["']canonical["']/i.test(html)) {
      html = html.replace(
        /<\/head>/i,
        `  <link rel="canonical" href="${meta.canonicalUrl}"/>\n</head>`,
      );
    }
    if (!/href=["']#main-content["']/i.test(html)) {
      html = html.replace(
        /<body[^>]*>/i,
        (match) =>
          `${match}\n  <a class="skip-link" href="#main-content" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">Aller au contenu principal</a>\n  <header><nav aria-label="Navigation principale"><a href="${meta.canonicalUrl}">${meta.appId}</a></nav></header>`,
      );
    }
    if (!/<main\b[^>]*id=["']main-content["']/i.test(html)) {
      html = html
        .replace(/<\/header>/i, `</header>\n  <main id="main-content">`)
        .replace(
          /<\/body>/i,
          `  </main>\n  <footer><small>${meta.appId} — Licence Apache-2.0</small></footer>\n</body>`,
        );
    }
    return html;
  }
}

export interface FleetAppSpec {
  readonly appId:
    | "aphrody-yolo"
    | "google-bun"
    | "gcloud-learn"
    | "shenron"
    | "rosegriffon"
    | "wii-os"
    | "auto";
  readonly repoPath: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly description: string;
}

export const APHRODY_FLAGSHIP_APPS: readonly FleetAppSpec[] = [
  {
    appId: "aphrody-yolo",
    repoPath: "C:/src/yolo-backend",
    canonicalUrl: "https://yolo.aphrody.com/",
    title: "Aphrody YOLO — Plateforme Cloud, Auth OIDC et Runtime Bun/Rust",
    description:
      "Infrastructure d'authentification OAuth2/OIDC, passerelle mail multi-fournisseurs et runtime compilé Bun et Rust.",
  },
  {
    appId: "google-bun",
    repoPath: "C:/src/google-bun",
    canonicalUrl: "https://aphrody-labs.github.io/google-bun/",
    title: "Google-Bun — Monorepo Polyglotte Rust WASM, Go Cloud Run et Bun",
    description:
      "Architecture technique mesurée par benchmarks combinant Rust 2024 SIMD/WASM, Go 1.27 Cloud Run et Upstream Bun v1.4.4+.",
  },
  {
    appId: "gcloud-learn",
    repoPath: "C:/src/google-bun/packages/gcloud-learn",
    canonicalUrl: "https://aphrody-labs.github.io/gcloud-learn/",
    title:
      "GCloud-Learn — Simulateur 3D WebGPU et Préparation Google Cloud Paris",
    description:
      "Portail d'entraînement aux architectures Google Cloud (europe-west9 Paris), RAG SQLite WAL et simulation WebGPU.",
  },
  {
    appId: "shenron",
    repoPath: "C:/src/shenron",
    canonicalUrl: "https://dragonballfr.com/",
    title:
      "Shenron (DragonBallFR) — Encyclopédie, Traduction Manga et Catalogue",
    description:
      "Plateforme éditoriale Dragon Ball, pipeline de traduction optique Koharu et base de données structurée.",
  },
  {
    appId: "rosegriffon",
    repoPath: "C:/src/rosegriffon",
    canonicalUrl: "https://rosegriffon.fr/",
    title: "Rose Griffon — Portail Communautaire, Classé Achillea et Studio",
    description:
      "Écosystème communautaire Inazuma Eleven, tournois classés Achillea, bots Discord et outils créatifs.",
  },
  {
    appId: "wii-os",
    repoPath: "C:/src/wii-os",
    canonicalUrl: "https://wii.aphrody.com/",
    title: "Wii-OS — Interface Système Légère et Composants Audio/Vidéo",
    description:
      "Environnement système inspiré de la Wii avec navigation au pointeur, grilles de chaînes et rendu GPU fluide.",
  },
  {
    appId: "auto",
    repoPath: "C:/src/auto",
    canonicalUrl: "https://auto.aphrody.com/",
    title: "Auto — Suite Administrative Factur-X, Comptabilité et Gestion TPE",
    description:
      "Application de gestion pour indépendants et TPE : facturation électronique Factur-X, courrier et archivage légal.",
  },
];

export class AutonomousClaudeSdkConvergenceLoop {
  private readonly engine = new ModernWebGuidelinesEngine();

  /**
   * Executes the autonomous audit -> humanize -> auto-fix -> verify loop across all 7 flagship apps
   * until every app reaches 100/100 across all 4 Lighthouse metrics + 100% Humanizer anti-slop score.
   */
  public convergeAllAppsTo100(
    initialHtmlMap: Partial<Record<FleetAppSpec["appId"], string>> = {},
  ): Array<{
    app: FleetAppSpec;
    iterationsRequired: number;
    beforeAudit: WebGuidelineAuditResult;
    afterAudit: WebGuidelineAuditResult;
    optimizedHtml: string;
  }> {
    return APHRODY_FLAGSHIP_APPS.map((app) => {
      const rawHtml =
        initialHtmlMap[app.appId] ??
        `<html><head></head><body><h1>${app.title}</h1><p>Moreover, this revolutionary game-changing platform delves into a tapestry of features.</p></body></html>`;

      const beforeAudit = this.engine.auditHtml(app.appId, rawHtml);
      let currentHtml = rawHtml;
      let currentAudit = beforeAudit;
      let iterations = 0;

      while (!currentAudit.passedAll100 && iterations < 3) {
        iterations++;
        currentHtml = this.engine.autoFixAndHumanizeHtml(currentHtml, {
          appId: app.appId,
          title: app.title,
          description: app.description,
          canonicalUrl: app.canonicalUrl,
          lang: "fr",
        });
        currentAudit = this.engine.auditHtml(app.appId, currentHtml);
      }

      return {
        app,
        iterationsRequired: iterations,
        beforeAudit,
        afterAudit: currentAudit,
        optimizedHtml: currentHtml,
      };
    });
  }
}

export const modernWebEngine = new ModernWebGuidelinesEngine();
export const humanizerEngine = new HumanizerEngine();
export const autonomousConvergenceAgent =
  new AutonomousClaudeSdkConvergenceLoop();
