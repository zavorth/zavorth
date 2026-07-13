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
      '*Zavorth - Guia rapido*',
      '',
      'Fale normal primeiro. Comandos so quando quiser atalho.',
      '',
      '*Sem comando (melhor caminho)*',
      '- "o que voce sabe fazer?"',
      '- "o que voce aprendeu?" / "o que lembra de mim?"',
      '- "desfazer aprendizado …"',
      '- "onde te acho?" / "guia telegram"',
      '- "comecar" ou "pular setup"',
      '- qualquer pedido em linguagem natural',
      '',
      '*8 atalhos do menu*',
      '- `/help` — este guia',
      '- `/status` — overview do runtime',
      '- `/start` — hub / boas-vindas',
      '- `/zavorthControl` — painel web',
      '- `/trust` — confianca e limites',
      '- `/commands` — lista avancada (so se precisar)',
      '- `/perm` — permissoes pendentes',
      '- `/lock` — trava de emergencia',
      '',
      '*Aprendizado*',
      'No chat: diga preferencias ("prefiro respostas curtas").',
      'Depois: "o que voce aprendeu?" ou "desfazer aprendizado …".',
      'No CLI: `zavorth learn` = `zavorth anyone digest` (mesmo hub).',
      '',
      '*CLI em 4 verbos*',
      '`ask` · `connect` · `learn` · `ready`  (resto: help advanced)',
      '',
      '*Avancado (nao e o dia a dia)*',
      '- `/commands` — catalogo completo de slash',
      '- CLI: `zavorth help advanced` — ops / mesh / plataforma',
      '',
      'Caminho normal: texto livre. Menu curto de proposito.',
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
      title: 'Zavorth - Guia rapido',
      summary: 'Fale normal primeiro. Menu curto; avancado so se pedir.',
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
        { id: 'commands', label: 'Comandos avancados', kind: 'command', command: '/commands', callbackData: '/commands', style: 'secondary' },
        { id: 'permissions', label: 'Permissoes', kind: 'callback', callbackData: 'hub:page:permissions', style: 'secondary' },
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
