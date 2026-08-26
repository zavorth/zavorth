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
import type { ParsedPermissionCallback } from '../../../../services/approvals/PermissionCallbackAlias.js';
import { toTaskApprovalChoice } from '../../../../services/approvals/PermissionCallbackAlias.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationService.js';
import { PersistedPermissionPolicyService } from '../../../../services/approvals/PersistedPermissionPolicyService.js';
import { TaskApprovalService } from '../../../../services/approvals/TaskApprovalService.js';
import { ApprovalCoordinator } from '../../../../services/approvals/ApprovalCoordinator.js';
import type { ApprovalCoordinatorGatewayPort } from '../../../../services/approvals/ApprovalCoordinator.js';
import { SurfaceDecisionSpine } from '../../../../services/approvals/SurfaceDecisionSpine.js';
import type { SurfaceDecisionResolveInput } from '../../../../services/approvals/SurfaceDecisionSpine.js';
import {
  HeadlessPermissionDecisionService,
  surfaceChoiceToPermissionScopeWord,
} from '../../../../services/approvals/HeadlessPermissionDecisionService.js';
import type { SmartDecisionAdvisor } from '../../../../services/approvals/SmartDecisionAdvisor.js';
import { TaskDecisionPort } from '../../../../services/approvals/ports/TaskDecisionPort.js';
import { PermissionRegistryPort } from '../../../../services/approvals/ports/PermissionRegistryPort.js';
import { getAgentPermissionService } from '../../../../services/permission/AgentPermissionService.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';
import {
  applySurfaceLifecycleOp,
  buildPostDecisionLifecycle,
  clearPendingSurfaceApprovalsByApprovalId,
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

type TelegramMessageEditContext = {
  api?: {
    editMessageText?: (
      chatId: number | string | undefined,
      messageId: number,
      text: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
  editMessageReplyMarkup?: (other: unknown) => Promise<unknown>;
};

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
  /** Role table for the spine access gate; defaults to config.telegramUserRoles. */
  resolveUserRoles?: () => Record<string, string[]>;
  /** Injection seam for a pre-wired decision spine; self-built when absent. */
  decisionSpine?: SurfaceDecisionSpine;
  /** Opt-in spine advisor; OFF (unused) when omitted. */
  smartAdvisor?: Pick<SmartDecisionAdvisor, 'advise'>;
};

function createPassiveApprovalGateway(): ApprovalCoordinatorGatewayPort {
  return {
    findPendingApproval: () => null,
    approve: async () => null,
    reject: async () => null,
    listRuns: () => [],
  };
}

export class TelegramPermissionController {
  private taskSecurityPosture = new TaskSecurityPostureService();
  private readonly permissionDecision: TelegramPermissionDecisionService;
  private readonly permissionPolicy = new TelegramPermissionPolicyService();
  private readonly permissionPresentation: TelegramPermissionPresentationService;
  private readonly persistedPolicies: PersistedPermissionPolicyService;
  private readonly taskApproval: TaskApprovalService;
  private readonly permissionCommands: TelegramPermissionCommandService;
  private readonly permissionInteraction: TelegramPermissionInteractionService;
  private readonly headlessPermissions: HeadlessPermissionDecisionService;
  private readonly decisionSpine: SurfaceDecisionSpine;
  private readonly resolveUserRoles: () => Record<string, string[]>;

  constructor(private deps: TelegramPermissionControllerDeps) {
    this.permissionPresentation = new TelegramPermissionPresentationService(this.permissionPolicy);
    this.persistedPolicies = new PersistedPermissionPolicyService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.permissionPolicy,
      persistTask: this.deps.persistTask,
    });
    this.taskApproval = new TaskApprovalService({
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
      resolveUnifiedApprovalFallback: (ctx, parsed) =>
        this.resolveUnifiedApprovalFallback(ctx, parsed),
    });
    this.resolveUserRoles = deps.resolveUserRoles ?? (() => config.telegramUserRoles || {});
    this.headlessPermissions = new HeadlessPermissionDecisionService({
      approveRequest: (permissionId, decidedBy, patch) =>
        this.deps.permissionService.approveRequest(permissionId, decidedBy, patch),
      rejectRequest: (permissionId, decidedBy, note) =>
        this.deps.permissionService.rejectRequest(permissionId, decidedBy, note),
      resolvePermissionReference: (ref) => this.resolvePermissionReference(ref),
      normalizePermissionScope: (value) => this.permissionPolicy.normalizePermissionScope(value),
      buildDecisionSurfaceResponse: (permission, action) =>
        this.permissionPresentation.buildPermissionDecisionSurfaceResponse(permission, action),
      externalExecutorAgentId: config.externalExecutorAgentId,
    });
    this.decisionSpine = deps.decisionSpine ?? this.buildDefaultDecisionSpine();
  }

  /** Injection/access seam for cross-surface resolvers reusing this spine's gate and ports. */
  public getDecisionSpine(): SurfaceDecisionSpine {
    return this.decisionSpine;
  }

  private listPendingTaskApprovalRefs(): string[] {
    const recent = this.deps.taskManager.getRecentTasks?.(50) ?? [];
    return recent
      .filter(
        (task) =>
          String(task.approval_status || '') === 'pending' ||
          String(task.status || '') === 'waiting_approval',
      )
      .map((task) => task.task_id);
  }

  private listPendingPermissionRefs(): string[] {
    const recent = this.deps.taskManager.getRecentTasks?.(50) ?? [];
    return recent
      .filter(
        (task) =>
          String(task.metadata?.pendingPermissionId || '').trim() !== '' &&
          (String(task.approval_status || '') === 'pending' ||
            String(task.status || '') === 'waiting_approval'),
      )
      .map((task) => String(task.metadata?.pendingPermissionId || '').trim())
      .filter(Boolean);
  }

  private buildDefaultDecisionSpine(): SurfaceDecisionSpine {
    const spine = new SurfaceDecisionSpine({
      coordinator: new ApprovalCoordinator(createPassiveApprovalGateway()),
      scopeMemory: getAgentPermissionService({ projectRoot: process.cwd() }),
      accessGate: async ({ userId }) => this.checkTaskDecisionAccess(userId),
      smartAdvisor: this.deps.smartAdvisor,
    });
    spine.registerDecisionPort(
      'task',
      new TaskDecisionPort(this.taskApproval, {
        pendingRefs: () => this.listPendingTaskApprovalRefs(),
      }),
    );
    spine.registerDecisionPort(
      'permission',
      new PermissionRegistryPort(async ({ reference, action, scope, actorId }) => {
        const outcome = await this.headlessPermissions.decide({
          reference,
          action,
          scopeWord: surfaceChoiceToPermissionScopeWord(scope),
          actorId: actorId ?? '',
        });
        return { resolved: outcome.resolved, receiptText: outcome.receiptText };
      }, {
        pendingRefs: () => this.listPendingPermissionRefs(),
      }),
    );
    return spine;
  }

  /**
   * Spine-side mirror of the legacy guard pair (admin role first, host
   * writability second) with the exact same rejection messages, so the
   * routed decision path and the direct methods enforce one policy.
   */
  private async checkTaskDecisionAccess(userId: string | null): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    if (!userId) {
      return { allowed: false, reason: 'Invalid user ID.' };
    }
    const userRoles = this.resolveUserRoles()?.[userId] || ['admin'];
    if (!userRoles.includes('admin')) {
      return { allowed: false, reason: 'Only administrators can decide on approvals/permissions.' };
    }
    const status = this.deps.hostIdentityService?.getStatus();
    if (status && !status.authorized) {
      return {
        allowed: false,
        reason: 'New host detected. Zavorth is in read-only mode until /hostauth trust.',
      };
    }
    return { allowed: true };
  }

  /**
   * Resolves a task decision through the universal spine. A null receipt text
   * means the engine already spoke through the bound transport context; any
   * other text is delivered exactly where the legacy guards replied.
   */
  private async resolveTaskDecisionThroughSpine(
    ctx: Context,
    request: SurfaceDecisionResolveInput,
  ): Promise<void> {
    const receipt = await this.decisionSpine.resolve(request);
    if (receipt.receiptText == null) {
      return;
    }
    await ctx.reply(receipt.receiptText).catch(() => undefined);
  }

  private currentActorId(ctx: Context): string | null {
    return ctx.from?.id?.toString() ?? null;
  }

  private currentChatId(ctx: Context): string {
    return ctx.chat?.id != null ? String(ctx.chat.id) : '';
  }

  /**
   * Alias layer of the unified approval spine: a `perm:*` callback whose
   * reference is not a legacy PermissionRequest resolves through the exact
    * decision path used by task:* callbacks (TaskApprovalService), so
   * both callback families share one approval semantics.
   */
  private async resolveUnifiedApprovalFallback(
    ctx: Context,
    parsed: ParsedPermissionCallback,
  ): Promise<boolean> {
    if (parsed.action === 'deny') {
      await ctx.answerCallbackQuery({ text: 'Denying...' }).catch(() => undefined);
      await this.taskApproval.handleRejection(ctx, parsed.reference);
      return true;
    }
    const choice = toTaskApprovalChoice(parsed.scope);
    await ctx.answerCallbackQuery({ text: `Allow ${choice}...` }).catch(() => undefined);
    await this.taskApproval.handleApproval(ctx, `${parsed.reference} ${choice}`);
    return true;
  }

  public async handlePermissionAllowCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionAllowCommand(ctx, args);
  }

  public async handlePermissionRevokeCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionRevokeCommand(ctx, args);
  }

  public async handleApproval(ctx: Context, args: string): Promise<void> {
    await this.resolveTaskDecisionThroughSpine(ctx, {
      decisionType: 'task',
      decisionRef: '',
      surface: 'telegram',
      chatId: this.currentChatId(ctx),
      userId: this.currentActorId(ctx),
      rawArgs: String(args ?? ''),
      transportContext: ctx,
    });
  }

  public async handleRejection(ctx: Context, taskId: string): Promise<void> {
    await this.resolveTaskDecisionThroughSpine(ctx, {
      decisionType: 'task',
      decisionRef: String(taskId ?? '').trim(),
      surface: 'telegram',
      chatId: this.currentChatId(ctx),
      userId: this.currentActorId(ctx),
      choice: 'deny',
      transportContext: ctx,
    });
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
    const reactionUpdate = ctx.messageReaction || ctx.update?.message_reaction;
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
    clearPendingSurfaceApprovalsByApprovalId(permission.taskId);
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
          clearPendingSurfaceApprovalsByApprovalId(pending.approvalId);
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
      clearPendingSurfaceApprovalsByApprovalId(permission.taskId);
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
        await (ctx as unknown as TelegramMessageEditContext).editMessageReplyMarkup?.({ reply_markup: undefined }).catch(() => undefined);
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

    const { choice, taskId } = permission;
    const decisionRequest: SurfaceDecisionResolveInput =
      choice === 'deny'
        ? {
            decisionType: 'task',
            decisionRef: taskId,
            surface: 'telegram',
            chatId: this.currentChatId(ctx),
            userId: this.currentActorId(ctx),
            choice: 'deny',
            transportContext: ctx,
          }
        : {
            decisionType: 'task',
            decisionRef: '',
            surface: 'telegram',
            chatId: this.currentChatId(ctx),
            userId: this.currentActorId(ctx),
            rawArgs: `${taskId} ${choice}`,
            transportContext: ctx,
          };
    const receipt = await this.decisionSpine.resolve(decisionRequest);

    if (!receipt.resolved) {
      const message = receipt.receiptText;
      if (message != null) {
        await ctx.answerCallbackQuery({ text: message.slice(0, 180) }).catch(() => undefined);
        await ctx.reply(message).catch(() => undefined);
      }
      return;
    }

    if (choice === 'deny') {
      await ctx.answerCallbackQuery({ text: 'Denying...' }).catch(() => undefined);
    } else {
      await ctx.answerCallbackQuery({ text: `Allow ${choice}...` }).catch(() => undefined);
    }
    // F5a — clear controls after decision (lifecycle op; best-effort)
    const messageId = String(ctx.callbackQuery?.message?.message_id || '').trim();
    const messageCtx = ctx as unknown as TelegramMessageEditContext;
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
            await messageCtx.api?.editMessageText?.(ctx.chat?.id, Number(id), text, options).catch(() => undefined);
            if (options && messageCtx.editMessageReplyMarkup) {
              await messageCtx.editMessageReplyMarkup({ reply_markup: options.reply_markup ?? { inline_keyboard: [] } }).catch(() => undefined);
            }
          },
          editReplyMarkup: async () => {
            await messageCtx.editMessageReplyMarkup?.({ reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
          },
        },
        op,
        { surface: 'telegram', messageId: messageId || null, approvalId: taskId, choice },
      ).catch(() => undefined);
    }
    await messageCtx.editMessageReplyMarkup?.({ reply_markup: undefined }).catch(() => undefined);
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
}
