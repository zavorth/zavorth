import type { RemoteMeshJson } from './RemoteMeshSandboxContract.js';
import type { RemoteMeshScopedMcpTransportSnapshot } from './RemoteMeshSandboxScopedMcpTransportContract.js';

export const ZAVORTH_REMOTE_MESH_R7_5_NOTEBOOK_SCOPED_MCP_SERVER_VERSION =
  '2026-05-05.remote-mesh-r7.5-notebook-scoped-mcp-server' as const;

export const ZAVORTH_REMOTE_MESH_R8_NOTEBOOK_DOCKER_OBSERVABILITY_VERSION =
  '2026-05-05.remote-mesh-r8-notebook-docker-observability' as const;

export const ZAVORTH_REMOTE_MESH_R9_NOTEBOOK_DOCKER_CONTROL_VERSION =
  '2026-05-05.remote-mesh-r9-notebook-docker-control' as const;

export const ZAVORTH_REMOTE_MESH_R10_NOTEBOOK_PROJECT_FILE_READ_VERSION =
  '2026-05-05.remote-mesh-r10-notebook-project-file-read' as const;

export type RemoteMeshNotebookDockerControlAction =
  | 'start'
  | 'stop'
  | 'restart';

export type RemoteMeshNotebookScopedMcpToolName =
  | 'notebook.get_status'
  | 'notebook.docker.list_containers'
  | 'notebook.docker.get_logs'
  | 'notebook.docker.preview_control'
  | 'notebook.docker.apply_control'
  | 'notebook.project_files.preview_read'
  | 'notebook.project_files.apply_read';

export type RemoteMeshNotebookScopedMcpServerStatus =
  | 'not-configured'
  | 'ready'
  | 'self-test-passed'
  | 'blocked'
  | 'failed';

export type RemoteMeshNotebookScopedMcpServerGuardId =
  | 'bind-host-safe'
  | 'port-valid'
  | 'auth-token-configured'
  | 'auth-token-min-length'
  | 'auth-header-only'
  | 'mcp-path-locked'
  | 'post-only'
  | 'tool-list-scoped'
  | 'tool-call-locked'
  | 'docker-observability-opt-in'
  | 'docker-container-allowlist'
  | 'docker-log-line-limit'
  | 'no-docker-mutation-tool'
  | 'docker-control-opt-in'
  | 'docker-control-action-allowlist'
  | 'docker-control-approval-required'
  | 'docker-control-receipts-enabled'
  | 'no-docker-raw-control'
  | 'project-file-read-opt-in'
  | 'project-file-root-allowlist'
  | 'project-file-size-limit'
  | 'project-file-read-approval-required'
  | 'no-project-file-write-tool'
  | 'no-shell-tool'
  | 'no-filesystem-mutation';

export type RemoteMeshNotebookScopedMcpServerGuardStatus =
  | 'passed'
  | 'waiting'
  | 'blocked';

export type RemoteMeshNotebookScopedMcpServerGuard = {
  id: RemoteMeshNotebookScopedMcpServerGuardId;
  status: RemoteMeshNotebookScopedMcpServerGuardStatus;
  evidence: string;
  remediation: string | null;
};

export type RemoteMeshNotebookProjectFileRootConfig = {
  name: string;
  rootPath: string;
};

export type RemoteMeshNotebookScopedMcpServerConfig = {
  host: string;
  port: number;
  authToken: string | null;
  tokenSource?: 'none' | 'env' | 'test' | 'generated-test';
  authHeaderName?: 'Authorization' | 'X-Zavorth-Remote-Token';
  allowPrivateBind?: boolean;
  enableDockerObservability?: boolean;
  allowedDockerContainers?: string[];
  maxDockerLogLines?: number;
  dockerCliPath?: string;
  enableDockerControl?: boolean;
  allowedDockerControlActions?: RemoteMeshNotebookDockerControlAction[];
  dockerControlApprovalTtlMs?: number;
  enableProjectFileRead?: boolean;
  allowedProjectFileRoots?: RemoteMeshNotebookProjectFileRootConfig[];
  projectFileReadMaxBytes?: number;
  projectFileReadApprovalTtlMs?: number;
};

