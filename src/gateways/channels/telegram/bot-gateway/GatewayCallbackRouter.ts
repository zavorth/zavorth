import type { Context } from 'grammy';
import { normalizeSharedSurfaceCommandCallback } from '../../../../domain/surface/presentation/shared-surface/SharedSurfaceCallbackCommandPolicy.js';

export type GatewayCallbackRouterDeps = {
  handleHubCallback: (ctx: Context, data: string) => Promise<void>;
  handlePermissionCallback: (ctx: Context, data: string) => Promise<void>;
  handleEchoApprovalCallback?: (ctx: Context, data: string) => Promise<void>;
  handleMnemosCallback?: (ctx: Context, data: string) => Promise<void>;
  handleExperienceActionCardCallback?: (ctx: Context, data: string) => Promise<void>;
  handleTaskCallback?: (ctx: Context, data: string) => Promise<void>;
  handleStatusAction: (ctx: Context) => Promise<void>;
  handleHelpAction: (ctx: Context) => Promise<void>;
  handleAuditAction: (ctx: Context) => Promise<void>;
  handleModeAction: (ctx: Context) => Promise<void>;
  handleModelsAction: (ctx: Context) => Promise<void>;
  handleSurfaceCommandCallback?: (ctx: Context, commandText: string) => Promise<void>;
  logError?: (message: string) => void;
};

export class GatewayCallbackRouter {
  constructor(private readonly deps: GatewayCallbackRouterDeps) {}

  public async handleCallback(ctx: Context, data: string): Promise<void> {
    try {
      if (data === 'action:delete') {
        try {
          if (ctx.msg?.message_id) {
            await ctx.deleteMessage();
          }
        } catch {
          // Delete callbacks should still acknowledge stale messages.
        }

        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('hub:')) {
        await this.deps.handleHubCallback(ctx, data);
        return;
      }

      if (data.startsWith('perm:')) {
        await this.deps.handlePermissionCallback(ctx, data);
        return;
      }

      if (data.startsWith('task:') && this.deps.handleTaskCallback) {
        await this.deps.handleTaskCallback(ctx, data);
        return;
      }

      if (data.startsWith('echo:') && this.deps.handleEchoApprovalCallback) {
        await this.deps.handleEchoApprovalCallback(ctx, data);
        return;
      }

      if (data.startsWith('mnemos:') && this.deps.handleMnemosCallback) {
        await this.deps.handleMnemosCallback(ctx, data);
        return;
      }

      if (data.startsWith('xcard:')) {
        if (!/^xcard:[a-z0-9:-]{1,80}$/i.test(data)) {
          await ctx.answerCallbackQuery({ text: 'Action card invalido.' });
          return;
        }
        if (this.deps.handleExperienceActionCardCallback) {
          await this.deps.handleExperienceActionCardCallback(ctx, data);
          return;
        }
        await ctx.answerCallbackQuery({ text: 'Action card recebido. Abra /dashboard ou use a CLI para decidir.' });
        return;
      }

      const sharedSurfaceCommand = normalizeSharedSurfaceCommandCallback(data);
      if (sharedSurfaceCommand && this.deps.handleSurfaceCommandCallback) {
        await ctx.answerCallbackQuery();
        await this.deps.handleSurfaceCommandCallback(ctx, sharedSurfaceCommand);
        return;
      }

      switch (data) {
        case 'menu_status':
          await ctx.answerCallbackQuery();
          await this.deps.handleStatusAction(ctx);
          return;
        case 'menu_help':
          await ctx.answerCallbackQuery();
          await this.deps.handleHelpAction(ctx);
          return;
        case 'menu_audit':
          await ctx.answerCallbackQuery();
          await this.deps.handleAuditAction(ctx);
          return;
        case 'menu_mode':
          await ctx.answerCallbackQuery();
          await this.deps.handleModeAction(ctx);
          return;
        case 'menu_models':
          await ctx.answerCallbackQuery();
          await this.deps.handleModelsAction(ctx);
          return;
        default:
          await ctx.answerCallbackQuery({ text: 'Comando nao reconhecido.' });
      }
    } catch (error: any) {
      this.deps.logError?.(error?.message || String(error));
      await ctx.answerCallbackQuery({ text: 'Erro ao processar.' });
    }
  }

}
