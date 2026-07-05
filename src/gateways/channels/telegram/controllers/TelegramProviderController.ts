import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';

type TelegramProviderControllerRuntime = {
  providerControlPlaneService?: ProviderControlPlaneService;
};

export class TelegramProviderController {
  private readonly providerControlPlaneService: ProviderControlPlaneService;

  constructor(runtime: TelegramProviderControllerRuntime = {}) {
    this.providerControlPlaneService =
      runtime.providerControlPlaneService || new ProviderControlPlaneService();
  }

  public async handleModel(ctx: Context, args: string): Promise<void> {
    const rawTarget = String(args || '').trim();
    if (!rawTarget) {
      await ctx.reply(
        `To change Zavorth's conversational provider, use \`/model <name>\`.\n\nExamples: \`${this.providerControlPlaneService.getUsageTargets().join('`, `')}\`.`,
      );
      return;
    }

    const selection = this.providerControlPlaneService.resolveSelection(rawTarget);
    if (!selection) {
      await ctx.reply(
        `I did not recognize this provider/model: ${rawTarget}\n\nYou can use: ${this.providerControlPlaneService.getUsageTargets().join(', ')} or a direct Gemini/Gemma model, such as \`gemma-2-27b-it\`.`,
      );
      return;
    }

    this.providerControlPlaneService.applySelection(selection);

    if (selection.selectionKind === 'model') {
      await ctx.reply(
        `Done. Zavorth will now chat using **${selection.replyLabel}** through **Gemini API** in this session.\n\nActive model: \`${selection.modelName}\`\nEffective provider: \`gemini\`\n\nTo make this persistent, update the \`.env\` later.`,
      );
      return;
    }

    const modelLine =
      selection.effectiveProviderName === 'gemini'
        ? `\nActive model: \`${config.geminiModel}\``
        : '';
    await ctx.reply(
      `Done. Zavorth will now chat using **${selection.replyLabel}** in this session.${modelLine}\n\nTo make this persistent, update the \`.env\` later.`,
    );
  }
}
