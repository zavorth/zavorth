import type {
  ProjectManifestHealthCheck,
  ProjectManifestMode,
  ProjectManifestRestartPolicy,
  ProjectLogWatchEventStatus,
  ResolvedProjectManifest,
} from '../../../../project-workspace/index.js';

export const DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION = 'developer-workspace-surface/v1' as const;

export type DeveloperWorkspaceSurfaceProcessStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'exited'
  | 'failed';

export type DeveloperWorkspaceSurfaceOperation = 'start' | 'stop' | 'restart';

export type DeveloperWorkspaceSurfaceOperationContract = {
  id: DeveloperWorkspaceSurfaceOperation;
  label: string;
  method: 'POST';
  publicPath: '/api/developer-workspace';
  requiresApproval: true;
  approvalScope: 'process.start' | 'process.kill';
  risk: 'write' | 'sensitive';
  status: 'available';
};

export type DeveloperWorkspaceSurfaceLogEntry = {
  id: string;
  sequence: number;
  processId: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: string;
};

export type DeveloperWorkspaceSurfaceProcess = {
  id: string;
  name: string;
  status: DeveloperWorkspaceSurfaceProcessStatus;
  command: string;
  cwd: string;
  restart: ProjectManifestRestartPolicy;
  restartCount: number;
  restartLimit: number;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  exitCode: number | null;
  health: ProjectManifestHealthCheck;
  ownerRef: string | null;
  logs: DeveloperWorkspaceSurfaceLogEntry[];
};

export type DeveloperWorkspaceSurfaceHook = {
  id: string;
  processId: string;
  pattern: string;
  mode: ProjectManifestMode;
  prompt: string;
};

export type DeveloperWorkspaceSurfaceAgent = {
  id: string;
  role: string;
  mode: ProjectManifestMode;
  watches: string[];
};

export type DeveloperWorkspaceSurfacePtyProfile = {
  sessionId: string;
  processId: string;
  cwd: string;
  command: string;
  ownerRef: string | null;
  inputPolicy: 'blocked' | 'operator-only';
  recording: 'enabled';
};

export type DeveloperWorkspaceSurfaceLogWatchEvent = {
  id: string;
  hookId: string;
  processId: string;
  mode: ProjectManifestMode;
  status: ProjectLogWatchEventStatus;
  category: string;
  severity: string;
  risk: string;
  summary: string;
  reason: string;
  agentRunId: string | null;
  duplicateCount: number;
  rateLimited: boolean;
  createdAt: string;
};

export type DeveloperWorkspaceSurfaceLogWatch = {
  generatedAt: string;
  summary: {
    events: number;
    suggestions: number;
    blocked: number;
    manualRequired: number;
    rateLimited: number;
    lastEventAt: string | null;
  };
  events: DeveloperWorkspaceSurfaceLogWatchEvent[];
};

export type DeveloperWorkspaceSurfaceSnapshot = {
  ok: boolean;
  contractVersion: typeof DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ProjectWorkspaceService+ProjectProcessSupervisor';
  manifestPath: string | null;
  projectRoot: string | null;
  project: {
    name: string;
    description: string;
  } | null;
  policy: {
    defaultMode: ProjectManifestMode;
    requireApprovalFor: string[];
  };
  summary: {
    processes: number;
    running: number;
    failed: number;
    idle: number;
    hooks: number;
    agents: number;
    logs: number;
    logWatchEvents: number;
  };
  processes: DeveloperWorkspaceSurfaceProcess[];
  hooks: DeveloperWorkspaceSurfaceHook[];
  agents: DeveloperWorkspaceSurfaceAgent[];
  ptyProfiles: DeveloperWorkspaceSurfacePtyProfile[];
  logWatch: DeveloperWorkspaceSurfaceLogWatch;
  operations: DeveloperWorkspaceSurfaceOperationContract[];
  warnings: string[];
  error: string | null;
};

export type DeveloperWorkspaceSurfaceActionInput = {
  action: DeveloperWorkspaceSurfaceOperation;
  processId?: string | null;
  approval?: {
    approved?: boolean;
    approvalId?: string | null;
    approvedBy?: string | null;
    reason?: string | null;
  } | null;
  manifestPath?: string | null;
  cwd?: string | null;
  runId?: string | null;
  requestedBy?: string | null;
  resolved?: ResolvedProjectManifest | null;
};

export type DeveloperWorkspaceSurfaceActionResult = {
  ok: boolean;
  httpStatus: 200 | 400 | 403 | 500;
  status: 'invalid' | 'approval_required' | 'executed' | 'failed';
  contractVersion: typeof DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION;
  generatedAt: string;
  operation: DeveloperWorkspaceSurfaceOperationContract | null;
  approval: {
    required: true;
    satisfied: boolean;
    approvalId: string | null;
    approvedBy: string | null;
    reason: string;
  };
  processId: string | null;
  message: string;
  errors: string[];
  snapshot: DeveloperWorkspaceSurfaceSnapshot;
};
