export type SystemSupervisorExecutionProfile = 'safe' | 'trusted' | 'dangerous' | 'owner';

export type SystemSupervisorAutonomyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type SystemSupervisorCapability =
  | 'host.shell'
  | 'host.files.write'
  | 'host.install'
  | 'desktop.automation'
  | 'browser.control'
  | 'docker.exec'
  | 'wsl.exec'
  | 'network.tunnel'
  | 'secrets.read'
  | 'node.invoke'
  | 'computer_use.visual_action';

export type SystemSupervisorRuntimeTarget =
  | 'host'
  | 'container'
  | 'microvm'
  | 'wsl'
  | 'node'
  | 'browser'
  | 'desktop';

export type SystemSupervisorActionStatus =
  | 'running'
  | 'blocked'
  | 'pending_approval'
  | 'dry_run'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'rejected';

export type SystemSupervisorRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SystemSupervisorApprovalDecision = 'approve' | 'deny' | 'reject';

export type SystemSupervisorActionRequest = {
  actionId?: string | null;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  profile?: SystemSupervisorExecutionProfile | null;
  autonomyLevel?: SystemSupervisorAutonomyLevel | null;
  capability: SystemSupervisorCapability;
  command?: string | null;
  workspace?: string | null;
  objective?: string | null;
  approved?: boolean;
  dryRun?: boolean;
  timeoutMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type SystemSupervisorCapabilityDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  riskLevel: SystemSupervisorRiskLevel;
  target: SystemSupervisorRuntimeTarget;
  runtimeTarget?: SystemSupervisorRuntimeTarget;
  blockedReason?: string | null;
  capability?: SystemSupervisorCapability;
  mutating?: boolean;
  profile?: SystemSupervisorExecutionProfile;
  requiredProfile?: SystemSupervisorExecutionProfile;
  autonomyLevel?: SystemSupervisorAutonomyLevel;
  requiredAutonomyLevel?: SystemSupervisorAutonomyLevel;
  auditTrail: string[];
};

export type SystemSupervisorExecutionResult = {
  actionId: string;
  success: boolean;
  exitCode?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  outputSummary?: string | null;
  auditTrail: string[];
  metadata?: Record<string, unknown> | null;
};

export type SystemSupervisorActionRecord = {
  actionId: string;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  profile: SystemSupervisorExecutionProfile;
  autonomyLevel: SystemSupervisorAutonomyLevel;
  capability: SystemSupervisorCapability;
  target: SystemSupervisorRuntimeTarget;
  runtimeTarget?: SystemSupervisorRuntimeTarget;
  riskLevel: SystemSupervisorRiskLevel;
  command?: string | null;
  workspace?: string | null;
  objective?: string | null;
  status: SystemSupervisorActionStatus;
  startedAt: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  requiresApproval: boolean;
  approved: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  result?: SystemSupervisorExecutionResult | null;
  error?: string | null;
  auditTrail: string[];
  metadata?: Record<string, unknown> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decision?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
  stdout?: string | null;
  stderr?: string | null;
  exitCode?: number | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  rollbackAvailable?: boolean;
};

export type SystemSupervisorProfileDescriptor = {
  profile: SystemSupervisorExecutionProfile;
  label: string;
  summary: string;
  defaultAutonomyLevel: SystemSupervisorAutonomyLevel;
};

export type SystemSupervisorCapabilityDescriptor = {
  capability: SystemSupervisorCapability;
  label: string;
  summary: string;
  riskLevel: SystemSupervisorRiskLevel;
  requiredProfile: SystemSupervisorExecutionProfile;
  requiredAutonomyLevel: SystemSupervisorAutonomyLevel;
  runtimeTarget: SystemSupervisorRuntimeTarget;
  approvalRequired: boolean;
  operatorNextStep: string;
};

