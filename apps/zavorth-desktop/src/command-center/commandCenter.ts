import type { DesktopPanel } from '../slashCommands';
import type { SettingsModule, SettingsModuleGroup, SettingsModuleId } from '../settings/settingsModules';
import { flattenSettingsModules } from '../settings/settingsModules';
import type { RightRailTab } from '../shell/rightRail';

export type CommandCenterCategory =
  | 'Settings'
  | 'Workspace'
  | 'Providers'
  | 'MCP'
  | 'Automations'
  | 'Sessions'
  | 'Profiles'
  | 'Preview'
  | 'Terminal'
  | 'Git'
  | 'Logs'
  | 'Themes'
  | 'Runtime'
  | 'Recovery'
  | 'Quick Actions'
  | 'Slash Commands';

export type CommandCenterAction =
  | { type: 'settings'; tab: SettingsModuleId }
  | { type: 'panel'; panel: DesktopPanel }
  | { type: 'rail'; tab: RightRailTab }
  | { type: 'insert'; value: string }
  | { type: 'run'; value: string }
  | { type: 'close' };

export type CommandCenterItem = {
  id: string;
  category: CommandCenterCategory;
  title: string;
  subtitle: string;
  keywords: string[];
  statusLabel?: string;
  disabled?: boolean;
  action: CommandCenterAction;
};

export type CommandCenterGroup = {
  category: CommandCenterCategory;
  items: CommandCenterItem[];
};

export type CommandCenterInput = {
  settingsGroups: SettingsModuleGroup[];
  providerCount?: number;
  mcpServerCount?: number;
  automationCount?: number;
  sessionCount?: number;
  customProfileCount?: number;
  runtimeRunning?: boolean;
  kaelActive?: boolean;
  workspaceLabel?: string;
  rightRailOpen?: boolean;
  rightRailTab?: RightRailTab;
};

const categoryOrder: CommandCenterCategory[] = [
  'Settings',
  'Workspace',
  'Providers',
  'MCP',
  'Automations',
  'Sessions',
  'Profiles',
  'Preview',
  'Terminal',
  'Git',
  'Logs',
  'Themes',
  'Runtime',
  'Recovery',
  'Quick Actions',
  'Slash Commands',
];

const preferredSettings: SettingsModuleId[] = [
  'identity',
  'providers',
  'mcp',
  'automations',
  'sessions',
  'pets',
  'memory',
  'permissions',
  'doctor',
  'updates',
  'trust',
  'diagnostics',
];

