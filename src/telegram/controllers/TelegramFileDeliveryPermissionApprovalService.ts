import { Context } from 'grammy';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';

export type TelegramFileDeliveryPermissionApprovalServiceDeps = {
  replyWithPermissionDecision: (
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ) => Promise<void>;
  resumeFileDeliveryPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  resumeFileInspectionPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
};

export class TelegramFileDeliveryPermissionApprovalService {
  constructor(private readonly deps: TelegramFileDeliveryPermissionApprovalServiceDeps) {}

  public async finalizeApproval(
    ctx: Context,
    approved: PermissionRequest,
  ): Promise<boolean> {
    await this.deps.replyWithPermissionDecision(ctx, approved, 'approve');

    if (this.deps.resumeFileDeliveryPermission) {
      try {
        const resumed = await this.deps.resumeFileDeliveryPermission(ctx, approved);
        if (resumed) {
          return true;
        }
      } catch (error: any) {
        await ctx.reply(
          `A permissao foi aprovada, mas nao consegui concluir o envio agora.\n\nMotivo: ${error.message}`,
        );
        return true;
      }
    }

    if (this.deps.resumeFileInspectionPermission) {
      try {
        const resumed = await this.deps.resumeFileInspectionPermission(ctx, approved);
        if (resumed) {
          return true;
        }
      } catch (error: any) {
        await ctx.reply(
          `A permissao foi aprovada, mas nao consegui concluir a inspecao agora.\n\nMotivo: ${error.message}`,
        );
        return true;
      }
    }

    return true;
  }
}
