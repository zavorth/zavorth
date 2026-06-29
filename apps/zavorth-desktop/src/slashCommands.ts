export type DesktopPanel = 'chat' | 'approvals' | 'memory' | 'skills' | 'channels' | 'settings' | 'files' | 'preview' | 'automations' | 'agents' | 'profiles' | 'analytics' | 'marketplace';

export type SlashCommandDefinition = {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
};

export type ParsedSlashCommand =
  | { kind: 'none'; text: string }
  | { kind: 'panel'; panel: DesktopPanel }
  | { kind: 'set-effort'; effort: string }
  | { kind: 'set-profile'; profile: string }
  | { kind: 'send'; text: string }
  | { kind: 'stop' }
  | { kind: 'help' };

export const slashCommands: SlashCommandDefinition[] = [
  {
    name: '/stop',
    description: 'Stop or cancel the current run when the runtime supports cancellation.',
    usage: '/stop',
  },
  {
    name: '/model',
    description: 'Open model and provider controls.',
    usage: '/model',
  },
  {
    name: '/effort',
    description: 'Set reasoning effort for the next messages.',
    usage: '/effort low|medium|high|ultra',
  },
  {
    name: '/profile',
    description: 'Set the desktop experience profile.',
    usage: '/profile personal|creator|developer|business|power',
  },
  {
    name: '/steer',
    description: 'Add steering guidance to the current session.',
    usage: '/steer keep this shorter',
  },
  {
    name: '/usage',
    description: 'Open runtime usage and local status.',
    usage: '/usage',
  },
  {
    name: '/go',
    description: 'Run a deeper governed task with explicit synthesis.',
    usage: '/go audit this folder and summarize findings',
  },
  {
    name: '/workflows',
    description: 'Ask Zavorth to plan a broad multi-step workflow with budget awareness.',
    usage: '/workflows research these files and produce a plan',
  },
  {
    name: '/memory',
    description: 'Open learned memory and candidates.',
    usage: '/memory',
  },
  {
    name: '/skills',
    description: 'Open skills and tools.',
    usage: '/skills',
  },
  {
    name: '/channels',
    description: 'Open channel readiness.',
    usage: '/channels',
  },
  {
    name: '/settings',
    description: 'Open local runtime settings.',
    usage: '/settings',
  },
  {
    name: '/files',
    description: 'Open local workspace files explorer.',
    usage: '/files',
  },
  {
    name: '/help',
    description: 'Show available commands.',
    usage: '/help',
  },
];

const panels: Record<string, DesktopPanel> = {
  '/model': 'settings',
  '/usage': 'analytics',
  '/memory': 'memory',
  '/skills': 'skills',
  '/channels': 'channels',
  '/settings': 'settings',
  '/files': 'files',
  '/analytics': 'analytics',
  '/marketplace': 'marketplace',
  '/plugins': 'marketplace',
};

const allowedEfforts = new Set(['low', 'medium', 'high', 'ultra']);
const allowedProfiles = new Set(['personal', 'creator', 'developer', 'business', 'power']);

export function parseSlashCommand(value: string): ParsedSlashCommand {
  const text = value.trim();
  if (!text.startsWith('/')) {
    return { kind: 'none', text: value };
  }

  const [rawName = '', ...rest] = text.split(/\s+/u);
  const name = rawName.toLowerCase();
  const args = rest.join(' ').trim();

  if (name === '/help') {
    return { kind: 'help' };
  }

  if (name === '/stop') {
    return { kind: 'stop' };
  }

  if (name === '/effort') {
    const effort = args.toLowerCase();
    if (allowedEfforts.has(effort)) {
      return { kind: 'set-effort', effort };
    }
    return { kind: 'send', text: 'Set the effort level. Valid options are low, medium, high and ultra.' };
  }

  if (name === '/profile') {
    const profile = args.toLowerCase();
    if (allowedProfiles.has(profile)) {
      return { kind: 'set-profile', profile };
    }
    return { kind: 'send', text: 'Set the profile. Valid options are personal, creator, developer, business and power.' };
  }

  if (name === '/steer') {
    return {
      kind: 'send',
      text: args ? `Steering update for this session: ${args}` : 'Add steering guidance for this session.',
    };
  }

  if (name === '/go') {
    return {
      kind: 'send',
      text: args ? `Run a governed deep task: ${args}` : 'Run a governed deep task and ask me for missing scope.',
    };
  }

  if (name === '/workflows') {
    return {
      kind: 'send',
      text: args
        ? `Plan a governed workflow with budget, worker limits and synthesis: ${args}`
        : 'Plan a governed workflow with budget, worker limits and synthesis.',
    };
  }

  const panel = panels[name];
  if (panel) {
    return { kind: 'panel', panel };
  }

  return { kind: 'send', text: value };
}
