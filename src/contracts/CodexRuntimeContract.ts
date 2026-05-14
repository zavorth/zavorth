export const ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION = '2026-05-04.worker-2' as const;

export type CodexRuntimeStatus =
  | 'closed'
  | 'attention';

export type CodexRuntimeTransportKind =
  | 'stdio-app-server'
  | 'websocket-app-server';

export type CodexRuntimeFeatureStatus =
  | 'native-runtime-proof'
  | 'missing';

export type CodexRuntimeFeatureId =
  | 'app-server-rpc'
  | 'stdio-transport'
  | 'websocket-transport'
  | 'model-catalog'
  | 'session-lifecycle'
  | 'approval-bridge'
  | 'dynamic-tools'
  | 'event-projection'
  | 'transcript-mirror'
  | 'trajectory-audit'
  | 'media-understanding'
  | 'migration-import'
  | 'command-control'
  | 'computer-use-readiness';

export type CodexRuntimeArtifactKind =
  | 'agent.session'
  | 'agent.transcript'
  | 'agent.trajectory'
  | 'agent.model-catalog'
  | 'agent.approval'
  | 'agent.tool-call'
  | 'agent.media-understanding'
  | 'migration.report'
  | 'agent.runtime.receipt';

export type CodexRuntimeRpcMethod =
  | 'initialize'
  | 'model/list'
  | 'thread/list'
  | 'thread/resume'
  | 'thread/turn/start'
  | 'thread/compact/start'
  | 'thread/stop'
  | 'account/read'
  | 'review/start'
  | 'mcpServerStatus/list'
  | 'skills/list'
  | 'computerUse/status';

export type CodexRuntimeReasoningEffort =
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export type CodexRuntimeProfile = {
  id: string;
  label: string;
  codexHome: string | null;
  workspaceRoot: string | null;
  appServerCommand: string;
  appServerArgs: string[];
  appServerUrl: string | null;
  headers: Record<string, string>;
  approvalMode: 'guardian' | 'yolo';
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
};

export type CodexRuntimeTransportPlan = {
  kind: CodexRuntimeTransportKind;
  command: string | null;
  args: string[];
  url: string | null;
  envKeys: string[];
  headers: Record<string, string>;
  windowsHide: boolean;
  liveIoRequired: false;
  processSpawnRequired: boolean;
  secretValuesSerialized: false;
  readiness: 'configured' | 'missing-endpoint';
};

export type CodexRuntimeRpcRequest = {
  id: string;
  method: CodexRuntimeRpcMethod;
  params: Record<string, unknown> | null;
  timeoutMs: number;
};

export type CodexRuntimeRpcResponse<T = unknown> = {
  id: string;
  result?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
};

export type CodexRuntimeRpcRequester = (
  request: CodexRuntimeRpcRequest,
) => Promise<CodexRuntimeRpcResponse>;

export type CodexRuntimeInitializeResult = {
  protocolVersion: string;
  serverName: string;
  capabilities: string[];
};

export type CodexRuntimeModelEntry = {
  id: string;
  label: string;
  provider: 'codex';
  source: 'fallback' | 'app-server';
  reasoningEfforts: CodexRuntimeReasoningEffort[];
  supportsImages: boolean;
  supportsTools: boolean;
};

export type CodexRuntimeThreadSummary = {
  threadId: string;
  title: string;
  status: 'idle' | 'running' | 'stopped' | 'unknown';
  modelId: string | null;
};

export type CodexRuntimeToolExposure = {
  id: string;
  label: string;
  exposed: boolean;
  reason: string;
  policy: 'native-first' | 'compatibility';
};

export type CodexRuntimeApprovalBridge = {
  id: string;
  source: 'command' | 'file-change' | 'permission' | 'mcp' | 'user-input' | 'elicitation';
  decisionModes: Array<'allow-once' | 'allow-session' | 'deny' | 'cancel'>;
  artifactKind: CodexRuntimeArtifactKind;
  redactsPreview: true;
};

export type CodexRuntimeEventProjection = {
  id: string;
  appServerEvent: string;
  zavorthEvent: string;
  artifactKind: CodexRuntimeArtifactKind;
  idempotent: true;
};

export type CodexRuntimeFeature = {
  id: CodexRuntimeFeatureId;
  status: CodexRuntimeFeatureStatus;
  evidence: string[];
  artifactKinds: CodexRuntimeArtifactKind[];
  receiptKind: 'agent.runtime.receipt';
};

export type CodexRuntimeRunPlan = {
  runId: string;
  threadId: string | null;
  workspaceRoot: string | null;
  promptHash: string;
  actions: CodexRuntimeRpcMethod[];
  artifacts: CodexRuntimeArtifactKind[];
  dynamicTools: CodexRuntimeToolExposure[];
  approvals: CodexRuntimeApprovalBridge[];
  liveIoRequired: false;
  secretValuesSerialized: false;
};

export type CodexRuntimeMediaUnderstandingJob = {
  jobId: string;
  sourceArtifactId: string;
  mode: 'image';
  sandbox: 'read-only';
  dynamicToolsEnabled: false;
  outputArtifactKind: 'agent.media-understanding';
  receiptKind: 'agent.runtime.receipt';
};

export type CodexRuntimeMigrationPlan = {
  planId: string;
  sourceCodexHome: string | null;
  imports: Array<'profiles' | 'skills' | 'mcp' | 'transcripts' | 'account-metadata'>;
  automaticWrites: false;
  outputArtifactKind: 'migration.report';
  receiptKind: 'agent.runtime.receipt';
};

export type CodexRuntimeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION;
  status: CodexRuntimeStatus;
  sourceModule: 'codex';
  primitiveId: 'agent.runtime';
  summary: {
    features: number;
    nativeRuntimeProofs: number;
    missing: number;
    transports: number;
    appServerRpcMethods: number;
    fallbackModels: number;
    approvalBridgeKinds: number;
    eventProjectionKinds: number;
    operatorCommands: number;
    liveExternalCallRequired: false;
    liveAppServerRequired: false;
    processSpawnRequired: false;
    filesystemWriteRequired: false;
    secretValuesSerialized: false;
  };
  transports: CodexRuntimeTransportPlan[];
  fallbackModels: CodexRuntimeModelEntry[];
  rpcMethods: CodexRuntimeRpcMethod[];
  dynamicToolPolicy: {
    defaultPolicy: 'native-first';
    compatibilityPolicyAvailable: true;
    nativeOwnedToolsExcludedByDefault: true;
  };
  approvals: CodexRuntimeApprovalBridge[];
  eventProjection: CodexRuntimeEventProjection[];
  features: CodexRuntimeFeature[];
  operatorCommands: string[];
  artifactKinds: CodexRuntimeArtifactKind[];
  receipts: string[];
  policy: {
    noSourceImports: true;
    noSourceManifestRuntimeDependency: true;
    noLiveIoInProof: true;
    noSecretsSerialized: true;
    artifactFirst: true;
    approvalFirstForSensitiveActions: true;
  };
  commands: {
    check: 'npm run codex-runtime-parity:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextWorker: 'Worker 3 - OpenShell Sandbox Plane parity';
  };
};
