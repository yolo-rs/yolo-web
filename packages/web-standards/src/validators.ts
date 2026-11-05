import type {
  BrowserSupport,
  MCPSchema2026,
  MDNCompatSchema,
  TC39ProposalsSchema,
  WebAssemblySchema,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isVersionState(value: unknown): boolean {
  return (
    value === null || typeof value === "string" || typeof value === "boolean"
  );
}

export function validateWebAssembly(data: unknown): data is WebAssemblySchema {
  if (!isRecord(data)) return false;
  return (
    typeof data.version === "string" &&
    typeof data.coreSpecUrl === "string" &&
    typeof data.componentModelSpecUrl === "string" &&
    isStringArray(data.valTypes) &&
    isStringArray(data.componentTypes) &&
    Array.isArray(data.sections) &&
    data.sections.every(
      (section) =>
        isRecord(section) &&
        Number.isInteger(section.id) &&
        typeof section.name === "string" &&
        typeof section.description === "string",
    ) &&
    (data.canonicalAbis === undefined || isStringArray(data.canonicalAbis))
  );
}

export function validateMDNCompat(data: unknown): data is MDNCompatSchema {
  if (
    !isRecord(data) ||
    typeof data.feature !== "string" ||
    !isRecord(data.support)
  )
    return false;
  return Object.values(data.support).every((entry) => {
    if (!isRecord(entry)) return false;
    const support = entry as BrowserSupport;
    return (
      (support.version_added === undefined ||
        isVersionState(support.version_added)) &&
      (support.version_removed === undefined ||
        isVersionState(support.version_removed)) &&
      (support.prefix === undefined || typeof support.prefix === "string") &&
      (support.notes === undefined ||
        typeof support.notes === "string" ||
        isStringArray(support.notes))
    );
  });
}

export function validateTC39(data: unknown): data is TC39ProposalsSchema {
  if (!isRecord(data) || !Array.isArray(data.proposals)) return false;
  return data.proposals.every(
    (proposal) =>
      isRecord(proposal) &&
      typeof proposal.name === "string" &&
      typeof proposal.stage === "number" &&
      Number.isInteger(proposal.stage) &&
      proposal.stage >= 0 &&
      proposal.stage <= 4 &&
      isStringArray(proposal.champions) &&
      typeof proposal.url === "string" &&
      (proposal.tags === undefined || isStringArray(proposal.tags)) &&
      (proposal.notes === undefined || typeof proposal.notes === "string"),
  );
}

export function validateMCP2026(data: unknown): data is MCPSchema2026 {
  if (
    !isRecord(data) ||
    typeof data.version !== "string" ||
    typeof data.protocolVersion !== "string" ||
    !Array.isArray(data.transports) ||
    !data.transports.every((transport) =>
      ["stdio", "sse", "websocket", "memory"].includes(String(transport)),
    ) ||
    !isRecord(data.capabilities) ||
    !isRecord(data.capabilities.server) ||
    !isRecord(data.capabilities.client) ||
    !Array.isArray(data.methods)
  )
    return false;

  return data.methods.every(
    (method) =>
      isRecord(method) &&
      typeof method.name === "string" &&
      (method.kind === "request" || method.kind === "notification") &&
      (method.paramsSchema === undefined || isRecord(method.paramsSchema)) &&
      (method.resultSchema === undefined || isRecord(method.resultSchema)),
  );
}
