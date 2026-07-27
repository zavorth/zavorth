import { Bot, Context, InlineKeyboard } from 'grammy';
import {
  createSurfaceResponse,
  type SurfaceResponse,
} from '../../../../domain/surface/application/surface-response/index.js';
import { CommandCatalogEntry, TELEGRAM_COMMAND_CATALOG } from '../../../../gateways/channels/telegram/commandCatalog.js';

import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

const TELEGRAM_NATIVE_MENU_LIMIT = 8;

/** Private chats: human day-to-day first (max 8). */
const PRIVATE_NATIVE_MENU_ALLOWED = new Set([
  'help',
  'status',
  'start',
  'zavorthControl',
  'trust',
  'commands',
  'perm',
  'lock',
]);
const PRIVATE_MENU_PRIORITY = [
  'help',
  'status',
  'start',
  'zavorthControl',
  'trust',
  'commands',
  'perm',
  'lock',
];

/** Groups: keep safety verbs; still short. */
const GROUP_NATIVE_MENU_ALLOWED = new Set([
  'help',
  'status',
  'commands',
  'perm',
  'lock',
  'unlock',
  'ban',
  'warn',
]);
const GROUP_MENU_PRIORITY = [
  'help',
  'status',
  'commands',
  'perm',
  'lock',
  'unlock',
  'ban',
  'warn',
];

export class TelegramMenuController {
  constructor(private bot: Bot) {}

  public getHelpText(): string {
    const lines = [
      '*Zavorth - Quick Guide*',
      '',
      'Talk normally first. Use commands only when you want a shortcut.',
      '',
      '*Without commands (best path)*',
      '- "what can you do..."',
      '- "what did you learn..." / "what do you remember about me..."',
      '- "undo learning …"',
      '- "where can I find you..." / "telegram guide"',
      '- "start" or "skip setup"',
      '- any request in natural language',
      '',
      '*8 menu shortcuts*',
      '- `/help` — this guide',
      '- `/status` — runtime overview',
      '- `/start` — hub / welcome',
      '- `/zavorthControl` — web panel',
      '- `/trust` — trust and limits',
      '- `/commands` — advanced list (only if needed)',
      '- `/perm` — pending permissions',
      '- `/lock` — emergency lock',
      '',
      '*Learning*',
      'In chat: state preferences ("I prefer short answers").',
      'Then: "what did you learn..." or "undo learning …".',
      'In CLI: `zavorth learn` = `zavorth anyone digest` (same hub).',
      '',
      '*CLI in 4 verbs*',
      '`ask` · `connect` · `learn` · `ready`  (rest: help advanced)',
      '',
      '*Advanced (not for everyday use)*',
      '- `/commands` — complete slash catalog',
      '- CLI: `zavorth help advanced` — ops / mesh / platform',
      '',
      'Normal path: free text. Short menu on purpose.',
    ];

    return lines.join('\n');
  }

  public async renderHelpCard(ctx: Context): Promise<void> {
    await replyWithTelegramSurfaceResponse(ctx, this.buildHelpSurfaceResponse());
  }

  public buildHelpSurfaceResponse(): SurfaceResponse {
    return createSurfaceResponse({
      id: 'telegram-help-surface',
      intent: 'help',
      title: 'Zavorth - Quick Guide',
      summary: 'Talk normally first. Short menu; advanced only when asked.',
      tone: 'info',
      blocks: [
        {
          kind: 'text',
          text: stripHelpTitle(this.getHelpText()),
        },
      ],
      actions: [
        { id: 'status', label: 'Status', kind: 'callback', callbackData: 'hub:action:status', style: 'primary' },
        { id: 'powers', label: 'O que sei fazer', kind: 'command', command: '/help', callbackData: 'hub:page:quickstart', style: 'secondary' },
        { id: 'commands', label: 'Advanced commands', kind: 'command', command: '/commands', callbackData: '/commands', style: 'secondary' },
        { id: 'permissions', label: 'Permissions', kind: 'callback', callbackData: 'hub:page:permissions', style: 'secondary' },
      ],
    });
  }

  public async registerTelegramMenu(): Promise<void> {
    const privateCommands = this.getTelegramMenuCommands();
    const groupCommands = this.getTelegramGroupMenuCommands();

    await this.bot.api.setMyCommands(groupCommands);
    await this.bot.api.setMyCommands(privateCommands, { scope: { type: 'all_private_chats' } } as any);
    await this.bot.api.setMyCommands(groupCommands, { scope: { type: 'all_group_chats' } } as any);
  }

  private getTelegramMenuCommands(): Array<{ command: string; description: string }> {
    return this.prioritizeMenuCommands(
      this.getCommandCatalog().filter((entry) => (
        entry.privateMenu !== false
        && PRIVATE_NATIVE_MENU_ALLOWED.has(entry.command)
      )),
      PRIVATE_MENU_PRIORITY,
    );
  }

  private getTelegramGroupMenuCommands(): Array<{ command: string; description: string }> {
    return this.prioritizeMenuCommands(
      this.getCommandCatalog().filter((entry) => (
        entry.groupMenu
        && GROUP_NATIVE_MENU_ALLOWED.has(entry.command)
      )),
      GROUP_MENU_PRIORITY,
    );
  }

  private getCommandCatalog(): CommandCatalogEntry[] {
    return TELEGRAM_COMMAND_CATALOG.filter((entry) => !entry.hidden);
  }

  private prioritizeMenuCommands(
    entries: CommandCatalogEntry[],
    priority: string[],
  ): Array<{ command: string; description: string }> {
    const byCommand = new Map(entries.map((entry) => [entry.command, entry]));
    const selected: CommandCatalogEntry[] = [];

    for (const command of priority) {
      const entry = byCommand.get(command);
      if (entry) {
        selected.push(entry);
        byCommand.delete(command);
      }
      if (selected.length >= TELEGRAM_NATIVE_MENU_LIMIT) {
        break;
      }
    }

    for (const entry of entries) {
      if (selected.length >= TELEGRAM_NATIVE_MENU_LIMIT) {
        break;
      }
      if (byCommand.has(entry.command)) {
        selected.push(entry);
        byCommand.delete(entry.command);
      }
    }

    return selected.map(({ command, description }) => ({ command, description }));
  }
}

function stripHelpTitle(text: string): string {
  return String(text || '')
    .replace(/^\*Zavorth[^*]*\*\s*/i, '')
    .trim();
}
