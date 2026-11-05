// SPDX-License-Identifier: Apache-2.0
/**
 * MAIN-world WebMCP provider. When the browser has no native `ModelContext`,
 * installs a polyfill that follows the WICG/W3C WebMCP draft (2 Nov 2026
 * editor draft): `document.modelContext` with registerTool (unregistration by
 * AbortSignal), getTools and executeTool, plus `navigator.modelContext` as the
 * deprecated alias that earlier Chrome builds exposed. When a native
 * implementation exists this script does nothing, so pages and the browser
 * agent talk directly.
 *
 * No powerful tool is registered into the page: a page can call any tool that
 * is registered in its own context, so the agent never exposes browser control
 * here.
 */
(() => {
  type Tool = {
    name: string;
    title?: string;
    description: string;
    inputSchema?: object;
    outputSchema?: object;
    annotations?: Record<string, boolean>;
    execute: (
      input: object,
      options: { signal: AbortSignal },
    ) => Promise<unknown> | unknown;
  };

  const doc = document as Document & { modelContext?: unknown };
  const nav = navigator as Navigator & { modelContext?: unknown };
  if (doc.modelContext !== undefined) return; // native implementation present

  class YoloModelContext extends EventTarget {
    #tools = new Map<string, Tool>();
    ontoolchange: ((event: Event) => void) | null = null;

    async registerTool(
      tool: Tool,
      options: { signal?: AbortSignal; exposedTo?: string[] } = {},
    ): Promise<undefined> {
      if (!tool || typeof tool.name !== "string" || !tool.name) {
        throw new TypeError("registerTool: name is required");
      }
      if (typeof tool.description !== "string" || !tool.description) {
        throw new TypeError("registerTool: description is required");
      }
      if (typeof tool.execute !== "function") {
        throw new TypeError("registerTool: execute must be a function");
      }
      if (this.#tools.has(tool.name)) {
        throw new DOMException(
          `tool "${tool.name}" is already registered`,
          "InvalidStateError",
        );
      }
      const registered = { ...tool };
      this.#tools.set(tool.name, registered);
      const { signal } = options;
      if (signal) {
        const remove = () => {
          if (this.#tools.get(tool.name) === registered) {
            this.#tools.delete(tool.name);
            this.#changed();
          }
        };
        if (signal.aborted) remove();
        else signal.addEventListener("abort", remove, { once: true });
      }
      this.#changed();
      return undefined;
    }

    async getTools(): Promise<Omit<Tool, "execute">[]> {
      return [...this.#tools.values()].map(
        ({ execute: _execute, ...rest }) => rest,
      );
    }

    async executeTool(
      tool: { name: string },
      input: object = {},
      options: { signal?: AbortSignal } = {},
    ): Promise<string> {
      const target = this.#tools.get(tool.name);
      if (!target)
        throw new DOMException(`no tool named "${tool.name}"`, "NotFoundError");
      const controller = new AbortController();
      options.signal?.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
      const result = await target.execute(input, { signal: controller.signal });
      return typeof result === "string"
        ? result
        : JSON.stringify(result ?? null);
    }

    #changed(): void {
      const event = new Event("toolchange");
      this.dispatchEvent(event);
      this.ontoolchange?.(event);
      document.dispatchEvent(
        new CustomEvent("yolo:webmcp:toolchange", {
          detail: { count: this.#tools.size },
        }),
      );
    }
  }

  const context = new YoloModelContext();
  Object.defineProperty(Document.prototype, "modelContext", {
    configurable: true,
    enumerable: true,
    get: () => context,
  });
  if (nav.modelContext === undefined) {
    Object.defineProperty(Navigator.prototype, "modelContext", {
      configurable: true,
      enumerable: true,
      get: () => context,
    });
  }
})();
