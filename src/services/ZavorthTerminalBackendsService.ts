import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

import {
  ZAVORTH_TERMINAL_BACKENDS_CONTRACT_VERSION,
  type ZavorthTerminalBackendAction,
  type ZavorthTerminalBackendDescriptor,
  type ZavorthTerminalBackendId,
  type ZavorthTerminalBackendInput,
  type ZavorthTerminalBackendReceipt,
  type ZavorthTerminalBackendSnapshot,
  type ZavorthTerminalBackendStatus,
  type ZavorthTerminalCommandRisk,
} from '../contracts/ZavorthTerminalBackendsContract.js';

type RunnerInput = {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env: Record<string, string | undefined>;
};

type RunnerOutput = {
  status: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

type TerminalBackendsDeps = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  cwd?: string;
  runner?: (input: RunnerInput) => RunnerOutput;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const OUTPUT_PREVIEW_LIMIT = 4_000;
const LIVE_ENABLE_ENV = 'ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE';

const BACKEND_ORDER: ZavorthTerminalBackendId[] = [
  'local',
  'docker',
  'ssh',
  'wsl',
  'vercel-sandbox',
  'modal',
  'daytona',
];

export class ZavorthTerminalBackendsService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly runner: (input: RunnerInput) => RunnerOutput;

  public constructor(deps: TerminalBackendsDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.cwd = path.resolve(deps.cwd || process.cwd());
    this.runner = deps.runner || defaultRunner;
  }

  public execute(input: ZavorthTerminalBackendInput = {}): ZavorthTerminalBackendSnapshot {
    const action = normalizeAction(input.action);
    const selectedBackend = normalizeBackend(input.backend);
    const workspace = path.resolve(input.workspace || this.cwd);
    const timeoutMs = normalizeTimeout(input.timeoutMs);
    const command = normalizeCommand(input.command);
    const risk = classifyCommandRisk(command);
    const approvalRequired = Boolean(command) && requiresApproval(risk);
    const approvalPresent = Boolean(String(input.approvalId || '').trim());
    const backends = this.buildBackends(input);
    const backend = backends.find((entry) => entry.id === selectedBackend) || backends[0]!;
    const receipts: ZavorthTerminalBackendReceipt[] = [
      receipt('backend', 'done', `${backend.label} resolved as ${backend.status}; liveReady=${backend.liveReady}.`),
    ];

    if (!command || action === 'terminal.status') {
      receipts.push(receipt('policy', 'done', 'Status inspection is read-only and does not execute terminal commands.'));
      return this.buildSnapshot({
        action,
        status: backend.status === 'planned' ? 'planned' : 'preview',
        selectedBackend,
        command,
        risk,
        approvalRequired: false,
        timeoutMs,
        workspace,
        backends,
        plan: {
          mode: 'status-only',
          executable: null,
          args: [],
          displayCommand: null,
          backendConfigured: backend.status === 'ready',
          willExecute: false,
          reason: 'No command was provided; returning backend readiness and safety metadata.',
        },
        execution: emptyExecution(false),
        receipts,
      });
    }

    const envelope = buildEnvelope({
      backend: selectedBackend,
      command,
      workspace,
      timeoutMs,
      input,
      env: this.env,
    });
    receipts.push(receipt('command-plan', 'done', `${risk} command prepared for ${selectedBackend} with structured executable/args.`));

    if (backend.status === 'planned') {
      receipts.push(receipt('policy', 'skipped', `${backend.label} is a planned backend; no live execution path is claimed yet.`));
      return this.buildSnapshot({
        action,
        status: 'planned',
        selectedBackend,
        command,
        risk,
        approvalRequired,
        timeoutMs,
        workspace,
        backends,
        plan: {
          ...envelope,
          mode: 'preview',
          backendConfigured: false,
          willExecute: false,
          reason: `${backend.label} is tracked as a future backend. Use local, Docker, SSH, WSL or Vercel Sandbox today.`,
        },
        execution: emptyExecution(false),
        receipts,
      });
    }

    if (!backend.liveReady && input.live) {
      receipts.push(receipt('policy', 'blocked', `${backend.label} is not configured for live execution.`));
      return this.buildSnapshot({
        action,
        status: 'needs-configuration',
        selectedBackend,
        command,
        risk,
        approvalRequired,
        timeoutMs,
        workspace,
        backends,
        plan: {
          ...envelope,
          mode: 'live-disabled',
          backendConfigured: false,
          willExecute: false,
          reason: `${backend.label} needs configuration before live execution.`,
        },
        execution: emptyExecution(true),
        receipts,
      });
    }

    if (approvalRequired && !approvalPresent) {
      receipts.push(receipt('approval', 'approval-required', `${risk} terminal command requires scoped approval before execution.`));
      return this.buildSnapshot({
        action,
        status: 'approval-required',
        selectedBackend,
        command,
        risk,
        approvalRequired,
        timeoutMs,
        workspace,
        backends,
        plan: {
          ...envelope,
          mode: 'approval-required',
          backendConfigured: backend.liveReady,
          willExecute: false,
          reason: 'Sensitive terminal work waits for owner approval and a receiptable backend.',
        },
        execution: emptyExecution(false),
        receipts,
      });
    }

    const liveEnabled = this.env[LIVE_ENABLE_ENV] === '1' || this.env[LIVE_ENABLE_ENV] === 'true';
    if (input.live && !liveEnabled) {
      receipts.push(receipt('policy', 'blocked', `${LIVE_ENABLE_ENV}=true is required in addition to approval for live terminal execution.`));
      return this.buildSnapshot({
        action,
        status: 'blocked',
        selectedBackend,
        command,
        risk,
        approvalRequired,
        timeoutMs,
        workspace,
        backends,
        plan: {
          ...envelope,
          mode: 'live-disabled',
          backendConfigured: backend.liveReady,
          willExecute: false,
          reason: 'Live terminal execution is disabled by default; this avoids accidental host authority.',
        },
        execution: emptyExecution(true),
        receipts,
      });
    }

    if (input.live && action === 'terminal.execute') {
      const result = this.runner({
        executable: envelope.executable!,
        args: envelope.args,
        cwd: workspace,
        timeoutMs,
        env: this.env,
      });
      const execution = {
        attempted: true,
        performed: true,
        exitCode: result.status,
        stdoutPreview: redactPreview(result.stdout),
        stderrPreview: redactPreview(result.stderr),
        error: result.error,
      };
      receipts.push(receipt('execution', result.status === 0 ? 'done' : 'blocked', result.status === 0
        ? `${selectedBackend} command completed with redacted output receipt.`
        : `${selectedBackend} command exited non-zero or failed; output was redacted.`));
      receipts.push(receipt('redaction', 'done', 'stdout/stderr previews are redacted before serialization.'));
      return this.buildSnapshot({
        action,
        status: result.status === 0 ? 'executed' : 'blocked',
        selectedBackend,
        command,
        risk,
        approvalRequired,
        timeoutMs,
        workspace,
        backends,
        plan: {
          ...envelope,
          mode: 'execute',
          backendConfigured: true,
          willExecute: true,
          reason: 'Live execution was explicitly enabled, approved and receiptable.',
        },
        execution,
        receipts,
      });
    }

    receipts.push(receipt('policy', 'done', 'Command plan is ready; use --live with approval after reviewing risk and backend.'));
    return this.buildSnapshot({
      action,
      status: 'preview',
      selectedBackend,
      command,
      risk,
      approvalRequired,
      timeoutMs,
      workspace,
      backends,
      plan: {
        ...envelope,
        mode: 'preview',
        backendConfigured: backend.liveReady,
        willExecute: false,
        reason: 'Preview-only terminal plan. Nothing has executed.',
      },
      execution: emptyExecution(false),
      receipts,
    });
  }

  public formatSnapshotText(snapshot: ZavorthTerminalBackendSnapshot): string {
    return [
      'Zavorth Terminal Backends',
      '',
      `Status: ${snapshot.status}`,
      `Backend: ${snapshot.selectedBackend}`,
      `Command: ${snapshot.command.redacted || 'none'}`,
      `Risk: ${snapshot.command.risk}`,
      `Plan: ${snapshot.plan.mode} | ${snapshot.plan.reason}`,
      '',
      'Backends:',
      ...snapshot.backends.map((backend) =>
        `- ${backend.id}: ${backend.status} | ${backend.isolation} | liveReady=${backend.liveReady}`),
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private buildBackends(input: ZavorthTerminalBackendInput): ZavorthTerminalBackendDescriptor[] {
    const dockerImage = String(input.dockerImage || this.env.ZAVORTH_TERMINAL_DOCKER_IMAGE || this.env.ZAVORTH_CONTAINER_IMAGE || 'node:22-bookworm').trim();
    const sshHost = String(input.sshHost || this.env.ZAVORTH_SSH_HOST || '').trim();
    const wslDistro = String(input.wslDistro || this.env.ZAVORTH_WSL_DISTRO || '').trim();
    const vercelReady = isTruthy(this.env.ZAVORTH_VERCEL_SANDBOX_ENABLED) && Boolean(this.env.VERCEL_TOKEN);
    return [
      descriptor({
        id: 'local',
        label: 'Local supervised shell',
        status: 'ready',
        isolation: 'host-process',
        liveCapable: true,
        liveReady: true,
        requiresConfiguration: [],
        defaultCommand: process.platform === 'win32' ? 'powershell.exe -NoProfile -Command <command>' : 'sh -lc <command>',
        nextCommand: 'zavorth execution-backends --backend local --command "npm test"',
        limitations: ['No OS sandbox; mutation commands still require approval and receipts.'],
      }),
      descriptor({
        id: 'docker',
        label: 'Docker container',
        status: isTruthy(this.env.ZAVORTH_DOCKER_ENABLED) || Boolean(this.env.DOCKER_HOST) ? 'ready' : 'needs-configuration',
        isolation: 'container',
        liveCapable: true,
        liveReady: isTruthy(this.env.ZAVORTH_DOCKER_ENABLED) || Boolean(this.env.DOCKER_HOST),
        requiresConfiguration: ['Docker daemon reachable', `container image (${dockerImage})`],
        defaultCommand: `docker run --rm --network none -v <workspace>:/workspace -w /workspace ${dockerImage} sh -lc <command>`,
        nextCommand: 'set ZAVORTH_DOCKER_ENABLED=true and run zavorth execution-backends --backend docker',
        limitations: ['Network is disabled by default; install/network commands require a separate policy decision.'],
      }),
      descriptor({
        id: 'ssh',
        label: 'SSH remote shell',
        status: sshHost ? 'ready' : 'needs-configuration',
        isolation: 'remote-shell',
        liveCapable: true,
        liveReady: Boolean(sshHost),
        requiresConfiguration: ['ZAVORTH_SSH_HOST', 'SSH key or agent outside prompt/logs'],
        defaultCommand: 'ssh <host> -- <command>',
        nextCommand: 'set ZAVORTH_SSH_HOST and run zavorth execution-backends --backend ssh',
        limitations: ['Remote filesystem scope must be approved; no secrets are serialized into command previews.'],
      }),
      descriptor({
        id: 'wsl',
        label: 'WSL Linux runtime',
        status: process.platform === 'win32' ? 'ready' : 'needs-configuration',
        isolation: 'linux-vm',
        liveCapable: true,
        liveReady: process.platform === 'win32',
        requiresConfiguration: wslDistro ? ['wsl.exe available'] : ['wsl.exe available', 'optional ZAVORTH_WSL_DISTRO'],
        defaultCommand: 'wsl.exe [-d <distro>] -- sh -lc <command>',
        nextCommand: 'zavorth execution-backends --backend wsl --command "npm test"',
        limitations: ['Workspace path translation depends on the host WSL installation.'],
      }),
      descriptor({
        id: 'vercel-sandbox',
        label: 'Vercel Sandbox',
        status: vercelReady ? 'ready' : 'needs-configuration',
        isolation: 'managed-cloud-sandbox',
        liveCapable: true,
        liveReady: vercelReady,
        requiresConfiguration: ['VERCEL_TOKEN', 'ZAVORTH_VERCEL_SANDBOX_ENABLED=true'],
        defaultCommand: 'vercel sandbox exec <command>',
        nextCommand: 'configure Vercel Sandbox credentials and run zavorth execution-backends --backend vercel-sandbox',
        limitations: ['Cloud egress, artifacts and billing must remain behind explicit policy and receipts.'],
      }),
      descriptor({
        id: 'modal',
        label: 'Modal backend',
        status: 'planned',
        isolation: 'planned-cloud-workspace',
        liveCapable: false,
        liveReady: false,
        requiresConfiguration: ['planned adapter'],
        defaultCommand: 'planned',
        nextCommand: 'Use local, Docker, SSH, WSL or Vercel Sandbox until Modal is implemented.',
        limitations: ['Tracked for future support; no live claim today.'],
      }),
      descriptor({
        id: 'daytona',
        label: 'Daytona workspace',
        status: 'planned',
        isolation: 'planned-cloud-workspace',
        liveCapable: false,
        liveReady: false,
        requiresConfiguration: ['planned adapter'],
        defaultCommand: 'planned',
        nextCommand: 'Use local, Docker, SSH, WSL or Vercel Sandbox until Daytona is implemented.',
        limitations: ['Tracked for future support; no live claim today.'],
      }),
    ];
  }

  private buildSnapshot(input: {
    action: ZavorthTerminalBackendAction;
    status: ZavorthTerminalBackendStatus;
    selectedBackend: ZavorthTerminalBackendId;
    command: string | null;
    risk: ZavorthTerminalCommandRisk;
    approvalRequired: boolean;
    timeoutMs: number;
    workspace: string;
    backends: ZavorthTerminalBackendDescriptor[];
    plan: ZavorthTerminalBackendSnapshot['plan'];
    execution: ZavorthTerminalBackendSnapshot['execution'];
    receipts: ZavorthTerminalBackendReceipt[];
  }): ZavorthTerminalBackendSnapshot {
    return {
      contractVersion: ZAVORTH_TERMINAL_BACKENDS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthTerminalBackendsService',
      action: input.action,
      status: input.status,
      selectedBackend: input.selectedBackend,
      command: {
        raw: input.command,
        redacted: input.command ? redactSecrets(input.command) : null,
        risk: input.risk,
        approvalRequired: input.approvalRequired,
        timeoutMs: input.timeoutMs,
        workspace: input.workspace,
      },
      plan: input.plan,
      execution: input.execution,
      backends: input.backends,
      receipts: input.receipts,
      safety: {
        noBackendLiveByDefault: true,
        highRiskRequiresApproval: true,
        backendConfigRequiredForRemoteExecution: true,
        commandEnvelopeUsesStructuredArgs: true,
        stdoutStderrRedacted: true,
        receiptsRequired: true,
        plannedBackendsDoNotClaimLive: true,
      },
      commands: {
        status: 'zavorth execution-backends',
        plan: 'zavorth execution-backends --backend docker --command "npm test"',
        execute: 'zavorth execution-backends --backend local --command "npm test" --live --approval-id <id>',
      },
      nextSafeAction: nextSafeAction(input.status, input.selectedBackend),
    };
  }
}

function normalizeAction(value: ZavorthTerminalBackendInput['action']): ZavorthTerminalBackendAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'execute' || normalized === 'terminal.execute') return 'terminal.execute';
  if (normalized === 'plan' || normalized === 'terminal.plan') return 'terminal.plan';
  return 'terminal.status';
}

