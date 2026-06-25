import type {
  AiFirstRouteNextSafeAction,
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from './AiFirstRoutePlanContract.js';
import type { AiFirstShadowRouterRecommendation } from './AiFirstShadowRouterContract.js';
import type {
  UniversalIntentCategory,
  UniversalIntentNextSafeAction,
  UniversalIntentSideEffect,
} from '../runtime/uni/UniversalIntentContracts.js';

export const AI_FIRST_POLICY_GUARDRAIL_CONTRACT_VERSION = '2026-05-06.checkpoint-3' as const;

export type AiFirstPolicyGuardrailStatus = 'pass' | 'hold' | 'block';

export type AiFirstPolicyGuardrailMismatchKind =
  | 'plan-invalid'
  | 'risk-understated'
  | 'approval-missing'
  | 'preview-missing'
  | 'clarification-required'
  | 'trust-blocked'
  | 'shadow-high-divergence'
  | 'shadow-medium-divergence'
  | 'next-action-mismatch'
  | 'execution-attempt';

export type AiFirstPolicyGuardrailMismatchSeverity = 'info' | 'low' | 'medium' | 'high';

export type AiFirstPolicyGuardrailMismatch = {
  id: string;
  kind: AiFirstPolicyGuardrailMismatchKind;
  severity: AiFirstPolicyGuardrailMismatchSeverity;
  detail: string;
  aiFirst: string;
  deterministic: string;
};

export type AiFirstPolicyGuardrailReceipt = {
  id: string;
  kind: 'policy' | 'preview' | 'permission' | 'shadow' | 'block' | 'receipt';
  detail: string;
};

export type AiFirstPolicyGuardrailSnapshot = {
  contractVersion: typeof AI_FIRST_POLICY_GUARDRAIL_CONTRACT_VERSION;
  source: 'ai-first-policy-guardrail';
  generatedAt: string;
  guardrailId: string;
  input: {
    surface: string;
    userMessage: string;
  };
  aiPlan: {
    accepted: boolean;
    intent: AiFirstRoutePlanIntent;
    risk: AiFirstRoutePlanRisk;
    nextSafeAction: AiFirstRouteNextSafeAction;
    requiresApproval: boolean;
    requiresPreview: boolean;
    canExecuteNow: false;
    requestedTools: string[];
  };
  shadow: {
    shadowId: string;
    totalDivergences: number;
    highDivergences: number;
    mediumDivergences: number;
    recommendation: AiFirstShadowRouterRecommendation['action'];
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
  };
  deterministicPolicy: {
    intent: UniversalIntentCategory;
    risk: AiFirstRoutePlanRisk;
    sideEffect: UniversalIntentSideEffect;
    requiresClarification: boolean;
    requiresPermission: boolean;
    permissionKind: string | null;
    approvalRequired: boolean;
    previewRequired: boolean;
    nextSafeAction: UniversalIntentNextSafeAction;
    trustBlocked: boolean;
    trustPosture: string;
    matchedSignals: string[];
  };
  preview: {
    mode: 'runtime-preview' | 'preview-only';
    highestRisk: AiFirstRoutePlanRisk | 'unknown';
    requiresApproval: boolean;
    previewRequired: boolean;
    noExecutionPerformed: true;
    executorBlockedInPreviewMode: boolean;
    toolsActuallyCalled: [];
  };
  mismatches: AiFirstPolicyGuardrailMismatch[];
  summary: {
    totalMismatches: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  decision: {
    status: AiFirstPolicyGuardrailStatus;
    action:
      | 'allow-shadow-sample'
      | 'hold-for-divergence'
      | 'ask-clarification'
      | 'block-promotion';
    reason: string;
    sampleEligibleForPromotion: boolean;
    canExecuteNow: false;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
  };
  receipts: AiFirstPolicyGuardrailReceipt[];
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
