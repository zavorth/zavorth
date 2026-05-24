import type { Effect } from './Effect.js';
import type { EffectPolicyDecision } from './EffectDecision.js';
import { inferEffectRisk, type EffectRiskLevel } from './EffectRisk.js';

export type EffectReceipt = {
  kind: 'effect-receipt';
  version: 1;
  receiptId: string;
  generatedAt: string;
  intentId: string;
  action: EffectPolicyDecision['action'];
  allowed: boolean;
  risk: EffectRiskLevel;
  summary: string;
  rollbackRequired: boolean;
  approvalRequired: boolean;
  metadata?: Record<string, unknown>;
};

export function createEffectReceipt(input: {
  receiptId: string;
  generatedAt?: string;
  effect: Effect;
  decision: EffectPolicyDecision;
  summary: string;
  metadata?: Record<string, unknown>;
}): EffectReceipt {
  return {
    kind: 'effect-receipt',
    version: 1,
    receiptId: String(input.receiptId || '').trim(),
    generatedAt: input.generatedAt || new Date().toISOString(),
    intentId: input.effect.intentId,
    action: input.decision.action,
    allowed: input.decision.allowed,
    risk: inferEffectRisk(input.effect),
    summary: String(input.summary || '').trim(),
    rollbackRequired: input.decision.rollbackRequired,
    approvalRequired: input.decision.approvalRequired,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