export type RemoteMeshNotebookScopedMcpServerConfigSnapshot = {
  host: string;
  port: number;
  bindLabel: string;
  authHeaderName: 'Authorization' | 'X-Zavorth-Remote-Token';
  authTokenConfigured: boolean;
  tokenSource: 'none' | 'env' | 'test' | 'generated-test';
  allowPrivateBind: boolean;
  exposedPath: '/mcp';
  exposedTools: RemoteMeshNotebookScopedMcpToolName[];
  dockerObservabilityEnabled: boolean;
  allowedDockerContainers: string[];
  maxDockerLogLines: number;
  dockerCliPathLabel: string;
  dockerControlEnabled: boolean;
  allowedDockerControlActions: RemoteMeshNotebookDockerControlAction[];
  dockerControlApprovalTtlMs: number;
  projectFileReadEnabled: boolean;
  allowedProjectFileRoots: string[];
  projectFileReadMaxBytes: number;
  projectFileReadApprovalTtlMs: number;
  rawTokenSerialized: false;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshNotebookStatusPayload = {
  schemaVersion: 1;
  generatedAt: string;
  nodeRole: 'primary-notebook-executor';
  toolName: 'notebook.get_status';
  hostname: string;
  platform: NodeJS.Platform;
  arch: string;
  uptimeSeconds: number;
  freeMemoryMb: number;
  totalMemoryMb: number;
  cpuCount: number;
  loadAverage: number[];
  process: {
    pid: number;
    nodeVersion: string;
    zavorthVersion: string | null;
  };
  capabilities: RemoteMeshNotebookScopedMcpToolName[];
  safety: {
    shellAvailable: false;
    filesystemMutationAvailable: false;
    sudoAvailable: false;
    rawCommandAccepted: false;
    dockerMutationAvailable: boolean;
    dockerRawCommandAccepted: false;
    projectFileReadAvailable: boolean;
    projectFileWriteAvailable: false;
  };
};

export type RemoteMeshNotebookDockerContainerSummary = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string | null;
};

export type RemoteMeshNotebookDockerListContainersPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.docker.list_containers';
  containers: RemoteMeshNotebookDockerContainerSummary[];
  allowedContainers: string[];
  readOnly: true;
  processSpawned: boolean;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookDockerLogsPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.docker.get_logs';
  container: string;
  requestedLines: number;
  maxLines: number;
  logs: string;
  lineCount: number;
  readOnly: true;
  processSpawned: boolean;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookDockerControlPreviewPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.docker.preview_control';
  approvalId: string;
  approvalPhrase: string;
  expiresAt: string;
  container: string;
  action: RemoteMeshNotebookDockerControlAction;
  risk: 'medium';
  reversible: boolean;
  templateLabel: 'docker-container-lifecycle';
  expectedEffect: string;
  requiresApproval: true;
  processSpawned: false;
  dockerMutationPerformed: false;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookDockerControlReceiptPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.docker.apply_control';
  receiptId: string;
  approvalId: string;
  container: string;
  action: RemoteMeshNotebookDockerControlAction;
  status: 'executed';
  templateLabel: 'docker-container-lifecycle';
  processSpawned: boolean;
  dockerMutationPerformed: boolean;
  filesystemMutationPerformed: false;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookProjectFileReadPreviewPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.project_files.preview_read';
  approvalId: string;
  approvalPhrase: string;
  expiresAt: string;
  project: string;
  relativePath: string;
  sizeBytes: number;
  maxBytes: number;
  contentRisk: 'normal' | 'sensitive-name';
  readOnly: true;
  requiresApproval: true;
  resolvedPathLabel: 'allowlisted-project-root';
  processSpawned: false;
  filesystemMutationPerformed: false;
  rawPathSerialized: false;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookProjectFileReadReceiptPayload = {
  schemaVersion: 1;
  generatedAt: string;
  toolName: 'notebook.project_files.apply_read';
  receiptId: string;
  approvalId: string;
  project: string;
  relativePath: string;
  encoding: 'utf8';
  content: string;
  sizeBytes: number;
  truncated: boolean;
  lineCount: number;
  readOnly: true;
  processSpawned: false;
  filesystemMutationPerformed: false;
  rawPathSerialized: false;
  rawCommandSerialized: false;
};

