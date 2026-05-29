import type {
  ExecutionEngineId,
  TrustedWorkspaceState,
} from "../../../../contracts/ExecutionEngineContract";
import {
  getRuntimeEngineApiState as getSharedRuntimeEngineApiState,
  type RuntimeEngineApiState,
} from "../../../../services/RuntimeEngineApiStateService";

export function getRuntimeEngineApiState(): RuntimeEngineApiState {
  return getSharedRuntimeEngineApiState();
}

export function isExecutionEngineId(value: unknown): value is ExecutionEngineId {
  return value === "lite" || value === "velocity" || value === "shield";
}

export function isTrustedWorkspaceState(value: unknown): value is TrustedWorkspaceState {
  return value === "untrusted" || value === "trusted" || value === "sensitive";
}

export function isUnsafeCrossSiteMutation(request: Request): boolean {
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return true;

  let requestOrigin = "";
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = "";
  }

  const origin = request.headers.get("origin");
  if (origin && requestOrigin && origin !== requestOrigin) return true;

  const referer = request.headers.get("referer");
  if (referer && requestOrigin) {
    try {
      if (new URL(referer).origin !== requestOrigin) return true;
    } catch {
      return true;
    }
  }

  return false;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
