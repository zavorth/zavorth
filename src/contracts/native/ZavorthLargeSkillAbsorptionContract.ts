import type { SecurityPolicyBrokerReceipt } from '../../security/SecurityPolicyBroker.js';
import type {
  ZavorthGovernedSubagentProfileId,
  ZavorthGovernedSubagentSnapshot,
} from '../ZavorthGovernedSubagentContract.js';
import type {
  ZavorthUniversalSkillCapabilityTag,
  ZavorthUniversalSkillCandidate,
  ZavorthUniversalSkillIntakeIssue,
  ZavorthUniversalSkillIntakePreview,
  ZavorthUniversalSkillPermissionProfileId,
  ZavorthUniversalSkillSourceKind,
} from '../ZavorthUniversalSkillIntakeContract.js';

export const ZAVORTH_LARGE_SKILL_ABSORPTION_CONTRACT_VERSION =
  '2026-05-10.large-skill-absorption-checkpoint-3' as const;

export type ZavorthLargeSkillAbsorptionStatus =
  | 'passed'
  | 'attention'
  | 'blocked';

export type ZavorthLargeSkillAbsorptionSourceInput = {
  sourcePath: string;
  sourceKind?: 'auto' | ZavorthUniversalSkillSourceKind;
  sourceLabel?: string | null;
};

export type ZavorthLargeSkillAbsorptionRiskBand =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type ZavorthLargeSkillAbsorptionSourceResult = {
  sourceId: string;
  sourcePath: string;
  sourceLabel: string;
  intakeStatus: ZavorthUniversalSkillIntakePreview['status'];
  intakePreview: ZavorthUniversalSkillIntakePreview;
  policyReceipt: SecurityPolicyBrokerReceipt;
  summary: {
    candidates: number;
    blockedCandidates: number;
    filesScanned: number;
    warnings: number;
    errors: number;
  };
};

export type ZavorthLargeSkillAbsorptionCandidateIndexEntry = {
  indexId: string;
  sourceId: string;
  candidateId: string;
  name: string;
  description: string;
  relativeSkillPath: string;
  status: ZavorthUniversalSkillCandidate['status'];
  blockedReason: string | null;
  contentHash: string;
  permissionProfileId: ZavorthUniversalSkillPermissionProfileId;
  capabilityTags: ZavorthUniversalSkillCapabilityTag[];
  supportFileCount: number;
  issueCount: number;
  riskScore: number;
  riskBand: ZavorthLargeSkillAbsorptionRiskBand;
  assignedSubagentRoleIds: ZavorthGovernedSubagentProfileId[];
  estimatedPromptChars: number;
  chunkCount: number;
  quarantineRequired: boolean;
};

export type ZavorthLargeSkillAbsorptionChunk = {
  chunkId: string;
  sourceId: string;
  candidateIndexId: string;
  ordinal: number;
  totalForCandidate: number;
  maxPromptChars: number;
  estimatedPromptChars: number;
  roleIds: ZavorthGovernedSubagentProfileId[];
  purpose: 'summarize' | 'risk-review' | 'normalize-plan' | 'qa';
};

export type ZavorthLargeSkillAbsorptionBatchStatus =
  | 'ready'
  | 'review-required'
  | 'quarantined'
  | 'blocked';

export type ZavorthLargeSkillAbsorptionBatch = {
  batchId: string;
  ordinal: number;
  status: ZavorthLargeSkillAbsorptionBatchStatus;
  candidateIndexIds: string[];
  chunkIds: string[];
  roleIds: ZavorthGovernedSubagentProfileId[];
  maxCandidates: number;
  estimatedPromptChars: number;
  reasons: string[];
};

export type ZavorthLargeSkillAbsorptionQuarantineEntry = {
  indexId: string;
  sourceId: string;
  candidateId: string;
  name: string;
  riskBand: ZavorthLargeSkillAbsorptionRiskBand;
  issues: ZavorthUniversalSkillIntakeIssue[];
  blockedReason: string | null;
  nextSafeAction: string;
};

export type ZavorthLargeSkillAbsorptionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LARGE_SKILL_ABSORPTION_CONTRACT_VERSION;
  status: ZavorthLargeSkillAbsorptionStatus;
  source: 'ZavorthLargeSkillAbsorptionService';
  projectRoot: string;
  mode: 'preview';
  sourceResults: ZavorthLargeSkillAbsorptionSourceResult[];
  governedSubagents: ZavorthGovernedSubagentSnapshot;
  candidateIndex: ZavorthLargeSkillAbsorptionCandidateIndexEntry[];
  chunks: ZavorthLargeSkillAbsorptionChunk[];
  batches: ZavorthLargeSkillAbsorptionBatch[];
  quarantine: ZavorthLargeSkillAbsorptionQuarantineEntry[];
  summary: {
    sources: number;
    candidates: number;
    indexedCandidates: number;
    blockedCandidates: number;
    quarantinedCandidates: number;
    chunks: number;
    batches: number;
    readyBatches: number;
    reviewRequiredBatches: number;
    blockedBatches: number;
    maxCoveragePercent: number;
    policyReceipts: number;
    subagentReceipts: number;
    importPerformed: false;
    executionPerformed: false;
    upstreamRuntimeUsed: false;
    workspaceMutationPerformed: false;
  };
  pipeline: {
    phases: Array<{
      id: string;
      label: string;
      roleIds: ZavorthGovernedSubagentProfileId[];
      status: 'ready' | 'approval-required' | 'blocked';
      output: string;
    }>;
    maxCandidatesPerBatch: number;
    maxPromptCharsPerChunk: number;
    maxSources: number;
    maxCandidates: number;
  };
  policy: {
    previewOnly: true;
    noImportPerformed: true;
    noExecutionPerformed: true;
    noUpstreamRuntimeUse: true;
    everyCandidateIndexedOrQuarantined: true;
    chunkingBeforeLlmContext: true;
    governedSubagentsRequired: true;
    policyReceiptsRequired: true;
    quarantineForBlockedCandidates: true;
    ownerApprovalRequiredBeforeMaterialization: true;
  };
  commands: {
    preview: 'npm run zavorth:large-skill-absorption -- --source <path>';
    previewJson: 'npm run zavorth:large-skill-absorption:json -- --source <path>';
    check: 'npm run zavorth:large-skill-absorption:check --silent';
    nextStage: 'Connector registry - Absorption Materialization and Bridge Handoff';
  };
};
