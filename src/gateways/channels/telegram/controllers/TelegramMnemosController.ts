import type { Context } from 'grammy';
import type { McpRuntimeService } from '../../../../mcp/McpRuntimeService.js';
import {
  MnemosHumanInTheLoopService,
  type MnemosToolInvoker,
} from '@zavorth/services/MnemosHumanInTheLoopService.js';
import type { LogRepository } from '@zavorth/storage/LogRepository.js';

type TelegramMnemosControllerOptions = {
  logRepo: LogRepository;
  mcpRuntimeService?: Pick<McpRuntimeService, 'readSnapshot'> | null;
  toolInvoker?: MnemosToolInvoker | null;
  mnemosService?: MnemosHumanInTheLoopService;
};

export class TelegramMnemosController {
  private readonly mnemosService: MnemosHumanInTheLoopService;
  private readonly mcpRuntimeService: Pick<McpRuntimeService, 'readSnapshot'> | null;

  constructor(private readonly options: TelegramMnemosControllerOptions) {
    this.mcpRuntimeService = options.mcpRuntimeService || null;
    this.mnemosService =
      options.mnemosService ||
      new MnemosHumanInTheLoopService(options.logRepo, options.toolInvoker || null);
  }

  public async handleMnemosCallback(ctx: Context, data: string): Promise<void> {
    await this.answerCallback(ctx);

    if (!this.mcpRuntimeService) {
      await this.respond(ctx, '⚠️ Mnemos is not connected in this session.');
      return;
    }

    const result = await this.mnemosService.processCallback(data, this.mcpRuntimeService);
    await this.respond(ctx, result.responseText || 'Mnemos callback processed.');
  }

  private async answerCallback(ctx: Context): Promise<void> {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // Telegram may reject stale callbacks; the user-facing response still matters.
    }
  }

  private async respond(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.editMessageText(text);
      return;
    } catch {
      await ctx.reply(text);
    }
  }
}
