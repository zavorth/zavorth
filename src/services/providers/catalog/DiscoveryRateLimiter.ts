export type RateLimitConfig = {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstLimit: number;
  cooldownMs: number;
};

export type RateLimitState = {
  requests: number[];
  burstCount: number;
  lastRequestAt: number;
  blocked: boolean;
  blockedUntil: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
  reason?: string;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxRequestsPerHour: 100,
  burstLimit: 5,
  cooldownMs: 60000,
};

export class DiscoveryRateLimiter {
  private readonly states = new Map<string, RateLimitState>();
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public check(providerId: string): RateLimitResult {
    const now = Date.now();
    const state = this.getOrCreateState(providerId);

    if (state.blocked && now < state.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: state.blockedUntil,
        retryAfterMs: state.blockedUntil - now,
        reason: 'rate_limited',
      };
    }

    if (state.blocked && now >= state.blockedUntil) {
      state.blocked = false;
      state.burstCount = 0;
    }

    state.requests = state.requests.filter((t) => now - t < 60000);

    if (state.requests.length >= this.config.maxRequestsPerMinute) {
      const oldestInWindow = state.requests[0];
      const resetAt = oldestInWindow + 60000;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: resetAt - now,
        reason: 'rate_limited_minute',
      };
    }

    const hourAgo = now - 3600000;
    const requestsLastHour = state.requests.filter((t) => t > hourAgo).length;
    if (requestsLastHour >= this.config.maxRequestsPerHour) {
      const oldestInHour = state.requests.find((t) => t > hourAgo) || now;
      const resetAt = oldestInHour + 3600000;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: resetAt - now,
        reason: 'rate_limited_hour',
      };
    }

    if (state.burstCount >= this.config.burstLimit) {
      state.blocked = true;
      state.blockedUntil = now + this.config.cooldownMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt: state.blockedUntil,
        retryAfterMs: this.config.cooldownMs,
        reason: 'burst_limit_exceeded',
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxRequestsPerMinute - state.requests.length - 1,
      resetAt: now + 60000,
    };
  }

  public consume(providerId: string): void {
    const now = Date.now();
    const state = this.getOrCreateState(providerId);

    state.requests.push(now);
    state.burstCount++;
    state.lastRequestAt = now;

    const burstWindow = 10000;
    const recentBursts = state.requests.filter((t) => now - t < burstWindow).length;
    if (recentBursts <= 1) {
      state.burstCount = 1;
    }
  }

  public reset(providerId: string): void {
    this.states.delete(providerId);
  }

  public resetAll(): void {
    this.states.clear();
  }

  public getState(providerId: string): RateLimitState | undefined {
    return this.states.get(providerId);
  }

  private getOrCreateState(providerId: string): RateLimitState {
    let state = this.states.get(providerId);
    if (!state) {
      state = {
        requests: [],
        burstCount: 0,
        lastRequestAt: 0,
        blocked: false,
        blockedUntil: 0,
      };
      this.states.set(providerId, state);
    }
    return state;
  }
}
