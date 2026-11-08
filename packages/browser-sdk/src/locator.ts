/**
 * High-Level Resilient Locator Engine (Playwright-compatible and enhanced).
 * Supports CSS, XPath, Role, Text, Label, Placeholder, AltText, Title, TestID,
 * auto-waiting, auto-retry, actionability checks, and human-like interaction.
 */

import type { YoloPage } from "./index";

export interface LocatorOptions {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
}

export interface ClickOptions {
  button?: "left" | "right" | "middle";
  clickCount?: number;
  delay?: number;
  timeout?: number;
  force?: boolean;
  humanLike?: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WaitForOptions {
  state?: "attached" | "detached" | "visible" | "hidden";
  timeout?: number;
}

/**
 * Compiles a flexible selector string into a JavaScript DOM query expression.
 */
export function compileSelectorToJs(selector: string): string {
  const trimmed = selector.trim();

  // XPath
  if (trimmed.startsWith("xpath=") || trimmed.startsWith("//") || trimmed.startsWith("(")) {
    const xpath = trimmed.startsWith("xpath=") ? trimmed.slice("xpath=".length) : trimmed;
    const escaped = JSON.stringify(xpath);
    return `(() => {
      const snap = document.evaluate(${escaped}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const res = [];
      for (let i = 0; i < snap.snapshotLength; i++) res.push(snap.snapshotItem(i));
      return res;
    })()`;
  }

  // Text: text="Submit" or text=Submit or text=/Submit/i
  if (trimmed.startsWith("text=")) {
    const raw = trimmed.slice("text=".length).trim();
    const isRegex = raw.startsWith("/") && raw.lastIndexOf("/") > 0;
    if (isRegex) {
      const lastSlash = raw.lastIndexOf("/");
      const pattern = raw.slice(1, lastSlash);
      const flags = raw.slice(lastSlash + 1);
      return `(() => {
        const re = new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)});
        return [...document.querySelectorAll('*')].filter(el => {
          const txt = el.innerText || el.textContent || '';
          return re.test(txt) && (el.children.length === 0 || !re.test([...el.children].map(c => c.innerText||'').join(' ')));
        });
      })()`;
    }
    const unquoted = raw.replace(/^["']|["']$/g, "");
    return `(() => {
      const target = ${JSON.stringify(unquoted.toLowerCase())};
      return [...document.querySelectorAll('*')].filter(el => {
        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
        return txt.includes(target) && (el.children.length === 0 || ![...el.children].some(c => (c.innerText||'').toLowerCase().includes(target)));
      });
    })()`;
  }

  // Role: role=button[name="Submit"]
  if (trimmed.startsWith("role=")) {
    const rest = trimmed.slice("role=".length).trim();
    let role = rest;
    let nameFilter: string | undefined;

    const match = rest.match(/^([a-zA-Z0-9_-]+)(?:\[name=(["']?)(.*?)\2\])?$/);
    if (match && match[1]) {
      role = match[1];
      nameFilter = match[3];
    }

    return `(() => {
      const r = ${JSON.stringify(role.toLowerCase())};
      const name = ${JSON.stringify(nameFilter?.toLowerCase())};
      return [...document.querySelectorAll('*')].filter(el => {
        const explicitRole = (el.getAttribute('role') || '').toLowerCase();
        const tag = el.tagName.toLowerCase();
        const matchesRole = explicitRole === r ||
          (r === 'button' && (tag === 'button' || (tag === 'input' && (el.type === 'button' || el.type === 'submit')))) ||
          (r === 'link' && tag === 'a' && el.hasAttribute('href')) ||
          (r === 'textbox' && (tag === 'textarea' || (tag === 'input' && (!el.type || el.type === 'text' || el.type === 'email' || el.type === 'password' || el.type === 'search')))) ||
          (r === 'heading' && /^h[1-6]$/.test(tag)) ||
          (r === 'checkbox' && tag === 'input' && el.type === 'checkbox') ||
          (r === 'radio' && tag === 'input' && el.type === 'radio');
        if (!matchesRole) return false;
        if (name !== undefined) {
          const elName = (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().toLowerCase();
          return elName.includes(name);
        }
        return true;
      });
    })()`;
  }

  // Label / aria-label: label=Username or aria-label=Close
  if (trimmed.startsWith("label=") || trimmed.startsWith("aria-label=")) {
    const raw = trimmed.includes("label=") ? (trimmed.split(/label=/)[1] ?? "").trim() : trimmed.slice("aria-label=".length).trim();
    const unquoted = raw.replace(/^["']|["']$/g, "");
    return `(() => {
      const val = ${JSON.stringify(unquoted)};
      const matched = [...document.querySelectorAll(\`[aria-label="\${val}"]\`)];
      const labels = [...document.querySelectorAll('label')].filter(l => (l.innerText||'').trim() === val);
      for (const l of labels) {
        const forId = l.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el) matched.push(el);
        } else {
          const inp = l.querySelector('input, select, textarea');
          if (inp) matched.push(inp);
        }
      }
      return matched;
    })()`;
  }

  // Placeholder: placeholder="Search"
  if (trimmed.startsWith("placeholder=")) {
    const val = trimmed.slice("placeholder=".length).trim().replace(/^["']|["']$/g, "").replace(/["\\]/g, "");
    return `[...document.querySelectorAll('[placeholder="${val}"]')]`;
  }

  // AltText: alt="Logo"
  if (trimmed.startsWith("alt=")) {
    const val = trimmed.slice("alt=".length).trim().replace(/^["']|["']$/g, "").replace(/["\\]/g, "");
    return `[...document.querySelectorAll('img[alt="${val}"]')]`;
  }

  // Title: title="Settings"
  if (trimmed.startsWith("title=")) {
    const val = trimmed.slice("title=".length).trim().replace(/^["']|["']$/g, "").replace(/["\\]/g, "");
    return `[...document.querySelectorAll('[title="${val}"]')]`;
  }

  // TestId: testid=login-button or data-testid=login-button
  if (trimmed.startsWith("testid=") || trimmed.startsWith("data-testid=")) {
    const val = trimmed.includes("testid=") ? (trimmed.split(/testid=/)[1] ?? "").trim().replace(/^["']|["']$/g, "") : trimmed;
    const clean = val.replace(/["\\]/g, "");
    return `[...document.querySelectorAll('[data-testid="${clean}"], [data-test-id="${clean}"], [data-test="${clean}"], [id="${clean}"]')]`;
  }

  // Pure CSS selector (strip leading css= if present)
  const css = trimmed.startsWith("css=") ? trimmed.slice(4) : trimmed;
  return `[...document.querySelectorAll(${JSON.stringify(css)})]`;
}

export class Locator {
  readonly page: YoloPage;
  readonly selector: string;
  private readonly options?: LocatorOptions;
  private readonly index?: number;

  constructor(
    page: YoloPage,
    selector: string,
    options?: LocatorOptions,
    index?: number
  ) {
    this.page = page;
    this.selector = selector;
    this.options = options;
    this.index = index;
  }

  private buildQueryExpression(): string {
    const baseExpr = compileSelectorToJs(this.selector);
    let expr = baseExpr;

    if (this.options?.hasText) {
      if (typeof this.options.hasText === "string") {
        expr = `(${expr}).filter(el => (el.innerText || el.textContent || '').includes(${JSON.stringify(this.options.hasText)}))`;
      } else {
        expr = `(${expr}).filter(el => new RegExp(${JSON.stringify(this.options.hasText.source)}, ${JSON.stringify(this.options.hasText.flags)}).test(el.innerText || el.textContent || ''))`;
      }
    }

    if (this.options?.hasNotText) {
      if (typeof this.options.hasNotText === "string") {
        expr = `(${expr}).filter(el => !(el.innerText || el.textContent || '').includes(${JSON.stringify(this.options.hasNotText)}))`;
      } else {
        expr = `(${expr}).filter(el => !new RegExp(${JSON.stringify(this.options.hasNotText.source)}, ${JSON.stringify(this.options.hasNotText.flags)}).test(el.innerText || el.textContent || ''))`;
      }
    }

    if (this.index !== undefined) {
      return `((${expr})[${this.index}] || null)`;
    }

    return `((${expr})[0] || null)`;
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this.page, `${this.selector} >> ${selector}`, options);
  }

  first(): Locator {
    return new Locator(this.page, this.selector, this.options, 0);
  }

  last(): Locator {
    return new Locator(this.page, this.selector, this.options, -1);
  }

  nth(index: number): Locator {
    return new Locator(this.page, this.selector, this.options, index);
  }

  filter(options: LocatorOptions): Locator {
    return new Locator(this.page, this.selector, { ...this.options, ...options }, this.index);
  }

  async count(): Promise<number> {
    const base = compileSelectorToJs(this.selector);
    const count = await this.page.evaluate<number>(`(${base}).length`);
    return count ?? 0;
  }

  async all(): Promise<Locator[]> {
    const total = await this.count();
    const locators: Locator[] = [];
    for (let i = 0; i < total; i++) {
      locators.push(this.nth(i));
    }
    return locators;
  }

  async waitFor(options: WaitForOptions = {}): Promise<void> {
    const timeout = options.timeout ?? 10_000;
    const state = options.state ?? "visible";
    const start = Date.now();
    const expr = this.buildQueryExpression();

    while (Date.now() - start < timeout) {
      const isMet = await this.page.evaluate<boolean>(`(() => {
        const el = ${expr};
        const attached = el !== null;
        if ('${state}' === 'attached') return attached;
        if ('${state}' === 'detached') return !attached;
        if (!attached) return '${state}' === 'hidden';
        const style = window.getComputedStyle(el);
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
        return '${state}' === 'visible' ? visible : !visible;
      })()`);

      if (isMet) return;
      await new Promise((r) => setTimeout(r, 50));
    }

    throw new Error(`Timeout ${timeout}ms waiting for locator("${this.selector}") to be ${state}.`);
  }

  async boundingBox(options?: { timeout?: number }): Promise<BoundingBox | null> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return this.page.evaluate<BoundingBox | null>(`(() => {
      const el = ${expr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
  }

  async click(options: ClickOptions = {}): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options.timeout });
    const box = await this.boundingBox(options);
    if (!box) {
      throw new Error(`Locator("${this.selector}") click failed: element has no bounding box.`);
    }

    const clickX = Math.round(box.x + box.width / 2);
    const clickY = Math.round(box.y + box.height / 2);

    await this.page.mouse.move(clickX, clickY, { humanLike: options.humanLike ?? true });
    await this.page.mouse.click(clickX, clickY, {
      button: options.button ?? "left",
      clickCount: options.clickCount ?? 1,
      delay: options.delay,
    });
  }

  async dblclick(options: Omit<ClickOptions, "clickCount"> = {}): Promise<void> {
    await this.click({ ...options, clickCount: 2 });
  }

  async hover(options: { timeout?: number; humanLike?: boolean } = {}): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options.timeout });
    const box = await this.boundingBox(options);
    if (!box) throw new Error(`Locator("${this.selector}") hover failed: element not visible.`);
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      humanLike: options.humanLike ?? true,
    });
  }

  async fill(value: string, options?: { timeout?: number }): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => {
      const el = ${expr};
      if (el) {
        el.focus();
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
  }

  async type(text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    await this.focus(options);
    await this.page.keyboard.type(text, options);
  }

  async press(key: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    await this.focus(options);
    await this.page.keyboard.press(key, options);
  }

  async focus(options?: { timeout?: number }): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => { const el = ${expr}; if (el) el.focus(); })()`);
  }

  async blur(options?: { timeout?: number }): Promise<void> {
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => { const el = ${expr}; if (el) el.blur(); })()`);
  }

  async check(options?: { timeout?: number }): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => {
      const el = ${expr};
      if (el && !el.checked) {
        el.click();
      }
    })()`);
  }

  async uncheck(options?: { timeout?: number }): Promise<void> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => {
      const el = ${expr};
      if (el && el.checked) {
        el.click();
      }
    })()`);
  }

  async selectOption(
    values: string | string[],
    options?: { timeout?: number }
  ): Promise<string[]> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    const targetValues = Array.isArray(values) ? values : [values];
    return this.page.evaluate<string[]>(`(() => {
      const el = ${expr};
      if (!el || el.tagName !== 'SELECT') return [];
      const targets = ${JSON.stringify(targetValues)};
      const selected = [];
      for (const opt of el.options) {
        if (targets.includes(opt.value) || targets.includes(opt.text)) {
          opt.selected = true;
          selected.push(opt.value);
        } else if (!el.multiple) {
          opt.selected = false;
        }
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return selected;
    })()`);
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void> {
    await this.waitFor({ state: "attached", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    await this.page.evaluate(`(() => { const el = ${expr}; if (el) el.scrollIntoView({ block: 'center' }); })()`);
  }

  async textContent(options?: { timeout?: number }): Promise<string | null> {
    await this.waitFor({ state: "attached", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return this.page.evaluate<string | null>(`(() => { const el = ${expr}; return el ? el.textContent : null; })()`);
  }

  async innerText(options?: { timeout?: number }): Promise<string> {
    await this.waitFor({ state: "visible", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return (await this.page.evaluate<string>(`(() => { const el = ${expr}; return el ? (el.innerText || '') : ''; })()`)) ?? "";
  }

  async innerHTML(options?: { timeout?: number }): Promise<string> {
    await this.waitFor({ state: "attached", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return (await this.page.evaluate<string>(`(() => { const el = ${expr}; return el ? el.innerHTML : ''; })()`)) ?? "";
  }

  async inputValue(options?: { timeout?: number }): Promise<string> {
    await this.waitFor({ state: "attached", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return (await this.page.evaluate<string>(`(() => { const el = ${expr}; return el ? (el.value || '') : ''; })()`)) ?? "";
  }

  async getAttribute(name: string, options?: { timeout?: number }): Promise<string | null> {
    await this.waitFor({ state: "attached", timeout: options?.timeout });
    const expr = this.buildQueryExpression();
    return this.page.evaluate<string | null>(`(() => { const el = ${expr}; return el ? el.getAttribute(${JSON.stringify(name)}) : null; })()`);
  }

  async isVisible(): Promise<boolean> {
    const expr = this.buildQueryExpression();
    return (
      (await this.page.evaluate<boolean>(`(() => {
        const el = ${expr};
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (el.offsetWidth > 0 || el.offsetHeight > 0);
      })()`)) ?? false
    );
  }

  async isHidden(): Promise<boolean> {
    return !(await this.isVisible());
  }

  async isEnabled(): Promise<boolean> {
    const expr = this.buildQueryExpression();
    return (
      (await this.page.evaluate<boolean>(`(() => {
        const el = ${expr};
        return el ? !el.disabled : false;
      })()`)) ?? false
    );
  }

  async isDisabled(): Promise<boolean> {
    return !(await this.isEnabled());
  }

  async isChecked(): Promise<boolean> {
    const expr = this.buildQueryExpression();
    return (
      (await this.page.evaluate<boolean>(`(() => {
        const el = ${expr};
        return el ? !!el.checked : false;
      })()`)) ?? false
    );
  }
}