function normalizeBackend(value: ZavorthTerminalBackendInput['backend']): ZavorthTerminalBackendId {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'local' || normalized === 'local-supervised') return 'local';
  if (BACKEND_ORDER.includes(normalized as ZavorthTerminalBackendId)) return normalized as ZavorthTerminalBackendId;
  return 'local';
}

function normalizeCommand(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeTimeout(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(number), 1_000), 15 * 60_000);
}

function classifyCommandRisk(command: string | null): ZavorthTerminalCommandRisk {
  const text = String(command || '').trim().toLowerCase();
  if (!text) return 'read-only';
  if (/\b(rm\s+-rf|del\s+\/[fsq]|format\s+[a-z]:|diskpart|mkfs|dd\s+if=|drop\s+table|truncate\s+table)\b/.test(text)) {
    return 'dangerous';
  }
  if (/\b(npm\s+(i|install)|pnpm\s+(i|install)|yarn\s+add|pip\s+install|cargo\s+install|curl\b.*\|\s*(bash|sh|pwsh|powershell)|wget\b.*\|\s*(bash|sh))\b/.test(text)) {
    return 'network-or-install';
  }
  if (/\b(git\s+push|git\s+commit|git\s+reset|git\s+clean|mv\s+|cp\s+|copy\s+|move\s+|mkdir\s+|rmdir\s+|touch\s+|echo\b.*>|setx\b|npm\s+run\s+build|npm\s+test|jest|tsc)\b/.test(text)) {
    return 'workspace-mutation';
  }
  return 'read-only';
}