export type RemoteMeshNotebookScopedMcpSelfTest = {
  requested: boolean;
  performed: boolean;
  passed: boolean;
  endpointLabel: string | null;
  httpStatus: number | null;
  toolName: RemoteMeshNotebookScopedMcpToolName | null;
  responsePreview: RemoteMeshJson | null;
  errors: string[];
  serverClosed: boolean;
  liveNetworkCallPerformed: boolean;
  remoteProcessSpawned: boolean;
  filesystemMutationPerformed: false;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshNotebookDockerObservabilitySelfTest = {
  requested: boolean;
  performed: boolean;
  passed: boolean;
  endpointLabel: string | null;
  httpStatus: number | null;
  tools: {
    listContainers: boolean;
    getLogs: boolean;
  };
  responsePreview: RemoteMeshJson | null;
  errors: string[];
  serverClosed: boolean;
  liveNetworkCallPerformed: boolean;
  remoteProcessSpawned: boolean;
  filesystemMutationPerformed: false;
  dockerMutationPerformed: false;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshNotebookDockerControlSelfTest = {
  requested: boolean;
  performed: boolean;
  passed: boolean;
  endpointLabel: string | null;
  httpStatus: number | null;
  tools: {
    previewControl: boolean;
    applyControl: boolean;
  };
  responsePreview: RemoteMeshJson | null;
  receiptPreview: RemoteMeshJson | null;
  errors: string[];
  serverClosed: boolean;
  liveNetworkCallPerformed: boolean;
  remoteProcessSpawned: boolean;
  filesystemMutationPerformed: false;
  dockerMutationPerformed: boolean;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshNotebookProjectFileReadSelfTest = {
  requested: boolean;
  performed: boolean;
  passed: boolean;
  endpointLabel: string | null;
  httpStatus: number | null;
  tools: {
    previewRead: boolean;
    applyRead: boolean;
  };
  responsePreview: RemoteMeshJson | null;
  receiptPreview: RemoteMeshJson | null;
  errors: string[];
  serverClosed: boolean;
  liveNetworkCallPerformed: boolean;
  remoteProcessSpawned: false;
  filesystemMutationPerformed: false;
  rawPathSerialized: false;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshNotebookScopedMcpServerSnapshot = {
  generatedAt: string;
  contractVersion:
    | typeof ZAVORTH_REMOTE_MESH_R7_5_NOTEBOOK_SCOPED_MCP_SERVER_VERSION
    | typeof ZAVORTH_REMOTE_MESH_R8_NOTEBOOK_DOCKER_OBSERVABILITY_VERSION
    | typeof ZAVORTH_REMOTE_MESH_R9_NOTEBOOK_DOCKER_CONTROL_VERSION
    | typeof ZAVORTH_REMOTE_MESH_R10_NOTEBOOK_PROJECT_FILE_READ_VERSION;
  phase: 'R7.5' | 'R8' | 'R9' | 'R10';
  status: RemoteMeshNotebookScopedMcpServerStatus;
  summary: {
    guards: number;
    passed: number;
    waiting: number;
    blocked: number;
    readyToServe: boolean;
    selfTestRequested: boolean;
    selfTestPassed: boolean;
    dockerSelfTestRequested: boolean;
    dockerSelfTestPassed: boolean;
    dockerControlSelfTestRequested: boolean;
    dockerControlSelfTestPassed: boolean;
    projectFileReadSelfTestRequested: boolean;
    projectFileReadSelfTestPassed: boolean;
    exposedToolCount: number;
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: false;
    mutationPerformed: boolean;
    dockerMutationPerformed: boolean;
    projectFileReadPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  config: RemoteMeshNotebookScopedMcpServerConfigSnapshot;
  guards: RemoteMeshNotebookScopedMcpServerGuard[];
  selfTest: RemoteMeshNotebookScopedMcpSelfTest;
  dockerSelfTest: RemoteMeshNotebookDockerObservabilitySelfTest;
  dockerControlSelfTest: RemoteMeshNotebookDockerControlSelfTest;
  projectFileReadSelfTest: RemoteMeshNotebookProjectFileReadSelfTest;
  r7ClientSmoke: RemoteMeshScopedMcpTransportSnapshot | null;
  commands: {
    check: 'npm run remote-mesh:notebook:scoped-mcp-server --silent';
    serve: 'npm run remote-mesh:notebook:scoped-mcp-server:serve --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshNotebookScopedMcpServerService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'R8 - Docker Observability Tools' | 'R9 - Docker Control With Approval' | 'R10 - Scoped Project File Reads' | 'R11 - Mobile UX Integration';
  };
};
