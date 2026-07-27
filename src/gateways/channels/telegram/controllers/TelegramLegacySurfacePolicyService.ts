import { parseTelegramCommand } from '../../../../gateways/channels/telegram/BotGatewayHelpers.js';

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

const TELEGRAM_THIN_ADAPTER_CONTRACT = 'telegram-thin-adapter';

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
    return `Operator command ${commandLabel} was not handled in this runtime.`;
  }

  public buildCompatibilityTaskPrompt(commandType: string): string {
    if (commandType === '/auto') {
      return 'The /auto command remains for compatibility. Write the objective after it or send the request in natural language so the canonical agent loop can choose the path.';
    }

    return 'The /task command remains for compatibility. Write the objective after it or send the request in natural language so the canonical agent loop can organize the task.';
  }

  public buildTaskDispatchFallbackMessage(taskId: string): string {
    return [
      'I organized this request and it has been recorded.',
      '',
      `Short reference: ${String(taskId || '').substring(0, 8)}`,
      'To continue, describe the next objective in natural language; Telegram acts as a thin adapter and the canonical runtime chooses the path.',
    ].join('\n');
  }

  public buildThinAdapterMetadata(): Record<string, unknown> {
    return {
      phase: TELEGRAM_THIN_ADAPTER_CONTRACT,
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
