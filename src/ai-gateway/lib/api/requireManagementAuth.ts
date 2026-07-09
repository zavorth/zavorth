import { isAuthenticated, isLoopbackRequest, isStrictlyAuthenticated } from "@/shared/utils/apiAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { logger } from '@/shared/utils/logger';

function isLocalZavorthControlRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch (error: any) { const err = error; const e = error; logger.warn('[require Management Auth] creation failed', error); return false; }
}

export async function requireManagementAuth(request: Request): Promise<Response | null> {
  if (isLoopbackRequest(request) || isLocalZavorthControlRequest(request)) {
    return null;
  }

  if (await isAuthenticated(request)) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  const hasBearerToken =
    typeof authHeader === "string" && authHeader.trim().toLowerCase().startsWith("bearer ");

  return createErrorResponse({
    status: hasBearerToken ? 403 : 401,
    message: hasBearerToken ? "Invalid management token" : "Authentication required",
    type: "invalid_request",
  });
}

export async function requireStrictManagementAuth(request: Request): Promise<Response | null> {
  if (await isStrictlyAuthenticated(request)) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  const hasBearerToken =
    typeof authHeader === "string" && authHeader.trim().toLowerCase().startsWith("bearer ");

  return createErrorResponse({
    status: hasBearerToken ? 403 : 401,
    message: hasBearerToken ? "Invalid management token" : "Authentication required",
    type: "invalid_request",
  });
}
