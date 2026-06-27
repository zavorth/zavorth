import { Context } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { ApprovalManager } from '../../../../orchestrator/ApprovalManager.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { HighRiskConfirmationService } from '../../../../services/HighRiskConfirmationService.js';
import { TelemetryRuntimeService } from '../../../../observability/telemetry/TelemetryRuntimeService.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';
import type { WorkflowRunService } from '../../../../runtime/workflows/WorkflowRunService.js';

export type TelegramTaskApprovalServiceDeps = {
  taskManager: TaskManager;
  persistTask: (task: Task) => void;
  resumeTaskExecution: (ctx: Context, task: Task) => Promise<void>;
  resumeWorkflowExecution?: (ctx: Context, task: Task) => Promise<boolean>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  telemetryRuntime?: TelemetryRuntimeService;
  auditLogger?: AuditLogger;
  highRiskConfirmation?: HighRiskConfirmationService;
  taskSecurityPosture: TaskSecurityPostureService;
};

export class TelegramTaskApprovalService {
  private readonly highRiskConfirmation: HighRiskConfirmationService;

  constructor(private readonly deps: TelegramTaskApprovalServiceDeps) {
    this.highRiskConfirmation =
      this.deps.highRiskConfirmation || new HighRiskConfirmationService();
  }

  public requiresHighRiskConfirmation(taskId: string): boolean {
    const task = this.deps.taskManager.getTask(taskId);
    return this.highRiskConfirmation.requiresPin(task);
  }

  public async handleApproval(ctx: Context, args: string): Promise<void> {
    const approvalManager = new ApprovalManager(this.deps.taskManager);
    const { taskId, approvalCode } = this.parseTaskApprovalInput(args);
    const userId = ctx.from?.id?.toString() || null;

    try {
      const currentTask = this.deps.taskManager.getTask(taskId);
      if (!currentTask) {
        throw new Error(`Tarefa ${taskId} nao encontrada.`);
      }

      if (this.highRiskConfirmation.requiresPin(currentTask)) {
        if (!this.highRiskConfirmation.isConfigured()) {
          throw new Error(
            'Aprovacao HIGH_RISK exige PIN/TOTP, mas o host ainda nao foi configurado para isso.',
          );
        }
        if (!this.highRiskConfirmation.validate(currentTask, approvalCode)) {
          throw new Error(this.highRiskConfirmation.describeRequirement());
        }
      }

      const requiredHighRiskPin = this.highRiskConfirmation.requiresPin(currentTask);
      const task = approvalManager.processApproval(taskId, 'approve');
      task.requires_approval = false;
      task.approval_status = 'approved';
      task.metadata = this.deps.taskSecurityPosture.appendApprovalDecision(task.metadata, {
        action: 'approve',
        actor: userId,
        at: new Date().toISOString(),
        required_high_risk_pin: requiredHighRiskPin,
        source: 'telegram_approve',
      });
      task.metadata = {
        ...(task.metadata || {}),
        highRiskApprovedAt: new Date().toISOString(),
        explicitTaskApprovalAt: new Date().toISOString(),
      };
      this.deps.persistTask(task);
      await this.recordTaskApprovalAudit(task, 'approve', userId, {
        requiredHighRiskPin,
      });
      this.syncWorkflowApprovalDecision(task, 'approve', 'Aprovacao registrada pelo operador.');
      await ctx.reply(
        `Aprovacao da tarefa registrada.\n\nReferencia curta: ${task.task_id.substring(0, 8)}\nVou retomar a execucao agora. Se o executor precisar de um acesso extra especifico, eu vou abrir outro pedido com botoes.`,
      );
      await this.recordTaskApprovalTelemetry(task, 'approve', 'approved', userId, {
        requiredHighRiskPin,
      });
      await this.resumeApprovedTaskOrWorkflow(ctx, task);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const task = this.deps.taskManager.getTask(taskId);
      if (task && task.status === 'running') {
        this.deps.taskManager.advanceState(task, 'failed');
      }
      await this.recordTaskApprovalTelemetry(task, 'approve', 'failed', userId, {
        taskId,
        errorMessage: message,
      });
      await ctx.reply(`Nao consegui processar essa aprovacao.\n\nMotivo: ${message}`);
    }
  }

