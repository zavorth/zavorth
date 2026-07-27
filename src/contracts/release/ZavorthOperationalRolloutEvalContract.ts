import type {
  ZavorthCrossSurfaceProjectionSurface,
  ZavorthCrossSurfaceRuntimeProjectionInput,
  ZavorthCrossSurfaceRuntimeProjectionSnapshot,
} from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type { ZavorthToolOrchestrationVerificationStatus } from '../ZavorthToolOrchestrationVerificationContract.js';

export const ZAVORTH_OPERATIONAL_ROLLOUT_EVAL_CONTRACT_VERSION =
  '2026-05-11.operational-rollout-eval-gate-6' as const;

export type ZavorthOperationalRolloutEvalStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthOperationalRolloutMode = 'dry_run_canary' | 'observe_only' | 'hold';

export type ZavorthOperationalRolloutScenarioKind =
  | 'verification_required'
  | 'approval_required'
  | 'needs_setup'
  | 'ready'
  | 'blocked'
  | 'custom';

export type ZavorthOperationalRolloutEvalInput = {
  projectionSurfaces?: ZavorthCrossSurfaceProjectionSurface[] | null;
  scenarios?: ZavorthOperationalRolloutScenarioInput[] | null;
  includeDefaultScenarios?: boolean | null;
  strict?: boolean | null;
};

export type ZavorthOperationalRolloutScenarioInput =
  Omit<ZavorthCrossSurfaceRuntimeProjectionInput, 'projectionSurfaces'> & {
    id: string;
    kind?: ZavorthOperationalRolloutScenarioKind | null;
    expectedStatus: ZavorthToolOrchestrationVerificationStatus;
    description?: string | null;
  };

export type ZavorthOperationalRolloutEvalFinding = {
  id: string;
  scenarioId: string;
  surface?: ZavorthCrossSurfaceProjectionSurface | 'all' | null;
  severity: 'pass' | 'warning' | 'fail';
  code:
    | 'status-consistency'
    | 'semantic-consistency'
    | 'required-action'
    | 'fallback-coverage'
    | 'api-projection'
    | 'zavorthControl-boundary'
    | 'no-live-action'
    | 'telegram-not-privileged'
    | 'scenario-contract';
  summary: string;
  recommendation: string | null;
};

export type ZavorthOperationalRolloutScenarioEval = {
  id: string;
  kind: ZavorthOperationalRolloutScenarioKind;
  description: string;
  expectedStatus: ZavorthToolOrchestrationVerificationStatus;
  observedStatus: ZavorthToolOrchestrationVerificationStatus;
  status: ZavorthOperationalRolloutEvalStatus;
  rolloutRecommendation: ZavorthOperationalRolloutMode;
  score: number;
  surfaces: ZavorthCrossSurfaceProjectionSurface[];
  actionCoverage: {
    requiredActionKind: 'verification' | 'approval' | 'setup' | 'primary' | 'blocked';
    coveredSurfaces: number;
    expectedSurfaces: number;
  };
  findings: ZavorthOperationalRolloutEvalFinding[];
  projectionDigest: {
    cardCount: number;
    actionCount: number;
    fallbackSurfaces: number;
    buttonSurfaces: number;
    zavorthControlVisualMutation: boolean;
    noLiveActionExecuted: true;
  };
};

export type ZavorthOperationalRolloutSurfaceCoverage = {
  surface: ZavorthCrossSurfaceProjectionSurface;
  scenarios: number;
  passed: number;
  warnings: number;
  failures: number;
  requiredFallbackPresent: boolean;
  interactiveWhenSupported: boolean;
};

export type ZavorthOperationalRolloutReceipt = {
  id: string;
  kind:
    | 'gate-6-operational-eval'
    | 'scenario-eval'
    | 'surface-coverage'
    | 'rollout-decision'
    | 'visual-change-boundary'
    | 'continuous-eval-boundary';
  status: 'recorded' | 'attention' | 'blocked';
  summary: string;
};

export type ZavorthOperationalRolloutSafety = {
  noLiveActionExecuted: true;
  noZavorthControlVisualMutation: true;
  projectionsOnly: true;
  noExternalProviderRequired: true;
  ownerApprovalRequiredForRolloutChange: true;
  continuousEvalDoesNotPersistByDefault: true;
  rawSecretsSerialized: false;
};

export type ZavorthOperationalRolloutEvalSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_OPERATIONAL_ROLLOUT_EVAL_CONTRACT_VERSION;
  source: 'ZavorthOperationalRolloutEvalService';
  gate: 'operational-rollout-eval';
  status: ZavorthOperationalRolloutEvalStatus;
  rolloutMode: ZavorthOperationalRolloutMode;
  strict: boolean;
  scenarioEvals: ZavorthOperationalRolloutScenarioEval[];
  surfaceCoverage: ZavorthOperationalRolloutSurfaceCoverage[];
  projectionSamples: Array<{
    scenarioId: string;
    projection: Pick<
      ZavorthCrossSurfaceRuntimeProjectionSnapshot,
      'status' | 'summary' | 'safety' | 'zavorthControlProjection' | 'narrative'
    >;
  }>;
  receipts: ZavorthOperationalRolloutReceipt[];
  safety: ZavorthOperationalRolloutSafety;
  summary: {
    scenarios: number;
    passedScenarios: number;
    attentionScenarios: number;
    blockedScenarios: number;
    surfaces: number;
    findings: number;
    warnings: number;
    failures: number;
    score: number;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-operational-rollout-eval.ts';
    json: 'npx tsx scripts/zavorth-operational-rollout-eval.ts --json';
    check: 'node scripts/zavorth-operational-rollout-eval-check.mjs';
    nextAction: 'Surface controls - UX Rollout Evidence And Live Canary Review';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
