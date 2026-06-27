import type {
  IntelligenceExecutionProposal,
  IntelligenceFabricSnapshot,
  IntelligenceProposedAction,
  IntelligenceRiskLevel,
  IntelligenceTaskKind,
} from '../IntelligenceFabricContract.js';

export const AGENT_OS_CONTRACT_VERSION = 'zavorth-agent-os/v1' as const;

export type AgentOsStatus = 'passed' | 'warning' | 'blocked';

export type AgentOsProjectTwinSnapshot = {
  source: 'ProjectDigitalTwinService';
  workspaceRoot: string | null;
  generatedAt: string;
  freshness: 'missing' | 'fresh' | 'stale';
  rawSecretsSerialized: false;
  fileSummary: {
    totalIndexed: number;
    sourceFiles: number;
    testFiles: number;
    configFiles: number;
    sensitiveZones: string[];
  };
  packageSummary: {
    scripts: string[];
    dependencies: string[];
    devDependencies: string[];
  };
  moduleMap: Array<{ id: string; path: string; role: string }>;
  architecturePatterns: string[];
  receipts: string[];
};

export type AgentOsPermissionLease = {
  id: string;
  source: 'PermissionBrokerService';
  taskId: string;
  status: AgentOsStatus;
  expiresAt: string;
  allowedActions: IntelligenceProposedAction[];
  deniedActions: IntelligenceProposedAction[];
  hardBlocksPreserved: true;
  rawSecretsSerialized: false;
  receipts: string[];
};

export type AgentOsImpactSimulation = {
  id: string;
  source: 'ImpactSimulatorService';
  status: AgentOsStatus;
  sideEffectsApplied: false;
  affectedTargets: string[];
  recommendedTests: string[];
  rollbackRequired: boolean;
  rollbackAvailable: boolean;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  blockers: string[];
  warnings: string[];
  receipts: string[];
};

export type AgentOsImmuneSignal = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendedEscalation: 'none' | 'simulate' | 'approval' | 'sandbox' | 'block';
};

export type AgentOsImmuneSnapshot = {
  source: 'AgentImmuneSystemService';
  status: AgentOsStatus;
  cautionLevel: 'normal' | 'elevated' | 'strict' | 'blocked';
  thinkingBlocked: false;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  signals: AgentOsImmuneSignal[];
  receipts: string[];
};

export type AgentOsFutureCandidate = {
  id: 'minimal_safe' | 'balanced' | 'advanced';
  title: string;
  summary: string;
  riskLevel: IntelligenceRiskLevel;
  complexity: 'low' | 'medium' | 'high';
  maintenanceCost: 'low' | 'medium' | 'high';
  recommended: boolean;
  rejectedReason: string | null;
};

export type AgentOsFutureComparison = {
  source: 'FutureComparatorService';
  status: AgentOsStatus;
  selectedCandidateId: AgentOsFutureCandidate['id'];
  candidates: AgentOsFutureCandidate[];
  receipts: string[];
};

export type AgentOsReputationScore = {
  subjectType: 'model' | 'tool' | 'skill' | 'workflow' | 'capability' | 'policy';
  subjectId: string;
  taskKind: IntelligenceTaskKind | 'unknown';
  successRate: number;
  failureRate: number;
  securityWarningRate: number;
  rollbackRate: number;
  averageLatencyMs: number;
  recommendedFor: string[];
};

export type AgentOsReputationSnapshot = {
  source: 'ReputationScoreboardService';
  scores: AgentOsReputationScore[];
  hardBlocksCanBeOverridden: false;
  liveActivationAllowed: false;
  receipts: string[];
};

export type AgentOsArchitectureDecisionDraft = {
  source: 'ArchitectureDecisionRecorder';
  id: string;
  title: string;
  status: 'draft';
  decision: string;
  alternativesConsidered: string[];
  consequences: string[];
  filesWritten: false;
  requiresTransactionRuntime: true;
  rawSecretsSerialized: false;
};

export type AgentOsTransactionalPlan = {
  source: 'TransactionalExecutionService';
  transactionId: string;
  mutationPlanId: string | null;
  status: 'draft' | 'waiting_approval' | 'ready' | 'blocked';
  proposal: IntelligenceExecutionProposal;
  simulation: AgentOsImpactSimulation;
  permissionLease: AgentOsPermissionLease;
  liveActionApplied: false;
  commitRequiresRiskGate: true;
  rollbackRequired: boolean;
  rollbackPrepared: boolean;
  rollbackArtifactPath: string | null;
  receipts: string[];
};

export type AgentOsWorkspaceWrite = {
  path: string;
  content: string;
  actionId?: string | null;
  description?: string | null;
};

export type AgentOsTransactionalCommitResult = {
  source: 'TransactionalExecutionService';
  transactionId: string | null;
  mutationPlanId: string;
  status: 'applied' | 'blocked' | 'failed';
  liveActionApplied: boolean;
  summary: string;
  appliedActions: string[];
  touchedFiles: string[];
  rollbackAvailable: boolean;
  rollbackArtifactPath: string | null;
  blockedReasons: string[];
};

export type AgentOsDashboardSnapshot = {
  source: 'AgentOsDashboardProjection';
  title: string;
  status: AgentOsStatus;
  cards: Array<{ id: string; label: string; value: string; tone: 'ok' | 'warn' | 'danger' | 'info' }>;
  actions: Array<{ id: string; label: string; enabled: boolean; reason: string }>;
};

export type AgentOsZavorthControlProjection = {
  source: 'AgentOsZavorthControlProjection';
  title: string;
  status: AgentOsStatus;
  detailsHiddenByDefault: true;
  liveActionApplied: false;
  cards: AgentOsDashboardSnapshot['cards'];
  actions: AgentOsDashboardSnapshot['actions'];
};

export type AgentOsSnapshot = {
  contractVersion: typeof AGENT_OS_CONTRACT_VERSION;
  generatedAt: string;
  fabric: Pick<IntelligenceFabricSnapshot, 'classification' | 'executionProposal' | 'riskGate'>;
  projectTwin: AgentOsProjectTwinSnapshot;
  transaction: AgentOsTransactionalPlan;
  futureComparison: AgentOsFutureComparison;
  immuneSystem: AgentOsImmuneSnapshot;
  reputation: AgentOsReputationSnapshot;
  architectureDecision: AgentOsArchitectureDecisionDraft;
  dashboard: AgentOsDashboardSnapshot;
  zavorthControl: AgentOsZavorthControlProjection;
  safety: {
    thinkingBlocked: false;
    simulationHasSideEffects: false;
    rawSecretsSerialized: false;
    shadowDoesNotMutateRuntime: true;
    dangerousImpactRequiresGate: true;
  };
  receipts: string[];
};
