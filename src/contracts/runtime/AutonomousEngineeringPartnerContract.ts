import type {
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
} from './ZavorthMutationPlaneContract.js';
import type { TrustDecision } from '../services/TrustDecisionService.js';

export type ZavorthAutonomyLevel =
  | 'assist'
  | 'draft'
  | 'supervised'
  | 'delegated'
  | 'autonomous-with-budget';

export type AutonomousMissionStatus =
  | 'planned'
  | 'waiting_approval'
  | 'running'
  | 'paused'
  | 'completed'
  | 'blocked'
  | 'failed';

export type AutonomousMissionCheckpointStatus =
  | 'pending'
  | 'passed'
  | 'warning'
  | 'blocked'
  | 'skipped'
  | 'completed';

export type AutonomousMissionEvidenceKind =
  | 'test'
  | 'diff'
  | 'log'
  | 'artifact'
  | 'rollback'
  | 'eval'
  | 'sandbox'
  | 'approval'
  | 'checkpoint';

export type ZavorthAutonomyBudget = {
  scope: 'run' | 'session' | 'automation' | 'host' | 'fleet';
  maxActions: number;
  maxMutableActions: number;
  maxCost: number;
  maxDurationMs: number;
  maxNetworkCalls: number;
  maxFilesystemWrites: number;
  maxExternalDeliveries: number;
  pauseOnFailureCount: number;
  requiresHumanReviewAboveRisk: ZavorthMutationRiskLevel;
  expiresAt: string;
};

export type AutonomousMissionUsage = {
  actions: number;
  mutableActions: number;
  cost: number;
  durationMs: number;
  networkCalls: number;
  filesystemWrites: number;
  externalDeliveries: number;
  failures: number;
};

export type AutonomousMissionPolicy = {
  approvalRequired: boolean;
  approvalReason: string;
  applyMode: 'preview-only' | 'approval-gated' | 'budgeted-supervised';
  rolloutGateRequired: boolean;
  sandboxRequired: boolean;
  meshRoutingAllowed: boolean;
  canvasReviewRequired: true;
  automationAllowed: boolean;
  evalRegressionGateRequired: boolean;
  replayLearningAllowed: boolean;
  skillEvolutionAllowed: boolean;
  hardwareActionsAllowed: boolean;
  trustPlaneDomain: 'autonomous-partner';
};

export type AutonomousMissionCheckpoint = {
  id: string;
  label: string;
  plane: string;
  status: AutonomousMissionCheckpointStatus;
  required: boolean;
  summary: string;
  sourceRef: string | null;
  command: string | null;
  evidenceRefs: string[];
};

export type AutonomousMissionEvidence = {
  id: string;
  kind: AutonomousMissionEvidenceKind;
  status: 'pending' | 'passed' | 'warning' | 'failed' | 'skipped';
  summary: string;
  ref: string | null;
  createdAt: string;
};

export type AutonomousMissionResult = {
  status: 'completed' | 'blocked' | 'failed';
  summary: string;
  evidenceRefs: string[];
  tests: string[];
  diffs: string[];
  logs: string[];
  rollbackAvailable: boolean;
  rollbackPlan: string[];
  completedAt: string | null;
};

export type AutonomousMissionRecord = {
  id: string;
  objective: string;
  context: string | null;
  autonomyLevel: ZavorthAutonomyLevel;
  riskLevel: ZavorthMutationRiskLevel;
  status: AutonomousMissionStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  successCriteria: string[];
  budget: ZavorthAutonomyBudget;
  usage: AutonomousMissionUsage;
  policy: AutonomousMissionPolicy;
  plan: string[];
  checkpoints: AutonomousMissionCheckpoint[];
  evidence: AutonomousMissionEvidence[];
  mutationPlanId: string | null;
  trustDecision: TrustDecision | null;
  pauseReason: string | null;
  result: AutonomousMissionResult | null;
};

export type AutonomousPartnerAuditEntry = {
  id: string;
  at: string;
  missionId: string | null;
  event: string;
  status: AutonomousMissionStatus | 'noop';
  requestedBy: string | null;
  summary: string;
};

export type AutonomousPartnerState = {
  version: 1;
  updatedAt: string | null;
  missions: Record<string, AutonomousMissionRecord>;
  audit: AutonomousPartnerAuditEntry[];
};

export type AutonomousPartnerSourceHealth = {
  plane: string;
  status: 'healthy' | 'attention' | 'critical' | 'unavailable';
  summary: string;
  command: string;
};

export type AutonomousPartnerSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    missions: number;
    activeMissions: number;
    pausedMissions: number;
    blockedMissions: number;
    completedMissions: number;
    pendingMissionApprovals: number;
    sourcePlanes: number;
    unavailableSourcePlanes: number;
    heavyRuntimesStarted: false;
    coreIdle: boolean;
  };
  autonomyLevels: Array<{
    id: ZavorthAutonomyLevel;
    label: string;
    mutableByDefault: boolean;
    approvalRequired: boolean;
    summary: string;
  }>;
  policy: {
    missionControlOnly: true;
    directExecutionOnRead: false;
    mutableMissionsCreateMutationPlan: true;
    budgetPauseRequired: true;
    evidenceRequiredForCompletion: true;
    trustPlaneDomain: 'autonomous-partner';
    controlPlanes: string[];
  };
  missions: AutonomousMissionRecord[];
  sourceHealth: AutonomousPartnerSourceHealth[];
  pendingPlans: ZavorthMutationPlan[];
  audit: AutonomousPartnerAuditEntry[];
  actions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn' | 'critical';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export type AutonomousMissionDelegateInput = {
  objective: string;
  context?: string | null;
  autonomyLevel?: ZavorthAutonomyLevel | string | null;
  riskLevel?: ZavorthMutationRiskLevel | string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  successCriteria?: string[] | string | null;
  mutable?: boolean | null;
  budget?: Partial<ZavorthAutonomyBudget> | null;
};

export type AutonomousMissionDelegateResult = {
  generatedAt: string;
  status: AutonomousMissionStatus;
  ok: boolean;
  summary: string;
  mission: AutonomousMissionRecord;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
  readinessGate: ZavorthReadinessGate;
  snapshot: AutonomousPartnerSnapshot;
};

export type AutonomousMissionProgressInput = Partial<AutonomousMissionUsage> & {
  missionId: string;
  status?: AutonomousMissionStatus | null;
  evidence?: Partial<AutonomousMissionEvidence> | null;
  riskLevel?: ZavorthMutationRiskLevel | string | null;
  summary?: string | null;
  requestedBy?: string | null;
};

export type AutonomousMissionProgressResult = {
  generatedAt: string;
  status: AutonomousMissionStatus;
  ok: boolean;
  summary: string;
  blockers: string[];
  mission: AutonomousMissionRecord | null;
  snapshot: AutonomousPartnerSnapshot;
};
