import path from 'node:path';

import { PluginRouterService } from './PluginRouterService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginOsObservabilityService } from './PluginOsObservabilityService.js';

export type PluginOsAgentSurface = {
  generatedAt: string;
  root: string;
  health: string;
  enabledPluginIds: string[];
  firstPartyCatalog: Array<{
    id: string;
    name: string;
    summary?: string;
    enabled: boolean;
    tags: string[];
  }>;
  recommendHints: string[];
  promptBlock: string;
  deepLinks: string[];
  formatText(): string;
};

export type PluginOsAgentSurfaceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  curated?: PluginCuratedMarketplaceService;
  observability?: PluginOsObservabilityService;
  router?: PluginRouterService;
};

/**
 * Compact Plugin OS surface for agent system prompts and desktop tips.
 * Never auto-enables; only describes catalog + enable hints.
 */
export class PluginOsAgentSurfaceService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly observability: PluginOsObservabilityService;
  private readonly router: PluginRouterService;

  constructor(runtime: PluginOsAgentSurfaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
    });
    this.observability = runtime.observability || new PluginOsObservabilityService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      curated: this.curated,
    });
    this.router = runtime.router || new PluginRouterService({
      now: this.now,
      stateBridge: this.bridge,
    });
  }

  public buildSurface(options: { root?: string; maxCatalog?: number } = {}): PluginOsAgentSurface {
    const root = path.resolve(options.root || this.projectRoot);
    const maxCatalog = Math.max(5, Math.min(40, Number(options.maxCatalog) || 16));
    const metrics = this.observability.buildSnapshot(root);
    const enabled = this.bridge.list().filter((p) => p.enabled);
    const enabledIds = new Set(enabled.map((p) => p.pluginId));
    const catalog = this.curated.list({ root });
    const firstParty = catalog.entries
      .filter((entry) => String(entry.tier || '').toLowerCase() === 'first-party')
      .slice(0, maxCatalog)
      .map((entry) => ({
        id: entry.id,
        name: entry.name || entry.id,
        summary: entry.summary,
        enabled: enabledIds.has(entry.id),
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
      }));

    const recommendHints = [
      'Use tool plugin_suggest when a capability may be missing — offer Enable vs Recommend-only (never auto-enable).',
      'Use tool plugin_recommend for ranked lists without enable CTAs.',
      'Never auto-enable plugins; suggest: zavorth plugins enable <id> --yes',
      'MCP: zavorth plugins mcp list · materialize <id> --yes · mcp.invoke via mcp-bridge',
      'Forge: zavorth plugins forge plan "<intent>" then apply --yes (optional --enable)',
    ];

    const catalogLines = firstParty.map((entry) => (
      `- ${entry.id}${entry.enabled ? ' [on]' : ' [off]'}: ${entry.summary || entry.name}`
    ));

    const promptBlock = [
      '## Zavorth Plugin OS',
      `Health: ${metrics.health}. Enabled plugins: ${enabled.length}.`,
      'First-party catalog (subset):',
      ...catalogLines,
      'When the user needs a capability, call plugin_suggest and present Enable vs Recommend-only (no auto-enable).',
      'CLI enable: zavorth plugins enable <id> --yes',
    ].join('\n');

    const deepLinks = [
      ...metrics.deepLinks.slice(0, 6),
      'tool: plugin_suggest',
      'tool: plugin_recommend',
    ];

    return {
      generatedAt: this.now().toISOString(),
      root,
      health: metrics.health,
      enabledPluginIds: enabled.map((p) => p.pluginId).sort(),
      firstPartyCatalog: firstParty,
      recommendHints,
      promptBlock,
      deepLinks,
      formatText() {
        return [
          'Plugin OS agent surface',
          `health=${metrics.health} enabled=${enabled.length} firstPartyShown=${firstParty.length}`,
          ...catalogLines,
          '',
          ...recommendHints.map((hint) => `hint: ${hint}`),
        ].join('\n');
      },
    };
  }

  public async recommendForAgent(input: {
    intent: string;
    root?: string;
    limit?: number;
    useLlm?: boolean;
  }): Promise<{
    ok: boolean;
    intent: string;
    autoEnable: false;
    recommendations: Array<{
      pluginId: string;
      score: number;
      summary?: string;
      enableHint: string;
      reasons: string[];
    }>;
    text: string;
  }> {
    const root = path.resolve(input.root || this.projectRoot);
    const result = await this.router.recommend({
      root,
      intent: input.intent,
      limit: input.limit,
      useLlm: input.useLlm,
    });
    return {
      ok: result.ok,
      intent: result.intent,
      autoEnable: false,
      recommendations: result.recommendations.map((item) => ({
        pluginId: item.pluginId,
        score: item.score,
        summary: item.summary,
        enableHint: `zavorth plugins enable ${item.pluginId} --yes`,
        reasons: item.reasons || [],
      })),
      text: result.formatText(),
    };
  }
}
