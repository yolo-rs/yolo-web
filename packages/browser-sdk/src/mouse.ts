/**
 * Mouse Input Controller.
 * Provides coordinate dispatching, multi-click, drag, wheel scrolling,
 * and human-like Bezier curve movement simulation.
 */

import type { YoloCdpClient } from "@yolo-web/cdp-client";
import { generateHumanMouseTrajectory } from "./stealth";

export interface MouseMoveOptions {
  steps?: number;
  humanLike?: boolean;
}

export interface MouseClickOptions {
  button?: "left" | "right" | "middle";
  clickCount?: number;
  delay?: number;
}

export class Mouse {
  private readonly cdp: YoloCdpClient;
  private currentX = 0;
  private currentY = 0;
  private pressedButtons = 0;

  constructor(cdp: YoloCdpClient) {
    this.cdp = cdp;
  }

  get position(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  async move(x: number, y: number, options: MouseMoveOptions = {}): Promise<void> {
    if (options.humanLike) {
      const trajectory = generateHumanMouseTrajectory(
        this.currentX,
        this.currentY,
        x,
        y,
        { steps: options.steps ?? 15, durationMs: 120 }
      );
      for (const pt of trajectory) {
        await this.cdp.dispatchMouseEvent({
          type: "mouseMoved",
          x: pt.x,
          y: pt.y,
        });
      }
    } else if (options.steps && options.steps > 1) {
      const fromX = this.currentX;
      const fromY = this.currentY;
      for (let i = 1; i <= options.steps; i++) {
        const stepX = fromX + ((x - fromX) * i) / options.steps;
        const stepY = fromY + ((y - fromY) * i) / options.steps;
        await this.cdp.dispatchMouseEvent({
          type: "mouseMoved",
          x: stepX,
          y: stepY,
        });
      }
    } else {
      await this.cdp.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
      });
    }

    this.currentX = x;
    this.currentY = y;
  }

  async down(options: { button?: "left" | "right" | "middle"; clickCount?: number } = {}): Promise<void> {
    const button = options.button ?? "left";
    this.pressedButtons = button === "left" ? 1 : button === "right" ? 2 : 4;

    await this.cdp.dispatchMouseEvent({
      type: "mousePressed",
      x: this.currentX,
      y: this.currentY,
      button,
      clickCount: options.clickCount ?? 1,
    });
  }

  async up(options: { button?: "left" | "right" | "middle"; clickCount?: number } = {}): Promise<void> {
    const button = options.button ?? "left";
    this.pressedButtons = 0;

    await this.cdp.dispatchMouseEvent({
      type: "mouseReleased",
      x: this.currentX,
      y: this.currentY,
      button,
      clickCount: options.clickCount ?? 1,
    });
  }

  async click(x: number, y: number, options: MouseClickOptions = {}): Promise<void> {
    await this.move(x, y);
    const count = options.clickCount ?? 1;
    for (let i = 1; i <= count; i++) {
      await this.down({ button: options.button, clickCount: i });
      if (options.delay) {
        await new Promise((r) => setTimeout(r, options.delay));
      }
      await this.up({ button: options.button, clickCount: i });
    }
  }

  async dblclick(x: number, y: number, options: Omit<MouseClickOptions, "clickCount"> = {}): Promise<void> {
    await this.click(x, y, { ...options, clickCount: 2 });
  }

  async wheel(deltaX: number, deltaY: number): Promise<void> {
    await this.cdp.dispatchMouseEvent({
      type: "mouseWheel",
      x: this.currentX,
      y: this.currentY,
      deltaX,
      deltaY,
    });
  }
}
