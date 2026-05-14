export type SystemOverlordExecutionProfile = 'safe' | 'trusted' | 'dangerous' | 'owner';

export type SystemOverlordAutonomyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type SystemOverlordCapability =
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

export type SystemOverlordRuntimeTarget =
  | 'host'
  | 'container'
  | 'microvm'
  | 'wsl'
  | 'node'
  | 'browser'
  | 'desktop';

export type SystemOverlordActionStatus =
  | 'running'
  | 'blocked'
  | 'pending_approval'
  | 'dry_run'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'rejected';

export type SystemOverlordRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SystemOverlordActionRequest = {
  actionId?: string | null;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  profile?: SystemOverlordExecutionProfile | null;
  autonomyLevel?: SystemOverlordAutonomyLevel | null;
  capability: SystemOverlordCapability;
  command?: string | null;
  workspace?: string | null;
  objective?: string | null;
  approved?: boolean;
  dryRun?: boolean;
  timeoutMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type SystemOverlordCapabilityDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  capability: SystemOverlordCapability;
  profile: SystemOverlordExecutionProfile;
  requiredProfile: SystemOverlordExecutionProfile;
  autonomyLevel: SystemOverlordAutonomyLevel;
  requiredAutonomyLevel: SystemOverlordAutonomyLevel;
  runtimeTarget: SystemOverlordRuntimeTarget;
  mutating: boolean;
  blockedReason?: string | null;
};

export type SystemOverlordActionRecord = {
  actionId: string;
  runId: string | null;
  requestedBy: string | null;
  surface: string | null;
  createdAt: string;
  updatedAt: string;
  status: SystemOverlordActionStatus;
  request: SystemOverlordActionRequest;
  decision: SystemOverlordCapabilityDecision;
  command: string | null;
  workspace: string | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  rollbackAvailable: boolean;
  metadata: Record<string, unknown>;
};

export type SystemOverlordProfileDescriptor = {
  profile: SystemOverlordExecutionProfile;
  label: string;
  summary: string;
  defaultAutonomyLevel: SystemOverlordAutonomyLevel;
};

export type SystemOverlordAutonomyLevelDescriptor = {
  level: SystemOverlordAutonomyLevel;
  label: string;
  summary: string;
  defaultProfile: SystemOverlordExecutionProfile;
  examples: string[];
  requiresApproval: boolean;
};

export type SystemOverlordCapabilityDescriptor = {
  capability: SystemOverlordCapability;
  label: string;
  summary: string;
  riskLevel: SystemOverlordRiskLevel;
  requiredProfile: SystemOverlordExecutionProfile;
  requiredAutonomyLevel: SystemOverlordAutonomyLevel;
  runtimeTarget: SystemOverlordRuntimeTarget;
  approvalRequired: boolean;
  operatorNextStep: string;
};

export type SystemOverlordAdapterDescriptor = {
  id: string;
  label: string;
};

export type SystemOverlordApprovalDecision = 'approve' | 'reject';

export type SystemOverlordKillSwitchState = {
  active: boolean;
  reason: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  activeActionCount: number;
  cancellableActionCount: number;
};

export type SystemOverlordApprovalQueueItem = {
  actionId: string;
  createdAt: string;
  requestedBy: string | null;
  surface: string | null;
  capability: SystemOverlordCapability;
  command: string | null;
  reason: string;
  blockedReason: string | null;
  riskLevel: SystemOverlordRiskLevel;
  requiredProfile: SystemOverlordExecutionProfile;
  requiredAutonomyLevel: SystemOverlordAutonomyLevel;
  runtimeTarget: SystemOverlordRuntimeTarget;
  preview: {
    summary: string;
    objective: string | null;
    workspace: string | null;
    dryRun: boolean;
    approvalWillUpgradeProfile: boolean;
    approvalWillUpgradeAutonomy: boolean;
  };
  action: SystemOverlordActionRecord;
};

export type SystemOverlordApprovalDecisionRequest = {
  actionId: string;
  decision: SystemOverlordApprovalDecision;
  requestedBy?: string | null;
  reason?: string | null;
  dryRun?: boolean | null;
};

export type SystemOverlordActionMutationRequest = {
  actionId: string;
  requestedBy?: string | null;
  reason?: string | null;
};

export type SystemOverlordKillSwitchToggleRequest = {
  active: boolean;
  requestedBy?: string | null;
  reason?: string | null;
  cancelActive?: boolean | null;
};

export type SystemOverlordControlSnapshot = {
  generatedAt: string;
  summary: {
    capabilities: number;
    adapters: number;
    recentActions: number;
    runningActions: number;
    pendingApprovals: number;
    blockedActions: number;
    completedActions: number;
    failedActions: number;
    timedOutActions: number;
    killSwitchActive: boolean;
    highestRiskLevel: SystemOverlordRiskLevel | null;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
  profiles: SystemOverlordProfileDescriptor[];
  autonomyLevels: SystemOverlordAutonomyLevelDescriptor[];
  capabilities: SystemOverlordCapabilityDescriptor[];
  adapters: SystemOverlordAdapterDescriptor[];
  killSwitch: SystemOverlordKillSwitchState;
  approvalQueue: SystemOverlordApprovalQueueItem[];
  recentActions: SystemOverlordActionRecord[];
};

export type SystemOverlordControlActionResult = {
  action: SystemOverlordActionRecord;
  snapshot: SystemOverlordControlSnapshot;
};

export type SystemOverlordApprovalDecisionResult = {
  approval: SystemOverlordActionRecord;
  snapshot: SystemOverlordControlSnapshot;
};

export type SystemOverlordActionMutationResult = {
  action: SystemOverlordActionRecord;
  snapshot: SystemOverlordControlSnapshot;
};

export type SystemOverlordKillSwitchToggleResult = {
  killSwitch: SystemOverlordKillSwitchState;
  affectedActions: SystemOverlordActionRecord[];
  snapshot: SystemOverlordControlSnapshot;
};
