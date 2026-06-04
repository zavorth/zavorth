export const ZAVORTH_TERMINAL_BACKENDS_CONTRACT_VERSION =
  '2026-05-24.terminal-backends-phase-6' as const;

export type ZavorthTerminalBackendId =
  | 'local'
  | 'docker'
  | 'ssh'
  | 'wsl'
  | 'vercel-sandbox'
  | 'modal'
  | 'daytona';

export type ZavorthTerminalBackendAction =
  | 'terminal.status'
  | 'terminal.plan'
  | 'terminal.execute';

export type ZavorthTerminalBackendStatus =
  | 'ready'
  | 'needs-configuration'
  | 'approval-required'
  | 'blocked'
  | 'preview'
  | 'planned'
  | 'executed';

export type ZavorthTerminalCommandRisk =
  | 'read-only'
  | 'workspace-mutation'
  | 'network-or-install'
  | 'dangerous';

export type ZavorthTerminalBackendReceipt = {
  id: string;
  kind: 'policy' | 'backend' | 'command-plan' | 'approval' | 'execution' | 'redaction';
  status: 'done' | 'skipped' | 'blocked' | 'approval-required';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthTerminalBackendDescriptor = {
  id: ZavorthTerminalBackendId;
  label: string;
  status: 'ready' | 'needs-configuration' | 'planned';
  isolation: 'host-process' | 'container' | 'remote-shell' | 'linux-vm' | 'managed-cloud-sandbox' | 'cloud-function' | 'cloud-dev-workspace' | 'planned-cloud-workspace';
  liveCapable: boolean;
  liveReady: boolean;
  requiresConfiguration: string[];
  defaultCommand: string;
  nextCommand: string;
  limitations: string[];
};

export type ZavorthTerminalBackendInput = {
  action?: ZavorthTerminalBackendAction | 'status' | 'plan' | 'execute' | null;
  backend?: ZavorthTerminalBackendId | 'local-supervised' | null;
  command?: string | null;
  workspace?: string | null;
  live?: boolean;
  approvalId?: string | null;
  timeoutMs?: number | null;
  dockerImage?: string | null;
  sshHost?: string | null;
  wslDistro?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
};

export type ZavorthTerminalBackendSnapshot = {
  contractVersion: typeof ZAVORTH_TERMINAL_BACKENDS_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthTerminalBackendsService';
  action: ZavorthTerminalBackendAction;
  status: ZavorthTerminalBackendStatus;
  selectedBackend: ZavorthTerminalBackendId;
  command: {
    raw: string | null;
    redacted: string | null;
    risk: ZavorthTerminalCommandRisk;
    approvalRequired: boolean;
    timeoutMs: number;
    workspace: string;
  };
  plan: {
    mode: 'status-only' | 'preview' | 'approval-required' | 'live-disabled' | 'execute';
    executable: string | null;
    args: string[];
    displayCommand: string | null;
    backendConfigured: boolean;
    willExecute: boolean;
    reason: string;
  };
  execution: {
    attempted: boolean;
    performed: boolean;
    exitCode: number | null;
    stdoutPreview: string | null;
    stderrPreview: string | null;
    error: string | null;
  };
  backends: ZavorthTerminalBackendDescriptor[];
  receipts: ZavorthTerminalBackendReceipt[];
  safety: {
    noBackendLiveByDefault: true;
    highRiskRequiresApproval: true;
    backendConfigRequiredForRemoteExecution: true;
    commandEnvelopeUsesStructuredArgs: true;
    stdoutStderrRedacted: true;
    receiptsRequired: true;
    cloudBackendsRequireExplicitConfiguration: true;
  };
  commands: {
    status: 'zavorth execution-backends';
    plan: 'zavorth execution-backends --backend docker --command "npm test"';
    execute: 'zavorth execution-backends --backend local --command "npm test" --live --approval-id <id>';
  };
  nextSafeAction: string;
};
