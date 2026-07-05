import { config } from '../../../../config/index.js';
import { ExecutionRequest } from '../../../../contracts/ExecutionContract.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { ZavorthBridgeCliAdapter } from '../../../../agents/ZavorthBridgeCliAdapter.js';
import { CodexCliAdapter } from '../../../../agents/CodexCliAdapter.js';
import { LocalExecutor } from '../../../../execution/LocalExecutor.js';
import { ExternalExecutor } from '../../../../execution/ExternalExecutor.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { logger } from '../../../../logger.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  getExternalExecutorTimeoutSeconds,
} from '../../../../gateways/channels/telegram/ExternalExecutorIdentity.js';

type StoreExecutionResultFn = (task: Task, result: unknown) => void;
type FormatExecutionOutputFn = (label: string, workspace: string, result: unknown) => string;
type ModeManagerLike = {
  getMode(): string;
  isSufficientFor(capability: string): boolean;
};
type PolicyEngineLike = {
  isCommandBlocked(command: string): boolean;
};

export type TelegramExecutionDirectServiceDeps = {
  auditLogger: AuditLogger;
  storeExecutionResult: StoreExecutionResultFn;
  formatExecutionOutput: FormatExecutionOutputFn;
};

export class TelegramExecutionDirectService {
  constructor(private readonly deps: TelegramExecutionDirectServiceDeps) {}

  public async executeZavorthBridge(task: Task, payload: string): Promise<{ output: string; success: boolean }> {
    const adapter = new ZavorthBridgeCliAdapter();
    const result = await adapter.executePrompt(task, payload, task.workspace);
    return {
      output: [
        'Real ZavorthBridge invoked.',
        `Mode: ${result.metadata?.delivery_mode === 'companion-reuse' ? 'active session reused' : 'app opened by CLI'}`,
        `Workspace: ${task.workspace}`,
        `Preferred model: ${result.metadata?.preferred_model || 'not set'}`,
        `Handoff: ${result.metadata.handoff_file}`,
        `Tracking: ${result.metadata.tracking_file}`,
        `Zavorth will track real ZavorthBridge artifacts and use ${result.metadata.response_file} only as fallback.`,
      ].join('\n'),
      success: result.success,
    };
  }

  public async executeCodexDirect(
    task: Task,
    payload: string,
    modeManager: ModeManagerLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!modeManager.isSufficientFor('exec')) {
      return {
        output: `Insufficient operational mode to run Codex.\nCurrent mode: ${modeManager.getMode()}\nMinimum required: BUILD\n\nUse /mode BUILD to enable it.`,
        success: false,
      };
    }

    const adapter = new CodexCliAdapter();
    const result = await adapter.executePrompt(task, payload, task.workspace);
    return {
      output: this.deps.formatExecutionOutput('Codex CLI', task.workspace || config.defaultWorkspace, result),
      success: result.success,
    };
  }

  public async executeExternalExecutorDirect(
    task: Task,
    payload: string,
    isDryRun: boolean,
    modeManager: ModeManagerLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!modeManager.isSufficientFor('exec')) {
      return {
        output: `Insufficient operational mode to run ${EXTERNAL_EXECUTOR_LABEL}.\nCurrent mode: ${modeManager.getMode()}\nMinimum required: BUILD\n\nUse /mode BUILD to enable it.`,
        success: false,
      };
    }

    const executor = new ExternalExecutor();
    const available = await executor.isAvailable();
    if (!available) {
      return {
        output: `${EXTERNAL_EXECUTOR_LABEL} is unavailable on this host.\nCheck WSL, the external executor PATH, and runtime variables before trying again.`,
        success: false,
      };
    }

    const workspace = task.workspace || config.defaultWorkspace;
    const request: ExecutionRequest = {
      execution_id: `${task.task_id}-external`,
      task_id: task.task_id,
      executor: EXTERNAL_EXECUTOR_ID,
      workspace,
      objective: payload || task.normalized_message || 'Execute the task delegated by Zavorth.',
      instructions: payload ? [payload] : [],
      allowed_paths: [workspace],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: getExternalExecutorTimeoutSeconds(),
      dry_run: isDryRun,
      requires_backup: false,
      metadata: {
        task_command_type: task.command_type,
      },
    };

    const result = await executor.execute(request);
    task.executor_used = EXTERNAL_EXECUTOR_ID;
    return {
      output: this.deps.formatExecutionOutput(EXTERNAL_EXECUTOR_LABEL, workspace, result),
      success: result.success,
    };
  }

  public async executeLocalShell(
    task: Task,
    command: string,
    workspace: string,
    isDryRun: boolean,
    modeManager: ModeManagerLike,
    policyEngine: PolicyEngineLike,
  ): Promise<{ output: string; success: boolean }> {
    if (!isDryRun && !modeManager.isSufficientFor('exec')) {
      return {
        output: `Insufficient operational mode to run shell commands.\nCurrent mode: ${modeManager.getMode()}\nMinimum required: BUILD\n\nUse /mode BUILD to enable it.`,
        success: false,
      };
    }

    if (!isDryRun && policyEngine.isCommandBlocked(command)) {
      this.deps.auditLogger.logSecurityBlock(task.task_id, `Command blocked by policy: ${command}`).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
      return {
        output: `Command blocked by security policy.\nCommand: ${command}\n\nThis command is listed in security-policy.json block rules.`,
        success: false,
      };
    }

    const localExecutor = new LocalExecutor();
    const result = await localExecutor.executeDirect(task, [command], workspace, isDryRun);

    if (isDryRun) {
      return {
        output: `Simulation completed.\nWorkspace: ${workspace}\nCommand: ${command}`,
        success: true,
      };
    }

    this.deps.storeExecutionResult(task, result);
    return {
      output: this.deps.formatExecutionOutput('Local shell', workspace, result),
      success: result.success,
    };
  }
}
