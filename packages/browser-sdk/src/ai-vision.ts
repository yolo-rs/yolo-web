/**
 * AI Vision & Semantic Accessibility Engine for Autonomous Browser Agents.
 * Produces structured multimodal observations (annotated snapshot, interactive element refs, bounding boxes, screenshot).
 */

import type { YoloPage } from "./index";

export interface ActionableElementInfo {
  ref: string;
  tag: string;
  role: string;
  name: string;
  value?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AiVisionObservation {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  snapshot: string;
  elements: ActionableElementInfo[];
  screenshotBase64?: string;
}

export class AiVisionEngine {
  /**
   * Extract high-fidelity readable markdown from current page.
   */
  static async extractMarkdown(page: YoloPage): Promise<string> {
    const script = `(() => {
      const clone = document.body ? document.body.cloneNode(true) : null;
      if (!clone) return '';

      // Strip non-content nodes
      for (const el of clone.querySelectorAll('script, style, svg, noscript, nav, footer, header')) {
        el.remove();
      }

      function nodeToMarkdown(node) {
        if (!node) return '';
        if (node.nodeType === 3) return node.textContent ? node.textContent.replace(/\\s+/g, ' ') : '';
        if (node.nodeType !== 1) return '';

        const tag = node.tagName.toLowerCase();
        const children = [...node.childNodes].map(nodeToMarkdown).join('');

        if (/^h[1-6]$/.test(tag)) {
          const level = Number(tag[1]);
          return '\\n' + '#'.repeat(level) + ' ' + children.trim() + '\\n\\n';
        }
        if (tag === 'p') return '\\n' + children.trim() + '\\n\\n';
        if (tag === 'a') return '[' + children.trim() + '](' + (node.href || '') + ')';
        if (tag === 'strong' || tag === 'b') return '**' + children + '**';
        if (tag === 'em' || tag === 'i') return '*' + children + '*';
        if (tag === 'code') return '\`' + children + '\`';
        if (tag === 'li') return '- ' + children.trim() + '\\n';
        if (tag === 'button') return '[Button: ' + children.trim() + ']';
        if (tag === 'input') return '[Input: ' + (node.value || node.placeholder || '') + ']';
        return children;
      }

      return nodeToMarkdown(clone).replace(/\\n{3,}/g, '\\n\\n').trim();
    })()`;

    const md = await page.evaluate<string>(script);
    const title = await page.title();
    return `# ${title}\n\n${md || "No content."}`;
  }

  /**
   * Build concise tagged accessibility snapshot for LLM Agents (`[e1]`, `[e2]`).
   */
  static async captureSnapshot(page: YoloPage, maxChars = 8000): Promise<{ snapshot: string; elements: ActionableElementInfo[] }> {
    const script = `(() => {
      const candidates = [...document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], h1, h2, h3, [tabindex="0"]')];
      let refCounter = 1;
      const elements = [];
      const lines = [];

      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        const ref = 'e' + (refCounter++);
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || tag;
        const name = (el.getAttribute('aria-label') || el.innerText || el.placeholder || el.value || '').trim().replace(/\\s+/g, ' ');

        elements.push({
          ref,
          tag,
          role,
          name: name.slice(0, 100),
          value: el.value || undefined,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });

        lines.push(\`[\${ref}] \${role} "\${name.slice(0, 80)}" (\${Math.round(rect.x)},\${Math.round(rect.y)})\`);
      }

      return { elements, lines };
    })()`;

    const res = await page.evaluate<{ elements: ActionableElementInfo[]; lines: string[] }>(script);
    const title = await page.title();
    const url = await page.url();

    const elements = res?.elements || [];
    const lines = res?.lines || [];

    const snapshot = `URL: ${url}\nTitle: ${title}\nActionable Elements (${elements.length}):\n${lines.join("\n")}`.slice(0, maxChars);
    return { snapshot, elements };
  }

  /**
   * Full multimodal AI Vision observation: annotated snapshot, bounding boxes, and screenshot.
   */
  static async observe(page: YoloPage, options: { withScreenshot?: boolean } = {}): Promise<AiVisionObservation> {
    const [snapshotResult, title, url, dims] = await Promise.all([
      this.captureSnapshot(page),
      page.title(),
      page.url(),
      page.evaluate<{ width: number; height: number }>("({ width: innerWidth, height: innerHeight })"),
    ]);

    let screenshotBase64: string | undefined;
    if (options.withScreenshot) {
      const bytes = await page.screenshot({ format: "jpeg", quality: 85 });
      screenshotBase64 = Buffer.from(bytes).toString("base64");
    }

    return {
      url,
      title,
      viewport: dims ?? { width: 1280, height: 800 },
      snapshot: snapshotResult.snapshot,
      elements: snapshotResult.elements,
      screenshotBase64,
    };
  }
}
