import type { DesktopPanel } from '../slashCommands';
import type { SettingsModule, SettingsModuleGroup, SettingsModuleId } from '../settings/settingsModules';
import { flattenSettingsModules } from '../settings/settingsModules';
import type { RightRailTab } from '../shell/rightRail';
import { slashCommands } from '../slashCommands';

/** User-facing command center groups aligned with product IA. */
export type CommandCenterCategory =
  | 'Daily'
  | 'Trust'
  | 'Reach'
  | 'Power'
  | 'Workspace'
  | 'Settings'
  | 'Slash Commands';

export type CommandCenterAction =
  | { type: 'settings'; tab: SettingsModuleId }
  | { type: 'panel'; panel: DesktopPanel }
  | { type: 'rail'; tab: RightRailTab }
  | { type: 'constellation' }
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
  tools?: Array<{ id?: string; name?: string; label?: string }>;
  channels?: Array<{ id?: string; name?: string; label?: string; status?: string }>;
  agents?: Array<{ id?: string; name?: string; role?: string; status?: string }>;
  approvalsPending?: number;
  receiptsCount?: number;
};

/** Product IA order used by the Command Center overlay and grouping. */
export const COMMAND_CENTER_CATEGORY_ORDER: CommandCenterCategory[] = [
  'Daily',
  'Trust',
  'Reach',
  'Power',
  'Workspace',
  'Settings',
  'Slash Commands',
];

const categoryOrder = COMMAND_CENTER_CATEGORY_ORDER;

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

type PanelCommandDef = {
  panel: DesktopPanel;
  category: CommandCenterCategory;
  title: string;
  subtitle: string;
  keywords: string[];
  statusLabel?: string;
};

const panelCommands: PanelCommandDef[] = [
  {
    panel: 'chat',
    category: 'Daily',
    title: 'Open chat',
    subtitle: 'Start or continue a local conversation',
    keywords: ['chat', 'session', 'thread', 'conversation', 'daily'],
  },
  {
    panel: 'approvals',
    category: 'Trust',
    title: 'Open Review',
    subtitle: 'Approve pending actions before they run',
    keywords: ['approvals', 'review', 'trust', 'pending', 'permission'],
    statusLabel: 'Review',
  },
  {
    panel: 'receipts',
    category: 'Trust',
    title: 'Open Proof',
    subtitle: 'Inspect receipts of what actually ran',
    keywords: ['receipts', 'proof', 'audit', 'ledger', 'trust', 'history'],
    statusLabel: 'Proof',
  },
  {
    panel: 'files',
    category: 'Workspace',
    title: 'Open files',
    subtitle: 'Browse workspace files and attach references',
    keywords: ['files', 'explorer', 'folder', 'workspace', 'project'],
  },
  {
    panel: 'workboard',
    category: 'Workspace',
    title: 'Open workboard',
    subtitle: 'Track missions, steps, and delivery state',
    keywords: ['workboard', 'missions', 'tasks', 'board', 'workspace'],
  },
  {
    panel: 'memory',
    category: 'Workspace',
    title: 'Open memory',
    subtitle: 'Absorb durable context and review learned candidates',
    keywords: ['memory', 'absorb', 'learn', 'candidates', 'context'],
  },
  {
    panel: 'skills',
    category: 'Power',
    title: 'Open skills',
    subtitle: 'Browse local skills and tools ready to use',
    keywords: ['skills', 'tools', 'plugins', 'capabilities', 'power'],
  },
  {
    panel: 'marketplace',
    category: 'Power',
    title: 'Open marketplace',
    subtitle: 'Discover and install skills for this workspace',
    keywords: ['marketplace', 'store', 'plugins', 'install', 'skills', 'absorb'],
  },
  {
    panel: 'channels',
    category: 'Reach',
    title: 'Open channels',
    subtitle: 'Check channel readiness and connect surfaces',
    keywords: ['channels', 'reach', 'telegram', 'discord', 'readiness', 'surface'],
  },
  {
    panel: 'agents',
    category: 'Reach',
    title: 'Open agents',
    subtitle: 'Coordinate subagents and multi-agent work',
    keywords: ['agents', 'subagents', 'reach', 'team', 'delegate'],
  },
  {
    panel: 'profiles',
    category: 'Settings',
    title: 'Open profiles',
    subtitle: 'Switch experience profiles and identity presets',
    keywords: ['profiles', 'identity', 'persona', 'preset', 'experience'],
  },
  {
    panel: 'automations',
    category: 'Power',
    title: 'Open automations',
    subtitle: 'Schedule recurring local work with clear receipts',
    keywords: ['automations', 'scheduler', 'cron', 'recurring', 'tasks'],
  },
  {
    panel: 'analytics',
    category: 'Power',
    title: 'Open analytics',
    subtitle: 'Usage, readiness, and local runtime signals',
    keywords: ['analytics', 'usage', 'readiness', 'metrics', 'runtime'],
  },
  {
    panel: 'settings',
    category: 'Settings',
    title: 'Open settings',
    subtitle: 'Runtime, trust, providers, and desktop preferences',
    keywords: ['settings', 'configuration', 'preferences', 'runtime'],
  },
];

