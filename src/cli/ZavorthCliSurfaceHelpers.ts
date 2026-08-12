import * as path from 'path';
import { CLI_COMMAND_HELP_PAGES_PART1 } from './help/ZavorthCliHelpContentPart1.js';
import { CLI_COMMAND_HELP_PAGES_PART2 } from './help/ZavorthCliHelpContentPart2.js';
import { config } from '../config/index.js';
import { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import { padCliVisualText, paintCliTone, stripCliAnsi } from './ZavorthCliVisualTheme.js';
// Required daily commands:
// zavorth setup, zavorth start, zavorth open, zavorth ready, zavorth status
// zavorth chat, zavorth doctor, zavorth providers, zavorth channels
// zavorth skills, zavorth review, zavorth trust
// /zavorthControl
// Open ZavorthControl.
import type { ZavorthCliFlags } from './ZavorthCliContract.js';
import type { ZavorthGatewaySnapshot } from '../services/ZavorthGatewayService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionExecution,
  type LearningPlaneSnapshot,
} from '../services/ZavorthLearningPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import type {
  ZavorthPlatformRegistrySnapshot,
} from '../services/ZavorthPlatformRegistryService.js';

import { CLI_REPL_HISTORY_FILE } from './ZavorthCliReplConfig.js';
import { formatAdditionalCount, formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import {
  ZAVORTH_CLI_BRAND_NAME,
} from './ZavorthCliMascot.js';

import {
  formatZavorthCertificationHelp,
  getZavorthPublicCommandRows,
} from './ZavorthCliCertificationCommands.js';

export type CliHelpSnapshot = {
  surface: 'zavorth-cli';
  topic:
    | 'root'
    | 'home'
    | 'hud'
    | 'hatch'
    | 'quickstart'
    | 'constitution'
    | 'disk'
    | 'branch'
    | 'commit'
    | 'pr'
    | 'review'
    | 'acp'
    | 'start'
    | 'demo'
    | 'connectors'
    | 'onboard'
    | 'go'
    | 'zavorthControl'
    | 'chat'
    | 'run'
    | 'continue'
    | 'status'
    | 'doctor'
    | 'templates'
    | 'missions'
    | 'receipts'
    | 'advanced'
    | 'ops'
    | 'sessions'
    | 'nodes'
    | 'reference';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

export type CliHelpTopic = CliHelpSnapshot['topic'];
export type CliHelpPage = Omit<CliHelpSnapshot, 'surface'>;

export type CliContextSnapshot = {
  surface: 'zavorth-cli';
  userId: string;
  platform: ZavorthCliFlags['platform'];
  chatId: string;
  sessionId: string;
  workspace: string;
  workspaceHint: string | null;
  historyFile: string;
  notes: string[];
};

export type CliChatWelcomeSnapshot = {
  surface: 'zavorth-cli';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

export type CliDomainsSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: Array<{
    id: string;
    label: string;
    initialized: boolean;
    initializedAt: string | null;
    summary?: string;
    metrics?: Record<string, unknown>;
  }>;
};

export type CliStatusSnapshot = {
  generatedAt: string;
  headline: string;
  nextAction: {
    label: string;
    command: string;
    reason: string;
  } | null;
  brief: {
    posture: string;
    headline: string;
  } | null;
  cockpit: {
    status: string;
    headline: string;
    topAlert: string | null;
  } | null;
  gateway: {
    channelsReady: number;
    channelsTotal: number;
    runtimeModesReady: number;
    securityPosture: string;
  } | null;
  domains: {
    total: number;
    initialized: number;
    pending: number;
  } | null;
  platform: {
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
    syncSummary: string | null;
  } | null;
  sessions: {
    total: number;
    historyItems: number;
    pendingPermissions: number;
    sendReady: boolean;
    spawnReady: boolean;
  } | null;
  nodes: {
    total: number;
    paired: number;
    online: number;
    queued: number;
    staleQueued: number;
  } | null;
  transports: {
    status: string;
    healthy: number;
    total: number;
    stale: boolean;
    summary: string | null;
    recommendedAction: string | null;
  } | null;
  llm?: {
    provider: string;
    model: string;
  } | null;
  memoryMetrics?: {
    total: number;
    episodic: number;
    semantic: number;
    procedural: number;
    pressure: string;
  } | null;
  taskOs?: {
    total: number;
    active: number;
    awaitingPermission: number;
  } | null;
};

const CLI_HELP_TOPIC_ALIASES: Record<string, CliHelpTopic> = {
  // English-only help topic aliases (no multi-language synonym packs).
  onboard: 'onboard',
  setup: 'onboard',
  init: 'onboard',
  home: 'home',
  'start-here': 'home',
  hud: 'hud',
  cockpit: 'hud',
  tui: 'hud',
  hatch: 'hatch',
  quickstart: 'quickstart',
  configure: 'quickstart',
  constitution: 'constitution',
  projectconstitution: 'constitution',
  disk: 'disk',
  diskgate: 'disk',
  'disk-gate': 'disk',
  mutationgate: 'disk',
  'mutation-gate': 'disk',
  branch: 'branch',
  commit: 'commit',
  pr: 'pr',
  pullrequest: 'pr',
  'pull-request': 'pr',
  review: 'review',
  codereview: 'review',
  'code-review': 'review',
  acp: 'acp',
  acpx: 'acp',
  'acp-channel': 'acp',
  'acp-adapter': 'acp',
  start: 'start',
  demo: 'demo',
  connectors: 'connectors',
  connector: 'connectors',
  channels: 'connectors',
  channel: 'connectors',
  go: 'go',
  zavorthControl: 'zavorthControl',
  control: 'zavorthControl',
  commandcenter: 'zavorthControl',
  chat: 'chat',
  run: 'run',
  task: 'run',
  continue: 'continue',
  status: 'status',
  doctor: 'doctor',
  templates: 'templates',
  template: 'templates',
  missions: 'missions',
  mission: 'missions',
  receipts: 'receipts',
  receipt: 'receipts',
  advanced: 'advanced',
  avancado: 'advanced',
  capabilities: 'advanced',
  capability: 'advanced',
  supervisor: 'advanced',
  graph: 'advanced',
  ops: 'ops',
  operations: 'ops',
  heal: 'ops',
  selfheal: 'ops',
  release: 'ops',
  releases: 'ops',
  presence: 'ops',
  sessions: 'sessions',
  tasks: 'sessions',
  artifacts: 'sessions',
  workflows: 'sessions',
  workflowqueue: 'sessions',
  history: 'sessions',
  nodes: 'nodes',
  node: 'nodes',
  devices: 'nodes',
  companions: 'nodes',
  reference: 'reference',
  all: 'reference',
  full: 'reference',
};

const CLI_COMMAND_HELP_PAGES: Record<Exclude<CliHelpTopic, 'root'>, CliHelpPage> = {
  ...CLI_COMMAND_HELP_PAGES_PART1,
  ...CLI_COMMAND_HELP_PAGES_PART2,
} as Record<Exclude<CliHelpTopic, 'root'>, CliHelpPage>;

export function resolveCliHelpTopic(target?: string | null): CliHelpTopic {
  const normalized = String(target || '').trim().toLowerCase();
  if (!normalized) {
    return 'root';
  }

  const firstToken = normalized.split(/\s+/u)[0] || '';
  return CLI_HELP_TOPIC_ALIASES[firstToken] || 'root';
}

function applyZavorthPublicBranding(output: string): string {
  if (process.env.ZAVORTH_PUBLIC_CLI !== '1') {
    return output;
  }

  return output
    .replace(/\bZavorth\b/gu, 'Zavorth')
    .replace(/\bzavorth\b/gu, 'zavorth');
}

export function buildCliHelpSnapshot(target?: string | null): CliHelpSnapshot {
  const topic = resolveCliHelpTopic(target);
  if (topic !== 'root') {
    return {
      surface: 'zavorth-cli',
      ...CLI_COMMAND_HELP_PAGES[topic],
    };
  }

  return {
    surface: 'zavorth-cli',
    topic: 'root',
    title: ZAVORTH_CLI_BRAND_NAME,
    summary: 'Four intents: ask · connect · learn · ready. Platform via help advanced.',
    sections: [
      {
        title: 'Four intents',
        entries: [
          { command: 'zavorth ask "…"', summary: 'Talk.' },
          { command: 'zavorth connect …', summary: 'Providers & channels.' },
          { command: 'zavorth learn', summary: 'What was learned / undo.' },
          { command: 'zavorth ready', summary: 'Health / readiness.' },
        ],
      },
      {
        title: 'Start & care',
        entries: [
          { command: 'zavorth setup', summary: 'First-time setup.' },
          { command: 'zavorth start', summary: 'Start runtime.' },
          { command: 'zavorth open', summary: 'Dashboard.' },
          { command: 'zavorth anyone', summary: 'Human product status.' },
          { command: 'zavorth doctor', summary: 'Simple doctor by default.' },
          { command: 'zavorth approve', summary: 'Pending approvals.' },
        ],
      },
      {
        title: 'More',
        entries: [
          { command: 'zavorth help advanced', summary: 'Operator / platform door.' },
          { command: 'zavorth ops …', summary: 'Ops umbrella.' },
          { command: 'zavorth help reference', summary: 'Full reference.' },
        ],
      },
    ],
    notesTitle: 'Next',
    notes: [
      'First time... zavorth setup',
      'Daily... zavorth ask "…" or talk in Telegram',
      'Need mesh/ops... zavorth help advanced',
    ],
  };
}

function formatCliHelpEntry(entry: { command?: string; summary: string }): string {
  if (entry.command && entry.summary) {
    const command = paintCliTone(entry.command, 'brand');
    return `${padCliVisualText(command, 32)} ${entry.summary}`;
  }
  if (entry.command) {
    return entry.command;
  }
  return entry.summary;
}

export function formatCliHelp(target?: string | null): string {
  const publicCommandHelp = formatPublicCommandHelp(target);
  if (publicCommandHelp) {
    return applyZavorthPublicBranding(publicCommandHelp);
  }
  const snapshot = buildCliHelpSnapshot(target);
  if (snapshot.topic === 'root') {
    return applyZavorthPublicBranding(formatPublicRootHelp());
  }
  const panels: CliVisualPanel[] = snapshot.sections.map((section) => ({
    title: section.title,
    lines: section.entries.map((entry) => formatCliHelpEntry(entry)),
    tone: 'info',
  }));

  if (snapshot.notes.length > 0) {
    panels.push({
      title: snapshot.notesTitle || 'Quick tips',
      lines: snapshot.notes.map((note) => `- ${note}`),
      tone: 'muted',
    });
  }

  return applyZavorthPublicBranding(renderCliScreen({
    eyebrow: `Help ${snapshot.topic}`,
    eyebrowTone: 'info',
    title: snapshot.title,
    summary: snapshot.summary,
    panels,
    mode: 'compact',
    showWordmark: false,
  }));
}

function formatPublicCommandHelp(target?: string | null): string | null {
  const topic = String(target || '').trim().toLowerCase().split(/\s+/u)[0] || '';
  const localGuidedPages = new Set(['home', 'hatch', 'quickstart', 'setup', 'onboard', 'onboarding']);
  if (!localGuidedPages.has(topic)) {
    const certificationHelp = formatZavorthCertificationHelp(topic);
    if (certificationHelp) {
      return certificationHelp;
    }
  }
  const pages: Record<string, {
    title: string;
    usage: string;
    description: string;
    options?: string[];
    commands: Array<[string, string]>;
    examples: Array<[string, string]>;
    docs?: string;
  }> = {
    channels: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      options: ['--json           Output JSON when supported'],
      commands: [
        ['add', 'Add or update a channel account.'],
        ['status', 'Show channel readiness and proof state.'],
        ['list', 'List configured and available channels.'],
        ['telegram', 'Configure Telegram ChatOps.'],
        ['discord', 'Configure Discord.'],
        ['slack', 'Configure Slack.'],
        ['email', 'Configure email delivery.'],
      ],
      examples: [
        ['zavorth channels add', 'Open guided channel setup.'],
        ['zavorth channels telegram', 'Configure Telegram token and allowlist.'],
        ['zavorth channels list', 'Show the channel catalog.'],
      ],
      docs: 'zavorth help connectors',
    },
    connector: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      commands: [],
      examples: [],
      docs: 'zavorth help connectors',
    },
    connectors: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      options: ['--json           Output JSON when supported'],
      commands: [
        ['doctor', 'Show missing configuration for public connectors.'],
        ['status', 'Show channel readiness.'],
        ['add', 'Open guided setup.'],
        ['list', 'List supported connectors.'],
      ],
      examples: [
        ['zavorth connectors doctor', 'Diagnose all public connectors.'],
        ['zavorth channels telegram', 'Configure Telegram safely.'],
      ],
      docs: 'zavorth help reference',
    },
    status: {
      title: 'Zavorth status',
      usage: 'zavorth status [options]',
      description: 'Show runtime, provider, channel and approval readiness.',
      options: ['--json           Output JSON when supported', '--strict         Exit non-zero when readiness is not clean'],
      commands: [],
      examples: [
        ['zavorth status', 'Show a short readiness report.'],
        ['zavorth ready --json', 'Print the same readiness projection as JSON.'],
      ],
      docs: 'zavorth doctor',
    },
    ready: {
      title: 'Zavorth status',
      usage: 'zavorth status [options]',
      description: 'Show runtime, provider, channel and approval readiness.',
      options: ['--json           Output JSON when supported', '--strict         Exit non-zero when readiness is not clean'],
      commands: [],
      examples: [
        ['zavorth status', 'Show a short readiness report.'],
        ['zavorth ready --json', 'Print the same readiness projection as JSON.'],
      ],
      docs: 'zavorth doctor',
    },
    doctor: {
      title: 'Zavorth doctor',
      usage: 'zavorth doctor [options] [scope]',
      description: 'Diagnose setup. Simple path by default; specialized scopes and --advanced for operators.',
      options: [
        '--json           Output JSON when supported',
        '--simple         Force the simple product doctor (default for bare doctor)',
        '--advanced       Operator / productization diagnostics',
        '--fix            Apply safe repairs when available',
        '--strict         Exit non-zero on warnings',
      ],
      commands: [
        ['(none)', 'Simple readiness doctor (default).'],
        ['provider', 'Diagnose provider/model configuration.'],
        ['channels', 'Diagnose channel setup.'],
        ['security', 'Run operational security checks.'],
        ['runtime', 'Check runtime resource budget (advanced).'],
        ['activation|retention|sidecars', 'Operator scopes (use only if you need them).'],
      ],
      examples: [
        ['zavorth doctor', 'Simple diagnostic path (default).'],
        ['zavorth ready', 'Same everyday health question.'],
        ['zavorth doctor provider', 'Focus model/provider issues.'],
        ['zavorth doctor --advanced', 'Operator productization diagnostics.'],
        ['zavorth doctor --json', 'Machine-readable diagnostic output.'],
      ],
      docs: 'zavorth ready',
    },
    advanced: {
      title: 'Zavorth advanced',
      usage: 'zavorth help advanced',
      description: 'Operator / platform door. Day-to-day: zavorth help (ask · connect · learn · ready).',
      commands: [
        ['zavorth help', 'Back to the four intents.'],
        ['zavorth connect …', 'Providers + channels (human connect verb).'],
        ['zavorth learn', 'Anyone learning hub.'],
        ['zavorth reach|power|product|proof', 'Short fabric names (not *-fabric).'],
        ['zavorth ops …', 'Umbrella that re-dispatches into launcher.'],
        ['sessions', 'Sessions, history, resumable workflows.'],
        ['nodes', 'Companion devices and node mesh.'],
        ['memory', 'Memory plane and retention.'],
        ['gateway', 'Gateway projections.'],
        ['workspace', 'Workspace manifests and processes.'],
        ['swarm|plugins|sandbox|…', 'Live namespaces (see help reference).'],
      ],
      examples: [
        ['zavorth help', 'Anyone path only.'],
        ['zavorth connect telegram', 'Configure Telegram.'],
        ['zavorth ops gateway status', 'Ops umbrella → gateway.'],
        ['zavorth help reference', 'Full engineering reference.'],
      ],
      docs: 'zavorth help reference',
    },
    ops: {
      title: 'Zavorth ops',
      usage: 'zavorth ops [command]',
      description: 'Runtime, gateway and maintenance operations.',
      commands: [
        ['start', 'Start or resume local runtime.'],
        ['gateway', 'Inspect gateway state.'],
        ['logs', 'Inspect runtime logs when available.'],
        ['release', 'Inspect release/update status.'],
        ['heal', 'Preview self-healing actions.'],
      ],
      examples: [
        ['zavorth ops start', 'Start the local runtime path.'],
        ['zavorth ops gateway status', 'Show gateway status.'],
        ['zavorth ops heal --preview', 'Preview repair actions.'],
      ],
      docs: 'zavorth doctor',
    },
  };
  const page = pages[topic];
  if (!page) return null;
  return formatPublicHelpPage(page);
}

