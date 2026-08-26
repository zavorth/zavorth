import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import {
  INLINE_PERMISSION_REJECTION_NOTE,
  buildPermissionApprovalPatch,
} from '../../../../services/approvals/HeadlessPermissionDecisionService.js';
import type { ParsedPermissionCallback } from '../../../../services/approvals/PermissionCallbackAlias.js';
import { parsePermissionCallbackData } from '../../../../services/approvals/PermissionCallbackAlias.js';
import { TelegramPermissionDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export type TelegramPermissionCallbackServiceDeps = {
  permissionDecision: TelegramPermissionDecisionService;
  permissionPolicy: TelegramPermissionPolicyService;
  resolvePermissionReference: (ref: string) => Promise<PermissionRequest>;
  assertHostWritable: () => void;
  /**
   * Alias layer at the router boundary: when the reference does not belong
   * to the legacy PermissionRequest registry, it resolves through the same
   * decision path used by task:* callbacks. Returns true when consumed.
   */
  resolveUnifiedApprovalFallback?: (
    ctx: Context,
    parsed: ParsedPermissionCallback,
  ) => Promise<boolean>;
};

type TelegramMessageEditContext = {
  editMessageReplyMarkup?: (other: unknown) => Promise<unknown>;
};

export class TelegramPermissionCallbackService {
  constructor(private readonly deps: TelegramPermissionCallbackServiceDeps) {}

  public async handlePermissionCallback(ctx: Context, data: string): Promise<void> {
    const parsed = parsePermissionCallbackData(data);
    // Reference extraction mirrors the legacy split so out-of-grammar data
    // keeps resolving (and reporting) against the same registry entry.
    const legacyReference = String(data || '').split(':')[2] || '';
    const userId = ctx.from?.id?.toString() || '';
    let callbackAnswered = false;

    try {
      this.deps.assertHostWritable();
      let permission: PermissionRequest;
      try {
        permission = await this.deps.resolvePermissionReference(parsed?.reference || legacyReference);
      } catch (resolutionError: unknown) {
        if (!parsed || !this.deps.resolveUnifiedApprovalFallback) {
          throw resolutionError;
        }
        // Not part of the legacy registry: resolve the callback as an alias
        // of the unified approval path instead of failing with not-found.
        const handledByAlias = await this.deps.resolveUnifiedApprovalFallback(ctx, parsed);
        if (!handledByAlias) {
          throw resolutionError;
        }
        await (ctx as unknown as TelegramMessageEditContext)
          .editMessageReplyMarkup?.({ reply_markup: undefined })
          .catch(() => undefined);
        return;
      }

      if (parsed && parsed.action === 'approve') {
        await ctx.answerCallbackQuery({ text: 'Approving permission...' });
        callbackAnswered = true;
        const patch = buildPermissionApprovalPatch({
          permission,
          scopeWord: parsed.scope,
          normalizeScope: (value) => this.deps.permissionPolicy.normalizePermissionScope(value),
          externalExecutorAgentId: config.externalExecutorAgentId,
        });
        await this.deps.permissionDecision.applyPermissionApproval(ctx, permission, patch, userId);
      } else if (parsed && parsed.action === 'deny') {
        await ctx.answerCallbackQuery({ text: 'Rejecting permission...' });
        callbackAnswered = true;
        await this.deps.permissionDecision.applyPermissionRejection(
          ctx,
          permission,
          userId,
          INLINE_PERMISSION_REJECTION_NOTE,
        );
      } else {
        await ctx.answerCallbackQuery({ text: 'Unknown inline action.' });
        return;
      }

      await (ctx as unknown as TelegramMessageEditContext)
        .editMessageReplyMarkup?.({ reply_markup: undefined })
        .catch(() => undefined);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'Failed to process the permission.';
      if (!callbackAnswered) {
        await ctx.answerCallbackQuery({ text: message });
        return;
      }
      await ctx.reply(`Failed to process the permission: ${message}`);
    }
  }
}
