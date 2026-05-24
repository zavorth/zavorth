import type { Effect } from './Effect.js';

export type EffectRiskLevel = 'safe' | 'attention' | 'danger' | 'forbidden';

export function inferEffectRisk(effect: Effect): EffectRiskLevel {
  if (effect.secretAccess.length > 0 && effect.networkEgress.length > 0) {
    return 'forbidden';
  }
  if (
    effect.deletes.length > 0
    || effect.processSpawn.length > 0
    || effect.humanVisibleSend.length > 0
    || effect.reversibility === 'irreversible'
  ) {
    return 'danger';
  }
  if (
    effect.writes.length > 0
    || effect.networkEgress.length > 0
    || effect.secretAccess.length > 0
    || effect.persistence.length > 0
    || effect.reversibility === 'rollback_available'
  ) {
    return 'attention';
  }
  return 'safe';
}

export function isSafeObservationRisk(risk: EffectRiskLevel): boolean {
  return risk === 'safe';
}
