// SPDX-License-Identifier: Apache-2.0
/**
 * Ambient typings for the subset of the Chrome extensions API used by this
 * package (Manifest V3, promise-returning forms). Reference:
 * https://developer.chrome.com/docs/extensions/reference/api
 */
declare namespace chrome {
  namespace storage {
    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }

    interface StorageArea {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    }

    type ChangeListener = (
      changes: Record<string, StorageChange>,
      areaName: "sync" | "local" | "session" | "managed",
    ) => void;

    const sync: StorageArea;
    const local: StorageArea;
    const onChanged: {
      addListener(listener: ChangeListener): void;
      removeListener(listener: ChangeListener): void;
    };
  }

  namespace runtime {
    type OnInstalledReason =
      | "install"
      | "update"
      | "chrome_update"
      | "shared_module_update";

    interface InstalledDetails {
      reason: OnInstalledReason;
      previousVersion?: string;
      id?: string;
    }

    const onInstalled: {
      addListener(listener: (details: InstalledDetails) => void): void;
    };

    function getURL(path: string): string;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      active: boolean;
      url?: string;
      title?: string;
    }

    interface CreateProperties {
      url?: string;
      active?: boolean;
      windowId?: number;
    }

    interface UpdateProperties {
      url?: string;
      active?: boolean;
    }

    function create(properties: CreateProperties): Promise<Tab>;
    function update(properties: UpdateProperties): Promise<Tab | undefined>;
  }
}
