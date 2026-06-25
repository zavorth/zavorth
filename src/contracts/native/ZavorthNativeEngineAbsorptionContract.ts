import type {
  ZavorthExternalContractLayerStatus,
} from './ZavorthExternalContractLayerContract.js';
import type {
  ZavorthExternalRuntimeNaturalFirstRoute,
} from './ZavorthExternalRuntimeBridgeContract.js';

export const ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION =
  'zavorth-native-engine-absorption/2' as const;

export type ZavorthNativeEngineAbsorptionStatus =
  | 'native-engine-ready'
  | 'attention'
  | 'blocked';

export type ZavorthNativeEngineFeatureId =
  | 'error-recovery-classifier'
  | 'tool-call-argument-repair'
  | 'safe-tool-parallelism'
  | 'procedural-memory-signal'
  | 'skill-library-curation';

export type ZavorthNativeEngineRisk = 'low' | 'medium' | 'high' | 'critical';

export type ZavorthErrorRecoveryCategory =
  | 'rate_limit'
  | 'billing_or_quota'
  | 'context_overflow'
  | 'permission'
  | 'credential_or_auth'
  | 'tool_argument_syntax'
  | 'typecheck_failure'
  | 'test_failure'
  | 'dependency_failure'
  | 'port_conflict'
  | 'destructive_intent'
  | 'runtime_failure'
  | 'unknown';

export type ZavorthErrorRecoveryStrategy =
  | 'retry_with_backoff'
  | 'stop_for_provider_configuration'
  | 'compress_or_summarize_context'
  | 'request_operator_approval'
  | 'use_secret_ref_or_reauthenticate'
  | 'repair_tool_arguments'
  | 'inspect_and_patch_code'
  | 'inspect_test_failure'
  | 'check_dependency_surface'
  | 'choose_alternate_port'
  | 'block_and_require_approval'
  | 'diagnose_with_minimal_context';

export type ZavorthErrorRecoveryReceipt = {
  category: ZavorthErrorRecoveryCategory;
  strategy: ZavorthErrorRecoveryStrategy;
  risk: ZavorthNativeEngineRisk;
  confidence: number;
  retryAllowed: boolean;
  approvalRequired: boolean;
  summary: string;
  signals: string[];
  nextSafeAction: string;
  safety: {
    noCommandExecution: true;
    noProviderCall: true;
    noAutoApproval: true;
  };
};

export type ZavorthToolArgumentRepairStatus = 'valid' | 'repaired' | 'blocked';

export type ZavorthToolArgumentRepairReceipt = {
  toolName: string;
  status: ZavorthToolArgumentRepairStatus;
  repairedArguments: Record<string, unknown> | null;
  repairsApplied: string[];
  blockedReasons: string[];
  dangerousIntentDetected: boolean;
  approvalRequiredForLive: boolean;
  parserFirst: true;
  authorityAdded: false;
  safety: {
    noToolExecution: true;
    noApprovalBypass: true;
    noNewAuthorityAdded: true;
  };
};

export type ZavorthToolResourceAccess = 'read' | 'write' | 'delete' | 'unknown';

export type ZavorthToolParallelismTask = {
  id: string;
  toolName: string;
  resourceRefs: Array<{
    kind: 'file' | 'directory' | 'network' | 'process' | 'unknown';
    ref: string;
    access: ZavorthToolResourceAccess;
  }>;
};

export type ZavorthToolParallelismBatch = {
  batchId: string;
  taskIds: string[];
  mode: 'parallel' | 'serial';
  reason: string;
};

export type ZavorthToolParallelismReceipt = {
  status: 'planned' | 'blocked';
  tasks: ZavorthToolParallelismTask[];
  batches: ZavorthToolParallelismBatch[];
  conflicts: Array<{
    leftTaskId: string;
    rightTaskId: string;
    resourceRef: string;
    reason: string;
  }>;
  safety: {
    unknownResourcesSerialize: true;
    sameWriteSetSerializes: true;
    noToolExecution: true;
  };
};

export type ZavorthProceduralMemoryOutcome = 'success' | 'failure' | 'workaround' | 'blocked';

export type ZavorthProceduralMemorySignalReceipt = {
  status: 'ready' | 'blocked';
  signalId: string;
  outcome: ZavorthProceduralMemoryOutcome;
  sanitizedCommand: string;
  lesson: string;
  evidence: string[];
  shouldStore: boolean;
  retentionHint: 'short' | 'medium' | 'long';
  safety: {
    provenanceRequired: true;
    secretValuesRedacted: true;
    noMemoryWritePerformed: true;
    correctOrForgetRequired: true;
  };
};

export type ZavorthSkillCurationProposalAction =
  | 'keep'
  | 'merge'
  | 'archive'
  | 'quarantine-review'
  | 'extract-reference';

export type ZavorthSkillCurationInput = {
  id: string;
  name: string;
  filePath: string;
  description: string;
  usageCount: number;
  failureCount: number;
  pinned: boolean;
  tags: string[];
};

export type ZavorthSkillCurationProposal = {
  proposalId: string;
  action: ZavorthSkillCurationProposalAction;
  skillIds: string[];
  reason: string;
  approvalRequired: boolean;
  rollbackRequired: boolean;
};

export type ZavorthSkillCurationPreviewReceipt = {
  status: 'preview-ready' | 'blocked';
  proposals: ZavorthSkillCurationProposal[];
  pinnedSkillIds: string[];
  dryRunDiffCount: number;
  safety: {
    dryRunOnly: true;
    noSkillMutationPerformed: true;
    approvalRequiredBeforeMutation: true;
    rollbackSnapshotRequired: true;
  };
};

export type ZavorthNativeEngineFeatureSpec = {
  id: ZavorthNativeEngineFeatureId;
  contractName: string;
  serviceMethod: string;
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  risk: ZavorthNativeEngineRisk;
  receiptKind: string;
  acceptanceGate: string;
  observability: {
    emitsReceipt: true;
    dashboardProjection: string;
    noSourceRuntimeDependency: true;
  };
};

export type ZavorthNativeEngineAbsorptionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION;
  status: ZavorthNativeEngineAbsorptionStatus;
  planId: 'Zavorth External Runtime Integration';
  phase: 'native-engine-absorption';
  previousContractLayerStatus: ZavorthExternalContractLayerStatus;
  features: ZavorthNativeEngineFeatureSpec[];
  fixtureReceipts: {
    errorClassifier: ZavorthErrorRecoveryReceipt;
    toolArgumentRepair: ZavorthToolArgumentRepairReceipt;
    toolParallelism: ZavorthToolParallelismReceipt;
    proceduralMemory: ZavorthProceduralMemorySignalReceipt;
    skillCuration: ZavorthSkillCurationPreviewReceipt;
  };
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    features: number;
    receipts: number;
    approvalGatedFeatures: number;
    blockedFixtures: number;
    sourceRuntimeDependency: false;
    executionPerformed: false;
    toolsExecuted: false;
    memoryWritesPerformed: false;
    skillMutationsPerformed: false;
  };
  safety: {
    sourceRuntimeCodeExecuted: false;
    sidecarsStarted: false;
    toolExecutionPerformed: false;
    providerCallsPerformed: false;
    memoryWritesPerformed: false;
    skillMutationsPerformed: false;
    approvalBypassAllowed: false;
  };
  commands: {
    inspect: 'npm run zavorth:native-engine-absorption';
    inspectJson: 'npm run zavorth:native-engine-absorption:json';
    check: 'npm run zavorth:native-engine-absorption:check --silent';
    nextStage: '291 Approval gate - Sidecar Adapter';
  };
};
