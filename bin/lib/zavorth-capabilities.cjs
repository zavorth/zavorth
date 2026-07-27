'use strict';

/**
 * Zavorth terminal capabilities on bare `zavorth <cmd>`.
 *
 * Strategies:
 *  - native     → implemented here (no agent dist required)
 *  - hybrid     → bare summary native; positional subcommands may use agent runtime
 *  - delegated  → internal agent runtime (dist/zavorth-cli.js)
 *  - coding     → Code TUI / yargs owns these
 *
 * Offline first-contact (no capability token): printProductHelp / printProductVersion
 * handle bare invoke, --help/-h/help, and --version/-V without ensuring Code TUI.
 *
 * Inventory: docs/product/cli-capabilities.md
 */

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Basename for user-local setup secrets (never under git-tracked project tree when possible). */
const SETUP_LOCAL_ENV_BASENAME = 'setup.local.env';
/** Non-secret preferred provider metadata under state dir. */
const SETUP_PREFERENCE_BASENAME = 'setup-preference.json';

/** @typedef {'setup-health'|'models-providers'|'channels-memory'|'approvals-trust'|'operator'|'coding'} CapabilityCluster */
/** @typedef {'native'|'hybrid'|'delegated'|'coding'} CapabilityStrategy */

/**
 * @typedef {{
 *   command: string,
 *   aliases?: string[],
 *   cluster: CapabilityCluster,
 *   strategy: CapabilityStrategy,
 *   summary: string,
 * }} CapabilityDef
 */

/** Well-known LLM / speech providers detectable from env (no secret values printed). */
const PROVIDER_CATALOG = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    secretEnvKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    modelEnvKeys: ['GEMINI_MODEL', 'GOOGLE_MODEL'],
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    secretEnvKeys: ['OPENAI_API_KEY'],
    modelEnvKeys: ['OPENAI_MODEL'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    secretEnvKeys: ['ANTHROPIC_API_KEY'],
    modelEnvKeys: ['ANTHROPIC_MODEL'],
    defaultModel: 'claude-3-5-sonnet-latest',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    secretEnvKeys: ['OPENROUTER_API_KEY'],
    modelEnvKeys: ['OPENROUTER_MODEL'],
    defaultModel: 'openrouter/auto',
  },
  {
    id: 'groq',
    label: 'Groq',
    secretEnvKeys: ['GROQ_API_KEY'],
    modelEnvKeys: ['GROQ_MODEL'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    secretEnvKeys: ['DEEPSEEK_API_KEY'],
    modelEnvKeys: ['DEEPSEEK_MODEL'],
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    secretEnvKeys: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
    modelEnvKeys: ['HUGGINGFACE_MODEL'],
    defaultModel: 'auto',
  },
  {
    id: 'xai',
    label: 'xAI',
    secretEnvKeys: ['XAI_API_KEY', 'GROK_API_KEY'],
    modelEnvKeys: ['XAI_MODEL', 'GROK_MODEL'],
    defaultModel: 'grok-latest',
  },
  {
    id: 'local',
    label: 'Local / Ollama',
    secretEnvKeys: [],
    modelEnvKeys: ['LOCAL_MODEL', 'OLLAMA_MODEL'],
    defaultModel: 'local-default',
    alwaysConfigured: true,
  },
];

/** Channel tokens / config env keys for inventory (values never printed). */
const CHANNEL_ENV_HINTS = [
  { id: 'telegram', label: 'Telegram', envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TOKEN'] },
  { id: 'discord', label: 'Discord', envKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_TOKEN'] },
  { id: 'slack', label: 'Slack', envKeys: ['SLACK_BOT_TOKEN', 'SLACK_TOKEN'] },
  { id: 'whatsapp', label: 'WhatsApp', envKeys: ['WHATSAPP_TOKEN', 'WA_TOKEN'] },
  { id: 'email', label: 'Email SMTP', envKeys: ['EMAIL_SMTP_URL', 'SMTP_URL'] },
];

/** @type {CapabilityDef[]} */
const CAPABILITY_DEFS = [
  // Setup / health
  { command: 'setup', aliases: ['init'], cluster: 'setup-health', strategy: 'hybrid', summary: 'Setup status/interactive/apply (native); deeper wizard via agent when dist present' },
  { command: 'onboard', cluster: 'setup-health', strategy: 'hybrid', summary: 'Onboard status/interactive/apply (native); guided wizard via agent when dist present' },
  { command: 'quickstart', cluster: 'setup-health', strategy: 'hybrid', summary: 'Quickstart summary/interactive/apply (native); full flow via agent when dist present' },
  { command: 'doctor', aliases: ['check', 'diagnose'], cluster: 'setup-health', strategy: 'native', summary: 'Diagnose product terminal + runtime readiness' },
  { command: 'status', aliases: ['health'], cluster: 'setup-health', strategy: 'native', summary: 'Runtime readiness snapshot' },
  { command: 'home', cluster: 'setup-health', strategy: 'native', summary: 'Short status and next step' },
  { command: 'diagnostics', cluster: 'setup-health', strategy: 'hybrid', summary: 'Native health+inspect snapshot; deep export via agent when dist present' },
  { command: 'inspect', cluster: 'setup-health', strategy: 'hybrid', summary: 'Product inspect snapshot (native); deeper export via agent when needed' },

  // Models / providers (bare = native summary; subcommands → agent runtime)
  { command: 'providers', aliases: ['provs'], cluster: 'models-providers', strategy: 'hybrid', summary: 'Provider status (env + gateway); subcommands use agent runtime' },
  { command: 'models', cluster: 'models-providers', strategy: 'hybrid', summary: 'Model snapshot (env + workspace specs); subcommands use agent runtime' },

  // Channels / memory
  { command: 'channels', aliases: ['chanels', 'channles'], cluster: 'channels-memory', strategy: 'hybrid', summary: 'Channel inventory (config + env); subcommands use agent runtime' },
  { command: 'memory', cluster: 'channels-memory', strategy: 'delegated', summary: 'Memory plane' },
  { command: 'mnemos', cluster: 'channels-memory', strategy: 'delegated', summary: 'Mnemos memory controls' },

  // Approvals / trust
  { command: 'approve', cluster: 'approvals-trust', strategy: 'hybrid', summary: 'Pending approvals summary; interactive review via agent / Control' },
  { command: 'trust', cluster: 'approvals-trust', strategy: 'hybrid', summary: 'Trust policy summary; deeper edits via agent / Control' },

  // Operator escapes (still operator surface)
  { command: 'open', aliases: ['panel'], cluster: 'operator', strategy: 'native', summary: 'Open Zavorth Control URL' },
  { command: 'host', cluster: 'operator', strategy: 'native', summary: 'HostPresenceUnit install/start/stop/status' },
  { command: 'start', cluster: 'operator', strategy: 'delegated', summary: 'Start or resume local runtime' },
  { command: 'ask', cluster: 'operator', strategy: 'delegated', summary: 'One-shot governed request (agent runtime)' },
  { command: 'chat', aliases: ['talk', 'converse'], cluster: 'operator', strategy: 'delegated', summary: 'Agent chat session (agent runtime)' },
  { command: 'actions', cluster: 'operator', strategy: 'delegated', summary: 'Action harness' },
  { command: 'swarm', cluster: 'operator', strategy: 'delegated', summary: 'Swarm controls' },
  { command: 'workflows', cluster: 'operator', strategy: 'delegated', summary: 'Workflow controls' },
  { command: 'effort', cluster: 'operator', strategy: 'delegated', summary: 'Effort level' },
  { command: 'sandbox', cluster: 'operator', strategy: 'delegated', summary: 'Sandbox controls' },
  { command: 'satellite', cluster: 'operator', strategy: 'delegated', summary: 'Satellite controls' },
  { command: 'hud', cluster: 'operator', strategy: 'delegated', summary: 'HUD / operator chrome' },
  { command: 'native', cluster: 'operator', strategy: 'delegated', summary: 'Native capability catalog' },
  { command: 'diff', cluster: 'operator', strategy: 'delegated', summary: 'Sandbox diff before approval' },
  { command: 'learn', cluster: 'operator', strategy: 'delegated', summary: 'Learning / narrative surfaces' },
  { command: 'constitution', cluster: 'operator', strategy: 'delegated', summary: 'Project constitution' },
  { command: 'disk', aliases: ['disk-gate'], cluster: 'operator', strategy: 'delegated', summary: 'Disk mutation gate' },
  { command: 'branch', cluster: 'operator', strategy: 'delegated', summary: 'Branch helpers' },
  { command: 'commit', cluster: 'operator', strategy: 'delegated', summary: 'Commit helpers' },
  { command: 'review', aliases: ['code-review', 'codereview'], cluster: 'operator', strategy: 'delegated', summary: 'Governed review' },
  { command: 'tasks', aliases: ['task'], cluster: 'operator', strategy: 'delegated', summary: 'Task plane' },
  { command: 'curator', cluster: 'operator', strategy: 'delegated', summary: 'Curator' },
  { command: 'instance', cluster: 'operator', strategy: 'delegated', summary: 'Instance controls' },
  { command: 'todo', cluster: 'operator', strategy: 'delegated', summary: 'Todo / work queue' },
  { command: 'later', cluster: 'operator', strategy: 'delegated', summary: 'Defer work' },
  { command: 'work', cluster: 'operator', strategy: 'delegated', summary: 'Active work' },
  { command: 'done', cluster: 'operator', strategy: 'delegated', summary: 'Complete work' },
  { command: 'retry', cluster: 'operator', strategy: 'delegated', summary: 'Retry work' },
  { command: 'cancel', cluster: 'operator', strategy: 'delegated', summary: 'Cancel work' },
  { command: 'local-gateway', cluster: 'operator', strategy: 'delegated', summary: 'Mock gateway helper' },
  // Trust Loop product commands — always delegated to agent runtime (builtin CLI),
  // never fall through to Code TUI ensure/download.
  { command: 'proof', aliases: ['proof-ledger', 'proof-os', 'trust-loop'], cluster: 'approvals-trust', strategy: 'delegated', summary: 'Trust Loop unified receipt ledger (list/show/export)' },
  {
    command: 'memory-privacy',
    aliases: ['memory-privacy-os', 'privacy-memory'],
    cluster: 'channels-memory',
    strategy: 'delegated',
    summary: 'Memory Privacy OS — what it remembers, why, forget with proof',
  },
  {
    command: 'absorb',
    aliases: ['capability-absorb', 'capabilities-absorb', 'fetch-capability'],
    cluster: 'operator',
    strategy: 'delegated',
    summary: 'Absorb skill/plugin/MCP under quarantine with risk report',
  },
  {
    command: 'import-workspace',
    aliases: ['workspace-import', 'universal-import'],
    cluster: 'operator',
    strategy: 'delegated',
    summary: 'Universal workspace import + optional migration profiles',
  },
  {
    command: 'risk-budget',
    aliases: ['riskbudget'],
    cluster: 'approvals-trust',
    strategy: 'delegated',
    summary: 'Risk Budget OS — observer / operator / autopilot ceilings',
  },
  {
    command: 'change-preview',
    aliases: ['preview-change', 'what-changes'],
    cluster: 'approvals-trust',
    strategy: 'delegated',
    summary: 'Counterfactual change preview before approve',
  },
  {
    command: 'approval',
    aliases: ['approval-presentation', 'approval-os'],
    cluster: 'approvals-trust',
    strategy: 'delegated',
    summary: 'Trust Loop approval presentation (list/decide)',
  },

  // Meta
  { command: 'capabilities', aliases: ['caps'], cluster: 'setup-health', strategy: 'native', summary: 'List product terminal capabilities' },
];

/** Commands owned by the Code TUI / Code CLI (do not intercept). */
const CODING_OWNED = new Set([
  'tui',
  'acp',
  'pr',
  'mcp',
  'session',
  'serve',
  'agent',
  'upgrade',
  'uninstall',
  'export',
  'import',
  'generate',
  'github',
  'debug',
  'db',
  'plug',
  'plugin',
  'account',
  'web',
  'attach',
  'thread',
  'run',
  'stats',
]);

/** @type {Map<string, CapabilityDef>} */
const BY_NAME = (() => {
  const map = new Map();
  for (const def of CAPABILITY_DEFS) {
    map.set(def.command, def);
    for (const a of def.aliases || []) {
      map.set(String(a).toLowerCase(), def);
    }
  }
  return map;
})();

/**
 * @param {string[]|undefined|null} argv
 * @returns {{ hit: true, def: CapabilityDef, rest: string[] } | { hit: false }}
 */
function resolveCapability(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  if (args.length === 0) return { hit: false };

  const first = String(args[0] || '').trim().toLowerCase();
  if (!first || first.startsWith('-')) return { hit: false };
  if (CODING_OWNED.has(first)) return { hit: false };

  const def = BY_NAME.get(first);
  if (!def) return { hit: false };
  if (def.strategy === 'coding') return { hit: false };

  return { hit: true, def, rest: args.slice(1) };
}

/**
 * Hybrid commands: native summary when there is no positional subcommand.
 * @param {string[]|undefined|null} rest
 * @returns {boolean}
 */
function wantsNativeSummary(rest) {
  const args = Array.isArray(rest) ? rest : [];
  return !args.some((a) => a && !String(a).startsWith('-'));
}

/**
 * Hybrid commands with native-safe positional subcommands.
 * @param {CapabilityDef} def
 * @param {string[]} rest
 */
function wantsNativeForCommand(def, rest) {
  if (def.strategy === 'native') return true;
  if (def.strategy !== 'hybrid') return false;
  const args = Array.isArray(rest) ? rest : [];
  const pos = args.filter((a) => a && !String(a).startsWith('-')).map((a) => String(a).toLowerCase());
  if (pos.length === 0) return true;

  if (def.command === 'setup' || def.command === 'onboard' || def.command === 'quickstart') {
    return [
      'status',
      'help',
      'doctor',
      'check',
      'summary',
      'interactive',
      'wizard',
      'guide',
      'apply',
      'load',
      'token',
      'gateway-token',
    ].includes(pos[0]);
  }
  if (def.command === 'approve') {
    if (['list', 'status', 'open', 'help', 'grant', 'deny', 'approve', 'reject'].includes(pos[0])) {
      return true;
    }
    if (
      args.includes('--grant') ||
      args.includes('--deny') ||
      args.includes('--approve') ||
      args.includes('--reject')
    ) {
      return true;
    }
  }
  if (def.command === 'providers') {
    return ['list', 'status', 'show', 'summary', 'help'].includes(pos[0]);
  }
  if (def.command === 'models') {
    return ['list', 'status', 'show', 'summary', 'help'].includes(pos[0]);
  }
  if (def.command === 'channels') {
    return ['list', 'status', 'show', 'summary', 'help'].includes(pos[0]);
  }
  if (def.command === 'inspect') {
    return ['status', 'summary', 'help', 'json'].includes(pos[0]);
  }
  if (def.command === 'diagnostics') {
    return ['status', 'summary', 'help', 'json', 'quick'].includes(pos[0]);
  }
  // default hybrid: only bare/flags-only
  return wantsNativeSummary(rest);
}

/**
 * @param {string[]|undefined|null} rest
 * @returns {boolean}
 */
function wantsJson(rest) {
  const args = Array.isArray(rest) ? rest : [];
  return args.includes('--json') || args.includes('-j');
}

/**
 * @returns {CapabilityDef[]}
 */
function listCapabilities() {
  return CAPABILITY_DEFS.slice();
}

/**
 * @param {CapabilityCluster} [cluster]
 * @returns {CapabilityDef[]}
 */
function listCapabilitiesByCluster(cluster) {
  if (!cluster) return listCapabilities();
  return CAPABILITY_DEFS.filter((d) => d.cluster === cluster);
}

function defaultProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Align with scripts/lib/zavorth-runtime-bridge.mjs resolveStateDir.
 * Prefer $ZAVORTH_HOME/state; else XDG/Windows user state under zavorth.
 * Secrets and local setup prefs belong here — not under the git project tree.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolveStateDir(env) {
  const e = env || process.env;
  const home = e.ZAVORTH_HOME || e.MIMOCODE_HOME;
  if (home) {
    if (!path.isAbsolute(home)) {
      throw new Error(`ZAVORTH_HOME must be absolute, got: ${JSON.stringify(home)}`);
    }
    return path.join(home, 'state');
  }
  const xdg = e.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'zavorth');
}

/**
 * Absolute path to user-local setup.env for optional pasted keys.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function setupLocalEnvPath(env) {
  return path.join(resolveStateDir(env), SETUP_LOCAL_ENV_BASENAME);
}

/**
 * Absolute path for non-secret setup preference JSON under state.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function setupPreferencePath(env) {
  return path.join(resolveStateDir(env), SETUP_PREFERENCE_BASENAME);
}

/**
 * Restrict file mode on POSIX; on Windows remind about ACLs (no secret values logged).
 * @param {string} filePath
 */
function hardenLocalSecretFileMode(filePath) {
  if (process.platform === 'win32') {
    return {
      platform: 'win32',
      mode: null,
      note:
        'Windows: restrict NTFS ACL on this file to your user only (Properties → Security). Zavorth does not call icacls automatically.',
    };
  }
  try {
    fs.chmodSync(filePath, 0o600);
    return { platform: process.platform, mode: 0o600, note: 'chmod 600 applied' };
  } catch (err) {
    return {
      platform: process.platform,
      mode: null,
      note: `chmod 600 failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Parse a simple KEY=VALUE env file (no export, no multiline, # comments).
 * Values are returned but callers must not log them.
 * @param {string} filePath
 * @returns {{ keys: string[], map: Record<string, string>, rawLines: string[] }}
 */
function readEnvFileSilent(filePath) {
  /** @type {Record<string, string>} */
  const map = {};
  /** @type {string[]} */
  const rawLines = [];
  if (!fs.existsSync(filePath)) {
    return { keys: [], map, rawLines };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    rawLines.push(...raw.split(/\r?\n/));
    for (const line of rawLines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) map[key] = val;
    }
  } catch {
    // ignore
  }
  return { keys: Object.keys(map), map, rawLines };
}

/**
 * Upsert KEY=value into setup.local.env under state dir. Never logs the value.
 * @param {{ env?: NodeJS.ProcessEnv, key: string, value: string }} opts
 * @returns {{ path: string, key: string, modeInfo: ReturnType<typeof hardenLocalSecretFileMode> }}
 */
function writeSetupLocalEnvKey(opts) {
  const env = (opts && opts.env) || process.env;
  const key = String((opts && opts.key) || '').trim();
  const value = opts && typeof opts.value === 'string' ? opts.value : '';
  if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error('Invalid env key name');
  }
  // Reject empty / whitespace-only secrets
  if (!value.trim()) {
    throw new Error('Refusing to write empty secret value');
  }

  const stateDir = resolveStateDir(env);
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = setupLocalEnvPath(env);
  const existing = readEnvFileSilent(filePath);
  const lines = existing.rawLines.length
    ? existing.rawLines.slice()
    : [
        '# Zavorth user-local setup secrets — NOT for git',
        '# Path is under ZAVORTH_HOME/state or ~/.local/state/zavorth',
        '# Load with: zavorth setup apply',
        '',
      ];

  const assignment = `${key}=${value}`;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    if (k === key) {
      lines[i] = assignment;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
    lines.push(assignment);
  }

  // Atomic-ish write
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
  const modeInfo = hardenLocalSecretFileMode(filePath);
  return { path: filePath, key, modeInfo };
}

/**
 * Shell load instructions for setup.local.env (never prints secret values).
 * @param {string} filePath
 * @param {string[]} keyNames
 * @returns {string[]}
 */
function formatSetupApplyInstructions(filePath, keyNames) {
  const posix = [
    '# bash / zsh (current shell):',
    `set -a && . "${filePath.replace(/"/g, '\\"')}" && set +a`,
  ];
  const ps = [
    '# PowerShell (current process only):',
    `Get-Content -LiteralPath '${filePath.replace(/'/g, "''")}' | ForEach-Object {`,
    `  if ($_ -match '^\\s*#' -or $_ -notmatch '=') { return }`,
    `  $i = $_.IndexOf('='); $k = $_.Substring(0,$i).Trim(); $v = $_.Substring($i+1)`,
    `  if ($k) { Set-Item -Path Env:$k -Value $v }`,
    `}`,
  ];
  const cmd = [
    '# cmd.exe (per key — or use PowerShell above):',
    `REM for /f "usebackq tokens=1,* delims==" %A in ("${filePath}") do @if not "%A"=="" if not "%A:~0,1%"=="#" set "%A=%B"`,
  ];
  const lines = [
    `local env file: ${filePath}`,
    keyNames.length
      ? `keys present (names only): ${keyNames.join(', ')}`
      : 'keys present: (file empty or missing values)',
    '',
    'Load into your shell (secrets are not printed by this command):',
    '',
    ...(process.platform === 'win32' ? [...ps, '', ...posix] : [...posix, '', ...ps]),
    '',
    ...cmd,
    '',
    'Then verify without dumping secrets:',
    '  zavorth providers',
    '  zavorth doctor',
  ];
  if (process.platform === 'win32') {
    lines.push(
      '',
      'Security: keep this file user-private (NTFS ACL). Do not commit setup.local.env.',
    );
  } else {
    lines.push('', 'Security: file mode should be 600. Do not commit setup.local.env.');
  }
  return lines;
}

