import type {
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from './AiFirstRoutePlanContract.js';
import type { AiFirstShadowBatchReadiness } from './AiFirstShadowBatchRecorderContract.js';

export const AI_FIRST_PROMOTION_CANDIDATE_REGISTRY_CONTRACT_VERSION = '2026-05-06.checkpoint-5' as const;

export type AiFirstPromotionCandidateStatus = 'eligible' | 'watch' | 'blocked';

export type AiFirstPromotionAllowlistStatus = 'proposed' | 'withheld';

export type AiFirstPromotionRegistryReadiness =
  | 'ready-for-manual-canary'
  | 'continue-shadow'
  | 'blocked';

export type AiFirstPromotionRegistryAction =
  | 'prepare-limited-promotion-plan'
  | 'collect-more-samples'
  | 'investigate-blocks'
  | 'reject-promotion';

export type AiFirstPromotionCandidateCriteria = {
  requireBatchCandidate: boolean;
  minFamilySamples: number;
  minFamilyPassRate: number;
  maxFamilyBlocks: number;
  maxFamilyHighMismatchSamples: number;
  maxFamilyHighShadowDivergenceSamples: number;
  eligibleRiskLevels: AiFirstRoutePlanRisk[];
};

export type AiFirstPromotionCandidateEntry = {
  id: string;
  familyId: AiFirstRoutePlanIntent;
  status: AiFirstPromotionCandidateStatus;
  samples: number;
  pass: number;
  hold: number;
  block: number;
  passRate: number;
  highMismatchSamples: number;
  highShadowDivergenceSamples: number;
  allowedSurfaces: string[];
  observedRiskLevels: AiFirstRoutePlanRisk[];
  allowlistRouteKey: string;
  reason: string;
};

export type AiFirstPromotionAllowlistEntry = {
  id: string;
  routeKey: string;
  familyId: AiFirstRoutePlanIntent;
  status: AiFirstPromotionAllowlistStatus;
  surfaces: string[];
  allowedRiskLevels: AiFirstRoutePlanRisk[];
  maxRisk: AiFirstRoutePlanRisk;
  requiresStage3Guardrail: true;
  requiresBatchReceipt: true;
  requiresManualActivation: true;
  defaultEnabled: false;
  canExecuteNow: false;
  reason: string;
};

export type AiFirstPromotionPlanStep = {
  order: number;
  id: string;
  kind:
    | 'keep-default-runtime'
    | 'register-allowlist-proposal'
    | 'manual-canary-review'
    | 'continue-shadow'
    | 'investigate-blocks';
  status: 'planned';
  detail: string;
};

export type AiFirstPromotionCandidateRegistrySnapshot = {
  contractVersion: typeof AI_FIRST_PROMOTION_CANDIDATE_REGISTRY_CONTRACT_VERSION;
  source: 'ai-first-promotion-candidate-registry';
  generatedAt: string;
  registryId: string;
  input: {
    registryName: string;
    batchId: string;
    batchName: string;
    batchReadiness: AiFirstShadowBatchReadiness;
    batchCriteriaPassed: boolean;
    sampleCount: number;
  };
  criteria: AiFirstPromotionCandidateCriteria;
  candidates: AiFirstPromotionCandidateEntry[];
  allowlist: AiFirstPromotionAllowlistEntry[];
  promotionPlan: AiFirstPromotionPlanStep[];
  summary: {
    totalFamilies: number;
    eligibleFamilies: number;
    watchFamilies: number;
    blockedFamilies: number;
    proposedAllowlistEntries: number;
    withheldAllowlistEntries: number;
  };
  recommendation: {
    readiness: AiFirstPromotionRegistryReadiness;
    action: AiFirstPromotionRegistryAction;
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    canExecuteNow: false;
    activateAutomatically: false;
  };
  receipts: Array<{
    id: string;
    kind: 'registry' | 'allowlist' | 'promotion-plan' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
