/**
 * AuthRateLimiter — Protection against excessive authentication attempts.
 *
 * Implements sliding window rate limiting per scope and identifier.
 * Each credential class (shared-secret, device-token, node-pairing)
 * has independent counters. Loopback addresses are exempt by default.
 *
 * Usage:
 *   const limiter = new AuthRateLimiter();
 *   if (limiter.isBlocked('gateway', clientIp)) {
 *     return res.status(429).json({ error: 'Too many attempts' });
 *   }
 *   // ? validate credentials ?  *   limiter.recordFailure('gateway', clientIp);
 *   // or on success:
 *   limiter.recordSuccess('gateway', clientIp);
 */

export interface AuthRateLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
  maxTrackedEntries?: number;
  exemptLoopback?: boolean;
}

interface AttemptRecord {
  count: number;
  windowStart: number;
  blockedUntil: number | null;
}

const LOOPBACK_PREFIXES = ['127.', '10.', '192.168.', '::1', 'localhost'];

export class AuthRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private readonly maxTracked: number;
  private readonly exemptLoopback: boolean;

  private readonly attempts = new Map<string, AttemptRecord>();
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: AuthRateLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 10;
    this.windowMs = options.windowMs ?? 60_000;
    this.lockoutMs = options.lockoutMs ?? 300_000;
    this.maxTracked = options.maxTrackedEntries ?? 10_000;
    this.exemptLoopback = options.exemptLoopback ?? true;

    this.pruneTimer = setInterval(() => this.prune(), 60_000);
  }

  private key(scope: string, identifier: string): string {
    return `${scope}:${identifier}`;
  }

  private isLoopback(identifier: string): boolean {
    return LOOPBACK_PREFIXES.some((p) => identifier.startsWith(p));
  }

  private getRecord(scope: string, identifier: string): AttemptRecord {
    const k = this.key(scope, identifier);
    let record = this.attempts.get(k);

    if (!record) {
      if (this.attempts.size >= this.maxTracked) {
        this.prune();
      }
      record = { count: 0, windowStart: Date.now(), blockedUntil: null };
      this.attempts.set(k, record);
    }

    return record;
  }

  /**
   * Checks if the identifier is blocked.
   */
  isBlocked(scope: string, identifier: string): boolean {
    if (this.exemptLoopback && this.isLoopback(identifier)) {
      return false;
    }

    const k = this.key(scope, identifier);
    const record = this.attempts.get(k);
    if (!record) return false;

    const now = Date.now();

    if (record.blockedUntil && now < record.blockedUntil) {
      return true;
    }

    if (record.blockedUntil && now >= record.blockedUntil) {
      record.blockedUntil = null;
      record.count = 0;
      record.windowStart = now;
    }

    return record.count >= this.maxAttempts;
  }

  /**
   * Records a failed attempt, increments the counter,
   * and applies lockout when the limit is reached.
   */
  recordFailure(scope: string, identifier: string): void {
    if (this.exemptLoopback && this.isLoopback(identifier)) {
      return;
    }

    const record = this.getRecord(scope, identifier);
    const now = Date.now();

    if (now - record.windowStart > this.windowMs) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count++;

    if (record.count >= this.maxAttempts) {
      record.blockedUntil = now + this.lockoutMs;
    }
  }

  /**
   * Records a successful attempt and resets the counter.
   */
  recordSuccess(scope: string, identifier: string): void {
    const k = this.key(scope, identifier);
    const record = this.attempts.get(k);
    if (record) {
      record.count = 0;
      record.blockedUntil = null;
    }
  }

  /**
   * Returns how many attempts remain before lockout.
   */
  remainingAttempts(scope: string, identifier: string): number {
    if (this.exemptLoopback && this.isLoopback(identifier)) {
      return this.maxAttempts;
    }

    const record = this.getRecord(scope, identifier);
    const now = Date.now();

    if (now - record.windowStart > this.windowMs) {
      return this.maxAttempts;
    }

    return Math.max(0, this.maxAttempts - record.count);
  }

  /**
   * Returns time in ms until lockout ends, or 0 if not blocked.
   */
  lockoutRemainingMs(scope: string, identifier: string): number {
    const record = this.getRecord(scope, identifier);
    if (!record.blockedUntil) return 0;
    return Math.max(0, record.blockedUntil - Date.now());
  }

  /**
   * Removes expired records.
   */
  private prune(): void {
    const now = Date.now();
    for (const [k, record] of this.attempts) {
      const expired =
        (!record.blockedUntil && now - record.windowStart > this.windowMs * 2) ||
        (record.blockedUntil && now > record.blockedUntil + this.windowMs);
      if (expired) {
        this.attempts.delete(k);
      }
    }
  }

  /**
   * Clears all records.
   */
  reset(): void {
    this.attempts.clear();
  }

  /**
   * Destroys the limiter, stopping the pruning timer.
   */
  destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.attempts.clear();
  }
}
