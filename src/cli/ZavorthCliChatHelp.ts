import { renderCliScreen } from './ZavorthCliVisualSystem.js';

const CLI_CHAT_HELP_ENTRIES = [
  { command: 'status', summary: 'check runtime readiness' },
  { command: 'doctor', summary: 'diagnose setup or provider issues' },
  { command: 'history', summary: 'show recent conversations' },
  { command: '/new', summary: 'start a clean conversation' },
  { command: '/model', summary: 'inspect or switch provider/model' },
  { command: '/consensus', summary: 'multi-model consensus (your models only)' },
  { command: '/skills', summary: 'search skills and abilities' },
  { command: '/usage', summary: 'show lightweight usage and readiness' },
  { command: 'quit', summary: 'leave the terminal session' },
] as const;

export function isCliChatHelpCommand(raw: string): boolean {
  const normalized = String(raw || '').trim().toLowerCase();
  return normalized === '?' || normalized === 'help' || normalized === '/help';
}

export function formatCliChatHelp(): string {
  return renderCliScreen({
    eyebrow: 'Chat',
    title: 'Shortcuts',
    summary: 'You can also type any natural request directly.',
    mode: 'compact',
    panels: [
      {
        title: 'Inside chat',
        tone: 'brand',
        lines: CLI_CHAT_HELP_ENTRIES.map((entry) => `${entry.command.padEnd(9)} ${entry.summary}`),
      },
    ],
  });
}