  public async handleRejection(ctx: Context, taskId: string): Promise<void> {
    const approvalManager = new ApprovalManager(this.deps.taskManager);
    const userId = ctx.from?.id?.toString() || null;

    try {
      const task = approvalManager.processApproval(taskId, 'reject');
      task.approval_status = 'rejected';
      task.metadata = this.deps.taskSecurityPosture.appendApprovalDecision(task.metadata, {
        action: 'reject',
        actor: userId,
        at: new Date().toISOString(),
        source: 'telegram_reject',
      });
      this.deps.persistTask(task);
      await this.recordTaskApprovalAudit(task, 'reject', userId);
      this.syncWorkflowApprovalDecision(task, 'reject', 'Aprovacao rejeitada pelo operador.');
      await this.recordTaskApprovalTelemetry(task, 'reject', 'rejected', userId);
      await ctx.reply(`Tudo certo. A tarefa ${taskId} foi rejeitada e nao vou seguir com ela.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordTaskApprovalTelemetry(undefined, 'reject', 'failed', userId, {
        taskId,
        errorMessage: message,
      });
      await ctx.reply(`Nao consegui registrar essa rejeicao.\n\nMotivo: ${message}`);
    }
  }

  private parseTaskApprovalInput(args: string): { taskId: string; approvalCode: string } {
    const parts = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const taskId = String(parts.shift() || '').trim();
    const codeToken = parts.find((part) => /^(pin|code|totp)=/i.test(part));
    const approvalCode = codeToken
      ? codeToken.split('=').slice(1).join('=').trim()
      : String(parts[0] || '').trim();

    if (!taskId) {
      throw new Error('Use /approve <task_id> [pin=123456].');
    }

    return { taskId, approvalCode };
  }

  private async recordTaskApprovalTelemetry(
    task: Task | undefined,
    action: 'approve' | 'reject',
    status: 'approved' | 'rejected' | 'failed',
    userId: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.deps.telemetryRuntime) {
      return;
    }

    try {
      await this.deps.telemetryRuntime.record({
        traceId: this.resolveTaskApprovalTraceId(task, payload.taskId),
        source: 'telegram-permission-controller',
        eventType: `task.approval.${action}`,
        status,
        payload: {
          taskId: task?.task_id || payload.taskId || null,
          userId,
          taskStatus: task?.status || null,
          requiresApproval: task?.requires_approval ?? null,
          approvalStatus: task?.approval_status || null,
          ...payload,
        },
      });
    } catch {
      // telemetry should never block approval handling
    }
  }

  private async recordTaskApprovalAudit(
    task: Task | undefined,
    action: 'approve' | 'reject',
    userId: string | null,
    details: Record<string, any> = {},
  ): Promise<void> {
    if (!this.deps.auditLogger || !task) {
      return;
    }

    try {
      await this.deps.auditLogger.logApprovalDecision(task, action, userId, details);
    } catch {
      // audit should never block approval handling
    }
  }

  private async resumeApprovedTaskOrWorkflow(ctx: Context, task: Task): Promise<void> {
    const resumedWorkflow = await this.tryResumeWorkflowExecution(ctx, task);
    if (resumedWorkflow) {
      return;
    }

    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.resumeTaskExecution(ctx, task);
  }

  private async tryResumeWorkflowExecution(ctx: Context, task: Task): Promise<boolean> {
    if (!this.deps.resumeWorkflowExecution) {
      return false;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return false;
    }

    return this.deps.resumeWorkflowExecution(ctx, task);
  }

  private syncWorkflowApprovalDecision(
    task: Task | undefined,
    action: 'approve' | 'reject',
    summary: string,
  ): void {
    if (!task || !this.deps.workflowRunService) {
      return;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return;
    }

    this.deps.workflowRunService.applyStageApprovalDecision({
      workflowRunId,
      stageId:
        String(
          task.metadata?.workflow_stage_id || task.metadata?.workflow_resume_stage_id || '',
        ).trim() || null,
      taskId: task.task_id,
      action,
      summary,
    });
  }

  private resolveTaskApprovalTraceId(task: Task | undefined, fallbackTaskId?: unknown): string {
    const candidates = [
      task?.metadata?.traceId,
      task?.metadata?.trace_id,
      task?.task_id ? `task:${task.task_id}` : null,
      fallbackTaskId ? `task:${String(fallbackTaskId)}` : null,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) {
        return normalized;
      }
    }

    return 'task:approval:unknown';
  }
}
