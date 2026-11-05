export const WEB_STANDARD_SCHEMAS = {
  webassembly: new URL(
    "../../../data/standards/web/webassembly/webassembly.schema.json",
    import.meta.url,
  ),
  mdn: new URL(
    "../../../data/standards/web/mdn/mdn-compat.schema.json",
    import.meta.url,
  ),
  tc39: new URL(
    "../../../data/standards/web/tc39/tc39.schema.json",
    import.meta.url,
  ),
  mcp: new URL(
    "../../../data/standards/web/mcp/mcp-2026.schema.json",
    import.meta.url,
  ),
} as const;

export type WebStandardFamily = keyof typeof WEB_STANDARD_SCHEMAS;
