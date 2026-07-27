import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { loginSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import {
  checkRateLimit,
  resetRateLimit,
  extractClientIp,
  applyRateLimitHeaders,
} from "@/lib/rateLimiter";// SECURITY: No hardcoded fallback — JWT_SECRET must be configured.
if (!process.env.JWT_SECRET) {
  console.error("[SECURITY] FATAL: JWT_SECRET is not set. Login authentication is disabled.");
}
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "");

const RATE_LIMIT_NAMESPACE = "auth:login";
const AUTH_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function authJson(body: unknown, init: ResponseInit = {}) {
  const initHeaders =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init.headers as Record<string, string> | undefined);
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...AUTH_NO_STORE_HEADERS,
      ...initHeaders,
    },
  });
}

function shouldUseSecureCookie(request: any): boolean {
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const forwardedProtoHeader = request.headers.get("x-forwarded-proto") || "";
  const forwardedProto = forwardedProtoHeader.split(",")[0].trim().toLowerCase();
  const isHttpsRequest = forwardedProto === "https" || request.nextUrl?.protocol === "https:";
  return forceSecureCookie || isHttpsRequest;
}

function safePasswordEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(candidateBuffer, candidateBuffer);
    return false;
  }
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export async function POST(request) {
  try {
    // ── Rate Limiting ──────────────────────────────────────────
    const clientIp = extractClientIp(request);
    const rateLimitResult = checkRateLimit(RATE_LIMIT_NAMESPACE, clientIp);

    if (!rateLimitResult.allowed) {
      console.warn(
        `[AUTH] Rate limit hit for ${clientIp} — blocked for ${rateLimitResult.retryAfterSeconds}s`
      );
      const response = authJson(
        {
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        { status: 429 }
      );
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }
    // ────────────────────────────────────────────────────────────────────

    // Fail-fast if JWT_SECRET is not configured
    if (!process.env.JWT_SECRET) {
      return authJson(
        { error: "Server misconfigured: JWT_SECRET not set. Contact administrator." },
        { status: 500 }
      );
    }

    const rawBody = await request.json();

    // Zod validation
    const validation = validateBody(loginSchema, rawBody);
    if (isValidationFailure(validation)) {
      return authJson({ error: validation.error }, { status: 400 });
    }
    const password = typeof validation.data.password === "string" ? validation.data.password : "";
    if (!password) {
      return authJson({ error: "Invalid password payload" }, { status: 400 });
    }
    const settings = await getSettings();

    const storedHash = typeof settings.password === "string" ? settings.password : "";

    let isValid = false;
    if (storedHash) {
      isValid = await bcrypt.compare(password, storedHash);
    } else {
      // SECURITY: No default password — must be set via env or onboarding
      if (!process.env.INITIAL_PASSWORD) {
        return authJson(
          { error: "No password configured. Complete onboarding first.", needsSetup: true },
          { status: 403 }
        );
      }
      const initialPassword = process.env.INITIAL_PASSWORD;
      isValid = safePasswordEquals(password, initialPassword);
    }

    if (isValid) {
      // ── Reset rate limit on successful login ──
      resetRateLimit(RATE_LIMIT_NAMESPACE, clientIp);

      const useSecureCookie = shouldUseSecureCookie(request);

      const token = await new SignJWT({ authenticated: true })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(SECRET);

      const cookieStore = await cookies();
      cookieStore.set("auth_token", token, {
        httpOnly: true,
        secure: useSecureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: AUTH_SESSION_TTL_SECONDS,
      });

      const response = authJson({ success: true });
      applyRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    // ── Failed attempt — rate limit headers on failure too ──
    const failResponse = authJson({ error: "Invalid password" }, { status: 401 });
    applyRateLimitHeaders(failResponse.headers, rateLimitResult);
    return failResponse;
  } catch (error: unknown) {console.error("[AUTH] Login failed:", error);
    return authJson({ error: "Internal server error" }, { status: 500 });
  }
}
