import { Context, InlineKeyboard } from 'grammy';
import { Task } from '../../contracts/TaskContract.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { ExecutionGateway } from '../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import { StateMachine } from '../../orchestrator/StateMachine.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { LogRepository } from '../../storage/LogRepository.js';
import { SmartOutputService } from '../../services/SmartOutputService.js';
import { TaskResponseEnvelopeService } from '../../services/TaskResponseEnvelopeService.js';

type ExecuteTaskFn = (task: Task, isDryRun: boolean) => Promise<{ output: string; success: boolean }>;
type CaptureExecutionEnvelopeFn = (task: Task, userFacingText: string, success: boolean) => void;
type SendTaskArtifactsFn = (ctx: Context, task: Task) => Promise<void>;
type PersistTaskFn = (task: Task) => void;
type PermissionKeyboardBuilder = (permission: PermissionRequest) => InlineKeyboard;

export type TelegramExecutionLifecycleServiceDeps = {
  taskManager: TaskManager;
  auditLogger: AuditLogger;
  executionGateway: ExecutionGateway;
  logRepo: LogRepository;
  permissionService: {
    getRequest(id: string): Promise<PermissionRequest | null | undefined>;
  };
  persistTask: PersistTaskFn;
  buildPermissionKeyboard: PermissionKeyboardBuilder;
  executeTask: ExecuteTaskFn;
  captureExecutionEnvelope: CaptureExecutionEnvelopeFn;
  sendTaskArtifacts: SendTaskArtifactsFn;
};

export class TelegramExecutionLifecycleService {
  constructor(private readonly deps: TelegramExecutionLifecycleServiceDeps) {}

  public async resumeTaskExecution(ctx: Context, task: Task): Promise<void> {
    const { output, success } = await this.deps.executeTask(task, false);
    if (task.status === 'running') {
      this.deps.taskManager.advanceState(task, success ? 'completed' : 'failed');
    }
    this.deps.captureExecutionEnvelope(task, output, success);
    await SmartOutputService.reply(ctx, output, { includeDeleteAction: false });
    await this.deps.sendTaskArtifacts(ctx, task);
  }

  public async executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void> {
    this.deps.taskManager.advanceState(task, 'running');

    try {
      const { output, success } = await this.deps.executeTask(task, isDryRun);
      if (task.status === 'running') {
        this.deps.taskManager.advanceState(task, success ? 'completed' : 'failed');
      }
      this.deps.captureExecutionEnvelope(task, output, success);

      this.deps.auditLogger.logEvent({
        timestamp: new Date().toISOString(),
        event_type: 'EXECUTION_COMPLETED',
        task_id: task.task_id,
        user_id: task.user_id,
        user_input: '',
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: task.executor_used || 'local',
        execution_success: success,
        execution_summary: success ? 'Execucao concluida com sucesso' : 'Execucao falhou',
        metadata: { dry_run: isDryRun },
      }).catch(() => {});

      if (task.status === 'waiting_approval' && task.metadata?.pendingPermissionId) {
        const permission = await this.deps.permissionService.getRequest(String(task.metadata.pendingPermissionId));
        if (permission) {
          await SmartOutputService.reply(ctx, output, {
            reply_markup: this.deps.buildPermissionKeyboard(permission),
            includeDeleteAction: false,
          });
          return;
        }
      }

      await SmartOutputService.reply(ctx, output, { includeDeleteAction: false });
      await this.deps.sendTaskArtifacts(ctx, task);
    } catch (error: any) {
      if (!StateMachine.isTerminal(task.status)) {
        this.deps.taskManager.advanceState(task, 'failed');
      }
      task.error_summary = error.message;
      this.deps.persistTask(task);
      this.deps.auditLogger.logSecurityBlock(task.task_id, `Execucao falhou: ${error.message}`).catch(() => {});
      const userFacingText = `Nao consegui executar essa tarefa agora.\n\nMotivo: ${error.message}`;
      const operationalText = TaskResponseEnvelopeService.buildPreparationFailure(task, error.message);
      TaskResponseEnvelopeService.capture(task, 'preparation_failure', userFacingText, operationalText);
      this.deps.persistTask(task);
      this.deps.logRepo.log('error', 'ResponseEnvelope', operationalText, {
        taskId: task.task_id,
        kind: 'preparation_failure',
      });
      await SmartOutputService.reply(ctx, userFacingText);
    }
  }
}
