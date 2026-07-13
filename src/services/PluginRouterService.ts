import fs from 'node:fs';
import path from 'node:path';

import { PluginStateBridgeService } from './PluginStateBridgeService.js';

export type PluginRouterCandidate = {
  pluginId: string;
  label?: string;
  summary?: string;
  description?: string;
  moduleKind?: string;
  tags?: string[];
  capabilities?: Array<{ id?: string; intent?: string; label?: string; summary?: string }>;
  intents?: string[];
  path?: string;
  enabled?: boolean;
  installed?: boolean;
};

export type PluginRouterRecommendation = {
  pluginId: string;
  score: number;
  reasons: string[];
  capabilities: string[];
  label?: string;
  summary?: string;
  moduleKind?: string;
  path?: string | null;
};

export type PluginRouterRecommendResult = {
  ok: boolean;
  intent: string;
  usedLlm: boolean;
  recommendations: PluginRouterRecommendation[];
  candidatesConsidered: number;
  formatText(): string;
};

export type PluginRouterExplainResult = {
  ok: boolean;
  pluginId: string;
  found: boolean;
  candidate: PluginRouterCandidate | null;
  reasons: string[];
  formatText(): string;
};

export type PluginRouterServiceRuntime = {
  now?: () => Date;
  stateBridge?: PluginStateBridgeService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  llmChat?: (prompt: string) => Promise<string | null>;
};

export class PluginRouterService {
  private readonly now: () => Date;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly llmChat: ((prompt: string) => Promise<string | null>) | null;

  constructor(runtime: PluginRouterServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.injectedBridge = runtime.stateBridge || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.llmChat = runtime.llmChat || null;
  }

  public discoverCandidates(root: string, explicit?: PluginRouterCandidate[]): PluginRouterCandidate[] {
    if (Array.isArray(explicit) && explicit.length > 0) {
      return explicit.map(normalizeCandidate).filter((entry) => entry.pluginId);
    }

    const resolvedRoot = path.resolve(root || process.cwd());
    const byId = new Map<string, PluginRouterCandidate>();

    for (const base of [
      path.join(resolvedRoot, 'plugins'),
      path.join(resolvedRoot, '.zavorth', 'plugins'),
    ]) {
      for (const candidate of this.scanPluginDir(base, resolvedRoot)) {
        byId.set(candidate.pluginId, candidate);
      }
      // also scan plugins/examples/*
      const examples = path.join(base, 'examples');
      if (this.existsSync(examples)) {
        for (const candidate of this.scanPluginDir(examples, resolvedRoot)) {
          if (!byId.has(candidate.pluginId)) {
            byId.set(candidate.pluginId, candidate);
          }
        }
      }
    }

    try {
      const bridge = this.injectedBridge || new PluginStateBridgeService({
        now: this.now,
        projectRoot: resolvedRoot,
      });
      for (const entry of bridge.list()) {
        const existing = byId.get(entry.pluginId);
        if (existing) {
          existing.enabled = entry.enabled;
          existing.installed = entry.installed;
        } else if (entry.installed) {
          byId.set(entry.pluginId, {
            pluginId: entry.pluginId,
            label: entry.pluginId,
            summary: 'Installed plugin (bridge state only)',
            enabled: entry.enabled,
            installed: entry.installed,
            tags: [],
            capabilities: [],
          });
        }
      }
    } catch {
      /* soft-fail bridge */
    }

    return Array.from(byId.values()).sort((a, b) => a.pluginId.localeCompare(b.pluginId));
  }

  public async recommend(input: {
    root: string;
    intent: string;
    limit?: number;
    useLlm?: boolean;
    candidates?: PluginRouterCandidate[];
  }): Promise<PluginRouterRecommendResult> {
    const intent = String(input.intent || '').trim();
    const limit = Math.max(1, Math.min(50, Number(input.limit) || 5));
    const candidates = this.discoverCandidates(input.root, input.candidates);
    let recommendations = this.scoreCandidates(intent, candidates).slice(0, limit);
    let usedLlm = false;

    const wantLlm = input.useLlm === true
      || process.env.ZAVORTH_PLUGIN_ROUTER_LLM === '1';

    if (wantLlm && intent) {
      try {
        const llmRanked = await this.tryLlmRank(intent, candidates, limit);
        if (llmRanked && llmRanked.length > 0) {
          recommendations = llmRanked;
          usedLlm = true;
        }
      } catch {
        /* soft-fail to keyword ranking */
      }
    }

    return {
      ok: true,
      intent,
      usedLlm,
      recommendations,
      candidatesConsidered: candidates.length,
      formatText() {
        const lines = [
          `Plugin recommend: "${intent || '<empty>'}"`,
          `candidates=${candidates.length} usedLlm=${usedLlm}`,
          ...recommendations.map((item, index) => (
            `  ${index + 1}. ${item.pluginId} score=${item.score.toFixed(2)} — ${(item.reasons || []).join('; ') || 'keyword match'}`
          )),
          recommendations.length === 0 ? '  (no matches)' : '',
          'Never auto-enables plugins; recommendations only.',
        ].filter(Boolean);
        return lines.join('\n');
      },
    };
  }

