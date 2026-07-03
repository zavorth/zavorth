import type { ZavorthCrossSurfaceProjectionSurface } from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type {
  ZavorthOperationalRolloutEvalInput,
  ZavorthOperationalRolloutEvalSnapshot,
} from './ZavorthOperationalRolloutEvalContract.js';

export const ZAVORTH_UX_ROLLOUT_EVIDENCE_CANARY_CONTRACT_VERSION =
  '2026-05-11.ux-rollout-evidence-canary-checkpoint-7' as const;

export type ZavorthUxRolloutEvidenceCanaryStatus =
  | 'ready-for-dry-run-canary'
  | 'needs-evidence'
  | 'approval-required'
  | 'blocked';

export type ZavorthUxRolloutCanaryMode =
  | 'evidence_review'
  | 'dry_run_canary'
  | 'live_canary_review'
  | 'hold';

export type ZavorthUxEvidenceKind =
  | 'operator_note'
  | 'screenshot'
  | 'channel_transcript'
  | 'cli_output'
  | 'api_payload'
  | 'zavorthControl_snapshot';

export type ZavorthUxRolloutEvidenceInput = {
  id: string;
  scenarioId?: string | null;
  surface?: ZavorthCrossSurfaceProjectionSurface | 'all' | null;
  kind: ZavorthUxEvidenceKind;
  summary: string;
  source?: string | null;
  capturedAt?: string | null;
  trusted?: boolean | null;
};

export type ZavorthUxRolloutCanaryRequest = {
  mode?: 'dry_run' | 'live' | null;
  approvalId?: string | null;
  ownerConfirmed?: boolean | null;
};

export type ZavorthUxRolloutEvidenceCanaryInput = {
  rolloutEval?: ZavorthOperationalRolloutEvalInput | null;
  evidence?: ZavorthUxRolloutEvidenceInput[] | null;
  canaryRequest?: ZavorthUxRolloutCanaryRequest | null;
  requireEvidenceForAllSurfaces?: boolean | null;
  minEvidenceItems?: number | null;
};

export type ZavorthUxEvidenceReviewStatus =
  | 'accepted'
  | 'missing'
  | 'untrusted'
  | 'redacted'
  | 'out-of-scope';

export type ZavorthUxEvidenceReview = {
  id: string;
  scenarioId: string;
  surface: ZavorthCrossSurfaceProjectionSurface | 'all';
  status: ZavorthUxEvidenceReviewStatus;
  evidenceIds: string[];
  summary: string;
  recommendation: string | null;
};

export type ZavorthUxEvidenceSanitizedItem = {
  id: string;
  scenarioId: string | null;
  surface: ZavorthCrossSurfaceProjectionSurface | 'all' | null;
  kind: ZavorthUxEvidenceKind;
  source: string;
  capturedAt: string | null;
  trusted: boolean;
  redacted: boolean;
  summaryPreview: string;
};

export type ZavorthUxRolloutCanaryPlan = {
  mode: ZavorthUxRolloutCanaryMode;
  dryRunReady: boolean;
  liveReviewReady: boolean;
  liveApprovalRequired: boolean;
  approvalAccepted: boolean;
  executionPrepared: false;
  executionPerformed: false;
  reasons: string[];
  nextActions: string[];
};

export type ZavorthUxRolloutReceipt = {
  id: string;
  kind:
    | 'checkpoint-7-ux-evidence-review'
    | 'evidence-redaction'
    | 'canary-plan'
    | 'live-approval-boundary'
    | 'visual-change-boundary'
    | 'no-persistence-boundary';
  status: 'recorded' | 'attention' | 'requires-approval' | 'blocked';
  summary: string;
};

export type ZavorthUxRolloutSafety = {
  evidenceOnly: true;
  noLiveActionExecuted: true;
  noZavorthControlVisualMutation: true;
  noZavorthControlVisualMutation: true;
  liveCanaryRequiresOwnerApproval: true;
  evidenceMustBeRedacted: true;
  evidenceNotPersistedByDefault: true;
  noExternalProviderRequired: true;
  rawSecretsSerialized: false;
};

export type ZavorthUxRolloutEvidenceCanarySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UX_ROLLOUT_EVIDENCE_CANARY_CONTRACT_VERSION;
  source: 'ZavorthUxRolloutEvidenceCanaryService';
  phase: 'checkpoint-7-ux-rollout-evidence-canary';
  status: ZavorthUxRolloutEvidenceCanaryStatus;
  rolloutEval: ZavorthOperationalRolloutEvalSnapshot;
  sanitizedEvidence: ZavorthUxEvidenceSanitizedItem[];
  evidenceReviews: ZavorthUxEvidenceReview[];
  canaryPlan: ZavorthUxRolloutCanaryPlan;
  receipts: ZavorthUxRolloutReceipt[];
  safety: ZavorthUxRolloutSafety;
  summary: {
    scenarios: number;
    surfaces: number;
    evidenceItems: number;
    acceptedReviews: number;
    missingReviews: number;
    untrustedReviews: number;
    redactedEvidenceItems: number;
    canaryMode: ZavorthUxRolloutCanaryMode;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts';
    json: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts --json';
    check: 'node scripts/zavorth-ux-rollout-evidence-canary-check.mjs';
    nextStage: 'ZavorthControl controls - Live Canary Execution Adapter Review';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
