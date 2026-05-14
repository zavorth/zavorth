import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { ProviderControlPlaneService } from '../../services/ProviderControlPlaneService.js';

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
        `Para trocar o provider conversacional do Zavorth, use \`/model <nome>\`.\n\nExemplos: \`${this.providerControlPlaneService.getUsageTargets().join('`, `')}\`.`,
      );
      return;
    }

    const selection = this.providerControlPlaneService.resolveSelection(rawTarget);
    if (!selection) {
      await ctx.reply(
        `Nao reconheci esse provider/modelo: ${rawTarget}\n\nVoce pode usar: ${this.providerControlPlaneService.getUsageTargets().join(', ')} ou um modelo Gemini/Gemma direto, como \`gemma-4-31b-it\`.`,
      );
      return;
    }

    this.providerControlPlaneService.applySelection(selection);

    if (selection.selectionKind === 'model') {
      await ctx.reply(
        `Pronto. O Zavorth agora vai conversar usando **${selection.replyLabel}** via **Gemini API** nesta sessao.\n\nModelo ativo: \`${selection.modelName}\`\nProvider efetivo: \`gemini\`\n\nSe quiser deixar isso fixo, depois eu posso te orientar a ajustar o \`.env\`.`,
      );
      return;
    }

    const modelLine =
      selection.effectiveProviderName === 'gemini'
        ? `\nModelo ativo: \`${config.geminiModel}\``
        : '';
    await ctx.reply(
      `Pronto. O Zavorth agora vai conversar usando **${selection.replyLabel}** nesta sessao.${modelLine}\n\nSe quiser deixar isso fixo, depois eu posso te orientar a ajustar o \`.env\`.`,
    );
  }
}
