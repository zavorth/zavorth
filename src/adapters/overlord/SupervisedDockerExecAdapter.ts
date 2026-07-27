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

export class SupervisedDockerExecAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'docker-exec-supervised';
  public readonly label = 'Docker Exec Supervision Adapter';
  private readonly runner: ProcessRunner;
  private readonly activeProcesses = new Map<string, import('child_process').ChildProcess>();

  constructor(options: { runner?: ProcessRunner } = {}) {
    this.runner = options.runner || executeSupervisedProcess;
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'docker.exec' && decision.runtimeTarget === 'container';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const input = readStructuredInput(request.command, request.metadata || null);
    const action = stringField(input, 'action', 'dockerAction') || 'exec';
    const container = stringField(input, 'container', 'containerId', 'name');
    const execCommand = stringField(input, 'execCommand', 'program', 'command');
    const commandArgs = stringArrayField(input, 'args', 'commandArgs');
    const workdir = stringField(input, 'workdir', 'cwd');
    const user = stringField(input, 'user');

    if (action === 'inspect') {
      const result = await this.runner({
        executable: 'docker',
        args: ['ps', '--format', '{{.Names}}'],
        cwd: request.workspace || process.cwd(),
        timeoutMs: request.timeoutMs || null,
      });
      const containers = this.parseContainers(result.stdout);
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
          containers,
          containerCount: containers.length,
        },
      };
    }

    if (action === 'run') {
      const image = stringField(input, 'image');
      if (!image) {
        return {
          ok: false,
          errorCode: 'docker_image_required',
          errorMessage: 'docker.exec with action=run requires image in the structured payload.',
        };
      }

      const args = ['run', '-d'];
      if (stringField(input, 'remove', 'autoRemove', 'rm') !== 'false') {
        args.push('--rm');
      }
      if (container) {
        args.push('--name', container);
      }
      if (workdir) {
        args.push('--workdir', workdir);
      }
      if (user) {
        args.push('--user', user);
      }
      args.push(image);
      if (execCommand) {
        args.push(execCommand, ...commandArgs);
      }

      const result = await this.runner({
        executable: 'docker',
        args,
        cwd: request.workspace || process.cwd(),
        timeoutMs: request.timeoutMs || null,
      });
      const containerId = String(result.stdout || '').trim() || null;
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
          image,
          container: container || containerId,
          containerId,
          execCommand: execCommand || null,
          commandArgs,
          workdir: workdir || null,
          user: user || null,
          runtimeTarget: decision.runtimeTarget,
          exitCode: result.exitCode,
        },
      };
    }

    if (action === 'rm') {
      if (!container) {
        return {
          ok: false,
          errorCode: 'docker_scope_required',
          errorMessage: 'docker.exec with action=rm requires container in the structured payload.',
        };
      }

      const result = await this.runner({
        executable: 'docker',
        args: ['rm', '-f', container],
        cwd: request.workspace || process.cwd(),
        timeoutMs: request.timeoutMs || null,
      });
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
          container,
          runtimeTarget: decision.runtimeTarget,
          exitCode: result.exitCode,
        },
      };
    }

    if (action !== 'exec') {
      return {
        ok: false,
        errorCode: 'docker_action_rejected',
        errorMessage: `Invalid or unsupervised Docker action: "${action}". Use inspect or exec.`,
      };
    }
    if (!container || !execCommand) {
      return {
        ok: false,
        errorCode: 'docker_scope_required',
        errorMessage: 'docker.exec requires container and command in the structured payload.',
      };
    }

    const args = ['exec'];
    if (workdir) {
      args.push('--workdir', workdir);
    }
    if (user) {
      args.push('--user', user);
    }
    args.push(container, execCommand, ...commandArgs);

    const actionId = String(request.actionId || '').trim();
    const result = await this.runner({
      executable: 'docker',
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
        container,
        execCommand,
        commandArgs,
        workdir: workdir || null,
        user: user || null,
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
        errorCode: 'docker_cancel_unavailable',
        errorMessage: 'No active supervised Docker process was found for cancellation.',
      };
    }
    child.kill();
    this.activeProcesses.delete(normalized);
    return {
      ok: true,
      stdout: 'Supervised docker exec cancelled.',
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        actionId: normalized,
        cancellationReason: String(reason || '').trim() || null,
      },
    };
  }

  private parseContainers(stdout: string): string[] {
    return String(stdout || '')
      .split(/\r...\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
}
