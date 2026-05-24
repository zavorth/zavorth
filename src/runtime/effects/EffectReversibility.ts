export type EffectReversibility =
  | 'none'
  | 'draft_only'
  | 'rollback_available'
  | 'irreversible';

export function requiresRollbackPlan(reversibility: EffectReversibility): boolean {
  return reversibility === 'rollback_available' || reversibility === 'irreversible';
}

export function isCommitEligibleReversibility(reversibility: EffectReversibility): boolean {
  return reversibility === 'rollback_available';
}
