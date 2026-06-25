import { ZAVORTH_LEGACY_TRANSPORT_COMPAT } from "./compat/legacyTransportCompat";

export const ZAVORTH_COMPATIBLE_API_SURFACE = {
  sessionHeaders: {
    canonical: "X-Zavorth-Session-Id",
    legacy: ZAVORTH_LEGACY_TRANSPORT_COMPAT.sessionHeaders.legacy,
  },
  cacheBypassHeaders: {
    canonical: "X-Zavorth-No-Cache",
    legacy: ZAVORTH_LEGACY_TRANSPORT_COMPAT.cacheBypassHeaders.legacy,
  },
  requestFlags: {
    skipContextRelay: "_zavorthSkipContextRelay",
    legacySkipContextRelay: ZAVORTH_LEGACY_TRANSPORT_COMPAT.requestFlags.legacySkipContextRelay,
    internalRequest: "_zavorthInternalRequest",
    legacyInternalRequest: ZAVORTH_LEGACY_TRANSPORT_COMPAT.requestFlags.legacyInternalRequest,
  },
  internalRequestValues: {
    contextHandoff: "context-handoff",
  },
} as const;

function readBodyFlag(body: unknown, key: string): unknown {
  if (!body || typeof body !== "object") return undefined;
  return (body as Record<string, unknown>)[key];
}

function readHeaderValue(
  headers: { get?: (name: string) => string | null } | Record<string, unknown> | null | undefined,
  name: string
): string | null {
  if (!headers) return null;

  if (typeof headers.get === "function") {
    return headers.get(name);
  }

  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== needle) continue;
    return typeof value === "string" ? value : null;
  }

  return null;
}

function isTruthyHeaderValue(value: string | null): boolean {
  return (value || "").toLowerCase() === "true";
}

export function isZavorthContextRelaySkipped(body: unknown): boolean {
  const flags = ZAVORTH_COMPATIBLE_API_SURFACE.requestFlags;
  return (
    readBodyFlag(body, flags.skipContextRelay) === true ||
    readBodyFlag(body, flags.legacySkipContextRelay) === true
  );
}

export function isZavorthInternalContextHandoffRequest(body: unknown): boolean {
  const flags = ZAVORTH_COMPATIBLE_API_SURFACE.requestFlags;
  const value = ZAVORTH_COMPATIBLE_API_SURFACE.internalRequestValues.contextHandoff;
  return (
    readBodyFlag(body, flags.internalRequest) === value ||
    readBodyFlag(body, flags.legacyInternalRequest) === value
  );
}

export function isZavorthCacheBypassRequested(
  headers: { get?: (name: string) => string | null } | Record<string, unknown> | null | undefined
): boolean {
  const cacheHeaders = ZAVORTH_COMPATIBLE_API_SURFACE.cacheBypassHeaders;
  return (
    isTruthyHeaderValue(readHeaderValue(headers, cacheHeaders.canonical)) ||
    isTruthyHeaderValue(readHeaderValue(headers, cacheHeaders.legacy))
  );
}

function applySessionHeaders(headers: Headers, sessionId: string): void {
  headers.set(ZAVORTH_COMPATIBLE_API_SURFACE.sessionHeaders.canonical, sessionId);
  headers.set(ZAVORTH_COMPATIBLE_API_SURFACE.sessionHeaders.legacy, sessionId);
}

export function withZavorthSessionHeader(response: Response, sessionId: string | null): Response {
  if (!response || !sessionId) return response;

  try {
    applySessionHeaders(response.headers, sessionId);
    return response;
  } catch {
    const cloned = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    applySessionHeaders(cloned.headers, sessionId);
    return cloned;
  }
}

export function getZavorthNoCacheHeaders(): Record<string, string> {
  const headers = ZAVORTH_COMPATIBLE_API_SURFACE.cacheBypassHeaders;
  return {
    [headers.canonical]: "true",
    [headers.legacy]: "true",
  };
}
