export type NodeHostAssignment = {
  id: string;
  capabilityId: string;
  action: string;
  payload?: Record<string, unknown> | null;
};

export type NodeHostCommandResult = {
  ok: boolean;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
};

export type NodeHostCommandInvocation =
  | string
  | {
      label?: string;
      command: string;
      file: string;
      args?: string[];
    };

export type NodeHostExecutionResult = {
  invocationId: string;
  ok: boolean;
  resultSummary: string;
  stdout?: string | null;
  stderr?: string | null;
  exitCode?: number | null;
  data?: Record<string, unknown> | null;
};

export type NodeHostCommandRunner = {
  run: (
    command: NodeHostCommandInvocation,
    input?: {
      cwd?: string | null;
      timeoutMs?: number;
      env?: NodeJS.ProcessEnv;
    },
  ) => Promise<NodeHostCommandResult>;
};

export type NodeHostCapabilityRuntime = {
  now?: () => Date;
  platform?: NodeJS.Platform;
  workspaceRoot?: string;
  tempRoot?: string;
  stateFile?: string;
  allowedRoots?: string[];
  env?: NodeJS.ProcessEnv;
  commandRunner?: NodeHostCommandRunner;
};

export type NodeHostMaintenanceIssue = {
  kind: 'invalid-state' | 'unsupported-capability';
  summary: string;
  actionHint: string | null;
};

export type NodeHostMaintenanceDoctorReport = {
  checkedAt: string;
  status: 'healthy' | 'attention';
  summary: string;
  host: Record<string, unknown>;
  stateFile: string;
  pendingResults: {
    total: number;
    invalid: number;
  };
  requestedCapabilities: string[];
  supportedCapabilities: string[];
  issues: NodeHostMaintenanceIssue[];
};

export type NodeHostMaintenanceRepairReport = {
  repairedAt: string;
  stateFile: string;
  keptResults: number;
  removedResults: number;
};
