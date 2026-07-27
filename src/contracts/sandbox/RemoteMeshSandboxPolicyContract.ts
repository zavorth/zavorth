import type {
  RemoteAction,
  RemoteExecutionReceipt,
  RemoteMeshApprovalMode,
  RemoteMeshJson,
  RemoteMeshNodeRole,
  RemoteMeshNodeTrust,
  RemoteMeshRiskTier,
  RemoteMeshSideEffect,
  RemoteMeshTransportKind,
  RemoteNode,
  RemoteNotebookTool,
} from './RemoteMeshSandboxContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R2_POLICY_VERSION =
  '2026-05-05.remote-mesh-sandbox-r2-policy' as const;

export type RemoteMeshPolicyEvaluationStatus =
  | 'allowed'
  | 'requires-approval'
  | 'needs-clarification'
  | 'denied';

export type RemoteMeshPolicyViolationSeverity =
  | 'info'
  | 'clarification'
  | 'approval'
  | 'blocker';

export type RemoteMeshPolicyViolationCode =
  | 'unknown-node'
  | 'unknown-tool'
  | 'unknown-rule'
  | 'node-role-mismatch'
  | 'node-trust-not-allowed'
  | 'transport-not-allowed'
  | 'transport-not-authenticated'
  | 'unsafe-tool-authority'
  | 'missing-command-template'
  | 'unsafe-command-template'
  | 'missing-mcp-binding'
  | 'unsafe-mcp-binding'
  | 'missing-required-parameter'
  | 'unknown-parameter'
  | 'invalid-parameter-type'
  | 'parameter-out-of-range'
  | 'parameter-value-not-allowed'
  | 'project-not-allowed'
  | 'timeout-too-large'
  | 'dangerous-pattern'
  | 'risk-above-rule'
  | 'approval-required'
  | 'prohibited-action';

export type RemoteMeshPolicyViolation = {
  code: RemoteMeshPolicyViolationCode;
  severity: RemoteMeshPolicyViolationSeverity;
  field: string | null;
  message: string;
};

export type RemoteMeshPolicyRule = {
  id: string;
  toolId: string;
  targetRole: RemoteMeshNodeRole;
  allowedNodeTrust: RemoteMeshNodeTrust[];
  allowedTransports: RemoteMeshTransportKind[];
  allowedProjects: string[];
  riskCeiling: RemoteMeshRiskTier;
  approval: RemoteMeshApprovalMode;
  maxTimeoutMs: number;
  parameterMode: 'schema-only';
  commandTemplateRequired: boolean;
  mcpBindingRequired: boolean;
  allowedSideEffects: RemoteMeshSideEffect[];
  receiptRequired: true;
};

export type RemoteMeshCommandTemplate = {
  id: string;
  toolId: string;
  adapter: 'mcp-tool' | 'ssh-wrapper' | 'termux-proot';
  parameterRefs: string[];
  previewTemplate: string;
  rawShellForbidden: true;
  shellEscapingRequired: true;
  dryRunOnlyInR2: true;
};

export type RemoteMeshMcpBinding = {
  toolId: string;
  mcpToolName: string;
  transport: Extract<RemoteMeshTransportKind, 'mcp-http' | 'mcp-stdio'>;
  requiresAuth: true;
  schemaLocked: true;
  scopes: string[];
};

export type RemoteMeshPolicyCatalog = {
  rules: RemoteMeshPolicyRule[];
  commandTemplates: RemoteMeshCommandTemplate[];
  mcpBindings: RemoteMeshMcpBinding[];
  deniedToolPatterns: string[];
  dangerousParamPatterns: string[];
};

export type RemoteMeshPolicyEvaluation = {
  id: string;
  actionId: string;
  status: RemoteMeshPolicyEvaluationStatus;
  risk: RemoteMeshRiskTier;
  approval: RemoteMeshApprovalMode;
  targetNodeId: string;
  toolId: string;
  effectiveTransport: RemoteMeshTransportKind | null;
  commandTemplateId: string | null;
  mcpToolName: string | null;
  sanitizedParams: Record<string, RemoteMeshJson>;
  violations: RemoteMeshPolicyViolation[];
  safeNextAction: string;
  preview: {
    humanSummary: string;
    commandTemplatePreview: string | null;
    rawCommand: null;
  };
  receipt: RemoteExecutionReceipt;
  policy: {
    promptCannotExecuteShell: true;
    schemaOnlyParameters: true;
    commandTemplatesOnly: true;
    scopedMcpToolsOnly: true;
    approvalBeforePersistentMutation: true;
    levelFourBlockedByDefault: true;
    noRemoteExecutionInPolicyEvaluation: true;
  };
};

export type RemoteMeshSandboxPolicySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R2_POLICY_VERSION;
  phase: 'R2';
  status: 'policy-ready' | 'attention' | 'blocked';
  summary: {
    nodes: number;
    tools: number;
    rules: number;
    commandTemplates: number;
    mcpBindings: number;
    evaluations: number;
    allowed: number;
    requiresApproval: number;
    needsClarification: number;
    denied: number;
    receipts: number;
    remoteExecutionPerformed: false;
    freeformShellAllowed: false;
    rawCommandSerialized: false;
    unauthenticatedMcpAllowed: false;
    secretValuesSerialized: false;
  };
  nodes: RemoteNode[];
  tools: RemoteNotebookTool[];
  catalog: RemoteMeshPolicyCatalog;
  sampleActions: RemoteAction[];
  evaluations: RemoteMeshPolicyEvaluation[];
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:policy --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxPolicyService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Remote adapter dry-run bindings';
  };
};
