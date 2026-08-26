import { getExplicitExecutorForCommand, isKnownCommand, resolveCommandAlias } from './ChannelCommandCatalog.js';

export interface ParsedCommand {
  command_type: string;
  command_args: string;
  normalized_message: string;
  explicit_executor: string | null;
  references_last_task: boolean;
  /** Initialized null; populated downstream by workspace command resolution. */
  workspace_command_name?: string | null;
}

export function normalizeChannelCommandToken(commandToken: string): string {
  const normalizedToken = commandToken.trim().toLowerCase();
  if (!normalizedToken.startsWith('/')) {
    return normalizedToken;
  }

  const atIndex = normalizedToken.indexOf('@');
  return atIndex >= 0 ? normalizedToken.slice(0, atIndex) : normalizedToken;
}

const SHORT_FOLLOWUP_QUESTION_MAX_LENGTH = 80;

function inferShortFollowUpReference(message: string): boolean {
  return message.length > 0 && message.length <= SHORT_FOLLOWUP_QUESTION_MAX_LENGTH && message.endsWith('?');
}

export class ChannelCommandParser {
  public parse(rawMessage: string): ParsedCommand {
    const text = rawMessage.trim();
    let command_type = 'message';
    let command_args = '';
    let explicit_executor: string | null = null;

    if (text.startsWith('/')) {
      const parts = text.split(' ');
      command_type = resolveCommandAlias(normalizeChannelCommandToken(parts[0]));
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

    return {
      command_type,
      command_args,
      normalized_message: text.toLowerCase(),
      explicit_executor,
      references_last_task: !text.startsWith('/') && inferShortFollowUpReference(text),
      workspace_command_name: null,
    };
  }

}
