import type { ZavorthCrossSurfaceProjectionSurface } from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type {
  ZavorthUxRolloutEvidenceCanaryInput,
  ZavorthUxRolloutEvidenceCanarySnapshot,
} from './ZavorthUxRolloutEvidenceCanaryContract.js';

export const ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION =
  '2026-05-11.live-canary-execution-adapter-review-gate-8' as const;

export type ZavorthLiveCanaryAdapterReviewStatus =
  | 'adapter-reviewed'
  | 'needs-evidence'
  | 'approval-required'
  | 'blocked';

export type ZavorthLiveCanaryAdapterMode =
  | 'live-review-envelope'
  | 'approval-gate'
  | 'evidence-gate'
  | 'hold';

export type ZavorthLiveCanaryAdapterActionKind =
  | 'api_invoke'
  | 'channel_send'
  | 'webhook_call'
  | 'provider_call'
  | 'workspace_mutation'
  | 'command_exec';

export type ZavorthLiveCanaryAdapterInput = {
  id: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  actionKind: ZavorthLiveCanaryAdapterActionKind;
  target: string;
  impactDescription: string;
  policyScope: string;
  rollbackPlan?: string | null;
  dryRunReplayCommand?: string | null;
  timeoutMs?: number | null;
};

export type ZavorthLiveCanaryExecutionAdapterReviewInput = {
  evidenceCanary?: ZavorthUxRolloutEvidenceCanaryInput | null;
  adapter?: ZavorthLiveCanaryAdapterInput | null;
  ownerApproval?: {
    approvalId?: string | null;
    ownerConfirmed?: boolean | null;
  } | null;
  requireRollback?: boolean | null;
};

export type ZavorthLiveCanaryAdapterCheck = {
  id: string;
  status: 'pass' | 'fail';
  kind:
    | 'lower-phase-live-review'
    | 'owner-approval'
    | 'rollback-boundary'
    | 'scope-boundary'
    | 'dry-run-replay'
    | 'timeout-boundary'
    | 'execution-disabled'
    | 'visual-boundary';
  summary: string;
  recommendation: string | null;
};

export type ZavorthLiveCanaryExecutionEnvelope = {
  adapterId: string;
  mode: ZavorthLiveCanaryAdapterMode;
  surface: ZavorthCrossSurfaceProjectionSurface;
  actionKind: ZavorthLiveCanaryAdapterActionKind;
  targetPreview: string;
  policyScope: string;
  rollbackPlanPresent: boolean;
  dryRunReplayCommand: string | null;
  preparedForReview: boolean;
  executionEnabled: false;
  executionPerformed: false;
  requiresFinalHumanTrigger: true;
  receiptsRequiredBeforeExecution: true;
};

export type ZavorthLiveCanaryAdapterReviewReceipt = {
  id: string;
  kind:
    | 'gate-8-live-canary-adapter-review'
    | 'lower-phase-boundary'
    | 'owner-approval-boundary'
    | 'rollback-boundary'
    | 'execution-disabled-boundary'
    | 'visual-change-boundary';
  status: 'recorded' | 'requires-approval' | 'blocked';
  summary: string;
};

export type ZavorthLiveCanaryAdapterReviewSafety = {
  reviewOnly: true;
  noLiveActionExecuted: true;
  noExternalImpact: true;
  executionDisabledUntilFinalTrigger: true;
  ownerApprovalRequired: true;
  rollbackRequiredBeforeLive: true;
  noZavorthControlVisualMutation: true;
  rawSecretsSerialized: false;
};

export type ZavorthLiveCanaryExecutionAdapterReviewSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION;
  source: 'ZavorthLiveCanaryExecutionAdapterReviewService';
  gate: 'live-canary-execution-adapter-review';
  status: ZavorthLiveCanaryAdapterReviewStatus;
  mode: ZavorthLiveCanaryAdapterMode;
  evidenceCanary: ZavorthUxRolloutEvidenceCanarySnapshot;
  adapter: ZavorthLiveCanaryAdapterInput;
  checks: ZavorthLiveCanaryAdapterCheck[];
  executionEnvelope: ZavorthLiveCanaryExecutionEnvelope;
  receipts: ZavorthLiveCanaryAdapterReviewReceipt[];
  safety: ZavorthLiveCanaryAdapterReviewSafety;
  summary: {
    checks: number;
    passedChecks: number;
    failedChecks: number;
    rollbackPresent: boolean;
    approvalAccepted: boolean;
    liveReviewReady: boolean;
    executionEnabled: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts';
    json: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json';
    check: 'node scripts/zavorth-live-canary-adapter-review-check.mjs';
    nextAction: 'Certification matrix - Live Canary Apply Gate And Rollback Drill';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
