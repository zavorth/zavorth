export type RuntimeDoctorCheckId =
  | 'node'
  | 'git'
  | 'ripgrep'
  | 'provider'
  | 'workspace'
  | 'permissions'
  | 'terminal'
  | 'backend';

export type RuntimeDoctorStatus = 'pass' | 'warn' | 'fail' | 'pending';

export type RuntimeDoctorOverall = 'ready' | 'attention' | 'blocked' | 'checking';

export type RuntimeDoctorCheck = {
  id: RuntimeDoctorCheckId;
  label: string;
  description: string;
  status: RuntimeDoctorStatus;
  detail: string;
  actionLabel?: string;
};

export type RuntimeDoctorSnapshot = {
  generatedAt: string;
  overall: RuntimeDoctorOverall;
  checks: RuntimeDoctorCheck[];
  summary: {
    passed: number;
    warnings: number;
    failures: number;
    total: number;
    message: string;
  };
  remoteDisplay: RemoteDisplaySignal;
  safeMode: DesktopSafeModeState;
  auditLogPath?: string | null;
};

export type RuntimeDoctorInput = {
  generatedAt?: string;
  nodeVersion?: string | null;
  gitVersion?: string | null;
  ripgrepVersion?: string | null;
  runtimeRunning?: boolean;
  backendReachable?: boolean;
  tokenReady?: boolean;
  providerCount?: number;
  selectedModel?: string | null;
  workspacePath?: string | null;
  workspaceTrusted?: boolean | null;
  permissionIssueCount?: number;
  terminalBackend?: 'pty' | 'basic' | 'missing' | string | null;
  remoteDisplay?: RemoteDisplaySignal;
  safeMode?: DesktopSafeModeState;
  auditLogPath?: string | null;
};

export type RemoteDisplaySignal = {
  remote: boolean;
  severity: 'none' | 'info' | 'warning';
  reason: string;
  signals: string[];
};

export type DesktopSafeModeState = {
  enabled: boolean;
  reason: string;
  startedAt?: string | null;
  restrictions: string[];
};

export const RUNTIME_DOCTOR_CHECK_ORDER: RuntimeDoctorCheckId[] = [
  'node',
  'git',
  'ripgrep',
  'provider',
  'workspace',
  'permissions',
  'terminal',
  'backend',
];

export function buildRuntimeDoctorSnapshot(input: RuntimeDoctorInput): RuntimeDoctorSnapshot {
  const checks = buildRuntimeDoctorChecks(input);
  const summary = summarizeRuntimeDoctor(checks);
  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    overall: summary.failures > 0 ? 'blocked' : summary.warnings > 0 ? 'attention' : 'ready',
    checks,
    summary,
    remoteDisplay: input.remoteDisplay || detectRemoteDisplayFromEnv({}),
    safeMode: input.safeMode || buildDesktopSafeModeState({ enabled: false }),
    auditLogPath: input.auditLogPath || null,
  };
}

