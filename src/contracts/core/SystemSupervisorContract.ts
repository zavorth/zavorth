export type SystemSupervisorExecutionProfile = 'safe' | 'trusted' | 'dangerous' | 'owner';
export type SystemOverlordExecutionProfile = SystemSupervisorExecutionProfile;

export type SystemSupervisorAutonomyLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type SystemOverlordAutonomyLevel = SystemSupervisorAutonomyLevel;

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
export type SystemOverlordCapability = SystemSupervisorCapability;

export type SystemSupervisorRuntimeTarget =
  | 'host'
  | 'container'
  | 'microvm'
  | 'wsl'
  | 'node'
  | 'browser'
  | 'desktop';
export type SystemOverlordRuntimeTarget = SystemSupervisorRuntimeTarget;

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
export type SystemOverlordActionStatus = SystemSupervisorActionStatus;

export type SystemSupervisorRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SystemOverlordRiskLevel = SystemSupervisorRiskLevel;

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
export type SystemOverlordActionRequest = SystemSupervisorActionRequest;

export type SystemSupervisorCapabilityDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  riskLevel: SystemSupervisorRiskLevel;
  target: SystemSupervisorRuntimeTarget;
  auditTrail: string[];
};
export type SystemOverlordCapabilityDecision = SystemSupervisorCapabilityDecision;

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
export type SystemOverlordExecutionResult = SystemSupervisorExecutionResult;

export type SystemSupervisorActionRecord = {
  actionId: string;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  profile: SystemSupervisorExecutionProfile;
  autonomyLevel: SystemSupervisorAutonomyLevel;
  capability: SystemSupervisorCapability;
  target: SystemSupervisorRuntimeTarget;
  riskLevel: SystemSupervisorRiskLevel;
  command?: string | null;
  workspace?: string | null;
  objective?: string | null;
  status: SystemSupervisorActionStatus;
  startedAt: string;
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
};
export type SystemOverlordActionRecord = SystemSupervisorActionRecord;

export type SystemSupervisorExecutionGatewayOptions = {
  defaultProfile?: SystemSupervisorExecutionProfile;
  defaultAutonomyLevel?: SystemSupervisorAutonomyLevel;
  requireApprovalForDangerous?: boolean;
  killSwitchEnabled?: boolean;
  workspaceRoot?: string;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};
export type SystemOverlordExecutionGatewayOptions = SystemSupervisorExecutionGatewayOptions;
