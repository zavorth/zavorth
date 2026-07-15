/**
 * CLI Natural Convention — same UX rules as shared-surface slash commands.
 *
 *   zavorth <command>                      → home/status
 *   zavorth <command> <plain language>     → primary action
 *   zavorth <command> status|list|help …   → explicit control
 *   zavorth <command> … --flag             → power-user optional
 *
 * Reuses NaturalSlashConvention policies so CLI and chat stay aligned.
 */

import {
  naturalizeSharedSurfaceArgs,
  NATURAL_SLASH_POLICIES,
  formatNaturalSlashConventionHelp,
  registerNaturalSlashPolicy,
  type NaturalSlashPolicy,
} from '../domain/surface/presentation/shared-surface/NaturalSlashConvention.js';

/** Explicit CLI name → slash type (when names differ or need aliases). */
const CLI_TO_SLASH: Record<string, string> = {
  consensus: '/consensus',
  deliberate: '/consensus',
  moa: '/consensus',
  'multi-model': '/consensus',
  learn: '/learn',
  'learning-loop': '/learn',
  learningloop: '/learn',
  'learn-skill': '/learn-skill',
  learnskill: '/learn-skill',
  'skill-learn': '/learn-skill',
  model: '/model',
  'session-model': '/model',
  roles: '/model',
  'llm-roles': '/model',
  strong: '/strong',
  session: '/sessions',
  sessions: '/sessions',
  sessionhistory: '/sessionhistory',
  sessionsend: '/sessionsend',
  sessionspawn: '/sessionspawn',
  memory: '/memory',
  memoryplane: '/memoryplane',
  skills: '/skills',
  skill: '/skills',
  hub: '/hub',
  plugins: '/plugins',
  plugin: '/plugins',
  tools: '/tools',
  tool: '/tools',
  channels: '/channels',
  channel: '/channels',
  transports: '/transports',
  transport: '/transports',
  gateway: '/gateway',
  runtime: '/runtime',
  hooks: '/hooks',
  hook: '/hooks',
  workflow: '/workflow',
  workflows: '/workflow',
  tenants: '/tenants',
  tenant: '/tenants',
  teams: '/teams',
  team: '/teams',
  capabilities: '/capabilities',
  capability: '/capabilities',
  enable: '/enable',
  disable: '/disable',
  workspace: '/workspace',
  watchmode: '/watchmode',
  codexremote: '/codexremote',
  codex: '/codexremote',
  agents: '/agents',
  agent: '/agents',
  learning: '/learning',
  schedule: '/schedule',
  schedules: '/schedules',
  unschedule: '/unschedule',
  report: '/report',
  automations: '/automations',
  automation: '/automations',
  nodes: '/nodes',
  node: '/nodes',
  nodepair: '/nodepair',
  nodeinvoke: '/nodeinvoke',
  platform: '/platform',
  integrations: '/integrations',
  connect: '/connect',
  access: '/access',
  trust: '/trust',
  bootstrap: '/bootstrap',
  evals: '/evals',
  qa: '/qa',
  governance: '/governance',
  ecosystem: '/ecosystem',
  fleet: '/fleet',
  stability: '/stability',
  aigateway: '/AIGateway',
  AIGateway: '/AIGateway',
  agmobile: '/agmobile',
  computer: '/computer',
  device: '/device',
  vision: '/vision',
  invoke: '/invoke',
  mode: '/mode',
  status: '/status',
  doctor: '/doctor',
  help: '/help',
  commands: '/commands',
  task: '/task',
  plan: '/plan',
  auto: '/auto',
  dryrun: '/dryrun',
};

/**
 * Map a CLI command token to a shared-surface slash type, or null if
 * this command is outside the natural surface set (use default passthrough).
 */
export function mapCliCommandToSlash(command: string | null | undefined): string | null {
  const raw = String(command || '').trim();
  if (!raw) return null;
  const bare = raw.replace(/^\/+/, '');
  const lower = bare.toLowerCase();

  if (CLI_TO_SLASH[bare]) return CLI_TO_SLASH[bare];
  if (CLI_TO_SLASH[lower]) return CLI_TO_SLASH[lower];

  // Auto-map if a slash policy exists for /command
  const slash = `/${lower}`;
  if (NATURAL_SLASH_POLICIES[slash] || NATURAL_SLASH_POLICIES[`/${bare}`]) {
    return NATURAL_SLASH_POLICIES[`/${bare}`] ? `/${bare}` : slash;
  }

  return null;
}

export function isNaturalCliCommand(command: string | null | undefined): boolean {
  return mapCliCommandToSlash(command) !== null;
}

/**
 * Partition argv rest into positionals vs flags (keeps --flag value pairs).
 */
