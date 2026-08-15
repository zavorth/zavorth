import { isAuthenticated, isStrictlyAuthenticated } from "@/shared/utils/apiAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";

function authenticationError(request: Request): Response {
  const authHeader = request.headers.get("authorization");
  const hasBearerToken =
    typeof authHeader === "string" && authHeader.trim().toLowerCase().startsWith("bearer ");

  return createErrorResponse({
    status: hasBearerToken ? 403 : 401,
    message: hasBearerToken ? "Invalid management token" : "Authentication required",
    type: "invalid_request",
  });
}

export async function requireManagementAuth(request: Request): Promise<Response | null> {
  if (await isAuthenticated(request)) {
    return null;
  }

  return authenticationError(request);
}

/**
 * Alias of {@link requireManagementAuth} used by control-channel routes
 * (`/api/web/zavorthControl/*`) where the contract is named for the
 * surface rather than the privilege tier. Behaviour is identical.
 */
export const requireControlAuth = requireManagementAuth;

export async function requireStrictManagementAuth(request: Request): Promise<Response | null> {
  if (await isStrictlyAuthenticated(request)) {
    return null;
  }

  return authenticationError(request);
}
