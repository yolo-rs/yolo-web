/**
 * Keyboard Input Controller.
 * Provides virtual key dispatching, modifier management, chords, and realistic typing latency.
 */

import type { YoloCdpClient } from "@yolo-web/cdp-client";

const KEY_DEFINITIONS: Record<string, { key: string; code: string; keyCode: number; text?: string }> = {
  Enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
  Delete: { key: "Delete", code: "Delete", keyCode: 46 },
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  Home: { key: "Home", code: "Home", keyCode: 36 },
  End: { key: "End", code: "End", keyCode: 35 },
  PageUp: { key: "PageUp", code: "PageUp", keyCode: 33 },
  PageDown: { key: "PageDown", code: "PageDown", keyCode: 34 },
  Shift: { key: "Shift", code: "ShiftLeft", keyCode: 16 },
  Control: { key: "Control", code: "ControlLeft", keyCode: 17 },
  Alt: { key: "Alt", code: "AltLeft", keyCode: 18 },
  Meta: { key: "Meta", code: "MetaLeft", keyCode: 91 },
};

export class Keyboard {
  private readonly cdp: YoloCdpClient;
  private modifiers = 0; // 1 = Alt, 2 = Control, 4 = Meta, 8 = Shift

  constructor(cdp: YoloCdpClient) {
    this.cdp = cdp;
  }

  async down(key: string): Promise<void> {
    const def = this.resolveKey(key);
    this.updateModifiers(key, true);

    await this.cdp.dispatchKeyEvent({
      type: def.text ? "keyDown" : "rawKeyDown",
      key: def.key,
      code: def.code,
      windowsVirtualKeyCode: def.keyCode,
      text: def.text,
    });
  }

  async up(key: string): Promise<void> {
    const def = this.resolveKey(key);
    this.updateModifiers(key, false);

    await this.cdp.dispatchKeyEvent({
      type: "keyUp",
      key: def.key,
      code: def.code,
      windowsVirtualKeyCode: def.keyCode,
    });
  }

  async press(key: string, options: { delay?: number } = {}): Promise<void> {
    await this.down(key);
    if (options.delay) {
      await new Promise((r) => setTimeout(r, options.delay));
    }
    await this.up(key);
  }

  async insertText(text: string): Promise<void> {
    await this.cdp.send("Input.insertText", { text });
  }

  async type(text: string, options: { delay?: number } = {}): Promise<void> {
    const delay = options.delay ?? 15;
    for (const char of text) {
      await this.press(char, { delay: Math.max(5, delay) });
      if (delay > 0) {
        // Humanized variance (+/- 40%)
        const jitter = (Math.random() - 0.5) * delay * 0.4;
        await new Promise((r) => setTimeout(r, Math.max(2, delay + jitter)));
      }
    }
  }

  private resolveKey(key: string): { key: string; code: string; keyCode: number; text?: string } {
    if (KEY_DEFINITIONS[key]) return KEY_DEFINITIONS[key];
    const upper = key.toUpperCase();
    if (KEY_DEFINITIONS[upper]) return KEY_DEFINITIONS[upper];

    if (key.length === 1) {
      const code = /[a-zA-Z]/.test(key) ? `Key${key.toUpperCase()}` : /[0-9]/.test(key) ? `Digit${key}` : "Unidentified";
      return {
        key,
        code,
        keyCode: key.charCodeAt(0),
        text: key,
      };
    }

    return {
      key,
      code: key,
      keyCode: 0,
    };
  }

  private updateModifiers(key: string, isDown: boolean): void {
    const k = key.toLowerCase();
    let mask = 0;
    if (k === "alt") mask = 1;
    else if (k === "control" || k === "ctrl") mask = 2;
    else if (k === "meta" || k === "command" || k === "cmd") mask = 4;
    else if (k === "shift") mask = 8;

    if (mask !== 0) {
      if (isDown) this.modifiers |= mask;
      else this.modifiers &= ~mask;
    }
  }
}