export function partitionCliTokens(tokens: string[]): {
  positionals: string[];
  flags: string[];
} {
  const positionals: string[] = [];
  const flags: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      flags.push(t);
      if (!t.includes('=') && tokens[i + 1] && !tokens[i + 1].startsWith('-') && !isBooleanFlag(t)) {
        flags.push(tokens[i + 1]);
        i += 1;
      }
      continue;
    }
    positionals.push(t);
  }
  return { positionals, flags };
}

function isBooleanFlag(token: string): boolean {
  const t = token.toLowerCase();
  return (
    t === '--json' ||
    t === '--yes' ||
    t === '-y' ||
    t === '--help' ||
    t === '-h' ||
    t === '--debug' ||
    t === '--verbose' ||
    t === '--no-redact' ||
    t === '--enabled' ||
    t === '--disabled' ||
    t === '--fallback' ||
    t === '--plain' ||
    t === '--apply' ||
    t === '--consent' ||
    t === '--dry-run' ||
    t === '--plan'
  );
}

/**
 * Naturalize full CLI argv: [command, ...rest]
 */
export function naturalizeCliArgv(argv: string[]): {
  argv: string[];
  rewritten: boolean;
  reason: string;
  slashType: string | null;
} {
  if (!argv.length) {
    return { argv: [], rewritten: false, reason: 'empty', slashType: null };
  }

  const command = String(argv[0] || '').trim();
  // Preserve global flags as first token
  if (command.startsWith('-')) {
    return { argv: [...argv], rewritten: false, reason: 'global-flag', slashType: null };
  }

  const slashType = mapCliCommandToSlash(command);
  if (!slashType) {
    return { argv: [...argv], rewritten: false, reason: 'unmapped', slashType: null };
  }

  const rest = argv.slice(1);
  const { positionals, flags } = partitionCliTokens(rest);

  // CLI-only empty overrides: some CLIs show help on empty, not status
  // (session model CLI needs sessionId; empty should not become "status")
  if (
    positionals.length === 0 &&
    flags.length === 0 &&
    (slashType === '/model' || command.replace(/^\/+/, '').toLowerCase() === 'session')
  ) {
    return {
      argv: [command.replace(/^\/+/, ''), ...flags],
      rewritten: false,
      reason: 'cli-empty-help',
      slashType,
    };
  }

  const joined = positionals.join(' ');
  const natural = naturalizeSharedSurfaceArgs(slashType, joined);

  // Re-tokenize naturalized positionals; keep original multi-word by splitting on spaces
  // (same model as slash args after rewrite).
  const newPositionals = natural.args ? natural.args.split(/\s+/).filter(Boolean) : [];

  const nextArgv = [command.replace(/^\/+/, ''), ...newPositionals, ...flags];
  return {
    argv: nextArgv,
    rewritten: natural.rewritten,
    reason: natural.reason,
    slashType,
  };
}

/**
 * Naturalize a surface text line already shaped as `/cmd args` or `cmd args`.
 */
export function naturalizeCliSurfaceText(surfaceText: string): {
  text: string;
  rewritten: boolean;
  reason: string;
} {
  const trimmed = String(surfaceText || '').trim();
  if (!trimmed) {
    return { text: '', rewritten: false, reason: 'empty' };
  }

  let commandType: string;
  let args: string;
  if (trimmed.startsWith('/')) {
    const space = trimmed.indexOf(' ');
    commandType = space >= 0 ? trimmed.slice(0, space) : trimmed;
    args = space >= 0 ? trimmed.slice(space + 1).trim() : '';
  } else {
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const slash = mapCliCommandToSlash(cmd);
    if (!slash) {
      return { text: trimmed, rewritten: false, reason: 'unmapped' };
    }
    commandType = slash;
    args = parts.slice(1).join(' ');
  }

  const natural = naturalizeSharedSurfaceArgs(commandType, args);
  const text = `${commandType}${natural.args ? ` ${natural.args}` : ''}`.trim();
  return { text, rewritten: natural.rewritten, reason: natural.reason };
}

/** Register CLI alias → slash policy (plugins / tests). */
export function registerCliNaturalMapping(cliCommand: string, slashType: string, policy?: NaturalSlashPolicy): void {
  const bare = String(cliCommand || '')
    .trim()
    .replace(/^\/+/, '');
  if (!bare) return;
  CLI_TO_SLASH[bare] = slashType.startsWith('/') ? slashType : `/${slashType}`;
  CLI_TO_SLASH[bare.toLowerCase()] = CLI_TO_SLASH[bare];
  if (policy) {
    registerNaturalSlashPolicy(CLI_TO_SLASH[bare], policy);
  }
}

export function formatCliNaturalConventionHelp(): string {
  return [
    formatNaturalSlashConventionHelp(),
    '',
    'CLI (same rules):',
    '  zavorth <command>',
    '  zavorth <command> <plain language request>',
    '  zavorth consensus "Should we ship A or B?"',
    '  zavorth hub platform-sync',
    '  zavorth skills automate releases',
    '  zavorth memory gateway release',
    '',
    'Chat and CLI share NaturalSlashConvention policies.',
  ].join('\n');
}
