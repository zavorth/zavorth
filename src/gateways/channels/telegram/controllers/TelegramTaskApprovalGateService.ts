import { Context, InlineKeyboard } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { RiskClassification } from '../../../../orchestrator/RiskClassifier.js';
import { HighRiskConfirmationService } from '../../../../services/HighRiskConfirmationService.js';
import { OperatorModeService } from '../../../../services/OperatorModeService.js';
import { PresentationModeService } from '../../../../services/PresentationModeService.js';
import { TaskResponseEnvelopeService } from '../../../../services/TaskResponseEnvelopeService.js';
import { UserFacingResponseService } from '../../../../services/UserFacingResponseService.js';

type TaskManagerLike = {
  advanceState(
    task: Task,
    status: Task['status'],
    metadata?: { reason?: string; actor?: string },
  ): void;
};

type LogRepoLike = {
  log(level: string, component: string, message: string, metadata?: Record<string, unknown>): void;
};

export type TelegramTaskApprovalGateServiceDeps = {
  logRepo: LogRepoLike;
  operatorModeService: OperatorModeService;
  persistTask: (task: Task) => void;
  presentationModeService: PresentationModeService;
  taskManager: TaskManagerLike;
};

export class TelegramTaskApprovalGateService {
  private readonly highRiskConfirmation = new HighRiskConfirmationService();

  constructor(private readonly deps: TelegramTaskApprovalGateServiceDeps) {}

  public requiresHighRiskPin(task: Task): boolean {
    return this.highRiskConfirmation.requiresPin(task);
  }

  public async maybeHoldForApproval(
    ctx: Context,
    task: Task,
    classification: RiskClassification,
    executorLabel: string,
    routingReason: string | null,
    forceApproval: boolean = false,
  ): Promise<boolean> {
    const operatorMode = this.deps.operatorModeService.getStatus();
    const operatorModeEnabled = operatorMode.enabled;
    const presentationModeEnabled = this.deps.presentationModeService.isEnabled();
    const requiresCheckpoint = task.requires_approval || forceApproval || operatorModeEnabled;

    if (!requiresCheckpoint) {
      return false;
    }

    const highRiskRequiresPin = this.highRiskConfirmation.requiresPin(task);
    task.requires_approval = true;
    task.metadata = {
      ...(task.metadata || {}),
      requiresHighRiskPin: highRiskRequiresPin,
      surface_force_approval: forceApproval,
      operator_mode_gate: operatorModeEnabled
        ? {
            enabled: true,
            updatedAt: operatorMode.updatedAt,
            updatedBy: operatorMode.updatedBy,
          }
        : null,
    };
    this.deps.taskManager.advanceState(task, 'waiting_approval', {
      reason: operatorModeEnabled ? 'operator_mode_gate' : 'risk_gate',
      actor: 'telegram',
    });

    const highRiskText = highRiskRequiresPin
      ? this.highRiskConfirmation.describeRequirement()
      : null;
    const userFacingText = UserFacingResponseService.formatApprovalPrompt(task, executorLabel, classification.reason, {
      operatorMode: operatorModeEnabled,
      highRiskText,
      routingReason,
      presentationMode: presentationModeEnabled,
    });
    const operationalText = TaskResponseEnvelopeService.buildApprovalPrompt(task, executorLabel, classification.reason, {
      operatorMode: operatorModeEnabled,
      routingReason,
      presentationMode: presentationModeEnabled,
    });
    TaskResponseEnvelopeService.capture(task, 'approval_prompt', userFacingText, operationalText);
    this.deps.persistTask(task);
    this.deps.logRepo.log('info', 'ResponseEnvelope', operationalText, {
      taskId: task.task_id,
      kind: 'approval_prompt',
    });

    const keyboard = new InlineKeyboard()
      .text('👍 Aprovar', `task:approve:${task.task_id}`)
      .text('👎 Rejeitar', `task:reject:${task.task_id}`);

    await ctx.reply(userFacingText, { reply_markup: keyboard });
    return true;
  }
}