  public explain(input: {
    root: string;
    pluginId: string;
    candidates?: PluginRouterCandidate[];
  }): PluginRouterExplainResult {
    const pluginId = String(input.pluginId || '').trim();
    const candidates = this.discoverCandidates(input.root, input.candidates);
    const candidate = candidates.find((entry) => entry.pluginId === pluginId) || null;
    const reasons: string[] = [];

    if (!candidate) {
      reasons.push('Plugin not found among discovered manifests or bridge state.');
    } else {
      if (candidate.summary) reasons.push(`summary: ${candidate.summary}`);
      if (candidate.moduleKind) reasons.push(`moduleKind: ${candidate.moduleKind}`);
      if (candidate.tags && candidate.tags.length) reasons.push(`tags: ${candidate.tags.join(', ')}`);
      const caps = (candidate.capabilities || []).map((cap) => cap.id).filter(Boolean) as string[];
      if (caps.length) reasons.push(`capabilities: ${caps.join(', ')}`);
      if (typeof candidate.enabled === 'boolean') {
        reasons.push(candidate.enabled ? 'currently enabled' : 'currently disabled');
      }
    }

    return {
      ok: true,
      pluginId,
      found: Boolean(candidate),
      candidate,
      reasons,
      formatText() {
        return [
          `Plugin explain: ${pluginId || '<missing>'}`,
          `found=${Boolean(candidate)}`,
          ...reasons.map((line) => `  - ${line}`),
        ].join('\n');
      },
    };
  }