/**
 * zavorth setup apply — print how to load user-local env (never prints values).
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
function runNativeSetupApply(rest, opts) {
  const env = (opts && opts.env) || process.env;
  const args = Array.isArray(rest) ? rest : [];
  let filePath;
  try {
    filePath = setupLocalEnvPath(env);
  } catch (err) {
    process.stderr.write(
      `Cannot resolve state dir: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const exists = fs.existsSync(filePath);
  const parsed = exists ? readEnvFileSilent(filePath) : { keys: [], map: {}, rawLines: [] };
  // Do not touch map values in logs
  const keyNames = parsed.keys.slice();

  const payload = {
    path: filePath,
    exists,
    keyNames,
    stateDir: resolveStateDir(env),
    instructions: formatSetupApplyInstructions(filePath, keyNames),
  };

  if (wantsJson(args)) {
    // JSON still omits secret values
    process.stdout.write(
      `${JSON.stringify(
        {
          path: payload.path,
          exists: payload.exists,
          keyNames: payload.keyNames,
          stateDir: payload.stateDir,
        },
        null,
        2,
      )}\n`,
    );
    return exists && keyNames.length > 0 ? 0 : 1;
  }

  if (!exists) {
    printPanel('Zavorth setup apply', [
      `No user-local env file yet: ${filePath}`,
      '',
      'Create keys with TTY guided setup:',
      '  zavorth setup interactive',
      '  (optional: paste a key when prompted — stored only under state dir)',
      '',
      'Or copy data/setup.env.example and set keys in your shell profile.',
      `State dir: ${payload.stateDir}`,
    ]);
    return 1;
  }

  printPanel('Zavorth setup apply', payload.instructions);
  return keyNames.length > 0 ? 0 : 1;
}

function resolveGatewayBaseUrl(env) {
  const pick = (v) => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    return t.replace(/\/+$/, '');
  };
  return (
    pick(env.ZAVORTH_GATEWAY_BASE_URL) ||
    pick(env.ZavorthGateway_BASE_URL) ||
    pick(env.BASE_URL) ||
    pick(env.NEXT_PUBLIC_BASE_URL) ||
    'http://localhost:20128'
  );
}

/**
 * Soft HTTP probe (no throw). Returns { ok, status, error? }.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [opts]
 */
