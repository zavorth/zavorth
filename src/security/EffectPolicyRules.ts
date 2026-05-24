import type { Effect } from '../runtime/effects/Effect.js';
import { hasRealSideEffect, isReadOnlyEffect } from '../runtime/effects/Effect.js';
import { inferEffectRisk } from '../runtime/effects/EffectRisk.js';
import { summarizeEffect } from '../runtime/effects/EffectAnalyzer.js';
import { normalizeEffectPolicyContext, type EffectPolicyContext } from './EffectPolicyContext.js';
import {
  createSecurityEffectPolicyDecision,
  type SecurityEffectPolicyDecision,
} from './EffectPolicyDecision.js';

export const EFFECT_POLICY_RULES = {
  ALLOW_OBSERVATION: 'effect/allow-observation',
  DRAFT_ONLY: 'effect/draft-only',
  DENY_SECRET_EGRESS: 'effect/deny-secret-egress',
  DENY_UNTRUSTED_SIDE_EFFECT: 'effect/deny-untrusted-side-effect',
  REQUIRE_ADMIN_SECRET: 'effect/require-admin-secret',
  REQUIRE_CONFIRMATION_DANGEROUS: 'effect/require-confirmation-dangerous',
  SANDBOX_MUTATION: 'effect/sandbox-mutation',
  REQUIRE_CONFIRMATION_EGRESS_OR_PERSISTENCE: 'effect/require-confirmation-egress-or-persistence',
} as const;

export function evaluateEffectPolicyRules(
  effect: Effect,
  context: EffectPolicyContext = {},
): SecurityEffectPolicyDecision {
  const normalized = normalizeEffectPolicyContext(context);
  const risk = inferEffectRisk(effect);
  const effectSummary = summarizeEffect(effect, risk);

  if (effect.secretAccess.length > 0 && effect.networkEgress.length > 0) {
    return createSecurityEffectPolicyDecision({
      action: 'deny',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.DENY_SECRET_EGRESS,
      reasons: ['Secret access combined with network egress is forbidden at the effect boundary.'],
      receiptRequired: true,
    });
  }

  if (effect.sourceTrust === 'untrusted-content' && hasRealSideEffect(effect)) {
    return createSecurityEffectPolicyDecision({
      action: 'deny',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.DENY_UNTRUSTED_SIDE_EFFECT,
      reasons: ['Untrusted content may be evidence, but it cannot authorize writes, shell, network, sends or persistence.'],
      receiptRequired: true,
    });
  }

  if (isReadOnlyEffect(effect)) {
    if (effect.reversibility === 'draft_only') {
      return createSecurityEffectPolicyDecision({
        action: 'draft_only',
        risk,
        effectSummary,
        rule: EFFECT_POLICY_RULES.DRAFT_ONLY,
        reasons: ['Draft-only output has no host effect and must not be committed directly.'],
        receiptRequired: false,
      });
    }
    return createSecurityEffectPolicyDecision({
      action: normalized.redactionApplied ? 'allow_with_redaction' : 'allow',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.ALLOW_OBSERVATION,
      reasons: ['Read-only observation has no real side effect.'],
      receiptRequired: false,
    });
  }

  if (effect.secretAccess.length > 0 && !normalized.adminPolicyPresent) {
    return createSecurityEffectPolicyDecision({
      action: 'require_admin_policy',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.REQUIRE_ADMIN_SECRET,
      reasons: ['Secret access requires an explicit admin policy before execution.'],
      receiptRequired: true,
      approvalRequired: false,
    });
  }

  if (
    effect.deletes.length > 0
    || effect.processSpawn.length > 0
    || effect.humanVisibleSend.length > 0
    || effect.reversibility === 'irreversible'
  ) {
    return createSecurityEffectPolicyDecision({
      action: normalized.approvalPresent ? 'sandbox_only' : 'require_user_confirmation',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.REQUIRE_CONFIRMATION_DANGEROUS,
      reasons: ['Dangerous or irreversible effects require human confirmation before execution.'],
      receiptRequired: true,
      approvalRequired: !normalized.approvalPresent,
      rollbackRequired: effect.reversibility !== 'irreversible',
    });
  }

  if (effect.networkEgress.length > 0 || effect.persistence.length > 0) {
    return createSecurityEffectPolicyDecision({
      action: normalized.approvalPresent ? 'sandbox_only' : 'require_user_confirmation',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.REQUIRE_CONFIRMATION_EGRESS_OR_PERSISTENCE,
      reasons: ['Network egress or persistence is governed and requires explicit confirmation.'],
      receiptRequired: true,
      approvalRequired: !normalized.approvalPresent,
      rollbackRequired: effect.reversibility === 'rollback_available',
    });
  }

  if (effect.writes.length > 0) {
    return createSecurityEffectPolicyDecision({
      action: normalized.sandboxAvailable ? 'sandbox_only' : 'require_user_confirmation',
      risk,
      effectSummary,
      rule: EFFECT_POLICY_RULES.SANDBOX_MUTATION,
      reasons: ['Workspace mutations must rehearse in sandbox before commit.'],
      receiptRequired: true,
      approvalRequired: false,
      rollbackRequired: true,
    });
  }

  return createSecurityEffectPolicyDecision({
    action: 'require_user_confirmation',
    risk,
    effectSummary,
    rule: EFFECT_POLICY_RULES.REQUIRE_CONFIRMATION_DANGEROUS,
    reasons: ['Effect was not covered by a safe allow rule.'],
    receiptRequired: true,
    approvalRequired: true,
  });
}
