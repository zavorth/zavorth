export type SlashCommandCategory = 'session' | 'tools' | 'runtime' | 'side-channel' | 'git';

export type SlashCommandDefinition = {
  key: string;
  name: string;
  aliases?: string[];
  description: string;
  args?: string;
  category: SlashCommandCategory;
  executeLocal: boolean;
  queueWhenBusy?: boolean;
  sideChannel?: boolean;
};

export type ParsedSlashCommand = {
  raw: string;
  name: string;
  args: string;
  command: SlashCommandDefinition;
};

export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    key: 'help',
    name: 'help',
    aliases: ['commands'],
    description: 'Show available dashboard commands',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'clear',
    name: 'clear',
    description: 'Clear the visible conversation after the current run',
    category: 'session',
    executeLocal: true,
    queueWhenBusy: true,
  },
  {
    key: 'new',
    name: 'new',
    aliases: ['reset'],
    description: 'Start a clean local dashboard session',
    category: 'session',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'focus',
    name: 'focus',
    description: 'Toggle focus mode',
    args: '[on|off]',
    category: 'session',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'export',
    name: 'export',
    aliases: ['export-session'],
    description: 'Export this conversation',
    args: '[md|json|txt]',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'btw',
    name: 'btw',
    description: 'Ask a detached aside without adding to the main transcript',
    args: '<message>',
    category: 'side-channel',
    executeLocal: true,
    queueWhenBusy: false,
    sideChannel: true,
  },
  {
    key: 'side',
    name: 'side',
    description: 'Run a detached side-channel message',
    args: '<message>',
    category: 'side-channel',
    executeLocal: true,
    queueWhenBusy: false,
    sideChannel: true,
  },
  {
    key: 'steer',
    name: 'steer',
    description: 'Inject a queued or typed message into the active run',
    args: '[queue-id] <message>',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'queue',
    name: 'queue',
    description: 'Show, clear, flush, cancel, replace, or tune the prompt queue',
    args: '[show|clear|flush|cancel <id>|replace <id> <message>|backoff <id> <ms>|attempts <id> <count>]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'branch',
    name: 'branch',
    description: 'Preview or create a git branch through the governed Git workflow',
    args: '<name> [--apply --approval-id <id>]',
    category: 'git',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'commit',
    name: 'commit',
    description: 'Preview or create a git commit through the governed Git workflow',
    args: '-m <message> [--apply --approval-id <id>]',
    category: 'git',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'pr',
    name: 'pr',
    aliases: ['pull-request'],
    description: 'Preview or create a GitHub pull request through gh',
    args: '--title <title> [--base main] [--apply --approval-id <id>]',
    category: 'git',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'review',
    name: 'review',
    aliases: ['code-review'],
    description: 'Run governed Agent Review for workspace diff or PR',
    args: '[--security|--pr <id> --repo owner/repo]',
    category: 'git',
    executeLocal: true,
    queueWhenBusy: false,
  },
];

const COMMANDS_BY_NAME = new Map<string, SlashCommandDefinition>();

for (const command of SLASH_COMMANDS) {
  COMMANDS_BY_NAME.set(command.name, command);
  COMMANDS_BY_NAME.set(command.key, command);
  for (const alias of command.aliases || []) {
    COMMANDS_BY_NAME.set(alias, command);
  }
}

export function normalizeSlashIdentifier(value: string) {
  return String(value || '')
    .trim()
    .replace(/^\//, '')
    .toLowerCase()
    .replace(/_/g, '-');
}

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^\/([a-z0-9][a-z0-9_-]*)(?::|\s+)?([\s\S]*)$/i);
  if (!match) return null;
  const name = normalizeSlashIdentifier(match[1]);
  const command = COMMANDS_BY_NAME.get(name);
  if (!command) return null;
  return {
    raw: trimmed,
    name,
    args: String(match[2] || '').trim(),
    command,
  };
}

export function shouldQueueLocalSlashCommand(command: SlashCommandDefinition) {
  return Boolean(command.executeLocal && command.queueWhenBusy);
}

export function getSlashCommandSuggestions(query: string, limit = 8) {
  const normalized = normalizeSlashIdentifier(query);
  const haystack = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const seen = new Set<string>();
  return SLASH_COMMANDS
    .filter((command) => {
      const names = [command.name, command.key, ...(command.aliases || [])].map(normalizeSlashIdentifier);
      return names.some((name) => name.startsWith(haystack));
    })
    .filter((command) => {
      if (seen.has(command.key)) return false;
      seen.add(command.key);
      return true;
    })
    .slice(0, Math.max(1, limit));
}

export function renderSlashCommandHelp(commands: SlashCommandDefinition[] = SLASH_COMMANDS) {
  return [
    'Available dashboard commands:',
    '',
    ...commands.map((command) => {
      const aliases = command.aliases?.length ? ` aliases: ${command.aliases.map((alias) => `/${alias}`).join(', ')}` : '';
      const args = command.args ? ` ${command.args}` : '';
      return `\`/${command.name}${args}\` - ${command.description}${aliases}`;
    }),
  ].join('\n');
}
