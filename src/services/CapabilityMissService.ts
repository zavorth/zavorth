/**
 * Structured capability-miss loop: when a tool/capability is missing,
 * produce InstallSuggestion receipts from local skill index + plugin marketplace.
 * Never auto-enables or auto-installs.
 */

import path from 'node:path';

import { SkillSearchIndexService, type SkillSearchDocument } from './SkillSearchIndexService.js';
import { PluginOsMarketplaceService, type PluginOsMarketplaceEntry } from './PluginOsMarketplaceService.js';

export type CapabilityMissInput = {
  /** Exact tool name that failed or is absent (preferred structured signal). */
  missingTool?: string | null;
  /** Capability / plugin capability id. */
  missingCapability?: string | null;
  /** Optional free-text hint — used only for search scoring, never for auto-enable. */
  intentHint?: string | null;
  limit?: number;
  root?: string;
};

export type InstallSuggestion = {
  kind: 'skill' | 'plugin';
  id: string;
  name: string;
  summary: string;
  score: number;
  reasons: string[];
  match: 'exact-tool' | 'capability' | 'search' | 'marketplace';
  installed: boolean;
  enabled?: boolean;
  /** CLI preview (dry-run) — never mutates. */
  previewCommand: string;
  /** CLI install/enable with explicit consent flag. */
  installCommand: string;
  /** Agent tool payload for preview. */
  previewAction: { tool: string; args: Record<string, unknown> };
  /** Agent tool payload for install (consent still required). */
  installAction: { tool: string; args: Record<string, unknown> };
  autoInstall: false;
};

export type CapabilityMissResult = {
  ok: boolean;
  autoInstall: false;
  autoEnable: false;
  input: {
    missingTool: string | null;
    missingCapability: string | null;
    intentHint: string | null;
  };
  suggestions: InstallSuggestion[];
  primary: InstallSuggestion | null;
  message: string;
  findings: string[];
  formatText(): string;
};

export type CapabilityMissRuntime = {
  projectRoot?: string;
  searchIndex?: SkillSearchIndexService;
  marketplace?: PluginOsMarketplaceService;
};

export class CapabilityMissService {
  private readonly projectRoot: string;
  private readonly searchIndex: SkillSearchIndexService;
  private readonly marketplace: PluginOsMarketplaceService;

  constructor(runtime: CapabilityMissRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.searchIndex = runtime.searchIndex || new SkillSearchIndexService({ projectRoot: this.projectRoot });
    this.marketplace = runtime.marketplace || new PluginOsMarketplaceService({ projectRoot: this.projectRoot });
  }