  public scoreCandidates(intent: string, candidates: PluginRouterCandidate[]): PluginRouterRecommendation[] {
    const tokens = tokenize(intent);
    if (tokens.length === 0) {
      return candidates.map((candidate) => ({
        pluginId: candidate.pluginId,
        score: 0,
        reasons: ['empty intent — unranked'],
        capabilities: capabilityIds(candidate),
        label: candidate.label,
        summary: candidate.summary,
        moduleKind: candidate.moduleKind,
        path: candidate.path || null,
      }));
    }

    const scored = candidates.map((candidate) => {
      const corpus = buildCorpus(candidate);
      const reasons: string[] = [];
      let score = 0;

      for (const token of tokens) {
        if (candidate.pluginId.toLowerCase().includes(token)) {
          score += 4;
          reasons.push(`id contains "${token}"`);
        }
        if ((candidate.label || '').toLowerCase().includes(token)) {
          score += 3;
          reasons.push(`label contains "${token}"`);
        }
        if ((candidate.summary || '').toLowerCase().includes(token)
          || (candidate.description || '').toLowerCase().includes(token)) {
          score += 2;
          reasons.push(`summary matches "${token}"`);
        }
        for (const tag of candidate.tags || []) {
          if (String(tag).toLowerCase().includes(token)) {
            score += 2;
            reasons.push(`tag "${tag}"`);
          }
        }
        for (const cap of candidate.capabilities || []) {
          const blob = [cap.id, cap.intent, cap.label, cap.summary].filter(Boolean).join(' ').toLowerCase();
          if (blob.includes(token)) {
            score += 3;
            reasons.push(`capability matches "${token}"`);
          }
        }
        for (const intentTag of candidate.intents || []) {
          if (String(intentTag).toLowerCase().includes(token)) {
            score += 2;
            reasons.push(`intent "${intentTag}"`);
          }
        }
        // fuzzy token presence in full corpus
        if (corpus.includes(token) && !reasons.some((r) => r.includes(`"${token}"`))) {
          score += 1;
          reasons.push(`corpus hit "${token}"`);
        }
      }

      // boost common product intents
      score += intentBoost(intent, candidate, reasons);
      // Prefer curated first-party only when already relevant (score > 0).
      if (score > 0 && CURATED_FIRST_PARTY_IDS.has(candidate.pluginId)) {
        const curatedTag = (candidate.tags || []).some((tag) => /curated|first-party/iu.test(String(tag)));
        score += curatedTag ? 3 : 2;
        reasons.push('curated first-party boost');
      }

      const uniqueReasons = Array.from(new Set(reasons)).slice(0, 8);
      return {
        pluginId: candidate.pluginId,
        score,
        reasons: uniqueReasons,
        capabilities: capabilityIds(candidate),
        label: candidate.label,
        summary: candidate.summary,
        moduleKind: candidate.moduleKind,
        path: candidate.path || null,
      };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.pluginId.localeCompare(b.pluginId));
  }

  private scanPluginDir(base: string, root: string): PluginRouterCandidate[] {
    const out: PluginRouterCandidate[] = [];
    if (!this.existsSync(base)) {
      return out;
    }
    let entries: fs.Dirent[];
    try {
      entries = this.readdirSync(base, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'examples' || entry.name.startsWith('.')) continue;
      const packageDir = path.join(base, entry.name);
      const manifestPath = path.join(packageDir, 'manifest.json');
      if (!this.existsSync(manifestPath)) continue;
      try {
        const raw = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
        const pluginId = String(raw.id || entry.name).trim();
        if (!pluginId) continue;
        out.push(normalizeCandidate({
          pluginId,
          label: String(raw.label || pluginId),
          summary: String(raw.summary || ''),
          description: String(raw.description || ''),
          moduleKind: String(raw.moduleKind || ''),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          capabilities: Array.isArray(raw.capabilities)
            ? (raw.capabilities as Array<Record<string, unknown>>).map((cap) => ({
              id: cap.id ? String(cap.id) : undefined,
              intent: cap.intent ? String(cap.intent) : undefined,
              label: cap.label ? String(cap.label) : undefined,
              summary: cap.summary ? String(cap.summary) : undefined,
            }))
            : [],
          intents: Array.isArray(raw.capabilities)
            ? (raw.capabilities as Array<Record<string, unknown>>)
              .map((cap) => String(cap.intent || ''))
              .filter(Boolean)
            : [],
          path: path.relative(root, packageDir).replace(/\\/gu, '/'),
        }));
      } catch {
        /* soft-fail invalid manifest */
      }
    }
    return out;
  }

  private async tryLlmRank(
    intent: string,
    candidates: PluginRouterCandidate[],
    limit: number,
  ): Promise<PluginRouterRecommendation[] | null> {
    const catalog = candidates.slice(0, 40).map((c) => ({
      pluginId: c.pluginId,
      label: c.label,
      summary: c.summary,
      tags: c.tags,
      capabilities: capabilityIds(c),
    }));

    let responseText: string | null = null;
    if (this.llmChat) {
      responseText = await this.llmChat(buildLlmPrompt(intent, catalog));
    } else {
      responseText = await tryDefaultLlmChat(buildLlmPrompt(intent, catalog));
    }
    if (!responseText) return null;

    const rankedIds = parseRankedIds(responseText);
    if (rankedIds.length === 0) return null;

    const byId = new Map(candidates.map((c) => [c.pluginId, c]));
    const keyword = this.scoreCandidates(intent, candidates);
    const keywordById = new Map(keyword.map((item) => [item.pluginId, item]));
    const out: PluginRouterRecommendation[] = [];

    for (let i = 0; i < rankedIds.length && out.length < limit; i += 1) {
      const pluginId = rankedIds[i];
      const candidate = byId.get(pluginId);
      if (!candidate) continue;
      const base = keywordById.get(pluginId);
      out.push({
        pluginId,
        score: Math.max(base?.score || 0, limit - i),
        reasons: [`llm-ranked #${i + 1}`, ...(base?.reasons || []).slice(0, 4)],
        capabilities: capabilityIds(candidate),
        label: candidate.label,
        summary: candidate.summary,
        moduleKind: candidate.moduleKind,
        path: candidate.path || null,
      });
    }
    return out.length > 0 ? out : null;
  }
}

function normalizeCandidate(input: PluginRouterCandidate): PluginRouterCandidate {
  return {
    pluginId: String(input.pluginId || '').trim(),
    label: input.label,
    summary: input.summary,
    description: input.description,
    moduleKind: input.moduleKind,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    capabilities: Array.isArray(input.capabilities) ? input.capabilities : [],
    intents: Array.isArray(input.intents) ? input.intents.map(String) : [],
    path: input.path,
    enabled: input.enabled,
    installed: input.installed,
  };
}

function capabilityIds(candidate: PluginRouterCandidate): string[] {
  return (candidate.capabilities || [])
    .map((cap) => String(cap.id || '').trim())
    .filter(Boolean);
}

function tokenize(intent: string): string[] {
  return String(intent || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function buildCorpus(candidate: PluginRouterCandidate): string {
  return [
    candidate.pluginId,
    candidate.label,
    candidate.summary,
    candidate.description,
    candidate.moduleKind,
    ...(candidate.tags || []),
    ...(candidate.intents || []),
    ...capabilityIds(candidate),
    ...(candidate.capabilities || []).flatMap((cap) => [cap.intent, cap.label, cap.summary]),
  ].filter(Boolean).join(' ').toLowerCase();
}

const CURATED_FIRST_PARTY_IDS = new Set([
  'web-search',
  'github',
  'memory-local',
  'memory-honcho',
  'cost-tracker',
  'browser-playwright',
  'security-guidance',
  'plugin-router-ai',
  'session-scratch-janitor',
  'selfmod-plugin-forge',
  'mcp-bridge',
  'gmail',
  'calendar',
  'linear',
  'notion',
]);

function intentBoost(
  intent: string,
  candidate: PluginRouterCandidate,
  reasons: string[],
): number {
  const lower = intent.toLowerCase();
  let boost = 0;
  const rules: Array<{ match: RegExp; ids: string[]; reason: string }> = [
    { match: /\b(search|web|google|duck|query)\b/u, ids: ['web-search'], reason: 'search intent boost' },
    { match: /\b(github|pr|pull request|issue)\b/u, ids: ['github'], reason: 'github intent boost' },
    { match: /\b(memory|remember|recall|store)\b/u, ids: ['memory-local', 'memory-honcho'], reason: 'memory intent boost' },
    { match: /\b(cost|token|budget|spend)\b/u, ids: ['cost-tracker'], reason: 'cost intent boost' },
    { match: /\b(browser|playwright|navigate|page)\b/u, ids: ['browser-playwright'], reason: 'browser intent boost' },
    { match: /\b(security|scan|danger|eval|unsafe)\b/u, ids: ['security-guidance'], reason: 'security intent boost' },
    { match: /\b(router|recommend|plugin)\b/u, ids: ['plugin-router-ai'], reason: 'router intent boost' },
    { match: /\b(forge|scaffold|generate plugin|self.?mod)\b/u, ids: ['selfmod-plugin-forge'], reason: 'forge intent boost' },
    { match: /\b(mcp|model context|materialize)\b/u, ids: ['mcp-bridge'], reason: 'mcp intent boost' },
    { match: /\b(gmail|email|inbox|mail)\b/u, ids: ['gmail'], reason: 'gmail intent boost' },
    { match: /\b(calendar|schedule|event|meeting)\b/u, ids: ['calendar'], reason: 'calendar intent boost' },
    { match: /\b(linear|ticket|sprint)\b/u, ids: ['linear'], reason: 'linear intent boost' },
    { match: /\b(notion|wiki|docs page)\b/u, ids: ['notion'], reason: 'notion intent boost' },
  ];
  for (const rule of rules) {
    if (rule.match.test(lower) && rule.ids.includes(candidate.pluginId)) {
      boost += 5;
      reasons.push(rule.reason);
    }
  }
  return boost;
}

function buildLlmPrompt(intent: string, catalog: unknown[]): string {
  return [
    'Rank plugins for the user intent. Reply with JSON only: {"ranked":["plugin-id",...]}',
    `Intent: ${intent}`,
    `Candidates: ${JSON.stringify(catalog)}`,
  ].join('\n');
}

function parseRankedIds(text: string): string[] {
  const raw = String(text || '').trim();
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { ranked?: unknown };
      if (Array.isArray(parsed.ranked)) {
        return parsed.ranked.map((item) => String(item).trim()).filter(Boolean);
      }
    }
  } catch {
    /* fall through */
  }
  return raw
    .split(/[\n,]/u)
    .map((line) => line.replace(/^[\s\-\d.]+/u, '').trim())
    .filter((line) => /^[a-z0-9][a-z0-9._-]*$/iu.test(line));
}

async function tryDefaultLlmChat(prompt: string): Promise<string | null> {
  try {
    // Soft optional monorepo load — never hard-require.
    const candidates = [
      path.resolve(__dirname, 'llm/LlmRuntimeService.js'),
      path.resolve(__dirname, 'llm/LlmRuntimeService.ts'),
      path.resolve(process.cwd(), 'dist/services/llm/LlmRuntimeService.js'),
      path.resolve(process.cwd(), 'src/services/llm/LlmRuntimeService.js'),
    ];
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { createRequire } = require('node:module') as typeof import('node:module');
    const req = createRequire(__filename);
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const mod = req(candidate) as { LlmRuntimeService?: new () => { chat: (messages: Array<{ role: string; content: string }>) => Promise<{ content?: string; text?: string }> } };
        if (!mod?.LlmRuntimeService) continue;
        const service = new mod.LlmRuntimeService();
        const response = await service.chat([{ role: 'user', content: prompt }]);
        const text = String(response?.content || response?.text || '').trim();
        if (text) return text;
      } catch {
        /* try next path */
      }
    }
  } catch {
    /* soft-fail */
  }
  return null;
}
