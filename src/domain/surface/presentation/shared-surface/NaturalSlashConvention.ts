/**
 * Natural Slash Convention — universal UX for ALL shared-surface commands.
 *
 * Rules (existing + future):
 * 1) Empty `/command` → home/status (never require the user to type "run").
 * 2) Free text after `/command` → primary action with that text as payload
 *    (never require `/command run <text>` unless the user wants the power verb).
 * 3) Known control verbs stay explicit (status, apply, list, help, …).
 * 4) Flags (`--x`) always preserved for power users.
 * 5) Future commands: register a policy OR inherit the safe default policy.
 *
 * Packs keep their internal verb handlers; this layer rewrites user input
 * into the structured form packs already understand.
 */

export type NaturalSlashFreeTextMode =
  /** Leave free text as-is (pack already treats it as primary payload). */
  | 'passthrough'
  /** Prefix a power verb: free "foo" → "run foo". */
  | { kind: 'prefix'; verb: string }
  /** Custom rewrite. */
  | { kind: 'custom'; rewrite: (raw: string, lower: string) => string };

export type NaturalSlashPolicy = {
  /** Empty args become this (e.g. "status"). Empty string = leave empty. */
  emptyRewrite?: string;
  /**
   * First-token control verbs. If present, args are not rewritten as free-text primary.
   * Multi-word starts also supported via multiWordControlPrefixes.
   */
  controlVerbs?: string[];
  /** e.g. "strict on", "allow-app", "mcp doctor" */
  multiWordControlPrefixes?: string[];
  freeText?: NaturalSlashFreeTextMode;
  /**
   * Natural-language aliases for control verbs.
   * e.g. { 'mostrar': 'status', 'ajuda': 'help' }
   */
  controlAliases?: Record<string, string>;
};

const GLOBAL_CONTROL_ALIASES: Record<string, string> = {
  help: 'help',
  ajuda: 'help',
  '?': 'help',
  status: 'status',
  show: 'status',
  open: 'status',
  ver: 'status',
  mostrar: 'status',
  list: 'list',
  listar: 'list',
  ls: 'list',
  preview: 'preview',
  previsualizar: 'preview',
};

/** Default for any unregistered / future command. */
export const DEFAULT_NATURAL_SLASH_POLICY: NaturalSlashPolicy = {
  emptyRewrite: '',
  controlVerbs: [
    'help', 'status', 'show', 'open', 'list', 'ls', 'preview',
    'apply', 'run', 'start', 'stop', 'cancel', 'create', 'delete',
    'add', 'remove', 'set', 'get', 'doctor', 'sync', 'enable', 'disable',
  ],
  freeText: 'passthrough',
  controlAliases: GLOBAL_CONTROL_ALIASES,
};

/**
 * Per-command policies. Prefer registering new commands here.
 * Unlisted commands still get DEFAULT_NATURAL_SLASH_POLICY (future-safe).
 */