export function buildCommandCenterItems(input: CommandCenterInput): CommandCenterItem[] {
  const settingsModules = flattenSettingsModules(input.settingsGroups);
  const settingsItems = preferredSettings
    .map(id => settingsModules.find(module => module.id === id))
    .filter((module): module is SettingsModule => Boolean(module))
    .map(module => settingsModuleToCommand(module));

  return [
    ...settingsItems,
    {
      id: 'workspace:files',
      category: 'Workspace',
      title: 'Open workspace files',
      subtitle: input.workspaceLabel ? `Browse ${input.workspaceLabel} in the side rail` : 'Browse the active workspace in the side rail',
      keywords: ['workspace', 'files', 'file', 'explorer', 'project', 'side rail'],
      statusLabel: 'Rail',
      action: { type: 'rail', tab: 'files' },
    },
    {
      id: 'workspace:activity',
      category: 'Workspace',
      title: 'Open workspace activity',
      subtitle: 'See approvals, runtime state, recent messages and shell context',
      keywords: ['workspace', 'atividade', 'activity', 'approvals', 'runtime'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'activity' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'activity' },
    },
    {
      id: 'providers:add',
      category: 'Providers',
      title: input.providerCount ? 'Manage providers' : 'Add provider',
      subtitle: input.providerCount ? `${input.providerCount} provider(s) connected` : 'Connect OpenAI, local or compatible providers',
      keywords: ['provider', 'modelo', 'api key', 'llm', 'openai', 'local'],
      statusLabel: input.providerCount ? 'Ready' : 'Needs setup',
      action: { type: 'settings', tab: 'providers' },
    },
    {
      id: 'mcp:trust',
      category: 'MCP',
      title: input.mcpServerCount ? 'Review MCP trust' : 'Connect MCP server',
      subtitle: input.mcpServerCount ? `${input.mcpServerCount} MCP server(s) detected` : 'Add tools and review server permissions',
      keywords: ['mcp', 'tool', 'trust', 'server', 'permission'],
      statusLabel: input.mcpServerCount ? 'Review' : 'No servers',
      action: { type: 'settings', tab: 'mcp' },
    },
    {
      id: 'automations:create',
      category: 'Automations',
      title: 'Create scheduled task',
      subtitle: input.automationCount ? `${input.automationCount} automation(s) active` : 'Schedule recurring local work',
      keywords: ['automation', 'scheduler', 'cron', 'recurring', 'task'],
      statusLabel: input.automationCount ? 'Active' : 'New',
      action: { type: 'panel', panel: 'automations' },
    },
    {
      id: 'sessions:new',
      category: 'Sessions',
      title: 'New session',
      subtitle: input.sessionCount ? `${input.sessionCount} recent session(s)` : 'Start a clean local conversation',
      keywords: ['session', 'thread', 'chat', 'new'],
      statusLabel: 'Local',
      action: { type: 'panel', panel: 'chat' },
    },
    {
      id: 'profiles:identity',
      category: 'Profiles',
      title: 'Apply Identity Studio to this session',
      subtitle: input.customProfileCount ? `${input.customProfileCount} custom profile(s) available` : 'Use voice, rules and memory presets',
      keywords: ['identity studio', 'perfil', 'persona', 'voz', 'regras'],
      statusLabel: 'Session preset',
      action: { type: 'settings', tab: 'identity' },
    },
    {
      id: 'preview:open-rail',
      category: 'Preview',
      title: 'Open Web Preview',
      subtitle: 'Detect local dev servers, reload, inspect console state and open externally',
      keywords: ['preview', 'web', 'browser', 'dev server', 'localhost', 'live reload'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'preview' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'preview' },
    },
    {
      id: 'terminal:open-rail',
      category: 'Terminal',
      title: 'Open workspace terminal',
      subtitle: 'Persistent terminal session for this workspace with search, copy and trust state',
      keywords: ['terminal', 'shell', 'pty', 'workspace', 'command', 'session'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'terminal' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'terminal' },
    },
    {
      id: 'git:open-rail',
      category: 'Git',
      title: 'Open Git status',
      subtitle: 'Inspect branch, workspace state and quick Git context',
      keywords: ['git', 'status', 'branch', 'diff', 'commit', 'workspace'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'git' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'git' },
    },
    {
      id: 'logs:open',
      category: 'Logs',
      title: 'Open runtime logs',
      subtitle: 'View local runtime events in the side rail',
      keywords: ['logs', 'diagnostico', 'erro', 'runtime', 'console'],
      statusLabel: input.runtimeRunning ? 'Runtime online' : 'Runtime offline',
      action: { type: 'rail', tab: 'logs' },
    },
    {
      id: 'themes:studio',
      category: 'Themes',
      title: 'Open Theme Studio',
      subtitle: 'Adjust premium themes, translucency and profile persistence',
      keywords: ['tema', 'theme', 'appearance', 'premium', 'translucency'],
      statusLabel: 'Settings',
      action: { type: 'settings', tab: 'general' },
    },
    {
      id: 'runtime:start',
      category: 'Runtime',
      title: input.runtimeRunning ? 'Refresh runtime' : 'Start runtime',
      subtitle: input.runtimeRunning ? 'Sync runtime health and capabilities' : 'Start local services and repair readiness',
      keywords: ['runtime', 'start', 'sync', 'health', 'local', 'reparar'],
      statusLabel: input.runtimeRunning ? 'Online' : 'Offline',
      action: { type: 'run', value: '/usage' },
    },
    {
      id: 'recovery:open',
      category: 'Recovery',
      title: 'Open recovery diagnostics',
      subtitle: 'Review fallback state, runtime recovery and repair actions',
      keywords: ['recovery', 'recuperacao', 'diagnostics', 'repair', 'erro', 'fallback'],
      statusLabel: 'Diagnostics',
      action: { type: 'settings', tab: 'diagnostics' },
    },
    {
      id: 'quick:start-runtime',
      category: 'Quick Actions',
      title: input.runtimeRunning ? 'Refresh runtime status' : 'Start runtime',
      subtitle: input.runtimeRunning ? 'Sync desktop readiness' : 'Runtime offline, start local services',
      keywords: ['runtime offline', 'start', 'repair', 'sync', 'local'],
      statusLabel: input.runtimeRunning ? 'Online' : 'Runtime offline',
      action: { type: 'run', value: '/usage' },
    },
    {
      id: 'quick:toggle-kael',
      category: 'Quick Actions',
      title: input.kaelActive ? 'Hide Kael' : 'Show Kael',
      subtitle: 'Toggle the desktop mascot overlay',
      keywords: ['kael', 'mascote', 'pet', 'overlay', 'discreto'],
      statusLabel: input.kaelActive ? 'Visible' : 'Hidden',
      action: { type: 'settings', tab: 'pets' },
    },
  ];
}

export function filterCommandCenterItems(items: CommandCenterItem[], query: string): CommandCenterItem[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return items;
  }

  return items
    .map(item => ({ item, score: scoreItem(item, tokens) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);
}

export function groupCommandCenterItems(items: CommandCenterItem[]): CommandCenterGroup[] {
  return categoryOrder
    .map(category => ({
      category,
      items: items.filter(item => item.category === category),
    }))
    .filter(group => group.items.length > 0);
}

function settingsModuleToCommand(module: SettingsModule): CommandCenterItem {
  return {
    id: `settings:${module.id}`,
    category: 'Settings',
    title: module.label,
    subtitle: module.description,
    keywords: ['settings', 'configuration', module.id, module.group, ...module.keywords],
    statusLabel: module.statusLabel,
    action: { type: 'settings', tab: module.id },
  };
}

function scoreItem(item: CommandCenterItem, tokens: string[]): number {
  const title = normalize(item.title);
  const haystack = normalize([
    item.id,
    item.category,
    item.title,
    item.subtitle,
    item.statusLabel || '',
    ...item.keywords,
  ].join(' '));

  if (tokens.length > 1 && !tokens.every(token => haystack.includes(token))) {
    return 0;
  }

  const baseScore = tokens.reduce((score, token) => {
    if (title === token) {
      return score + 8;
    }
    if (title.includes(token)) {
      return score + 4;
    }
    if (haystack.includes(token)) {
      return score + 2;
    }
    return score;
  }, 0);

  if (tokens.includes('runtime') && tokens.includes('offline') && item.id === 'quick:start-runtime') {
    return baseScore + 20;
  }

  return baseScore;
}

function tokenize(value: string): string[] {
  return normalize(value).split(/\s+/u).filter(Boolean);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
