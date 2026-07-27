import { Context, InlineKeyboard } from 'grammy';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { Task } from '../../../../contracts/TaskContract.js';
import {
  PermissionRequest,
  PermissionStatus,
} from '../../../../contracts/PermissionRequest.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { TelegramPermissionCommandService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionCommandService.js';

import type { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import { HostIdentityService } from '../../../../services/HostIdentityService.js';
import { TelemetryRuntimeService } from '../../../../observability/telemetry/TelemetryRuntimeService.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';
import type { WorkflowRunService } from '../../../../runtime/workflows/WorkflowRunService.js';
import { TelegramZavorthBridgeController } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeController.js';
import {
  TelegramPermissionDecisionService,
} from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';

import { TelegramPermissionInteractionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionInteractionService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationService.js';
import { TelegramPersistedPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPersistedPermissionPolicyService.js';
import { TelegramTaskApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramTaskApprovalService.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';
import {
  applySurfaceLifecycleOp,
  buildPostDecisionLifecycle,
  clearPendingSurfaceApproval,
  isPermissionDecisionEvent,
  isUndoEvent,
  parseReactionConfirmation,
  parseSurfaceInteraction,
  processVoiceReply,
  resolvePendingSurfaceApproval,
  toPermissionApprovalArgs,
} from '../../../../domain/surface/application/surface-projection/index.js';
import { resolveSurfaceProfileForChannel } from '../../../../domain/surface/application/surface-affordance/index.js';
import { config } from '../../../../config/index.js';

type ZavorthBridgeCompanionBridgeLike = Pick<ZavorthBridgeCompanionBridge, 'readStatus' | 'isOnline'>;

export type TelegramPermissionControllerDeps = {
  permissionService: PermissionService;
  taskManager: TaskManager;
  persistTask: (task: Task) => void;
  getZavorthBridgeController: () => TelegramZavorthBridgeController;
  resumeTaskExecution: (ctx: Context, task: Task) => Promise<void>;
  resumeWorkflowExecution?: (ctx: Context, task: Task) => Promise<boolean>;
  resumeFileDeliveryPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  resumeFileInspectionPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  /** Post-execution rollback via RollbackManager. Optional so unit tests can omit it. */
  handleUndo?: (ctx: Context, taskId: string) => Promise<void>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  hostIdentityService?: HostIdentityService;
  telemetryRuntime?: TelemetryRuntimeService;
  auditLogger?: AuditLogger;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
};

type HighRiskApprovalChallenge = {
  userId: string;
  chatId: string;
  taskId: string;
  expiresAt: number;
};

export class TelegramPermissionController {
  /** Pending HIGH_RISK TOTP replies after task:approve callback (userId:chatId → challenge). */
  private readonly highRiskChallenges = new Map<string, HighRiskApprovalChallenge>();
  private static readonly HIGH_RISK_CHALLENGE_TTL_MS = 5 * 60 * 1000;
  private taskSecurityPosture = new TaskSecurityPostureService();
  private readonly permissionDecision: TelegramPermissionDecisionService;
  private readonly permissionPolicy = new TelegramPermissionPolicyService();
  private readonly permissionPresentation: TelegramPermissionPresentationService;
  private readonly persistedPolicies: TelegramPersistedPermissionPolicyService;
  private readonly taskApproval: TelegramTaskApprovalService;
  private readonly permissionCommands: TelegramPermissionCommandService;
  private readonly permissionInteraction: TelegramPermissionInteractionService;

  constructor(private deps: TelegramPermissionControllerDeps) {
    this.permissionPresentation = new TelegramPermissionPresentationService(this.permissionPolicy);
    this.persistedPolicies = new TelegramPersistedPermissionPolicyService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.permissionPolicy,
      persistTask: this.deps.persistTask,
    });
    this.taskApproval = new TelegramTaskApprovalService({
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      resumeTaskExecution: this.deps.resumeTaskExecution,
      resumeWorkflowExecution: this.deps.resumeWorkflowExecution,
      workflowRunService: this.deps.workflowRunService,
      telemetryRuntime: this.deps.telemetryRuntime,
      auditLogger: this.deps.auditLogger,
      taskSecurityPosture: this.taskSecurityPosture,
    });
    this.permissionDecision = new TelegramPermissionDecisionService({
      permissionService: this.deps.permissionService,
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      getZavorthBridgeController: this.deps.getZavorthBridgeController,
      resumeTaskExecution: this.deps.resumeTaskExecution,
      resumeWorkflowExecution: this.deps.resumeWorkflowExecution,
      resumeFileDeliveryPermission: this.deps.resumeFileDeliveryPermission,
      resumeFileInspectionPermission: this.deps.resumeFileInspectionPermission,
      workflowRunService: this.deps.workflowRunService,
      auditLogger: this.deps.auditLogger,
      createCompanionBridge: this.deps.createCompanionBridge,
      permissionPolicy: this.permissionPolicy,
      taskSecurityPosture: this.taskSecurityPosture,
      replyWithPermissionDecision: (ctx, permission, action) =>
        this.replyWithPermissionDecision(ctx, permission, action),
    });
    this.permissionCommands = new TelegramPermissionCommandService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.permissionPolicy,
      permissionPresentation: this.permissionPresentation,
      permissionDecision: this.permissionDecision,
      assertHostWritable: () => this.assertHostWritable(),
    });
    this.permissionInteraction = new TelegramPermissionInteractionService({
      permissionDecision: this.permissionDecision,
      permissionPolicy: this.permissionPolicy,
      resolvePermissionReference: (ref) => this.resolvePermissionReference(ref),
      shortPermissionId: (permission) => this.shortPermissionId(permission),
      assertHostWritable: () => this.assertHostWritable(),
    });
  }

  public async handlePermissionAllowCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionAllowCommand(ctx, args);
  }

  public async handlePermissionRevokeCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionRevokeCommand(ctx, args);
  }

  public async handleApproval(ctx: Context, args: string): Promise<void> {
    // Same admin gate as task:approve callbacks (unified slash/button policy).
    try {
      this.assertUserIsAdmin(ctx);
      this.assertHostWritable();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(message).catch(() => undefined);
      return;
    }
    await this.taskApproval.handleApproval(ctx, args);
  }

  public async handleRejection(ctx: Context, taskId: string): Promise<void> {
    try {
      this.assertUserIsAdmin(ctx);
      this.assertHostWritable();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(message).catch(() => undefined);
      return;
    }
    await this.taskApproval.handleRejection(ctx, taskId);
  }

  public async handlePermissionCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionCommand(ctx, args);
  }

  public async handlePermissionCallback(ctx: Context, data: string): Promise<void> {
    this.assertUserIsAdmin(ctx);
    await this.permissionInteraction.handlePermissionCallback(ctx, data);
  }

  /**
   * F5e — Telegram message_reaction → semantic permission choice.
   */
  public async handleMessageReaction(ctx: Context): Promise<void> {
    const reactionUpdate = (ctx as any).messageReaction || (ctx as any).update?.message_reaction;
    if (!reactionUpdate) return;

    const newReactions: Array<{ type?: string; emoji?: string }> = Array.isArray(
      reactionUpdate.new_reaction,
    )
      ? reactionUpdate.new_reaction
      : [];
    const emojiEntry = newReactions.find((r) => r?.type === 'emoji' && r.emoji);
    if (!emojiEntry?.emoji) return;

    const chatId = String(reactionUpdate.chat?.id || ctx.chat?.id || '').trim();
    const messageId = String(reactionUpdate.message_id || '').trim();
    if (!chatId) return;

    const pending = resolvePendingSurfaceApproval({
      surface: 'telegram',
      chatId,
      messageId,
    });
    if (!pending) return;

    try {
      this.assertUserIsAdmin(ctx);
      this.assertHostWritable();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(message).catch(() => undefined);
      return;
    }

    const profile = resolveSurfaceProfileForChannel('telegram');
    const event = parseSurfaceInteraction({
      surface: 'telegram',
      raw: emojiEntry.emoji,
      kindHint: 'reaction',
      actorId: String(reactionUpdate.user?.id || ctx.from?.id || '').trim() || null,
      sessionId: chatId,
      profile,
      highRisk: pending.highRisk,
      metadata: { approvalId: pending.approvalId, highRisk: pending.highRisk },
    });

    if (!event || event.metadata?.blocked || event.metadata?.unmatchedReaction) {
      return;
    }

    if (event.metadata?.requiresConfirmation) {
      await ctx
        .reply(
          String(
            event.metadata.confirmationPrompt ||
              `High-risk: reply "yes ${pending.approvalId} ${event.choice}" to confirm.`,
          ),
        )
        .catch(() => undefined);
      return;
    }

    const permission = toPermissionApprovalArgs(event);
    if (!permission) return;

    if (permission.choice === 'deny') {
      await this.taskApproval.handleRejection(ctx, permission.taskId);
    } else {
      await this.taskApproval.handleApproval(ctx, `${permission.taskId} ${permission.choice}`);
    }
    clearPendingSurfaceApproval({
      surface: 'telegram',
      chatId,
      messageId,
      approvalId: permission.taskId,
    });
  }

  /**
   * F5f — After Zavorth STT (AudioTranscriptionService), try permission intent.
   * Returns true when the transcript was consumed as an approval decision.
   */
  public async tryHandleVoicePermissionTranscript(
    ctx: Context,
    transcript: string,
  ): Promise<boolean> {
    const chatId = ctx.chat?.id != null ? String(ctx.chat.id) : '';
    if (!chatId || !String(transcript || '').trim()) return false;

    const pending = resolvePendingSurfaceApproval({ surface: 'telegram', chatId });
    const profile = resolveSurfaceProfileForChannel('telegram');

    // High-risk confirmation follow-up: "yes <id> once"
    if (pending?.highRisk) {
      const confirmed = parseReactionConfirmation(transcript, {
        approvalId: pending.approvalId,
        choice: 'once',
      });
      if (confirmed) {
        try {
          this.assertUserIsAdmin(ctx);
          this.assertHostWritable();
          await this.taskApproval.handleApproval(ctx, `${pending.approvalId} once`);
          clearPendingSurfaceApproval({
            surface: 'telegram',
            chatId,
            approvalId: pending.approvalId,
          });
          return true;
        } catch {
          return false;
        }
      }
    }

    const result = await processVoiceReply({
      surface: 'telegram',
      profile,
      transcript,
      actorId: ctx.from?.id?.toString() || null,
      sessionId: chatId,
      approvalId: pending?.approvalId || null,
      numberedOptions: pending?.numberedOptions,
      metadata: {
        approvalId: pending?.approvalId || null,
        highRisk: pending?.highRisk || false,
        source: 'telegram_voice_stt',
      },
    });

    if (!result.ok) return false;
    const event = result.event;
    if (!isPermissionDecisionEvent(event) && event.kind === 'unknown') {
      return false;
    }

    // Inject pending approval id when user said "once" / "deny" without id
    let permission = toPermissionApprovalArgs(event);
    if (!permission && pending && event.choice) {
      permission = { taskId: pending.approvalId, choice: event.choice };
    }
    if (!permission) return false;

    try {
      this.assertUserIsAdmin(ctx);
      this.assertHostWritable();
      if (permission.choice === 'deny') {
        await this.taskApproval.handleRejection(ctx, permission.taskId);
      } else {
        await this.taskApproval.handleApproval(ctx, `${permission.taskId} ${permission.choice}`);
      }
      clearPendingSurfaceApproval({
        surface: 'telegram',
        chatId,
        approvalId: permission.taskId,
      });
      return true;
    } catch {
      return false;
    }
  }

  public async handleTaskCallback(ctx: Context, data: string): Promise<void> {
    const raw = String(data || '').trim();
    const event = parseSurfaceInteraction({
      surface: 'telegram',
      raw,
      kindHint: 'callback',
      actorId: ctx.from?.id?.toString() || null,
      sessionId: ctx.chat?.id?.toString() || null,
    });

    if (!event || event.kind === 'unknown') {
      await ctx.answerCallbackQuery({ text: 'Invalid action.' }).catch(() => undefined);
      return;
    }

    if (isUndoEvent(event)) {
      const taskId = String(event.approvalId || '').trim();
      try {
        this.assertUserIsAdmin(ctx);
        this.assertHostWritable();
        if (!this.deps.handleUndo) {
          await ctx.answerCallbackQuery({ text: 'Undo unavailable.' }).catch(() => undefined);
          await ctx.reply('Undo is not available on this surface. Use `/undo <task_id>` if supported.').catch(() => undefined);
          return;
        }
        await ctx.answerCallbackQuery({ text: 'Undoing task...' }).catch(() => undefined);
        await this.deps.handleUndo(ctx, taskId);
        await (ctx as any).editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.answerCallbackQuery({ text: message.slice(0, 180) }).catch(() => undefined);
        await ctx.reply(message).catch(() => undefined);
      }
      return;
    }

    const permission = toPermissionApprovalArgs(event);
    if (!permission) {
      await ctx.answerCallbackQuery({ text: 'Invalid action.' }).catch(() => undefined);
      return;
    }

    try {
      this.assertUserIsAdmin(ctx);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.answerCallbackQuery({ text: message.slice(0, 180) }).catch(() => undefined);
      await ctx.reply(message).catch(() => undefined);
      return;
    }

    const { choice, taskId } = permission;
    try {
      this.assertHostWritable();
      if (choice === 'deny') {
        await ctx.answerCallbackQuery({ text: 'Denying...' }).catch(() => undefined);
        await this.taskApproval.handleRejection(ctx, taskId);
      } else {
        await ctx.answerCallbackQuery({ text: `Allow ${choice}...` }).catch(() => undefined);
        await this.taskApproval.handleApproval(ctx, `${taskId} ${choice}`);
      }
      // F5a — clear controls after decision (lifecycle op; best-effort)
      const messageId = String((ctx.callbackQuery as any)?.message?.message_id || '').trim();
      for (const op of buildPostDecisionLifecycle({
        surface: 'telegram',
        choice,
        approvalId: taskId,
        allowed: choice !== 'deny',
      })) {
        await applySurfaceLifecycleOp(
          {
            surface: 'telegram',
            editMessage: async (id, text, options) => {
              await (ctx as any)
                .api?.editMessageText?.(ctx.chat?.id, Number(id), text, options)
                .catch(() => undefined);
              if (options && (ctx as any).editMessageReplyMarkup) {
                await (ctx as any)
                  .editMessageReplyMarkup({ reply_markup: options.reply_markup ?? { inline_keyboard: [] } })
                  .catch(() => undefined);
              }
            },
            editReplyMarkup: async () => {
              await (ctx as any)
                .editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } })
                .catch(() => undefined);
            },
          },
          op,
          { surface: 'telegram', messageId: messageId || null, approvalId: taskId, choice },
        ).catch(() => undefined);
      }
      await (ctx as any).editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.answerCallbackQuery({ text: message.slice(0, 180) }).catch(() => undefined);
      await ctx.reply(message).catch(() => undefined);
    }
  }

  public buildPermissionKeyboard(permission: PermissionRequest): InlineKeyboard {
    return this.permissionInteraction.buildPermissionKeyboard(permission);
  }

  public async applyPersistedPermissionPolicies(task: Task, executor: string): Promise<void> {
    await this.persistedPolicies.applyPersistedPermissionPolicies(task, executor);
  }

  public formatPermissionList(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): string {
    return this.permissionPresentation.formatPermissionList(permissions, status);
  }

  private formatPermissionDetails(permission: PermissionRequest): string {
    return this.permissionPresentation.formatPermissionDetails(permission);
  }

  public formatPermissionDecisionMessage(permission: PermissionRequest, action: 'approve' | 'reject' | 'edit'): string {
    return this.permissionPresentation.formatPermissionDecisionMessage(permission, action);
  }

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    return this.permissionPresentation.formatPermissionCreatedMessage(permission);
  }

  private async replyWithPermissionDecision(
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.permissionPresentation.buildPermissionDecisionSurfaceResponse(permission, action),
    );
  }

  public async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    return this.permissionCommands.resolvePermissionReference(ref);
  }

  public shortPermissionId(permission: PermissionRequest): string {
    return this.permissionPolicy.shortPermissionId(permission);
  }

  private assertHostWritable(): void {
    const status = this.deps.hostIdentityService?.getStatus();
    if (status && !status.authorized) {
      throw new Error('New host detected. Zavorth is in read-only mode until /hostauth trust.');
    }
  }

  /**
   * Role check aligned with AuthGuard: unset roles for an allowed user default to admin.
   * Explicit non-admin roles (e.g. vice-owner) are blocked from approve/reject/permission UI.
   */
  private assertUserIsAdmin(ctx: Context): void {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      throw new Error('Invalid user ID.');
    }
    // Match AuthGuard.ts: config.telegramUserRoles[userId] || ['admin']
    const userRoles = config.telegramUserRoles?.[userId] || ['admin'];
    if (!userRoles.includes('admin')) {
      throw new Error('Only administrators can decide on approvals/permissions.');
    }
  }

  /**
   * @deprecated TOTP challenge path removed. Always returns false (message not consumed).
   */
  public async tryConsumeHighRiskTotpReply(_ctx: Context, _rawText: string): Promise<boolean> {
    return false;
  }

  /** Test/diagnostics helper. */
  public clearHighRiskApprovalChallenges(): void {
    this.highRiskChallenges.clear();
  }
}
