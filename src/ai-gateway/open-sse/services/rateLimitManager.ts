export interface LearnedLimit {
  limit: number;
  remaining: number;
  windowMs?: number;
  observedAt?: number;
}

export type RateLimitStatus = {
  provider: string;
  connectionId?: string;
  enabled: boolean;
  requestsPerMinute: number;
  currentCount: number;
  resetAt: number;
} & Record<string, unknown>;

const providerRateLimits = new Map<string, RateLimitStatus>();
const requestTimestamps = new Map<string, number[]>();
const learnedLimits = new Map<string, LearnedLimit>();
let globalRateLimitProtectionEnabled = true;
const perConnectionProtection = new Map<string, boolean>();

function resolveKey(provider: string, connectionId?: string): string {
  return connectionId ? `${provider}:${connectionId}` : provider;
}

function isProtectionEnabled(connectionId?: string): boolean {
  if (!connectionId) return globalRateLimitProtectionEnabled;
  return perConnectionProtection.get(connectionId) ?? globalRateLimitProtectionEnabled;
}

export function enableRateLimitProtection(connectionId?: string): void {
  if (connectionId) perConnectionProtection.set(connectionId, true);
  else globalRateLimitProtectionEnabled = true;
}

export function disableRateLimitProtection(connectionId?: string): void {
  if (connectionId) perConnectionProtection.set(connectionId, false);
  else globalRateLimitProtectionEnabled = false;
}

export function getRateLimitStatus(
  provider: string,
  connectionId?: string
): RateLimitStatus | undefined {
  const key = resolveKey(provider, connectionId);
  const entry = providerRateLimits.get(key);
  if (!entry) return undefined;
  const now = Date.now();
  const timestamps = (requestTimestamps.get(key) ?? []).filter((t) => t > now - 60_000);
  requestTimestamps.set(key, timestamps);
  return { ...entry, enabled: isProtectionEnabled(connectionId), currentCount: timestamps.length };
}

export function getAllRateLimitStatus(): Record<string, RateLimitStatus> {
  const result: Record<string, RateLimitStatus> = {};
  for (const [key, entry] of providerRateLimits.entries()) {
    const status = getRateLimitStatus(entry.provider, entry.connectionId);
    if (status) result[key] = status;
  }
  return result;
}

export function setRateLimitConfig(
  provider: string,
  requestsPerMinute: number,
  connectionId?: string
): void {
  providerRateLimits.set(resolveKey(provider, connectionId), {
    provider,
    connectionId,
    enabled: isProtectionEnabled(connectionId),
    requestsPerMinute,
    currentCount: 0,
    resetAt: Date.now() + 60_000,
  });
}

export function checkRateLimit(provider: string, connectionId?: string): boolean {
  if (!isProtectionEnabled(connectionId)) return true;
  const key = resolveKey(provider, connectionId);
  const config = providerRateLimits.get(key);
  if (!config) return true;
  const now = Date.now();
  const timestamps = (requestTimestamps.get(key) ?? []).filter((t) => t > now - 60_000);
  if (timestamps.length >= config.requestsPerMinute) return false;
  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return true;
}

export function getLearnedLimits(): Record<string, LearnedLimit> {
  return Object.fromEntries(learnedLimits);
}