function requiresApproval(risk: ZavorthTerminalCommandRisk): boolean {
  return risk !== 'read-only';
}

function buildEnvelope(input: {
  backend: ZavorthTerminalBackendId;
  command: string;
  workspace: string;
  timeoutMs: number;
  input: ZavorthTerminalBackendInput;
  env: Record<string, string | undefined>;
}): Pick<ZavorthTerminalBackendSnapshot['plan'], 'executable' | 'args' | 'displayCommand'> {
  const command = input.command;
  if (input.backend === 'local') {
    if (process.platform === 'win32') {
      return {
        executable: 'powershell.exe',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
        displayCommand: `powershell.exe -NoProfile -Command ${quoteDisplay(command)}`,
      };
    }
    return {
      executable: 'sh',
      args: ['-lc', command],
      displayCommand: `sh -lc ${quoteDisplay(command)}`,
    };
  }
  if (input.backend === 'docker') {
    const image = String(input.input.dockerImage || input.env.ZAVORTH_TERMINAL_DOCKER_IMAGE || input.env.ZAVORTH_CONTAINER_IMAGE || 'node:22-bookworm');
    return {
      executable: 'docker',
      args: [
        'run',
        '--rm',
        '--network',
        'none',
        '--cpus',
        '1',
        '--memory',
        '1g',
        '-v',
        `${input.workspace}:/workspace`,
        '-w',
        '/workspace',
        image,
        'sh',
        '-lc',
        command,
      ],
      displayCommand: `docker run --rm --network none -v <workspace>:/workspace -w /workspace ${image} sh -lc ${quoteDisplay(command)}`,
    };
  }
  if (input.backend === 'ssh') {
    const host = String(input.input.sshHost || input.env.ZAVORTH_SSH_HOST || '<host>');
    return {
      executable: 'ssh',
      args: [host, '--', command],
      displayCommand: `ssh ${host} -- ${quoteDisplay(command)}`,
    };
  }
  if (input.backend === 'wsl') {
    const distro = String(input.input.wslDistro || input.env.ZAVORTH_WSL_DISTRO || '').trim();
    const args = distro ? ['-d', distro, '--', 'sh', '-lc', command] : ['--', 'sh', '-lc', command];
    return {
      executable: 'wsl.exe',
      args,
      displayCommand: `wsl.exe ${distro ? `-d ${distro} ` : ''}-- sh -lc ${quoteDisplay(command)}`,
    };
  }
  if (input.backend === 'vercel-sandbox') {
    return {
      executable: String(input.env.ZAVORTH_VERCEL_SANDBOX_CLI || 'vercel'),
      args: ['sandbox', 'exec', '--', command],
      displayCommand: 'vercel sandbox exec -- <command>',
    };
  }
  return {
    executable: null,
    args: [],
    displayCommand: null,
  };
}

