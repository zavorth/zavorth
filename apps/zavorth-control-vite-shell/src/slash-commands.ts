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
    key: 'stop',
    name: 'stop',
    description: 'Abort the active run and disconnect the live stream',
    category: 'session',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'compact',
    name: 'compact',
    aliases: ['compress'],
    description: 'Compact the active session transcript through the runtime',
    args: '[reason]',
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
    key: 'profile',
    name: 'profile',
    description: 'Show or switch the experience profile',
    args: '[personal|creator|developer|business|power]',
    category: 'session',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'model',
    name: 'model',
    description: 'Show or set the model route for the next chat turns',
    args: '[auto|provider/model|model]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'models',
    name: 'models',
    description: 'Show the current model route and selection examples',
    args: '[provider]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'effort',
    name: 'effort',
    description: 'Set reasoning effort for the next chat turns',
    args: '[low|normal|deep|ultra]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'think',
    name: 'think',
    aliases: ['thinking', 'reasoning', 't'],
    description: 'Show, enable, disable, or set reasoning depth',
    args: '[off|low|normal|deep|ultra|default]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'fast',
    name: 'fast',
    description: 'Show or switch the chat into the fast runtime engine',
    args: '[on|off|status|default]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'verbose',
    name: 'verbose',
    aliases: ['v'],
    description: 'Show or toggle verbose tool/runtime progress',
    args: '[on|off|full|status]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'trace',
    name: 'trace',
    description: 'Open trace history or show trace counters',
    args: '[open|status]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'status',
    name: 'status',
    description: 'Show session, model, profile, queue, and run status',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'usage',
    name: 'usage',
    description: 'Show local usage, run, and budget summary',
    args: '[summary|full]',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'context',
    name: 'context',
    description: 'Show current session context sent with the next request',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'tools',
    name: 'tools',
    aliases: ['toolsets'],
    description: 'List available and selected dashboard tools',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'skills',
    name: 'skills',
    aliases: ['skill'],
    description: 'Open or list available skills for the next request',
    args: '[open]',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'agents',
    name: 'agents',
    aliases: ['tasks', 'subagents'],
    description: 'Show active runs, workers, and workflow jobs',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'approvals',
    name: 'approvals',
    aliases: ['approve', 'deny', 'reject'],
    description: 'Show pending approvals or decide with /approve · /approve 1 (prefer card buttons)',
    args: '[approve|deny|reject] [1|2|…] [permission|task|agent-run]',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'whoami',
    name: 'whoami',
    description: 'Show local dashboard identity and active profile',
    category: 'tools',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'go',
    name: 'go',
    description: 'Prepare a focused mission plan before execution',
    args: '[objective]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'workflows',
    name: 'workflows',
    aliases: ['workflow'],
    description: 'Prepare a governed multi-step workflow draft',
    args: '[objective]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'plan-review',
    name: 'grill-me',
    aliases: ['grill', 'plan-review', 'review-plan'],
    description: 'Review a plan one question at a time before acting',
    args: '[plan or decision]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'brief-reply',
    name: 'brief',
    aliases: ['short', 'concise', 'caveman', 'brief-reply'],
    description: 'Switch a draft into compact channel-ready language',
    args: '[surface or draft]',
    category: 'runtime',
    executeLocal: true,
    queueWhenBusy: false,
  },
  {
    key: 'test-loop',
    name: 'tdd',
    aliases: ['test-loop', 'tests', 'red-green'],
    description: 'Prepare a governed test-first implementation loop',
    args: '[implementation request]',
    category: 'runtime',
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
  const match = trimmed.match(/^\/([a-z0-9][a-z0-9_-]*)(?::|\s+)...([\s\S]*)$/i);
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
  return SLASH_COMMANDS.filter((command) => {
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
      const aliases = command.aliases?.length ? ` aliases: ${command.aliases.map((alias) => `/${alias}`).join(', ')}`
        : '';
      const args = command.args ? ` ${command.args}` : '';
      return `\`/${command.name}${args}\` - ${command.description}${aliases}`;
    }),
  ].join('\n');
}
