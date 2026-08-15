/**
 * Zavorth Control request boundary utilities.
 *
 * Provides bounded body parsing, canonical identifier validation, and
 * Accept-Language negotiation for routes under
 * `/api/web/zavorthControl/*`.
 *
 * @module web/zavorthControl/controlRequestSupport
 */

const SUPPORTED_LANGUAGES = new Set(["en", "pt-BR", "es", "fr", "de", "it", "ja", "zh"]);

const FALLBACK_LANGUAGE = "en";

const MAX_BODY_BYTES = 64 * 1024;

const MAX_IDENTIFIER_LENGTH = 160;

const VALID_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/;

export interface BoundedBodyResult<T = unknown> {
  body: T | null;
  error: { status: number; message: string } | null;
}

/**
 * Negotiate the response language for a Control route.
 *
 * Order of precedence:
 *   1. `x-locale` request header (explicit override).
 *   2. Highest-quality `Accept-Language` entry that matches a supported
 *      locale; `q=0` entries are skipped.
 *   3. `FALLBACK_LANGUAGE`.
 */
export function resolveControlLanguage(request: Request): string {
  const explicit = request.headers.get("x-locale")?.trim();
  if (explicit && SUPPORTED_LANGUAGES.has(explicit)) {
    return explicit;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) {
    return FALLBACK_LANGUAGE;
  }

  const candidates = parseAcceptLanguage(acceptLanguage);
  for (const { locale, quality } of candidates) {
    if (quality <= 0) continue;
    if (SUPPORTED_LANGUAGES.has(locale)) {
      return locale;
    }
  }

  return FALLBACK_LANGUAGE;
}

/**
 * Build a control-channel message string. The current implementation
 * returns a deterministic, English-only message string for any key —
 * the surface is here so the chat route can layer i18n on later
 * without changing call sites.
 */
export function controlMessage(_request: Request, key: string): string {
  return `${key} is required`;
}

interface AcceptLanguageEntry {
  locale: string;
  quality: number;
}

function parseAcceptLanguage(headerValue: string): AcceptLanguageEntry[] {
  return headerValue
    .split(",")
    .map((segment) => {
      const parts = segment.trim().split(";");
      const locale = parts[0]?.trim() ?? "";
      let quality = 1;
      for (const parameter of parts.slice(1)) {
        const match = parameter.trim().match(/^q\s*=\s*([0-9.]+)$/);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (!Number.isNaN(parsed)) {
            quality = parsed;
          }
        }
      }
      return { locale, quality };
    })
    .filter((entry) => entry.locale.length > 0)
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Read the request body as a bounded JSON object.
 *
 * Rejects arrays, declared content-length above the cap, and bodies
 * whose measured byte size exceeds the cap. Returns `{ body, error }`
 * so the caller can branch on either field without throwing.
 */
export async function readBoundedControlBody<T = unknown>(
  request: Request,
): Promise<BoundedBodyResult<T>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsed = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsed) && parsed > MAX_BODY_BYTES) {
      return {
        body: null,
        error: { status: 413, message: `Request body exceeds ${MAX_BODY_BYTES} bytes` },
      };
    }
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return {
      body: null,
      error: { status: 413, message: `Request body exceeds ${MAX_BODY_BYTES} bytes` },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      body: null,
      error: { status: 400, message: "Request body is not valid JSON" },
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      body: null,
      error: { status: 400, message: "Request body must be a JSON object" },
    };
  }

  return { body: parsed as T, error: null };
}

/**
 * Validate a caller-supplied identifier string.
 *
 * Accepts canonical `segment(:segment)*` shapes and rejects anything
 * that smells like a path traversal (`../`), contains control characters
 * (newlines, tabs, null bytes), or exceeds the length cap.
 *
 * Returns the original value when valid, `null` otherwise.
 */
export function readControlIdentifier(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    return null;
  }
  if (!VALID_IDENTIFIER_PATTERN.test(value)) {
    return null;
  }
  return value;
}