export function buildCommandCenterItems(input: CommandCenterInput): CommandCenterItem[] {
  const settingsModules = flattenSettingsModules(input.settingsGroups);
  const settingsItems = preferredSettings
    .map(id => settingsModules.find(module => module.id === id))
    .filter((module): module is SettingsModule => Boolean(module))
    .map(module => settingsModuleToCommand(module));

  const panelItems = panelCommands.map(def => ({
    id: `panel:${def.panel}`,
    category: def.category,
    title: def.title,
    subtitle: def.subtitle,
    keywords: def.keywords,
    statusLabel: def.statusLabel,
    action: { type: 'panel' as const, panel: def.panel },
  }));

  const slashItems = slashCommands.map(command => ({
    id: `slash:${command.name}`,
    category: 'Slash Commands' as const,
    title: command.name,
    subtitle: command.description,
    keywords: [command.name, command.usage, ...(command.aliases || [])],
    statusLabel: 'Slash',
    action: { type: 'insert' as const, value: command.usage },
  }));

  return [
    ...panelItems,
    ...settingsItems,
    {
      id: 'constellation:open',
      category: 'Power',
      title: 'Open constellation',
      subtitle: 'Visual map of skills, channels, agents, trust, and power',
      keywords: ['constellation', 'map', 'domains', 'skills', 'channels', 'agents', 'visual', 'graph'],
      statusLabel: 'Map',
      action: { type: 'constellation' },
    },
    {
      id: 'workspace:files',
      category: 'Workspace',
      title: 'Open workspace files rail',
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
      keywords: ['workspace', 'atividade', 'activity', 'approvals', 'runtime', 'readiness'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'activity' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'activity' },
    },
    {
      id: 'providers:add',
      category: 'Power',
      title: input.providerCount ? 'Manage providers' : 'Add provider',
      subtitle: input.providerCount ? `${input.providerCount} provider(s) connected` : 'Connect OpenAI, local or compatible providers',
      keywords: ['provider', 'modelo', 'api key', 'llm', 'openai', 'local'],
      statusLabel: input.providerCount ? 'Ready' : 'Needs setup',
      action: { type: 'settings', tab: 'providers' },
    },
    {
      id: 'mcp:trust',
      category: 'Trust',
      title: input.mcpServerCount ? 'Review MCP trust' : 'Connect MCP server',
      subtitle: input.mcpServerCount ? `${input.mcpServerCount} MCP server(s) detected` : 'Add tools and review server permissions',
      keywords: ['mcp', 'tool', 'trust', 'server', 'permission', 'readiness'],
      statusLabel: input.mcpServerCount ? 'Review' : 'No servers',
      action: { type: 'settings', tab: 'mcp' },
    },
    {
      id: 'automations:create',
      category: 'Power',
      title: 'Create scheduled task',
      subtitle: input.automationCount ? `${input.automationCount} automation(s) active` : 'Schedule recurring local work with clear receipts',
      keywords: ['automation', 'scheduler', 'cron', 'recurring', 'task', 'receipts'],
      statusLabel: input.automationCount ? 'Active' : 'New',
      action: { type: 'panel', panel: 'automations' },
    },
    {
      id: 'sessions:new',
      category: 'Daily',
      title: 'New session',
      subtitle: input.sessionCount ? `${input.sessionCount} recent session(s)` : 'Start a clean local conversation',
      keywords: ['session', 'thread', 'chat', 'new', 'daily'],
      statusLabel: 'Local',
      action: { type: 'panel', panel: 'chat' },
    },
    {
      id: 'profiles:identity',
      category: 'Settings',
      title: 'Apply Identity Studio to this session',
      subtitle: input.customProfileCount ? `${input.customProfileCount} custom profile(s) available` : 'Use voice, rules and memory presets',
      keywords: ['identity studio', 'perfil', 'persona', 'voz', 'regras', 'absorb'],
      statusLabel: 'Session preset',
      action: { type: 'settings', tab: 'identity' },
    },
    {
      id: 'preview:open-rail',
      category: 'Workspace',
      title: 'Open Web Preview',
      subtitle: 'Detect local dev servers, reload, inspect console state and open externally',
      keywords: ['preview', 'web', 'browser', 'dev server', 'localhost', 'live reload'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'preview' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'preview' },
    },
    {
      id: 'terminal:open-rail',
      category: 'Workspace',
      title: 'Open workspace terminal',
      subtitle: 'Persistent terminal session for this workspace with search, copy and trust state',
      keywords: ['terminal', 'shell', 'pty', 'workspace', 'command', 'session'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'terminal' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'terminal' },
    },
    {
      id: 'git:open-rail',
      category: 'Workspace',
      title: 'Open Git status',
      subtitle: 'Inspect branch, workspace state and quick Git context',
      keywords: ['git', 'status', 'branch', 'diff', 'commit', 'workspace'],
      statusLabel: input.rightRailOpen && input.rightRailTab === 'git' ? 'Open' : 'Rail',
      action: { type: 'rail', tab: 'git' },
    },
    {
      id: 'logs:open',
      category: 'Power',
      title: 'Open runtime logs',
      subtitle: 'View local runtime events and readiness signals in the side rail',
      keywords: ['logs', 'diagnostico', 'erro', 'runtime', 'console', 'readiness'],
      statusLabel: input.runtimeRunning ? 'Runtime online' : 'Runtime offline',
      action: { type: 'rail', tab: 'logs' },
    },
    {
      id: 'themes:studio',
      category: 'Settings',
      title: 'Open Theme Studio',
      subtitle: 'Adjust premium themes, translucency and profile persistence',
      keywords: ['tema', 'theme', 'appearance', 'premium', 'translucency'],
      statusLabel: 'Settings',
      action: { type: 'settings', tab: 'general' },
    },
    {
      id: 'runtime:start',
      category: 'Power',
      title: input.runtimeRunning ? 'Refresh runtime' : 'Start runtime',
      subtitle: input.runtimeRunning ? 'Sync runtime health, readiness and capabilities' : 'Start local services and repair readiness',
      keywords: ['runtime', 'start', 'sync', 'health', 'local', 'reparar', 'readiness'],
      statusLabel: input.runtimeRunning ? 'Online' : 'Offline',
      action: { type: 'run', value: '/usage' },
    },
    {
      id: 'recovery:open',
      category: 'Trust',
      title: 'Open recovery diagnostics',
      subtitle: 'Review fallback state, runtime recovery and repair actions',
      keywords: ['recovery', 'recuperacao', 'diagnostics', 'repair', 'erro', 'fallback', 'trust'],
      statusLabel: 'Diagnostics',
      action: { type: 'settings', tab: 'diagnostics' },
    },
    {
      id: 'quick:start-runtime',
      category: 'Daily',
      title: input.runtimeRunning ? 'Refresh runtime status' : 'Start runtime',
      subtitle: input.runtimeRunning ? 'Sync desktop readiness' : 'Runtime offline, start local services',
      keywords: ['runtime offline', 'start', 'repair', 'sync', 'local', 'readiness'],
      statusLabel: input.runtimeRunning ? 'Online' : 'Runtime offline',
      action: { type: 'run', value: '/usage' },
    },
    {
      id: 'quick:toggle-kael',
      category: 'Daily',
      title: input.kaelActive ? 'Hide Kael' : 'Show Kael',
      subtitle: 'Toggle the desktop mascot overlay',
      keywords: ['kael', 'mascote', 'pet', 'overlay', 'discreto'],
      statusLabel: input.kaelActive ? 'Visible' : 'Hidden',
      action: { type: 'settings', tab: 'pets' },
    },
    ...slashItems,
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
