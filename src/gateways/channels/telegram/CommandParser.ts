import { getExplicitExecutorForCommand, isKnownCommand, resolveCommandAlias } from '../../../gateways/channels/telegram/commandCatalog.js';

export interface ParsedCommand {
  command_type: string;
  command_args: string;
  normalized_message: string;
  explicit_executor: string | null;
  references_last_task: boolean;
  workspace_command_name?: string | null;
}

export function normalizeTelegramCommandToken(commandToken: string): string {
  const normalizedToken = commandToken.trim().toLowerCase();
  if (!normalizedToken.startsWith('/')) {
    return normalizedToken;
  }

  const atIndex = normalizedToken.indexOf('@');
  return atIndex >= 0 ? normalizedToken.slice(0, atIndex) : normalizedToken;
}

export class CommandParser {
  public parse(rawMessage: string): ParsedCommand {
    const text = rawMessage.trim();
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let command_type = 'message';
    let command_args = '';
    let explicit_executor: string | null = null;

    if (text.startsWith('/')) {
      const parts = text.split(' ');
      command_type = resolveCommandAlias(normalizeTelegramCommandToken(parts[0]));
      command_args = parts.slice(1).join(' ').trim();
      explicit_executor = getExplicitExecutorForCommand(command_type);

      if (!isKnownCommand(command_type)) {
        command_type = 'unknown';
        explicit_executor = null;
      }
    } else {
      command_args = text;
      command_type = '/task';
    }

    const references_last_task =
      normalized.includes('anterior') ||
      normalized.includes('ultima') ||
      normalized.includes('dessa ultima') ||
      normalized.includes('da ultima') ||
      normalized.includes('cade') ||
      normalized.includes('e ai') ||
      normalized.includes('terminou') ||
      normalized.includes('deu certo') ||
      normalized.includes('status') ||
      normalized === 'andamento';

    return {
      command_type,
      command_args,
      normalized_message: normalized,
      explicit_executor,
      references_last_task,
      workspace_command_name: null,
    };
  }

}
