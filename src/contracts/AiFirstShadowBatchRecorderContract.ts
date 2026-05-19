import type {
  AiFirstPolicyGuardrailMismatchKind,
  AiFirstPolicyGuardrailStatus,
} from './AiFirstPolicyGuardrailContract.js';
import type {
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from './AiFirstRoutePlanContract.js';
import type { UniversalIntentCategory } from '../runtime/uni/UniversalIntentContracts.js';

export const AI_FIRST_SHADOW_BATCH_RECORDER_CONTRACT_VERSION = '2026-05-06.checkpoint-4' as const;

export type AiFirstShadowBatchReadiness = 'candidate' | 'needs-more-samples' | 'not-ready';

export type AiFirstShadowBatchRecommendationAction =
  | 'eligible-for-limited-promotion'
  | 'continue-shadow'
  | 'collect-more-samples'
  | 'investigate-blocks';

export type AiFirstShadowBatchPromotionCriteria = {
  minSamples: number;
  minPassRate: number;
  maxBlockRate: number;
  maxHighMismatchRate: number;
  maxHighShadowDivergenceRate: number;
  requireNoExecutionAttempts: boolean;
  requireNoSecretLeaks: boolean;
};

export type AiFirstShadowBatchSampleSummary = {
  sampleId: string;
  guardrailId: string;
  surface: string;
  status: AiFirstPolicyGuardrailStatus;
  action: string;
  sampleEligibleForPromotion: boolean;
  aiIntent: AiFirstRoutePlanIntent;
  aiRisk: AiFirstRoutePlanRisk;
  deterministicIntent: UniversalIntentCategory;
  deterministicRisk: AiFirstRoutePlanRisk;
  shadowHighDivergences: number;
  shadowMediumDivergences: number;
  mismatchCount: number;
  highMismatchCount: number;
  mediumMismatchCount: number;
  mismatchKinds: AiFirstPolicyGuardrailMismatchKind[];
  requestedTools: string[];
  canExecuteNow: false;
};

export type AiFirstShadowBatchFamilyAggregate = {
  familyId: AiFirstRoutePlanIntent;
  samples: number;
  pass: number;
  hold: number;
  block: number;
  passRate: number;
  highMismatchSamples: number;
  highShadowDivergenceSamples: number;
};

export type AiFirstShadowBatchMismatchAggregate = {
  kind: AiFirstPolicyGuardrailMismatchKind;
  total: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

export type AiFirstShadowBatchPromotionScore = {
  sampleCount: number;
  passRate: number;
  holdRate: number;
  blockRate: number;
  highMismatchRate: number;
  highShadowDivergenceRate: number;
  executionAttemptCount: number;
  secretLeakDetected: boolean;
  criteriaPassed: boolean;
  failedCriteria: string[];
};

export type AiFirstShadowBatchRecorderSnapshot = {
  contractVersion: typeof AI_FIRST_SHADOW_BATCH_RECORDER_CONTRACT_VERSION;
  source: 'ai-first-shadow-batch-recorder';
  generatedAt: string;
  batchId: string;
  input: {
    profile: 'default' | 'promotion-candidate' | 'custom';
    batchName: string;
    sampleCount: number;
  };
  samples: AiFirstShadowBatchSampleSummary[];
  statusCounts: {
    pass: number;
    hold: number;
    block: number;
  };
  familyAggregates: AiFirstShadowBatchFamilyAggregate[];
  mismatchAggregates: AiFirstShadowBatchMismatchAggregate[];
  criteria: AiFirstShadowBatchPromotionCriteria;
  score: AiFirstShadowBatchPromotionScore;
  recommendation: {
    readiness: AiFirstShadowBatchReadiness;
    action: AiFirstShadowBatchRecommendationAction;
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    canExecuteNow: false;
  };
  receipts: Array<{
    id: string;
    kind: 'batch' | 'criteria' | 'policy' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