export type SystemSupervisorAutonomyLevelDescriptor = {
  level: SystemSupervisorAutonomyLevel;
  label: string;
  summary: string;
  defaultProfile?: SystemSupervisorExecutionProfile;
  requiresApproval?: boolean;
  examples?: readonly string[] | string[];
};

export type SystemSupervisorApprovalQueueItem = {
  actionId: string;
  createdAt: string;
  requestedBy: string | null;
  surface: string | null;
  capability: SystemSupervisorCapability;
  command: string | null;
  reason: string;
  blockedReason: string | null;
  riskLevel: SystemSupervisorRiskLevel;
  requiredProfile: SystemSupervisorExecutionProfile;
  requiredAutonomyLevel: SystemSupervisorAutonomyLevel;
  runtimeTarget: SystemSupervisorRuntimeTarget;
  preview: {
    summary: string;
    objective: string | null;
    workspace: string | null;
    dryRun: boolean;
    approvalWillUpgradeProfile: boolean;
    approvalWillUpgradeAutonomy: boolean;
  };
  action: SystemSupervisorActionRecord;
};

export type SystemSupervisorKillSwitchState = {
  active: boolean;
  activatedAt: string | null;
  activatedBy: string | null;
  reason: string | null;
  releasedAt?: string | null;
  releasedBy?: string | null;
  activeActionCount?: number;
  cancellableActionCount?: number;
};

export type SystemSupervisorControlSnapshot = {
  generatedAt: string;
  summary: {
    capabilities: number;
    adapters: number;
    runningActions: number;
    pendingApprovals: number;
    blockedActions: number;
    completedActions: number;
    failedActions: number;
    timedOutActions: number;
    highestRecentRisk: SystemSupervisorRiskLevel | null;
    highestRiskLevel?: SystemSupervisorRiskLevel | null;
    recentActions?: number;
    killSwitchActive: boolean;
  };
  killSwitch: SystemSupervisorKillSwitchState;
  capabilities: SystemSupervisorCapabilityDescriptor[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapters: any[];
  approvalQueue: SystemSupervisorApprovalQueueItem[];
  recentActions: SystemSupervisorActionRecord[];
  profiles?: SystemSupervisorProfileDescriptor[];
  autonomyLevels?: SystemSupervisorAutonomyLevelDescriptor[];
  narrative?: {
    headline: string;
    operatorSummary: string;
  };
  nextSteps?: string;
};

export type SystemSupervisorActionMutationRequest = {
  actionId: string;
  requestedBy?: string | null;
  reason?: string | null;
};

export type SystemSupervisorActionMutationResult = {
  action: SystemSupervisorActionRecord | null;
  snapshot: SystemSupervisorControlSnapshot;
};

export type SystemSupervisorApprovalDecisionRequest = {
  actionId: string;
  decision: SystemSupervisorApprovalDecision;
  requestedBy?: string | null;
  reason?: string | null;
  dryRun?: boolean;
};

export type SystemSupervisorApprovalDecisionResult = {
  approval: SystemSupervisorActionRecord | null;
  snapshot: SystemSupervisorControlSnapshot;
};

export type SystemSupervisorKillSwitchToggleRequest = {
  active: boolean;
  requestedBy?: string | null;
  reason?: string | null;
  cancelActive?: boolean;
};

export type SystemSupervisorKillSwitchToggleResult = {
  killSwitch: SystemSupervisorKillSwitchState;
  affectedActions: SystemSupervisorActionRecord[];
  snapshot: SystemSupervisorControlSnapshot;
};

export type SystemSupervisorControlActionResult = {
  action: SystemSupervisorActionRecord;
  snapshot: SystemSupervisorControlSnapshot;
};

export type SystemSupervisorExecutionGatewayOptions = {
  defaultProfile?: SystemSupervisorExecutionProfile;
  defaultAutonomyLevel?: SystemSupervisorAutonomyLevel;
  requireApprovalForDangerous?: boolean;
  killSwitchEnabled?: boolean;
  workspaceRoot?: string;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};
