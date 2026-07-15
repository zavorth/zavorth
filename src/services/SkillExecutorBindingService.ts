/**
 * Bind skill-declared tool names to real executors.
 *
 * Resolution order:
 * 1) direct name on ToolRegistry (or known native catalog)
 * 2) canonical alias map (skill jargon → registry name)
 * 3) gateway fallbacks (zavorth_action / plugin_suggest)
 * 4) unresolved (never teach the model a phantom name)
 */

import type {
  ZavorthDeclaredSkillTool,
  ZavorthSkillToolBinding,
} from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { getDynamicIntentToolMap, setDynamicIntentToolMap } from '../cognitive-firewall/ToolGatekeeper.js';
import type { SkillToolRegistryLike } from './SkillToolRegistryBridge.js';

/**
 * Skill-declared names that map to real registry tools.
 * Generic families only — expand carefully to avoid wrong binds.
 */
export const SKILL_TOOL_ALIASES: Record<string, string> = {
  // sandbox / code
  sandbox_execution: 'run_sandbox_code',
  run_sandbox: 'run_sandbox_code',
  sandbox_run: 'run_sandbox_code',
  execute_code: 'run_sandbox_code',
  // web / search
  search_query: 'web_search',
  websearch: 'web_search',
  web_search_query: 'web_search',
  internet_search: 'web_search',
  search_web: 'web_search',
  // filesystem
  file_system_advanced: 'zavorth_file_system_advanced',
  filesystem_advanced: 'zavorth_file_system_advanced',
  fs_read: 'read_file',
  file_read: 'read_file',
  readfile: 'read_file',
  list_dir: 'list_directory',
  listdir: 'list_directory',
  list_files: 'list_directory',
  write_file: 'create_file',
  file_write: 'create_file',
  createfile: 'create_file',
  // browser
  browser_automation: 'zavorth_browser_automation',
  browser_cdp: 'browser_cdp_control',
  browse: 'zavorth_browser_automation',
  open_page: 'zavorth_browser_automation',
  // memory / session
  memory_get: 'semantic_memory',
  memory_search: 'semantic_memory',
  memory_query: 'semantic_memory',
  recall: 'semantic_memory',
  session_search: 'zavorth_session_search',
  search_session: 'zavorth_session_search',
  // marketplace / plugins / actions
  skill_marketplace: 'zavorth_skill_marketplace',
  mcp_marketplace: 'zavorth_mcp_marketplace',
  plugin_search: 'plugin_suggest',
  suggest_plugin: 'plugin_suggest',
  recommend_plugin: 'plugin_recommend',
  // shell / host (gateway-lean; prefer remote_shell when present)
  shell_exec: 'remote_shell',
  run_shell: 'remote_shell',
  bash: 'remote_shell',
  // datetime
  datetime: 'get_datetime',
  current_time: 'get_datetime',
  now: 'get_datetime',
};

/** Observation-only tools safe for optional post-bind smoke existence check. */
export const OBSERVATION_SMOKE_TOOLS = new Set([
  'get_datetime',
  'read_file',
  'list_directory',
  'web_search',
  'plugin_suggest',
  'plugin_recommend',
  'zavorth_action',
  'semantic_memory',
]);

export const GATEWAY_FALLBACK_TOOLS = ['zavorth_action', 'plugin_suggest', 'plugin_recommend'] as const;

/**
 * First-party tool names known without a live registry (install path offline).
 * Soft catalog — not a substitute for live registry when present.
 */
export const KNOWN_NATIVE_TOOL_NAMES: readonly string[] = [
  'read_file',
  'create_file',
  'list_directory',
  'get_datetime',
  'web_search',
  'run_sandbox_code',
  'remote_shell',
  'configure_llm_profile',
  'semantic_memory',
  'plugin_suggest',
  'plugin_recommend',
  'zavorth_action',
  'zavorth_skill_marketplace',
  'zavorth_delegate',
  'zavorth_session_search',
  'zavorth_file_system_advanced',
  'zavorth_browser_automation',
  'browser_cdp_control',
  'agent_manager',
  'desktop_automation',
  'query_external_ai',
  'send_email',
  'database_query',
  'kanban_board',
  'session_search',
];

