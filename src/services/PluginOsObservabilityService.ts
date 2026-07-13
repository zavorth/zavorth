import fs from 'node:fs';
import path from 'node:path';

import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginDiscoveryService } from './PluginDiscoveryService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import { PluginOsBootstrapCatalogService } from './PluginOsBootstrapCatalogService.js';
import { PluginMcpBridgeService } from './PluginMcpBridgeService.js';

export type PluginOsFunnelMetrics = {
  discovered: number;
  valid: number;
  selected: number;
  loadEligible: number;
  installed: number;
  enabled: number;
  blocked: number;
  failedValidation: number;
  ineligible: number;
};

export type PluginOsMarketplaceCoverage = {
  curatedTotal: number;
  firstPartyTotal: number;
  firstPartyEnabled: number;
  firstPartyMissing: string[];
  exampleTotal: number;
};

export type PluginOsBootstrapMetrics = {
  autoEnableFirstParty: boolean;
  targets: number;
  lastEnabledCount: number | null;
  lastSkippedCount: number | null;
  lastMissingCount: number | null;
  configPath: string | null;
};

export type PluginOsReceiptMetrics = {
  forgeReceiptFiles: number;
  ledgerLines: number;
  latestForgeReceipt: string | null;
  latestLedgerKind: string | null;
};

export type PluginOsMcpMetrics = {
  serversConfigured: number;
  serversEnabled: number;
  materializable: string[];
};

export type PluginOsObservabilitySnapshot = {
  generatedAt: string;
  root: string;
  funnel: PluginOsFunnelMetrics;
  marketplace: PluginOsMarketplaceCoverage;
  bootstrap: PluginOsBootstrapMetrics;
  receipts: PluginOsReceiptMetrics;
  mcp: PluginOsMcpMetrics;
  hotFindings: Array<{ pluginId: string; findings: string[] }>;
  deepLinks: string[];
  health: 'healthy' | 'degraded' | 'empty';
  formatText(): string;
};

export type PluginOsObservabilityRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  discovery?: PluginDiscoveryService;
  curated?: PluginCuratedMarketplaceService;
  bootstrapCatalog?: PluginOsBootstrapCatalogService;
  mcpBridge?: PluginMcpBridgeService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

/**
 * Aggregates Plugin OS load funnel, curated coverage, bootstrap, receipts and MCP
 * into a single observability snapshot for CLI / HTTP / desktop.
 */