function formatPublicHelpPage(page: {
  title: string;
  usage: string;
  description: string;
  options?: string[];
  commands: Array<[string, string]>;
  examples: Array<[string, string]>;
  docs?: string;
}): string {
  const panels: CliVisualPanel[] = [
    {
      title: page.title,
      tone: 'brand',
      lines: [page.description],
    },
    {
      title: 'Usage',
      tone: 'muted',
      lines: [page.usage],
    },
    {
      title: 'Options',
      tone: 'info',
      lines: ['-h, --help       Display help for command', ...(page.options || [])],
    },
    ...(page.commands.length
      ? [{
          title: 'Commands',
          tone: 'brand' as const,
          lines: page.commands.map(([command, description]) => formatCliHelpEntry({ command, summary: description })),
        }]
      : []),
    {
      title: 'Examples',
      tone: 'success',
      lines: page.examples.flatMap(([command, description]) => [command, `  ${description}`]),
    },
    {
      title: 'Docs',
      tone: 'muted',
      lines: [page.docs || 'zavorth help reference'],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Zavorth CLI',
    title: page.title,
    summary: page.description,
    panels,
    mode: 'compact',
    showWordmark: false,
  });
}

function formatPublicRootHelp(): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Usage',
      tone: 'muted',
      lines: [
        'Usage: zavorth [options] [command]',
        'Commands:',
        'Speak naturally first. Commands below cover the everyday path only.',
      ],
    },
    {
      title: 'Four intents (remember these)',
      tone: 'brand',
      lines: [
        formatCliHelpEntry({ command: 'zavorth ask "…"', summary: 'Talk / ask (also: chat, run→ask).' }),
        formatCliHelpEntry({ command: 'zavorth connect …', summary: 'Attach providers & channels (telegram, whatsapp…).' }),
        formatCliHelpEntry({ command: 'zavorth learn', summary: 'What was learned / undo (same as anyone digest).' }),
        formatCliHelpEntry({ command: 'zavorth ready', summary: 'Is it healthy... (also: status, health).' }),
      ],
    },
    {
      title: 'Start here',
      tone: 'info',
      lines: [
        formatCliHelpEntry({ command: 'zavorth setup', summary: 'First-time setup.' }),
        formatCliHelpEntry({ command: 'zavorth start', summary: 'Start or resume the local runtime.' }),
        formatCliHelpEntry({ command: 'zavorth open', summary: 'Open the visual dashboard.' }),
        formatCliHelpEntry({ command: 'zavorth anyone', summary: 'Human product status (powers, reach, learning).' }),
        formatCliHelpEntry({ command: 'zavorth doctor', summary: 'Diagnose setup (simple by default; --advanced for ops).' }),
        formatCliHelpEntry({ command: 'zavorth approve', summary: 'Review pending sensitive actions.' }),
      ],
    },
    {
      title: 'Learning & reach (short names)',
      tone: 'info',
      lines: [
        formatCliHelpEntry({ command: 'zavorth anyone digest', summary: 'Same as: zavorth learn.' }),
        formatCliHelpEntry({ command: 'zavorth anyone learn-on|learn-off', summary: 'Toggle autonomous learning.' }),
        formatCliHelpEntry({ command: 'zavorth anyone undo <id>', summary: 'Forget a learned item.' }),
        formatCliHelpEntry({ command: 'zavorth reach|where', summary: 'Where can you reach me...' }),
        formatCliHelpEntry({ command: 'zavorth power|product|proof', summary: 'Short product fabric names only.' }),
      ],
    },
    {
      title: 'More (only if you need it)',
      tone: 'muted',
      lines: [
        formatCliHelpEntry({ command: 'zavorth help advanced', summary: 'Operator / platform / ops door.' }),
        formatCliHelpEntry({ command: 'zavorth ops …', summary: 'Re-enter launcher under ops umbrella.' }),
        formatCliHelpEntry({ command: 'zavorth help reference', summary: 'Full engineering reference.' }),
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Zavorth CLI',
    title: 'ZAVORTH',
    summary: 'Four intents: ask · connect · learn · ready. Everything else is advanced.',
    panels,
    mode: 'hero',
    showWordmark: false,
  });
}