export type SkillExecutorBindingOptions = {
  registry?: SkillToolRegistryLike | null;
  /** When true and no registry, use KNOWN_NATIVE_TOOL_NAMES. Default true. */
  useKnownCatalog?: boolean;
  aliasMap?: Record<string, string>;
  gatewayFallbacks?: string[];
  /** skill id for process-local bind cache key. */
  skillId?: string | null;
  /** set false to skip hot-path bind cache. Default true. */
  useBindCache?: boolean;
};

export type SkillExecutorBindingReport = {
  ok: boolean;
  bindings: ZavorthSkillToolBinding[];
  direct: string[];
  aliased: string[];
  gateway: string[];
  unresolved: string[];
  /** Resolved names safe to put in firewall / model context */
  resolvedToolNames: string[];
  smoke: {
    ran: boolean;
    ok: boolean | null;
    detail: string | null;
    checked: string[];
  };
  /** true when served from process-local bind cache. */
  cacheHit?: boolean;
  formatText(): string;
};

export function resolveSkillToolName(
  declared: string,
  options: SkillExecutorBindingOptions = {},
): ZavorthSkillToolBinding {
  const name = String(declared || '').trim();
  if (!name) {
    return {
      declaredName: '',
      resolvedName: null,
      status: 'unresolved',
      note: 'empty tool name',
      guidanceOnly: true,
    };
  }

  const known = collectKnownNames(options);
  const aliases = options.aliasMap || SKILL_TOOL_ALIASES;
  const gateways = (options.gatewayFallbacks || [...GATEWAY_FALLBACK_TOOLS]).filter((g) =>
    known.size === 0 ? true : known.has(g),
  );

  if (known.has(name)) {
    return {
      declaredName: name,
      resolvedName: name,
      status: 'direct',
      note: 'registry/catalog hit',
      guidanceOnly: false,
    };
  }

  const aliasTarget = aliases[name] || aliases[name.toLowerCase()];
  if (aliasTarget && (known.size === 0 || known.has(aliasTarget))) {
    return {
      declaredName: name,
      resolvedName: aliasTarget,
      status: 'aliased',
      note: `alias → ${aliasTarget}`,
      guidanceOnly: false,
    };
  }

  // Prefer first available gateway
  for (const g of gateways) {
    if (known.size === 0 || known.has(g)) {
      return {
        declaredName: name,
        resolvedName: g,
        status: 'gateway',
        note: `no direct executor; route via ${g}`,
        guidanceOnly: false,
      };
    }
  }

  return {
    declaredName: name,
    resolvedName: null,
    status: 'unresolved',
    note: 'guidance-only: no executor or gateway available',
    guidanceOnly: true,
  };
}

/**
 * Merge pack-declared aliases into the default alias table.
 * `declaredAliases`: declared tool name → synonym list (or reverse synonyms).
 */
export function mergeAliasMaps(
  base: Record<string, string>,
  declaredAliases?: Record<string, string[]> | null,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  if (!declaredAliases) return out;
  for (const [from, tos] of Object.entries(declaredAliases)) {
    const key = String(from || '').trim();
    if (!key || !Array.isArray(tos) || !tos.length) continue;
    // Prefer first synonym as target when `from` is the declared name
    const target = String(tos[0] || '').trim();
    if (target) {
      out[key] = target;
      out[key.toLowerCase()] = target;
    }
    // Also map each synonym → first resolved preference among base aliases
    for (const syn of tos) {
      const s = String(syn || '').trim();
      if (!s) continue;
      if (!out[s] && !out[s.toLowerCase()]) {
        // synonym points at declared name; resolution will hit alias of declared
        out[s] = out[key] || key;
        out[s.toLowerCase()] = out[key] || key;
      }
    }
  }
  return out;
}

