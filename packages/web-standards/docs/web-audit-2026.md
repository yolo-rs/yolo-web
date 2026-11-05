# Web Audit Toolchain 2026

Installed globally with `bun add -g` (no npm).

| Domain                   | Tools                                                |
| :----------------------- | :--------------------------------------------------- |
| Performance / CWV        | lighthouse, @lhci/cli, web-vitals, psi, unlighthouse |
| Accessibility (WCAG 2.2) | @axe-core/cli, axe-core, pa11y                       |
| Browser                  | puppeteer-core, chrome-launcher                      |
| Benchmark                | tinybench, mitata, size-limit                        |
| SEO / deploy             | next-sitemap, vercel                                 |

Skills (`.agents/skills`): vercel-labs/agent-skills, addyosmani/web-quality-skills.

Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1, axe violations = 0.

Blocked postinstalls (puppeteer, chromedriver, workerd, ...) are not trusted by default; run `bun pm -g trust <pkg>` after review.

Verified by grind goal `goal-web-audit-tooling` (`bun run grind` in yolo).
