import type {
  EffectPolicyAction,
  EffectPolicyDecision as RuntimeEffectPolicyDecision,
} from '../runtime/effects/EffectDecision.js';

export type {
  EffectPolicyAction,
} from '../runtime/effects/EffectDecision.js';

export type SecurityEffectPolicyDecision = RuntimeEffectPolicyDecision & {
  kernelVersion: 'effect-policy-kernel/1';
  risk: 'safe' | 'attention' | 'danger' | 'forbidden';
  effectSummary: string;
};

export function createSecurityEffectPolicyDecision(input: {
  action: EffectPolicyAction;
  risk: SecurityEffectPolicyDecision['risk'];
  effectSummary: string;
  reasons: string[];
  rule: string;
  receiptRequired?: boolean;
  approvalRequired?: boolean;
  rollbackRequired?: boolean;
}): SecurityEffectPolicyDecision {
  const allowed = input.action === 'allow' || input.action === 'allow_with_redaction';
  return {
    kernelVersion: 'effect-policy-kernel/1',
    action: input.action,
    allowed,
    risk: input.risk,
    effectSummary: input.effectSummary,
    reasons: input.reasons,
    rule: input.rule,
    receiptRequired: input.receiptRequired ?? input.action !== 'allow',
    approvalRequired: input.approvalRequired ?? input.action === 'require_user_confirmation',
    rollbackRequired: input.rollbackRequired ?? input.action === 'sandbox_only',
  };
}