export function bindSkillDeclaredTools(
  declared: Array<string | ZavorthDeclaredSkillTool>,
  options: SkillExecutorBindingOptions = {},
): SkillExecutorBindingReport {
  const names = declared.map((d) => (typeof d === 'string' ? d : String(d?.name || '').trim())).filter(Boolean);

  const runBind = (): SkillExecutorBindingReport => {
    const bindings = names.map((n) => resolveSkillToolName(n, options));
    const direct: string[] = [];
    const aliased: string[] = [];
    const gateway: string[] = [];
    const unresolved: string[] = [];
    const resolvedToolNames: string[] = [];

    for (const b of bindings) {
      if (b.status === 'direct' && b.resolvedName) {
        direct.push(b.resolvedName);
        resolvedToolNames.push(b.resolvedName);
      } else if (b.status === 'aliased' && b.resolvedName) {
        aliased.push(`${b.declaredName}→${b.resolvedName}`);
        resolvedToolNames.push(b.resolvedName);
      } else if (b.status === 'gateway' && b.resolvedName) {
        gateway.push(`${b.declaredName}→${b.resolvedName}`);
        resolvedToolNames.push(b.resolvedName);
      } else {
        unresolved.push(b.declaredName);
      }
    }

    const uniqueResolved = Array.from(new Set(resolvedToolNames));
    const smoke = runObservationSmoke(uniqueResolved, options);

    return {
      ok: unresolved.length === 0 || uniqueResolved.length > 0,
      bindings,
      direct: Array.from(new Set(direct)).sort(),
      aliased: aliased.sort(),
      gateway: gateway.sort(),
      unresolved: unresolved.sort(),
      resolvedToolNames: uniqueResolved.sort(),
      smoke,
      cacheHit: false,
      formatText() {
        return [
          'Skill executor binding ',
          `direct=${this.direct.length} aliased=${this.aliased.length} gateway=${this.gateway.length} unresolved=${this.unresolved.length}`,
          this.cacheHit ? '  cache: hit' : '',
          this.direct.length ? `  direct: ${this.direct.join(', ')}` : '',
          this.aliased.length ? `  aliased: ${this.aliased.join(', ')}` : '',
          this.gateway.length ? `  gateway: ${this.gateway.join(', ')}` : '',
          this.unresolved.length ? `  unresolved (guidance-only): ${this.unresolved.join(', ')}` : '  unresolved: none',
          this.smoke.ran ? `  smoke: ok=${this.smoke.ok} ${this.smoke.detail || ''}` : '  smoke: skipped',
        ]
          .filter(Boolean)
          .join('\n');
      },
    };
  };

  // process-local bind cache (skip when registry present — live registry may change)
  if (options.useBindCache !== false && !options.registry) {
    try {
      const { getSkillHotPathCache, SkillHotPathCacheService } =
        require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
      const cache = getSkillHotPathCache();
      if (cache.isEnabled()) {
        const key = SkillHotPathCacheService.buildBindCacheKey({
          skillId: options.skillId,
          declaredTools: names,
        });
        const cached = cache.getOrBind(key, runBind);
        return cached;
      }
    } catch {
      /* soft */
    }
  }

  return runBind();
}

/** Human table for CLI / agent tool install receipts. */
export function formatToolBindsTable(bindings: ZavorthSkillToolBinding[]): string {
  if (!bindings.length) return '  (no declared tools)';
  const rows = bindings.map((b) => {
    const res = b.resolvedName || '—';
    const guide = b.guidanceOnly || b.status === 'unresolved' ? ' yes' : ' no';
    return `  ${b.declaredName.padEnd(24)} ${b.status.padEnd(12)} ${res.padEnd(28)} ${guide}`;
  });
  return [
    '  declared                 status       resolved                     guidanceOnly',
    '  ------------------------ ------------ ---------------------------- ------------',
    ...rows,
  ].join('\n');
}

/**
 * Reconcile firewall intent map: resolve aliases, drop pure phantoms, keep resolved executors.
 */
