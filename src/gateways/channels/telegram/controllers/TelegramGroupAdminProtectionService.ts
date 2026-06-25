import { Context } from 'grammy';
import { AntiSpamService } from '../../../../services/AntiSpamService.js';
import { MessageFilterService, type FilterableMessageType } from '../../../../services/MessageFilterService.js';

type TelegramGroupAdminProtectionServiceDeps = {
  antiSpamService: AntiSpamService;
  messageFilterService: MessageFilterService;
};

export class TelegramGroupAdminProtectionService {
  constructor(private readonly deps: TelegramGroupAdminProtectionServiceDeps) {}

  public async handleAntiSpam(ctx: Context, args: string, chatId: string): Promise<void> {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    switch (subcommand) {
      case 'antilink': {
        const enable = parts[1]?.toLowerCase() !== 'off';
        await this.deps.antiSpamService.enableAntiLink(chatId, enable);
        await ctx.reply(`Antilink ${enable ? 'ativado' : 'desativado'}.`);
        return;
      }
      case 'flood': {
        const enable = parts[1]?.toLowerCase() !== 'off';
        await this.deps.antiSpamService.enableFloodProtection(chatId, enable);
        await ctx.reply(`Protecao anti-flood ${enable ? 'ativada' : 'desativada'}.`);
        return;
      }
      case 'addword': {
        const word = parts.slice(1).join(' ');
        if (!word) {
          await ctx.reply('Aviso: informe a palavra. Ex: `/antispam addword spam`', {
            parse_mode: 'Markdown',
          });
          return;
        }
        await this.deps.antiSpamService.addBannedWord(chatId, word);
        await ctx.reply(`Palavra \`${word}\` adicionada a lista de proibidas.`, {
          parse_mode: 'Markdown',
        });
        return;
      }
      case 'removeword': {
        const word = parts.slice(1).join(' ');
        const removed = await this.deps.antiSpamService.removeBannedWord(chatId, word);
        await ctx.reply(removed ? 'Palavra removida.' : 'Aviso: palavra nao encontrada.');
        return;
      }
      case 'words': {
        const words = await this.deps.antiSpamService.getBannedWords(chatId);
        await ctx.reply(
          words.length > 0
            ? `**Palavras proibidas:** ${words.join(', ')}`
            : 'Nenhuma palavra proibida configurada.',
          { parse_mode: 'Markdown' },
        );
        return;
      }
      default: {
        const config = await this.deps.antiSpamService.getConfig(chatId);
        const bannedWords = config ? JSON.parse(config.banned_words) : [];
        let message = `**Anti-Spam - Configuracao**\n\n`;
        message += `Antilink: ${config?.antilink_enabled ? 'Ativo' : 'Inativo'}\n`;
        message += `Anti-flood: ${
          config?.flood_enabled
            ? `Ativo (${config.flood_max_msgs} msgs/${config.flood_window_seconds}s)`
            : 'Inativo'
        }\n`;
        message += `Palavras proibidas: ${bannedWords.length}\n\n`;
        message += `**Subcomandos:**\n`;
        message += `\`/antispam antilink [on|off]\`\n`;
        message += `\`/antispam flood [on|off]\`\n`;
        message += `\`/antispam addword <palavra>\`\n`;
        message += `\`/antispam removeword <palavra>\`\n`;
        message += `\`/antispam words\``;
        await ctx.reply(message, { parse_mode: 'Markdown' });
        return;
      }
    }
  }

  public async handleFilter(ctx: Context, args: string, chatId: string): Promise<void> {
    const parts = args.trim().split(/\s+/);
    const type = parts[0]?.toLowerCase() as FilterableMessageType;
    const action = parts[1]?.toLowerCase();

    if (!type || !MessageFilterService.getAllFilterableTypes().includes(type)) {
      const blocked = await this.deps.messageFilterService.getBlockedTypes(chatId);
      const allTypes = MessageFilterService.getAllFilterableTypes();
      let message = `**Filtro de Mensagens**\n\n`;
      message += `Tipos bloqueados: ${blocked.length > 0 ? blocked.join(', ') : 'nenhum'}\n\n`;
      message += `**Uso:** \`/filter <tipo> [on|off]\`\n`;
      message += `**Tipos disponiveis:** ${allTypes.join(', ')}`;
      await ctx.reply(message, { parse_mode: 'Markdown' });
      return;
    }

    const block = action !== 'off';
    await this.deps.messageFilterService.setFilter(chatId, type, block);
    await ctx.reply(
      `Filtro de **${type}** ${block ? 'ativado (sera deletado)' : 'desativado'}.`,
      { parse_mode: 'Markdown' },
    );
  }
}
