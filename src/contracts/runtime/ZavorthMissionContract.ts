import type { ZavorthGuidedMissionTemplateId } from '../ZavorthFirstRunProductJourneyContract.js';
import type { ZavorthSandboxMutationMode } from '../ZavorthSandboxReadinessContract.js';

export type ZavorthMissionStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'needs_approval'
  | 'dry_run'
  | 'completed'
  | 'blocked';

export type ZavorthMissionRiskLevel = 'low' | 'medium' | 'high';

export type ZavorthMissionEvidenceKind =
  | 'test_result'
  | 'file_snapshot'
  | 'git_diff'
  | 'process_exit'
  | 'service_probe'
  | 'artifact_digest'
  | 'approval_record'
  | 'executor_claim';

export type ZavorthMissionCompletionCriterion = {
  id: string;
  description: string;
  requiredEvidence: Exclude<ZavorthMissionEvidenceKind, 'executor_claim'>[];
  minimumEvidenceCount: number;
};

export type ZavorthMissionBoundary = {
  workspaceRoots: string[];
  allowedFilePatterns: string[];
  deniedFilePatterns: string[];
  allowedServices: string[];
  networkAccess: 'denied' | 'read_only' | 'approved_writes';
  maximumDurationMs: number | null;
};

export type ZavorthMissionDefinition = {
  objective: string;
  expectedOutcome: string;
  completionCriteria: ZavorthMissionCompletionCriterion[];
  boundaries: ZavorthMissionBoundary;
  approvalRequirements: Array<{
    id: string;
    description: string;
    requiredBefore: string;
  }>;
  verificationRequirements: string[];
  stopConditions: string[];
  rollbackPlan: string | null;
};

export type ZavorthMissionEvidence = {
  id: string;
  criterionId: string;
  kind: ZavorthMissionEvidenceKind;
  observedBy: 'verifier' | 'runtime' | 'policy_broker' | 'executor';
  capturedAt: string;
  status: 'passed' | 'failed' | 'observed';
  summary: string;
  digest: string | null;
  details: Record<string, string | number | boolean | null>;
};

export type ZavorthMissionVerificationStatus = 'verified' | 'failed' | 'inconclusive';

export type ZavorthMissionVerificationReceipt = {
  schemaVersion: 1;
  surface: 'mission-verification';
  missionId: string;
  verifiedAt: string;
  status: ZavorthMissionVerificationStatus;
  criteria: Array<{
    criterionId: string;
    status: ZavorthMissionVerificationStatus;
    acceptedEvidenceIds: string[];
    rejectedEvidenceIds: string[];
    reason: string;
  }>;
  evidenceDigest: string;
  executorClaimsAccepted: false;
};

export type ZavorthMissionTimelineEvent = {
  id: string;
  at: string;
  status: 'done' | 'pending' | 'blocked';
  title: string;
  summary: string;
};

export type ZavorthMissionApproval = {
  id: string;
  status: 'not_required' | 'pending' | 'approved' | 'denied';
  risk: ZavorthMissionRiskLevel;
  prompt: string;
  options: Array<'allow_once' | 'deny' | 'view_preview' | 'view_rollback'>;
};

export type ZavorthMissionArtifact = {
  id: string;
  kind: 'preview' | 'report' | 'receipt' | 'rollback';
  label: string;
  status: 'expected' | 'ready' | 'blocked';
};

export type ZavorthMissionContract = {
  schemaVersion: 1;
  surface: 'mission';
  id: string;
  templateId: ZavorthGuidedMissionTemplateId;
  title: string;
  request: string;
  source: 'cli' | 'web' | 'channel' | 'scheduler' | 'internal';
  status: ZavorthMissionStatus;
  risk: ZavorthMissionRiskLevel;
  execution: {
    readOnly: boolean;
    mutationMode: ZavorthSandboxMutationMode;
    zavorthControlCanExecute: false;
    policyBrokerRequired: true;
  };
  timeline: ZavorthMissionTimelineEvent[];
  approvals: ZavorthMissionApproval[];
  artifacts: ZavorthMissionArtifact[];
  receiptId: string;
  nextAction: string;
  definition?: ZavorthMissionDefinition;
};