function probeUrl(url, timeoutMs, opts) {
  const timeout = typeof timeoutMs === 'number' ? timeoutMs : 2500;
  const method = (opts && opts.method) || 'GET';
  const headers = (opts && opts.headers) || {};
  const body = opts && typeof opts.body === 'string' ? opts.body : null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const lib = url.startsWith('https:') ? https : http;
      const u = new URL(url);
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method,
          headers: {
            ...headers,
            ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
          },
          timeout,
        },
        (res) => {
          res.resume();
          const status = res.statusCode || 0;
          // 2xx–4xx means TCP + HTTP stack answered (auth failures count as reachable)
          finish({
            ok: status >= 200 && status < 500,
            status,
          });
        },
      );
      req.on('error', (err) => finish({ ok: false, status: 0, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        finish({ ok: false, status: 0, error: 'timeout' });
      });
      if (body) req.write(body);
      req.end();
    } catch (err) {
      finish({
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * Soft multi-path gateway reachability.
 * @param {string} gatewayBaseUrl
 */
async function probeGatewaySurface(gatewayBaseUrl) {
  const base = String(gatewayBaseUrl || '').replace(/\/+$/, '');
  const getCandidates = [
    `${base}/api/code-bridge`,
    `${base}/api/monitoring/health`,
    `${base}/api/health`,
    `${base}/health`,
  ];
  /** @type {{ ok: boolean, status: number, error?: string, url?: string }} */
  let health = { ok: false, status: 0 };
  for (const url of getCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const r = await probeUrl(url, 1800);
    if (r.ok || (r.status && r.status > 0)) {
      health = { ...r, url };
      if (r.ok) break;
    }
  }

  // Protocol surfaces used by product-hosted TUI (no secrets; expect 4xx is fine)
  const chat = await probeUrl(`${base}/v1/chat/completions`, 1800, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer zavorth-smoke-invalid',
    },
    body: JSON.stringify({ model: 'smoke', messages: [{ role: 'user', content: 'ping' }] }),
  });
  const messages = await probeUrl(`${base}/v1/messages`, 1800, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'zavorth-smoke-invalid',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'smoke',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });

  return {
    ok: Boolean(health.ok || chat.ok || messages.ok),
    health,
    chatCompletions: chat,
    anthropicMessages: messages,
  };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
function isProductHostEnv(env) {
  const src = String(env.ZAVORTH_RUNTIME_SOURCE || '').trim().toLowerCase();
  if (src === 'workspace' || src === 'zavorth' || src === 'monorepo' || src === 'product') return true;
  if (env.ZAVORTH_CODE_FROM_WORKSPACE === '1' || env.ZAVORTH_CODE_FROM_MONOREPO === '1') return true;
  return false;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
function managementTokenConfigured(env) {
  return Boolean(
    (typeof env.ZAVORTH_MANAGEMENT_TOKEN === 'string' && env.ZAVORTH_MANAGEMENT_TOKEN.trim()) ||
      (typeof env.ZAVORTH_GATEWAY_TOKEN === 'string' && env.ZAVORTH_GATEWAY_TOKEN.trim()),
  );
}

/**
 * Routing posture for doctor/status (booleans only).
 * @param {NodeJS.ProcessEnv} env
 */
function collectRoutingPosture(env) {
  const hosted = isProductHostEnv(env);
  const providersDirect =
    env.ZAVORTH_PROVIDERS_DIRECT === '1' ||
    env.ZAVORTH_PROVIDERS_DIRECT === 'true' ||
    env.ZAVORTH_ROUTE_PROVIDERS === '0' ||
    env.ZAVORTH_ROUTE_PROVIDERS === 'false' ||
    env.ZAVORTH_ROUTE_PROVIDERS === 'no' ||
    env.ZAVORTH_ROUTE_PROVIDERS === 'off';
  const anthropicDirect =
    env.ZAVORTH_ANTHROPIC_DIRECT === '1' ||
    env.ZAVORTH_ANTHROPIC_DIRECT === 'true' ||
    env.ZAVORTH_ROUTE_ANTHROPIC === '0' ||
    env.ZAVORTH_ROUTE_ANTHROPIC === 'false' ||
    env.ZAVORTH_ROUTE_ANTHROPIC === 'no' ||
    env.ZAVORTH_ROUTE_ANTHROPIC === 'off';
  const openaiCompatRouted = hosted && !providersDirect;
  const anthropicRouted = hosted && !anthropicDirect;
  return {
    productHosted: hosted,
    openaiCompatibleRouted: openaiCompatRouted,
    anthropicRouted,
    managementTokenSet: managementTokenConfigured(env),
  };
}

/**
 * @param {string} filePath
 * @returns {unknown|null}
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} keys
 * @returns {boolean}
 */
function anyEnvSet(env, keys) {
  return keys.some((k) => {
    const v = env[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} keys
 * @returns {string|null}
 */
function firstEnvValue(env, keys) {
  for (const k of keys) {
    const v = env[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function collectHealthSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const codeIndex = path.join(projectRoot, 'packages', 'code', 'cli', 'src', 'index.ts');
  const agentDist = path.join(projectRoot, 'dist', 'zavorth-cli.js');
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const routing = collectRoutingPosture(env);
  const workspaceRoot =
    (typeof env.ZAVORTH_WORKSPACE_ROOT === 'string' && env.ZAVORTH_WORKSPACE_ROOT.trim()) ||
    (typeof env.ZAVORTH_MONOREPO_ROOT === 'string' && env.ZAVORTH_MONOREPO_ROOT.trim()) ||
    projectRoot;

  // Prefer launch resolver: prebuilt Code binary needs no Bun at runtime
  let codeBinary = null;
  try {
    const launch = require('./launch-code-tui.cjs');
    if (typeof launch.resolveCompiledCodeBinary === 'function') {
      codeBinary = launch.resolveCompiledCodeBinary(projectRoot, env);
    }
  } catch {
    codeBinary = null;
  }
  const codeBinaryOk = Boolean(codeBinary && fs.existsSync(codeBinary));

  let bunOk = false;
  let bunVersion = null;
  try {
    /** Resolve real bun binary (Windows npm shim .cmd cannot spawn without shell). */
    /** @type {string[]} */
    const candidates = [];
    const pathDirs = String(process.env.PATH || process.env.Path || '').split(path.delimiter);
    const basenames =
      process.platform === 'win32' ? ['bun.exe', 'bun.cmd', 'bun'] : ['bun'];
    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const base of basenames) {
        const full = path.join(dir, base);
        if (!fs.existsSync(full)) continue;
        candidates.push(full);
        if (process.platform === 'win32') {
          const nested = path.join(dir, 'node_modules', 'bun', 'bin', 'bun.exe');
          if (fs.existsSync(nested)) candidates.push(nested);
        }
      }
    }
    if (process.platform === 'win32' && process.env.APPDATA) {
      const nested = path.join(
        process.env.APPDATA,
        'npm',
        'node_modules',
        'bun',
        'bin',
        'bun.exe',
      );
      if (fs.existsSync(nested)) candidates.push(nested);
    }
    candidates.push('bun');
    const seen = new Set();
    for (const bun of candidates) {
      if (seen.has(bun)) continue;
      seen.add(bun);
      if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bun)) continue;
      const r = spawnSync(bun, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
        shell: false,
        timeout: 4000,
      });
      if (!r.error && r.status === 0) {
        bunOk = true;
        if (r.stdout) bunVersion = String(r.stdout).trim().split(/\r?\n/)[0] || null;
        break;
      }
    }
  } catch {
    bunOk = false;
  }

  const surface = await probeGatewaySurface(gatewayBaseUrl);
  const gatewayProbe = surface.health;
  const codePresent = fs.existsSync(codeIndex);
  const legacyPresent = fs.existsSync(agentDist);
  const v1ChatOk = Boolean(surface.chatCompletions && surface.chatCompletions.ok);
  const v1MessagesOk = Boolean(surface.anthropicMessages && surface.anthropicMessages.ok);
  // TUI can run via prebuilt binary (preferred) OR sources+Bun
  const codeRuntimeOk = codeBinaryOk || (codePresent && bunOk);
  const codeRuntimeMode = codeBinaryOk
    ? 'binary'
    : codePresent && bunOk
      ? 'sources+bun'
      : codePresent
        ? 'sources-need-runtime'
        : 'missing';

  /** @type {{ id: string, ok: boolean, label: string, detail?: string }[]} */
  const checks = [
    {
      id: 'code-runtime',
      ok: codeRuntimeOk,
      label:
        codeRuntimeMode === 'binary'
          ? 'Code TUI runtime: prebuilt binary'
          : codeRuntimeMode === 'sources+bun'
            ? 'Code TUI runtime: sources + Bun'
            : codeRuntimeMode === 'sources-need-runtime'
              ? 'Code TUI sources present — need binary or Bun'
              : 'Code TUI runtime missing',
      detail:
        codeRuntimeMode === 'binary'
          ? path.relative(projectRoot, codeBinary) || codeBinary
          : codeRuntimeMode === 'sources+bun'
            ? `packages/code/cli · bun ${bunVersion || ''}`.trim()
            : codeRuntimeMode === 'sources-need-runtime'
              ? 'Run: npm run code:build  (or install Bun for source launch)'
              : 'Restore packages/code or install a release that includes the Code binary',
    },
    {
      id: 'code-tui',
      ok: codePresent || codeBinaryOk,
      label: codePresent
        ? 'Code TUI sources present'
        : codeBinaryOk
          ? 'Code TUI sources optional (binary present)'
          : 'Code TUI sources missing',
      detail: codePresent ? 'packages/code/cli' : codeBinaryOk ? 'using prebuilt binary only' : undefined,
    },
    {
      id: 'bun',
      // Bun is optional when a prebuilt binary exists — do not mark product unhealthy
      ok: codeBinaryOk || bunOk,
      label: codeBinaryOk
        ? bunOk
          ? `Bun optional (binary ready)${bunVersion ? ` · ${bunVersion}` : ''}`
          : 'Bun not required (prebuilt Code binary present)'
        : bunOk
          ? `Bun available${bunVersion ? ` · ${bunVersion}` : ''}`
          : 'Bun missing (needed only without prebuilt binary)',
      detail: codeBinaryOk
        ? 'Daily launch uses the prebuilt binary; Bun only for rebuilds'
        : bunOk
          ? undefined
          : 'Install Bun or run npm run code:build to create a binary',
    },
    {
      id: 'gateway',
      ok: surface.ok,
      label: surface.ok ? 'Gateway reachable' : 'Gateway not reachable',
      detail: `${gatewayBaseUrl}${
        gatewayProbe.error
          ? ` (${gatewayProbe.error})`
          : gatewayProbe.status
            ? ` HTTP ${gatewayProbe.status}`
            : surface.ok
              ? ''
              : ' (start ai-gateway for live routing/approvals)'
      }`,
    },
    {
      id: 'gateway-v1-chat',
      ok: !surface.ok || v1ChatOk,
      label: v1ChatOk
        ? 'OpenAI-compatible /v1/chat/completions answers'
        : surface.ok
          ? 'OpenAI-compatible /v1/chat/completions not answering'
          : 'OpenAI-compatible /v1 skipped (gateway down)',
      detail: surface.chatCompletions
        ? `HTTP ${surface.chatCompletions.status || 0}`
        : undefined,
    },
    {
      id: 'gateway-v1-messages',
      ok: !surface.ok || v1MessagesOk,
      label: v1MessagesOk
        ? 'Anthropic-format /v1/messages answers'
        : surface.ok
          ? 'Anthropic-format /v1/messages not answering'
          : 'Anthropic /v1/messages skipped (gateway down)',
      detail: surface.anthropicMessages
        ? `HTTP ${surface.anthropicMessages.status || 0}`
        : undefined,
    },
    {
      id: 'agent-dist',
      ok: legacyPresent,
      label: legacyPresent ? 'Agent runtime build present' : 'Agent runtime build missing',
      detail: legacyPresent
        ? 'dist/zavorth-cli.js (delegated commands)'
        : 'npm run build if you need delegated agent commands',
    },
    {
      id: 'product-host',
      ok: true,
      label: routing.productHosted ? 'Product host env active' : 'Standalone terminal env',
      detail: `policy=${
        env.ZAVORTH_POLICY_AUTHORITY ||
        (routing.productHosted ? 'gateway' : 'local')
      } source=${env.ZAVORTH_RUNTIME_SOURCE || 'unset'}`,
    },
    {
      id: 'routing',
      ok: true,
      label: 'Provider routing posture',
      detail: `openai-compatible=${routing.openaiCompatibleRouted ? 'gateway' : 'vendor'} anthropic=${routing.anthropicRouted ? 'gateway' : 'vendor'}`,
    },
    {
      id: 'management-token',
      ok: true,
      label: routing.managementTokenSet
        ? 'Management token configured'
        : 'Management token not set',
      detail: routing.managementTokenSet
        ? 'ZAVORTH_MANAGEMENT_TOKEN / ZAVORTH_GATEWAY_TOKEN present (value hidden)'
        : 'optional for non-loopback approve; zavorth setup token',
    },
    {
      id: 'policy-authority',
      ok: true,
      label: `Policy authority: ${env.ZAVORTH_POLICY_AUTHORITY || (routing.productHosted ? 'gateway' : 'local')}`,
      detail: routing.productHosted
        ? 'product-hosted TUI merges config/runtime-permissions.json on tool permission checks'
        : 'standalone TUI uses local permission rules only',
    },
  ];

  const ready = codeRuntimeOk;
  let nextAction = 'zavorth';
  if (!codeRuntimeOk) {
    if (codePresent && !bunOk && !codeBinaryOk) nextAction = 'npm run code:build   # or install Bun';
    else if (!codePresent && !codeBinaryOk) nextAction = 'Restore packages/code or install a full release';
    else nextAction = 'zavorth';
  } else if (!surface.ok) nextAction = 'Start the gateway for live routing, or connect providers in TUI';
  else if (!legacyPresent) nextAction = 'npm run build (only if you need agent-runtime commands like chat)';

  return {
    projectRoot,
    workspaceRoot,
    gatewayBaseUrl,
    ready,
    checks,
    nextAction,
    codePresent,
    codeBinaryOk,
    codeBinary,
    codeRuntimeMode,
    codeRuntimeOk,
    bunOk,
    bunVersion,
    legacyPresent,
    gatewayOk: surface.ok,
    gatewayHealth: gatewayProbe,
    gatewayV1: {
      chatCompletions: surface.chatCompletions,
      anthropicMessages: surface.anthropicMessages,
    },
    routing,
  };
}

/**
 * Provider status from env + gateway probe (no secret values).
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function collectProvidersSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const gatewayProbe = await probeUrl(`${gatewayBaseUrl}/api/code-bridge`);

  const providers = PROVIDER_CATALOG.map((p) => {
    const secretPresent = p.alwaysConfigured
      ? true
      : anyEnvSet(env, p.secretEnvKeys);
    const modelHint = firstEnvValue(env, p.modelEnvKeys) || p.defaultModel;
    return {
      id: p.id,
      label: p.label,
      configured: Boolean(secretPresent),
      secretEnvKeys: p.secretEnvKeys.slice(),
      modelHint,
      source: p.alwaysConfigured
        ? 'local-default'
        : secretPresent
          ? 'env'
          : 'missing',
    };
  });

  const configuredCount = providers.filter((p) => p.configured).length;
  const nextSteps = [];
  if (configuredCount <= 1) {
    nextSteps.push('zavorth setup          configure a cloud provider');
    nextSteps.push('Set OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY in the environment');
  }
  nextSteps.push('zavorth providers add  full agent wizard (needs dist build)');
  nextSteps.push(`Open Control: ${gatewayBaseUrl}/control`);
  if (!gatewayProbe.ok) {
    nextSteps.push('Start the gateway for live provider routing');
  }

  return {
    projectRoot,
    gatewayBaseUrl,
    gatewayOk: gatewayProbe.ok,
    providers,
    configuredCount,
    nextSteps,
  };
}

/**
 * Models snapshot from env + monorepo config files.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function collectModelsSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const gatewayProbe = await probeUrl(`${gatewayBaseUrl}/api/code-bridge`);

  const specsPath = path.join(projectRoot, 'config', 'runtime-model-specs.json');
  const bridgeModelsPath = path.join(projectRoot, 'config', 'zavorth-bridge-allowed-models.json');
  const specsDoc = readJsonFile(specsPath);
  const bridgeDoc = readJsonFile(bridgeModelsPath);

  /** @type {{ id: string, label: string, preferred?: string[] }[]} */
  const runtimeSpecs = [];
  let selectedSpecId = null;
  if (specsDoc && typeof specsDoc === 'object') {
    const doc = /** @type {{ selectedSpecId?: string, specs?: unknown[] }} */ (specsDoc);
    selectedSpecId = typeof doc.selectedSpecId === 'string' ? doc.selectedSpecId : null;
    if (Array.isArray(doc.specs)) {
      for (const raw of doc.specs) {
        if (!raw || typeof raw !== 'object') continue;
        const s = /** @type {{ id?: string, label?: string, preferredModelIds?: string[] }} */ (raw);
        if (!s.id) continue;
        runtimeSpecs.push({
          id: String(s.id),
          label: String(s.label || s.id),
          preferred: Array.isArray(s.preferredModelIds)
            ? s.preferredModelIds.map(String)
            : undefined,
        });
      }
    }
  }

  /** @type {{ key: string, label: string }[]} */
  const bridgeModels = [];
  if (bridgeDoc && typeof bridgeDoc === 'object') {
    const models = /** @type {{ models?: unknown[] }} */ (bridgeDoc).models;
    if (Array.isArray(models)) {
      for (const raw of models) {
        if (!raw || typeof raw !== 'object') continue;
        const m = /** @type {{ key?: string, label?: string }} */ (raw);
        if (!m.key) continue;
        bridgeModels.push({ key: String(m.key), label: String(m.label || m.key) });
      }
    }
  }

  const envModels = PROVIDER_CATALOG.map((p) => {
    const model = firstEnvValue(env, p.modelEnvKeys);
    const secretOk = p.alwaysConfigured || anyEnvSet(env, p.secretEnvKeys);
    return {
      providerId: p.id,
      label: p.label,
      model: model || p.defaultModel,
      fromEnv: Boolean(model),
      providerConfigured: Boolean(secretOk),
    };
  }).filter((row) => row.providerConfigured || row.fromEnv);

  const nextSteps = [
    'zavorth models pick     interactive selection (agent runtime)',
    'zavorth setup           guided provider + model setup',
    `Open Control: ${gatewayBaseUrl}/control`,
  ];

  return {
    projectRoot,
    gatewayBaseUrl,
    gatewayOk: gatewayProbe.ok,
    selectedSpecId,
    runtimeSpecs,
    bridgeModels,
    envModels,
    specsPath: fs.existsSync(specsPath) ? 'config/runtime-model-specs.json' : null,
    bridgeModelsPath: fs.existsSync(bridgeModelsPath)
      ? 'config/zavorth-bridge-allowed-models.json'
      : null,
    nextSteps,
  };
}

/**
 * Channel inventory from manifests + env hints.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
function collectChannelsSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);

  const manifestsDir = path.join(projectRoot, 'config', 'capability-manifests');
  /** @type {{ id: string, label: string, kind: string, source: string, envReady?: boolean }[]} */
  const fromManifests = [];
  if (fs.existsSync(manifestsDir)) {
    let names = [];
    try {
      names = fs.readdirSync(manifestsDir).filter((n) => n.endsWith('.json'));
    } catch {
      names = [];
    }
    for (const name of names) {
      const doc = readJsonFile(path.join(manifestsDir, name));
      if (!doc || typeof doc !== 'object') continue;
      const m = /** @type {{ id?: string, label?: string, kind?: string, tags?: string[] }} */ (doc);
      const kind = String(m.kind || '').toLowerCase();
      const tags = Array.isArray(m.tags) ? m.tags.map(String) : [];
      const isChannel =
        kind === 'channel' || tags.includes('channel') || /telegram|discord|slack|whatsapp/i.test(String(m.id || name));
      if (!isChannel) continue;
      fromManifests.push({
        id: String(m.id || path.basename(name, '.json')),
        label: String(m.label || m.id || name),
        kind: kind || 'channel',
        source: `config/capability-manifests/${name}`,
      });
    }
  }

  const envChannels = CHANNEL_ENV_HINTS.map((c) => ({
    id: c.id,
    label: c.label,
    kind: 'channel',
    source: 'env',
    envReady: anyEnvSet(env, c.envKeys),
    envKeys: c.envKeys.slice(),
  }));

  const mcpPath = path.join(projectRoot, 'config', 'mcp-servers.json');
  const mcpDoc = readJsonFile(mcpPath);
  let mcpServerCount = 0;
  if (mcpDoc && typeof mcpDoc === 'object') {
    const servers =
      /** @type {{ servers?: unknown[] | Record<string, unknown> }} */ (mcpDoc).servers;
    if (Array.isArray(servers)) mcpServerCount = servers.length;
    else if (servers && typeof servers === 'object') mcpServerCount = Object.keys(servers).length;
  }

  const nextSteps = [
    'zavorth channels <name>   channel detail / wiring (agent runtime)',
    'zavorth setup             guided channel setup',
    `Open Control: ${gatewayBaseUrl}/control`,
  ];

  return {
    projectRoot,
    gatewayBaseUrl,
    manifests: fromManifests,
    envChannels,
    mcpServerCount,
    mcpConfigPresent: fs.existsSync(mcpPath),
    nextSteps,
  };
}

