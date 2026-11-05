// SPDX-License-Identifier: Apache-2.0
/**
 * Entry documents are generated, not hand-written: one root element and the
 * bundled module script. Everything else is created from TSX at runtime.
 */

export interface EntryDocument {
  readonly title: string;
  /** Bundle file name relative to the document. */
  readonly script: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function entryDocument({ title, script }: EntryDocument): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    '<div id="root"></div>',
    `<script type="module" src="${escapeHtml(script)}"></script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