export function buildRuntimeDoctorChecks(input: RuntimeDoctorInput): RuntimeDoctorCheck[] {
  const providerCount = normalizeCount(input.providerCount);
  const permissionIssueCount = normalizeCount(input.permissionIssueCount);
  const workspacePath = normalizeString(input.workspacePath);
  const terminalBackend = normalizeString(input.terminalBackend);
  const selectedModel = normalizeString(input.selectedModel);

  const checks: RuntimeDoctorCheck[] = [
    {
      id: 'node',
      label: 'Node.js',
      description: 'JavaScript runtime used by the local agent and desktop shell.',
      status: input.nodeVersion ? 'pass' : 'fail',
      detail: input.nodeVersion ? `Found ${input.nodeVersion}.` : 'Node.js was not found in the desktop environment.',
      actionLabel: input.nodeVersion ? undefined : 'Install Node.js',
    },
    {
      id: 'git',
      label: 'Git',
      description: 'Required for workspace status, history and review flows.',
      status: input.gitVersion ? 'pass' : 'warn',
      detail: input.gitVersion ? `Found ${input.gitVersion}.` : 'Git was not found; version-control features are limited.',
      actionLabel: input.gitVersion ? undefined : 'Install Git',
    },
    {
      id: 'ripgrep',
      label: 'ripgrep',
      description: 'Fast search for local projects, workspace memory and navigation.',
      status: input.ripgrepVersion ? 'pass' : 'warn',
      detail: input.ripgrepVersion ? `Found ${input.ripgrepVersion}.` : 'ripgrep was not found; search falls back to a slower path.',
      actionLabel: input.ripgrepVersion ? undefined : 'Install ripgrep',
    },
    {
      id: 'provider',
      label: 'Provider and model',
      description: 'At least one provider or selected model should be ready for real responses.',
      status: providerCount > 0 || selectedModel ? 'pass' : 'warn',
      detail: providerCount > 0
        ? `${providerCount} provider(s) detected${selectedModel ? `, model ${selectedModel}.` : '.'}`
        : selectedModel ? `Selected model: ${selectedModel}.`
          : 'No provider connected yet.',
      actionLabel: providerCount > 0 || selectedModel ? undefined : 'Configure provider',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      description: 'Active directory, folder trust and read/write scope.',
      status: !workspacePath ? 'warn' : input.workspaceTrusted === false ? 'fail' : 'pass',
      detail: !workspacePath ? 'No folder workspace has been selected.'
        : input.workspaceTrusted === false ? `Workspace needs explicit trust: ${workspacePath}.`
          : `Active workspace: ${workspacePath}.`,
      actionLabel: !workspacePath ? 'Choose workspace' : input.workspaceTrusted === false ? 'Review trust' : undefined,
    },
    {
      id: 'permissions',
      label: 'Permissions',
      description: 'local token, sensitive scopes, approval and revocation.',
      status: input.tokenReady === false ? 'fail' : permissionIssueCount > 0 ? 'warn' : 'pass',
      detail: input.tokenReady === false ? 'local token is not ready.'
        : permissionIssueCount > 0
          ? `${permissionIssueCount} permission issue(s) need review.`
          : 'Token and sensitive permissions are consistent.',
      actionLabel: input.tokenReady === false ? 'Repair access' : permissionIssueCount > 0 ? 'Open permissions' : undefined,
    },
    {
      id: 'terminal',
      label: 'Terminal',
      description: 'Terminal backend for persistent workspace sessions.',
      status: terminalBackend === 'missing' || !terminalBackend ? 'warn' : 'pass',
      detail: terminalBackend === 'pty'
        ? 'Native PTY is available.'
        : terminalBackend === 'basic'
          ? 'Basic terminal is available; native PTY is not loaded.'
          : 'Terminal backend has not been confirmed.',
      actionLabel: terminalBackend === 'missing' || !terminalBackend ? 'Review terminal' : undefined,
    },
    {
      id: 'backend',
      label: 'local backend',
      description: 'local API, sessions, provider runtime and post-sleep recovery.',
      status: input.runtimeRunning && input.backendReachable !== false ? 'pass' : 'fail',
      detail: input.runtimeRunning && input.backendReachable !== false ? 'local backend is responding.'
        : 'local backend is not responding.',
      actionLabel: input.runtimeRunning && input.backendReachable !== false ? undefined : 'Start runtime',
    },
  ];

  return RUNTIME_DOCTOR_CHECK_ORDER
    .map(id => checks.find(check => check.id === id))
    .filter((check): check is RuntimeDoctorCheck => Boolean(check));
}

export function summarizeRuntimeDoctor(checks: RuntimeDoctorCheck[]): RuntimeDoctorSnapshot['summary'] {
  const passed = checks.filter(check => check.status === 'pass').length;
  const warnings = checks.filter(check => check.status === 'warn').length;
  const failures = checks.filter(check => check.status === 'fail').length;
  const total = checks.length;
  const message = failures > 0
    ? `${failures} blocker(s) must be resolved before trusted use.`
    : warnings > 0
      ? `${warnings} warning(s) deserve attention, but the desktop can operate.`
      : 'Runtime, workspace and trust are ready for daily use.';
  return { passed, warnings, failures, total, message };
}

export function detectRemoteDisplayFromEnv(env: Record<string, string | undefined>): RemoteDisplaySignal {
  const signals: string[] = [];
  const sessionName = String(env.SESSIONNAME || '').toLowerCase();
  if (sessionName.includes('rdp') || sessionName.includes('terminal')) {
    signals.push(`SESSIONNAME=${env.SESSIONNAME}`);
  }
  for (const key of ['SSH_TTY', 'SSH_CONNECTION', 'CHROME_REMOTE_DESKTOP_SESSION', 'VNCSESSION', 'WAYLAND_DISPLAY']) {
    if (env[key]) {
      signals.push(`${key}=set`);
    }
  }
  const remote = signals.length > 0;
  return {
    remote,
    severity: remote ? 'warning' : 'none',
    reason: remote ? 'Remote session detected; sensitive actions should require extra confirmation.'
      : 'No remote display signal detected.',
    signals,
  };
}

export function buildDesktopSafeModeState(input: {
  enabled?: boolean;
  reason?: string;
  startedAt?: string | null;
  remoteDisplay?: boolean;
}): DesktopSafeModeState {
  const enabled = Boolean(input.enabled);
  const restrictions = enabled
    ? [
        'Host commands require strong confirmation.',
        'Package installation is blocked until safe mode is disabled.',
        'Sensitive network actions are treated as high risk.',
      ]
    : [];
  return {
    enabled,
    reason: input.reason || (enabled
      ? input.remoteDisplay ? 'Safe mode is active because a remote session was detected.'
        : 'Safe mode is active manually.'
      : 'Safe mode is disabled.'),
    startedAt: input.startedAt || null,
    restrictions,
  };
}

function normalizeCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function normalizeString(value: unknown): string {
  return String(value || '').trim();
}
