import fs from 'node:fs';
import path from 'node:path';

import { PluginStateBridgeService } from './PluginStateBridgeService.js';

export type PluginOsBootstrapConfig = {
  schemaVersion?: string;
  autoEnableFirstParty?: boolean;
  autoEnableExamples?: boolean;
  respectUserDisable?: boolean;
  excludeIds?: string[];
  includeIds?: string[];
  notes?: string[];
};

export type PluginOsBootstrapApplyResult = {
  ok: boolean;
  enabled: string[];
  skipped: Array<{ pluginId: string; reason: string }>;
  missing: string[];
  configPath: string | null;
  catalogPath: string | null;
  findings: string[];
  formatText(): string;
};

export type PluginOsBootstrapCatalogServiceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
};

type CatalogEntry = {
  id: string;
  tier?: string;
  version?: string;
  source?: string;
};

const DEFAULT_CONFIG: Required<
  Pick<
    PluginOsBootstrapConfig,
    'autoEnableFirstParty' | 'autoEnableExamples' | 'respectUserDisable'
  >
> & {
  excludeIds: string[];
  includeIds: string[];
} = {
  autoEnableFirstParty: true,
  autoEnableExamples: false,
  respectUserDisable: true,
  excludeIds: [],
  includeIds: [],
};

/**
 * Pre-bootstrap catalog: mark first-party (and optional example) plugins
 * installed+enabled so PluginDiscoveryService treats them as loadEligible.
 */
