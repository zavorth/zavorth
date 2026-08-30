export type SettingsModuleStatus = 'ready' | 'attention' | 'blocked' | 'idle';

export type SettingsModuleId =
  | 'general'
  | 'identity'
  | 'profiles'
  | 'pets'
  | 'permissions'
  | 'memory'
  | 'providers'
  | 'mcp'
  | 'channels'
  | 'workspace'
  | 'voice'
  | 'files'
  | 'approvals'
  | 'agents'
  | 'preview'
  | 'automations'
  | 'sessions'
  | 'doctor'
  | 'updates'
  | 'trust'
  | 'diagnostics';

export type SettingsModule = {
  id: SettingsModuleId;
  label: string;
  group: string;
  description: string;
  keywords: string[];
  status: SettingsModuleStatus;
  statusLabel: string;
  deepLink: string;
};

export type SettingsModuleGroup = {
  title: string;
  items: SettingsModule[];
};

export type SettingsAudience = 'personal' | 'developer' | 'business' | 'power';

export type SettingsModuleInput = {
  runtimeRunning?: boolean;
  providerCount?: number;
  mcpServerCount?: number;
  trustedMcpServerCount?: number;
  automationCount?: number;
  customProfileCount?: number;
  approvalsCount?: number;
  memoryCount?: number;
  channelCount?: number;
  workspacePath?: string | null;
  /** When personal, hide ops jargon (Doctor, Policy Broker, npm-style modules). */
  audience?: SettingsAudience | null;
};

export function isPersonalAudience(audience?: SettingsAudience | null): boolean {
  return !audience || audience === 'personal';
}

const moduleOrder: SettingsModuleId[] = [
  'general',
  'identity',
  'profiles',
  'pets',
  'permissions',
  'memory',
  'providers',
  'mcp',
  'channels',
  'workspace',
  'voice',
  'files',
  'approvals',
  'agents',
  'preview',
  'automations',
  'sessions',
  'doctor',
  'updates',
  'trust',
  'diagnostics',
];

const knownModuleIds = new Set<SettingsModuleId>(moduleOrder);

