import type {
  ZavorthTerminalBackendId,
  ZavorthTerminalBackendStatus,
} from './ZavorthTerminalBackendsContract.js';

export const EXECUTION_BACKEND_PLAYBOOK_VERSION = 'execution-backend-playbook/v1' as const;

export type ExecutionBackendPlaybookStatus =
  | 'ready-preview-only'
  | 'needs-configuration'
  | 'ready-for-live-with-approval'
  | 'planned'
  | 'blocked';

export type ExecutionBackendStepStatus = 'done' | 'next' | 'pending' | 'blocked';

export type ExecutionBackendStep = {
  id:
    | 'choose-backend'
    | 'install-prerequisites'
    | 'configure-env'
    | 'run-doctor'
    | 'run-strong-smoke'
    | 'set-live-flag'
    | 'execute-with-approval';
  label: string;
  status: ExecutionBackendStepStatus;
  command: string | null;
  details: string[];
};

export type ExecutionBackendPlaybook = {
  backendId: ZavorthTerminalBackendId;
  label: string;
  status: ExecutionBackendPlaybookStatus;
  backendStatus: ZavorthTerminalBackendStatus | 'backend-ready' | 'backend-needs-configuration' | 'backend-planned';
  isolation: string;
  summary: string;
  nextAction: string;
  requiredInputKeys: string[];
  liveReady: boolean;
  liveMutationAllowedByDefault: false;
  defaultBlockReason: string | null;
  commands: {
    inspect: string;
    plan: string;
    doctor: string;
    strongSmoke: string;
    liveExecute: string;
  };
  steps: ExecutionBackendStep[];
  safety: {
    noBackendLiveByDefault: true;
    mutationRequiresApproval: true;
    stdoutStderrRedacted: true;
    dryRunWhenStrongSandboxMissing: true;
  };
};

export type ExecutionBackendPlaybookSnapshot = {
  generatedAt: string;
  version: typeof EXECUTION_BACKEND_PLAYBOOK_VERSION;
  status: 'ready' | 'needs-setup' | 'attention';
  selected: ExecutionBackendPlaybook | null;
  playbooks: ExecutionBackendPlaybook[];
  summary: {
    total: number;
    needsConfiguration: number;
    previewReady: number;
    liveReady: number;
    strongSandboxReady: number;
  };
  operatorSummary: string;
};
