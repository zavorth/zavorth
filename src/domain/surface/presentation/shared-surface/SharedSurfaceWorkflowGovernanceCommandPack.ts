import { config } from '../../../../config/index.js';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import type { PermissionService } from '../../../../services/PermissionService.js';
import type { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import { buildPermissionPendingCard } from '../../../../services/PermissionProposalPresentation.js';
import { buildSelfmodProposalPendingCard } from '../../../../services/SelfmodProposalPresentation.js';
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

import {
  canApplySelfModification,
  parseSelfModificationArgs,
} from './workflow-governance/workflowGovernanceSelfModification.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';
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

  public async maybeHandleCommand(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (
      String(commandType || '')
        .trim()
        .toLowerCase()
    ) {
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

  private async handlePermissionPlane(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.permissionService) {
      await ctx.reply('Permission plane unavailable in this shared runtime.');
      return;
    }

    const normalized = String(args || '').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const action = String(tokens[0] || 'list')
      .trim()
      .toLowerCase();

    try {
      if (action === 'show') {
        const resolved = await this.resolvePermissionReferenceWithOrdinal(tokens[1] || '');
        if (resolved.permission.status === 'pending') {
          await this.replyPermissionOpener(ctx, resolved.permission, resolved.ordinal);
          return;
        }
        await ctx.reply(formatPermissionDetailsReply(resolved.permission));
        return;
      }

      if (action === 'approve') {
        const { permission } = await this.resolvePermissionReferenceWithOrdinal(tokens[1] || '');
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
        const { permission } = await this.resolvePermissionReferenceWithOrdinal(tokens[1] || '');
        const note = tokens.slice(2).join(' ').trim() || null;
        const updated = await this.deps.permissionService.rejectRequest(
          permission.permission_id,
          String(ctx.userId || '').trim() || null,
          note,
        );
        await ctx.reply(formatPermissionDecisionReply(updated, 'reject'));
        return;
      }

      const statusToken = String(tokens[0] || 'pending')
        .trim()
        .toLowerCase();
      const status = ['pending', 'approved', 'rejected', 'expired', 'all'].includes(statusToken)
        ? (statusToken as 'pending' | 'approved' | 'rejected' | 'expired' | 'all')
        : 'pending';
      const limitCandidate = status === statusToken ? tokens[1] : tokens[0];
      const limit = safeParseInt(String(limitCandidate || '10'), 10);
      const permissions = await this.deps.permissionService.listRequests(status, Number.isFinite(limit) ? limit : 10);
      // Single pending opener: attach Approve/Reject affordances at proposal/show time.
      if (status === 'pending' && permissions.length === 1) {
        await this.replyPermissionOpener(ctx, permissions[0], 1);
        return;
      }
      await ctx.reply(formatPermissionListReply(permissions, status));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      await ctx.reply(`Permission operation failed: ${message}`);
    }
  }

  private async replyPermissionOpener(
    ctx: IMessageContext,
    permission: PermissionRequest,
    ordinal: number,
  ): Promise<void> {
    const card = buildPermissionPendingCard({
      permission,
      channel: String(ctx.platform || 'plain'),
      ordinal,
    });
    try {
      await replyWithSharedSurfaceResponse(ctx, card.surfaceResponse, {
        trackApprovalId: permission.permission_id,
        maxActionsPerRow: 2,
      });
    } catch {
      await ctx.reply(card.text);
    }
  }

  private async handleWorkflowCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.workflowController) {
      await ctx.reply('Workflow plane unavailable nesta surface compartilhada.');
      return;
    }

    try {
      await this.deps.workflowController.handleWorkflow(ctx, args);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      await ctx.reply(`Could not operate the workflow right now.\n\nReason: ${message}`);
    }
  }

  private async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    const resolved = await this.resolvePermissionReferenceWithOrdinal(ref);
    return resolved.permission;
  }

  private async resolvePermissionReferenceWithOrdinal(
    ref: string,
  ): Promise<{ permission: PermissionRequest; ordinal: number }> {
    const normalized = String(ref || '').trim();
    if (!normalized || !this.deps.permissionService) {
      throw new Error('Use /perm approve 1 (from /perm list), not a long id.');
    }

    // Ordinal: /perm approve 1 against newest pending first, then all.
    const ordinalMatch = normalized.match(/^#?(\d{1,2})$/)?.[1];
    if (ordinalMatch) {
      const index = Number(ordinalMatch) - 1;
      const pending = await this.deps.permissionService.listRequests('pending', 40);
      if (Number.isFinite(index) && index >= 0 && index < pending.length) {
        return { permission: pending[index], ordinal: index + 1 };
      }
      const all = await this.deps.permissionService.listRequests('all', 40);
      if (Number.isFinite(index) && index >= 0 && index < all.length) {
        return { permission: all[index], ordinal: index + 1 };
      }
      throw new Error('Use /perm list then /perm approve 1 (number out of range).');
    }

    const exact = await this.deps.permissionService.getRequest(normalized);
    if (exact) {
      return {
        permission: exact,
        ordinal: await this.findPermissionOrdinal(exact.permission_id),
      };
    }

    const requests = await this.deps.permissionService.listRequests('all', 200);
    const matches = requests.filter((entry) => String(entry.permission_id || '').startsWith(normalized));
    if (matches.length === 1) {
      return {
        permission: matches[0],
        ordinal: await this.findPermissionOrdinal(matches[0].permission_id),
      };
    }
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous short ref. Use /perm list then /perm approve 1. Matches: ${matches
          .slice(0, 5)
          .map((entry) => String(entry.permission_id || '').slice(0, 8))
          .join(', ')}`,
      );
    }
    throw new Error('Use /perm approve 1 (from /perm list), not a long id.');
  }

  private async findPermissionOrdinal(permissionId: string): Promise<number> {
    if (!this.deps.permissionService) return 1;
    const pending = await this.deps.permissionService.listRequests('pending', 40);
    const index = pending.findIndex((entry) => entry.permission_id === permissionId);
    return index >= 0 ? index + 1 : 1;
  }

  private resolveRecentWorkflowRunId(ctx: Pick<IMessageContext, 'userId'>, keywords: string[]): string | null {
    if (!this.deps.taskManager?.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(50, requestedBy) || [];
    return resolveRecentWorkflowRunIdFromTasks(recentTasks, keywords);
  }

  private async handleSelfModificationPlane(ctx: IMessageContext, rawArgs: string): Promise<void> {
    if (!this.deps.selfModificationCommandService) {
      await ctx.reply('Selfmod unavailable in this shared runtime.');
      return;
    }

    if (ctx.isGroup) {
      await ctx.reply('The selfmod flow can only be used in a private/direct context.');
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
        'You can generate selfmod previews, but applying or reverting real changes requires owner/trusted or an authenticated operator surface.',
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
        await this.replySelfmodProposalOpener(ctx, result);
        return;
      }

      if (parsed.mode === 'goal') {
        const result = await this.deps.selfModificationCommandService.createGoalPreview(parsed.goal, requestedBy);
        await this.replySelfmodProposalOpener(ctx, result);
        return;
      }

      if (parsed.mode === 'apply') {
        const result = await this.deps.selfModificationCommandService.applyPreview(parsed.previewId, requestedBy);
        await ctx.reply(formatSelfModificationApplyReply(result));
        return;
      }

      const result = await this.deps.selfModificationCommandService.rollbackChangeSet(parsed.changeId, requestedBy);
      await ctx.reply(formatSelfModificationRollbackReply(result));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      await ctx.reply(`Could not operate selfmod right now.\n\nReason: ${message}`);
    }
  }

  private async replySelfmodProposalOpener(
    ctx: IMessageContext,
    result: {
      success: boolean;
      mode: 'file' | 'goal' | 'multi';
      previewId?: string;
      relativePath?: string;
      relativePaths?: string[];
      summary: string;
      diffSummary?: string;
      changeCount?: number;
      resourceImpact?: string;
      validationPlan?: string[];
      optimizationAnalysis?: Parameters<typeof formatSelfModificationPreviewReply>[0]['optimizationAnalysis'];
    },
  ): Promise<void> {
    const previewText = formatSelfModificationPreviewReply(result);
    // Proposal-time card with Apply/Reject when surface supports buttons.
    if (result.previewId) {
      const card = buildSelfmodProposalPendingCard({
        previewId: result.previewId,
        summary: result.summary,
        relativePath: result.relativePath,
        mode: result.mode === 'multi' ? 'goal' : result.mode,
        changeCount: result.changeCount,
        resourceImpact: result.resourceImpact,
        diffSummary: result.diffSummary,
        success: result.success,
        channel: String(ctx.platform || 'plain'),
      });
      try {
        await replyWithSharedSurfaceResponse(
          ctx,
          {
            ...card.surfaceResponse,
            blocks: [
              { kind: 'text', text: previewText },
              ...(card.surfaceResponse.blocks || []).filter((b) => b.kind === 'actions'),
            ],
          },
          {
            maxActionsPerRow: 2,
          },
        );
        return;
      } catch {
        await ctx.reply(previewText);
        return;
      }
    }
    await ctx.reply(previewText);
  }

  private canApplySelfModification(ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>): boolean {
    if (ctx.isGroup) {
      return false;
    }

    if (ctx.platform === 'telegram') {
      const roles = (config.telegramUserRoles[String(ctx.userId || '').trim()] || [])
        .map((role) =>
          String(role || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean);
      return canApplySelfModification(ctx, roles);
    }

    return canApplySelfModification(ctx, []);
  }
}
