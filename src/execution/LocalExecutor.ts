import { execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { Task } from '../contracts/TaskContract.js';
import {
  spawnNativeCommand,
  spawnShellCommand,
} from '../core/CommandSpawn.js';
import { DangerousCommandBlocker } from '../security/DangerousCommandBlocker.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { SandboxExecutionService } from '../services/SandboxExecutionService.js';

type ShellRunner = (
  executionCommand: string,
  cwd: string,
  timeoutMs: number,
  originalCommand: string,
) => Promise<{ stdout: string; stderr: string }>;

type StructuredCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  displayCommand: string,
) => Promise<{ stdout: string; stderr: string }>;

type LocalExecutorOptions = {
  sandboxExecution?: SandboxExecutionService;
  shellRunner?: ShellRunner;
  commandRunner?: StructuredCommandRunner;
};

export class LocalExecutor implements IExecutor {
  public readonly name = 'local';
  private readonly sandboxExecution: SandboxExecutionService;
  private readonly shellRunner: ShellRunner;
  private readonly commandRunner: StructuredCommandRunner;

  constructor(options: LocalExecutorOptions = {}) {
    this.sandboxExecution = options.sandboxExecution || new SandboxExecutionService();
    this.shellRunner = options.shellRunner || this.runShellCommand.bind(this);
    this.commandRunner = options.commandRunner || this.runStructuredCommand.bind(this);
  }

  public async executeDirect(
    task: Task,
    instructions: string[],
    workspace: string,
    dryRun = false,
  ): Promise<ExecutionResult> {
    const request: ExecutionRequest = {
      execution_id: uuidv4(),
      task_id: task.task_id,
      executor: 'local_executor',
      workspace,
      objective: task.normalized_message,
      instructions,
      allowed_paths: [],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 60,
      dry_run: dryRun,
      requires_backup: false,
      metadata: {},
    };

    return this.executeTask(request);
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.executeTask(request);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async executeTask(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = new Date();
    const result: ExecutionResult = {
      execution_id: uuidv4(),
      task_id: request.task_id,
      executor: 'local_executor',
      success: true,
      started_at: startTime.toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    };

    try {
      if (request.dry_run) {
        result.metadata.dry_run = true;
        result.finished_at = new Date().toISOString();
        return result;
      }

      const resolvedCwd = WorkspaceResolver.validate(request.workspace);
      const sandboxTier = this.sandboxExecution.resolveSandboxTier(request);
      const shouldSandbox = sandboxTier !== null;
      const dockerAvailable = this.sandboxExecution.isDockerAvailable();
      const firecrackerAvailable = this.sandboxExecution.isFirecrackerAvailable();

      // MicroVM required but neither Firecracker nor Docker available → block
      if (sandboxTier?.tier === 'microvm' && !firecrackerAvailable) {
        const sandboxError: Error & { code?: string } = new Error(
          'Execucao bloqueada: codigo de alto risco requer MicroVM (Firecracker), ' +
          'but the maximum runtime is not available on this host.',
        );
        sandboxError.code = 'SANDBOX_REQUIRED_MICROVM_UNAVAILABLE';
        throw sandboxError;
      }

      // Container required but Docker unavailable
      const canFallbackWithoutDocker =
        shouldSandbox &&
        !dockerAvailable &&
        !firecrackerAvailable &&
        sandboxTier?.tier !== 'microvm' &&
        this.hostDiagnosticFallbackAllowed(request) &&
        request.instructions.every((command) => this.canBypassDockerForSafeCommand(command, request));
      if (shouldSandbox && !dockerAvailable && !firecrackerAvailable && !canFallbackWithoutDocker) {
        const sandboxError: Error & { code?: string } = new Error(
          'Docker sandbox is required, but Docker is not available on this host.',
        );
        sandboxError.code = 'SANDBOX_REQUIRED_DOCKER_UNAVAILABLE';
        throw sandboxError;
      }

      if (canFallbackWithoutDocker) {
        result.actions_executed.push(
          '[SANDBOX-FALLBACK] Docker unavailable; running safe diagnostic command on the local host.',
        );
        result.metadata = {
          ...(result.metadata || {}),
          sandbox_fallback: {
            mode: 'host_safe_command',
            reason: 'docker_unavailable',
          },
          sandbox_tier: sandboxTier?.tier || 'none',
        };
      }

      if (request.instructions.length > 0) {
        for (const cmd of request.instructions) {
          DangerousCommandBlocker.validateOrThrow(cmd);
          const isMicrovm = sandboxTier?.tier === 'microvm' && firecrackerAvailable;
          const sandboxInvocation =
            shouldSandbox && !canFallbackWithoutDocker && !isMicrovm
              ? this.sandboxExecution.buildSandboxInvocation(cmd, resolvedCwd)
              : null;
          const executionCommand = isMicrovm ? `[MicroVM Firecracker] ${cmd}` : (sandboxInvocation?.displayCommand || cmd);
          result.commands_executed.push(executionCommand);

          let success = false;
          let retries = 0;
          const maxRetries = 1;

          while (retries <= maxRetries && !success) {
            try {
              const timeoutMs = request.timeout_seconds ? request.timeout_seconds * 1000 : 15_000;
              let stdout = '';
              let stderr = '';

              if (isMicrovm) {
                const fcResult = await this.sandboxExecution.executeCommandInMicrovm(
                  cmd,
                  timeoutMs,
                );
                stdout = fcResult.stdout;
                stderr = fcResult.stderr;
                if (fcResult.exitCode !== 0 && fcResult.exitCode !== null) {
                  throw new Error(`Command failed with code ${fcResult.exitCode}\n${stderr}`);
                }
              } else if (sandboxInvocation) {
                const res = await this.commandRunner(
                  sandboxInvocation.command,
                  sandboxInvocation.args,
                  resolvedCwd,
                  timeoutMs,
                  sandboxInvocation.displayCommand,
                );
                stdout = res.stdout;
                stderr = res.stderr;
              } else {
                const res = await this.shellRunner(executionCommand, resolvedCwd, timeoutMs, cmd);
                stdout = res.stdout;
                stderr = res.stderr;
              }

              result.stdout = (result.stdout || '') + stdout;
              result.stderr = (result.stderr || '') + stderr;
              result.actions_executed.push(`Ran shell: ${executionCommand}`);
              success = true;
            } catch (execErr: unknown) {
              const errMsg = execErr instanceof Error ? execErr.message : String(execErr || '');

              const missingModuleMatchPy = errMsg.match(/ModuleNotFoundError: No module named '([^']+)'/);
              if (missingModuleMatchPy && retries < maxRetries && (cmd.startsWith('python') || cmd.startsWith('py '))) {
                const pkg = missingModuleMatchPy[1];
                result.actions_executed.push(
                  `[Dependency Orchestrator] Python: module '${pkg}' is missing. Auto-install was removed by zero-trust policy; generate an installation proposal for human approval.`,
                );
                result.success = false;
                result.stderr = (result.stderr || '') + errMsg;
                result.error_message = `Missing Python dependency requires approval: ${pkg}`;
                break;
              }

              const missingModuleMatchNode = errMsg.match(/Cannot find module '([^']+)'/);
              if (missingModuleMatchNode && retries < maxRetries && (cmd.startsWith('node ') || cmd.startsWith('npx '))) {
                const pkg = missingModuleMatchNode[1];
                if (!pkg.startsWith('.')) {
                  result.actions_executed.push(
                    `[Dependency Orchestrator] Node.js: package '${pkg}' is missing. Auto-install was removed by zero-trust policy; generate an installation proposal for human approval.`,
                  );
                  result.success = false;
                  result.stderr = (result.stderr || '') + errMsg;
                  result.error_message = `Missing Node dependency requires approval: ${pkg}`;
                  break;
                }
              }

              result.success = false;
              result.stderr = (result.stderr || '') + errMsg;
              result.error_message = `Shell error on command: ${cmd}`;
              break;
            }
          }

          if (!result.success) {
            break;
          }
        }
      }
    } catch (error: unknown) {
      const executionError = error as { message?: unknown; code?: unknown };
      result.success = false;
      result.error_message = String(executionError.message || error || 'Execution failed');
      result.error_code = String(executionError.code || 'EXECUTION_FAILED');
    }

