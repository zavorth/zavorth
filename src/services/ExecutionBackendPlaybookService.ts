import {
  EXECUTION_BACKEND_PLAYBOOK_VERSION,
  type ExecutionBackendPlaybook,
  type ExecutionBackendPlaybookSnapshot,
  type ExecutionBackendPlaybookStatus,
  type ExecutionBackendStep,
  type ExecutionBackendStepStatus,
} from '../contracts/ExecutionBackendPlaybookContract.js';
import type {
  ZavorthTerminalBackendDescriptor,
  ZavorthTerminalBackendId,
  ZavorthTerminalBackendSnapshot,
} from '../contracts/ZavorthTerminalBackendsContract.js';
import { ZavorthTerminalBackendsService } from './ZavorthTerminalBackendsService.js';

type TerminalBackendsLike = Pick<ZavorthTerminalBackendsService, 'execute'>;

export type ExecutionBackendPlaybookInput = {
  backendId?: string | null;
};

type ExecutionBackendPlaybookDeps = {
  now?: () => Date;
  terminalBackendsService?: TerminalBackendsLike;
};

const STRONG_BACKENDS = new Set(['docker', 'wsl', 'vercel-sandbox']);

export class ExecutionBackendPlaybookService {
  private readonly now: () => Date;
  private readonly terminalBackendsService: TerminalBackendsLike;

  constructor(deps: ExecutionBackendPlaybookDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.terminalBackendsService = deps.terminalBackendsService || new ZavorthTerminalBackendsService();
  }

  public buildSnapshot(input: ExecutionBackendPlaybookInput = {}): ExecutionBackendPlaybookSnapshot {
    const selectedId = normalizeBackendId(input.backendId);
    const terminal = this.terminalBackendsService.execute({
      action: 'terminal.status',
      backend: selectedId,
    });
    const playbooks = terminal.backends.map((backend) => this.buildPlaybook(backend, terminal));
    const selected = selectedId
      ? playbooks.find((entry) => entry.backendId === selectedId) || null
      : null;
    const summary = {
      total: playbooks.length,
      needsConfiguration: playbooks.filter((entry) => entry.status === 'needs-configuration').length,
      previewReady: playbooks.filter((entry) => entry.status === 'ready-preview-only' || entry.status === 'ready-for-live-with-approval').length,
      liveReady: playbooks.filter((entry) => entry.liveReady).length,
      strongSandboxReady: playbooks.filter((entry) => STRONG_BACKENDS.has(entry.backendId) && entry.liveReady).length,
    };
    const status = summary.strongSandboxReady > 0
      ? 'ready'
      : summary.previewReady > 0
        ? 'attention'
        : 'needs-setup';
    return {
      generatedAt: this.now().toISOString(),
      version: EXECUTION_BACKEND_PLAYBOOK_VERSION,
      status,
      selected,
      playbooks,
      summary,
      operatorSummary:
        `${summary.total} backends cobertos; ${summary.needsConfiguration} need configuration, `
        + `${summary.previewReady} can plan, ${summary.liveReady} are live-ready e `
        + `${summary.strongSandboxReady} tem sandbox forte ready.`,
    };
  }

  public renderText(input: ExecutionBackendPlaybookInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth execution backend playbook',
      '',
      snapshot.operatorSummary,
      'mutation live nunca fica liberada por default.',
    ];
    if (!snapshot.selected) {
      lines.push(
        '',
        'Backends:',
        ...snapshot.playbooks.map((entry) =>
          `- ${entry.label}: ${entry.status}; next passo: ${entry.nextAction}`),
        '',
        'Use --backend <backend> para ver o roteiro completo.',
      );
      return lines.join('\n');
    }
    const selected = snapshot.selected;
    lines.push(
      '',
      `${selected.label} (${selected.backendId})`,
      selected.summary,
      `Isolamento: ${selected.isolation}.`,
      `Live ready: ${selected.liveReady ? 'yes' : 'no'}.`,
      selected.defaultBlockReason ? `block: ${selected.defaultBlockReason}` : 'block: mutation still requires approval.',
      `next passo: ${selected.nextAction}`,
      '',
      'Passos:',
      ...selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
      '',
      `Requisitos: ${selected.requiredInputKeys.join(', ') || 'nenhum'}.`,
      '',
      'Commands:',
      `- Inspecionar: ${selected.commands.inspect}`,
      `- Plan: ${selected.commands.plan}`,
      `- Doctor: ${selected.commands.doctor}`,
      `- Smoke forte: ${selected.commands.strongSmoke}`,
      `- Execution live: ${selected.commands.liveExecute}`,
    );
    return lines.join('\n');
  }

  private buildPlaybook(
    backend: ZavorthTerminalBackendDescriptor,
    terminal: ZavorthTerminalBackendSnapshot,
  ): ExecutionBackendPlaybook {
    const status = this.statusFor(backend);
    const commands = {
      inspect: 'npm run zavorth:terminal-backends:check --silent',
      plan: `zavorth execution-backends --backend ${backend.id} --command "npm test"`,
      doctor: `zavorth execution-backends --backend ${backend.id}`,
      strongSmoke: this.strongSmokeCommand(backend.id),
      liveExecute: `zavorth execution-backends --backend ${backend.id} --command "npm test" --live --approval-id <id>`,
    };
    const steps = this.stepsFor(backend, commands);
    return {
      backendId: backend.id,
      label: backend.label,
      status,
      backendStatus: backend.status === 'ready'
        ? 'backend-ready'
        : backend.status === 'planned'
          ? 'backend-planned'
          : 'backend-needs-configuration',
      isolation: backend.isolation,
      summary: this.summaryFor(backend),
      nextAction: this.nextAction(steps, backend),
      requiredInputKeys: backend.requiresConfiguration.slice(),
      liveReady: backend.liveReady,
      liveMutationAllowedByDefault: false,
      defaultBlockReason: backend.liveReady ? 'Live mutation still requires explicit live flag and scoped approval.'
        : `${backend.label} is not configured for live execution.`,
      commands,
      steps,
      safety: {
        noBackendLiveByDefault: terminal.safety.noBackendLiveByDefault,
        mutationRequiresApproval: terminal.safety.highRiskRequiresApproval,
        stdoutStderrRedacted: terminal.safety.stdoutStderrRedacted,
        dryRunWhenStrongSandboxMissing: true,
      },
    };
  }

  private statusFor(backend: ZavorthTerminalBackendDescriptor): ExecutionBackendPlaybookStatus {
    if (backend.status === 'planned') return 'planned';
    if (!backend.liveReady) return 'needs-configuration';
    return 'ready-for-live-with-approval';
  }

  private stepsFor(
    backend: ZavorthTerminalBackendDescriptor,
    commands: ExecutionBackendPlaybook['commands'],
  ): ExecutionBackendStep[] {
    const configured = backend.status === 'ready';
    const strong = STRONG_BACKENDS.has(backend.id);
    return [
      step('choose-backend', 'Choose execution backend', 'done', null, [
        `${backend.label} selecionado.`,
      ]),
      step('install-prerequisites', 'Instalar pre-requisitos', configured ? 'done' : 'next', null, backend.requiresConfiguration),
      step('configure-env', 'Configure local variables and credentials', configured ? 'done' : 'next', null, [
        'Credentials stay outside logs and receipts.',
      ]),
      step('run-doctor', 'run doctor/status', configured ? 'next' : 'blocked', commands.doctor, [
        'Doctor and status do not execute mutating commands.',
      ]),
      step('run-strong-smoke', 'run smoke forte do ambiente', configured && strong ? 'next' : strong ? 'blocked' : 'pending', commands.strongSmoke, [
        strong ? 'Proves real isolation before live mutation use.' : 'Useful backend, but not a strong sandbox by itself.',
      ]),
      step('set-live-flag', 'Activate live flag only when necessary', configured ? 'pending' : 'blocked', null, [
        'ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE=true remains separate from approval.',
      ]),
      step('execute-with-approval', 'run com approval escopado', configured ? 'pending' : 'blocked', commands.liveExecute, [
        'live mutation requires approval, live flag, and redacted receipt.',
      ]),
    ];
  }

  private strongSmokeCommand(backendId: ZavorthTerminalBackendId): string {
    if (backendId === 'docker') return 'npm run sandbox:doctor:smoke';
    if (backendId === 'wsl') return 'powershell -ExecutionPolicy Bypass -File scripts/sandbox-doctor-wsl.ps1';
    if (backendId === 'vercel-sandbox') return 'npm run zavorth:cloud-workspace-backends:check --silent';
    return 'npm run zavorth:terminal-backends:check --silent';
  }

  private summaryFor(backend: ZavorthTerminalBackendDescriptor): string {
    if (backend.liveReady) return `${backend.label} is ready for plans and approved live execution.`;
    if (backend.status === 'planned') return `${backend.label} is mapeado como futuro backend.`;
    return `${backend.label} needs configuration before live.`;
  }

  private nextAction(steps: ExecutionBackendStep[], backend: ZavorthTerminalBackendDescriptor): string {
    const next = steps.find((candidate) => candidate.status === 'next') || steps.find((candidate) => candidate.status === 'pending');
    if (next?.command) return `${next.label}: ${next.command}`;
    if (next) return next.label;
    return backend.nextCommand;
  }
}

function step(
  id: ExecutionBackendStep['id'],
  label: string,
  status: ExecutionBackendStepStatus,
  command: string | null,
  details: string[],
): ExecutionBackendStep {
  return { id, label, status, command, details };
}

function normalizeBackendId(value: string | null | undefined): ZavorthTerminalBackendId | null {
  const normalized = String(value || '').trim().toLowerCase();
  const known: ZavorthTerminalBackendId[] = ['local', 'docker', 'ssh', 'wsl', 'vercel-sandbox', 'modal', 'daytona'];
  return known.find((entry) => entry === normalized) || null;
}
