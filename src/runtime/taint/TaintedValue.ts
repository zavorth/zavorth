import type { InstructionAuthority } from './InstructionAuthority.js';
import { resolveInstructionAuthority } from './InstructionAuthority.js';
import type { TrustLevel } from './TrustLevel.js';

export type TaintedValue<T> = {
  value: T;
  trust: TrustLevel;
  authority: InstructionAuthority;
  source?: string;
  taintReasons: string[];
  metadata?: Record<string, unknown>;
};

export function taintValue<T>(input: {
  value: T;
  trust?: TrustLevel;
  source?: string;
  taintReasons?: string[];
  metadata?: Record<string, unknown>;
}): TaintedValue<T> {
  const trust = input.trust || 'unknown';
  return {
    value: input.value,
    trust,
    authority: resolveInstructionAuthority(trust),
    ...(input.source ? { source: input.source } : {}),
    taintReasons: input.taintReasons || [],
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function mapTaintedValue<T, U>(
  tainted: TaintedValue<T>,
  mapper: (value: T) => U,
): TaintedValue<U> {
  return {
    ...tainted,
    value: mapper(tainted.value),
  };
}

export function downgradeToEvidenceOnly<T>(
  tainted: TaintedValue<T>,
  reason: string,
): TaintedValue<T> {
  return {
    ...tainted,
    trust: 'untrusted-content',
    authority: 'evidence-only',
    taintReasons: Array.from(new Set([...tainted.taintReasons, reason])),
  };
}
