/**
 * Per-provider circuit breaker for the LLM hot path (agent / runtime).
 *
 * In-process only — does not invent providers or load gateway SQLite state.
 * Tracks names already attempted; OPEN circuits are skipped until reset timeout.
 */

export type HotPathBreakerSnapshot = {
  providerName: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
};

const DEFAULT_FAILURE_THRESHOLD = Number(process.env.ZAVORTH_LLM_CB_FAILURE_THRESHOLD || 3) || 3;
const DEFAULT_RESET_MS = Number(process.env.ZAVORTH_LLM_CB_RESET_MS || 60_000) || 60_000;

type BreakerState = {
  state: HotPathBreakerSnapshot['state'];
  failureCount: number;
  lastFailureTime: number | null;
  halfOpenAllowed: number;
};

/**
 * In-process registry of provider circuit breakers for the LLM hot path.
 */
export class ProviderHotPathCircuitBreaker {
  private static instance: ProviderHotPathCircuitBreaker | null = null;
  private readonly breakers = new Map<string, BreakerState>();
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenRequests: number;

  public constructor(options?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenRequests?: number;
  }) {
    this.failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.resetTimeout = options?.resetTimeout ?? DEFAULT_RESET_MS;
    this.halfOpenRequests = options?.halfOpenRequests ?? 1;
  }

  public static getInstance(): ProviderHotPathCircuitBreaker {
    if (!this.instance) {
      this.instance = new ProviderHotPathCircuitBreaker();
    }
    return this.instance;
  }

  /** Test helper. */
  public static resetInstanceForTests(): void {
    this.instance = null;
  }

  public canAttempt(providerName: string): boolean {
    const key = normalizeKey(providerName);
    if (!key) return true;
    const breaker = this.getOrCreate(key);
    this.maybeTransitionOpenToHalfOpen(breaker);
    if (breaker.state === 'CLOSED') return true;
    if (breaker.state === 'OPEN') return false;
    // HALF_OPEN: allow limited probes
    return breaker.halfOpenAllowed > 0;
  }

  public async recordSuccess(providerName: string): Promise<void> {
    const key = normalizeKey(providerName);
    if (!key) return;
    const breaker = this.getOrCreate(key);
    if (breaker.state === 'HALF_OPEN' || breaker.state === 'OPEN') {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.lastFailureTime = null;
      breaker.halfOpenAllowed = 0;
      return;
    }
    breaker.failureCount = 0;
  }

  public async recordFailure(providerName: string, error?: unknown): Promise<void> {
    const key = normalizeKey(providerName);
    if (!key) return;
    if (!isTransientProviderFailure(error)) {
      return;
    }
    const breaker = this.getOrCreate(key);
    this.maybeTransitionOpenToHalfOpen(breaker);

    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'OPEN';
      breaker.lastFailureTime = Date.now();
      breaker.halfOpenAllowed = 0;
      return;
    }

    if (breaker.state === 'OPEN') {
      breaker.lastFailureTime = Date.now();
      return;
    }

    // CLOSED
    breaker.failureCount += 1;
    breaker.lastFailureTime = Date.now();
    if (breaker.failureCount >= this.failureThreshold) {
      breaker.state = 'OPEN';
    }
  }

  public snapshot(providerName?: string): HotPathBreakerSnapshot[] {
    if (providerName) {
      const key = normalizeKey(providerName);
      const b = key ? this.breakers.get(key) : undefined;
      if (!b || !key) return [];
      this.maybeTransitionOpenToHalfOpen(b);
      return [{
        providerName: key,
        state: b.state,
        failureCount: b.failureCount,
      }];
    }
    return Array.from(this.breakers.entries()).map(([name, b]) => {
      this.maybeTransitionOpenToHalfOpen(b);
      return {
        providerName: name,
        state: b.state,
        failureCount: b.failureCount,
      };
    });
  }

  private getOrCreate(key: string): BreakerState {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        halfOpenAllowed: 0,
      };
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  private maybeTransitionOpenToHalfOpen(breaker: BreakerState): void {
    if (breaker.state !== 'OPEN') return;
    if (!breaker.lastFailureTime) {
      breaker.state = 'HALF_OPEN';
      breaker.halfOpenAllowed = this.halfOpenRequests;
      return;
    }
    if (Date.now() - breaker.lastFailureTime >= this.resetTimeout) {
      breaker.state = 'HALF_OPEN';
      breaker.halfOpenAllowed = this.halfOpenRequests;
    }
  }
}

function normalizeKey(providerName: string): string {
  return String(providerName || '').trim().toLowerCase();
}

export function isTransientProviderFailure(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  if (!message) return true;
  if (/invalid[_ ]?request|tool.?schema|json.?schema|context.?length|too many tokens/.test(message)) {
    return false;
  }
  return true;
}