export function buildCliChatWelcomeSnapshot(): CliChatWelcomeSnapshot {
  return {
    surface: 'zavorth-cli',
    title: 'Zavorth',
    summary: 'I am ready. Write naturally; I will explain, plan, use tools when useful, and ask before sensitive work.',
    sections: [
      {
        title: 'Try this first',
        entries: [
          { command: 'review this module', summary: 'Inspect the current code and call out what deserves attention.' },
          { command: 'resume what we were doing', summary: 'Continue the active line of work.' },
          { command: 'compare what changed in this folder', summary: 'Summarize recent changes without making you hunt through files.' },
        ],
      },
      {
        title: 'Shortcuts',
        entries: [
          { command: 'status', summary: 'Check whether everything is ready.' },
          { command: 'doctor', summary: 'Find and fix setup problems.' },
          { command: 'history', summary: 'Show recent conversations.' },
          { command: 'new', summary: 'Start a fresh conversation.' },
          { command: 'quit', summary: 'Leave the chat.' },
        ],
      },
    ],
    notesTitle: 'Tip',
    notes: [
      'You do not need to memorize commands. Free text becomes an agent request automatically.',
    ],
  };
}

function clipCliChatText(value: string, maxWidth: number): string {
  const normalized = stripCliAnsi(sanitizeHumanCliText(value)).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxWidth) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxWidth - 3)).trimEnd()}...`;
}

function formatCliChatWorkspaceLabel(): string {
  const workspace = String(config.defaultWorkspace || process.cwd()).trim() || process.cwd();
  const legacyProductName = ['Bas', 'ilisk'].join('');
  const legacyProductPattern = new RegExp(legacyProductName, 'gi');
  const workspaceName = (path.basename(workspace) || workspace).replace(legacyProductPattern, 'workspace');
  const normalizedPath = workspace.replace(/\\/g, '/').replace(legacyProductPattern, 'workspace');
  return `${workspaceName} - ${normalizedPath}`;
}

function resolveCliChatCurrentModel(): string {
  const provider = String(config.llmProvider || 'runtime').trim();
  const normalizedProvider = provider.toLowerCase().replace(/[\s_-]+/g, '');
  const modelCandidatesByProvider: Record<string, Array<string | null | undefined>> = {
    gemini: [config.geminiModel, config.geminiDefaultModel],
    google: [config.geminiModel, config.geminiDefaultModel],
    aistudio: [config.aiStudioModel, config.geminiModel, config.geminiDefaultModel],
    gemma: [config.gemmaModel],
    openai: [config.openaiModel],
    deepseek: [config.deepseekModel],
    minimax: [config.minimaxModel],
    aigateway: [config.AIGatewayModel, config.openaiModel],
    openrouter: [config.openRouterModel],
    opencode: [config.openCodeModel],
    qwen: [config.qwenModel],
  };
  const candidates = modelCandidatesByProvider[normalizedProvider] || [];
  const model = candidates
    .map((candidate) => sanitizeHumanCliText(candidate || '').trim())
    .find(Boolean);
  return model || provider || 'current model';
}

function formatCliChatRuntimeLabel(): string {
  return `${resolveCliChatCurrentModel()} - natural chat`;
}

function formatCliChatCommand(entry: { command?: string; summary: string }): string {
  const command = sanitizeHumanCliText(entry.command || '').trim();
  const summary = sanitizeHumanCliText(entry.summary).trim();
  if (!command) {
    return `${paintCliTone('*', 'brand')} ${summary}`;
  }
  return [
    `${paintCliTone('>', 'brand')} ${paintCliTone(command, 'brand')}`,
    `  ${paintCliTone('->', 'muted')} ${summary}`,
  ].join('\n');
}

function formatCliChatFooter(shortcuts: Array<{ command?: string; summary: string }>): string {
  const shortcutLabels = shortcuts
    .map((entry) => sanitizeHumanCliText(entry.command || '').trim())
    .filter(Boolean);
  const shortcutLine = shortcutLabels.length > 0
    ? shortcutLabels.join(' | ')
    : 'status | doctor | history | quit';
  return [
    paintCliTone('--------------------------------------------------------', 'muted'),
    `${paintCliTone('...', 'muted')} shortcuts: ${shortcutLine}`,
    `${paintCliTone('safe', 'success')}: sensitive actions ask before they run`,
  ].join('\n');
}

export function formatCliChatWelcome(): string {
  const snapshot = buildCliChatWelcomeSnapshot();
  const examples = snapshot.sections[0]?.entries || [];
  const shortcuts = snapshot.sections[1]?.entries || [];
  const note = snapshot.notes[0] || 'Type a request in your own words.';
  const workspaceLabel = formatCliChatWorkspaceLabel();
  const runtimeLabel = formatCliChatRuntimeLabel();

  return [
    paintCliTone('* Runtime connected', 'success'),
    `${paintCliTone('zavorth', 'brand')} ${paintCliTone('agent', 'muted')} - ${paintCliTone(runtimeLabel, 'muted')}`,
    '',
    `${paintCliTone('workspace', 'muted')} ${clipCliChatText(workspaceLabel, 70)}`,
    '',
    `${paintCliTone("Hi, I'm Zavorth.", 'brand')} ${paintCliTone(sanitizeHumanCliText(snapshot.summary), 'muted')}`,
    '',
    `${paintCliTone('suggestions', 'muted')}`,
    examples.map((entry) => formatCliChatCommand(entry)).join('\n\n'),
    `${paintCliTone('tip', 'muted')}  ${sanitizeHumanCliText(note)}`,
    formatCliChatFooter(shortcuts),
  ].filter(Boolean).join('\n\n');
}

export function buildCliContextSnapshot(
  flags: Pick<ZavorthCliFlags, 'userId' | 'platform' | 'chatId' | 'sessionId' | 'workspaceHint'>,
  historyFile: string = CLI_REPL_HISTORY_FILE,
): CliContextSnapshot {
  return {
    surface: 'zavorth-cli',
    userId: flags.userId,
    platform: flags.platform,
    chatId: flags.chatId,
    sessionId: flags.sessionId,
    workspace: flags.workspaceHint || config.defaultWorkspace,
    workspaceHint: flags.workspaceHint,
    historyFile,
    notes: [
      'Native reads run directly through the official terminal.',
      'Free-form requests and short aliases use the same Zavorth runtime.',
    ],
  };
}

export function formatCliContextSnapshot(snapshot: CliContextSnapshot): string {
  return [
    'Zavorth terminal context',
    '',
    'Now',
    `- user: ${snapshot.userId}`,
    `- platform: ${snapshot.platform}`,
    `- chat: ${snapshot.chatId}`,
    `- session: ${snapshot.sessionId}`,
    '',
    'Useful files',
    `- workspace: ${snapshot.workspace}`,
    `- workspace hint: ${snapshot.workspaceHint || 'none; using default workspace'}`,
    `- history: ${snapshot.historyFile}`,
    '',
    'Notes',
    ...snapshot.notes.map((note) => `- ${note}`),
  ].join('\n');
}

export function formatGatewaySnapshot(snapshot: ZavorthGatewaySnapshot): string {
  return [
    'Zavorth gateway',
    sanitizeHumanCliText(snapshot.narrative.headline),
    '',
    'Now',
    `- ready channels: ${snapshot.summary.channelsReady}/${snapshot.summary.channelsTotal}`,
    `- runtime modes: ${snapshot.summary.runtimeModesReady}`,
    `- security: ${snapshot.summary.securityPosture}`,
    '',
    'Capacity',
    `- memory and artifacts: ${snapshot.summary.memoryArtifacts}`,
    `- teams: ${snapshot.summary.teams} | sessions: ${snapshot.summary.sessionTargets}`,
    `- tools: ${snapshot.summary.toolFamilies} families | plugins: ${snapshot.summary.plugins}`,
    '',
    'Mesh',
    `- companions pareados: ${snapshot.summary.nodesPaired}`,
    `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
  ].join('\n');
}