/**
 * Approvals / pending summary from bridge + policy files.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function collectApprovalsSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const controlUrl = `${gatewayBaseUrl}/control`;
  const gatewayProbe = await probeUrl(`${gatewayBaseUrl}/api/code-bridge`);

  // Prefer live gateway experience approvals when reachable.
  let gatewayApprovals = [];
  let gatewayListOk = false;
  let gatewayListError = null;
  try {
    const approvalsMod = await import(
      pathToFileURL(path.join(projectRoot, 'scripts', 'lib', 'zavorth-approvals.mjs')).href
    );
    const listed = await approvalsMod.listApprovals({ env, baseUrl: gatewayBaseUrl });
    gatewayListOk = Boolean(listed.ok);
    gatewayListError = listed.error || null;
    if (listed.ok && Array.isArray(listed.approvals)) {
      gatewayApprovals = listed.approvals;
    }
  } catch (err) {
    gatewayListError = err instanceof Error ? err.message : String(err);
  }

  const inboxDir = path.join(projectRoot, 'data', 'agent-bridge', 'mailbox', 'inbox');
  let inboxPending = 0;
  if (fs.existsSync(inboxDir)) {
    try {
      inboxPending = fs
        .readdirSync(inboxDir)
        .filter((n) => !n.startsWith('.') && !n.endsWith('.tmp')).length;
    } catch {
      inboxPending = 0;
    }
  }

  const policiesPath = path.join(
    projectRoot,
    'data',
    'approval-policies',
    'persistent-approval-policies.json',
  );
  const policiesDoc = readJsonFile(policiesPath);
  let policyCount = 0;
  let enabledPolicies = 0;
  if (policiesDoc && typeof policiesDoc === 'object') {
    const policies = /** @type {{ policies?: unknown[] }} */ (policiesDoc).policies;
    if (Array.isArray(policies)) {
      policyCount = policies.length;
      enabledPolicies = policies.filter((p) => p && typeof p === 'object' && /** @type {{ enabled?: boolean }} */ (p).enabled !== false).length;
    }
  }

  const receiptsDir = path.join(projectRoot, 'data', 'approval-policies', 'receipts');
  let receiptCount = 0;
  if (fs.existsSync(receiptsDir)) {
    try {
      receiptCount = fs.readdirSync(receiptsDir).filter((n) => n.endsWith('.json') || n.includes('granted')).length;
    } catch {
      receiptCount = 0;
    }
  }

  // Lightweight scan for mutation plans waiting on approval (bounded).
  let waitingPlans = 0;
  const runtimeRoot = path.join(projectRoot, 'data', 'runtime');
  if (fs.existsSync(runtimeRoot)) {
    waitingPlans = countWaitingApprovalHints(runtimeRoot, 400);
  }

  const gatewayPending = gatewayApprovals.length;
  const localEstimate = inboxPending + waitingPlans;
  const pendingEstimate = gatewayListOk ? gatewayPending : localEstimate;
  const nextSteps = [];
  if (pendingEstimate > 0) {
    nextSteps.push('zavorth approve list');
    nextSteps.push('zavorth approve grant <id>   (gateway, when up)');
    nextSteps.push('zavorth approve deny <id>');
    nextSteps.push(`Open Control: ${controlUrl}`);
  } else {
    nextSteps.push('No pending queue detected (gateway and/or local state).');
    nextSteps.push(`Open Control: ${controlUrl}`);
  }
  if (!gatewayProbe.ok) {
    nextSteps.push('Start the gateway for live approvals (policyAuthority=gateway)');
  }

  return {
    projectRoot,
    gatewayBaseUrl,
    controlUrl,
    gatewayOk: gatewayProbe.ok,
    gatewayListOk,
    gatewayListError,
    gatewayApprovals: gatewayApprovals.slice(0, 50),
    gatewayPending,
    inboxPending,
    waitingPlans,
    localEstimate,
    pendingEstimate,
    policyAuthority: env.ZAVORTH_POLICY_AUTHORITY || 'gateway',
    policyCount,
    enabledPolicies,
    receiptCount,
    policiesPath: fs.existsSync(policiesPath)
      ? 'data/approval-policies/persistent-approval-policies.json'
      : null,
    nextSteps,
  };
}

/**
 * Bounded walk for "waiting_approval" markers under data/runtime.
 * @param {string} rootDir
 * @param {number} maxFiles
 * @returns {number}
 */
function countWaitingApprovalHints(rootDir, maxFiles) {
  let found = 0;
  let seen = 0;
  /** @type {string[]} */
  const stack = [rootDir];
  while (stack.length && seen < maxFiles) {
    const dir = stack.pop();
    if (!dir) break;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (seen >= maxFiles) break;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!/\.(json|jsonl|log|txt)$/i.test(ent.name)) continue;
      seen += 1;
      if (/waiting[_-]?approval/i.test(ent.name)) {
        found += 1;
        continue;
      }
      // Only peek small files
      try {
        const st = fs.statSync(full);
        if (st.size > 64 * 1024) continue;
        const raw = fs.readFileSync(full, 'utf8');
        if (/waiting_approval|"status"\s*:\s*"waiting/i.test(raw)) found += 1;
      } catch {
        // ignore
      }
    }
  }
  return found;
}

/**
 * Trust / permission policy summary from workspace config.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
function collectTrustSnapshot(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const controlUrl = `${gatewayBaseUrl}/control`;

  const networkPath = path.join(projectRoot, 'config', 'network-trust-policy.json');
  const permsPath = path.join(projectRoot, 'config', 'runtime-permissions.json');
  const networkDoc = readJsonFile(networkPath);
  const permsDoc = readJsonFile(permsPath);

  let networkProfile = null;
  let privateNetworkDefault = null;
  let ssrfProtection = null;
  if (networkDoc && typeof networkDoc === 'object') {
    const n = /** @type {{
      profile?: string,
      privateNetwork?: { default?: string },
      safety?: { ssrfProtectionEnabled?: boolean }
    }} */ (networkDoc);
    networkProfile = n.profile || null;
    privateNetworkDefault = n.privateNetwork && n.privateNetwork.default
      ? n.privateNetwork.default
      : null;
    ssrfProtection =
      n.safety && typeof n.safety.ssrfProtectionEnabled === 'boolean'
        ? n.safety.ssrfProtectionEnabled
        : null;
  }

  let permissionsProfile = null;
  /** @type {string[]} */
  const approvalRequired = [];
  /** @type {string[]} */
  const blocked = [];
  if (permsDoc && typeof permsDoc === 'object') {
    const p = /** @type {{ profile?: string, defaults?: Record<string, string> }} */ (permsDoc);
    permissionsProfile = p.profile || null;
    if (p.defaults && typeof p.defaults === 'object') {
      for (const [key, val] of Object.entries(p.defaults)) {
        if (val === 'approval') approvalRequired.push(key);
        if (val === 'block') blocked.push(key);
      }
    }
  }

  const policyAuthority = env.ZAVORTH_POLICY_AUTHORITY || 'gateway';

  const nextSteps = [
    `Open Control: ${controlUrl}`,
    'zavorth trust edit       agent runtime trust tools (if dist built)',
    'zavorth setup            include trust posture in guided setup',
  ];

  return {
    projectRoot,
    gatewayBaseUrl,
    controlUrl,
    policyAuthority,
    networkProfile,
    privateNetworkDefault,
    ssrfProtection,
    permissionsProfile,
    approvalRequired: approvalRequired.slice(0, 24),
    approvalRequiredTotal: approvalRequired.length,
    blocked: blocked.slice(0, 12),
    blockedTotal: blocked.length,
    networkPath: fs.existsSync(networkPath) ? 'config/network-trust-policy.json' : null,
    permissionsPath: fs.existsSync(permsPath) ? 'config/runtime-permissions.json' : null,
    nextSteps,
  };
}

function a(code, s) { return `\x1b[${code}m${s}\x1b[0m`; }
function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }
function visLen(s) { return stripAnsi(s).length; }
const DIM = (s) => a('2', s);
const BOLD = (s) => a('1', s);

function printPanel(title, lines) {
  const W = Math.min(64, Math.max(48, (process.stdout.columns || 64) - 4));
  const IW = W - 2;
  const maxContent = IW - 2;

  function truncate(text, max) {
    return visLen(text) > max ? stripAnsi(text).slice(0, max - 1) + '…' : text;
  }

  const b = [];
  b.push(DIM('+─' + '─'.repeat(IW - 2) + '─+'));
  b.push(DIM('|') + ' ' + BOLD(title) + ' '.repeat(IW - title.length) + DIM('|'));

  for (const raw of lines) {
    const text = truncate(raw, maxContent);
    const pad = Math.max(0, maxContent - stripAnsi(text).length);
    b.push(DIM('|') + ' ' + text + ' '.repeat(pad) + ' ' + DIM('|'));
  }

  b.push(DIM('+─' + '─'.repeat(IW - 2) + '─+'));
  process.stdout.write('\n' + b.join('\n') + '\n\n');
}

/**
 * Read product version from package.json (offline; no network / no Code ensure).
 * @param {string} [projectRoot]
 * @returns {string}
 */
function readProductVersion(projectRoot) {
  const root = path.resolve(projectRoot || defaultProjectRoot());
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    if (pkg && typeof pkg.version === 'string' && pkg.version.trim()) {
      return pkg.version.trim();
    }
  } catch {
    // ignore
  }
  return '0.0.0';
}

/**
 * Offline product version for `zavorth --version` / `-V` (no Code TUI ensure).
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {number}
 */
function printProductVersion(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  process.stdout.write(`${readProductVersion(projectRoot)}\n`);
  return 0;
}

/**
 * Offline product home/help for bare `zavorth` and `--help`/`-h`/`help`.
 * Uses the native capabilities inventory; never downloads or ensures Code binaries.
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, kind?: 'home'|'help' }} [opts]
 * @returns {number}
 */