export class PluginOsObservabilityService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly discovery: PluginDiscoveryService | null;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly bootstrapCatalog: PluginOsBootstrapCatalogService;
  private readonly mcpBridge: PluginMcpBridgeService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: PluginOsObservabilityRuntime = {}) {
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
    this.bootstrapCatalog = runtime.bootstrapCatalog || new PluginOsBootstrapCatalogService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
    });
    this.mcpBridge = runtime.mcpBridge || new PluginMcpBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public buildSnapshot(root?: string): PluginOsObservabilitySnapshot {
    const projectRoot = path.resolve(root || this.projectRoot);
    const bridged = this.bridge.list();
    const installed = bridged.filter((p) => p.installed).length;
    const enabled = bridged.filter((p) => p.enabled).length;
    const blocked = bridged.filter((p) => p.trust === 'blocked').length;

    let discovered = 0;
    let valid = 0;
    let selected = 0;
    let loadEligible = 0;
    let failedValidation = 0;
    const hotFindings: Array<{ pluginId: string; findings: string[] }> = [];

    try {
      const service = this.discovery || new PluginDiscoveryService({
        now: this.now,
        projectRoot,
        stateLookup: this.bridge.asStateLookup(),
      });
      const snapshot = service.discover({ projectRoot });
      discovered = snapshot.summary.total;
      valid = snapshot.summary.valid;
      selected = snapshot.summary.selected;
      loadEligible = snapshot.summary.loadEligible;
      for (const plugin of snapshot.plugins) {
        if (!plugin.selected) continue;
        const findings = [
          ...(plugin.findings || []),
          ...(plugin.validation?.findings || []),
          ...(plugin.compatibility?.findings || []),
        ].map(String);
        if (!plugin.validation?.ok || !plugin.compatibility?.ok) {
          failedValidation += 1;
        }
        if (findings.length > 0 && (!plugin.loadEligible || !plugin.validation?.ok)) {
          hotFindings.push({
            pluginId: plugin.pluginId,
            findings: findings.slice(0, 8),
          });
        }
      }
    } catch {
      /* soft-fail discovery metrics */
    }

    const ineligible = Math.max(0, selected - loadEligible);
    const catalog = this.curated.list({ root: projectRoot });
    const firstParty = catalog.entries.filter((e) => String(e.tier || '').toLowerCase() === 'first-party');
    const examples = catalog.entries.filter((e) => String(e.tier || '').toLowerCase() === 'example');
    const enabledIds = new Set(bridged.filter((p) => p.enabled).map((p) => p.pluginId));
    const firstPartyMissing = firstParty
      .map((e) => e.id)
      .filter((id) => !enabledIds.has(id));

    const bootConfig = this.bootstrapCatalog.loadConfig({ root: projectRoot });
    const targets = this.bootstrapCatalog.resolveTargetIds({ root: projectRoot, config: bootConfig });
    const lastBootstrap = this.readLastBootstrap(projectRoot);

    const receipts = this.collectReceipts(projectRoot);
    const mcpServers = this.mcpBridge.listServers({ root: projectRoot });

    const funnel: PluginOsFunnelMetrics = {
      discovered,
      valid,
      selected,
      loadEligible,
      installed,
      enabled,
      blocked,
      failedValidation,
      ineligible,
    };

    const health: PluginOsObservabilitySnapshot['health'] =
      discovered === 0 && installed === 0
        ? 'empty'
        : failedValidation > 0 || (selected > 0 && loadEligible === 0)
          ? 'degraded'
          : 'healthy';

    const deepLinks = [
      'zavorth plugins plane',
      'zavorth plugins metrics',
      'zavorth plugins marketplace --curated',
      'zavorth plugins recommend "search the web"',
      'zavorth plugins doctor',
      'GET /api/plugin-os',
      'GET /api/plugin-os/metrics',
      'GET /api/plugin-os/marketplace',
      'POST /api/plugin-os/actions { action, pluginId, approved: true }',
    ];

    const view: Omit<PluginOsObservabilitySnapshot, 'formatText'> = {
      generatedAt: this.now().toISOString(),
      root: projectRoot,
      funnel,
      marketplace: {
        curatedTotal: catalog.entries.length,
        firstPartyTotal: firstParty.length,
        firstPartyEnabled: firstParty.length - firstPartyMissing.length,
        firstPartyMissing: firstPartyMissing.slice(0, 40),
        exampleTotal: examples.length,
      },
      bootstrap: {
        autoEnableFirstParty: bootConfig.autoEnableFirstParty !== false,
        targets: targets.length,
        lastEnabledCount: lastBootstrap?.enabled ?? null,
        lastSkippedCount: lastBootstrap?.skipped ?? null,
        lastMissingCount: lastBootstrap?.missing ?? null,
        configPath: lastBootstrap?.configPath
          || path.relative(projectRoot, this.bootstrapCatalog.configPath(projectRoot)).replace(/\\/gu, '/'),
      },
      receipts,
      mcp: {
        serversConfigured: mcpServers.length,
        serversEnabled: mcpServers.filter((s) => s.enabled).length,
        materializable: mcpServers.map((s) => s.id).slice(0, 40),
      },
      hotFindings: hotFindings.slice(0, 20),
      deepLinks,
      health,
    };

    return {
      ...view,
      formatText: () => formatObservability(view),
    };
  }

  public persistSnapshot(root?: string): {
    ok: boolean;
    path: string | null;
    snapshot: PluginOsObservabilitySnapshot;
  } {
    const snapshot = this.buildSnapshot(root);
    const projectRoot = path.resolve(root || this.projectRoot);
    try {
      const dir = path.join(projectRoot, '.zavorth', 'receipts');
      this.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'plugin-os-metrics.json');
      const payload = {
        kind: 'plugin.os.metrics',
        ...snapshot,
        formatText: undefined,
      };
      this.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

      // Append a compact ledger line for time-series friendliness.
      const ledgerPath = path.join(dir, 'plugins.jsonl');
      const line = `${JSON.stringify({
        id: `plugin-os-metrics-${snapshot.generatedAt}`,
        kind: 'plugin.os.metrics',
        health: snapshot.health,
        funnel: snapshot.funnel,
        marketplace: {
          firstPartyEnabled: snapshot.marketplace.firstPartyEnabled,
          firstPartyTotal: snapshot.marketplace.firstPartyTotal,
        },
        createdAt: snapshot.generatedAt,
      })}\n`;
      fs.appendFileSync(ledgerPath, line, 'utf8');

      return {
        ok: true,
        path: path.relative(projectRoot, filePath).replace(/\\/gu, '/'),
        snapshot,
      };
    } catch {
      return { ok: false, path: null, snapshot };
    }
  }

  public recordBootstrapResult(
    result: {
      enabled?: string[];
      skipped?: unknown[];
      missing?: string[];
      configPath?: string | null;
    },
    root?: string,
  ): void {
    const projectRoot = path.resolve(root || this.projectRoot);
    try {
      const dir = path.join(projectRoot, '.zavorth', 'receipts');
      this.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'plugin-os-bootstrap-last.json');
      this.writeFileSync(
        filePath,
        `${JSON.stringify({
          kind: 'plugin.os.bootstrap',
          enabled: Array.isArray(result.enabled) ? result.enabled.length : 0,
          skipped: Array.isArray(result.skipped) ? result.skipped.length : 0,
          missing: Array.isArray(result.missing) ? result.missing.length : 0,
          enabledIds: Array.isArray(result.enabled) ? result.enabled : [],
          configPath: result.configPath || null,
          createdAt: this.now().toISOString(),
        }, null, 2)}\n`,
        'utf8',
      );
    } catch {
      /* soft-fail */
    }
  }

  private readLastBootstrap(root: string): {
    enabled: number;
    skipped: number;
    missing: number;
    configPath: string | null;
  } | null {
    const filePath = path.join(root, '.zavorth', 'receipts', 'plugin-os-bootstrap-last.json');
    if (!this.existsSync(filePath)) return null;
    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      return {
        enabled: Number(raw.enabled || 0),
        skipped: Number(raw.skipped || 0),
        missing: Number(raw.missing || 0),
        configPath: raw.configPath != null ? String(raw.configPath) : null,
      };
    } catch {
      return null;
    }
  }

  private collectReceipts(root: string): PluginOsReceiptMetrics {
    const forgeDir = path.join(root, '.zavorth', 'plugin-forge', 'receipts');
    const ledgerPath = path.join(root, '.zavorth', 'receipts', 'plugins.jsonl');
    let forgeReceiptFiles = 0;
    let latestForgeReceipt: string | null = null;
    if (this.existsSync(forgeDir)) {
      try {
        const files = this.readdirSync(forgeDir)
          .map(String)
          .filter((name) => name.endsWith('.json'))
          .sort();
        forgeReceiptFiles = files.length;
        latestForgeReceipt = files.length
          ? path.relative(root, path.join(forgeDir, files[files.length - 1])).replace(/\\/gu, '/')
          : null;
      } catch {
        /* soft */
      }
    }

    let ledgerLines = 0;
    let latestLedgerKind: string | null = null;
    if (this.existsSync(ledgerPath)) {
      try {
        const text = this.readFileSync(ledgerPath, 'utf8');
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        ledgerLines = lines.length;
        if (lines.length > 0) {
          try {
            const last = JSON.parse(lines[lines.length - 1]) as { kind?: string };
            latestLedgerKind = last.kind ? String(last.kind) : null;
          } catch {
            latestLedgerKind = null;
          }
        }
      } catch {
        /* soft */
      }
    }

    return {
      forgeReceiptFiles,
      ledgerLines,
      latestForgeReceipt,
      latestLedgerKind,
    };
  }
}

