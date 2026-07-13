import fs from 'node:fs';
import path from 'node:path';

import { PluginRouterService } from './PluginRouterService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginOsPermissionPreviewService } from './PluginOsPermissionPreviewService.js';
import { PluginOsTelemetryService } from './PluginOsTelemetryService.js';

type WavePackDef = {
  id: string;
  label?: string;
  wave?: string;
  intents?: string[];
  pluginIds?: string[];
  enableHint?: string;
};

export type PluginOsSuggestItem = {
  pluginId: string;
  score: number;
  label?: string;
  summary?: string;
  reasons: string[];
  enabled: boolean;
  /** True when the plugin is recommended but not currently enabled. */
  canEnable: boolean;
  enableHint: string;
  recommendOnlyHint: string;
  needsCredentials?: boolean;
  risks?: string[];
  trust?: string;
};

export type PluginOsSuggestResult = {
  ok: boolean;
  intent: string;
  autoEnable: false;
  suggestions: PluginOsSuggestItem[];
  /** Top disabled suggestion, if any — primary CTA for "suggest-to-enable". */
  primary?: PluginOsSuggestItem | null;
  message: string;
  ui: {
    title: string;
    body: string;
    actions: Array<{ id: 'enable' | 'recommend_only' | 'dismiss'; label: string; pluginId?: string }>;
  };
  formatText(): string;
};

export type PluginOsSuggestRuntime = {
  now?: () => Date;
  projectRoot?: string;
  router?: PluginRouterService;
  stateBridge?: PluginStateBridgeService;
  permissionPreview?: PluginOsPermissionPreviewService;
  telemetry?: PluginOsTelemetryService;
};

/**
 * Daily "suggest-to-enable" surface: when the user needs a capability,
 * recommend a plugin and offer Enable vs Recommend-only. Never auto-enables.
 */