function descriptor(input: ZavorthTerminalBackendDescriptor): ZavorthTerminalBackendDescriptor {
  return input;
}

function emptyExecution(attempted: boolean): ZavorthTerminalBackendSnapshot['execution'] {
  return {
    attempted,
    performed: false,
    exitCode: null,
    stdoutPreview: null,
    stderrPreview: null,
    error: null,
  };
}

function defaultRunner(input: RunnerInput): RunnerOutput {
  const result: SpawnSyncReturns<string> = spawnSync(input.executable, input.args, {
    cwd: input.cwd,
    env: input.env as NodeJS.ProcessEnv,
    encoding: 'utf8',
    shell: false,
    timeout: input.timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

function receipt(
  kind: ZavorthTerminalBackendReceipt['kind'],
  status: ZavorthTerminalBackendReceipt['status'],
  summary: string,
): ZavorthTerminalBackendReceipt {
  return {
    id: `terminal-${kind}-${crypto.createHash('sha256').update(`${kind}:${status}:${summary}`).digest('hex').slice(0, 12)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function nextSafeAction(status: ZavorthTerminalBackendStatus, backend: ZavorthTerminalBackendId): string {
  if (status === 'approval-required') {
    return `Review the ${backend} command plan, then approve with a scoped approval id.`;
  }
  if (status === 'needs-configuration') {
    return `Configure ${backend} credentials/runtime, then rerun zavorth execution-backends --backend ${backend}.`;
  }
  if (status === 'planned') {
    return 'Use local, Docker, SSH, WSL or Vercel Sandbox today; Modal/Daytona remain future adapters.';
  }
  if (status === 'blocked') {
    return 'Inspect the policy receipt; live terminal execution stays disabled until explicitly enabled and approved.';
  }
  return 'Use --command for a preview, then --live --approval-id <id> only after reviewing the plan.';
}

function quoteDisplay(value: string): string {
  return `"${redactSecrets(value).replace(/"/g, '\\"')}"`;
}

function redactPreview(value: string): string | null {
  const redacted = redactSecrets(value || '').slice(0, OUTPUT_PREVIEW_LIMIT);
  return redacted || null;
}

function redactSecrets(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[redacted-secret]')
    .replace(/\bhf_[A-Za-z0-9]{20,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{25,}\b/g, '[redacted-secret]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\b/g, '[redacted-secret]');
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}
