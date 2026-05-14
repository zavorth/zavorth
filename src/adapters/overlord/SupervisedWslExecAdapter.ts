import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import {
  readStructuredInput,
  stringArrayField,
  stringField,
} from './SupervisedAdapterInput.js';
import {
  executeSupervisedProcess,
  type SupervisedProcessExecutionResult,
} from './SupervisedProcessExecution.js';

type ProcessRunner = (input: {
  executable: string;
  args: string[];
  cwd?: string | null;
  timeoutMs?: number | null;
  onSpawn?: ((child: import('child_process').ChildProcess) => void) | null;
}) => Promise<SupervisedProcessExecutionResult>;

export class SupervisedWslExecAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'wsl-exec-supervised';
  public readonly label = 'WSL Exec Supervision Adapter';
  private readonly runner: ProcessRunner;
  private readonly platform: NodeJS.Platform;
  private readonly activeProcesses = new Map<string, import('child_process').ChildProcess>();

  constructor(options: { runner?: ProcessRunner; platform?: NodeJS.Platform } = {}) {
    this.runner = options.runner || executeSupervisedProcess;
    this.platform = options.platform || process.platform;
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'wsl.exec' && decision.runtimeTarget === 'wsl';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    if (this.platform !== 'win32') {
      return {
        ok: false,
        errorCode: 'wsl_windows_required',
        errorMessage: 'wsl.exec supervisionado requer host Windows com WSL instalado.',
      };
    }

    const input = readStructuredInput(request.command, request.metadata || null);
    const action = stringField(input, 'action', 'wslAction') || 'exec';
    const distribution = stringField(input, 'distribution', 'distro');
    const execCommand = stringField(input, 'execCommand', 'program', 'command');
    const commandArgs = stringArrayField(input, 'args', 'commandArgs');
    const workdir = stringField(input, 'workdir', 'cwd');

    if (action === 'inspect') {
      const result = await this.runner({
        executable: 'wsl',
        args: ['-l', '-q'],
        cwd: request.workspace || process.cwd(),
        timeoutMs: request.timeoutMs || null,
      });
      const distributions = this.parseDistributions(result.stdout);
      return {
        ok: result.ok,
        stdout: result.stdout || null,
        stderr: result.stderr || null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        rollbackAvailable: false,
        metadata: {
          adapterId: this.id,
          action,
          runtimeTarget: decision.runtimeTarget,
          exitCode: result.exitCode,
          distributions,
          distributionCount: distributions.length,
          defaultDistribution: distributions[0] || null,
        },
      };
    }

    if (action !== 'exec') {
      return {
        ok: false,
        errorCode: 'wsl_action_rejected',
        errorMessage: `Acao WSL invalida ou nao supervisionada: "${action}". Use inspect ou exec.`,
      };
    }
    if (!execCommand) {
      return {
        ok: false,
        errorCode: 'wsl_command_required',
        errorMessage: 'wsl.exec exige command em payload estruturado.',
      };
    }

    const args: string[] = [];
    if (distribution) {
      args.push('-d', distribution);
    }
    if (workdir) {
      args.push('--cd', workdir);
    }
    args.push('--', execCommand, ...commandArgs);

    const actionId = String(request.actionId || '').trim();
    const result = await this.runner({
      executable: 'wsl',
      args,
      cwd: request.workspace || process.cwd(),
      timeoutMs: request.timeoutMs || null,
      onSpawn: actionId
        ? (child) => {
          this.activeProcesses.set(actionId, child);
        }
        : null,
    });
    if (actionId) {
      this.activeProcesses.delete(actionId);
    }

    return {
      ok: result.ok,
      stdout: result.stdout || null,
      stderr: result.stderr || null,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        action,
        distribution: distribution || null,
        execCommand,
        commandArgs,
        workdir: workdir || null,
        runtimeTarget: decision.runtimeTarget,
        exitCode: result.exitCode,
      },
    };
  }

  public async cancel(actionId: string, reason?: string | null): Promise<SystemOverlordAdapterResult> {
    const normalized = String(actionId || '').trim();
    const child = this.activeProcesses.get(normalized);
    if (!child) {
      return {
        ok: false,
        errorCode: 'wsl_cancel_unavailable',
        errorMessage: 'Nenhum processo WSL supervisionado ativo foi encontrado para cancelamento.',
      };
    }
    child.kill();
    this.activeProcesses.delete(normalized);
    return {
      ok: true,
      stdout: 'wsl exec supervisionado cancelado.',
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        actionId: normalized,
        cancellationReason: String(reason || '').trim() || null,
      },
    };
  }

  private parseDistributions(stdout: string): string[] {
    const normalized = String(stdout || '').replace(/\u0000/g, '');
    return normalized
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
}
