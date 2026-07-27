import path from 'node:path';

import {
  PluginStateBridgeService,
  type BridgedPluginState,
} from './PluginStateBridgeService.js';
import { PluginDiscoveryService } from './PluginDiscoveryService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import {
  PluginOsObservabilityService,
  type PluginOsObservabilitySnapshot,
} from './PluginOsObservabilityService.js';

export type PluginOsControlPlaneMarketplaceEntry = {
  id: string;
  name: string;
  summary?: string;
  tier?: string;
  moduleKind?: string;
  tags?: string[];
  enabled: boolean;
  installed: boolean;
  enableHint: string;
};

export type PluginOsControlPlaneSnapshot = {
  generatedAt: string;
  root: string;
  plugins: BridgedPluginState[];
  discovery: {
    total: number;
    valid: number;
    loadEligible: number;
    selected: number;
    failed?: number;
  } | null;
  commands: string[];
  metrics?: Pick<
    PluginOsObservabilitySnapshot,
    'health' | 'funnel' | 'marketplace' | 'bootstrap' | 'receipts' | 'mcp' | 'deepLinks' | 'hotFindings'
  > | null;
  curatedMarketplace?: PluginOsControlPlaneMarketplaceEntry[];
  deepLinks?: string[];
};

export type PluginOsControlPlaneRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  discovery?: PluginDiscoveryService;
  curated?: PluginCuratedMarketplaceService;
  observability?: PluginOsObservabilityService;
};

const PLUGIN_COMMANDS = [
  'list',
  'install',
  'uninstall',
  'enable',
  'disable',
  'inspect',
  'doctor',
  'marketplace',
  'search',
  'recommend',
  'metrics',
  'telemetry',
  'onboarding',
  'agent-surface',
  'dev',
  'scaffold',
  'trust',
  'os',
  'plane',
  'status',
  'test',
  'forge',
  'mcp',
] as const;

export class PluginOsControlPlaneService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly discovery: PluginDiscoveryService | null;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly observability: PluginOsObservabilityService;

  constructor(runtime: PluginOsControlPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.discovery = runtime.discovery || null;
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
    });
    this.observability = runtime.observability || new PluginOsObservabilityService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      discovery: this.discovery || undefined,
      curated: this.curated,
    });
  }

  public buildSnapshot(root?: string): PluginOsControlPlaneSnapshot {
    const projectRoot = path.resolve(root || this.projectRoot);
    const plugins = this.bridge.list();
    let discovery: PluginOsControlPlaneSnapshot['discovery'] = null;

    try {
      const service = this.discovery || new PluginDiscoveryService({
        now: this.now,
        projectRoot,
        stateLookup: this.bridge.asStateLookup(),
      });
      const snapshot = service.discover({ projectRoot });
      discovery = {
        total: snapshot.summary.total,
        valid: snapshot.summary.valid,
        loadEligible: snapshot.summary.loadEligible,
        selected: snapshot.summary.selected,
        failed: Math.max(0, snapshot.summary.selected - snapshot.summary.loadEligible),
      };
    } catch {
      discovery = null;
    }

    let metrics: PluginOsControlPlaneSnapshot['metrics'] = null;
    try {
      const obs = this.observability.buildSnapshot(projectRoot);
      metrics = {
        health: obs.health,
        funnel: obs.funnel,
        marketplace: obs.marketplace,
        bootstrap: obs.bootstrap,
        receipts: obs.receipts,
        mcp: obs.mcp,
        deepLinks: obs.deepLinks,
        hotFindings: obs.hotFindings,
      };
    } catch {
      metrics = null;
    }

    const enabledIds = new Set(plugins.filter((p) => p.enabled).map((p) => p.pluginId));
    const installedIds = new Set(plugins.filter((p) => p.installed).map((p) => p.pluginId));
    let curatedMarketplace: PluginOsControlPlaneMarketplaceEntry[] = [];
    try {
      const catalog = this.curated.list({ root: projectRoot });
      curatedMarketplace = catalog.entries.map((entry) => ({
        id: entry.id,
        name: entry.name || entry.id,
        summary: entry.summary,
        tier: entry.tier,
        moduleKind: entry.moduleKind,
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
        enabled: enabledIds.has(entry.id),
        installed: installedIds.has(entry.id),
        enableHint: `zavorth plugins enable ${entry.id} --yes`,
      }));
    } catch {
      curatedMarketplace = [];
    }

    return {
      generatedAt: this.now().toISOString(),
      root: projectRoot,
      plugins,
      discovery,
      commands: [...PLUGIN_COMMANDS],
      metrics,
      curatedMarketplace,
      deepLinks: metrics?.deepLinks || [
        'zavorth plugins plane',
        'zavorth plugins metrics',
        'GET /api/plugin-os',
      ],
    };
  }

  public formatSnapshotText(snapshot?: PluginOsControlPlaneSnapshot | null): string {
    const view = snapshot || this.buildSnapshot();
    const lines = [
      'Zavorth Plugin OS control plane',
      `Generated: ${view.generatedAt}`,
      `Root: ${view.root}`,
      `Bridged plugins: ${view.plugins.length}`,
      `Installed: ${view.plugins.filter((entry) => entry.installed).length}`,
      `Enabled: ${view.plugins.filter((entry) => entry.enabled).length}`,
      `Blocked: ${view.plugins.filter((entry) => entry.trust === 'blocked').length}`,
    ];

    if (view.metrics) {
      lines.push(`Health: ${view.metrics.health}`);
      lines.push(
        `Funnel: discovered=${view.metrics.funnel.discovered} eligible=${view.metrics.funnel.loadEligible} enabled=${view.metrics.funnel.enabled}`,
      );
      lines.push(
        `Marketplace first-party: ${view.metrics.marketplace.firstPartyEnabled}/${view.metrics.marketplace.firstPartyTotal}`,
      );
    }

    if (view.discovery) {
      lines.push(
        `Discovery: total=${view.discovery.total} valid=${view.discovery.valid} eligible=${view.discovery.loadEligible} selected=${view.discovery.selected}`,
      );
    } else {
      lines.push('Discovery: unavailable');
    }

    lines.push('', 'Plugins:');
    if (view.plugins.length === 0) {
      lines.push('  (none)');
    } else {
      for (const entry of view.plugins.slice(0, 40)) {
        lines.push(
          `  - ${entry.pluginId} installed=${entry.installed} enabled=${entry.enabled} trust=${entry.trust} state=${entry.runtimeState}`,
        );
      }
    }

    if (view.curatedMarketplace && view.curatedMarketplace.length > 0) {
      lines.push('', `Curated marketplace (${view.curatedMarketplace.length}):`);
      for (const entry of view.curatedMarketplace.slice(0, 20)) {
        lines.push(
          `  ? ${entry.id} [${entry.tier || 'curated'}] ${entry.enabled ? 'on' : 'off'} — ${entry.summary || entry.name}`,
        );
      }
    }

    lines.push('', 'Commands:', ...view.commands.map((command) => ` ? plugins ${command}`));
    if (view.deepLinks && view.deepLinks.length > 0) {
      lines.push('', 'Deep links:', ...view.deepLinks.slice(0, 10).map((link) => ` ? ${link}`));
    }
    return lines.join('\n');
  }
}