    result.finished_at = new Date().toISOString();
    return result;
  }

  private canBypassDockerForSafeCommand(command: string, request: ExecutionRequest): boolean {
    const normalized = String(command || '').trim();
    if (!normalized) {
      return false;
    }

    if (request.metadata?.untrustedContent === true) {
      return false;
    }

    if (/&&|\|\||[|><`;\r\n]/.test(normalized) || /\$\(/.test(normalized)) {
      return false;
    }

    if (
      /\b(curl|wget|invoke-webrequest|npm\s+install|pnpm\s+install|yarn\s+add|pip(?:3)?\s+install|apt(?:-get)?\s+install|docker|choco|winget|scp|ssh|ftp|powershell|pwsh|reg|netsh)\b/i.test(
        normalized,
      )
    ) {
      return false;
    }

    return /^(dir\b|ls\b|pwd\b|cd\b|whoami\b|hostname\b|where\b|which\b|git\s+status\b|git\s+diff(?:\s+--stat)?\b|node\s+-v\b|npm\s+-v\b|pnpm\s+-v\b|yarn\s+-v\b|python(?:3)?\s+--version\b|py\s+-V\b)/i.test(
      normalized,
    );
  }

  private hostDiagnosticFallbackAllowed(request: ExecutionRequest): boolean {
    return (
      request.metadata?.allowHostDiagnosticFallback === true ||
      process.env.ZAVORTH_LOCAL_EXECUTOR_HOST_DIAGNOSTIC_BREAK_GLASS === 'true'
    );
  }

  private runShellCommand(
    executionCommand: string,
    cwd: string,
    timeoutMs: number,
    originalCommand: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawnShellCommand(executionCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        try {
          if (process.platform === 'win32' && child.pid) {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        } catch {
          // ignore timeout kill errors
        }
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${originalCommand}`));
      }, timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}\n${stderr}`));
          return;
        }

        resolve({ stdout, stderr });
      });
    });
  }

  private runStructuredCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    displayCommand: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawnNativeCommand(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        try {
          if (process.platform === 'win32' && child.pid) {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        } catch {
          // ignore timeout kill errors
        }
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${displayCommand}`));
      }, timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}\n${stderr}`));
          return;
        }

        resolve({ stdout, stderr });
      });
    });
  }

}