export const NATURAL_SLASH_POLICIES: Record<string, NaturalSlashPolicy> = {
  '/help': { emptyRewrite: '', freeText: 'passthrough' },
  '/commands': { emptyRewrite: '', freeText: 'passthrough' },
  '/status': { emptyRewrite: '', freeText: 'passthrough' },
  '/changes': { emptyRewrite: '', freeText: 'passthrough' },
  '/reload': { emptyRewrite: '', freeText: 'passthrough' },
  '/selfupdate': { emptyRewrite: 'status', freeText: 'passthrough', controlVerbs: ['status', 'apply', 'preview', 'help'] },
  '/autorepair': { emptyRewrite: 'status', freeText: 'passthrough', controlVerbs: ['status', 'apply', 'preview', 'run', 'help'] },

  '/task': {
    emptyRewrite: '',
    controlVerbs: ['status', 'list', 'cancel', 'approve', 'reject', 'help'],
    freeText: 'passthrough', // free text IS the task
  },
  '/auto': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'on', 'off', 'enable', 'disable', 'help'],
    freeText: 'passthrough',
  },
  '/plan': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'show', 'apply', 'create', 'list', 'help'],
    freeText: 'passthrough',
  },
  '/workflow': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'run', 'apply', 'help'],
    freeText: { kind: 'prefix', verb: 'run' },
  },
  '/dryrun': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/models': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/model': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'usage', 'clear', 'help', 'list'],
    freeText: 'passthrough', // free text = model name
  },
  '/export': {
    emptyRewrite: 'markdown',
    controlVerbs: ['markdown', 'html', 'prompt', 'help', 'status'],
    freeText: 'passthrough',
  },
  '/consensus': {
    // Already naturalized in ConsensusSurface — leave passthrough
    emptyRewrite: '',
    controlVerbs: ['help', 'preview', 'status', 'home', 'run', 'save-profile', 'save_profile', 'profile-save'],
    freeText: 'passthrough',
  },
  '/learn-skill': {
    emptyRewrite: '',
    controlVerbs: ['help', 'apply', 'preview'],
    freeText: 'passthrough', // free text = source
    multiWordControlPrefixes: ['apply '],
  },
  '/skills': {
    emptyRewrite: '',
    controlVerbs: [
      'library', 'bridge', 'run', 'live', 'origin', 'plan', 'recipe',
      'recommend', 'mcp', 'list', 'help', 'search', 'id',
    ],
    freeText: { kind: 'prefix', verb: 'recommend' }, // natural goal → recommend
  },
  '/learning': {
    emptyRewrite: '',
    controlVerbs: [
      'approve', 'reject', 'promote', 'forget', 'promote-skill',
      'promote-procedure', 'candidates', 'status', 'help',
    ],
    freeText: 'passthrough',
  },
  '/memory': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'search', 'list', 'help', 'add', 'forget'],
    freeText: { kind: 'prefix', verb: 'search' },
  },
  '/memoryplane': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'help'],
    freeText: 'passthrough',
  },
  '/hub': {
    emptyRewrite: '',
    controlVerbs: ['status', 'show', 'open', 'sync', 'doctor', 'run', 'recommend', 'help', 'list'],
    multiWordControlPrefixes: ['mcp doctor', 'mcp-doctor', 'run ', 'recommend '],
    freeText: {
      kind: 'custom',
      rewrite: (raw, lower) => {
        // Single action-id token → run <id>
        if (/^[a-z0-9][a-z0-9._-]*$/i.test(raw.trim())) {
          return `run ${raw.trim()}`;
        }
        // Multi-word natural → recommend
        if (raw.trim().split(/\s+/).length > 1) {
          return `recommend ${raw.trim()}`;
        }
        return raw;
      },
    },
  },
  '/automations': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'show', 'open', 'apply', 'list', 'help'],
    multiWordControlPrefixes: ['apply '],
    freeText: 'passthrough',
  },
  '/schedule': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'help', 'every'],
    multiWordControlPrefixes: ['every '],
    freeText: 'passthrough',
  },
  '/schedules': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'help'],
    freeText: 'passthrough',
  },
  '/unschedule': {
    emptyRewrite: '',
    freeText: 'passthrough', // free text = id
  },
  '/report': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'help', 'every'],
    multiWordControlPrefixes: ['every '],
    freeText: 'passthrough',
  },
  '/watchmode': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'show', 'open', 'apply', 'help', 'strict'],
    multiWordControlPrefixes: [
      'apply ',
      'strict on',
      'strict off',
      'strict true',
      'strict false',
      'allow-app ',
      'allow-site ',
    ],
    freeText: {
      kind: 'custom',
      rewrite: (raw) => {
        const trimmed = raw.trim();
        const lower = trimmed.toLowerCase();
        // Natural aliases → structured allow-* verbs
        const allowApp = trimmed.match(/^(?:allow\s+app|permitir\s+app|liberar\s+app|allow-app)\s+(.+)$/i);
        if (allowApp) return `allow-app ${allowApp[1].trim()}`;
        const allowSite = trimmed.match(/^(?:allow\s+site|permitir\s+site|liberar\s+site|allow-site)\s+(.+)$/i);
        if (allowSite) return `allow-site ${allowSite[1].trim()}`;
        // Incomplete verbs left for pack usage guidance
        if (
          lower === 'allow-app'
          || lower === 'allow-site'
          || lower === 'allow app'
          || lower === 'allow site'
        ) {
          return lower.startsWith('allow site') || lower === 'allow-site' ? 'allow-site' : 'allow-app';
        }
        // Host-like free text → allow-site; otherwise window name → allow-app
        if (/^https?:\/\//i.test(trimmed) || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/\S*)?$/i.test(trimmed)) {
          return `allow-site ${trimmed}`;
        }
        return `allow-app ${trimmed}`;
      },
    },
  },
  '/codexremote': {
    emptyRewrite: 'status',
    // Keep every pack head-token here so free prompts do not swallow control verbs
    controlVerbs: [
      'status', 'help', 'summary', 'resumo',
      'start', 'run', 'iniciar',
      'stop', 'parar',
      'profile', 'perfil', 'profiles', 'perfis',
      'list', 'listar', 'sessions', 'sessoes',
      'approvals', 'approval', 'permissoes', 'aprovacoes',
      'approve', 'aprovar', 'reject', 'rejeitar',
      'inspect', 'show', 'tail', 'logs',
      'resume', 'retomar',
      'web', 'attach',
    ],
    multiWordControlPrefixes: ['profile ', 'perfil ', 'start ', 'run ', 'iniciar '],
    freeText: {
      kind: 'custom',
      rewrite: (raw) => {
        // Natural prompt without "start" → start -- <prompt>
        if (raw.includes(' -- ')) return raw.startsWith('start') ? raw : `start -- ${raw}`;
        return `start -- ${raw}`;
      },
    },
  },
  '/sessionsend': {
    emptyRewrite: '',
    freeText: {
      kind: 'custom',
      rewrite: (raw) => {
        // "sessionId message..." → "sessionId -- message" if no --
        if (raw.includes(' -- ')) return raw;
        const parts = raw.trim().split(/\s+/);
        if (parts.length < 2) return raw;
        return `${parts[0]} -- ${parts.slice(1).join(' ')}`;
      },
    },
  },
  '/sessionspawn': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/sessions': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'help'],
    freeText: 'passthrough',
  },
  '/sessionhistory': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/nodes': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'help', 'pair', 'invoke'],
    freeText: 'passthrough',
  },
  '/nodepair': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/nodeinvoke': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/enable': {
    emptyRewrite: '',
    freeText: 'passthrough', // free text = capability
  },
  '/disable': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/mode': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/workspace': {
    emptyRewrite: 'doctor',
    controlVerbs: ['doctor', 'optimize', 'status', 'help', 'apply'],
    multiWordControlPrefixes: ['optimize '],
    freeText: {
      kind: 'custom',
      rewrite: (raw) => {
        const trimmed = raw.trim();
        const tokens = trimmed.split(/\s+/).filter(Boolean);
        const first = String(tokens[0] || '').toLowerCase();
        // Bare preset id → optimize <preset> (primary action)
        let normalizedPreset: string | null = null;
        if (first === 'zavorthbridge' || first === 'zavorth-bridge') {
          normalizedPreset = 'zavorthBridge';
        } else if (first === 'vscode') {
          normalizedPreset = 'vscode';
        } else if (first === 'vscode-derivative') {
          normalizedPreset = 'vscode-derivative';
        }
        if (normalizedPreset) {
          const after = tokens.slice(1).join(' ').trim();
          return after ? `optimize ${normalizedPreset} ${after}` : `optimize ${normalizedPreset}`;
        }
        return trimmed;
      },
    },
  },
  '/plugins': {
    emptyRewrite: 'list',
    controlVerbs: ['list', 'status', 'install', 'remove', 'help', 'search'],
    freeText: { kind: 'prefix', verb: 'search' },
  },
  '/integrations': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'connect', 'help'],
    freeText: 'passthrough',
  },
  '/connect': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/channels': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'list', 'help'],
    freeText: 'passthrough',
  },
  '/transports': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/gateway': {
    emptyRewrite: 'status',
    controlVerbs: ['status', 'doctor', 'help', 'list'],
    freeText: 'passthrough',
  },
  '/tools': {
    emptyRewrite: 'list',
    controlVerbs: ['list', 'help', 'search'],
    freeText: { kind: 'prefix', verb: 'search' },
  },
  '/capabilities': {
    emptyRewrite: 'list',
    controlVerbs: ['list', 'help', 'route'],
    freeText: { kind: 'prefix', verb: 'route' },
  },
  '/agents': {
    emptyRewrite: 'list',
    controlVerbs: ['list', 'register', 'remove', 'discover', 'help'],
    freeText: { kind: 'prefix', verb: 'discover' },
  },
  '/vision': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/computer': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/device': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/invoke': {
    emptyRewrite: '',
    freeText: 'passthrough',
  },
  '/hooks': {
    emptyRewrite: 'list',
    freeText: 'passthrough',
  },
  '/runtime': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/trust': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/access': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/bootstrap': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/platform': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/AIGateway': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/aigateway': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/agmobile': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/evals': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/qa': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/governance': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/replayloop': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/ecosystem': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/fleet': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/stability': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/rolloutqa': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/setupagent': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/teams': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
  '/tenants': {
    emptyRewrite: 'status',
    freeText: 'passthrough',
  },
};

