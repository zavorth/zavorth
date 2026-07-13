import { getDynamicIntentToolMap, setDynamicIntentToolMap } from '../cognitive-firewall/ToolGatekeeper.js';
import {
  GATEWAY_FALLBACK_TOOLS,
  reconcileSkillToolsWithExecutorBindings,
  bindSkillDeclaredTools,
  type SkillExecutorBindingReport,
} from './SkillExecutorBindingService.js';

export type SkillToolRegistryLike = {
  hasTool?(name: string): boolean;
  getTool?(name: string): unknown;
  getAllTools?(): Array<{ name: string }>;
};

export type SkillToolReconcileResult = {
  ok: boolean;
  before: number;
  after: number;
  dropped: string[];
  kept: string[];
  redirectedTo: string[];
  /** full executor binding report when available */
  bindingReport?: SkillExecutorBindingReport;
  formatText(): string;
};

const FALLBACK_SAFE_TOOLS = [
  ...GATEWAY_FALLBACK_TOOLS,
  'read_file',
  'list_directory',
  'get_datetime',
];

/**
 * Keep Cognitive Firewall skill maps aligned with tools that actually exist.
 * resolve aliases, drop phantoms, rewrite map to resolved executor names only.
 */
export function reconcileSkillToolsWithRegistry(
  registry: SkillToolRegistryLike | null | undefined,
  options: { fallbackTools?: string[] } = {},
): SkillToolReconcileResult {
  // Prefer executor binding path (aliases + gateway).
  try {
    const report = reconcileSkillToolsWithExecutorBindings(registry, {
      fallbackTools: options.fallbackTools || FALLBACK_SAFE_TOOLS,
    });
    return {
      ok: report.ok,
      before: report.before,
      after: report.after,
      dropped: report.dropped,
      kept: report.kept,
      redirectedTo: options.fallbackTools || FALLBACK_SAFE_TOOLS,
      bindingReport: report,
      formatText() {
        return [
          'Skill tool registry reconcile (executor bindings)',
          report.formatText(),
        ].join('\n');
      },
    };
  } catch {
    // Soft fallback to legacy drop-only path
  }

  return legacyReconcile(registry, options);
}

/**
 * Bind declared skill tool names (post-install) without mutating firewall.
 */
export function bindDeclaredSkillToolsToRegistry(
  declaredNames: string[],
  registry?: SkillToolRegistryLike | null,
): SkillExecutorBindingReport {
  return bindSkillDeclaredTools(declaredNames, {
    registry,
    useKnownCatalog: true,
  });
}

function legacyReconcile(
  registry: SkillToolRegistryLike | null | undefined,
  options: { fallbackTools?: string[] } = {},
): SkillToolReconcileResult {
  const map = getDynamicIntentToolMap();
  const beforeNames = new Set<string>();
  for (const tools of Object.values(map)) {
    for (const name of tools) beforeNames.add(name);
  }

  const known = new Set<string>();
  if (registry) {
    if (typeof registry.getAllTools === 'function') {
      for (const tool of registry.getAllTools()) {
        const name = String(tool?.name || '').trim();
        if (name) known.add(name);
      }
    }
  }

  const hasTool = (name: string): boolean => {
    if (known.has(name)) return true;
    if (registry && typeof registry.hasTool === 'function') {
      try {
        return registry.hasTool(name) === true;
      } catch {
        return false;
      }
    }
    if (registry && typeof registry.getTool === 'function') {
      try {
        return Boolean(registry.getTool(name));
      } catch {
        return false;
      }
    }
    return known.size === 0;
  };

  const fallback = (options.fallbackTools || FALLBACK_SAFE_TOOLS).filter((name) => {
    if (known.size === 0) return true;
    return hasTool(name);
  });

  const dropped: string[] = [];
  const kept: string[] = [];
  const next: Record<string, string[]> = {};

  for (const [category, tools] of Object.entries(map)) {
    const filtered: string[] = [];
    for (const raw of tools) {
      const name = String(raw || '').trim();
      if (!name) continue;
      if (hasTool(name)) {
        filtered.push(name);
        if (!kept.includes(name)) kept.push(name);
      } else if (!dropped.includes(name)) {
        dropped.push(name);
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
    ok: true,
    before: beforeNames.size,
    after: afterNames.size,
    dropped: dropped.sort(),
    kept: kept.sort(),
    redirectedTo: fallback,
    formatText() {
      return [
        'Skill tool registry reconcile',
        `before=${this.before} after=${this.after}`,
        `dropped=${this.dropped.length}`,
        this.dropped.length ? `  phantoms: ${this.dropped.slice(0, 20).join(', ')}` : '  phantoms: none',
        `fallback: ${this.redirectedTo.join(', ')}`,
      ].join('\n');
    },
  };
}
