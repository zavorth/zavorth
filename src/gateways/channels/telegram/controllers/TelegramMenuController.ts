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
  'dashboard',
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
  'dashboard',
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
      '*Zavorth - Guia rapido*',
      '',
      'Fale normal primeiro. Use comandos quando quiser controle total.',
      'Exemplos: "quero conectar voce ao Discord", "me conecta ao Slack", "veja por que esse build quebrou", "instale o que falta e teste de novo".',
      'Se faltar Docker, dependencia, toolchain, webhook ou secret, o Zavorth deve explicar o que falta e negociar o proximo passo com voce.',
      'O menu nativo do Telegram fica curto de proposito: ele e apoio de diagnostico, permissao e emergencia. O caminho normal continua sendo texto livre.',
      '',
      '*Apoio essencial*',
      '- `/status` - panorama do runtime',
      '- `/dashboard` - painel web',
      '- `/perm list` - ver permissoes pendentes',
      '- `/zavorth` - hub de apoio quando voce quiser navegar manualmente',
      '',
      '*Shortcuts de operador*',
      '- `/setupagent <pedido>` - onboarding natural de canais e setup guiado',
      '- `/plan <tarefa>` - planejar antes de agir',
      '- `/swarm <objetivo>` - equipe multiagente curta',
      '- `/automations <pedido>` - rotinas naturais e maintenance',
      '- `/watchmode ...` - supervisao visual com approvals',
      '- `/trust ...` - politica e surfaces sensiveis',
      '',
      '*Permissoes e leitura*',
      '- `/perm list` - ver permissoes pendentes',
      '- `/lock` / `/unlock` - trancar ou destrancar o bot',
      '- `/research <tema>` - pesquisa rapida quando voce quiser',
      '',
      '*Se quiser ir mais fundo*',
      '- `/channels` - Channel Mesh e onboarding tecnico',
      '- `/nodes` `/transports` - fleet e malha remota',
      '- `/tasks` `/logs` `/diff` - inspecao detalhada',
      '- `/schedule` `/remember` `/recall` - automacao e memoria',
      '',
      'Use `/zavorth` como fallback manual. Para uso comum, escreva o pedido em linguagem natural.',
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
      summary: 'Texto livre primeiro, comandos quando voce quiser controle total.',
      tone: 'info',
      blocks: [
        {
          kind: 'text',
          text: stripHelpTitle(this.getHelpText()),
        },
      ],
      actions: [
        { id: 'quickstart', label: 'Guia rapido', kind: 'callback', callbackData: 'hub:page:quickstart', style: 'primary' },
        { id: 'commands', label: 'Comandos', kind: 'command', command: '/commands', callbackData: '/commands', style: 'secondary' },
        { id: 'status', label: 'Status', kind: 'callback', callbackData: 'hub:action:status', style: 'secondary' },
        { id: 'settings', label: 'Ajustes', kind: 'callback', callbackData: 'hub:page:settings', style: 'secondary' },
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
