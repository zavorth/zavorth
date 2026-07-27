import type {
  ZavorthContextRecoveryInput,
  ZavorthContextRecoverySnapshot,
} from './ZavorthContextRecoveryAssimilationContract.js';
import type { ZavorthReasoningActionPatternActionKind } from './ZavorthReasoningActionPatternContract.js';

export const ZAVORTH_TOOL_ORCHESTRATION_VERIFICATION_CONTRACT_VERSION =
  '2026-05-11.tool-orchestration-verification-gate-4' as const;

export type ZavorthToolOrchestrationVerificationStatus =
  | 'ready'
  | 'verification-required'
  | 'approval-required'
  | 'needs-setup'
  | 'blocked';

export type ZavorthToolRouteKind =
  | 'direct_answer'
  | 'file_read'
  | 'web_evidence'
  | 'skill_context'
  | 'skill_absorption'
  | 'subagent_team'
  | 'browser_observation'
  | 'computer_observation'
  | 'android_observation'
  | 'workspace_mutation'
  | 'command_execution'
  | 'external_delivery'
  | 'safe_recovery';

export type ZavorthToolRouteDecision =
  | 'allow_readonly'
  | 'allow_after_verification'
  | 'require_approval'
  | 'setup_required'
  | 'deny';

export type ZavorthToolRouteRisk = 'safe' | 'review' | 'dangerous' | 'forbidden';

export type ZavorthToolVerificationKind =
  | 'evidence_check'
  | 'policy_receipt'
  | 'source_citation'
  | 'doctor_check'
  | 'smoke_check'
  | 'screenshot_check'
  | 'test_check'
  | 'rollback_check'
  | 'user_confirmation';

export type ZavorthToolVerificationStatus = 'planned' | 'satisfied' | 'blocked';

export type ZavorthToolVerificationEvidence = {
  routeKind?: ZavorthToolRouteKind | null;
  source: string;
  summary: string;
  trusted?: boolean | null;
};

export type ZavorthToolOrchestrationVerificationInput = ZavorthContextRecoveryInput & {
  verificationEvidence?: ZavorthToolVerificationEvidence[] | null;
  completedChecks?: string[] | null;
};

export type ZavorthToolRoute = {
  id: string;
  kind: ZavorthToolRouteKind;
  title: string;
  surface: 'conversation' | 'files' | 'web' | 'skills' | 'subagents' | 'browser' | 'computer' | 'android' | 'workspace' | 'shell' | 'external';
  decision: ZavorthToolRouteDecision;
  risk: ZavorthToolRouteRisk;
  fromActionKinds: ZavorthReasoningActionPatternActionKind[];
  reason: string;
  target: string | null;
  readOnly: boolean;
  liveImpact: boolean;
  requiresApproval: boolean;
  requiresSetup: boolean;
  requiresVerification: boolean;
};

export type ZavorthToolVerificationItem = {
  id: string;
  routeId: string;
  kind: ZavorthToolVerificationKind;
  status: ZavorthToolVerificationStatus;
  source: string;
  evidenceRequired: string[];
  passCondition: string;
  commandHint: string | null;
  blocksCompletion: boolean;
};

export type ZavorthToolFinalAnswerGuard = {
  canAnswerNow: boolean;
  canClaimCompletion: boolean;
  finalEvidencePolicy: 'none_required' | 'cite_evidence' | 'verification_first' | 'blocked';
  requiredDisclosures: string[];
  prohibitedClaims: string[];
};

export type ZavorthToolOrchestrationReceipt = {
  id: string;
  kind:
    | 'gate-4-route-plan'
    | 'verification-plan'
    | 'approval-boundary'
    | 'setup-boundary'
    | 'blocked-route'
    | 'final-answer-guard';
  status: 'recorded' | 'requires-verification' | 'requires-approval' | 'blocked';
  summary: string;
  routeIds: string[];
};

export type ZavorthToolOrchestrationVerificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_TOOL_ORCHESTRATION_VERIFICATION_CONTRACT_VERSION;
  source: 'ZavorthToolOrchestrationVerificationService';
  gate: 'tool-orchestration-verification';
  status: ZavorthToolOrchestrationVerificationStatus;
  request: {
    surface: string;
    actorId: string | null;
    textPreview: string;
    rawSecretsSerialized: false;
  };
  contextRecovery: ZavorthContextRecoverySnapshot;
  routes: ZavorthToolRoute[];
  verification: ZavorthToolVerificationItem[];
  finalAnswerGuard: ZavorthToolFinalAnswerGuard;
  receipts: ZavorthToolOrchestrationReceipt[];
  safety: {
    noToolExecutionPerformed: true;
    policyDecisionInheritedFromStage3: true;
    noLiveImpactWithoutApproval: true;
    verificationRequiredBeforeCompletion: true;
    untrustedToolOutputRequiresEvidenceBoundary: true;
    noZavorthControlVisualMutation: true;
    rawSecretsSerialized: false;
  };
  summary: {
    routes: number;
    readonlyRoutes: number;
    approvalRoutes: number;
    setupRoutes: number;
    deniedRoutes: number;
    verificationItems: number;
    satisfiedVerification: number;
    blockingVerification: number;
    receipts: number;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-tool-orchestration-verification.ts --text "<request>"';
    json: 'npx tsx scripts/zavorth-tool-orchestration-verification.ts --json --text "<request>"';
    check: 'node scripts/zavorth-tool-orchestration-verification-check.mjs';
    nextAction: 'Credential vault - Cross-Surface Runtime Projection Assimilation';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
