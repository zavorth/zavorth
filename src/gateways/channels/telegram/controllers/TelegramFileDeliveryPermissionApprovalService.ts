import { Context } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';

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
      } catch (error: any) { const err = error; const e = error;
        const msg = error instanceof Error ? error.message : String(error);
        await ctx.reply(
          `The permission was approved, but I could not complete the delivery right now.\n\nReason: ${msg}`,
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
      } catch (error: any) { const err = error; const e = error;
        const msg = error instanceof Error ? error.message : String(error);
        await ctx.reply(
          `The permission was approved, but I could not complete the inspection right now.\n\nReason: ${msg}`,
        );
        return true;
      }
    }

    return true;
  }
}
