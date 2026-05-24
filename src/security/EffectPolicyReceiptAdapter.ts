import type { Effect } from '../runtime/effects/Effect.js';
import type { SecurityPolicyBrokerRequest } from './SecurityPolicyBroker.js';
import type { EffectPolicyContext } from './EffectPolicyContext.js';
import { normalizeEffectPolicyContext } from './EffectPolicyContext.js';
import type { SecurityEffectPolicyDecision } from './EffectPolicyDecision.js';

export function effectPolicyDecisionToBrokerRequest(input: {
  effect: Effect;
  decision: SecurityEffectPolicyDecision;
  context?: EffectPolicyContext;
}): SecurityPolicyBrokerRequest {
  const context = normalizeEffectPolicyContext(input.context || {});
  const decision = input.decision;
  return {
    surface: mapSurface(context.surface),
    operation: 'effect_boundary',
    target: input.effect.intentId || 'unknown-effect',
    workspace: context.workspace,
    sourceTrust: input.effect.sourceTrust,
    blocked: decision.action === 'deny',
    adminPolicyRequired: decision.action === 'require_admin_policy',
    userConfirmationRequired: decision.action === 'require_user_confirmation',
    risk: decision.risk === 'forbidden' ? 'forbidden' : decision.risk === 'danger' ? 'dangerous' : decision.risk === 'attention' ? 'review' : 'safe',
    rule: decision.rule,
    reasons: decision.reasons,
    redaction: {
      applied: decision.action === 'allow_with_redaction',
      findingCount: decision.action === 'allow_with_redaction' ? 1 : 0,
    },
    metadata: {
      ...context.metadata,
      effectPolicyKernelVersion: decision.kernelVersion,
      effectPolicyAction: decision.action,
      effectSummary: decision.effectSummary,
      rollbackRequired: decision.rollbackRequired,
      receiptRequired: decision.receiptRequired,
    },
  };
}

function mapSurface(surface: string): SecurityPolicyBrokerRequest['surface'] {
  const normalized = surface.toLowerCase();
  if (normalized.includes('tool')) {
    return 'tool';
  }
  if (normalized.includes('web') || normalized.includes('network')) {
    return 'web-fetch';
  }
  if (normalized.includes('workspace') || normalized.includes('effect')) {
    return 'workspace';
  }
  if (normalized.includes('provider') || normalized.includes('llm')) {
    return 'llm-egress';
  }
  return 'workspace';
}