  /**
   * Resolve structured miss → ranked install suggestions.
   * Free-text intentHint alone never enables anything.
   */
  public resolve(input: CapabilityMissInput): CapabilityMissResult {
    const root = path.resolve(input.root || this.projectRoot);
    const missingTool = normalizeToken(input.missingTool);
    const missingCapability = normalizeToken(input.missingCapability);
    const intentHint = String(input.intentHint || '').trim() || null;
    const limit = Math.max(1, Math.min(20, Number(input.limit) || 8));
    const findings: string[] = [];

    if (!missingTool && !missingCapability && !intentHint) {
      return finish({
        ok: false,
        input: { missingTool: null, missingCapability: null, intentHint: null },
        suggestions: [],
        primary: null,
        message: 'Provide missingTool, missingCapability, or intentHint to resolve a capability miss.',
        findings: ['empty_input'],
      });
    }

    const suggestions: InstallSuggestion[] = [];
    const seen = new Set<string>();

    const push = (s: InstallSuggestion) => {
      const key = `${s.kind}:${s.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push(s);
    };

    // 1) Exact tool match on installed / indexed skills
    if (missingTool) {
      const byTool = this.searchIndex.search(missingTool, limit * 2);
      for (const doc of byTool) {
        const exact = doc.tools.some((t) => t.toLowerCase() === missingTool.toLowerCase());
        if (!exact && doc.id.toLowerCase() !== missingTool.toLowerCase()) {
          // Keep high-scoring near matches when score is strong
          if (doc.score < 0.6) continue;
        }
        push(
          skillSuggestion(doc, exact ? 'exact-tool' : 'search', [
            exact ? `declared tool ${missingTool}` : `skill search match for ${missingTool}`,
          ]),
        );
      }
      findings.push(`skill_tool_hits=${byTool.length}`);
    }

    // 2) Capability / intent search on skills
    const searchQuery = missingCapability || intentHint || missingTool || '';
    if (searchQuery) {
      const hits = this.searchIndex.search(searchQuery, limit * 2);
      for (const doc of hits) {
        push(
          skillSuggestion(doc, missingCapability ? 'capability' : 'search', [
            missingCapability ? `capability/search ${missingCapability}` : `search ${searchQuery}`,
          ]),
        );
      }
      findings.push(`skill_search_hits=${hits.length}`);
    }

    // 3) Plugin marketplace (structured capability / tool-ish query)
    try {
      const marketQuery = missingTool || missingCapability || (intentHint ? null : null);
      // Prefer structured ids for marketplace list filter; free-text uses list without auto-enable.
      const listed = this.marketplace.list({
        root,
        query: marketQuery || intentHint || undefined,
        includeRemote: true,
        limit: 100,
      });
      findings.push(...(listed.findings || []).slice(0, 5));
      for (const entry of listed.entries || []) {
        const score = scorePluginEntry(entry, {
          missingTool,
          missingCapability,
          intentHint,
        });
        if (score <= 0) continue;
        push(
          pluginSuggestion(entry, score, {
            missingTool,
            missingCapability,
            intentHint,
          }),
        );
      }
      findings.push(`plugin_market_entries=${listed.entries?.length ?? 0}`);
    } catch (error) {
      findings.push(`marketplace_error=${error instanceof Error ? error.message : String(error)}`);
    }

    suggestions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const capped = suggestions.slice(0, limit);
    const primary = capped[0] || null;

    let message: string;
    if (primary) {
      const target = missingTool
        ? `tool "${missingTool}"`
        : missingCapability
          ? `capability "${missingCapability}"`
          : 'requested capability';
      message = `Missing ${target}. Suggested ${primary.kind} "${primary.id}" — preview first, install only with consent. Never auto-enabled.`;
    } else {
      message =
        'No local skill or marketplace match for this miss. Try plugin_suggest / skill search, or install from a path/URL with consent.';
    }

    return finish({
      ok: capped.length > 0,
      input: { missingTool, missingCapability, intentHint },
      suggestions: capped,
      primary,
      message,
      findings,
    });
  }
}

function skillSuggestion(
  doc: SkillSearchDocument,
  match: InstallSuggestion['match'],
  reasons: string[],
): InstallSuggestion {
  const source = doc.sourcePath || doc.sourceUrl || doc.id;
  const score =
    match === 'exact-tool' ? Math.max(doc.score, 0.95) : match === 'capability' ? Math.max(doc.score, 0.75) : doc.score;
  return {
    kind: 'skill',
    id: doc.id,
    name: doc.name || doc.id,
    summary: doc.description || '',
    score,
    reasons: [
      ...reasons,
      doc.installed ? 'already installed' : 'not installed',
      ...(doc.tools.length ? [`tools: ${doc.tools.slice(0, 6).join(', ')}`] : []),
    ],
    match,
    installed: doc.installed,
    previewCommand: `zavorth skill preview ${quote(source)}`,
    installCommand: `zavorth skill install ${quote(source)} --consent`,
    previewAction: {
      tool: 'zavorth_skill_marketplace',
      args: { action: 'preview', source },
    },
    installAction: {
      tool: 'zavorth_skill_marketplace',
      args: { action: 'install', source, consent: true },
    },
    autoInstall: false,
  };
}

function pluginSuggestion(
  entry: PluginOsMarketplaceEntry,
  score: number,
  ctx: {
    missingTool: string | null;
    missingCapability: string | null;
    intentHint: string | null;
  },
): InstallSuggestion {
  const id = entry.id;
  const match: InstallSuggestion['match'] =
    ctx.missingTool &&
    (id.toLowerCase() === ctx.missingTool.toLowerCase() ||
      id.toLowerCase().includes(ctx.missingTool.toLowerCase().replace(/_/g, '-')))
      ? 'exact-tool'
      : ctx.missingCapability
        ? 'capability'
        : 'marketplace';
  const reasons: string[] = [];
  if (ctx.missingTool) reasons.push(`query tool ${ctx.missingTool}`);
  if (ctx.missingCapability) reasons.push(`query capability ${ctx.missingCapability}`);
  if (ctx.intentHint) reasons.push('intent hint (search only)');
  if (entry.enabled) reasons.push('already enabled');
  else if (entry.installed) reasons.push('installed, not enabled');
  else reasons.push('marketplace candidate');
  if (entry.tags?.length) reasons.push(`tags: ${entry.tags.slice(0, 4).join(', ')}`);

  return {
    kind: 'plugin',
    id,
    name: entry.name || id,
    summary: entry.summary || entry.description || '',
    score,
    reasons,
    match,
    installed: entry.installed === true,
    enabled: entry.enabled === true,
    previewCommand: `zavorth plugins marketplace show ${id}`,
    installCommand: entry.enabled
      ? `zavorth plugins status ${id}`
      : entry.installed
        ? `zavorth plugins enable ${id} --yes`
        : `zavorth plugins marketplace install ${id} --yes`,
    previewAction: {
      tool: 'plugin_recommend',
      args: { explainPluginId: id },
    },
    installAction: {
      tool: 'plugin_suggest',
      args: {
        intent: ctx.missingTool || ctx.missingCapability || ctx.intentHint || id,
      },
    },
    autoInstall: false,
  };
}

function scorePluginEntry(
  entry: PluginOsMarketplaceEntry,
  ctx: {
    missingTool: string | null;
    missingCapability: string | null;
    intentHint: string | null;
  },
): number {
  const blob = [
    entry.id,
    entry.name,
    entry.summary,
    entry.description,
    ...(entry.tags || []),
    ...(entry.permissions || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  if (ctx.missingTool) {
    const t = ctx.missingTool.toLowerCase();
    const hyphen = t.replace(/_/g, '-');
    const under = t.replace(/-/g, '_');
    if (entry.id.toLowerCase() === t || entry.id.toLowerCase() === hyphen) score += 1;
    else if (blob.includes(t) || blob.includes(hyphen) || blob.includes(under)) score += 0.7;
    else if (t.split(/[_-]/).some((part) => part.length > 2 && blob.includes(part))) score += 0.35;
  }
  if (ctx.missingCapability) {
    const c = ctx.missingCapability.toLowerCase();
    if (entry.id.toLowerCase() === c) score += 1;
    else if (blob.includes(c)) score += 0.65;
  }
  if (ctx.intentHint) {
    const tokens = ctx.intentHint
      .toLowerCase()
      .split(/[^a-z0-9_./-]+/i)
      .filter((x) => x.length > 2);
    let hits = 0;
    for (const tok of tokens) {
      if (blob.includes(tok)) hits += 1;
    }
    if (tokens.length) score += (hits / tokens.length) * 0.5;
  }
  if (entry.enabled) score += 0.05;
  else if (!entry.installed) score += 0.02;
  return score;
}

function normalizeToken(value: unknown): string | null {
  const s = String(value || '').trim();
  return s || null;
}

function quote(value: string): string {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function finish(partial: {
  ok: boolean;
  input: CapabilityMissResult['input'];
  suggestions: InstallSuggestion[];
  primary: InstallSuggestion | null;
  message: string;
  findings: string[];
}): CapabilityMissResult {
  const suggestions = partial.suggestions;
  const primary = partial.primary;
  return {
    ok: partial.ok,
    autoInstall: false,
    autoEnable: false,
    input: partial.input,
    suggestions,
    primary,
    message: partial.message,
    findings: partial.findings,
    formatText() {
      const lines = [partial.message, `autoInstall=false autoEnable=false suggestions=${suggestions.length}`];
      for (const s of suggestions.slice(0, 12)) {
        lines.push(`  - [${s.kind}] ${s.id} score=${s.score.toFixed(2)} match=${s.match}`);
        lines.push(`    preview: ${s.previewCommand}`);
        lines.push(`    install: ${s.installCommand}`);
      }
      if (!suggestions.length) {
        lines.push('  (no candidates)');
      }
      return lines.join('\n');
    },
  };
}
