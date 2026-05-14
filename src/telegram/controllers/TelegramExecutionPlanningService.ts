import { Context } from 'grammy';
import { Task } from '../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { LogRepository } from '../../storage/LogRepository.js';
import { PresentationModeService } from '../../services/PresentationModeService.js';
import { SmartOutputService } from '../../services/SmartOutputService.js';
import { TaskResponseEnvelopeService } from '../../services/TaskResponseEnvelopeService.js';
import { UserFacingResponseService } from '../../services/UserFacingResponseService.js';

type PersistTaskFn = (task: Task) => void;

export type TelegramExecutionPlanningServiceDeps = {
  taskManager: TaskManager;
  logRepo: LogRepository;
  executionGateway: ExecutionGateway;
  auditLogger: AuditLogger;
  persistTask: PersistTaskFn;
  presentationModeService: PresentationModeService;
};

export class TelegramExecutionPlanningService {
  constructor(private readonly deps: TelegramExecutionPlanningServiceDeps) {}

  public async handlePlan(ctx: Context, task: Task): Promise<void> {
    this.deps.taskManager.advanceState(task, 'planned');
    const Fallback = require('../../agents/FallbackRouter.js').FallbackRouter;

    try {
      const plan = await Fallback.planWithRedundancy(task, this.deps.logRepo);
      task.actions_planned = plan.steps;
      task.risk_level = plan.risk_level;
      task.requires_approval = plan.requires_approval;
      task.executor_used = plan.executor_recommendation;
      this.deps.persistTask(task);

      const policyEngine = this.deps.executionGateway.getPolicyEngine();
      const evaluation = policyEngine.evaluate(plan);
      const modeManager = this.deps.executionGateway.getModeManager();

      this.deps.auditLogger.logPolicyEvaluation(
        task.task_id,
        plan.plan_id,
        plan.risk_level,
        modeManager.getMode(),
        evaluation,
      ).catch(() => {});

      if (!evaluation.allowed) {
        const userFacingText = UserFacingResponseService.formatPlanBlocked(
          task,
          evaluation.violations.map((violation: any) => violation.detail),
          { presentationMode: this.deps.presentationModeService.isEnabled() },
        );
        const operationalText = TaskResponseEnvelopeService.buildPlanBlocked(
          task,
          evaluation.violations.map((violation: any) => violation.detail),
        );
        TaskResponseEnvelopeService.capture(task, 'plan_blocked', userFacingText, operationalText);
        this.deps.persistTask(task);
        this.deps.logRepo.log('warn', 'ResponseEnvelope', operationalText, {
          taskId: task.task_id,
          kind: 'plan_blocked',
        });
        await SmartOutputService.reply(ctx, userFacingText);
        return;
      }

      const warningText =
        evaluation.warnings.length > 0
          ? `\nAvisos de seguranca: ${evaluation.warnings.map((warning: any) => warning.detail).join('; ')}`
          : '';

      const normalizedWarningText = warningText ? warningText.replace(/^;\s*/, '') : '';
      const userFacingText = UserFacingResponseService.formatPlanReady(
        task,
        plan,
        normalizedWarningText,
        { presentationMode: this.deps.presentationModeService.isEnabled() },
      );
      const operationalText = TaskResponseEnvelopeService.buildPlanReady(
        task,
        plan,
        normalizedWarningText,
      );
      TaskResponseEnvelopeService.capture(task, 'plan_ready', userFacingText, operationalText);
      this.deps.persistTask(task);
      this.deps.logRepo.log('info', 'ResponseEnvelope', operationalText, {
        taskId: task.task_id,
        kind: 'plan_ready',
      });

      await SmartOutputService.reply(ctx, userFacingText);
    } catch (error: any) {
      this.deps.taskManager.advanceState(task, 'failed');
      task.error_summary = error.message;
      this.deps.persistTask(task);
      const userFacingText = `Nao consegui montar um plano agora.\n\nMotivo: ${error.message}`;
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
