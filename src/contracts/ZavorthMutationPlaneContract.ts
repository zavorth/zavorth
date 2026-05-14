export type ZavorthMutationDomain =
  | 'rollout'
  | 'setup'
  | 'trust'
  | 'watch'
  | 'eval'
  | 'automation'
  | 'sandbox'
  | 'skill-evolution'
  | 'replay-learning'
  | 'federated-mesh'
  | 'workspace-canvas'
  | 'hardware'
  | 'autonomous-partner'
  | 'selfmod'
  | 'capability';

export type ZavorthMutationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ZavorthMutationStatus =
  | 'draft'
  | 'waiting_approval'
  | 'approved'
  | 'applied'
  | 'blocked'
  | 'expired';

export type ZavorthApprovalScope = 'once' | 'session' | 'host';

export type ZavorthReadinessGateStatus = 'passed' | 'warning' | 'failed' | 'blocked';

export type ZavorthResourceImpact = {
  ramMb: number;
  diskMb: number;
  processCount: number;
  externalExposure: 'none' | 'local' | 'network' | 'public';
  recurring: boolean;
  notes: string[];
};

export type ZavorthApprovalDescriptor = {
  required: boolean;
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  defaultScope: ZavorthApprovalScope;
  availableScopes: ZavorthApprovalScope[];
  permissionId: string | null;
  requestedBy: string | null;
  reason: string;
};

export type ZavorthRetentionPolicy = {
  ttlMs: number | null;
  maxBytes: number | null;
  cleanupOnSuccess: boolean;
  cleanupOnBoot: boolean;
  notes: string[];
};

export type ZavorthSandboxProfile =
  | 'none'
  | 'process'
  | 'container'
  | 'gvisor'
  | 'firecracker'
  | 'remote-node'
  | 'wasm';

export type ZavorthCapabilityRunEnvelope = {
  id: string;
  capabilityId: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  mode: 'preview' | 'dry-run' | 'apply' | 'replay' | 'verify';
  trustDecisionId: string | null;
  budget: {
    cpuCores: number;
    memoryMb: number;
    diskMb: number;
    maxDurationMs: number;
    maxNetworkCalls: number;
    maxFilesystemWrites: number;
    maxProcesses: number;
    maxInvocations: number;
  };
  sandboxProfile: ZavorthSandboxProfile;
  networkPolicy: 'none' | 'allowlisted' | 'internet-readonly' | 'full-with-approval';
  filesystemPolicy: {
    tempWorkspaceOnly: boolean;
    hostMountsReadOnly: boolean;
    deniedHostWrite: boolean;
    allowlistedMounts: string[];
    artifactCollection: 'none' | 'explicit';
  };
  inputRefs: string[];
  outputRefs: string[];
  cleanupPlan: {
    killOnTimeout: boolean;
    removeWorkspace: boolean;
    removeContainerOrVm: boolean;
    ttlMs: number;
    notes: string[];
  };
  auditId: string;
  riskLevel: ZavorthMutationRiskLevel;
  status: 'planned' | 'waiting_approval' | 'blocked' | 'ready';
  reasons: string[];
};

export type ZavorthLearningArtifactKind =
  | 'preference'
  | 'procedure'
  | 'debug-pattern'
  | 'coding-style'
  | 'skill-candidate'
  | 'replay-summary'
  | 'digital-twin-profile'
  | 'skill-draft'
  | 'sandbox-evidence'
  | 'eval-evidence'
  | 'skill-installation';

export type ZavorthLearningArtifact = {
  id: string;
  kind: ZavorthLearningArtifactKind;
  status: 'draft' | 'tested' | 'previewed' | 'approved' | 'installed' | 'blocked' | 'rolled_back' | 'revoked';
  createdAt: string;
  updatedAt: string;
  source: {
    domain: 'skill-evolution' | 'replay-learning' | 'manual';
    surface: string | null;
    requestedBy: string | null;
    originRef: string | null;
  };
  subject: {
    name: string;
    version: string;
    summary: string;
    riskLevel: ZavorthMutationRiskLevel;
  };
  evidence: Array<{
    id: string;
    kind: 'sandbox' | 'eval' | 'scanner' | 'operator' | 'registry' | 'replay' | 'redaction';
    status: 'passed' | 'warning' | 'failed' | 'skipped';
    summary: string;
    ref: string | null;
    metadata?: Record<string, unknown>;
  }>;
  retention: ZavorthRetentionPolicy;
  redaction: {
    rawTranscriptPersisted: boolean;
    rawSecretsPersisted: false;
    notes: string[];
  };
  hashes: {
    intentHash: string;
    contentHash: string;
  };
};

export type ZavorthReadinessGate = {
  id: string;
  status: ZavorthReadinessGateStatus;
  canProceed: boolean;
  scope: string;
  reasons: string[];
  warnings: string[];
  blockers: string[];
  checkedAt: string;
  budgets?: Record<string, unknown>;
  evidence?: Array<{
    id: string;
    label: string;
    status: string;
    summary: string;
    command?: string | null;
    updatedAt?: string | null;
  }>;
  nextActions?: string[];
};

export type ZavorthMutationPlan = {
  id: string;
  domain: ZavorthMutationDomain;
  actionId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  payloadHash: string;
  status: ZavorthMutationStatus;
  requestedBy: string | null;
  sourceSurface: string | null;
  riskLevel: ZavorthMutationRiskLevel;
  approval: ZavorthApprovalDescriptor;
  resourceImpact: ZavorthResourceImpact;
  readinessGates: ZavorthReadinessGate[];
  retentionPolicy: ZavorthRetentionPolicy;
  validationPlan: string[];
  rollbackPlan: string[];
  payload: Record<string, unknown>;
  audit: Array<{
    at: string;
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type ZavorthMutationExecution = {
  generatedAt: string;
  planId: string;
  status: 'applied' | 'blocked' | 'failed';
  ok: boolean;
  summary: string;
  appliedActions: string[];
  rollbackAvailable: boolean;
  plan: ZavorthMutationPlan;
};
