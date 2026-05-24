import type { Effect } from '../effects/Effect.js';
import type { EffectPolicyDecision } from '../effects/EffectDecision.js';
import type { CommitPlan } from '../commit/CommitPlan.js';
import type { RollbackPlan } from '../commit/RollbackPlan.js';

export type RehearsalStatus =
  | 'not_required'
  | 'prepared'
  | 'approval_required'
  | 'blocked';

export type RehearsalResult = {
  kind: 'effect-rehearsal';
  version: 1;
  id: string;
  status: RehearsalStatus;
  effect: Effect;
  decision: EffectPolicyDecision;
  commitPlan: CommitPlan;
  rollbackPlan: RollbackPlan;
  preview: {
    summary: string;
    touchedResources: string[];
    commands: string[];
    externalTargets: string[];
  };
  receipts: string[];
  blockers: string[];
};