function formatObservability(view: Omit<PluginOsObservabilitySnapshot, 'formatText'>): string {
  const f = view.funnel;
  const lines = [
    'Zavorth Plugin OS metrics',
    `Generated: ${view.generatedAt}`,
    `Root: ${view.root}`,
    `Health: ${view.health}`,
    '',
    'Funnel:',
    `  discovered=${f.discovered} valid=${f.valid} selected=${f.selected} eligible=${f.loadEligible}`,
    `  installed=${f.installed} enabled=${f.enabled} blocked=${f.blocked}`,
    `  failedValidation=${f.failedValidation} ineligible=${f.ineligible}`,
    '',
    'Marketplace:',
    `  curated=${view.marketplace.curatedTotal} firstParty=${view.marketplace.firstPartyEnabled}/${view.marketplace.firstPartyTotal} examples=${view.marketplace.exampleTotal}`,
    view.marketplace.firstPartyMissing.length
      ? `  missing first-party: ${view.marketplace.firstPartyMissing.slice(0, 12).join(', ')}`
      : '  missing first-party: (none)',
    '',
    'Bootstrap:',
    `  autoEnableFirstParty=${view.bootstrap.autoEnableFirstParty} targets=${view.bootstrap.targets}`,
    `  last enabled=${view.bootstrap.lastEnabledCount ?? 'n/a'} skipped=${view.bootstrap.lastSkippedCount ?? 'n/a'} missing=${view.bootstrap.lastMissingCount ?? 'n/a'}`,
    '',
    'Receipts:',
    `  forge files=${view.receipts.forgeReceiptFiles} ledger lines=${view.receipts.ledgerLines}`,
    view.receipts.latestForgeReceipt ? `  latest forge: ${view.receipts.latestForgeReceipt}` : null,
    '',
    'MCP:',
    `  configured=${view.mcp.serversConfigured} enabled=${view.mcp.serversEnabled}`,
    view.mcp.materializable.length
      ? `  servers: ${view.mcp.materializable.join(', ')}`
      : '  servers: (none)',
  ].filter((line) => line !== null) as string[];

  if (view.hotFindings.length > 0) {
    lines.push('', 'Hot findings:');
    for (const item of view.hotFindings.slice(0, 10)) {
      lines.push(`  - ${item.pluginId}: ${item.findings.slice(0, 3).join('; ')}`);
    }
  }

  lines.push('', 'Deep links:', ...view.deepLinks.map((link) => `  - ${link}`));
  return lines.join('\n');
}
