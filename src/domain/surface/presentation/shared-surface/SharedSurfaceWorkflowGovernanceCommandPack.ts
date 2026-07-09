import { config } from '../../../../config/index.js';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import type { PermissionService } from '../../../../services/PermissionService.js';
import type { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import {
  parseExplicitSelfModificationIntent,
  parseNaturalPermissionIntent,
  parseNaturalWorkflowIntent,
  type ExplicitSelfModificationIntent,
  type NaturalPermissionIntent,
  type NaturalWorkflowIntent,
} from './workflow-governance/workflowGovernanceIntents.js';
import {
  formatPermissionDecisionReply,
  formatPermissionDetailsReply,
  formatPermissionListReply,
  formatSelfModificationApplyReply,
  formatSelfModificationPreviewReply,
  formatSelfModificationRollbackReply,
  renderSelfModificationUsage,
} from './workflow-governance/workflowGovernanceRenderers.js';
import { resolveRecentWorkflowRunIdFromTasks } from './workflow-governance/workflowGovernanceTaskResolution.js';

import { canApplySelfModification, parseSelfModificationArgs } from './workflow-governance/workflowGovernanceSelfModification.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
export type SharedSurfaceWorkflowGovernanceCommandPackDeps = {
  permissionService: PermissionService | null;
  selfModificationCommandService: SelfModificationCommandService | null;
  workflowController: {
    handleWorkflow: (ctx: IMessageContext, args: string) => Promise<void>;
  } | null;
  taskManager: {
    getRecentTasks?: (limit?: number, userId?: string) => Task[];
  } | null;
};

export class SharedSurfaceWorkflowGovernanceCommandPack {
  public constructor(private readonly deps: SharedSurfaceWorkflowGovernanceCommandPackDeps) {}

  public async maybeHandleNaturalPermission(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent = parseNaturalPermissionIntent(rawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalPermissionIntent(ctx, intent);
    return true;
  }

  public async maybeHandleExplicitSelfModification(
    ctx: IMessageContext,
    rawText: string,
  ): Promise<boolean> {
    const intent = parseExplicitSelfModificationIntent(rawText);
    if (!intent) {
      return false;
    }

    await this.handleExplicitSelfModificationIntent(ctx, intent);
    return true;
  }

  public async maybeHandleNaturalWorkflow(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent = parseNaturalWorkflowIntent(rawText);
    if (!intent) {
      return false;
    }

    await this.handleNaturalWorkflowIntent(ctx, intent);
    return true;
  }

  public async maybeHandleCommand(
    ctx: IMessageContext,
    commandType: string,
    args: string,
  ): Promise<boolean> {
    switch (String(commandType || '').trim().toLowerCase()) {
      case '/workflow':
        await this.handleWorkflowCommand(ctx, args);
        return true;
      case '/perm':
        await this.handlePermissionPlane(ctx, args);
        return true;
      case '/selfmod':
        await this.handleSelfModificationPlane(ctx, args);
        return true;
      default:
        return false;
    }
  }

  private async handleNaturalPermissionIntent(
    ctx: IMessageContext,
    intent: NaturalPermissionIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    await this.handlePermissionPlane(
      ctx,
      intent.command === 'list' ? intent.args : `${intent.command} ${intent.args}`.trim(),
    );
  }

  private async handleExplicitSelfModificationIntent(
    ctx: IMessageContext,
    intent: ExplicitSelfModificationIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    await this.handleSelfModificationPlane(ctx, intent.args);
  }

  private async handleNaturalWorkflowIntent(
    ctx: IMessageContext,
    intent: NaturalWorkflowIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    if (intent.resolveRecent) {
      const workflowRunId = this.resolveRecentWorkflowRunId(ctx, intent.resolveRecent.keywords);
      if (!workflowRunId) {
        await ctx.reply(
          'Nao encontrei um workflow recente com esse contexto. Use /workflow resume <wf-id> se quiser ser mais explicito.',
        );
        return;
      }
      await this.handleWorkflowCommand(ctx, `resume ${workflowRunId}`);
      return;
    }
    await this.handleWorkflowCommand(ctx, intent.args);
  }

  private async handlePermissionPlane(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.permissionService) {
      await ctx.reply('Permission plane indisponivel neste runtime compartilhado.');
      return;
    }

    const normalized = String(args || '').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const action = String(tokens[0] || 'list').trim().toLowerCase();

    try {
      if (action === 'show') {
        const permission = await this.resolvePermissionReference(tokens[1] || '');
        await ctx.reply(formatPermissionDetailsReply(permission));
        return;
      }

      if (action === 'approve') {
        const permission = await this.resolvePermissionReference(tokens[1] || '');
        const note = tokens.slice(2).join(' ').trim() || null;
        const updated = await this.deps.permissionService.approveRequest(
          permission.permission_id,
          String(ctx.userId || '').trim() || null,
          note ? { decision_note: note } : {},
        );
        await ctx.reply(formatPermissionDecisionReply(updated, 'approve'));
        return;
      }

      if (action === 'reject') {
        const permission = await this.resolvePermissionReference(tokens[1] || '');
        const note = tokens.slice(2).join(' ').trim() || null;
        const updated = await this.deps.permissionService.rejectRequest(
          permission.permission_id,
          String(ctx.userId || '').trim() || null,
          note,
        );
        await ctx.reply(formatPermissionDecisionReply(updated, 'reject'));
        return;
      }

      const statusToken = String(tokens[0] || 'pending').trim().toLowerCase();
      const status = ['pending', 'approved', 'rejected', 'expired', 'all'].includes(statusToken)
        ? (statusToken as 'pending' | 'approved' | 'rejected' | 'expired' | 'all')
        : 'pending';
      const limitCandidate = status === statusToken ? tokens[1] : tokens[0];
      const limit = safeParseInt(String(limitCandidate || '10'), 10);
      const permissions = await this.deps.permissionService.listRequests(
        status,
        Number.isFinite(limit) ? limit : 10,
      );
      await ctx.reply(formatPermissionListReply(permissions, status));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'erro desconhecido';
      await ctx.reply(`Falha na operacao de permissao: ${message}`);
    }
  }

  private async handleWorkflowCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.workflowController) {
      await ctx.reply('Workflow plane indisponivel nesta surface compartilhada.');
      return;
    }

    try {
      await this.deps.workflowController.handleWorkflow(ctx, args);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'erro desconhecido';
      await ctx.reply(`Nao consegui operar o workflow agora.\n\nMotivo: ${message}`);
    }
  }

  private async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    const normalized = String(ref || '').trim();
    if (!normalized || !this.deps.permissionService) {
      throw new Error('Informe uma permissao valida.');
    }

    const exact = await this.deps.permissionService.getRequest(normalized);
    if (exact) {
      return exact;
    }

    const requests = await this.deps.permissionService.listRequests('all', 200);
    const matches = requests.filter((entry) => String(entry.permission_id || '').startsWith(normalized));
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(
        `Referencia ambigua. Seja mais especifico. Matches: ${matches
          .slice(0, 5)
          .map((entry) => entry.permission_id)
          .join(', ')}`,
      );
    }
    throw new Error('Nao encontrei essa permissao.');
  }

  private resolveRecentWorkflowRunId(
    ctx: Pick<IMessageContext, 'userId'>,
    keywords: string[],
  ): string | null {
    if (!this.deps.taskManager?.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(50, requestedBy) || [];
    return resolveRecentWorkflowRunIdFromTasks(recentTasks, keywords);
  }

  private async handleSelfModificationPlane(ctx: IMessageContext, rawArgs: string): Promise<void> {
    if (!this.deps.selfModificationCommandService) {
      await ctx.reply('Selfmod indisponivel neste runtime compartilhado.');
      return;
    }

    if (ctx.isGroup) {
      await ctx.reply('O fluxo de selfmod so pode ser usado em contexto privado/direto.');
      return;
    }

    const parsed = parseSelfModificationArgs(rawArgs);
    if (!parsed) {
      await ctx.reply(renderSelfModificationUsage());
      return;
    }

    const requestedBy = String(ctx.userId || '').trim() || 'unknown';
    if ((parsed.mode === 'apply' || parsed.mode === 'rollback') && !this.canApplySelfModification(ctx)) {
      await ctx.reply(
        'Voce pode gerar previews com selfmod, mas aplicar ou reverter mudancas reais exige owner/trusted ou uma surface operator autenticada.',
      );
      return;
    }

    try {
      if (parsed.mode === 'preview') {
        const result = await this.deps.selfModificationCommandService.createPreview(
          parsed.filePath,
          parsed.instruction,
          requestedBy,
        );
        await ctx.reply(formatSelfModificationPreviewReply(result));
        return;
      }

      if (parsed.mode === 'goal') {
        const result = await this.deps.selfModificationCommandService.createGoalPreview(
          parsed.goal,
          requestedBy,
        );
        await ctx.reply(formatSelfModificationPreviewReply(result));
        return;
      }

      if (parsed.mode === 'apply') {
        const result = await this.deps.selfModificationCommandService.applyPreview(
          parsed.previewId,
          requestedBy,
        );
        await ctx.reply(formatSelfModificationApplyReply(result));
        return;
      }

      const result = await this.deps.selfModificationCommandService.rollbackChangeSet(
        parsed.changeId,
        requestedBy,
      );
      await ctx.reply(formatSelfModificationRollbackReply(result));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'erro desconhecido';
      await ctx.reply(`Nao consegui operar o selfmod agora.\n\nMotivo: ${message}`);
    }
  }

  private canApplySelfModification(
    ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>,
  ): boolean {
    if (ctx.isGroup) {
      return false;
    }

    if (ctx.platform === 'telegram') {
      const roles = (config.telegramUserRoles[String(ctx.userId || '').trim()] || [])
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean);
      return canApplySelfModification(ctx, roles);
    }

    return canApplySelfModification(ctx, []);
  }
}