function printProductHelp(opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const kind = opts && opts.kind === 'home' ? 'home' : 'help';
  const version = readProductVersion(projectRoot);
  const clusters = [
    'setup-health',
    'models-providers',
    'channels-memory',
    'approvals-trust',
    'operator',
  ];

  const cmd = (name, desc) => `  ${name.padEnd(22)} ${desc}`;

  const lines = [
    `  Local-first governed AI agent runtime  v${version}`,
    '',
    'Usage:',
    cmd('zavorth', 'product home (offline)'),
    cmd('zavorth <command>', 'run a capability'),
    cmd('zavorth code [args]', 'open Code TUI'),
    cmd('zavorth --help | -h', 'this screen'),
    cmd('zavorth --version | -V', 'print version'),
    '',
    'Quick start:',
    cmd('zavorth doctor', 'diagnose terminal readiness'),
    cmd('zavorth setup', 'configure providers & trust'),
    cmd('zavorth start', 'start the governed runtime'),
    cmd('zavorth providers', 'provider status'),
    cmd('zavorth home', 'short status & next step'),
    cmd('zavorth capabilities', 'full command list'),
    '',
    'Code TUI:',
    cmd('zavorth code', 'coding shell (interactive)'),
    cmd('zavorth code --version', 'Code TUI version'),
    '',
    'Commands:',
  ];

  for (const cluster of clusters) {
    const allCmds = listCapabilitiesByCluster(/** @type {CapabilityCluster} */ (cluster));
    if (!allCmds.length) continue;
    const shown = allCmds.slice(0, 5);
    const more = allCmds.length - shown.length;
    lines.push('');
    lines.push(`  ${cluster}`);
    for (const d of shown) {
      lines.push(`    ${d.command.padEnd(20)} ${d.description || ''}`);
    }
    if (more > 0) lines.push(`    ${DIM(`+${more} more`)}`);
  }

  lines.push('');
  lines.push('  More: zavorth capabilities');

  printPanel(kind === 'home' ? 'Zavorth' : 'Zavorth help', lines);
  return 0;
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeStatus(opts) {
  const snap = await collectHealthSnapshot(opts);
  const r = snap.routing || {};
  const lines = [
    `root: ${snap.projectRoot}`,
    `ready: ${snap.ready ? 'yes' : 'no'}`,
    `host: ${r.productHosted ? 'product' : 'standalone'}`,
    `gateway: ${snap.gatewayBaseUrl} (${snap.gatewayOk ? 'up' : 'down'})`,
    `  v1 chat: ${snap.gatewayV1 && snap.gatewayV1.chatCompletions && snap.gatewayV1.chatCompletions.ok ? 'ok' : snap.gatewayOk ? 'down' : 'n/a'}`,
    `  v1 messages: ${snap.gatewayV1 && snap.gatewayV1.anthropicMessages && snap.gatewayV1.anthropicMessages.ok ? 'ok' : snap.gatewayOk ? 'down' : 'n/a'}`,
    `code-runtime: ${snap.codeRuntimeMode || (snap.ready ? 'ok' : 'missing')}`,
    `code-binary: ${snap.codeBinaryOk ? 'yes' : 'no'}`,
    `bun: ${snap.codeBinaryOk ? (snap.bunOk ? `optional (${snap.bunVersion || 'ok'})` : 'not required') : snap.bunOk ? `ok${snap.bunVersion ? ` (${snap.bunVersion})` : ''}` : 'needed for source launch'}`,
    `agent-dist: ${snap.legacyPresent ? 'ok' : 'missing'}`,
    `routing: openai=${r.openaiCompatibleRouted ? 'gateway' : 'vendor'} anthropic=${r.anthropicRouted ? 'gateway' : 'vendor'}`,
    `management-token: ${r.managementTokenSet ? 'set' : 'missing'}`,
    `next: ${snap.nextAction}`,
  ];
  printPanel('Zavorth status', lines);
  return snap.ready ? 0 : 1;
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeHome(opts) {
  const snap = await collectHealthSnapshot(opts);
  const cmd = (name, desc) => `  ${name.padEnd(22)} ${desc}`;
  const lines = [
    snap.ready ? 'Terminal ready.' : 'Terminal not fully ready.',
    `Next: ${snap.nextAction}`,
    '',
    'Daily:',
    cmd('zavorth', 'product home / help (offline)'),
    cmd('zavorth code', 'open Code TUI'),
    cmd('zavorth doctor', 'health checks'),
    cmd('zavorth providers', 'provider status'),
    cmd('zavorth setup', 'configure providers / trust'),
    cmd('zavorth capabilities', 'list terminal commands'),
  ];
  printPanel('Zavorth home', lines);
  return 0;
}

/**
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeDoctor(opts) {
  const snap = await collectHealthSnapshot(opts);
  const lines = snap.checks.map((c) => `${c.ok ? '✓' : '△'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  lines.push('');
  lines.push(`ready: ${snap.ready ? 'yes' : 'no'}`);
  lines.push(`next: ${snap.nextAction}`);
  printPanel('Zavorth doctor', lines);
  const criticalFail = snap.checks.some(
    (c) => !c.ok && (c.id === 'code-runtime' || c.id === 'code-tui'),
  );
  return criticalFail || !snap.ready ? 1 : 0;
}

/**
 * Native product inspect: health + providers + channels (no secrets).
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeInspect(rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const health = await collectHealthSnapshot({ projectRoot, env });
  const providers = await collectProvidersSnapshot({ projectRoot, env });
  const channels = collectChannelsSnapshot({ projectRoot, env });
  const trust = collectTrustSnapshot({ projectRoot, env });
  const payload = {
    health: {
      ready: health.ready,
      projectRoot: health.projectRoot,
      gatewayBaseUrl: health.gatewayBaseUrl,
      gatewayOk: health.gatewayOk,
      gatewayV1: health.gatewayV1,
      codePresent: health.codePresent,
      bunOk: health.bunOk,
      agentDistPresent: health.legacyPresent,
      routing: health.routing,
      nextAction: health.nextAction,
      checks: health.checks,
    },
    providers: {
      configuredCount: providers.configuredCount,
      gatewayOk: providers.gatewayOk,
      ids: providers.providers.map((p) => ({
        id: p.id,
        configured: p.configured,
        modelHint: p.modelHint,
      })),
    },
    channels: {
      mcpServerCount: channels.mcpServerCount,
      envReady: channels.envChannels.map((c) => ({ id: c.id, envReady: c.envReady })),
      manifests: channels.manifests.map((m) => m.id),
    },
    trust: {
      policyAuthority: trust.policyAuthority,
      networkProfile: trust.networkProfile,
      permissionsProfile: trust.permissionsProfile,
    },
  };

  if (wantsJson(rest) || (rest[0] && String(rest[0]).toLowerCase() === 'json')) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return health.ready ? 0 : 1;
  }

  const r = health.routing || {};
  const lines = [
    `ready: ${health.ready ? 'yes' : 'no'}`,
    `root: ${health.projectRoot}`,
    `gateway: ${health.gatewayBaseUrl} (${health.gatewayOk ? 'up' : 'down'})`,
    `code-tui: ${health.codePresent ? 'ok' : 'missing'}  bun: ${health.bunOk ? 'ok' : 'missing'}  agent-dist: ${health.legacyPresent ? 'ok' : 'missing'}`,
    `routing: openai=${r.openaiCompatibleRouted ? 'gateway' : 'vendor'} anthropic=${r.anthropicRouted ? 'gateway' : 'vendor'}`,
    `management-token: ${r.managementTokenSet ? 'set' : 'missing'}`,
    `providers configured: ${providers.configuredCount}`,
    `channels env-ready: ${channels.envChannels.filter((c) => c.envReady).length}/${channels.envChannels.length}`,
    `mcp servers: ${channels.mcpServerCount}`,
    `trust: network=${trust.networkProfile || '?'} permissions=${trust.permissionsProfile || '?'}`,
    '',
    `next: ${health.nextAction}`,
  ];
  printPanel('Zavorth inspect', lines);
  return health.ready ? 0 : 1;
}

/**
 * Create or report management token for gateway approve (user state only).
 * Never prints the secret after create unless --show once on create.
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeSetupToken(rest, opts) {
  const env = (opts && opts.env) || process.env;
  const args = Array.isArray(rest) ? rest : [];
  const pos = args.filter((a) => a && !String(a).startsWith('-')).map((a) => String(a).toLowerCase());
  // rest may be ['token', 'create'] or just ['create'] when already stripped
  const action = pos.includes('create') || pos.includes('generate') || args.includes('--create')
    ? 'create'
    : pos.includes('status') || pos.includes('show')
      ? 'status'
      : 'status';

  const configured = managementTokenConfigured(env);
  let localPath = null;
  try {
    localPath = setupLocalEnvPath(env);
  } catch {
    localPath = null;
  }
  let localHasToken = false;
  if (localPath && fs.existsSync(localPath)) {
    const parsed = readEnvFileSilent(localPath);
    localHasToken = Boolean(
      (parsed.map.ZAVORTH_MANAGEMENT_TOKEN && parsed.map.ZAVORTH_MANAGEMENT_TOKEN.trim()) ||
        (parsed.map.ZAVORTH_GATEWAY_TOKEN && parsed.map.ZAVORTH_GATEWAY_TOKEN.trim()),
    );
  }

  if (action === 'create') {
    const nonInteractive =
      !process.stdin.isTTY ||
      env.ZAVORTH_SETUP_NONINTERACTIVE === '1' ||
      args.includes('--yes') ||
      args.includes('-y');
    // Require explicit create intent (subcommand or flag) — always true here
    const crypto = require('node:crypto');
    const token = crypto.randomBytes(32).toString('base64url');
    if (!localPath) {
      process.stderr.write('Cannot resolve user state dir for setup.local.env (set ZAVORTH_HOME absolute).\n');
      return 1;
    }
    writeSetupLocalEnvKey({ env, key: 'ZAVORTH_MANAGEMENT_TOKEN', value: token });
    const payload = {
      ok: true,
      path: localPath,
      key: 'ZAVORTH_MANAGEMENT_TOKEN',
      created: true,
      // Only emit token once at create time when --print is passed (user asked)
      token: args.includes('--print') ? token : undefined,
      next: [
        'zavorth setup apply   # load into current shell',
        'Restart gateway processes that read ZAVORTH_MANAGEMENT_TOKEN',
      ],
    };
    if (wantsJson(args)) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      printPanel('Zavorth setup token', [
        'Created ZAVORTH_MANAGEMENT_TOKEN in user-local env (not in git).',
        `path: ${localPath}`,
        args.includes('--print')
          ? 'token printed once via --print (store securely; not shown again)'
          : 'token value not printed (use --print once if you need to copy it)',
        '',
        'Next:',
        '  zavorth setup apply',
        '  ensure gateway process sees ZAVORTH_MANAGEMENT_TOKEN for non-loopback approve',
      ]);
      if (args.includes('--print')) {
        process.stdout.write(`\nZAVORTH_MANAGEMENT_TOKEN=${token}\n`);
      }
    }
    void nonInteractive;
    return 0;
  }

  const payload = {
    envTokenSet: configured,
    localEnvPath: localPath,
    localEnvHasToken: localHasToken,
    next: localHasToken || configured
      ? ['zavorth setup apply', 'zavorth approve list']
      : ['zavorth setup token create', 'zavorth setup apply'],
  };
  if (wantsJson(args)) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }
  printPanel('Zavorth setup token', [
    `process env token: ${configured ? 'set' : 'missing'}`,
    localPath
      ? `user-local file: ${localHasToken ? 'has token key' : 'no token key'} (${localPath})`
      : 'user-local file: unavailable',
    '',
    'Create (writes only under user state, never the repo):',
    '  zavorth setup token create',
    '  zavorth setup token create --print   # show value once',
    'Load: zavorth setup apply',
  ]);
  return 0;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeOpen(rest, opts) {
  const env = (opts && opts.env) || process.env;
  const base = resolveGatewayBaseUrl(env);
  const target = rest[0] && !rest[0].startsWith('-')
    ? rest[0]
    : `${base}/control`;
  process.stdout.write(`Open Control: ${target}\n`);

  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawnSync('cmd', ['/c', 'start', '', target], {
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
      });
    } else if (platform === 'darwin') {
      spawnSync('open', [target], { stdio: 'ignore' });
    } else {
      spawnSync('xdg-open', [target], { stdio: 'ignore' });
    }
  } catch {
    process.stderr.write('Could not open a browser automatically. Copy the URL above.\n');
  }
  return 0;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeProviders(rest, opts) {
  const snap = await collectProvidersSnapshot(opts);
  if (wantsJson(rest)) {
    process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
    return 0;
  }
  const lines = [
    `gateway: ${snap.gatewayBaseUrl} (${snap.gatewayOk ? 'up' : 'down'})`,
    `configured: ${snap.configuredCount}/${snap.providers.length} (env-visible; secrets not shown)`,
    '',
  ];
  for (const p of snap.providers) {
    const mark = p.configured ? '●' : '○';
    lines.push(`${mark} ${p.id.padEnd(12)} ${p.configured ? 'ready' : 'missing'}  model≈${p.modelHint}`);
  }
  lines.push('');
  lines.push('Next:');
  for (const step of snap.nextSteps) lines.push(`  ${step}`);
  lines.push('');
  lines.push('Native: list | status | show | --json');
  lines.push('Other subcommands (add, remove, …) use the agent runtime when dist is built.');
  printPanel('Zavorth providers', lines);
  return 0;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeModels(rest, opts) {
  const snap = await collectModelsSnapshot(opts);
  if (wantsJson(rest)) {
    process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
    return 0;
  }
  const lines = [
    `gateway: ${snap.gatewayBaseUrl} (${snap.gatewayOk ? 'up' : 'down'})`,
    snap.selectedSpecId ? `selected runtime spec: ${snap.selectedSpecId}` : 'selected runtime spec: (none)',
    '',
  ];
  if (snap.envModels.length) {
    lines.push('From environment / local defaults:');
    for (const m of snap.envModels.slice(0, 12)) {
      lines.push(
        `  ${m.providerId.padEnd(12)} ${m.model}${m.fromEnv ? ' (env)' : ' (default)'}`,
      );
    }
    lines.push('');
  }
  if (snap.runtimeSpecs.length) {
    lines.push(`Runtime specs (${snap.specsPath || 'config'}):`);
    for (const s of snap.runtimeSpecs.slice(0, 8)) {
      const pref = s.preferred && s.preferred.length ? ` → ${s.preferred.slice(0, 2).join(', ')}` : '';
      lines.push(`  ${s.id.padEnd(14)} ${s.label}${pref}`);
    }
    lines.push('');
  }
  if (snap.bridgeModels.length) {
    lines.push(`Bridge allowlist (${snap.bridgeModelsPath || 'config'}):`);
    for (const m of snap.bridgeModels.slice(0, 8)) {
      lines.push(`  ${m.key.padEnd(22)} ${m.label}`);
    }
    lines.push('');
  }
  if (!snap.envModels.length && !snap.runtimeSpecs.length && !snap.bridgeModels.length) {
    lines.push('No model metadata found in env or config yet.');
    lines.push('');
  }
  lines.push('Next:');
  for (const step of snap.nextSteps) lines.push(`  ${step}`);
  printPanel('Zavorth models', lines);
  return 0;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeChannels(rest, opts) {
  const snap = collectChannelsSnapshot(opts);
  if (wantsJson(rest)) {
    process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
    return 0;
  }
  const lines = [
    `gateway: ${snap.gatewayBaseUrl}`,
    `mcp servers (config): ${snap.mcpServerCount}${snap.mcpConfigPresent ? '' : ' (no mcp-servers.json)'}`,
    '',
  ];
  if (snap.manifests.length) {
    lines.push('Capability manifests (channel-tagged):');
    for (const m of snap.manifests) {
      lines.push(`  ● ${m.id.padEnd(14)} ${m.label}`);
    }
    lines.push('');
  } else {
    lines.push('No channel-tagged capability manifests found.');
    lines.push('');
  }
  lines.push('Env readiness (tokens present, values hidden):');
  for (const c of snap.envChannels) {
    lines.push(`  ${c.envReady ? '●' : '○'} ${c.id.padEnd(12)} ${c.envReady ? 'token env set' : 'not set'}`);
  }
  lines.push('');
  lines.push('Next:');
  for (const step of snap.nextSteps) lines.push(`  ${step}`);
  printPanel('Zavorth channels', lines);
  return 0;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeApprove(rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const args = Array.isArray(rest) ? rest : [];
  const pos = args.filter((a) => a && !String(a).startsWith('-')).map((a) => String(a));
  const sub = (pos[0] || '').toLowerCase();

  if (sub === 'open') {
    return runNativeOpen([`${resolveGatewayBaseUrl(env)}/control`], { projectRoot, env });
  }

  // Mutations via gateway experience API
  const grantish =
    sub === 'grant' ||
    sub === 'approve' ||
    args.includes('--grant') ||
    args.includes('--approve');
  const denyish =
    sub === 'deny' ||
    sub === 'reject' ||
    args.includes('--deny') ||
    args.includes('--reject');

  if (grantish || denyish) {
    const realId = ['grant', 'deny', 'approve', 'reject'].includes(sub)
      ? pos[1]
      : pos[0];
    if (!realId) {
      process.stderr.write('Usage: zavorth approve grant <id> | zavorth approve deny <id>\n');
      return 1;
    }
    try {
      const approvalsMod = await import(
        pathToFileURL(path.join(projectRoot, 'scripts', 'lib', 'zavorth-approvals.mjs')).href
      );
      const result = await approvalsMod.decideApproval({
        id: realId,
        decision: denyish ? 'reject' : 'approve',
        env,
      });
      if (wantsJson(args)) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (result.ok) {
        process.stdout.write(`Approval ${realId}: ${result.decision} (via gateway)\n`);
      } else {
        process.stderr.write(
          `Could not decide approval ${realId}: ${result.error || 'unknown'}\n` +
            `Open Control: ${resolveGatewayBaseUrl(env)}/control\n`,
        );
      }
      return result.ok ? 0 : 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Approval decision failed: ${msg}\n`);
      return 1;
    }
  }

  const snap = await collectApprovalsSnapshot({ projectRoot, env });
  if (wantsJson(args) || sub === 'list') {
    process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
    return 0;
  }
  const lines = [
    `gateway: ${snap.gatewayBaseUrl} (${snap.gatewayOk ? 'up' : 'down'})`,
    `policy authority: ${snap.policyAuthority}`,
    `control: ${snap.controlUrl}`,
    `pending: ${snap.pendingEstimate}` +
      (snap.gatewayListOk ? ` (gateway list: ${snap.gatewayPending})` : ' (local estimate)'),
    `  bridge inbox files: ${snap.inboxPending}`,
    `  waiting_approval hints: ${snap.waitingPlans}`,
    `persistent policies: ${snap.enabledPolicies}/${snap.policyCount} enabled`,
    `receipts on disk: ${snap.receiptCount}`,
  ];
  if (snap.gatewayListOk && snap.gatewayApprovals && snap.gatewayApprovals.length) {
    lines.push('', 'Gateway approvals (sample):');
    for (const a of snap.gatewayApprovals.slice(0, 8)) {
      const id = a && (a.id || a.approvalId || a.key) ? String(a.id || a.approvalId || a.key) : '?';
      const title = a && (a.title || a.summary || a.text) ? String(a.title || a.summary || a.text).slice(0, 48) : '';
      lines.push(`  • ${id}${title ? ` — ${title}` : ''}`);
    }
  } else if (snap.gatewayListError) {
    lines.push(`gateway list: ${snap.gatewayListError}`);
  }
  lines.push('', 'Mutations: zavorth approve grant <id> | deny <id> (gateway)');
  lines.push('Next:');
  for (const step of snap.nextSteps) lines.push(`  ${step}`);
  printPanel('Zavorth approve', lines);
  return 0;
}

/**
 * Non-secret env recommendation file for guided setup (repo data/ template only).
 * Never writes secret values — only key names and next steps.
 * Real keys go to user-local state via writeSetupLocalEnvKey (TTY optional paste).
 */
function writeSetupEnvTemplate(projectRoot, missingProviders) {
  const outDir = path.join(projectRoot, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const lines = [
    '# Zavorth setup — environment template (no secrets stored by CLI)',
    '# Copy into your shell profile or use: zavorth setup apply',
    '# Do not put real keys in this file. Optional user-local secrets live under',
    '# $ZAVORTH_HOME/state/setup.local.env (or ~/.local/state/zavorth/setup.local.env).',
    '# That local file is gitignored; never commit it.',
    '',
    '# Gateway (ai-gateway)',
    'ZAVORTH_GATEWAY_BASE_URL=http://localhost:20128',
    'ZAVORTH_RUNTIME_SOURCE=workspace',
    'ZAVORTH_POLICY_AUTHORITY=gateway',
    '',
    '# Optional: route extra providers through product gateway',
    '# ZAVORTH_ROUTE_PROVIDERS=1',
    '# ZAVORTH_ROUTE_PROVIDER_IDS=openai,openrouter,groq,deepseek,xai',
    '# Anthropic: automatic when product-hosted; opt-out ZAVORTH_ROUTE_ANTHROPIC=0',
    '',
    '# Optional: management token for non-loopback gateway approve APIs',
    '# ZAVORTH_MANAGEMENT_TOKEN=',
    '',
  ];
  for (const p of missingProviders) {
    lines.push(`# ${p.label || p.id}`);
    for (const k of p.secretEnvKeys || []) {
      lines.push(`# ${k}=`);
    }
    lines.push('');
  }
  const file = path.join(outDir, 'setup.env.example');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

/**
 * Write non-secret preferred provider metadata under state dir (not project git tree).
 * @param {NodeJS.ProcessEnv} env
 * @param {{ preferredProviderId: string, secretEnvKeys?: string[], localEnvPath?: string|null }} pref
 */
function writeSetupPreference(env, pref) {
  const filePath = setupPreferencePath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        preferredProviderId: pref.preferredProviderId,
        secretEnvKeys: pref.secretEnvKeys || [],
        localEnvPath: pref.localEnvPath || null,
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
    'utf8',
  );
  return filePath;
}

/**
 * Interactive guided setup (native, no agent dist).
 * TTY: prompt which cloud provider to prepare; optional paste → user-local state only.
 * Non-TTY: write template + status (never secrets).
 */
async function runNativeSetupInteractive(kind, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const health = await collectHealthSnapshot({ projectRoot, env });
  const providers = await collectProvidersSnapshot({ projectRoot, env });
  const missing = (providers.providers || []).filter((p) => !p.configured && p.id !== 'local');
  const templatePath = writeSetupEnvTemplate(
    projectRoot,
    missing.length ? missing : PROVIDER_CATALOG.filter((p) => p.id !== 'local'),
  );

  let localEnvPath = null;
  let stateDir = null;
  try {
    stateDir = resolveStateDir(env);
    localEnvPath = setupLocalEnvPath(env);
  } catch {
    // ZAVORTH_HOME misconfigured — continue without local secret path
  }

  const plan = {
    kind,
    mode: 'interactive-native',
    ready: health.ready,
    gatewayBaseUrl: health.gatewayBaseUrl,
    gatewayOk: health.gatewayOk,
    configured: (providers.providers || []).filter((p) => p.configured).map((p) => p.id),
    missing: missing.map((p) => ({ id: p.id, label: p.label, secretEnvKeys: p.secretEnvKeys })),
    envTemplate: path.relative(projectRoot, templatePath).replace(/\\/g, '/'),
    /** User-local secrets path (may not exist yet); never under project data/ for secrets */
    localEnvPath: localEnvPath,
    stateDir,
    controlUrl: `${health.gatewayBaseUrl}/control`,
  };

  try {
    const outDir = path.join(projectRoot, 'data');
    fs.mkdirSync(outDir, { recursive: true });
    // setup-status is non-secret operational metadata only
    fs.writeFileSync(
      path.join(outDir, 'setup-status.json'),
      JSON.stringify({ ...plan, updatedAt: Date.now() }, null, 2),
      'utf8',
    );
  } catch {
    // ignore
  }

  const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!isTTY || env.ZAVORTH_SETUP_NONINTERACTIVE === '1') {
    printPanel(`Zavorth ${kind} interactive`, [
      'Non-interactive mode (no TTY or ZAVORTH_SETUP_NONINTERACTIVE=1).',
      'No secrets written (template + status only).',
      `Wrote env template: ${plan.envTemplate}`,
      localEnvPath
        ? `User-local secrets path (not written): ${localEnvPath}`
        : 'User-local secrets path: (unavailable — set absolute ZAVORTH_HOME)',
      `Configured providers: ${plan.configured.join(', ') || '(none)'}`,
      `Missing (set env keys): ${plan.missing.map((m) => m.id).join(', ') || '(none)'}`,
      `Control: ${plan.controlUrl}`,
      'TTY: zavorth setup interactive  (optional key paste → state/setup.local.env)',
      'Load: zavorth setup apply',
      'Then: zavorth doctor && zavorth providers',
    ]);
    return health.ready && plan.configured.length > 0 ? 0 : 1;
  }

  const readline = require('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) =>
    new Promise((resolve) => {
      rl.question(q, (answer) => resolve(String(answer || '').trim()));
    });
  /** Ask without echoing is not guaranteed on all terminals; still never re-print answer. */
  const askSecret = (q) =>
    new Promise((resolve) => {
      rl.question(q, (answer) => resolve(String(answer || '')));
    });

  try {
    process.stdout.write(
      '\nZavorth guided setup (native)\n' +
        'Template stays secret-free. Optional paste stores keys only under user state dir.\n\n',
    );
    process.stdout.write(`Gateway: ${health.gatewayBaseUrl} (${health.gatewayOk ? 'up' : 'down'})\n`);
    process.stdout.write(`Configured: ${plan.configured.join(', ') || '(none)'}\n`);
    process.stdout.write(`Template:  ${plan.envTemplate}\n`);
    if (localEnvPath) process.stdout.write(`Local env: ${localEnvPath}\n`);
    process.stdout.write('\n');

    if (missing.length === 0) {
      process.stdout.write('All catalog providers already have env keys (or local default).\n');
      process.stdout.write('Next: zavorth setup apply · zavorth doctor · zavorth\n');
      return 0;
    }

    process.stdout.write('Missing providers (choose one to prepare env keys):\n');
    missing.forEach((p, i) => {
      process.stdout.write(`  ${i + 1}. ${p.label} (${(p.secretEnvKeys || []).join(', ')})\n`);
    });
    process.stdout.write('  0. Skip / only write template\n');
    const choice = await ask('\nNumber: ');
    const n = Number(choice);
    if (!Number.isFinite(n) || n <= 0 || n > missing.length) {
      process.stdout.write(`OK — use ${plan.envTemplate} and set keys yourself.\n`);
      process.stdout.write('Or: zavorth setup apply  (after creating state/setup.local.env)\n');
      return 0;
    }
    const picked = missing[n - 1];
    const keys = Array.isArray(picked.secretEnvKeys) ? picked.secretEnvKeys.slice() : [];

    process.stdout.write(
      [
        '',
        `Selected: ${picked.label}`,
        'Env key name(s):',
        ...keys.map((k) => `  ${k}`),
        '',
      ].join('\n'),
    );

    let storedKey = null;
    let storedPath = null;
    if (localEnvPath && keys.length > 0) {
      process.stdout.write(
        'Optional: paste a key now to store in USER-LOCAL state (not project/git).\n' +
          'Leave empty to skip — set the variable in your shell instead.\n' +
          'Warning: input may be visible in this terminal; value is never re-printed.\n\n',
      );

      let keyName = keys[0];
      if (keys.length > 1) {
        keys.forEach((k, i) => process.stdout.write(`  ${i + 1}. ${k}\n`));
        const kChoice = await ask('Key number (default 1): ');
        const kn = Number(kChoice);
        if (Number.isFinite(kn) && kn >= 1 && kn <= keys.length) keyName = keys[kn - 1];
      }

      const pasted = await askSecret(`Paste value for ${keyName} (empty = skip): `);
      const secret = String(pasted || '').trim();
      // Never log secret
      if (secret) {
        try {
          const written = writeSetupLocalEnvKey({ env, key: keyName, value: secret });
          storedKey = written.key;
          storedPath = written.path;
          process.stdout.write(
            [
              '',
              `Stored key name ${storedKey} under user-local file (value not shown).`,
              `Path: ${storedPath}`,
              written.modeInfo && written.modeInfo.note ? `Mode: ${written.modeInfo.note}` : '',
              '',
              'Load into this shell:  zavorth setup apply',
              'Then: zavorth providers · zavorth doctor',
              '',
            ]
              .filter(Boolean)
              .join('\n'),
          );
        } catch (err) {
          process.stderr.write(
            `Could not write user-local env: ${err instanceof Error ? err.message : String(err)}\n`,
          );
          process.stdout.write('Falling back to manual env instructions (no secret stored).\n');
        }
      } else {
        process.stdout.write(
          [
            '',
            'Skipped paste. Set one of these in your environment:',
            ...keys.map((k) => `  set ${k}=…   # or export ${k}=…`),
            '',
            'After setting keys in a NEW shell:',
            '  zavorth providers',
            '  zavorth doctor',
            '  zavorth',
            '',
            `Env template: ${plan.envTemplate}`,
            localEnvPath ? `User-local file (optional): ${localEnvPath}` : '',
            'Load helper: zavorth setup apply',
            '',
          ]
            .filter(Boolean)
            .join('\n'),
        );
      }
    } else {
      process.stdout.write(
        [
          'Set one of these in your environment:',
          ...keys.map((k) => `  set ${k}=…   # or export ${k}=…`),
          '',
          `Env template: ${plan.envTemplate}`,
          '',
        ].join('\n'),
      );
    }

    try {
      writeSetupPreference(env, {
        preferredProviderId: picked.id,
        secretEnvKeys: keys,
        localEnvPath: storedPath || localEnvPath,
      });
    } catch {
      // ignore preference write failures
    }

    if (storedKey) {
      // already printed next steps
      return 0;
    }
    return 0;
  } finally {
    rl.close();
  }
}

/**
 * Native setup / onboard / quickstart summary (no agent dist).
 * @param {string} kind
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeSetup(kind, rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const health = await collectHealthSnapshot({ projectRoot, env });
  const providers = await collectProvidersSnapshot({ projectRoot, env });
  const args = Array.isArray(rest) ? rest : [];
  const pos = args.filter((a) => a && !String(a).startsWith('-')).map((a) => String(a).toLowerCase());
  const sub = pos[0] || 'status';

  if (sub === 'help') {
    process.stdout.write(
      [
        `Usage: zavorth ${kind} [status|doctor|help|interactive|apply|token]`,
        '',
        'Native (no agent dist):',
        `  zavorth ${kind}              readiness + next steps`,
        `  zavorth ${kind} status       same as bare`,
        `  zavorth ${kind} doctor       alias of zavorth doctor`,
        `  zavorth ${kind} interactive  guided setup (TTY); template + optional user-local key`,
        `  zavorth ${kind} apply        print how to load user-local setup.local.env`,
        `  zavorth ${kind} token        management token status`,
        `  zavorth ${kind} token create write token to user-local env (not git)`,
        '',
        'Security:',
        '  • data/setup.env.example — template only (never real keys)',
        '  • secrets only under state dir: $ZAVORTH_HOME/state/setup.local.env',
        '    (or ~/.local/state/zavorth/setup.local.env)',
        '  • non-interactive never writes secrets (except explicit token create)',
        '  • this CLI never prints secret values unless token create --print',
        '',
      ].join('\n'),
    );
    return 0;
  }
  if (sub === 'doctor' || sub === 'check') {
    return runNativeDoctor({ projectRoot, env });
  }
  if (sub === 'interactive' || sub === 'wizard' || sub === 'guide') {
    return runNativeSetupInteractive(kind, { projectRoot, env });
  }
  if (sub === 'apply' || sub === 'load') {
    // rest after subcommand for --json etc.
    const after = args.slice(args.findIndex((a) => String(a).toLowerCase() === sub) + 1);
    return runNativeSetupApply(after.length ? after : args, { projectRoot, env });
  }
  if (sub === 'token' || sub === 'gateway-token') {
    const after = args.slice(args.findIndex((a) => String(a).toLowerCase() === sub) + 1);
    return runNativeSetupToken(after, { projectRoot, env });
  }

  let localEnvPath = null;
  try {
    localEnvPath = setupLocalEnvPath(env);
  } catch {
    localEnvPath = null;
  }
  const localExists = localEnvPath ? fs.existsSync(localEnvPath) : false;

  const payload = {
    kind,
    ready: health.ready,
    gatewayBaseUrl: health.gatewayBaseUrl,
    gatewayOk: health.gatewayOk,
    codePresent: health.codePresent,
    bunOk: health.bunOk,
    legacyPresent: health.legacyPresent,
    providersConfigured: providers.configuredCount,
    providers: providers.providers.filter((p) => p.configured).map((p) => p.id),
    nextAction: health.nextAction,
    controlUrl: `${health.gatewayBaseUrl}/control`,
    localEnvPath,
    localEnvExists: localExists,
    nextSteps: [
      `zavorth ${kind} interactive   guided native setup (optional user-local key paste)`,
      `zavorth ${kind} apply         load instructions for setup.local.env`,
      'zavorth providers     see env/gateway provider posture',
      'zavorth models        model snapshot',
      'zavorth doctor        full health checks',
      `Open Control: ${health.gatewayBaseUrl}/control`,
    ],
  };

  try {
    const outDir = path.join(projectRoot, 'data');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'setup-status.json'),
      JSON.stringify({ ...payload, updatedAt: Date.now() }, null, 2),
      'utf8',
    );
  } catch {
    // ignore
  }

  if (wantsJson(args)) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return health.ready ? 0 : 1;
  }

  const lines = [
    `mode: ${kind} (native status)`,
    `ready: ${health.ready ? 'yes' : 'no'}`,
    `gateway: ${health.gatewayBaseUrl} (${health.gatewayOk ? 'up' : 'down'})`,
    `code-tui: ${health.codePresent ? 'ok' : 'missing'}  bun: ${health.bunOk ? 'ok' : 'missing'}`,
    `providers with env keys: ${providers.configuredCount}`,
    providers.configuredCount
      ? `  ${payload.providers.join(', ')}`
      : '  (none detected — run zavorth setup interactive)',
    localEnvPath
      ? `user-local env: ${localExists ? 'present' : 'absent'} (${localEnvPath})`
      : 'user-local env: (state dir unavailable)',
    '',
    'Next:',
  ];
  for (const s of payload.nextSteps) lines.push(`  ${s}`);
  printPanel(`Zavorth ${kind}`, lines);
  return health.ready ? 0 : 1;
}

/**
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
async function runNativeTrust(rest, opts) {
  const snap = collectTrustSnapshot(opts);
  if (wantsJson(rest)) {
    process.stdout.write(`${JSON.stringify(snap, null, 2)}\n`);
    return 0;
  }
  const lines = [
    `policy authority: ${snap.policyAuthority}`,
    `control: ${snap.controlUrl}`,
    '',
    snap.networkPath
      ? `network trust: ${snap.networkProfile || 'configured'} (private default=${snap.privateNetworkDefault || '?'}${snap.ssrfProtection != null ? `, ssrf=${snap.ssrfProtection}` : ''})`
      : 'network trust: config/network-trust-policy.json missing',
    snap.permissionsPath
      ? `runtime permissions: ${snap.permissionsProfile || 'configured'}`
      : 'runtime permissions: config/runtime-permissions.json missing',
  ];
  if (snap.blockedTotal) {
    lines.push(`blocked (${snap.blockedTotal}): ${snap.blocked.join(', ')}${snap.blockedTotal > snap.blocked.length ? '…' : ''}`);
  }
  if (snap.approvalRequiredTotal) {
    lines.push(
      `require approval (${snap.approvalRequiredTotal}): ${snap.approvalRequired.slice(0, 8).join(', ')}${snap.approvalRequiredTotal > 8 ? '…' : ''}`,
    );
  }
  lines.push('');
  lines.push('Next:');
  for (const step of snap.nextSteps) lines.push(`  ${step}`);
  printPanel('Zavorth trust', lines);
  return 0;
}

/**
 * @param {string[]} rest
 */
function runNativeCapabilities(rest) {
  const clusterFilter = rest[0] && !rest[0].startsWith('-') ? String(rest[0]).toLowerCase() : null;
  const clusters = ['setup-health', 'models-providers', 'channels-memory', 'approvals-trust', 'operator'];
  if (clusterFilter === 'json' || rest.includes('--json')) {
    process.stdout.write(`${JSON.stringify(listCapabilities(), null, 2)}\n`);
    return 0;
  }

  const lines = [];
  for (const cluster of clusters) {
    if (clusterFilter && clusterFilter !== cluster && clusterFilter !== cluster.replace(/-/g, '')) {
      continue;
    }
    lines.push(`[${cluster}]`);
    for (const def of listCapabilitiesByCluster(/** @type {CapabilityCluster} */ (cluster))) {
      const alias = def.aliases && def.aliases.length ? ` (aliases: ${def.aliases.join(', ')})` : '';
      lines.push(`  ${def.command.padEnd(14)} ${def.strategy.padEnd(10)} ${def.summary}${alias}`);
    }
    lines.push('');
  }
  lines.push('Public entry: zavorth → product home; zavorth code → Code TUI; or capability above');
  lines.push('hybrid = bare summary native; positional subcommands → agent runtime');
  lines.push('Delegated rows use the internal agent runtime build when needed.');
  printPanel('Zavorth capabilities', lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')));
  return 0;
}

/**
 * HostPresenceUnit — prefer compiled dist unit; soft native fallback without network.
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<number>}
 */
async function runNativeHost(rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const args = Array.isArray(rest) ? rest : [];
  const pos = args.filter((a) => a && !String(a).startsWith('-')).map((a) => String(a).toLowerCase());
  const action = pos[0] || 'status';
  const dryRun = args.includes('--dry-run');
  const yes = args.includes('--yes') || args.includes('-y');
  const json = wantsJson(args);

  const distUnit = path.join(projectRoot, 'dist', 'host', 'HostPresenceUnit.js');
  if (fs.existsSync(distUnit)) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = require(distUnit);
      const Unit = mod.HostPresenceUnit || (mod.default && mod.default.HostPresenceUnit);
      if (Unit) {
        let stateDbPath = null;
        const homeDb = path.join(projectRoot, 'data', 'zavorth.db');
        if (fs.existsSync(homeDb)) stateDbPath = homeDb;
        const unit = new Unit({
          projectRoot,
          env,
          stateDir: path.join(projectRoot, '.zavorth', 'host-presence'),
          stateDbPath,
          probeGateway: async (baseUrl) => {
            try {
              const surface = await probeGatewaySurface(baseUrl);
              return {
                ok: Boolean(surface.ok),
                summary: surface.ok
                  ? 'gateway reachable'
                  : (surface.health && surface.health.error) || 'gateway down',
              };
            } catch (err) {
              return {
                ok: false,
                summary: err instanceof Error ? err.message : String(err),
              };
            }
          },
        });
        /** @type {{ ok: boolean, action: string, dryRun: boolean, summary: string, snapshot: any }} */
        let result;
        if (action === 'install') {
          result = await unit.install({
            dryRun,
            ensureBinary: !args.includes('--skip-ensure'),
            osService: !args.includes('--no-os-service'),
          });
        } else if (action === 'start') {
          result = await unit.start({ dryRun: dryRun || !yes, yes });
        } else if (action === 'stop') {
          result = await unit.stop({ dryRun: dryRun || !yes, yes });
        } else if (action === 'help') {
          printPanel('Zavorth host', [
            'HostPresenceUnit',
            '  zavorth host install',
            '  zavorth host start --yes',
            '  zavorth host stop --yes',
            '  zavorth host status',
          ]);
          return 0;
        } else {
          result = await unit.status();
        }
        if (json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const lines = [result.summary, ...(result.snapshot && result.snapshot.lines ? result.snapshot.lines : [])];
          printPanel('Zavorth host', lines);
        }
        return result.ok ? 0 : 1;
      }
    } catch (err) {
      process.stderr.write(
        `HostPresenceUnit dist load failed, using soft native status: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }

  // Soft native fallback (no HostPresenceUnit dist): host supervisor + policy + gateway + state file.
  // Code TUI binary is status-only (packaging presence), never the preferred host start command.
  let codeBinary = null;
  try {
    const launch = require('./launch-code-tui.cjs');
    if (typeof launch.resolveCompiledCodeBinary === 'function') {
      codeBinary = launch.resolveCompiledCodeBinary(projectRoot, env);
    }
  } catch {
    codeBinary = null;
  }
  const binaryPresent = Boolean(codeBinary && fs.existsSync(codeBinary));
  const distHost = path.join(projectRoot, 'dist', 'host.js');
  const srcHost = path.join(projectRoot, 'src', 'host.ts');
  const defaultHostCommand = fs.existsSync(distHost)
    ? `${process.execPath} ${JSON.stringify(distHost)}`
    : fs.existsSync(srcHost)
      ? `npx tsx ${JSON.stringify(srcHost)}`
      : null;
  const gatewayBaseUrl = resolveGatewayBaseUrl(env);
  const surface = await probeGatewaySurface(gatewayBaseUrl);
  const statePath = path.join(projectRoot, '.zavorth', 'host-presence', 'host-presence.json');
  /** @type {Record<string, unknown>} */
  let state = {};
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8')) || {};
    } catch {
      state = {};
    }
  }
  const daemonPath = path.join(projectRoot, '.zavorth', 'daemon.json');
  /** @type {Record<string, unknown>} */
  let daemon = {};
  if (fs.existsSync(daemonPath)) {
    try {
      daemon = JSON.parse(fs.readFileSync(daemonPath, 'utf8')) || {};
    } catch {
      daemon = {};
    }
  }
  const goalLoop = (state.goalLoop && typeof state.goalLoop === 'object' ? state.goalLoop : {}) || {};
  const policyAuthority = env.ZAVORTH_POLICY_AUTHORITY || 'gateway';
  const reloadScript = path.join(projectRoot, 'scripts', 'request-supervised-reload.ps1');
  const reloadScriptPresent = fs.existsSync(reloadScript);

  if (action === 'install' && !dryRun) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    // Soft ensure — never hard-fail (Code packaging, optional for host supervisor)
    const ensureScript = path.join(projectRoot, 'scripts', 'ensure-code-runtime.mjs');
    if (fs.existsSync(ensureScript) && !args.includes('--skip-ensure')) {
      spawnSync(process.execPath, [ensureScript], {
        cwd: projectRoot,
        env: { ...env, ZAVORTH_CODE_ENSURE_ONCE: '1' },
        stdio: 'inherit',
        windowsHide: true,
      });
      try {
        const launch = require('./launch-code-tui.cjs');
        codeBinary = launch.resolveCompiledCodeBinary(projectRoot, env);
      } catch {
        /* */
      }
    }
    const next = {
      productName: 'HostPresenceUnit',
      installed: true,
      status: 'installed',
      installedAt: new Date().toISOString(),
      command: state.command || defaultHostCommand,
      pid: state.pid || null,
      goalLoop: state.goalLoop || null,
      lastEnsure: new Date().toISOString(),
    };
    fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    state = next;
  }

  if ((action === 'start' || action === 'stop') && (yes || dryRun)) {
    // Soft path without full HostPresenceUnit dist: prefer dist/host.js (or src/host.ts).
    if (action === 'start' && yes && !dryRun && defaultHostCommand) {
      try {
        const child = spawn(
          defaultHostCommand,
          [],
          {
            cwd: projectRoot,
            env: { ...env },
            shell: true,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          },
        );
        child.unref?.();
        const next = {
          ...state,
          productName: 'HostPresenceUnit',
          installed: true,
          status: 'running',
          command: state.command || defaultHostCommand,
          pid: typeof child.pid === 'number' ? child.pid : null,
          startedAt: new Date().toISOString(),
        };
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        state = next;
      } catch (err) {
        process.stderr.write(
          `Soft host start failed: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
    if (action === 'stop' && yes && !dryRun && state.pid) {
      try {
        process.kill(Number(state.pid));
      } catch {
        /* soft */
      }
      const next = {
        ...state,
        status: 'stopped',
        pid: null,
        stoppedAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      state = next;
    }
  }

  const hostCommand = state.command || defaultHostCommand;
  const payload = {
    productName: 'HostPresenceUnit',
    action,
    installed: Boolean(state.installed),
    status: state.status || (state.installed ? 'installed' : 'not-installed'),
    command: hostCommand,
    binary: {
      present: Boolean(codeBinary && fs.existsSync(codeBinary)),
      path: codeBinary,
      mode: codeBinary && fs.existsSync(codeBinary) ? 'binary' : 'missing',
      bunRequired: !(codeBinary && fs.existsSync(codeBinary)),
    },
    hostSupervisor: {
      distHostPresent: fs.existsSync(distHost),
      path: fs.existsSync(distHost) ? distHost : fs.existsSync(srcHost) ? srcHost : null,
      preferredCommand: defaultHostCommand,
    },
    policyAuthority,
    gateway: {
      baseUrl: gatewayBaseUrl,
      ready: Boolean(surface.ok),
      summary: surface.ok ? 'gateway reachable' : 'gateway down',
    },
    goalLoop: {
      daemonId: goalLoop.daemonId || 'goal-loop-daemon',
      status: goalLoop.status || 'unknown',
      lastHeartbeatAt: goalLoop.lastHeartbeatAt || null,
      source: goalLoop.lastHeartbeatAt ? 'state-file' : 'none',
      heartbeatRecorded: Boolean(goalLoop.lastHeartbeatAt || goalLoop.heartbeatRecorded),
    },
    daemon: {
      installed: Boolean(daemon.installed),
      status: daemon.status || 'not-installed',
      pid: daemon.pid || null,
    },
    supervisor: {
      reloadScriptPresent,
      path: reloadScriptPresent ? reloadScript : null,
    },
    note:
      action === 'start' || action === 'stop'
        ? (fs.existsSync(distUnit)
          ? 'HostPresenceUnit available.'
          : defaultHostCommand
            ? `Soft host path prefers ${defaultHostCommand} (not Code TUI). Full unit: npm run build → dist/host/HostPresenceUnit.js, or zavorth __agent host …`
            : 'Full start/stop needs dist/host.js or dist/host/HostPresenceUnit.js (npm run build) or use: zavorth __agent host …')
        : binaryPresent
          ? 'Prebuilt Code binary present — Bun not required for Code TUI. Host start prefers dist/host.js.'
          : 'No prebuilt Code binary yet — run npm run code:ensure (Bun only for monorepo/dev build). Host start prefers dist/host.js.',
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    printPanel('Zavorth host', [
      `product: HostPresenceUnit`,
      `action: ${action}`,
      `installed: ${payload.installed ? 'yes' : 'no'}`,
      `status: ${payload.status}`,
      `command: ${hostCommand || 'none'}`,
      `host-supervisor: ${payload.hostSupervisor.distHostPresent ? 'dist/host.js' : (payload.hostSupervisor.path || 'missing')}`,
      `binary: ${payload.binary.present ? 'yes' : 'no'} (${payload.binary.mode})`,
      `bun-required: ${payload.binary.bunRequired ? 'yes' : 'no'}`,
      `policy-authority: ${payload.policyAuthority}`,
      `gateway: ${payload.gateway.baseUrl} (${payload.gateway.ready ? 'ready' : 'down'})`,
      `goal-loop: ${payload.goalLoop.status} heartbeat=${payload.goalLoop.lastHeartbeatAt || 'none'}`,
      `daemon: ${payload.daemon.status} pid=${payload.daemon.pid || 'none'}`,
      `supervisor-reload: ${reloadScriptPresent ? 'present' : 'missing'}`,
      payload.note,
    ]);
  }

  if (action === 'help') return 0;
  if (action === 'start' || action === 'stop') {
    if (!fs.existsSync(distUnit) && !defaultHostCommand && action === 'start' && yes && !dryRun) return 1;
  }
  return 0;
}

/**
 * @param {CapabilityDef} def
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, exit?: boolean }} [opts]
 * @returns {Promise<number>}
 */
/** Trust Loop commands that must never fall through to LLM chat or Code TUI. */
const TRUST_LOOP_COMMANDS = new Set([
  'proof',
  'proof-ledger',
  'proof-os', // backward-compatible CLI alias
  'trust-loop',
  'memory-privacy',
  'memory-privacy-os',
  'privacy-memory',
  'absorb',
  'capability-absorb',
  'capabilities-absorb',
  'fetch-capability',
  'import-workspace',
  'workspace-import',
  'universal-import',
  'risk-budget',
  'riskbudget',
  'change-preview',
  'preview-change',
  'what-changes',
  'approval',
  'approval-presentation',
  'approval-os',
]);

/**
 * Prefer src CLI via tsx when dist is stale/missing Trust Loop handlers.
 * Falls back to dist agent runtime.
 * @param {string} command
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, exit?: boolean }} [opts]
 * @returns {number}
 */
function runTrustLoopCli(command, rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const shouldExit = !opts || opts.exit !== false;
  const args = [command, ...(Array.isArray(rest) ? rest : [])];

  const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const tsEntry = path.join(projectRoot, 'src', 'zavorth-cli.ts');
  const distCli = path.join(projectRoot, 'dist', 'zavorth-cli.js');

  /** @type {{ file: string, argv: string[] } | null} */
  let launch = null;
  if (fs.existsSync(tsxCli) && fs.existsSync(tsEntry)) {
    launch = { file: process.execPath, argv: [tsxCli, tsEntry, ...args] };
  } else if (fs.existsSync(distCli)) {
    launch = { file: process.execPath, argv: [distCli, ...args] };
  }

  if (!launch) {
    process.stderr.write(
      'Trust Loop CLI unavailable (need node_modules/tsx + src/zavorth-cli.ts, or dist/zavorth-cli.js).\n',
    );
    if (shouldExit) process.exit(1);
    return 1;
  }

  const result = spawnSync(launch.file, launch.argv, {
    cwd: process.cwd(),
    env: {
      ...env,
      ZAVORTH_PUBLIC_CLI: '1',
      ZAVORTH_CAPABILITY_DELEGATED: command,
    },
    stdio: 'inherit',
    windowsHide: false,
  });
  const code = result && typeof result.status === 'number' ? result.status : 1;
  if (shouldExit) process.exit(code);
  return code;
}

async function runDelegated(def, rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const shouldExit = !opts || opts.exit !== false;
  const notice = env.ZAVORTH_CAPABILITY_NOTICE === '1' || env.ZAVORTH_CAPABILITY_NOTICE === 'true';

  // Trust Loop: always run dedicated CLI (tsx/src preferred over stale dist).
  if (TRUST_LOOP_COMMANDS.has(def.command) || TRUST_LOOP_COMMANDS.has(String(def.command || '').toLowerCase())) {
    if (notice) process.stderr.write(`[capability] ${def.command} → trust-loop cli\n`);
    return runTrustLoopCli(def.command, rest, opts);
  }

  if (notice) process.stderr.write(`[capability] ${def.command} → agent runtime\n`);
  const { launchAgentRuntime } = require('./launch-agent-runtime.cjs');
  const ret = launchAgentRuntime([def.command, ...rest], {
    projectRoot,
    env: {
      ...env,
      ZAVORTH_PUBLIC_CLI: '1',
      ZAVORTH_CAPABILITY_DELEGATED: def.command,
      ZAVORTH_AGENT_RUNTIME: '1',
    },
    exit: shouldExit,
  });
  if (ret && typeof ret.status === 'number') return ret.status;
  return 0;
}

/**
 * Run a product capability. Native returns exit code; delegated may process.exit.
 * @param {CapabilityDef} def
 * @param {string[]} rest
 * @param {{ projectRoot?: string, env?: NodeJS.ProcessEnv, exit?: boolean }} [opts]
 * @returns {Promise<number>}
 */
async function executeCapability(def, rest, opts) {
  const projectRoot = path.resolve((opts && opts.projectRoot) || defaultProjectRoot());
  const env = (opts && opts.env) || process.env;
  const shouldExit = !opts || opts.exit !== false;
  const notice = env.ZAVORTH_CAPABILITY_NOTICE === '1' || env.ZAVORTH_CAPABILITY_NOTICE === 'true';

  const useNative =
    def.strategy === 'native' ||
    (def.strategy === 'hybrid' && wantsNativeForCommand(def, rest));

  if (useNative) {
    if (notice) process.stderr.write(`[capability] ${def.command} (native${def.strategy === 'hybrid' ? '/hybrid' : ''})\n`);
    let code = 1;
    if (def.command === 'status') code = await runNativeStatus({ projectRoot, env });
    else if (def.command === 'home') code = await runNativeHome({ projectRoot, env });
    else if (def.command === 'doctor') code = await runNativeDoctor({ projectRoot, env });
    else if (def.command === 'host') code = await runNativeHost(rest, { projectRoot, env });
    else if (def.command === 'open') code = await runNativeOpen(rest, { projectRoot, env });
    else if (def.command === 'capabilities') code = runNativeCapabilities(rest);
    else if (def.command === 'inspect' || def.command === 'diagnostics') {
      code = await runNativeInspect(rest, { projectRoot, env });
    } else if (def.command === 'providers') code = await runNativeProviders(rest, { projectRoot, env });
    else if (def.command === 'models') code = await runNativeModels(rest, { projectRoot, env });
    else if (def.command === 'channels') code = await runNativeChannels(rest, { projectRoot, env });
    else if (def.command === 'approve') code = await runNativeApprove(rest, { projectRoot, env });
    else if (def.command === 'trust') code = await runNativeTrust(rest, { projectRoot, env });
    else if (def.command === 'setup' || def.command === 'onboard' || def.command === 'quickstart') {
      code = await runNativeSetup(def.command, rest, { projectRoot, env });
    } else process.stderr.write(`Unknown native capability: ${def.command}\n`);
    if (shouldExit) process.exit(code);
    return code;
  }

  if (def.strategy === 'delegated' || def.strategy === 'hybrid') {
    return runDelegated(def, rest, opts);
  }

  process.stderr.write(`Capability ${def.command} is not runnable here.\n`);
  if (shouldExit) process.exit(1);
  return 1;
}

module.exports = {
  CAPABILITY_DEFS,
  CODING_OWNED,
  PROVIDER_CATALOG,
  SETUP_LOCAL_ENV_BASENAME,
  SETUP_PREFERENCE_BASENAME,
  resolveCapability,
  wantsNativeSummary,
  listCapabilities,
  listCapabilitiesByCluster,
  collectHealthSnapshot,
  collectProvidersSnapshot,
  collectModelsSnapshot,
  collectChannelsSnapshot,
  collectApprovalsSnapshot,
  collectTrustSnapshot,
  collectRoutingPosture,
  probeGatewaySurface,
  wantsNativeForCommand,
  resolveStateDir,
  setupLocalEnvPath,
  setupPreferencePath,
  writeSetupLocalEnvKey,
  readEnvFileSilent,
  readProductVersion,
  printProductVersion,
  printProductHelp,
  runNativeSetupApply,
  runNativeSetupToken,
  runNativeInspect,
  runNativeStatus,
  runNativeHome,
  runNativeDoctor,
  runNativeHost,
  runNativeOpen,
  runNativeProviders,
  runNativeModels,
  runNativeChannels,
  runNativeApprove,
  runNativeTrust,
  runNativeSetup,
  runNativeCapabilities,
  executeCapability,
  resolveGatewayBaseUrl,
};
