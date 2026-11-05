// SPDX-License-Identifier: Apache-2.0
/** CDP transport and target backend over chrome.debugger (one attached tab per transport). */
import { type TargetBackend, type TargetInfo } from "../src/browser.ts";
import { BaseTransport, type CdpParams, type CdpResult } from "../src/cdp.ts";
import { PageSession } from "../src/page.ts";

export class DebuggerTransport extends BaseTransport {
  private readonly onEvent = (
    source: { tabId?: number },
    method: string,
    params: CdpResult,
  ) => {
    if (source.tabId === this.tabId) this.emit(method, params ?? {}, undefined);
  };

  private constructor(readonly tabId: number) {
    super();
    chrome.debugger.onEvent.addListener(this.onEvent);
  }

  static async attach(tabId: number): Promise<DebuggerTransport> {
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
    } catch (error) {
      // Already attached by this extension is fine; DevTools or another debugger is not.
      if (!String(error).includes("Another debugger is already attached"))
        throw error;
      throw new Error(
        `cannot attach to tab ${tabId}: another debugger (DevTools?) is attached`,
      );
    }
    return new DebuggerTransport(tabId);
  }

  send(method: string, params: CdpParams = {}): Promise<CdpResult> {
    return chrome.debugger.sendCommand({ tabId: this.tabId }, method, params);
  }

  close(): void {
    chrome.debugger.onEvent.removeListener(this.onEvent);
    void chrome.debugger.detach({ tabId: this.tabId }).catch(() => undefined);
  }
}

/** Tabs are the targets; chrome.debugger does not expose the Target domain. */
export class ExtensionTargetBackend implements TargetBackend {
  private readonly transports = new Map<number, DebuggerTransport>();

  async list(): Promise<TargetInfo[]> {
    const tabs = (await chrome.tabs.query({})) as {
      id?: number;
      title?: string;
      url?: string;
    }[];
    return tabs
      .filter(
        (t) => t.id !== undefined && /^(https?|file|about):/.test(t.url ?? ""),
      )
      .map((t) => ({
        id: String(t.id),
        title: t.title ?? "",
        url: t.url ?? "",
      }));
  }

  async attach(id: string): Promise<PageSession> {
    const tabId = Number(id);
    let transport = this.transports.get(tabId);
    if (!transport) {
      transport = await DebuggerTransport.attach(tabId);
      this.transports.set(tabId, transport);
    }
    const page = new PageSession(transport, id, undefined);
    await page.init();
    return page;
  }

  async create(url: string): Promise<string> {
    const tab = await chrome.tabs.create({ url });
    return String(tab.id);
  }

  async activate(id: string): Promise<void> {
    await chrome.tabs.update(Number(id), { active: true });
  }

  async close(id: string): Promise<void> {
    this.transports.get(Number(id))?.close();
    this.transports.delete(Number(id));
    await chrome.tabs.remove(Number(id));
  }

  detachAll(): void {
    for (const transport of this.transports.values()) transport.close();
    this.transports.clear();
  }
}