export class PluginOsSuggestService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly router: PluginRouterService;
  private readonly bridge: PluginStateBridgeService;
  private readonly preview: PluginOsPermissionPreviewService;
  private readonly telemetry: PluginOsTelemetryService | null;

  constructor(runtime: PluginOsSuggestRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.router = runtime.router || new PluginRouterService({
      now: this.now,
      stateBridge: this.bridge,
    });
    this.preview = runtime.permissionPreview || new PluginOsPermissionPreviewService({
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
    });
    this.telemetry = runtime.telemetry || null;
  }

  public async suggest(input: {
    intent: string;
    root?: string;
    limit?: number;
    useLlm?: boolean;
  }): Promise<PluginOsSuggestResult> {
    const root = path.resolve(input.root || this.projectRoot);
    const intent = String(input.intent || '').trim();
    const limit = Math.max(1, Math.min(10, Number(input.limit) || 5));

    if (!intent) {
      return finish({
        ok: false,
        intent: '',
        suggestions: [],
        primary: null,
        message: 'Describe what you need (e.g. "search the web" or "draft an email").',
        ui: {
          title: 'Need a capability?',
          body: 'Tell me what you want to do and I will suggest a plugin. Nothing turns on automatically.',
          actions: [{ id: 'dismiss', label: 'Dismiss' }],
        },
      });
    }

    const ranked = await this.router.recommend({
      root,
      intent,
      limit,
      useLlm: input.useLlm === true,
    });

    const packHits = this.matchWavePacks(root, intent);
    const seen = new Set<string>();
    const suggestions: PluginOsSuggestItem[] = [];

    const pushSuggestion = (item: {
      pluginId: string;
      score: number;
      label?: string;
      summary?: string;
      reasons?: string[];
    }) => {
      const pluginId = String(item.pluginId || '').trim();
      if (!pluginId || seen.has(pluginId)) return;
      seen.add(pluginId);
      const bridged = this.bridge.resolve(pluginId);
      const enabled = bridged.enabled === true && bridged.trust !== 'blocked';
      let needsCredentials = false;
      let risks: string[] = [];
      let trust: string = bridged.trust;
      try {
        const preview = this.preview.preview(pluginId, root);
        needsCredentials = preview.needsCredentials === true;
        risks = preview.risks || [];
        trust = preview.trust || trust;
      } catch {
        /* soft */
      }
      suggestions.push({
        pluginId,
        score: item.score,
        label: item.label,
        summary: item.summary,
        reasons: item.reasons || [],
        enabled,
        canEnable: !enabled && bridged.trust !== 'blocked',
        enableHint: `zavorth plugins enable ${pluginId} --yes`,
        recommendOnlyHint: 'Keep this as a suggestion only — do not enable yet.',
        needsCredentials,
        risks: risks.slice(0, 4),
        trust,
      });
    };

    for (const item of ranked.recommendations) {
      pushSuggestion({
        pluginId: item.pluginId,
        score: item.score,
        label: item.label,
        summary: item.summary,
        reasons: item.reasons || [],
      });
    }

    // Wave 8: inject pack plugins when intent matches pack intents (never auto-enable).
    for (const pack of packHits) {
      const ids = Array.isArray(pack.pluginIds) ? pack.pluginIds : [];
      for (const pluginId of ids.slice(0, limit)) {
        pushSuggestion({
          pluginId,
          score: 0.55,
          label: pack.label || pack.id,
          summary: pack.enableHint || `Part of pack ${pack.id}`,
          reasons: [`wave pack: ${pack.id}`, pack.wave ? `wave ${pack.wave}` : 'pack match'].filter(Boolean),
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    const trimmed = suggestions.slice(0, limit);

    const primary = trimmed.find((s) => s.canEnable) || null;
    const alreadyEnabled = trimmed.filter((s) => s.enabled);
    const packHint = packHits[0]
      ? ` Pack: ${packHits[0].label || packHits[0].id}${packHits[0].enableHint ? ` — ${packHits[0].enableHint}` : ''}.`
      : '';

    let message: string;
    if (primary) {
      message = [
        `Plugin "${primary.pluginId}" can help with: ${intent}.`,
        primary.summary ? primary.summary : null,
        primary.needsCredentials ? 'May need credentials.' : null,
        'Never auto-enables — choose Enable or Recommend only.',
        packHint.trim() || null,
      ].filter(Boolean).join(' ');
    } else if (alreadyEnabled.length > 0) {
      message = `Related plugins already active: ${alreadyEnabled.map((s) => s.pluginId).join(', ')}.${packHint}`;
    } else if (trimmed.length > 0) {
      message = `Found matches, but none can be enabled right now (blocked or unavailable).${packHint}`;
    } else {
      message = `No plugin match for "${intent}". Try a different description, enable a wave pack, or run create-zavorth-plugin / forge a new plugin.`;
    }

    const actions: PluginOsSuggestResult['ui']['actions'] = [];
    if (primary) {
      actions.push({ id: 'enable', label: `Enable ${primary.pluginId}`, pluginId: primary.pluginId });
      actions.push({ id: 'recommend_only', label: 'Recommend only', pluginId: primary.pluginId });
    }
    actions.push({ id: 'dismiss', label: 'Dismiss' });

    try {
      this.telemetry?.recordEvent('recommend', {
        root,
        intent,
        counts: {
          suggestions: trimmed.length,
          canEnable: trimmed.filter((s) => s.canEnable).length,
          packs: packHits.length,
        },
        meta: {
          surface: 'suggest-to-enable',
          primary: primary?.pluginId || null,
          packs: packHits.map((p) => p.id),
        },
      });
    } catch {
      /* soft */
    }

    return finish({
      ok: true,
      intent,
      suggestions: trimmed,
      primary,
      message,
      ui: {
        title: primary
          ? `${primary.pluginId} can help`
          : alreadyEnabled.length
            ? 'Plugins already available'
            : packHits[0]
              ? `Pack: ${packHits[0].label || packHits[0].id}`
              : 'No plugin match',
        body: message,
        actions,
      },
    });
  }

  /** Wave 8: match config/plugin-os-wave-packs.json against free-text intent. */
  private matchWavePacks(root: string, intent: string): WavePackDef[] {
    const packs = this.loadWavePacks(root);
    if (packs.length === 0) return [];
    const lower = intent.toLowerCase();
    const tokens = lower.split(/[^a-z0-9]+/u).filter((t) => t.length >= 3);
    const hits: Array<{ pack: WavePackDef; score: number }> = [];
    for (const pack of packs) {
      const intents = Array.isArray(pack.intents) ? pack.intents.map((i) => String(i).toLowerCase()) : [];
      let score = 0;
      for (const phrase of intents) {
        if (!phrase) continue;
        if (lower.includes(phrase) || phrase.includes(lower)) {
          score += 3;
          continue;
        }
        for (const token of tokens) {
          if (phrase.includes(token)) score += 1;
        }
      }
      if (score > 0) hits.push({ pack, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, 3).map((h) => h.pack);
  }

  private loadWavePacks(root: string): WavePackDef[] {
    const candidates = [
      path.join(root, 'config', 'plugin-os-wave-packs.json'),
      path.join(this.projectRoot, 'config', 'plugin-os-wave-packs.json'),
    ];
    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { packs?: WavePackDef[] };
        if (Array.isArray(raw.packs)) return raw.packs;
      } catch {
        /* soft */
      }
    }
    return [];
  }
}

function finish(input: Omit<PluginOsSuggestResult, 'autoEnable' | 'formatText'>): PluginOsSuggestResult {
  return {
    ...input,
    autoEnable: false,
    formatText() {
      const lines = [
        'Plugin OS suggest-to-enable',
        `intent: ${input.intent || '<empty>'}`,
        `autoEnable: false`,
        input.message,
        '',
        ...input.suggestions.map((item, index) => (
          `  ${index + 1}. ${item.pluginId}`
          + ` score=${item.score.toFixed(1)}`
          + ` ${item.enabled ? '[on]' : item.canEnable ? '[can enable]' : '[blocked]'}`
          + (item.summary ? ` — ${item.summary}` : '')
        )),
        '',
        'Actions:',
        ...input.ui.actions.map((action) => `  - ${action.id}: ${action.label}`),
      ];
      return lines.join('\n');
    },
  };
}
