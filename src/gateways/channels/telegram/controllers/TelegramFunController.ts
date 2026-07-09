import { Context, Api } from 'grammy';
import { FunGamesService } from '../../../../services/FunGamesService.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';

type FunCommand = '/roll' | '/coinflip' | '/8ball' | '/joke' | '/roulette';

export class TelegramFunController {
  constructor(
    private funGamesService: FunGamesService,
    private botApi: Api,
  ) {}

  public async handle(ctx: Context, commandType: FunCommand, args?: string): Promise<void> {
    try {
      if (commandType === '/roll') {
        const sides = safeParseInt(args, 6);
        await ctx.reply(this.funGamesService.rollDice(sides), { parse_mode: 'Markdown' });
        return;
      }

      if (commandType === '/coinflip') {
        await ctx.reply(this.funGamesService.flipCoin(), { parse_mode: 'Markdown' });
        return;
      }

      if (commandType === '/8ball') {
        await ctx.reply(this.funGamesService.magic8Ball(args), { parse_mode: 'Markdown' });
        return;
      }

      if (commandType === '/roulette') {
        await ctx.reply(this.funGamesService.russianRoulette(), { parse_mode: 'Markdown' });
        return;
      }

      if (commandType === '/joke') {
        const loadingMessage = await ctx.reply('Pensando em algo cruel e engracado...');
        const joke = await this.funGamesService.tellAJoke();
        await this.botApi.editMessageText(ctx.chat!.id, loadingMessage.message_id, joke, { parse_mode: 'Markdown' });
      }
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply('Estou sem paciencia para jogos agora.', {
        reply_to_message_id: ctx.message?.message_id,
      });
    }
  }
}
