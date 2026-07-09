import { asErrorLike } from '../../../utils/errorLike';
/**
 * API Authentication Guard — Shared utility for protecting management API routes.
 *
 * Provides dual-mode auth: JWT cookie (zavorthControl session) or Bearer API key.
 * Used by the middleware (proxy.ts) to guard /api/* management routes.
 *
 * @module shared/utils/apiAuth
 */

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/localDb";
import { logger } from '@/shared/utils/logger';

// ──────────────── Public Routes (No Auth Required) ────────────────

/**
 * Routes that are ALWAYS accessible without authentication.
 * Exact routes are separate from intentional prefixes so a single public
 * endpoint cannot accidentally expose an entire management namespace.
 */
const PUBLIC_API_EXACT_ROUTES = new Set([
  // Auth flow — must be accessible to unauthenticated users
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/status",

  // Settings check — used by login page / onboarding
  "/api/settings/require-login",

  // Init — first-run setup
  "/api/init",

  // Health monitoring — probes must work without auth
  "/api/monitoring/health",
]);

const PUBLIC_API_PREFIX_ROUTES = [

  // Local experience surface — route handlers still gate non-local requests.
  "/api/experience/",

  // LLM proxy routes — use their own API key auth in the SSE layer
  "/api/v1/",

  // Cloud routes — use Bearer API key auth internally
  "/api/cloud/",
];

// ──────────────── Auth Verification ────────────────

/**
 * Check if a request is authenticated via JWT cookie or Bearer API key.
 *
 * @returns null if authenticated, error message string if not
 */
export async function verifyAuth(request: any): Promise<string | null> {
  // 1. Check JWT cookie (zavorthControl session)
  const token = request.cookies.get("auth_token")?.value;
  if (token && process.env.JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token, secret);
      return null; // ✔ Authenticated via cookie
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // Invalid/expired token — fall through to API key check
      logger.warn('[api Auth] encoding failed', error);
    }
  }

  // 2. Check Bearer API key
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    try {
      // Dynamic import to avoid circular dependencies during build
      const { validateApiKey } = await import("@/lib/db/apiKeys");
      const isValid = await validateApiKey(apiKey);
      if (isValid) return null; // ✔ Authenticated via API key
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // DB not ready or import error — deny access
      logger.warn('[api Auth] lifecycle operation failed', error);
    }
  }

  return "Authentication required";
}

/**
 * Check if a request is authenticated — boolean convenience wrapper for route handlers.
 *
 * Uses `cookies()` from next/headers (App Router compatible) and Bearer API key.
 * Returns true if authenticated, false otherwise.
 *
 * Unlike `verifyAuth`, this does NOT check `isAuthRequired()` — callers that
 * need to conditionally skip auth should check that separately.
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  // If settings say login/auth is disabled, treat all requests as authenticated
  if (!(await isAuthRequired())) {
    if (isLoopbackRequest(request)) {
      return true;
    }
    return isStrictlyAuthenticated(request);
  }
  return isStrictlyAuthenticated(request);
}

/**
 * Check request credentials without honoring the local "requireLogin=false" bypass.
 *
 * Sensitive routes such as full database export, audit logs, active sessions,
 * tunnels, restarts, and secret-bearing admin surfaces should use this helper
 * through requireStrictManagementAuth().
 */
export async function isStrictlyAuthenticated(request: Request): Promise<boolean> {
  // 1. Check API key (for external clients)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    try {
      const { validateApiKey } = await import("@/lib/db/apiKeys");
      if (await validateApiKey(apiKey)) return true;
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // DB not ready or import error
      logger.warn('[api Auth] lifecycle operation failed', error);
    }
  }

  // 2. Check JWT cookie (for zavorthControl session)
  if (process.env.JWT_SECRET) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth_token")?.value;
      if (token) {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        await jwtVerify(token, secret);
        return true;
      }
    } catch (error: unknown) { const err = asErrorLike(error); const e = err;
      // Invalid/expired token or cookies not available
      logger.warn('[api Auth] encoding failed', error);
    }
  }

  return false;
}

/**
 * Check if a route is in the public (no-auth) allowlist.
 */
export function isPublicRoute(pathname: string): boolean {
  const normalizedPathname =
    pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return (
    PUBLIC_API_EXACT_ROUTES.has(normalizedPathname) ||
    PUBLIC_API_PREFIX_ROUTES.some((route) => pathname.startsWith(route))
  );
}

function normalizeRequestHostname(value: string | null | undefined): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("::ffff:")) {
    return raw.slice("::ffff:".length);
  }

  try {
    return new URL(raw.includes("://") ? raw : `http://${raw}`)
      .hostname.toLowerCase()
      .replace(/^\[/, "")
      .replace(/\]$/, "");
  } catch (error: unknown) { const err = asErrorLike(error); const e = err;
    logger.warn('[api Auth] network request failed', error);
    return raw.replace(/^\[/, "").replace(/\]$/, "").split(":")[0] || "";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizeRequestHostname(hostname)
    .replace(/^::ffff:/, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1"
  );
}

function getHeader(request: Request, name: string): string {
  return String(request.headers?.get?.(name) || "").trim();
}

/**
 * Returns true only when the request appears to be local loopback.
 * This keeps first-run/no-login convenience local while preventing accidental
 * LAN/tunnel exposure from inheriting the same no-auth posture.
 */
export function isLoopbackRequest(request: Request): boolean {
  const hostCandidates = [
    (() => {
      try {
        return new URL(request.url).hostname;
      } catch (error: unknown) { const err = asErrorLike(error); const e = err; logger.warn('[api Auth] operation failed', error); return ''; }
    })(),
    getHeader(request, "host"),
    getHeader(request, "x-forwarded-host"),
  ]
    .flatMap((value) => String(value || "").split(",").map((entry) => entry.trim()))
    .filter(Boolean);

  if (hostCandidates.length === 0 || !hostCandidates.every((host) => isLoopbackHostname(host))) {
    return false;
  }

  const forwardedIpCandidates = [
    ...getHeader(request, "x-forwarded-for").split(",").map((entry) => entry.trim()).filter(Boolean),
    getHeader(request, "x-real-ip"),
    getHeader(request, "cf-connecting-ip"),
  ].filter(Boolean);

  return forwardedIpCandidates.every((ip) => isLoopbackHostname(ip));
}

/**
 * Check if authentication is required based on settings.
 * If requireLogin is false AND no password is set, auth is skipped.
 */
export async function isAuthRequired(): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (settings.requireLogin === false) return false;
    // Allow access with no password set — there's nothing to authenticate against.
    // This covers two cases:
    //   1. Fresh installs (setupComplete=false) — first-run, no password yet
    //   2. setupComplete=true but password was skipped during onboarding (#256)
    //      The user needs unauthenticated access to /zavorthControl/settings to set a password.
    // Note: this is safe because Bearer API key auth is still checked in verifyAuth().
    // The security concern from #151 (password row lost after being set) is handled by the
    // hasPassword flag — if a password WAS set and then somehow lost, the user can use the
    // reset-password CLI tool (bin/reset-password.mjs).
    if (!settings.password && !process.env.INITIAL_PASSWORD) return false;
    return true;
  } catch (error: unknown) { const err = asErrorLike(error); const e = err;
    // On error, require auth (secure by default)
    // Log the error so failures (e.g., SQLITE_BUSY) aren't silent 401s
    console.error(
      "[API_AUTH_GUARD] isAuthRequired failed, defaulting to true:",
      error?.message || error
    );
    return true;
  }
}
