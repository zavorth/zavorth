import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
  RemoteMeshTransportKind,
  RemoteNode,
  RemoteNotebookTool,
} from './RemoteMeshSandboxContract.js';
import type {
  RemoteMeshPolicyCatalog,
  RemoteMeshPolicyEvaluation,
} from './RemoteMeshSandboxPolicyContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R3_ADAPTER_VERSION =
  '2026-05-05.remote-mesh-sandbox-r3-adapters' as const;

export type RemoteMeshAdapterDryRunKind =
  | 'mcp-dry-run'
  | 'ssh-wrapper-dry-run'
  | 'termux-proot-dry-run'
  | 'policy-block-dry-run';

export type RemoteMeshAdapterDryRunStatus =
  | 'ready'
  | 'approval-required'
  | 'blocked';

export type RemoteMeshAdapterCallPreview = {
  kind: 'mcp-tool-call' | 'ssh-wrapper-template' | 'termux-proot-lifecycle' | 'policy-block';
  name: string;
  transport: RemoteMeshTransportKind | 'policy-only';
  endpointLabel: string | null;
  payload: Record<string, RemoteMeshJson>;
  rawCommand: null;
};

export type RemoteMeshAdapterDryRunBinding = {
  id: string;
  actionId: string;
  evaluationId: string;
  adapter: RemoteMeshAdapterDryRunKind;
  status: RemoteMeshAdapterDryRunStatus;
  targetNodeId: string;
  toolId: string;
  transport: RemoteMeshTransportKind | 'policy-only';
  commandTemplateId: string | null;
  mcpToolName: string | null;
  approvalRequired: boolean;
  paramsRedacted: Record<string, RemoteMeshJson>;
  preview: {
    humanSummary: string;
    adapterCall: RemoteMeshAdapterCallPreview;
    commandTemplatePreview: string | null;
    rawCommand: null;
  };
  dryRunHashes: {
    stdoutPreviewHash: string;
    stderrPreviewHash: string;
    receiptPreviewHash: string;
  };
  guards: {
    noLiveNetworkCall: true;
    noRemoteProcessSpawn: true;
    noFilesystemMutation: true;
    noRawCommandSerialization: true;
    noSecretSerialization: true;
    commandTemplateIdRequired: boolean;
    mcpBindingRequired: boolean;
    approvalMustBeResolvedBeforeExecution: boolean;
  };
  receipt: RemoteExecutionReceipt;
};

export type RemoteMeshSandboxAdapterSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R3_ADAPTER_VERSION;
  phase: 'R3';
  status: 'adapter-dry-run-ready' | 'attention' | 'blocked';
  summary: {
    policyEvaluations: number;
    bindings: number;
    ready: number;
    approvalRequired: number;
    blocked: number;
    mcpDryRuns: number;
    sshWrapperDryRuns: number;
    termuxProotDryRuns: number;
    policyBlocks: number;
    receipts: number;
    remoteExecutionPerformed: false;
    liveNetworkCallPerformed: false;
    remoteProcessSpawned: false;
    filesystemMutationPerformed: false;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  nodes: RemoteNode[];
  tools: RemoteNotebookTool[];
  policyCatalog: RemoteMeshPolicyCatalog;
  policyEvaluations: RemoteMeshPolicyEvaluation[];
  bindings: RemoteMeshAdapterDryRunBinding[];
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:adapters --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxAdapterDryRunService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextPhase: 'R4 - Owner-Gated Live Remote Activation';
  };
};
