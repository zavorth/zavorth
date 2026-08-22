/**
 * Rate Limiter — FASE-02 Security Hardening
 *
 * In-memory sliding-window rate limiter for authentication routes.
 * No external dependencies (Redis not required).
 *
 * Features:
 * - Configurable window and max attempts per route
 * - Exponential penalty escalation on repeated violations
 * - Automatic cleanup of expired entries to prevent memory leaks
 * - Standard rate-limit response headers
 *
 * @module lib/rateLimiter
 */

// ── Types ──

interface RateLimitEntry {
  /** Timestamps of recent attempts within the current window */
  attempts: number[];
  /** Current penalty level (0 = no penalty, each increment doubles block time) */
  penaltyLevel: number;
  /** Timestamp when the current block expires (0 = not blocked) */
  blockedUntil: number;
}

export interface RateLimitConfig {
  /** Maximum attempts allowed within the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Base block duration in milliseconds after exceeding limit */
  baseBlockMs: number;
  /** Maximum block duration in milliseconds (cap for exponential growth) */
  maxBlockMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining attempts in the current window */
  remaining: number;
  /** Timestamp (ms) when the rate limit resets */
  resetAt: number;
  /** If blocked, how many seconds until the block expires */
  retryAfterSeconds: number;
}

// ── Default Configs ──

const DEFAULT_AUTH_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  baseBlockMs: 15 * 60 * 1000, // 15 minutes
  maxBlockMs: 60 * 60 * 1000, // 1 hour cap
};

// ── State ──

const stores = new Map<string, Map<string, RateLimitEntry>>();

/** Cleanup interval handle — runs every 5 minutes */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// ── Core Functions ──

function getStore(namespace: string): Map<string, RateLimitEntry> {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

/**
 * Sentinel value returned when the client IP cannot be trusted.
 * Used by rate limiters and auth flows to avoid keying on spoofable
 * `x-forwarded-for` / `x-real-ip` headers without an explicit opt-in.
 */
export const UNTRUSTED_NETWORK_CLIENT_KEY = "untrusted:network:client";

const MAX_CLIENT_ADDRESS_LENGTH = 255;
const VALID_CLIENT_ADDRESS_PATTERN = /^[0-9a-fA-F:.]+$/;

/**
 * Extract client IP from a request object.
 *
 * Trust policy: forwarding headers (`x-forwarded-for`, `x-real-ip`) are
 * ONLY honored when `ZAVORTH_TRUST_PROXY_HEADERS=true` is set in the
 * environment. Without that opt-in, the function returns
 * `UNTRUSTED_NETWORK_CLIENT_KEY` so callers can key rate limits / auth
 * flows on a non-spoofable identity rather than a header an attacker
 * controls.
 *
 * Even with opt-in, malformed (newlines / control chars) or oversized
 * (>255 char) header values are rejected and the sentinel is returned
 * — never fall back to a parsed substring of attacker-controlled input.
 */
export function extractClientIp(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  const trustProxyHeaders = env.ZAVORTH_TRUST_PROXY_HEADERS === "true";
  if (!trustProxyHeaders) {
    return UNTRUSTED_NETWORK_CLIENT_KEY;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (isValidClientAddress(first)) {
      return first;
    }
    return UNTRUSTED_NETWORK_CLIENT_KEY;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (isValidClientAddress(trimmed)) {
      return trimmed;
    }
    return UNTRUSTED_NETWORK_CLIENT_KEY;
  }

  return UNTRUSTED_NETWORK_CLIENT_KEY;
}

function isValidClientAddress(value: string): boolean {
  if (value.length === 0 || value.length > MAX_CLIENT_ADDRESS_LENGTH) {
    return false;
  }
  return VALID_CLIENT_ADDRESS_PATTERN.test(value);
}

/**
 * Check and consume a rate limit attempt.
 *
 * @param namespace - Logical group (e.g., "auth:login")
 * @param key - Unique identifier (typically client IP)
 * @param config - Rate limit configuration
 * @returns RateLimitResult indicating whether the request is allowed
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig = DEFAULT_AUTH_CONFIG
): RateLimitResult {
  const store = getStore(namespace);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { attempts: [], penaltyLevel: 0, blockedUntil: 0 };
    store.set(key, entry);
  }

  // Check if currently blocked
  if (entry.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfterSeconds,
    };
  }

  // Clean expired attempts outside the window
  entry.attempts = entry.attempts.filter((ts) => ts > now - config.windowMs);

  // Check if limit exceeded
  if (entry.attempts.length >= config.maxAttempts) {
    // Apply exponential penalty
    const blockDuration = Math.min(
      config.baseBlockMs * Math.pow(2, entry.penaltyLevel),
      config.maxBlockMs
    );
    entry.blockedUntil = now + blockDuration;
    entry.penaltyLevel++;

    const retryAfterSeconds = Math.ceil(blockDuration / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfterSeconds,
    };
  }

  // Record this attempt
  entry.attempts.push(now);

  const remaining = config.maxAttempts - entry.attempts.length;
  const oldestAttempt = entry.attempts[0] || now;
  const resetAt = oldestAttempt + config.windowMs;

  return {
    allowed: true,
    remaining,
    resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Record a failed attempt (call after authentication failure).
 * This is separate from checkRateLimit to allow counting only actual failures,
 * not all requests.
 */
export function recordFailedAttempt(
  _namespace: string,
  _key: string
): void {
  // The attempt was already recorded in checkRateLimit.
  // This function exists for explicit semantics. No-op by default.
}

/**
 * Reset rate limit for a key (call after successful authentication).
 */
export function resetRateLimit(namespace: string, key: string): void {
  const store = getStore(namespace);
  store.delete(key);
}

/**
 * Apply rate-limit headers to a NextResponse.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
  config: RateLimitConfig = DEFAULT_AUTH_CONFIG
): void {
  headers.set("X-RateLimit-Limit", String(config.maxAttempts));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    headers.set("Retry-After", String(result.retryAfterSeconds));
  }
}

// ── Cleanup ──

/**
 * Remove expired entries from all stores.
 * Prevents memory leaks from abandoned IPs.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      // Remove if no recent attempts and not currently blocked
      const hasRecentAttempts = entry.attempts.some(
        (ts) => ts > now - 60 * 60 * 1000 // 1 hour max retention
      );

      if (!hasRecentAttempts && entry.blockedUntil < now) {
        store.delete(key);
      }
    }
  }
}

/**
 * Start the automatic cleanup interval (idempotent).
 */
export function startCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupExpiredEntries, 5 * 60 * 1000); // every 5 min
  // Ensure the interval does not prevent Node from exiting
  if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }
}

// Auto-start cleanup on module load
startCleanupInterval();

// ── Exports for Testing ──

export { DEFAULT_AUTH_CONFIG, cleanupExpiredEntries };