export function buildSettingsModules(input: SettingsModuleInput = {}): SettingsModuleGroup[] {
  const providerCount = count(input.providerCount);
  const mcpServerCount = count(input.mcpServerCount);
  const trustedMcpServerCount = Math.min(count(input.trustedMcpServerCount), mcpServerCount);
  const automationCount = count(input.automationCount);
  const customProfileCount = count(input.customProfileCount);
  const approvalsCount = count(input.approvalsCount);
  const memoryCount = count(input.memoryCount);
  const channelCount = count(input.channelCount);
  const hasWorkspace = Boolean(input.workspacePath);
  const runtimeRunning = Boolean(input.runtimeRunning);
  const personal = isPersonalAudience(input.audience);

  const groups: SettingsModuleGroup[] = [
    {
      title: personal ? 'You' : 'Personal',
      items: [
        moduleDef('general', 'General', personal ? 'You' : 'Personal', personal ? 'Theme, accent, and simple preferences.' : 'Appearance, reasoning effort, theme, accent and local backup.', ['theme', 'appearance', 'effort', 'backup'], 'ready', 'Configured'),
        moduleDef('identity', personal ? 'Your profile' : 'Identity Studio', personal ? 'You' : 'Personal', personal ? 'How Zavorth talks with you and what it should remember about your preferences.' : 'Agent identity, voice, user profile, rules, memory and session presets.', ['voice', 'user', 'rules', 'identity', 'profile', 'presets', 'session'], 'ready', 'Profile ready'),
        moduleDef('profiles', 'Profiles', personal ? 'You' : 'Personal', personal ? 'Reusable ways of working (optional).' : 'Reusable experience profiles and personas.', ['persona', 'profile', 'custom', 'voice'], customProfileCount > 0 ? 'ready' : 'idle', customProfileCount > 0 ? `${customProfileCount} profile(s)` : 'No custom profiles'),
        moduleDef('pets', 'Pets', personal ? 'You' : 'Personal', 'Mascot scale, event behavior, discreet mode, notifications and reduced motion.', ['mascot', 'pet', 'size', 'animation', 'discreet', 'notifications', 'pixel'], 'ready', 'Customizable'),
        moduleDef('permissions', personal ? 'Safety' : 'Permissions', personal ? 'You' : 'Personal', personal ? 'What needs your OK before anything sensitive happens.' : 'Trust policy, approvals, scopes and revocation.', ['trust', 'approval', 'permission', 'security'], approvalsCount > 0 ? 'attention' : 'ready', approvalsCount > 0 ? `${approvalsCount} pending` : 'No pending items'),
        moduleDef('memory', 'Memory', personal ? 'You' : 'Personal', personal ? 'What Zavorth remembers, drafts waiting for you, and how to forget.' : 'Long-term memory, learned candidates and privacy controls.', ['memory', 'learning', 'recall', 'privacy'], memoryCount > 0 ? 'ready' : 'idle', memoryCount > 0 ? `${memoryCount} memories` : 'No memories'),
      ],
    },
    {
      title: personal ? 'Connections' : 'Integrations',
      items: [
        moduleDef('providers', personal ? 'AI models' : 'AI Providers', personal ? 'Connections' : 'Integrations', personal ? 'Which model answers you, plus a backup if the first one fails.' : 'Models, providers, keys and local fallback.', ['provider', 'model', 'gpt', 'api key', 'llm'], providerCount > 0 ? 'ready' : 'attention', providerCount > 0 ? `${providerCount} active` : 'No provider'),
        ...(personal
          ? []
          : [
              moduleDef('mcp', 'MCP Servers', 'Integrations', 'MCP servers, trust and connected tools.', ['mcp', 'tools', 'server', 'trust'], mcpServerCount === 0 ? 'idle' : trustedMcpServerCount === mcpServerCount ? 'ready' : 'attention', mcpServerCount === 0 ? 'No MCP' : `${trustedMcpServerCount}/${mcpServerCount} trusted`),
            ]),
        moduleDef('channels', 'Channels', personal ? 'Connections' : 'Integrations', personal ? 'Optional apps like Discord or Slack — only if you want them.' : 'External channels, connectors and readiness.', ['slack', 'email', 'channel', 'connector'], channelCount > 0 ? 'ready' : 'idle', channelCount > 0 ? `${channelCount} channel(s)` : 'No channels'),
        moduleDef('voice', 'Voice', personal ? 'Connections' : 'Integrations', personal ? 'How Zavorth hears you and whether it may speak — you choose provider and voice.' : 'STT/TTS preference, dictation, conversation and duplex metrics.', ['voice', 'stt', 'tts', 'speech', 'microphone', 'dictation'], 'ready', 'You choose'),
      ],
    },
    {
      title: 'Workspace',
      items: [
        moduleDef('workspace', personal ? 'Folder' : 'Workspace', 'Workspace', personal ? 'The folder Zavorth can work in on this computer.' : 'Active directory, scope and local runtime.', ['folder', 'directory', 'workspace', 'local'], hasWorkspace ? 'ready' : 'attention', hasWorkspace ? 'Workspace active' : 'Choose a folder'),
        moduleDef('files', personal ? 'Files' : 'File Explorer', 'Workspace', personal ? 'Browse project files safely.' : 'local project files and safe read access.', ['file', 'explorer', 'project'], hasWorkspace ? 'ready' : 'attention', hasWorkspace ? 'Available' : 'No workspace'),
        moduleDef('approvals', 'Review', 'Workspace', personal ? 'Things that need your OK before files or tools change.' : 'Write approvals, host commands and active mandate.', ['review', 'approval', 'diff', 'host command'], approvalsCount > 0 ? 'attention' : 'ready', approvalsCount > 0 ? `${approvalsCount} item(s)` : 'No reviews'),
        ...(personal
          ? []
          : [
              moduleDef('agents', 'Agent Team', 'Workspace', 'Subagents, roles and delegated tasks.', ['subagent', 'agent', 'team', 'delegate'], 'ready', 'Available'),
              moduleDef('preview', 'Web Preview', 'Workspace', 'local web preview for apps and screens.', ['browser', 'preview', 'web'], hasWorkspace ? 'ready' : 'idle', hasWorkspace ? 'Available' : 'No workspace'),
            ]),
      ],
    },
  ];

  if (personal) {
    groups.push({
      title: 'Help',
      items: [
        moduleDef('sessions', 'History', 'Help', 'Recent chats you can reopen.', ['session', 'history', 'thread', 'resume'], 'ready', 'local history'),
        moduleDef('updates', 'Updates', 'Help', 'Get the latest Desktop improvements.', ['update', 'release notes', 'rollback', 'install'], 'ready', 'local channel'),
        moduleDef('trust', 'Privacy & safety', 'Help', 'Keep this computer protected and review sensitive permissions.', ['trust', 'hardening', 'safe mode', 'audit log', 'remote display'], 'ready', 'Protected'),
        // Personal never sees "Runtime Doctor" / Policy Broker labels.
        moduleDef('diagnostics', 'Something wrong...', 'Help', 'Simple checks if chat will not start. No terminal commands required.', ['logs', 'runtime', 'diagnostics', 'error', 'status', 'help'], runtimeRunning ? 'ready' : 'attention', runtimeRunning ? 'Looking good' : 'Needs attention'),
      ],
    });
  } else {
    groups.push({
      title: 'Operations',
      items: [
        moduleDef('automations', 'Scheduled Tasks', 'Operations', 'Durable automations, logs and recurring executions.', ['automation', 'scheduler', 'cron', 'task', 'recurring'], automationCount > 0 ? 'ready' : 'idle', automationCount > 0 ? `${automationCount} task(s)` : 'No automations'),
        moduleDef('sessions', 'Sessions', 'Operations', 'Recent sessions, context switching and resume.', ['session', 'history', 'thread', 'resume'], 'ready', 'local history'),
        moduleDef('doctor', 'Runtime Doctor', 'Operations', 'Node, Git, ripgrep, provider, workspace, permissions, terminal and backend.', ['doctor', 'install', 'node', 'git', 'ripgrep', 'provider', 'workspace', 'terminal', 'backend'], runtimeRunning ? 'ready' : 'attention', runtimeRunning ? 'Doctor ready' : 'Review runtime'),
        moduleDef('updates', 'Update', 'Operations', 'Auto-update, release notes, download later, install now and basic rollback.', ['update', 'release notes', 'rollback', 'install'], 'ready', 'local channel'),
        moduleDef('trust', 'Trust', 'Operations', 'Desktop hardening, remote display detection, sensitive permissions, audit log and safe mode.', ['trust', 'hardening', 'safe mode', 'audit log', 'remote display'], 'ready', 'Protected'),
        moduleDef('diagnostics', 'Diagnostics', 'Operations', 'Logs, runtime, repair, updates and desktop signals.', ['logs', 'runtime', 'diagnostics', 'error', 'status'], runtimeRunning ? 'ready' : 'attention', runtimeRunning ? 'Runtime online' : 'Runtime offline'),
      ],
    });
  }

  return groups;
}