export function reconcileSkillToolsWithExecutorBindings(
  registry: SkillToolRegistryLike | null | undefined,
  options: { fallbackTools?: string[]; aliasMap?: Record<string, string> } = {},
): SkillExecutorBindingReport & {
  before: number;
  after: number;
  dropped: string[];
  kept: string[];
} {
  const map = getDynamicIntentToolMap();
  const beforeNames = new Set<string>();
  for (const tools of Object.values(map)) {
    for (const name of tools) beforeNames.add(name);
  }

  const bindOpts: SkillExecutorBindingOptions = {
    registry,
    useKnownCatalog: true,
    aliasMap: options.aliasMap,
  };

  const allDeclared = Array.from(beforeNames);
  const report = bindSkillDeclaredTools(allDeclared, bindOpts);
  const fallback = (options.fallbackTools || [...GATEWAY_FALLBACK_TOOLS, 'read_file', 'list_directory', 'get_datetime'])
    .map((n) => resolveSkillToolName(n, bindOpts))
    .filter((b) => b.resolvedName)
    .map((b) => b.resolvedName as string);

  const next: Record<string, string[]> = {};
  const dropped: string[] = [];
  const kept: string[] = [];

  for (const [category, tools] of Object.entries(map)) {
    const filtered: string[] = [];
    for (const raw of tools) {
      const binding = resolveSkillToolName(raw, bindOpts);
      if (binding.resolvedName && binding.status !== 'unresolved') {
        // Never put phantom declared name back — only resolved executor
        filtered.push(binding.resolvedName);
        if (!kept.includes(binding.resolvedName)) kept.push(binding.resolvedName);
        if (binding.status !== 'direct' && binding.declaredName !== binding.resolvedName) {
          if (!dropped.includes(binding.declaredName)) dropped.push(binding.declaredName);
        }
      } else if (!dropped.includes(raw)) {
        dropped.push(raw);
      }
    }
    if (filtered.length === 0 && tools.length > 0) {
      filtered.push(...fallback);
    }
    if (filtered.length > 0) {
      next[category] = Array.from(new Set(filtered));
    }
  }

  setDynamicIntentToolMap(next);

  const afterNames = new Set<string>();
  for (const tools of Object.values(next)) {
    for (const name of tools) afterNames.add(name);
  }

  return {
    ...report,
    before: beforeNames.size,
    after: afterNames.size,
    dropped: dropped.sort(),
    kept: kept.sort(),
    formatText() {
      return [
        report.formatText(),
        `firewall before=${beforeNames.size} after=${afterNames.size}`,
        dropped.length ? `  dropped phantoms/aliases-from-map: ${dropped.slice(0, 20).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
  };
}

/**
 * Build a short prompt fragment listing only resolved executors (no phantoms).
 */
export function formatSkillExecutorBindingsForPrompt(bindings: ZavorthSkillToolBinding[], maxChars = 800): string {
  const lines = ['SKILL EXECUTORS (resolved; do not invent other tool names):'];
  for (const b of bindings) {
    if (b.status === 'unresolved' || !b.resolvedName) {
      lines.push(`- ${b.declaredName}: unavailable → use plugin_suggest or zavorth_action`);
      continue;
    }
    if (b.status === 'direct') {
      lines.push(`- ${b.resolvedName}`);
    } else if (b.status === 'aliased') {
      lines.push(`- ${b.resolvedName} (from ${b.declaredName})`);
    } else {
      lines.push(`- ${b.resolvedName} for intent "${b.declaredName}" (gateway)`);
    }
  }
  const text = lines.join('\n');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

function collectKnownNames(options: SkillExecutorBindingOptions): Set<string> {
  const known = new Set<string>();
  const registry = options.registry;
  if (registry?.getAllTools) {
    try {
      for (const t of registry.getAllTools() || []) {
        const n = String(t?.name || '').trim();
        if (n) known.add(n);
      }
    } catch {
      /* soft */
    }
  }
  if (registry?.hasTool || registry?.getTool) {
    // probe common names into set when getAllTools missing
    for (const n of KNOWN_NATIVE_TOOL_NAMES) {
      try {
        if (registry.hasTool?.(n) || registry.getTool?.(n)) known.add(n);
      } catch {
        /* soft */
      }
    }
  }
  if (known.size === 0 && options.useKnownCatalog !== false) {
    for (const n of KNOWN_NATIVE_TOOL_NAMES) known.add(n);
  }
  return known;
}

function runObservationSmoke(
  resolvedNames: string[],
  options: SkillExecutorBindingOptions,
): SkillExecutorBindingReport['smoke'] {
  const candidates = resolvedNames.filter((n) => OBSERVATION_SMOKE_TOOLS.has(n));
  if (candidates.length === 0) {
    return { ran: false, ok: null, detail: 'no observation tools to smoke', checked: [] };
  }
  const known = collectKnownNames(options);
  const missing = candidates.filter((n) => known.size > 0 && !known.has(n));
  if (missing.length > 0) {
    return {
      ran: true,
      ok: false,
      detail: `missing observation tools: ${missing.join(', ')}`,
      checked: candidates,
    };
  }
  return {
    ran: true,
    ok: true,
    detail: `observation tools present: ${candidates.join(', ')}`,
    checked: candidates,
  };
}

export type { ZavorthSkillToolBindStatus };
