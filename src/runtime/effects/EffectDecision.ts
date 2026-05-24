export type EffectPolicyAction =
  | 'allow'
  | 'allow_with_redaction'
  | 'draft_only'
  | 'sandbox_only'
  | 'require_user_confirmation'
  | 'require_admin_policy'
  | 'deny';

export type EffectPolicyDecision = {
  action: EffectPolicyAction;
  allowed: boolean;
  reasons: string[];
  rule: string;
  receiptRequired: boolean;
  approvalRequired: boolean;
  rollbackRequired: boolean;
};

export function createEffectPolicyDecision(input: {
  action: EffectPolicyAction;
  reasons?: string[];
  rule?: string;
  receiptRequired?: boolean;
  approvalRequired?: boolean;
  rollbackRequired?: boolean;
}): EffectPolicyDecision {
  const allowed = input.action === 'allow' || input.action === 'allow_with_redaction';
  return {
    action: input.action,
    allowed,
    reasons: input.reasons?.length ? input.reasons : ['Effect policy decision created.'],
    rule: input.rule || 'effect-policy/default',
    receiptRequired: input.receiptRequired ?? input.action !== 'allow',
    approvalRequired: input.approvalRequired ?? input.action === 'require_user_confirmation',
    rollbackRequired: input.rollbackRequired ?? input.action === 'sandbox_only',
  };
}