function formatSurfaceSection(title: string, lines: Array<string | null | undefined>): string[] {
  const items = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  return items.length > 0 ? ['', title, ...items] : [];
}

function formatUsagePercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'not reported';
  }
  return `${Math.round(value * 100)}%`;
}

function normalizePlatformActionHint(actionHint: string | null | undefined): string | null {
  const normalized = String(actionHint || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/platform ')) {
    return `zavorth platform ${normalized.slice('/platform '.length)}`.trim();
  }
  if (normalized.startsWith('/integrations ')) {
    return `zavorth plugins ${normalized.slice('/integrations '.length)}`.trim();
  }

  return normalized;
}

type PlatformSnapshotRenderOptions = {
  focusExplicit?: boolean;
};

function formatPlatformOverflow(total: number, shown: number, singular: string, plural: string): string | null {
  const remaining = total - shown;
  return remaining > 0 ? `- ${formatAdditionalCount(remaining, singular, plural)}` : null;
}

function formatPlatformOverviewCollection(
  collection: ZavorthPlatformRegistrySnapshot['collections'][number],
): string {
  return `- ${collection.label}: ${formatCount(collection.itemCount, 'item', 'items')} | ${formatCount(collection.readyCount, 'ready', 'ready')} | ${formatCount(collection.adoptedCount, 'adopted', 'adopted')}`;
}