export function getNaturalSlashPolicy(commandType: string): NaturalSlashPolicy {
  const key = String(commandType || '').trim().toLowerCase();
  // Preserve case-sensitive entries like /AIGateway via direct + lower lookup
  return (
    NATURAL_SLASH_POLICIES[commandType]
    || NATURAL_SLASH_POLICIES[key]
    || NATURAL_SLASH_POLICIES[`/${key.replace(/^\//, '')}`]
    || DEFAULT_NATURAL_SLASH_POLICY
  );
}

/**
 * Rewrite user args into the structured form packs understand.
 * Idempotent for already-structured power-user input.
 */
export function naturalizeSharedSurfaceArgs(
  commandType: string,
  rawArgs: string,
): { args: string; rewritten: boolean; reason: string } {
  const original = String(rawArgs ?? '');
  const trimmed = original.trim();
  const policy = getNaturalSlashPolicy(commandType);
  const controlVerbs = new Set(
    (policy.controlVerbs || DEFAULT_NATURAL_SLASH_POLICY.controlVerbs || [])
      .map((v) => v.toLowerCase()),
  );
  const aliases = {
    ...GLOBAL_CONTROL_ALIASES,
    ...(DEFAULT_NATURAL_SLASH_POLICY.controlAliases || {}),
    ...(policy.controlAliases || {}),
  };

  if (!trimmed) {
    const empty = policy.emptyRewrite ?? '';
    if (empty && empty !== trimmed) {
      return { args: empty, rewritten: true, reason: 'empty→home/status' };
    }
    return { args: '', rewritten: false, reason: 'empty' };
  }

  // Power flags alone or leading: leave as-is
  if (trimmed.startsWith('-')) {
    return { args: trimmed, rewritten: false, reason: 'flags' };
  }

  const lower = trimmed.toLowerCase();
  const firstToken = lower.split(/\s+/)[0] || '';

  // Alias first token → control verb
  const aliasTarget = aliases[firstToken];
  if (aliasTarget && aliasTarget !== firstToken) {
    const rest = trimmed.slice(firstToken.length).trim();
    const rewritten = rest ? `${aliasTarget} ${rest}` : aliasTarget;
    return { args: rewritten, rewritten: true, reason: `alias:${firstToken}→${aliasTarget}` };
  }

  // Multi-word control prefixes
  for (const prefix of policy.multiWordControlPrefixes || []) {
    if (lower.startsWith(prefix.toLowerCase())) {
      return { args: trimmed, rewritten: false, reason: 'multi-word-control' };
    }
  }

  // Explicit control verb
  if (controlVerbs.has(firstToken)) {
    return { args: trimmed, rewritten: false, reason: 'control-verb' };
  }

  // Free text → primary action
  const free = policy.freeText ?? 'passthrough';
  if (free === 'passthrough') {
    return { args: trimmed, rewritten: false, reason: 'passthrough-primary' };
  }
  if (free.kind === 'prefix') {
    const verb = free.verb.trim();
    // Avoid double-prefix if already starts with verb
    if (lower.startsWith(`${verb.toLowerCase()} `) || lower === verb.toLowerCase()) {
      return { args: trimmed, rewritten: false, reason: 'already-prefixed' };
    }
    return {
      args: `${verb} ${trimmed}`,
      rewritten: true,
      reason: `free-text→${verb}`,
    };
  }
  if (free.kind === 'custom') {
    const next = free.rewrite(trimmed, lower);
    return {
      args: next,
      rewritten: next !== trimmed,
      reason: 'custom-free-text',
    };
  }

  return { args: trimmed, rewritten: false, reason: 'default' };
}

/**
 * Register or override a policy (for tests / plugins / future packs).
 */
export function registerNaturalSlashPolicy(
  commandType: string,
  policy: NaturalSlashPolicy,
): void {
  const key = String(commandType || '').trim();
  if (!key.startsWith('/')) {
    NATURAL_SLASH_POLICIES[`/${key}`] = policy;
  }
  NATURAL_SLASH_POLICIES[key] = policy;
}

/**
 * Human-readable convention blurb for /help and AGENTS.md.
 */
export function formatNaturalSlashConventionHelp(): string {
  return [
    'Natural commands (all surfaces)',
    '',
    '  /command',
    '      → home / status (no need to type run)',
    '  /command <your request in plain language>',
    '      → does the main action with that text',
    '  /command status|list|help|…',
    '      → explicit control verbs still work',
    '  /command … --flag',
    '      → power-user flags still work',
    '',
    'You should almost never need: /command run X --Y',
    'for everyday use. That form remains optional.',
  ].join('\n');
}
