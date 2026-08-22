/**
 * ModelFallbackChain — Multi-candidate fallback with per-provider cooldown.
 *
 * Manages an ordered chain of alternative models. When a provider
 * fails (rate limit, auth error, billing), it enters automatic cooldown
 * and the next candidate is tried. Includes periodic recovery probing
 * and known-bad error cache within the session.
 *
 * Usage:
 *   const chain = new ModelFallbackChain({
 *     primary: { provider: 'openai', model: 'gpt-4o' },
 *     fallbacks: [
 *       { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
 *       { provider: 'google', model: 'gemini-2.0-flash' },
 *     ],
 *   });
 *   const candidate = chain.selectCandidate();
 *   // ? use candidate ?  *   if (failed) chain.recordFailure(candidate, 'rate_limit');
 *   if (success) chain.recordSuccess(candidate);
 */

export type FailureReason =
  | 'rate_limit'
  | 'auth_error'
  | 'billing'
  | 'timeout'
  | 'server_error'
  | 'unknown';

export interface ModelCandidate {
  provider: string;
  model: string;
  priority?: number;
}

export interface FallbackChainOptions {
  primary: ModelCandidate;
  fallbacks?: ModelCandidate[];
  cooldownMs?: number;
  probeIntervalMs?: number;
  maxKnownBadCache?: number;
}

interface CooldownEntry {
  until: number;
  reason: FailureReason;
  failCount: number;
}

export class ModelFallbackChain {
  private readonly candidates: ModelCandidate[];
  private readonly cooldowns = new Map<string, CooldownEntry>();
  private readonly knownBad = new Set<string>();
  private readonly cooldownMs: number;
  private readonly probeIntervalMs: number;
  private readonly maxKnownBad: number;
  private lastProbe = new Map<string, number>();

  constructor(options: FallbackChainOptions) {
    this.candidates = [options.primary, ...(options.fallbacks ?? [])];
    this.cooldownMs = options.cooldownMs ?? 300_000; // 5 min
    this.probeIntervalMs = options.probeIntervalMs ?? 60_000; // 1 min
    this.maxKnownBad = options.maxKnownBadCache ?? 256;
  }

  private key(c: ModelCandidate): string {
    return `${c.provider}/${c.model}`;
  }

  private isAvailable(c: ModelCandidate): boolean {
    const k = this.key(c);
    const cooldown = this.cooldowns.get(k);
    const now = Date.now();

    if (cooldown && now < cooldown.until) {
      return false;
    }

    if (cooldown && now >= cooldown.until) {
      this.cooldowns.delete(k);
    }

    if (this.knownBad.has(k)) {
      const lastProbe = this.lastProbe.get(k) ?? 0;
      if (now - lastProbe < this.probeIntervalMs) {
        return false;
      }
      this.lastProbe.set(k, now);
    }

    return true;
  }

  /**
   * Selects the next available candidate.
   * Returns null if all are in cooldown.
   */
  selectCandidate(): ModelCandidate | null {
    for (const candidate of this.candidates) {
      if (this.isAvailable(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Returns all candidates with their status.
   */
  getCandidatesWithStatus(): Array<ModelCandidate & { available: boolean; cooldownRemainingMs: number }> {
    const now = Date.now();
    return this.candidates.map((c) => {
      const k = this.key(c);
      const cooldown = this.cooldowns.get(k);
      const remaining = cooldown ? Math.max(0, cooldown.until - now) : 0;
      return {
        ...c,
        available: this.isAvailable(c),
        cooldownRemainingMs: remaining,
      };
    });
  }

  /**
   * Records a failure for a candidate.
   */
  recordFailure(candidate: ModelCandidate, reason: FailureReason = 'unknown'): void {
    const k = this.key(candidate);
    const now = Date.now();
    const existing = this.cooldowns.get(k);

    const failCount = (existing?.failCount ?? 0) + 1;
    const multiplier = Math.min(failCount, 5);
    const cooldownMs = this.cooldownMs * multiplier;

    this.cooldowns.set(k, {
      until: now + cooldownMs,
      reason,
      failCount,
    });

    if (reason === 'auth_error' || reason === 'billing') {
      this.addToKnownBad(k);
    }
  }

  /**
   * Registra success e reseta o estado do candidato.
   */
  recordSuccess(candidate: ModelCandidate): void {
    const k = this.key(candidate);
    this.cooldowns.delete(k);
    this.knownBad.delete(k);
    this.lastProbe.delete(k);
  }

  private addToKnownBad(key: string): void {
    if (this.knownBad.size >= this.maxKnownBad) {
      const first = this.knownBad.values().next().value;
      if (first) this.knownBad.delete(first);
    }
    this.knownBad.add(key);
  }

  /**
   * Returns the shortest cooldown remaining among all candidates.
   */
  soonestCooldownMs(): number {
    const now = Date.now();
    let min = Infinity;
    for (const entry of this.cooldowns.values()) {
      const remaining = entry.until - now;
      if (remaining > 0 && remaining < min) {
        min = remaining;
      }
    }
    return min === Infinity ? 0 : min;
  }

  /**
   * Returns a summary of current state.
   */
  getSummary(): {
    total: number;
    available: number;
    inCooldown: number;
    knownBad: number;
    soonestRecoveryMs: number;
  } {
    Date.now();
    let available = 0;
    let inCooldown = 0;

    for (const c of this.candidates) {
      if (this.isAvailable(c)) {
        available++;
      } else {
        inCooldown++;
      }
    }

    return {
      total: this.candidates.length,
      available,
      inCooldown,
      knownBad: this.knownBad.size,
      soonestRecoveryMs: this.soonestCooldownMs(),
    };
  }

  /**
   * Clears all state (cooldowns, knownBad, probes).
   */
  reset(): void {
    this.cooldowns.clear();
    this.knownBad.clear();
    this.lastProbe.clear();
  }
}