/** True when personal settings hide operator jargon modules. */
export function personalSettingsHidesJargon(groups: SettingsModuleGroup[]): boolean {
  const flat = flattenSettingsModules(groups);
  const hasDoctor = flat.some((module) => module.id === 'doctor' || /doctor|policy broker/i.test(module.label));
  const hasMcp = flat.some((module) => module.id === 'mcp');
  return !hasDoctor && !hasMcp;
}

export function flattenSettingsModules(groups: SettingsModuleGroup[]): SettingsModule[] {
  return groups.flatMap(group => group.items);
}

export function filterSettingsModules(groups: SettingsModuleGroup[], query: string): SettingsModuleGroup[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return groups;
  }

  return groups
    .map(group => {
      const scored = group.items
        .map(item => ({ item, score: scoreModule(item, tokens) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);
      return {
        group: {
          ...group,
          items: scored.map(entry => entry.item),
        },
        score: scored[0]?.score || 0,
      };
    })
    .filter(entry => entry.group.items.length > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.group);
}

export function resolveSettingsDeepLink(value: string | null | undefined): SettingsModuleId | null {
  if (!value) {
    return null;
  }

  const raw = value.trim();
  const direct = moduleFromCandidate(raw);
  if (direct) {
    return direct;
  }

  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const hashMatch = withoutHash.match(/^settings[/:=]([^/?#]+)/i);
  if (hashMatch) {
    return moduleFromCandidate(hashMatch[1]);
  }

  const pathMatch = raw.match(/(?:^|[/:#?&])settings[=/]([^/?#&]+)/i);
  if (pathMatch) {
    return moduleFromCandidate(pathMatch[1]);
  }

  try {
    const url = new URL(raw);
    const setting = url.searchParams.get('settings');
    const fromQuery = moduleFromCandidate(setting);
    if (fromQuery) {
      return fromQuery;
    }
    if (url.hostname.toLowerCase() === 'settings') {
      return moduleFromCandidate(url.pathname.split('/').filter(Boolean)[0]);
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const settingsIndex = segments.findIndex(segment => segment.toLowerCase() === 'settings');
    if (settingsIndex >= 0) {
      return moduleFromCandidate(segments[settingsIndex + 1]);
    }
  } catch {
    // Plain paths are handled above.
  }

  return null;
}

function moduleDef(
  id: SettingsModuleId,
  label: string,
  group: string,
  description: string,
  keywords: string[],
  status: SettingsModuleStatus,
  statusLabel: string,
): SettingsModule {
  return {
    id,
    label,
    group,
    description,
    keywords,
    status,
    statusLabel,
    deepLink: `zavorth://settings/${id}`,
  };
}

function scoreModule(module: SettingsModule, tokens: string[]): number {
  const haystackstack = normalize([
    module.id,
    module.label,
    module.group,
    module.description,
    module.status,
    module.statusLabel,
    ...module.keywords,
  ].join(' '));

  return tokens.reduce((score, token) => {
    if (normalize(module.id) === token || normalize(module.label) === token) {
      return score + 8;
    }
    if (haystackstack.includes(token)) {
      return score + 2;
    }
    return score;
  }, 0);
}

function tokenize(value: string): string[] {
  return normalize(value).split(/\s+/u).filter(Boolean);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function moduleFromCandidate(value: string | null | undefined): SettingsModuleId | null {
  if (!value) {
    return null;
  }
  const normalized = normalize(decodeURIComponent(value)).replace(/^\/+|\/+$/g, '');
  return knownModuleIds.has(normalized as SettingsModuleId) ? normalized as SettingsModuleId : null;
}

function count(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}
