import type { Effect } from '../effects/Effect.js';

export type RollbackStep = {
  id: string;
  kind: 'restore_file' | 'delete_created_file' | 'manual' | 'not_available';
  target: string;
  summary: string;
};

export type RollbackPlan = {
  kind: 'rollback-plan';
  version: 1;
  id: string;
  effectIntentId: string;
  available: boolean;
  required: boolean;
  steps: RollbackStep[];
  blockers: string[];
};

export function buildRollbackPlan(input: {
  id: string;
  effect: Effect;
  required?: boolean;
}): RollbackPlan {
  const steps: RollbackStep[] = [];
  for (const resource of input.effect.writes) {
    steps.push({
      id: `${input.id}:restore:${steps.length + 1}`,
      kind: 'restore_file',
      target: resource.uri,
      summary: `Restore previous content for ${resource.uri}.`,
    });
  }
  for (const resource of input.effect.deletes) {
    steps.push({
      id: `${input.id}:manual:${steps.length + 1}`,
      kind: 'manual',
      target: resource.uri,
      summary: `Deletion of ${resource.uri} requires external backup evidence before commit.`,
    });
  }
  const irreversible = input.effect.reversibility === 'irreversible';
  return {
    kind: 'rollback-plan',
    version: 1,
    id: input.id,
    effectIntentId: input.effect.intentId,
    available: steps.length > 0 && !irreversible,
    required: input.required ?? (input.effect.writes.length > 0 || input.effect.deletes.length > 0),
    steps,
    blockers: irreversible ? ['irreversible-effect-has-no-automatic-rollback'] : [],
  };
}
