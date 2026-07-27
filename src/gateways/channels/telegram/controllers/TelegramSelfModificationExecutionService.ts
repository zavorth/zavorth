import { Context } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { logger } from '../../../../logger.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';
import { buildSelfmodProposalPendingCard } from '../../../../services/SelfmodProposalPresentation.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';
import {
  SelfModificationApplyResult,
  SelfModificationCommandService,
  SelfModificationPreviewResult,
  SelfModificationRollbackResult,
} from '../../../../services/SelfModificationCommandService.js';

type PersistTaskFn = (task: Task) => void;

type SelfModificationExecutionServiceDeps = {
  taskManager: {
    advanceState(task: Task, status: Task['status']): void;
  };
  executionGateway: ExecutionGateway;
  auditLogger: AuditLogger;
  persistTask: PersistTaskFn;
  selfModificationService: SelfModificationCommandService;
};

export class TelegramSelfModificationExecutionService {
  constructor(private readonly deps: SelfModificationExecutionServiceDeps) {}

  public async runPreview(
    ctx: Context,
    task: Task,
    filePath: string,
    instruction: string,
    userId: string,
  ): Promise<void> {
    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: 'SELFMOD_PREVIEW_REQUESTED',
        task_id: task.task_id,
        user_id: userId,
        user_input: instruction,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: null,
        execution_summary: null,
        metadata: { target_file: filePath },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    const result = await this.deps.selfModificationService.createPreview(filePath, instruction, userId);
    await this.finishPreviewTask(ctx, task, result, filePath);
  }

  public async runApply(ctx: Context, task: Task, previewId: string, userId: string): Promise<void> {
    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: 'SELFMOD_APPLY_REQUESTED',
        task_id: task.task_id,
        user_id: userId,
        user_input: previewId,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: null,
        execution_summary: null,
        metadata: { preview_id: previewId },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    const result = await this.deps.selfModificationService.applyPreview(previewId, userId);
    task.metadata = {
      ...(task.metadata || {}),
      preview_id: previewId,
      relative_path: result.relativePath,
    };
    task.diff_summary = result.diffSummary || null;
    task.result_summary = result.summary;
    task.error_summary = result.success ? null : result.summary;
    this.deps.persistTask(task);
    this.deps.taskManager.advanceState(task, result.success ? 'completed' : 'failed');

    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: result.success ? 'SELFMOD_APPLY_SUCCEEDED' : 'SELFMOD_APPLY_BLOCKED',
        task_id: task.task_id,
        user_id: userId,
        user_input: previewId,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: result.success ? 'ALLOWED' : 'BLOCKED',
        policy_violations: result.success ? null : result.summary,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: result.success,
        execution_summary: result.summary,
        metadata: {
          preview_id: previewId,
          relative_path: result.relativePath,
        },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    await SmartOutputService.reply(ctx, this.formatApplyReply(result));
  }

  public async runGoalPreview(ctx: Context, task: Task, goal: string, userId: string): Promise<void> {
    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: 'SELFMOD_GOAL_PREVIEW_REQUESTED',
        task_id: task.task_id,
        user_id: userId,
        user_input: goal,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: null,
        execution_summary: null,
        metadata: { goal },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    const result = await this.deps.selfModificationService.createGoalPreview(goal, userId);
    await this.finishPreviewTask(ctx, task, result, goal);
  }

  public async runRollback(ctx: Context, task: Task, changeId: string, userId: string): Promise<void> {
    this.deps.taskManager.advanceState(task, 'running');
    const result = await this.deps.selfModificationService.rollbackChangeSet(changeId, userId);
    task.metadata = {
      ...(task.metadata || {}),
      change_id: changeId,
      restored_files: result.restoredFiles,
    };
    task.result_summary = result.summary;
    task.error_summary = result.success ? null : result.summary;
    this.deps.persistTask(task);
    this.deps.taskManager.advanceState(task, result.success ? 'completed' : 'failed');

    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: result.success ? 'SELFMOD_ROLLBACK_SUCCEEDED' : 'SELFMOD_ROLLBACK_BLOCKED',
        task_id: task.task_id,
        user_id: userId,
        user_input: changeId,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: result.success ? 'ALLOWED' : 'BLOCKED',
        policy_violations: result.success ? null : result.summary,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: result.success,
        execution_summary: result.summary,
        metadata: {
          change_id: changeId,
          restored_files: result.restoredFiles,
        },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    await SmartOutputService.reply(ctx, this.formatRollbackReply(result));
  }

