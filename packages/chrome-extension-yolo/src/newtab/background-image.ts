// SPDX-License-Identifier: Apache-2.0
/**
 * The user's own background image, stored as a Blob in IndexedDB (it is too
 * large for `chrome.storage.sync`). No image ships with the extension.
 */

const DB_NAME = "yolo-ntp";
const DB_VERSION = 1;
const STORE = "background";
const KEY = "current";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export type ImageError = "type" | "size" | "storage";

export const IMAGE_ERROR_TEXT: Record<ImageError, string> = {
  type: "Choose a PNG, JPEG, WebP, AVIF or GIF image.",
  size: "Choose an image smaller than 8 MB.",
  storage: "The image could not be saved in this browser profile.",
};

/** Checks a file before it is stored. */
export function validateImage(file: {
  readonly type: string;
  readonly size: number;
}): ImageError | undefined {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "type";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "size";
  }
  return undefined;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function saveBackground(
  file: Blob,
): Promise<ImageError | undefined> {
  const invalid = validateImage(file);
  if (invalid) {
    return invalid;
  }
  try {
    await run("readwrite", (store) =>
      store.put({ blob: file, type: file.type, saved: Date.now() }, KEY),
    );
    return undefined;
  } catch {
    return "storage";
  }
}

export async function loadBackground(): Promise<Blob | undefined> {
  if (typeof indexedDB === "undefined") {
    return undefined;
  }
  try {
    const record = (await run("readonly", (store) => store.get(KEY))) as
      { blob?: unknown } | undefined;
    return record?.blob instanceof Blob ? record.blob : undefined;
  } catch {
    return undefined;
  }
}

export async function clearBackground(): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch {
    // Nothing stored.
  }
}
