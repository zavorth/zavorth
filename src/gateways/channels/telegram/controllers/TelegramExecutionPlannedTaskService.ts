import { Task } from '../../../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { LocalExecutor } from '../../../../execution/LocalExecutor.js';
import type { ToolRuntimeService } from '../../../../services/tools/ToolRuntimeService.js';
import { logger } from '../../../../logger.js';

interface PlannedToolStep {
  type: 'tool';
  tool: string;
  args?: Record<string, unknown>;
}

interface PlannedShellStep {
  type: 'shell';
  command: string;
}

type PlannedStep = PlannedToolStep | PlannedShellStep;

function isToolStep(step: unknown): step is PlannedToolStep {
  return (
    typeof step === 'object' &&
    step !== null &&
    (step as Record<string, unknown>).type === 'tool'
  );
}

function isShellStep(step: unknown): step is PlannedShellStep {
  return (
    typeof step === 'object' &&
    step !== null &&
    (step as Record<string, unknown>).type === 'shell' &&
    typeof (step as Record<string, unknown>).command === 'string'
  );
}

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

    const toolSteps = task.actions_planned.filter(isToolStep);
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
      .filter(isShellStep)
      .map((step) => step.command);

    if (shellCommands.length === 0) {
      return {
        output: toolResults.trim() || 'Plan executed without shell commands.',
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
          `Plan commands blocked by policy: ${blockedCommands.join(', ')}`,
        )
        .catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });

      if (allowedCommands.length === 0) {
        return {
          output: `All plan commands were blocked by security policy.\n\nBlocked:\n${blockedCommands.map((command) => `  - ${command}`).join('\n')}`,
          success: false,
        };
      }
    }

    const localExecutor = new LocalExecutor();
    const workspace = task.workspace || 'core';
    const result = await localExecutor.executeDirect(task, allowedCommands, workspace, false);
    this.deps.storeExecutionResult(task, result);
    const shellOutput = this.deps.formatExecutionOutput('Local plan', workspace, result);

    const blockWarning =
      blockedCommands.length > 0
        ? `\n\nWarnings: ${blockedCommands.length} command(s) were removed from the plan by security policy.`
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

    const existingMetadata =
      typeof args.metadata === 'object' && args.metadata !== null
        ? (args.metadata as Record<string, unknown>)
        : {};
    const taskMetadata =
      typeof task.metadata === 'object' && task.metadata !== null
        ? (task.metadata as Record<string, unknown>)
        : {};

    return {
      ...args,
      taskId: task.task_id || args.taskId || args.task_id,
      metadata: {
        ...existingMetadata,
        traceId:
          existingMetadata.traceId ||
          existingMetadata.trace_id ||
          taskMetadata.traceId ||
          taskMetadata.trace_id ||
          `task:${task.task_id}`,
      },
    };
  }
}
