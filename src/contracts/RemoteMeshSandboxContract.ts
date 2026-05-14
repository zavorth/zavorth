export const ZAVORTH_REMOTE_MESH_SANDBOX_R1_CONTRACT_VERSION =
  '2026-05-05.remote-mesh-sandbox-r1' as const;

export type RemoteMeshJson =
  | null
  | boolean
  | number
  | string
  | RemoteMeshJson[]
  | { [key: string]: RemoteMeshJson };

export type RemoteMeshNodeRole =
  | 'mobile-command-node'
  | 'primary-notebook-executor'
  | 'desktop-executor'
  | 'ephemeral-mobile-sandbox';

export type RemoteMeshNodeTrust =
  | 'unpaired'
  | 'paired'
  | 'trusted'
  | 'operator-owned';

export type RemoteMeshNodePlatform =
  | 'android-termux'
  | 'windows'
  | 'linux'
  | 'macos'
  | 'unknown';

export type RemoteMeshTransportKind =
  | 'tailscale'
  | 'tailscale-ssh'
  | 'ssh-wrapper'
  | 'mcp-http'
  | 'mcp-stdio'
  | 'termux-proot';

export type RemoteMeshRiskTier =
  | 'level-0-readonly'
  | 'level-1-reversible'
  | 'level-2-persistent'
  | 'level-3-sensitive'
  | 'level-4-prohibited';

export type RemoteMeshApprovalMode =
  | 'not-required'
  | 'conversation-preview'
  | 'explicit-approval'
  | 'strong-approval'
  | 'blocked';

export type RemoteMeshSideEffect =
  | 'none'
  | 'process-start'
  | 'process-stop'
  | 'filesystem-read'
  | 'filesystem-write'
  | 'network-call'
  | 'container-start'
  | 'container-stop'
  | 'package-install'
  | 'sandbox-create'
  | 'sandbox-destroy';

export type RemoteMeshToolParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object';
  required: boolean;
  description: string;
  allowedValues?: string[];
  min?: number;
  max?: number;
};

export type RemoteMeshTransport = {
  kind: RemoteMeshTransportKind;
  endpointLabel: string;
  authenticated: boolean;
  scoped: boolean;
  exposedPorts: number[];
  notes: string[];
};

export type RemoteNode = {
  id: string;
  label: string;
  role: RemoteMeshNodeRole;
  platform: RemoteMeshNodePlatform;
  trust: RemoteMeshNodeTrust;
  transports: RemoteMeshTransport[];
  capabilities: string[];
  authorityBoundary: {
    dedicatedUserRequired: boolean;
    sudoAllowed: false;
    freeformShellAllowed: false;
    homeDirectoryWideAccessAllowed: false;
    unauthenticatedMcpAllowed: false;
  };
  evidence: string[];
};

export type RemoteNotebookTool = {
  id: string;
  displayName: string;
  targetRole: RemoteMeshNodeRole;
  transport: RemoteMeshTransportKind;
  risk: RemoteMeshRiskTier;
  sideEffects: RemoteMeshSideEffect[];
  approval: RemoteMeshApprovalMode;
  parameters: RemoteMeshToolParameter[];
  commandTemplateId: string | null;
  mcpToolName: string | null;
  freeformShellAllowed: false;
  rawCommandAllowed: false;
  sudoAllowed: false;
  rollback: {
    supported: boolean;
    strategy: string | null;
  };
  audit: {
    receiptRequired: true;
    stdoutHashRequired: boolean;
    stderrHashRequired: boolean;
  };
};

export type RemoteAction = {
  id: string;
  traceId: string;
  requestedAt: string;
  requestedBy: 'operator' | 'runtime' | 'test';
  naturalLanguageIntent: string;
  targetNodeId: string;
  toolId: string;
  params: Record<string, RemoteMeshJson>;
  risk: RemoteMeshRiskTier;
  approval: RemoteMeshApprovalMode;
  expectedSideEffects: RemoteMeshSideEffect[];
  timeoutMs: number;
  idempotencyKey: string;
  preview: {
    humanSummary: string;
    commandTemplateId: string | null;
    rawCommand: null;
  };
};

export type RemoteActionPolicyDecisionStatus =
  | 'allowed'
  | 'requires-approval'
  | 'needs-clarification'
  | 'denied';

export type RemoteActionPolicyDecision = {
  id: string;
  actionId: string;
  status: RemoteActionPolicyDecisionStatus;
  risk: RemoteMeshRiskTier;
  approval: RemoteMeshApprovalMode;
  reasons: string[];
  safeNextAction: string;
  sanitizedParams: Record<string, RemoteMeshJson>;
  blockedPatterns: string[];
  policy: {
    promptCannotExecuteShell: true;
    freeformShellDenied: true;
    unauthenticatedMcpDenied: true;
    sudoDenied: true;
    receiptRequired: true;
    rollbackRequiredWhenAvailable: true;
  };
};

export type EphemeralSandboxSession = {
  id: string;
  nodeId: string;
  createdForActionId: string | null;
  status: 'planned' | 'starting' | 'running' | 'cleaning' | 'destroyed' | 'failed';
  runtime: 'termux-proot';
  baseImageRef: string;
  ttlMs: number;
  workspaceMount: {
    hostPathLabel: string;
    sandboxPath: string;
    readOnly: boolean;
    allowPersonalStorageAccess: false;
  };
  network: {
    enabled: boolean;
    allowedHosts: string[];
  };
  resources: {
    maxMemoryMb: number;
    maxRuntimeMs: number;
    guiAllowed: boolean;
    wakeLockAllowed: boolean;
  };
  cleanup: {
    destroyOnCompletion: true;
    removeProcesses: true;
    removeTempFiles: true;
    releaseWakeLock: true;
    receiptRequired: true;
  };
  securityNotes: {
    prootIsSecurityBoundary: false;
    isolationStrength: 'operational-lightweight';
    untrustedInternetCodeAllowed: false;
  };
};

export type RemoteExecutionReceipt = {
  id: string;
  actionId: string | null;
  decisionId: string | null;
  sessionId: string | null;
  nodeId: string;
  toolId: string | null;
  adapter: RemoteMeshTransportKind | 'policy-only';
  status: 'planned' | 'allowed' | 'approval-required' | 'blocked' | 'executed' | 'cleaned' | 'failed';
  generatedAt: string;
  approvedBy: 'policy' | 'operator' | 'not-approved';
  commandTemplateId: string | null;
  rawCommandSerialized: false;
  stdoutHash: string | null;
  stderrHash: string | null;
  paramsRedacted: Record<string, RemoteMeshJson>;
  noSecretsSerialized: true;
  mutationPerformed: boolean;
  cleanupRequired: boolean;
  cleanupCompleted: boolean;
};

export type RemoteMeshSandboxContractSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R1_CONTRACT_VERSION;
  phase: 'R1';
  status: 'contract-ready' | 'attention';
  summary: {
    nodes: number;
    tools: number;
    sampleActions: number;
    policyDecisions: number;
    sandboxSessions: number;
    receipts: number;
    remoteExecutionPerformed: false;
    freeformShellAllowed: false;
    unauthenticatedMcpAllowed: false;
    secretValuesSerialized: false;
  };
  nodes: RemoteNode[];
  tools: RemoteNotebookTool[];
  sampleActions: RemoteAction[];
  policyDecisions: RemoteActionPolicyDecision[];
  sandboxSessions: EphemeralSandboxSession[];
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:contracts --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxContractService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextPhase: 'R2 - Remote Policy Engine and Tool Allowlist';
  };
};
