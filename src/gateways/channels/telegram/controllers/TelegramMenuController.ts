import { Bot, Context, InlineKeyboard } from 'grammy';
import {
  createSurfaceResponse,
  type SurfaceResponse,
} from '../../../../domain/surface/application/surface-response/index.js';
import { CommandCatalogEntry, TELEGRAM_COMMAND_CATALOG } from '../../../../gateways/channels/telegram/commandCatalog.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

const TELEGRAM_NATIVE_MENU_LIMIT = 10;
const PRIVATE_NATIVE_MENU_ALLOWED = new Set([
  'help',
  'commands',
  'status',
  'zavorthControl',
  'perm',
  'echoapprovals',
  'trust',
  'mode',
  'lock',
  'unlock',
]);
const GROUP_NATIVE_MENU_ALLOWED = new Set([
  'help',
  'commands',
  'status',
  'perm',
  'echoapprovals',
  'lock',
  'unlock',
  'ban',
  'warn',
  'regras',
]);
const PRIVATE_MENU_PRIORITY = [
  'help',
  'commands',
  'status',
  'zavorthControl',
  'perm',
  'echoapprovals',
  'trust',
  'mode',
  'lock',
  'unlock',
];
const GROUP_MENU_PRIORITY = [
  'help',
  'commands',
  'status',
  'perm',
  'echoapprovals',
  'lock',
  'unlock',
  'ban',
  'warn',
  'regras',
];

export class TelegramMenuController {
  constructor(private bot: Bot) {}

  public getHelpText(): string {
    const lines = [
      '*Zavorth - Quick Guide*',
      '',
      'Start with natural language. Use commands when you want full control.',
      'Examples: "connect me to Discord", "connect me to Slack", "find why this build broke", "install what is missing and test again".',
      'If Docker, dependencies, toolchains, webhooks, or secrets are missing, Zavorth should explain what is missing and negotiate the next step with you.',
      'The native Telegram menu stays short on purpose: it supports diagnostics, permission, and emergency flows. The normal path remains free text.',
      '',
      '*Essential Support*',
      '- `/status` - runtime overview',
      '- `/zavorthControl` - web dashboard',
      '- `/perm list` - view pending permissions',
      '- `/zavorth` - support hub when you want manual navigation',
      '',
      '*Operator Shortcuts*',
      '- `/setupagent <request>` - natural channel onboarding and guided setup',
      '- `/plan <task>` - plan before acting',
      '- `/swarm <objective>` - short multi-agent team',
      '- `/automations <request>` - natural routines and maintenance',
      '- `/watchmode ...` - visual supervision with approvals',
      '- `/trust ...` - policy and sensitive surfaces',
      '',
      '*Permissions And Reading*',
      '- `/perm list` - view pending permissions',
      '- `/lock` / `/unlock` - lock or unlock the bot',
      '- `/research <topic>` - quick research when you want it',
      '',
      '*If You Want To Go Deeper*',
      '- `/channels` - Channel Mesh and technical onboarding',
      '- `/nodes` `/transports` - fleet and remote mesh',
      '- `/tasks` `/logs` `/diff` - detailed inspection',
      '- `/schedule` `/remember` `/recall` - automation and memory',
      '',
      'Use `/zavorth` as a manual fallback. For common use, write the request in natural language.',
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
      summary: 'Free text first, commands when you want full control.',
      tone: 'info',
      blocks: [
        {
          kind: 'text',
          text: stripHelpTitle(this.getHelpText()),
        },
      ],
      actions: [
        { id: 'quickstart', label: 'Quick guide', kind: 'callback', callbackData: 'hub:page:quickstart', style: 'primary' },
        { id: 'commands', label: 'Commands', kind: 'command', command: '/commands', callbackData: '/commands', style: 'secondary' },
        { id: 'status', label: 'Status', kind: 'callback', callbackData: 'hub:action:status', style: 'secondary' },
        { id: 'settings', label: 'Settings', kind: 'callback', callbackData: 'hub:page:settings', style: 'secondary' },
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

  private buildHelpKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Guia rapido', 'hub:page:quickstart')
      .text('Status', 'hub:action:status')
      .row()
      .text('Ajustes', 'hub:page:settings')
      .text('Permissoes', 'hub:page:permissions');
  }

  private getTelegramMenuCommands(): Array<{ command: string; description: string }> {
    return this.prioritizeMenuCommands(
      this.getCommandCatalog().filter((entry) => (
        entry.privateMenu !== false &&
        PRIVATE_NATIVE_MENU_ALLOWED.has(entry.command)
      )),
      PRIVATE_MENU_PRIORITY,
    );
  }

  private getTelegramGroupMenuCommands(): Array<{ command: string; description: string }> {
    return this.prioritizeMenuCommands(
      this.getCommandCatalog().filter((entry) => (
        entry.groupMenu &&
        GROUP_NATIVE_MENU_ALLOWED.has(entry.command)
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
    .replace(/^\*Zavorth - Guia rapido\*\s*/i, '')
    .trim();
}
