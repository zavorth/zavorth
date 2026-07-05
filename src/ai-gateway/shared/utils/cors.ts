import { logger } from '@/shared/utils/logger';
/**
 * Shared CORS configuration for all API routes.
 *
 * Centralizes the Access-Control-Allow-Origin header so it can be
 * configured via the CORS_ORIGIN environment variable instead of
 * being hardcoded as "*" in every route handler.
 *
 * Usage:
 *   import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
 *
 *   // In route responses:
 *   return new Response(body, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
 *
 *   // For OPTIONS preflight:
 *   export function OPTIONS() { return handleCorsOptions(); }
 */

const CONFIGURED_CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  process.env.ZAVORTH_PUBLIC_BASE_URL ||
  "";

export function normalizeCorsOrigin(value: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "*") {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.origin;
  } catch (error) { logger.warn('[cors] network request failed', error); return ''; }
}

export const CORS_ORIGIN = normalizeCorsOrigin(CONFIGURED_CORS_ORIGIN);

/**
 * Standard CORS headers to spread into any Response.
 * @type {Record<string, string>}
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version",
};

if (CORS_ORIGIN) {
  CORS_HEADERS["Access-Control-Allow-Origin"] = CORS_ORIGIN;
  CORS_HEADERS.Vary = "Origin";
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * @returns {Response} 204 No Content with CORS headers
 */
export function handleCorsOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
