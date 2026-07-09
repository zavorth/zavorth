import fs from 'fs';
import { Context, InputFile, InlineKeyboard } from 'grammy';
import { config } from '../../../../config/index.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../../../services/FinalResponseFormattingService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { FileDeliveryPlan, FileDeliveryService } from '../../../../runtime/artifacts/FileDeliveryService.js';

type TelegramFileDeliveryControllerDeps = {
  permissionService?: PermissionService;
  buildPermissionKeyboard?: (permission: PermissionRequest) => InlineKeyboard;
  formatPermissionCreatedMessage?: (permission: PermissionRequest) => string;
};

export class TelegramFileDeliveryController {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(
    private fileDeliveryService: FileDeliveryService = new FileDeliveryService(),
    private deps: TelegramFileDeliveryControllerDeps = {},
  ) {}

  public shouldHandleFreeForm(text: string, userId: string): boolean {
    return this.fileDeliveryService.shouldHandleText(userId, text);
  }

  public async handleCommand(ctx: Context, args: string, userId: string): Promise<void> {
    await this.handleRequest(ctx, args, userId);
  }

  public async handleFreeForm(ctx: Context, text: string, userId: string): Promise<void> {
    await this.handleRequest(ctx, text, userId);
  }

  private async handleRequest(ctx: Context, rawRequest: string, userId: string): Promise<void> {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('This file delivery flow is available only in private chat with Zavorth.');
      return;
    }

    const trimmedRequest = String(rawRequest || '').trim();
    if (!trimmedRequest) {
      await ctx.reply('Tell me what you want to receive. Example: `/files downloads report.pdf`.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    try {
      const allowedPaths = await this.getApprovedPaths();
      const plan = await this.fileDeliveryService.prepare(userId, trimmedRequest, {
        extraAllowedPaths: allowedPaths,
      });
      await this.deliverPlan(ctx, plan);
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(
        this.formatter.compose('I could not prepare this delivery right now.', [
          {
            lines: [`Reason: ${error instanceof Error ? error.message : String(error)}`],
          },
        ]),
      );
    }
  }

  public async handleApprovedPermission(ctx: Context, permission: PermissionRequest): Promise<boolean> {
    if (permission.executor !== 'file_delivery' || permission.kind !== 'workspace_access') {
      return false;
    }

    const originalRequest = String(permission.metadata?.original_request || '').trim();
    const userId = String(permission.metadata?.requested_by || ctx.from?.id || '').trim();
    const allowedPath = String(permission.resolved_value || permission.requested_value || '').trim();
    if (!originalRequest || !allowedPath) {
      await ctx.reply('The permission was approved, but I lost the original file delivery request.');
      return true;
    }

    const plan = await this.fileDeliveryService.prepare(userId, originalRequest, {
      extraAllowedPaths: [allowedPath, ...(await this.getApprovedPaths())],
    });
    await this.deliverPlan(ctx, plan);
    return true;
  }

  private async deliverPlan(ctx: Context, plan: FileDeliveryPlan): Promise<void> {
    if (plan.kind === 'message') {
      await ctx.reply(plan.text);
      return;
    }

    if (plan.kind === 'choices') {
      await ctx.reply(this.formatter.formatFileChoices(plan.prompt));
      return;
    }

    if (plan.kind === 'permission') {
      if (!this.deps.permissionService) {
        await ctx.reply(
          this.formatter.compose('Approval required', [
            {
              lines: [
                'I need permission to access this specific path.',
                `Folder: ${plan.previewPath}`,
              ],
            },
          ]),
        );
        return;
      }

      const permission = await this.deps.permissionService.createRequest({
        executor: 'file_delivery',
        kind: 'workspace_access',
        scope: 'once',
        workspace: config.defaultWorkspace,
        requested_value: plan.requestedPath,
        resolved_value: plan.requestedPath,
        reason: plan.reason,
        requested_by: ctx.from?.id?.toString() || '',
        metadata: {
          original_request: plan.originalRequest,
          requested_by: ctx.from?.id?.toString() || '',
          permission_source: 'file_delivery',
          access_level: 'read_only',
        },
      });
      const text =
        this.deps.formatPermissionCreatedMessage?.(permission) ||
        this.formatter.compose('Approval required', [
          {
            lines: [`Zavorth needs your decision before accessing ${plan.previewPath}.`],
          },
        ]);
      const keyboard = this.deps.buildPermissionKeyboard?.(permission);
      await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined);
      return;
    }

    try {
      if (plan.previewText) {
        await ctx.reply(this.formatter.formatFilePreview(plan.previewText, plan.fileName));
      }

      if (ctx.chat?.id) {
        await ctx.api.sendChatAction(ctx.chat.id, 'upload_document');
      }

      await ctx.replyWithDocument(new InputFile(plan.sendPath, plan.fileName), {
        caption: plan.caption,
      });
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(
        this.formatter.compose('I could not send this file right now.', [
          {
            lines: [`Reason: ${error instanceof Error ? error.message : String(error)}`],
          },
        ]),
      );
    } finally {
      if (plan.cleanupPath && fs.existsSync(plan.cleanupPath)) {
        await fs.promises.rm(plan.cleanupPath, { force: true });
      }
    }
  }

  private async getApprovedPaths(): Promise<string[]> {
    if (!this.deps.permissionService) {
      return [];
    }

    const policies = await this.deps.permissionService.listApprovedRequests(
      'file_delivery',
      'workspace_access',
      config.defaultWorkspace,
    );

    return policies
      .filter((policy) => policy.scope !== 'once')
      .map((policy) => String(policy.resolved_value || policy.requested_value || '').trim())
      .filter(Boolean);
  }
}
