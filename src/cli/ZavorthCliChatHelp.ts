import { paintCliTone } from './ZavorthCliVisualTheme.js';

const CLI_CHAT_HELP_ENTRIES = [
  { command: 'status', summary: 'ver se esta tudo certo' },
  { command: 'doctor', summary: 'corrigir algo que travou' },
  { command: 'history', summary: 'ver conversas recentes' },
  { command: 'new', summary: 'comecar conversa nova' },
  { command: 'quit', summary: 'sair' },
] as const;

export function isCliChatHelpCommand(raw: string): boolean {
  const normalized = String(raw || '').trim().toLowerCase();
  return normalized === '?' || normalized === 'help' || normalized === '/help';
}

export function formatCliChatHelp(): string {
  return [
    `${paintCliTone('?', 'info')} ${paintCliTone('Atalhos do chat', 'info')}`,
    '',
    ...CLI_CHAT_HELP_ENTRIES.map((entry) =>
      `${paintCliTone(entry.command.padEnd(8, ' '), 'brand')} ${entry.summary}`),
    '',
    `${paintCliTone('Dica:', 'muted')} voce tambem pode escrever qualquer pedido em texto livre.`,
  ].join('\n');
}
