import type {
  ZavorthUniversalSkillExpansionQaSeverity,
  ZavorthUniversalSkillExpansionQaStatus,
} from './ZavorthUniversalSkillExpansionQaContract.js';
import type { ZavorthUniversalSkillRealSourceOnboardingSnapshot } from './ZavorthUniversalSkillRealSourceOnboardingContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_SCALE_HARDENING_CONTRACT_VERSION =
  '2026-05-10.checkpoint-9' as const;

export type ZavorthUniversalSkillScaleHardeningStatus =
  ZavorthUniversalSkillExpansionQaStatus;

export type ZavorthUniversalSkillScaleBand =
  | 'empty'
  | 'small'
  | 'medium'
  | 'large'
  | 'massive';

export type ZavorthUniversalSkillScaleGate = {
  id: string;
  label: string;
  status: ZavorthUniversalSkillScaleHardeningStatus;
  severity: ZavorthUniversalSkillExpansionQaSeverity;
  observed: number | string | boolean;
  target: string;
  summary: string;
};

export type ZavorthUniversalSkillScaleBatch = {
  id: string;
  sourceLabel: string;
  sourcePath: string;
  batchIndex: number;
  totalBatchesForSource: number;
  candidateStart: number;
  candidateEnd: number;
  candidateEstimate: number;
  recommendedMode: 'preview' | 'limited-apply' | 'hold';
  approvalRequired: true;
};

export type ZavorthUniversalSkillDashboardReviewItem = {
  id: string;
  label: string;
  surface: 'summary-card' | 'table' | 'filter' | 'action-row' | 'empty-state' | 'alert';
  status: ZavorthUniversalSkillScaleHardeningStatus;
  priority: 'high' | 'medium' | 'low';
  evidence: string;
  visualChangeProposed: boolean;
  ownerApprovalRequired: true;
};

export type ZavorthUniversalSkillZavorthControlReviewItem = ZavorthUniversalSkillDashboardReviewItem;

export type ZavorthUniversalSkillScaleHardeningSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_SCALE_HARDENING_CONTRACT_VERSION;
  status: ZavorthUniversalSkillScaleHardeningStatus;
  projectRoot: string;
  channel: string;
  onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
  capacity: {
    scaleBand: ZavorthUniversalSkillScaleBand;
    candidateCount: number;
    includedSourceCount: number;
    batchSize: number;
    batchCount: number;
    largeLibraryThreshold: number;
    massiveLibraryThreshold: number;
  };
  gates: ZavorthUniversalSkillScaleGate[];
  batches: ZavorthUniversalSkillScaleBatch[];
  dashboardReview: {
    contractOnly: true;
    approvedVisualChangesApplied: false;
    layoutMutationPerformed: false;
    items: ZavorthUniversalSkillDashboardReviewItem[];
    recommendedDataEndpoint: '/api/skills/scale-hardening';
  };
  zavorthControlReview?: {
    contractOnly: true;
    approvedVisualChangesApplied: false;
    layoutMutationPerformed: false;
    items: ZavorthUniversalSkillZavorthControlReviewItem[];
    recommendedDataEndpoint: '/api/skills/scale-hardening';
  };
  rollout: {
    readyForLargeLibraryUse: boolean;
    recommendedMode: 'preview' | 'limited-apply' | 'canary-apply' | 'hold';
    nextActions: string[];
  };
  report: {
    persisted: boolean;
    path: string | null;
    rawSecretsSerialized: false;
  };
  policy: {
    dashboardControlsOnboardingIsAuthority: true;
    previewFirstForLargeLibraries: true;
    batchApplyRequiresExplicitAllowlist: true;
    canaryBeforeBulkApply: true;
    dashboardReviewDoesNotChangeVisuals: true;
    noVisualChangeWithoutOwnerApproval: true;
    noExecutionPerformed: true;
    noDirectUpstreamRuntimeUse: true;
    noRawSecretsSerialized: true;
  };
  commands: {
    run: 'npm run zavorth:universal-skill-scale-hardening -- --discover';
    runJson: 'npm run zavorth:universal-skill-scale-hardening:json -- --discover';
    check: 'npm run zavorth:universal-skill-scale-hardening:check --silent';
    nextStage: 'Intent model0 - Approved Dashboard Implementation and Live Scale Canary';
  };
};
