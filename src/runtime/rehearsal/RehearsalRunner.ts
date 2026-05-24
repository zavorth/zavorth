import type { Effect } from '../effects/Effect.js';
import type { EffectPolicyDecision } from '../effects/EffectDecision.js';
import { buildCommitPlan } from '../commit/CommitPlan.js';
import { buildRollbackPlan } from '../commit/RollbackPlan.js';
import type { RehearsalResult, RehearsalStatus } from './RehearsalResult.js';

export class RehearsalRunner {
  public prepare(input: {
    id: string;
    effect: Effect;
    decision: EffectPolicyDecision;
  }): RehearsalResult {
    const rollbackPlan = buildRollbackPlan({
      id: `${input.id}:rollback`,
      effect: input.effect,
      required: input.decision.rollbackRequired,
    });
    const commitPlan = buildCommitPlan({
      id: `${input.id}:commit`,
      effect: input.effect,
      decision: input.decision,
      rollbackPlan,
    });
    const blockers = Array.from(new Set([
      ...rollbackPlan.blockers,
      ...commitPlan.blockers,
    ]));
    const status = resolveStatus(input.decision, blockers);

    return {
      kind: 'effect-rehearsal',
      version: 1,
      id: input.id,
      status,
      effect: input.effect,
      decision: input.decision,
      commitPlan,
      rollbackPlan,
      preview: {
        summary: summarizePreview(input.effect, input.decision),
        touchedResources: [
          ...input.effect.reads,
          ...input.effect.writes,
          ...input.effect.deletes,
          ...input.effect.persistence,
        ].map((resource) => `${resource.kind}:${resource.uri}`),
        commands: input.effect.processSpawn.map((resource) => resource.uri),
        externalTargets: [
          ...input.effect.networkEgress,
          ...input.effect.humanVisibleSend,
        ].map((resource) => `${resource.kind}:${resource.uri}`),
      },
      receipts: [
        'effect-rehearsal-prepared',
        `effect-policy:${input.decision.action}`,
        `commit-plan:${commitPlan.status}`,
        `rollback:${rollbackPlan.available ? 'available' : 'unavailable'}`,
      ],
      blockers,
    };
  }
}

function resolveStatus(
  decision: EffectPolicyDecision,
  blockers: string[],
): RehearsalStatus {
  if (blockers.length > 0 || decision.action === 'deny' || decision.action === 'require_admin_policy') {
    return 'blocked';
  }
  if (decision.action === 'require_user_confirmation') {
    return 'approval_required';
  }
  if (decision.action === 'allow' || decision.action === 'allow_with_redaction') {
    return 'not_required';
  }
  return 'prepared';
}

function summarizePreview(effect: Effect, decision: EffectPolicyDecision): string {
  return [
    `Effect ${effect.intentId} prepared with policy ${decision.action}.`,
    `writes=${effect.writes.length}`,
    `deletes=${effect.deletes.length}`,
    `process=${effect.processSpawn.length}`,
    `egress=${effect.networkEgress.length + effect.humanVisibleSend.length}`,
  ].join(' ');
}
