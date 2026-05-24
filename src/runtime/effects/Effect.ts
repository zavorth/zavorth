import type { ActionIntentSourceTrust } from './ActionIntent.js';
import type { EffectReversibility } from './EffectReversibility.js';
import type { ResourceRef } from './EffectScope.js';

export type Effect = {
  intentId: string;
  reads: ResourceRef[];
  writes: ResourceRef[];
  deletes: ResourceRef[];
  networkEgress: ResourceRef[];
  secretAccess: ResourceRef[];
  processSpawn: ResourceRef[];
  persistence: ResourceRef[];
  humanVisibleSend: ResourceRef[];
  reversibility: EffectReversibility;
  sourceTrust: ActionIntentSourceTrust;
  metadata?: Record<string, unknown>;
};

export function createEmptyEffect(input: {
  intentId: string;
  sourceTrust?: ActionIntentSourceTrust;
  reversibility?: EffectReversibility;
  metadata?: Record<string, unknown>;
}): Effect {
  return {
    intentId: String(input.intentId || '').trim(),
    reads: [],
    writes: [],
    deletes: [],
    networkEgress: [],
    secretAccess: [],
    processSpawn: [],
    persistence: [],
    humanVisibleSend: [],
    reversibility: input.reversibility || 'none',
    sourceTrust: input.sourceTrust || 'unknown',
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function hasRealSideEffect(effect: Effect): boolean {
  return effect.writes.length > 0
    || effect.deletes.length > 0
    || effect.networkEgress.length > 0
    || effect.secretAccess.length > 0
    || effect.processSpawn.length > 0
    || effect.persistence.length > 0
    || effect.humanVisibleSend.length > 0;
}

export function isReadOnlyEffect(effect: Effect): boolean {
  return !hasRealSideEffect(effect);
}
