import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { TelegramPermissionApprovalPatch } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export type TelegramPermissionCallbackServiceDeps = {
  permissionDecision: TelegramPermissionDecisionService;
  permissionPolicy: TelegramPermissionPolicyService;
  resolvePermissionReference: (ref: string) => Promise<PermissionRequest>;
  assertHostWritable: () => void;
};

export class TelegramPermissionCallbackService {
  constructor(private readonly deps: TelegramPermissionCallbackServiceDeps) {}

  public async handlePermissionCallback(ctx: Context, data: string): Promise<void> {
    const [, action, reference, scopeToken] = data.split(':');
    const userId = ctx.from?.id?.toString() || '';
    let callbackAnswered = false;

    try {
      this.deps.assertHostWritable();
      const permission = await this.deps.resolvePermissionReference(reference || '');

      if (action === 'approve') {
        await ctx.answerCallbackQuery({ text: 'Approving permission...' });
        callbackAnswered = true;
        const patch: TelegramPermissionApprovalPatch = {};
        if (scopeToken) {
          patch.scope = this.deps.permissionPolicy.normalizePermissionScope(scopeToken);
        }
        if (!patch.resolved_value && permission.executor === 'external_executor') {
          patch.resolved_value =
            permission.resolved_value ||
            String(permission.metadata?.suggested_agent_id || config.externalExecutorAgentId || 'main');
        }
        await this.deps.permissionDecision.applyPermissionApproval(ctx, permission, patch, userId);
      } else if (action === 'reject') {
        await ctx.answerCallbackQuery({ text: 'Rejecting permission...' });
        callbackAnswered = true;
        await this.deps.permissionDecision.applyPermissionRejection(
          ctx,
          permission,
          userId,
          'Inline rejection from Telegram.',
        );
      } else {
        await ctx.answerCallbackQuery({ text: 'Unknown inline action.' });
        return;
      }

      await (ctx as any).editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
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
