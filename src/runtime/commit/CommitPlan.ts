import type { Effect } from '../effects/Effect.js';
import type { EffectPolicyDecision } from '../effects/EffectDecision.js';
import type { RollbackPlan } from './RollbackPlan.js';

export type CommitPlanStatus =
  | 'draft'
  | 'rehearsal_required'
  | 'approval_required'
  | 'ready'
  | 'blocked';

export type CommitPlan = {
  kind: 'commit-plan';
  version: 1;
  id: string;
  effectIntentId: string;
  status: CommitPlanStatus;
  effect: Effect;
  decision: EffectPolicyDecision;
  rollbackPlan: RollbackPlan;
  approvalRequired: boolean;
  rehearsalRequired: boolean;
  rollbackRequired: boolean;
  receiptRequired: boolean;
  blockers: string[];
};

export function buildCommitPlan(input: {
  id: string;
  effect: Effect;
  decision: EffectPolicyDecision;
  rollbackPlan: RollbackPlan;
}): CommitPlan {
  const blockers = [
    ...input.rollbackPlan.blockers,
    ...(input.decision.action === 'deny' ? ['effect-policy-denied'] : []),
    ...(input.decision.action === 'require_admin_policy' ? ['admin-policy-required'] : []),
  ];
  const rehearsalRequired = input.decision.action === 'sandbox_only' || input.effect.writes.length > 0;
  const approvalRequired = input.decision.approvalRequired || input.decision.action === 'require_user_confirmation';
  const status: CommitPlanStatus = blockers.length > 0
    ? 'blocked'
    : approvalRequired ? 'approval_required'
      : rehearsalRequired ? 'rehearsal_required'
        : input.decision.allowed ? 'ready'
          : 'draft';

  return {
    kind: 'commit-plan',
    version: 1,
    id: input.id,
    effectIntentId: input.effect.intentId,
    status,
    effect: input.effect,
    decision: input.decision,
    rollbackPlan: input.rollbackPlan,
    approvalRequired,
    rehearsalRequired,
    rollbackRequired: input.decision.rollbackRequired || input.rollbackPlan.required,
    receiptRequired: input.decision.receiptRequired,
    blockers,
  };
}
