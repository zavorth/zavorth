import { Task } from '../../../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { LocalExecutor } from '../../../../execution/LocalExecutor.js';
import type { ToolRuntimeService } from '../../../../services/tools/ToolRuntimeService.js';

type ToolRuntimeLike = Pick<ToolRuntimeService, 'executeTool'>;

export type TelegramExecutionPlannedTaskServiceDeps = {
  executionGateway: ExecutionGateway;
  auditLogger: AuditLogger;
  toolRuntime?: ToolRuntimeLike;
  storeExecutionResult: (task: Task, result: unknown) => void;
  formatExecutionOutput: (label: string, workspace: string, result: unknown) => string;
};

export class TelegramExecutionPlannedTaskService {
  constructor(private readonly deps: TelegramExecutionPlannedTaskServiceDeps) {}

  public async executePlannedTask(task: Task): Promise<{ output: string; success: boolean }> {
    const policyEngine = this.deps.executionGateway.getPolicyEngine();
    let toolResults = '';

    const toolSteps = task.actions_planned.filter((step: unknown) => step.type === 'tool');
    for (const step of toolSteps) {
      if (step.tool && this.deps.toolRuntime) {
        const toolResult = await this.deps.toolRuntime.executeTool(
          step.tool,
          this.enrichToolArgsWithTrace(step.args || {}, task),
        );
        toolResults += `[tool:${step.tool}]\n${toolResult}\n\n`;
      }
    }

    const shellCommands = task.actions_planned
      .filter((step: unknown) => step.type === 'shell' && step.command)
      .map((step: unknown) => step.command as string);

    if (shellCommands.length === 0) {
      return {
        output: toolResults.trim() || 'Plano executado sem comandos shell.',
        success: true,
      };
    }

    const blockedCommands: string[] = [];
    const allowedCommands: string[] = [];
    for (const command of shellCommands) {
      if (policyEngine.isCommandBlocked(command)) {
        blockedCommands.push(command);
      } else {
        allowedCommands.push(command);
      }
    }

    if (blockedCommands.length > 0) {
      this.deps.auditLogger
        .logSecurityBlock(
          task.task_id,
          `Comandos do plano bloqueados pela politica: ${blockedCommands.join(', ')}`,
        )
        .catch(() => {});

      if (allowedCommands.length === 0) {
        return {
          output: `Todos os comandos do plano foram bloqueados pela politica de seguranca.\n\nBloqueados:\n${blockedCommands.map((command) => `  - ${command}`).join('\n')}`,
          success: false,
        };
      }
    }

    const localExecutor = new LocalExecutor();
    const workspace = task.workspace || 'core';
    const result = await localExecutor.executeDirect(task, allowedCommands, workspace, false);
    this.deps.storeExecutionResult(task, result);
    const shellOutput = this.deps.formatExecutionOutput('Plano local', workspace, result);

    const blockWarning =
      blockedCommands.length > 0
        ? `\n\nAvisos: ${blockedCommands.length} comando(s) foram removidos do plano pela politica de seguranca.`
        : '';

    return {
      output: [toolResults.trim(), shellOutput].filter(Boolean).join('\n\n') + blockWarning,
      success: result.success,
    };
  }

  private enrichToolArgsWithTrace(args: Record<string, unknown>, task: Task): Record<string, unknown> {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return args;
    }

    return {
      ...args,
      taskId: task.task_id || args.taskId || args.task_id,
      metadata: {
        ...(args.metadata || {}),
        traceId:
          args.metadata?.traceId ||
          args.metadata?.trace_id ||
          task.metadata?.traceId ||
          task.metadata?.trace_id ||
          `task:${task.task_id}`,
      },
    };
  }
}