function formatPlatformOverviewRecipe(
  recipe: ZavorthPlatformRegistrySnapshot['recipes'][number],
): string {
  return `- ${recipe.label}: ${formatCount(recipe.itemCount, 'target', 'targets')} | ${formatCount(recipe.readyCount, 'ready', 'ready')} | ${formatCount(recipe.adoptedCount, 'adopted', 'adopted')}`;
}

function formatPlatformOverviewEntry(
  entry: ZavorthPlatformRegistrySnapshot['entries'][number],
): string {
  return `- ${entry.label} [${entry.kind}] ${entry.readiness}/${entry.installState} | trust ${formatCliValue(entry.trust)}`;
}

export function formatMemoryPlaneSnapshot(
  snapshot: Awaited<ReturnType<ZavorthMemoryPlaneService['buildSnapshot']>>,
): string {
  const recentArtifact = snapshot.artifacts.recent[0];
  const suggested = snapshot.suggestedActions[0];

  return [
    'Zavorth resume and deliveries',
    `- ${sanitizeHumanCliText(snapshot.narrative.headline)}`,
    `- ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    `- persisted memories: ${snapshot.summary.persistedMemories}`,
    `- relevant memories: ${snapshot.summary.relevantMemories}`,
    `- replay tasks: ${snapshot.summary.replayTasks}`,
    `- artifacts: ${snapshot.summary.artifacts}`,
    recentArtifact ? `- recent artifact: ${recentArtifact.label}` : '- recent artifact: none',
    suggested ? `- next step: ${suggested.label} (${suggested.command})` : '- next step: none',
  ].join('\n');
}

export function formatLearningSnapshot(
  snapshot: LearningPlaneSnapshot,
  mode: 'status' | 'candidates' = 'status',
): string {
  const featuredCandidate = snapshot.candidates[0] || null;
  const lines = [
    'Zavorth learning',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- candidates: ${formatCount(snapshot.summary.total, 'total', 'total')} | ${formatCount(snapshot.summary.pending, 'pending', 'pending')} | ${formatCount(snapshot.summary.highConfidence, 'high confidence', 'high confidence')}`,
      `- review: ${formatCount(snapshot.summary.approved, 'approved', 'approved')} | ${formatCount(snapshot.summary.rejected, 'rejected', 'rejected')} | ${snapshot.summary.quarantined} quarantined`,
      `- rollout: ${formatCount(snapshot.summary.promoted, 'promoted', 'promoted')} | ${formatCount(snapshot.summary.published, 'published', 'published')}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (mode === 'candidates' && snapshot.candidates.length > 0) {
    lines.push('', 'Focused candidates');
    for (const candidate of snapshot.candidates.slice(0, 5)) {
      lines.push(
        `- ${candidate.title} [${candidate.kind}]`,
        `  score ${candidate.score.toFixed(2)} | review ${candidate.reviewState} | state ${candidate.lifecycle}`,
      );
      lines.push(`  ${candidate.summary}`);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    mode === 'candidates' && featuredCandidate ? `- zavorth learning approve ${featuredCandidate.id}`
      : '- zavorth learning candidates',
    featuredCandidate ? `- zavorth learning promote ${featuredCandidate.id}` : '- zavorth learning metrics',
  ]));

  return lines.join('\n');
}

export function formatLearningMetricsSnapshot(
  metrics: ReturnType<ZavorthLearningPlaneService['readMetrics']>,
): string {
  return [
    'Learning metrics',
    'Quality and throughput snapshot for the learning plane.',
    ...formatSurfaceSection('Now', [
      `- candidates: ${formatCount(metrics.summary.totalCandidates, 'candidate', 'candidates')}`,
      `- average score: ${metrics.summary.averageScore}`,
      `- queue: ${formatCount(metrics.counts.pending, 'pending', 'pending')} | ${metrics.counts.quarantined} quarantined | ${formatCount(metrics.counts.highConfidence, 'high confidence', 'high confidence')}`,
    ]),
    ...formatSurfaceSection('Quality', [
      `- accepted: ${metrics.summary.acceptedRate}`,
      `- rejected: ${metrics.summary.rejectedRate}`,
      `- promoted: ${metrics.summary.promotedRate}`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth learning candidates',
    ]),
  ].join('\n');
}

export function formatLearningActionExecution(result: LearningPlaneActionExecution): string {
  return [
    'Learning updated',
    result.summary,
    ...formatSurfaceSection('Now', [
      `- candidate: ${result.candidateId}`,
      `- action: ${result.actionId}`,
      `- status: ${result.status}`,
    ]),
    ...formatSurfaceSection('Details', result.details.slice(0, 4).map((detail) => `- ${detail}`)),
    ...formatSurfaceSection('Do now', [
      '- zavorth learning candidates',
      '- zavorth learning metrics',
    ]),
  ].join('\n');
}

export function formatLayeredMemoryStatus(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['buildStatus']>>,
): string {
  return [
    'Zavorth memory',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- entries: ${formatCount(snapshot.summary.total, 'entry', 'entries')}`,
      `- layers: episodic ${snapshot.summary.episodic} | semantic ${snapshot.summary.semantic} | procedural ${snapshot.summary.procedural}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
    ...formatSurfaceSection('Usage', [
      `- budget per layer: ${snapshot.budgets.perLayer}`,
      `- episodic: ${formatUsagePercent(snapshot.budgets.episodicUsage)}`,
      `- semantic: ${formatUsagePercent(snapshot.budgets.semanticUsage)}`,
      `- procedural: ${formatUsagePercent(snapshot.budgets.proceduralUsage)}`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth memory search <topic>',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}

export function formatLayeredMemorySearch(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['search']>>,
): string {
  const lines = [
    'Zavorth memory search',
    `Query: ${snapshot.query}`,
    ...formatSurfaceSection('Now', [
      `- results: ${formatCount(snapshot.total, 'result', 'results')}`,
    ]),
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Results', [
      '- no relevant result found',
    ]));
    lines.push(...formatSurfaceSection('Do now', [
      '- zavorth memory procedures',
    ]));
    return lines.join('\n');
  }

  lines.push('', 'Focused results');
  for (const entry of snapshot.data.slice(0, 6)) {
    lines.push(
      `- ${entry.label} [${entry.memoryLayer}]`,
      `  confidence ${entry.confidence.toFixed(2)} | source ${entry.source}`,
    );
    lines.push(`  ${entry.summary}`);
  }

  lines.push(...formatSurfaceSection('Do now', [
    '- zavorth memory procedures',
  ]));

  return lines.join('\n');
}

export function formatLayeredMemoryProcedures(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['readProcedures']>>,
): string {
  const lines = [
    'Zavorth procedures',
    snapshot.total > 0
      ? `There are ${formatCount(snapshot.total, 'validated procedure', 'validated procedures')} to reuse.`
      : 'There is no validated procedure to reuse yet.',
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Now', [
      '- no validated procedure available',
    ]));
    return lines.join('\n');
  }

  lines.push(...formatSurfaceSection('Now', [
    `- validated procedures: ${formatCount(snapshot.total, 'procedure', 'procedures')}`,
  ]));
  lines.push('', 'Focused procedures');
  for (const procedure of snapshot.data.slice(0, 5)) {
    lines.push(`- ${procedure.label}`);
    lines.push(`  confidence ${procedure.confidence.toFixed(2)} | source ${procedure.source}`);
    lines.push(`  ${procedure.summary}`);
    for (const step of procedure.steps.slice(0, 3)) {
      lines.push(`  -> ${step}`);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    '- zavorth memory search <topic>',
  ]));

  return lines.join('\n');
}

export function formatPlatformSnapshot(
  snapshot: ZavorthPlatformRegistrySnapshot,
  options: PlatformSnapshotRenderOptions = {},
): string {
  const focusExplicit = options.focusExplicit === true;
  const selected = focusExplicit ? snapshot.selected : null;
  const selectedCollection = focusExplicit ? (snapshot.selectedCollection || null) : null;
  const selectedRecipe = focusExplicit ? (snapshot.selectedRecipe || null) : null;
  const highlighted = snapshot.entries.slice(0, 3);
  const collections = Array.isArray(snapshot.collections) ? snapshot.collections.slice(0, 2) : [];
  const recipes = Array.isArray(snapshot.recipes) ? snapshot.recipes.slice(0, 2) : [];

  const lines = [
    'Zavorth platform',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- plugins: ${snapshot.summary.plugins} | skills: ${snapshot.summary.skills} | MCPs: ${snapshot.summary.mcps}`,
      `- collections: ${String(snapshot.summary.collections || 0)} | recipes: ${String(snapshot.summary.recipes || 0)}`,
      `- sync: ${formatCliValue(snapshot.catalogSync?.summary)}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (selectedCollection) {
    lines.push(...formatSurfaceSection('Focused collection', [
      `- ${selectedCollection.label}`,
      `- items: ${formatCount(selectedCollection.itemCount, 'item', 'items')} | ${formatCount(selectedCollection.readyCount, 'ready', 'ready')} | ${formatCount(selectedCollection.adoptedCount, 'adopted', 'adopted')}`,
      `- next step: ${normalizePlatformActionHint(selectedCollection.actionHint) || formatCliValue(selectedCollection.actionHint)}`,
    ]));
    if (selectedCollection.items.length > 0) {
      lines.push('', 'Focused items');
      lines.push(...selectedCollection.items.slice(0, 4).map((item) =>
        `- ${item.label} [${item.kind}] ${item.readiness}/${item.installState}`));
    }
    return lines.join('\n');
  }

  if (selectedRecipe) {
    lines.push(...formatSurfaceSection('Focused recipe', [
      `- ${selectedRecipe.label}`,
      `- targets: ${formatCount(selectedRecipe.itemCount, 'target', 'targets')} | ${formatCount(selectedRecipe.readyCount, 'ready', 'ready')} | ${formatCount(selectedRecipe.adoptedCount, 'adopted', 'adopted')}`,
      `- next step: ${normalizePlatformActionHint(selectedRecipe.actionHint) || formatCliValue(selectedRecipe.actionHint)}`,
    ]));
    if (selectedRecipe.steps.length > 0) {
      lines.push('', 'Focused steps');
      lines.push(...selectedRecipe.steps.slice(0, 3).map((step) => `- ${step}`));
    }
    return lines.join('\n');
  }

  if (selected) {
    lines.push(...formatSurfaceSection('Focused item', [
      `- ${selected.label}`,
      `- type: ${selected.kind}`,
      `- state: ${selected.readiness} | trust: ${formatCliValue(selected.trust)} | install: ${selected.installState}`,
      `- next step: ${normalizePlatformActionHint(selected.actionHint) || formatCliValue(selected.actionHint)}`,
      `- summary: ${sanitizeHumanCliText(selected.summary)}`,
    ]));
    if (selected.details.length > 0) {
      lines.push('', 'Details');
      lines.push(...selected.details.slice(0, 3).map((detail) => `- ${detail}`));
    }
    return lines.join('\n');
  }

  if (collections.length > 0) {
    lines.push('', 'Focused collections');
    for (const collection of collections) {
      lines.push(formatPlatformOverviewCollection(collection));
    }
    const overflow = formatPlatformOverflow(snapshot.collections.length, collections.length, 'other collection in catalog', 'other collections in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (recipes.length > 0) {
    lines.push('', 'Focused recipes');
    for (const recipe of recipes) {
      lines.push(formatPlatformOverviewRecipe(recipe));
    }
    const overflow = formatPlatformOverflow(snapshot.recipes.length, recipes.length, 'other recipe in catalog', 'other recipes in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (highlighted.length > 0) {
    lines.push('', 'Focused items');
    for (const entry of highlighted) {
      lines.push(formatPlatformOverviewEntry(entry));
    }
    const overflow = formatPlatformOverflow(snapshot.entries.length, highlighted.length, 'other item in catalog', 'other items in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    collections[0] ? `- zavorth platform ${collections[0].id}` : '- zavorth plugins list',
  ]));

  return lines.join('\n');
}

export function formatPlatformSyncResult(result: Awaited<ReturnType<ZavorthPlatformCatalogSyncService['sync']>>): string {
  return [
    'Plugin catalog synced',
    sanitizeHumanCliText(result.summary),
    ...formatSurfaceSection('Now', [
      `- status: ${result.status}`,
      `- items: ${formatCount(result.entryCount, 'item', 'items')} | collections: ${formatCount(result.collectionCount, 'collection', 'collections')} | recipes: ${formatCount(result.recipeCount, 'recipe', 'recipes')}`,
      `- cache: ${formatCliValue(result.cacheFile)}`,
      result.error ? `- error: ${result.error}` : null,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth plugins list',
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return [
    'Memory metrics',
    'Pressure and distribution snapshot for layered memory.',
    ...formatSurfaceSection('Now', [
      `- entries: ${formatCount(metrics.summary.totalEntries, 'entry', 'entries')} | episodic ${metrics.summary.episodic} | semantic ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
      `- average budget usage: ${metrics.summary.averageBudgetUsage} | pressure: ${metrics.summary.pressure}`,
      `- procedures: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth memory status',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}
