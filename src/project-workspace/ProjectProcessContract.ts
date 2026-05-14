import type { ChildProcessWithoutNullStreams } from 'child_process';
import type {
  ProjectManifestHealthCheck,
  ProjectManifestRestartPolicy,
  ResolvedProjectManifest,
} from './ProjectManifestContract.js';

export const PROJECT_PROCESS_DEFAULT_RESTART_LIMIT = 3;
export const PROJECT_PROCESS_DEFAULT_RESTART_BACKOFF_MS = 1000;
export const PROJECT_PROCESS_DEFAULT_LOG_LIMIT = 200;

export type ProjectProcessStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'exited'
  | 'failed';

export type ProjectProcessLogStream = 'stdout' | 'stderr' | 'system';

export type ProjectProcessOwner = {
  projectName: string;
  projectRoot: string;
  manifestPath: string;
  processId: string;
  ownerRef: string;
  runId: string | null;
  requestedBy: string | null;
  surface: string;
};

export type ProjectProcessLogEntry = {
  id: string;
  sequence: number;
  processId: string;
  stream: ProjectProcessLogStream;
  text: string;
  timestamp: string;
};

export type ProjectProcessRecord = {
  id: string;
  name: string;
  status: ProjectProcessStatus;
  owner: ProjectProcessOwner;
  command: string;
  redactedCommand: string;
  cwd: string;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  restart: ProjectManifestRestartPolicy;
  restartCount: number;
  restartLimit: number;
  restartBackoffMs: number;
  nextRestartAt: string | null;
  health: ProjectManifestHealthCheck;
  logs: ProjectProcessLogEntry[];
  lastError: string | null;
};

export type ProjectProcessSupervisorSnapshot = {
  projectName: string;
  projectRoot: string;
  manifestPath: string;
  generatedAt: string;
  processes: ProjectProcessRecord[];
};

export type ProjectProcessStartProjectInput = {
  resolved?: ResolvedProjectManifest | null;
  manifestPath?: string | null;
  cwd?: string | null;
  processIds?: string[] | null;
  runId?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
};

export type ProjectProcessStopInput = {
  processId: string;
  ownerRef?: string | null;
  reason?: string | null;
  signal?: NodeJS.Signals | string | null;
};

export type ProjectProcessReadLogsInput = {
  processId?: string | null;
  limit?: number | null;
};

export type ProjectProcessRuntimeHandle = {
  child: ChildProcessWithoutNullStreams | null;
  restartTimer: ReturnType<typeof setTimeout> | null;
  intentionalStop: boolean;
};