export class PluginOsBootstrapCatalogService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;

  constructor(runtime: PluginOsBootstrapCatalogServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.injectedBridge = runtime.stateBridge || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
  }

  public configPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), 'config', 'plugin-os-bootstrap.json');
  }

  public catalogPath(root?: string): string {
    return path.join(
      path.resolve(root || this.projectRoot),
      'config',
      'plugin-marketplace-curated.json',
    );
  }

  public loadConfig(options: { root?: string } = {}): PluginOsBootstrapConfig {
    const root = path.resolve(options.root || this.projectRoot);
    const filePath = this.configPath(root);
    if (!this.existsSync(filePath)) {
      return { ...DEFAULT_CONFIG };
    }
    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as PluginOsBootstrapConfig;
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        excludeIds: Array.isArray(raw.excludeIds) ? raw.excludeIds.map(String) : [],
        includeIds: Array.isArray(raw.includeIds) ? raw.includeIds.map(String) : [],
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  public resolveTargetIds(options: { root?: string; config?: PluginOsBootstrapConfig } = {}): string[] {
    const root = path.resolve(options.root || this.projectRoot);
    const config = options.config || this.loadConfig({ root });
    const byId = new Map<string, string>();

    const catalog = this.readCatalog(root);
    for (const entry of catalog) {
      const id = normalizeId(entry.id);
      if (!id) continue;
      const tier = String(entry.tier || '').toLowerCase();
      if (tier === 'first-party' && config.autoEnableFirstParty !== false) {
        byId.set(id, entry.version || '1.0.0');
      } else if (tier === 'example' && config.autoEnableExamples === true) {
        byId.set(id, entry.version || '1.0.0');
      }
    }

    // Fallback: scan plugins/ when catalog is empty or missing tiers
    if (byId.size === 0 && config.autoEnableFirstParty !== false) {
      for (const id of this.scanPluginIds(path.join(root, 'plugins'))) {
        if (id !== 'examples') {
          byId.set(id, '1.0.0');
        }
      }
    }

    for (const id of config.includeIds || []) {
      const normalized = normalizeId(id);
      if (normalized) byId.set(normalized, byId.get(normalized) || '1.0.0');
    }

    const exclude = new Set((config.excludeIds || []).map(normalizeId).filter(Boolean));
    return Array.from(byId.keys())
      .filter((id) => !exclude.has(id))
      .sort((a, b) => a.localeCompare(b));
  }

  public apply(options: {
    root?: string;
    force?: boolean;
  } = {}): PluginOsBootstrapApplyResult {
    const root = path.resolve(options.root || this.projectRoot);
    const findings: string[] = [];
    const enabled: string[] = [];
    const skipped: Array<{ pluginId: string; reason: string }> = [];
    const missing: string[] = [];

    if (process.env.ZAVORTH_PLUGIN_OS_BOOTSTRAP === '0') {
      return finish({
        ok: true,
        enabled,
        skipped: [{ pluginId: '*', reason: 'ZAVORTH_PLUGIN_OS_BOOTSTRAP=0' }],
        missing,
        configPath: rel(root, this.configPath(root)),
        catalogPath: rel(root, this.catalogPath(root)),
        findings: ['bootstrap catalog disabled by environment'],
      });
    }

    const config = this.loadConfig({ root });
    if (config.autoEnableFirstParty === false && config.autoEnableExamples !== true) {
      return finish({
        ok: true,
        enabled,
        skipped: [{ pluginId: '*', reason: 'autoEnableFirstParty=false' }],
        missing,
        configPath: rel(root, this.configPath(root)),
        catalogPath: rel(root, this.catalogPath(root)),
        findings: ['bootstrap catalog auto-enable disabled in config'],
      });
    }

    const targets = this.resolveTargetIds({ root, config });
    findings.push(`targets=${targets.length}`);

    const bridge = this.injectedBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: root,
    });

    for (const pluginId of targets) {
      const packageDir = this.findPackageDir(root, pluginId);
      if (!packageDir) {
        missing.push(pluginId);
        skipped.push({ pluginId, reason: 'package_not_found' });
        continue;
      }

      const current = bridge.resolve(pluginId);
      if (current.trust === 'blocked') {
        skipped.push({ pluginId, reason: 'trust_blocked' });
        continue;
      }

      if (
        config.respectUserDisable !== false
        && current.installed
        && current.enabled === false
        && options.force !== true
      ) {
        skipped.push({ pluginId, reason: 'user_disabled' });
        continue;
      }

      if (current.installed && current.enabled && options.force !== true) {
        skipped.push({ pluginId, reason: 'already_enabled' });
        continue;
      }

      try {
        const relative = path.relative(root, packageDir).replace(/\\/gu, '/');
        bridge.markInstalled({
          pluginId,
          revision: this.readPackageVersion(packageDir) || '1.0.0',
          sourceLocator: relative.startsWith('.') ? relative : `./${relative}`,
          sourceTrusted: true,
          trust: 'trusted',
          enable: true,
        });
        enabled.push(pluginId);
      } catch (error) {
        skipped.push({
          pluginId,
          reason: `enable_failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    findings.push(`enabled=${enabled.length} skipped=${skipped.length} missing=${missing.length}`);

    return finish({
      ok: true,
      enabled,
      skipped,
      missing,
      configPath: rel(root, this.configPath(root)),
      catalogPath: rel(root, this.catalogPath(root)),
      findings,
    });
  }

  private readCatalog(root: string): CatalogEntry[] {
    const filePath = this.catalogPath(root);
    if (!this.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as unknown;
      if (!Array.isArray(raw)) return [];
      const entries: CatalogEntry[] = [];
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const id = normalizeId(String(record.id || ''));
        if (!id) continue;
        entries.push({
          id,
          tier: record.tier ? String(record.tier) : undefined,
          version: record.version ? String(record.version) : undefined,
          source: record.source ? String(record.source) : undefined,
        });
      }
      return entries;
    } catch {
      return [];
    }
  }

  private findPackageDir(root: string, pluginId: string): string | null {
    const candidates = [
      path.join(root, 'plugins', pluginId),
      path.join(root, 'plugins', 'examples', pluginId),
      path.join(root, '.zavorth', 'plugins', pluginId),
    ];
    for (const candidate of candidates) {
      if (this.existsSync(path.join(candidate, 'manifest.json'))) {
        return candidate;
      }
    }
    return null;
  }

  private scanPluginIds(dir: string): string[] {
    if (!this.existsSync(dir)) return [];
    try {
      return this.readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .filter((name) => this.existsSync(path.join(dir, name, 'manifest.json')));
    } catch {
      return [];
    }
  }

  private readPackageVersion(packageDir: string): string | null {
    try {
      const manifestPath = path.join(packageDir, 'manifest.json');
      if (!this.existsSync(manifestPath)) return null;
      const raw = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as { version?: unknown };
      return raw.version ? String(raw.version) : null;
    } catch {
      return null;
    }
  }
}

function finish(input: Omit<PluginOsBootstrapApplyResult, 'formatText'>): PluginOsBootstrapApplyResult {
  return {
    ...input,
    formatText() {
      const lines = [
        'Plugin OS bootstrap catalog',
        `ok=${input.ok} enabled=${input.enabled.length} skipped=${input.skipped.length} missing=${input.missing.length}`,
        input.configPath ? `config: ${input.configPath}` : null,
        input.catalogPath ? `catalog: ${input.catalogPath}` : null,
        ...input.enabled.map((id) => `  + ${id}`),
        ...input.skipped.slice(0, 40).map((item) => `  ~ ${item.pluginId}: ${item.reason}`),
        ...input.missing.map((id) => `  ? missing ${id}`),
        ...input.findings.map((line) => `  - ${line}`),
      ].filter(Boolean) as string[];
      return lines.join('\n');
    },
  };
}

function normalizeId(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function rel(root: string, absolute: string): string | null {
  try {
    if (!absolute) return null;
    return path.relative(root, absolute).replace(/\\/gu, '/');
  } catch {
    return absolute;
  }
}