  private async finishPreviewTask(
    ctx: Context,
    task: Task,
    result: SelfModificationPreviewResult,
    filePath: string,
  ): Promise<void> {
    task.metadata = {
      ...(task.metadata || {}),
      preview_id: result.previewId,
      target_file: result.relativePath || filePath,
      selfmod_preview_mode: result.mode,
      selfmod_change_count: result.changeCount || null,
    };
    task.target_files = result.relativePath ? [result.relativePath] : result.mode === 'goal' ? [] : [filePath];
    task.diff_summary = result.diffSummary || null;
    task.result_summary = result.summary;
    task.error_summary = result.success ? null : result.summary;
    this.deps.persistTask(task);
    this.deps.taskManager.advanceState(task, result.success ? 'completed' : 'failed');

    await this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: result.success ? 'SELFMOD_PREVIEW_SUCCEEDED' : 'SELFMOD_PREVIEW_BLOCKED',
        task_id: task.task_id,
        user_id: task.user_id,
        user_input: filePath,
        intent: task.intent,
        plan_id: null,
        risk_level: task.risk_level,
        policy_decision: result.success ? 'ALLOWED' : 'BLOCKED',
        policy_violations: result.success ? null : result.summary,
        operational_mode: this.deps.executionGateway.getModeManager().getMode(),
        executor: 'selfmod',
        execution_success: result.success,
        execution_summary: result.summary,
        metadata: {
          preview_id: result.previewId,
          relative_path: result.relativePath,
        },
      })
      .catch((err) => {
        logger.warn('[auto-fix] Empty catch block', err);
      });

    // Proposal-time card: Apply/Reject buttons when surface supports them.
    if (result.previewId) {
      const card = buildSelfmodProposalPendingCard({
        previewId: result.previewId,
        summary: this.formatPreviewSummary(result),
        relativePath: result.relativePath,
        mode: result.mode,
        changeCount: result.changeCount,
        resourceImpact: result.resourceImpact,
        diffSummary: result.diffSummary,
        success: result.success,
        channel: 'telegram',
      });
      try {
        await replyWithTelegramSurfaceResponse(ctx, card.surfaceResponse, {
          maxActionsPerRow: 2,
        });
        return;
      } catch {
        await SmartOutputService.reply(ctx, card.text);
        return;
      }
    }
    await SmartOutputService.reply(ctx, this.formatPreviewReply(result));
  }

  private formatPreviewSummary(result: SelfModificationPreviewResult): string {
    if (!result.success) {
      return result.validationOutput ? `${result.summary}\n\nValidation output:\n${result.validationOutput}`
        : result.summary;
    }
    const head =
      result.mode === 'goal'
        ? `Multi-file preview ready for ${result.changeCount || 0} change(s).`
        : `Preview ready for ${result.relativePath || 'file'}.`;
    const plan = result.validationPlan?.length ? `\nValidation plan:\n${result.validationPlan.map((entry) => `- ${entry}`).join('\n')}`
      : '';
    return `${head}\n${result.summary}${plan}`.trim();
  }

  private formatPreviewReply(result: SelfModificationPreviewResult): string {
    if (!result.success) {
      return result.validationOutput ? `${result.summary}\n\nValidation output:\n${result.validationOutput}`
        : result.summary;
    }

    const lines = [
      result.mode === 'goal'
        ? `Multi-file preview ready for ${result.changeCount || 0} change(s).`
        : `Preview ready for ${result.relativePath}.`,
      result.previewId
        ? `Preview ref: ${result.previewId.length <= 12 ? result.previewId : result.previewId.slice(0, 8)}`
        : null,
      '',
      `Summary: ${result.summary}`,
    ].filter((line) => line !== null) as string[];

    if (result.resourceImpact) {
      lines.push(`Estimated impact: ${result.resourceImpact}`);
    }

    if (result.validationPlan?.length) {
      lines.push('', 'Validation plan:', ...result.validationPlan.map((entry) => `- ${entry}`));
    }

    if (result.diffSummary) {
      lines.push('', 'Diff summary:', result.diffSummary);
    }

    lines.push(
      '',
      result.previewId ? `Next: tap Apply on the card, or /selfmod apply ${result.previewId}`
        : 'Next: re-run /selfmod preview after fixing blockers.',
    );
    return lines.join('\n');
  }

  private formatApplyReply(result: SelfModificationApplyResult): string {
    if (!result.success) {
      return result.diffSummary ? `${result.summary}\n\nDiff summary:\n${result.diffSummary}` : result.summary;
    }

    const lines = [
      result.mode === 'goal'
        ? `ChangeSet applied across ${result.changeCount || 0} file(s).`
        : `Self-modification applied to ${result.relativePath}.`,
      `Preview used: ${result.previewId}`,
      '',
      result.summary,
    ];

    if (result.changeId) {
      lines.push(`Change ID: ${result.changeId}`);
      lines.push(`Rollback: /selfmod rollback ${result.changeId}`);
    }

    if (result.diffSummary) {
      lines.push('', 'Diff resumido:', result.diffSummary);
    }

    return lines.join('\n');
  }

  private formatRollbackReply(result: SelfModificationRollbackResult): string {
    if (!result.success) {
      return result.summary;
    }

    return [
      `Rollback completed para o change ${result.changeId}.`,
      `Restored files: ${result.restoredFiles}.`,
      '',
      result.summary,
    ].join('\n');
  }
}
