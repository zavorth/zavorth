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
        await ctx.reply(`Antilink ${enable ? 'enabled' : 'disabled'}.`);
        return;
      }
      case 'flood': {
        const enable = parts[1]?.toLowerCase() !== 'off';
        await this.deps.antiSpamService.enableFloodProtection(chatId, enable);
        await ctx.reply(`Anti-flood protection ${enable ? 'enabled' : 'disabled'}.`);
        return;
      }
      case 'addword': {
        const word = parts.slice(1).join(' ');
        if (!word) {
          await ctx.reply('Warning: provide the word. Example: `/antispam addword spam`', {
            parse_mode: 'Markdown',
          });
          return;
        }
        await this.deps.antiSpamService.addBannedWord(chatId, word);
        await ctx.reply(`Word \`${word}\` added to the banned list.`, {
          parse_mode: 'Markdown',
        });
        return;
      }
      case 'removeword': {
        const word = parts.slice(1).join(' ');
        const removed = await this.deps.antiSpamService.removeBannedWord(chatId, word);
        await ctx.reply(removed ? 'Word removed.' : 'Warning: word not found.');
        return;
      }
      case 'words': {
        const words = await this.deps.antiSpamService.getBannedWords(chatId);
        await ctx.reply(
          words.length > 0
            ? `**Banned words:** ${words.join(', ')}`
            : 'No banned words configured.',
          { parse_mode: 'Markdown' },
        );
        return;
      }
      default: {
        const config = await this.deps.antiSpamService.getConfig(chatId);
        const bannedWords = config ? JSON.parse(config.banned_words) : [];
        let message = `**Anti-Spam - Configuration**\n\n`;
        message += `Antilink: ${config?.antilink_enabled ? 'Active' : 'Inactive'}\n`;
        message += `Anti-flood: ${
          config?.flood_enabled
            ? `Active (${config.flood_max_msgs} msgs/${config.flood_window_seconds}s)`
            : 'Inactive'
        }\n`;
        message += `Banned words: ${bannedWords.length}\n\n`;
        message += `**Subcommands:**\n`;
        message += `\`/antispam antilink [on|off]\`\n`;
        message += `\`/antispam flood [on|off]\`\n`;
        message += `\`/antispam addword <word>\`\n`;
        message += `\`/antispam removeword <word>\`\n`;
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
      let message = `**Message Filter**\n\n`;
      message += `Blocked types: ${blocked.length > 0 ? blocked.join(', ') : 'none'}\n\n`;
      message += `**Usage:** \`/filter <type> [on|off]\`\n`;
      message += `**Available types:** ${allTypes.join(', ')}`;
      await ctx.reply(message, { parse_mode: 'Markdown' });
      return;
    }

    const block = action !== 'off';
    await this.deps.messageFilterService.setFilter(chatId, type, block);
    await ctx.reply(
      `Filter for **${type}** ${block ? 'enabled (will be deleted)' : 'disabled'}.`,
      { parse_mode: 'Markdown' },
    );
  }
}
