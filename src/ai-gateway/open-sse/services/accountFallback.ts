import { COOLDOWN_MS } from "../config/constants";

export interface ModelLockout {
  provider: string;
  connectionId: string;
  model: string;
  lockedAt: number;
  retryAfterMs: number;
  reason: string;
}

export interface FallbackDecision {
  shouldFallback: boolean;
  cooldownMs: number;
  newBackoffLevel?: number;
  reason?: string;
  permanent?: boolean;
}

const modelLockouts = new Map<string, ModelLockout>();
const PER_MODEL_QUOTA_PROVIDERS = new Set(["codex", "openai"]);

function lockoutKey(provider: string, connectionId: string, model: string): string {
  return `${provider}:${connectionId}:${model}`;
}

export function lockModel(
  provider: string,
  connectionId: string,
  model: string,
  reason: string,
  cooldownMs: number
): void {
  modelLockouts.set(lockoutKey(provider, connectionId, model), {
    provider,
    connectionId,
    model,
    lockedAt: Date.now(),
    retryAfterMs: cooldownMs,
    reason,
  });
}

export function isModelLocked(provider: string, connectionId: string, model: string): boolean {
  const key = lockoutKey(provider, connectionId, model);
  const entry = modelLockouts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.lockedAt > entry.retryAfterMs) {
    modelLockouts.delete(key);
    return false;
  }
  return true;
}

export function getAllModelLockouts(): Record<string, ModelLockout> {
  const result: Record<string, ModelLockout> = {};
  for (const [key, entry] of modelLockouts.entries()) {
    if (Date.now() - entry.lockedAt <= entry.retryAfterMs) {
      result[key] = entry;
    } else {
      modelLockouts.delete(key);
    }
  }
  return result;
}

export function isAccountUnavailable(rateLimitedUntil?: string | null): boolean {
  if (!rateLimitedUntil) return false;
  return new Date(rateLimitedUntil).getTime() > Date.now();
}

export function getUnavailableUntil(cooldownMs: number): string {
  return new Date(Date.now() + cooldownMs).toISOString();
}

export function getEarliestRateLimitedUntil(
  connections: Array<{ rateLimitedUntil?: string | null }>
): number | null {
  let earliest: number | null = null;
  for (const connection of connections) {
    if (!connection.rateLimitedUntil) continue;
    const until = new Date(connection.rateLimitedUntil).getTime();
    if (until > Date.now() && (earliest === null || until < earliest)) earliest = until;
  }
  return earliest;
}

export function hasPerModelQuota(provider: string | null): boolean {
  return provider ? PER_MODEL_QUOTA_PROVIDERS.has(provider) : false;
}

export function checkFallbackError(
  status: number,
  errorText: string,
  backoffLevel: number,
  model: string | null,
  provider: string | null
): FallbackDecision {
  if (status === 404 && provider === "codex" && model) {
    const text = errorText.toLowerCase();
    if (text.includes("quota") || text.includes("usage limit")) {
      return {
        shouldFallback: true,
        cooldownMs: COOLDOWN_MS.rateLimit,
        newBackoffLevel: Math.min(backoffLevel + 1, 4),
        reason: "rate_limited",
      };
    }
    return {
      shouldFallback: true,
      cooldownMs: COOLDOWN_MS.notFoundLocal,
      newBackoffLevel: backoffLevel,
      reason: "not_found",
      permanent: true,
    };
  }
  if (status === 401 || status === 403) {
    return {
      shouldFallback: true,
      cooldownMs: COOLDOWN_MS.auth,
      newBackoffLevel: backoffLevel,
      reason: "auth_error",
      permanent: true,
    };
  }
  if (status === 429 || (status >= 500 && status < 600)) {
    return {
      shouldFallback: true,
      cooldownMs: COOLDOWN_MS.rateLimit,
      newBackoffLevel: Math.min(backoffLevel + 1, 4),
      reason: "rate_limited",
    };
  }
  return { shouldFallback: false, cooldownMs: 0 };
}

export function formatRetryAfter(retryAfterMs: number): string {
  if (retryAfterMs <= 0) return "now";
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}
