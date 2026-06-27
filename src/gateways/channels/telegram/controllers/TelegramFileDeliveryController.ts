// @ts-nocheck
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
      await ctx.reply('Esse fluxo de envio de arquivos fica disponivel apenas no chat privado com o Zavorth.');
      return;
    }

    const trimmedRequest = String(rawRequest || '').trim();
    if (!trimmedRequest) {
      await ctx.reply('Diga o que voce quer receber. Exemplo: `/arquivo downloads relatorio.pdf`.', {
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
    } catch (error: unknown) {
      await ctx.reply(
        this.formatter.compose('Nao consegui preparar esse envio agora.', [
          {
            lines: [`Motivo: ${error.message}`],
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
      await ctx.reply('A permissao foi aprovada, mas eu perdi o pedido original do envio de arquivo.');
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
          this.formatter.compose('Aprovacao necessaria', [
            {
              lines: [
                'Preciso de permissao para acessar este caminho especifico.',
                `Pasta: ${plan.previewPath}`,
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
        this.formatter.compose('Aprovacao necessaria', [
          {
            lines: [`O Zavorth precisa da sua decisao para acessar ${plan.previewPath}.`],
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
    } catch (error: unknown) {
      await ctx.reply(
        this.formatter.compose('Nao consegui enviar esse arquivo agora.', [
          {
            lines: [`Motivo: ${error.message}`],
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
