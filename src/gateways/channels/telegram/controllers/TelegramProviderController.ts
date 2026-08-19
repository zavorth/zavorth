import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import { LlmRoleRoutingService } from '../../../../services/llm/LlmRoleRoutingService.js';
import { LlmRoleSurfaceCommands } from '../../../../services/llm/LlmRoleSurfaceCommands.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';
import { ProviderFactory } from '../../../../providers/ProviderFactory.js';
import { t } from '../../../../i18n/telegram.js';
import { normalizeRoleSurface, resolveLlmRoleScopeId } from '../../../../contracts/runtime/LlmRoleRoutingContract.js';

type TelegramProviderControllerRuntime = {
  providerControlPlaneService?: ProviderControlPlaneService;
  llmRoleRoutingService?: LlmRoleRoutingService;
  llmRuntimeService?: LlmRuntimeService;
};

export class TelegramProviderController {
  private readonly providerControlPlaneService: ProviderControlPlaneService;
  private readonly llmRoleRoutingService: LlmRoleRoutingService;
  private readonly llmRoleSurfaceCommands: LlmRoleSurfaceCommands;
  private readonly llmRuntimeService: LlmRuntimeService;

  constructor(runtime: TelegramProviderControllerRuntime = {}) {
    this.providerControlPlaneService = runtime.providerControlPlaneService || new ProviderControlPlaneService();
    this.llmRoleRoutingService = runtime.llmRoleRoutingService || new LlmRoleRoutingService();
    this.llmRoleSurfaceCommands = new LlmRoleSurfaceCommands(this.llmRoleRoutingService);
    this.llmRuntimeService = runtime.llmRuntimeService || new LlmRuntimeService();
  }

  public async handleModel(ctx: Context, args: string): Promise<void> {
    const cmdCtx = this.commandContext(ctx);
    const shared = this.llmRoleSurfaceCommands.handleModelArgs(cmdCtx, args);
    if (shared.handled && shared.text) {
      await ctx.reply(shared.text);
      return;
    }

    const scopeId = this.scopeId(ctx);
    const rawTarget = String(args || '').trim();
    const selection = this.providerControlPlaneService.resolveSelection(rawTarget);
    if (!selection) {
      await ctx.reply(
        t('model.unrecognized', {
          target: rawTarget,
          targets: this.providerControlPlaneService.getUsageTargets().join(', '),
        }),
      );
      return;
    }

    this.providerControlPlaneService.applySelection(selection);
    const provider = String(selection.effectiveProviderName || 'gemini').trim() || 'gemini';
    const model = String(selection.modelName || this.defaultModelForProvider(provider)).trim();
    this.llmRoleRoutingService.recordModelSwitch(scopeId, provider, model, 'telegram');

    if (selection.selectionKind === 'model') {
      await ctx.reply(
        t('model.switched_model', {
          label: String(selection.replyLabel || provider),
          model: model || String(selection.modelName || ''),
        }),
        { parse_mode: 'Markdown' },
      );
    } else {
      await ctx.reply(
        t('model.switched_provider', {
          label: String(selection.replyLabel || provider),
          model: provider === 'gemini' ? String(config.geminiModel || '') : '',
        }),
        { parse_mode: 'Markdown' },
      );
    }

    const prompt = this.llmRoleSurfaceCommands.promptSetup(cmdCtx, false);
    if (prompt.shouldPrompt && prompt.text) {
      await ctx.reply(prompt.text);
    }
  }

  public async handleStrong(ctx: Context, args: string): Promise<void> {
    const raw = String(args || '')
      .trim()
      .toLowerCase();
    const enabled = !(raw === 'off' || raw === 'default');
    await ctx.reply(this.llmRoleSurfaceCommands.setForceStrong(this.commandContext(ctx), enabled));
  }

  public async handleRoleSetupReply(ctx: Context, text: string): Promise<boolean> {
    const scopeId = this.scopeId(ctx);
    const cfg = this.llmRoleRoutingService.getConfig(scopeId);
    if (!cfg.awaitingSetup && !cfg.pendingConfirmation) {
      return false;
    }

    try {
      const provider = ProviderFactory.create();
      const result = await this.llmRoleRoutingService.handleInboundSetupMessage(scopeId, text, provider, (name) =>
        this.llmRuntimeService.isProviderAvailable(name),
      );
      if (!result.handled) return false;
      await ctx.reply(result.reply || t('model.setup_applied', { summary: 'ok' }));
      return true;
    } catch {
      await ctx.reply(t('model.setup_failed'));
      return true;
    }
  }

  private commandContext(ctx: Context) {
    const userId = ctx.from?.id ? String(ctx.from.id) : '';
    return {
      userId,
      surface: normalizeRoleSurface('telegram'),
      roleScopeId: resolveLlmRoleScopeId({ userId, surface: 'telegram' }),
      isProviderUsable: (name: string) => this.llmRuntimeService.isProviderAvailable(name),
      defaultModelForProvider: (provider: string) => this.defaultModelForProvider(provider),
      resolveSelection: (target: string) => this.providerControlPlaneService.resolveSelection(target),
      usageTargets: () => this.providerControlPlaneService.getUsageTargets(),
    };
  }

  private scopeId(ctx: Context): string {
    const userId = ctx.from?.id ? String(ctx.from.id) : '';
    return resolveLlmRoleScopeId({ userId, surface: 'telegram' });
  }

  private defaultModelForProvider(provider: string): string {
    const p = String(provider || '').toLowerCase();
    if (p === 'gemini') return config.geminiModel;
    if (p === 'openai') return config.openaiModel;
    if (p === 'deepseek') return config.deepseekModel;
    if (p === 'openrouter') return config.openRouterModel;
    return '';
  }
}
