// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * One toast at a time, announced politely. It stays for ten seconds, and the
 * timer pauses while the pointer or focus is on it (WCAG 2.2.1), so the undo
 * action never disappears under someone reaching for it.
 */
import { h } from "../../dom.ts";
import { Icon } from "./icons.tsx";

const SHOW_MS = 10_000;

export interface Toaster {
  readonly node: Node;
  show(message: string, action?: { label: string; run: () => void }): void;
  hide(): void;
}

export function Toaster(): Toaster {
  let region!: HTMLElement;
  let timer: number | undefined;
  let remaining = SHOW_MS;
  let started = 0;

  const stop = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
      remaining -= Date.now() - started;
    }
  };
  const start = (): void => {
    stop();
    started = Date.now();
    timer = window.setTimeout(hide, Math.max(1000, remaining));
  };
  const hide = (): void => {
    stop();
    region.replaceChildren();
  };

  const show: Toaster["show"] = (message, action) => {
    remaining = SHOW_MS;
    const toast = (
      <div
        class="yw-toast"
        onMouseenter={stop}
        onFocus={stop}
        ref={(element) => {
          element.addEventListener("mouseleave", start);
          element.addEventListener("focusout", (event) => {
            if (!element.contains(event.relatedTarget as Node | null)) {
              start();
            }
          });
        }}
      >
        <span>{message}</span>
        {action ? (
          <button
            type="button"
            class="yw-button"
            onClick={() => {
              hide();
              action.run();
            }}
          >
            {action.label}
          </button>
        ) : null}
        <button
          type="button"
          class="yw-icon-button"
          aria-label="Dismiss"
          onClick={hide}
        >
          <Icon name="close" />
        </button>
      </div>
    );
    region.replaceChildren(toast);
    start();
  };

  const node = (
    <div
      role="status"
      aria-live="polite"
      ref={(element) => (region = element)}
    />
  );
  return { node, show, hide };
}
