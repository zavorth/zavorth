export type ZavorthControlAgentTeamCompilerRoleKind =
  | 'planner'
  | 'researcher'
  | 'implementer'
  | 'verifier'
  | 'provider-specialist'
  | 'safety-reviewer'
  | 'memory-curator'
  | 'operator-liaison';

export type ZavorthControlAgentTeamCompilerRole = {
  id: string;
  roleId: string;
  kind: ZavorthControlAgentTeamCompilerRoleKind;
  label: string;
  objective: string;
  why: string;
  dependsOn: string[];
  handoffTo: string[];
  capabilityIds: string[];
  toolIds: string[];
  provider: {
    providerLabel: string;
    modelLabel: string;
    candidateId: string | null;
    source: string;
    advisoryOnly: boolean;
  };
  scope: {
    mode: string;
    allowedTools: string[];
    deniedPaths: string[];
    requiresApproval: boolean;
    policyTags: string[];
  };
  budget: {
    maxToolCalls: number;
    maxWallClockMs: number;
    maxOutputBytes: number;
  };
  approval: {
    required: boolean;
    reason: string;
    inheritedApprovalId: string | null;
  };
  risk: 'safe' | 'attention' | 'danger' | 'unknown';
  actions: {
    previewCommand: string;
    approveCommand: string;
    launchCommand: string;
    inspectCommand: string;
  };
};

export type ZavorthControlAgentTeamCompilerSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: 'not-needed' | 'compiled' | 'waiting-approval' | 'blocked' | 'unknown';
  objective: string;
  topology: {
    mode: 'linear' | 'parallel' | 'review-gated' | 'unknown';
    edges: Array<{
      from: string;
      to: string;
      reason: string;
    }>;
  };
  summary: {
    roleCount: number;
    approvalRequiredCount: number;
    providerAssignedCount: number;
    blockedRoleCount: number;
    requestedSwarm: boolean;
    providerArenaLinked: boolean;
    capabilityNegotiationLinked: boolean;
    subagentReceiptsPrepared: boolean;
    compilerOnly: boolean;
  };
  roles: ZavorthControlAgentTeamCompilerRole[];
  approval: {
    required: boolean;
    approvalId: string;
    reason: string;
    expiresAt: string | null;
  };
  launch: {
    mode: 'approval-gated-team-run' | 'unknown';
    previewCommand: string;
    launchCommand: string;
    inspectCommand: string;
    synthesizeCommand: string;
    synthesisRequired: boolean;
    directToolExecution: boolean;
    executionAuthority: string;
    maxReviewRounds: number;
  };
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: 'ready' | 'needs-approval' | 'missing';
  }>;
  policy: {
    noSubagentsLaunched: boolean;
    approvalRequiredBeforeLaunch: boolean;
    budgetsDefaultToZero: boolean;
    providerSelectionIsAdvisory: boolean;
    respectsCapabilityNegotiation: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};
