import { parseTelegramCommand } from '../BotGatewayHelpers.js';

export const TELEGRAM_OPERATOR_SLASH_COMMANDS = new Set([
  '/status',
  '/approve',
  '/reject',
  '/lock',
  '/unlock',
  '/doctor',
  '/reload',
  '/selfupdate',
]);

const TELEGRAM_THIN_ADAPTER_PHASE = 'P3-001';

export class TelegramLegacySurfacePolicyService {
  public isCriticalOperatorSlashCommand(rawText: string, commandType: string): boolean {
    const trimmed = String(rawText || '').trim();
    if (!trimmed.startsWith('/')) {
      return false;
    }

    const rawCommand = parseTelegramCommand(trimmed)?.commandType || '';
    return TELEGRAM_OPERATOR_SLASH_COMMANDS.has(rawCommand)
      || TELEGRAM_OPERATOR_SLASH_COMMANDS.has(commandType);
  }

  public buildUnhandledOperatorCommandMessage(rawText: string, commandType: string): string {
    const commandLabel = parseTelegramCommand(rawText)?.commandType || commandType;
    return `Comando operador ${commandLabel} nao foi tratado neste runtime.`;
  }

  public buildCompatibilityTaskPrompt(commandType: string): string {
    if (commandType === '/auto') {
      return 'O comando /auto fica como compatibilidade. Escreva o objetivo depois dele ou mande o pedido em linguagem natural para o agent loop canonico escolher o caminho.';
    }

    return 'O comando /task fica como compatibilidade. Escreva o objetivo depois dele ou mande o pedido em linguagem natural para o agent loop canonico organizar a tarefa.';
  }

  public buildTaskDispatchFallbackMessage(taskId: string): string {
    return [
      'Organizei esse pedido e ele ja ficou registrado.',
      '',
      `Referencia curta: ${String(taskId || '').substring(0, 8)}`,
      'Para continuar, descreva o proximo objetivo em linguagem natural; o Telegram atua como adapter fino e o runtime canonico escolhe o caminho.',
    ].join('\n');
  }

  public buildThinAdapterMetadata(): Record<string, unknown> {
    return {
      phase: TELEGRAM_THIN_ADAPTER_PHASE,
      surface: 'telegram',
      telegramRole: 'thin-adapter',
      canonicalEntrypoint: 'ZavorthAgentGateway.handle',
      preservedBoundaries: [
        'operator-commands',
        'callbacks',
        'approval',
        'diagnostics',
        'emergency',
      ],
      retiredProductPaths: [
        'menus',
        'hubs',
        'chat-cleanup',
      ],
    };
  }
}

export const telegramLegacySurfacePolicyService = new TelegramLegacySurfacePolicyService();
