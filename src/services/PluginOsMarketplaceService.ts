import fs from 'node:fs';
import path from 'node:path';

import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import {
  PluginMarketplaceInstallService,
  type MarketplaceCatalogEntry,
  type PluginMarketplaceInstallResult,
} from './PluginMarketplaceInstallService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginOsPermissionPreviewService } from './PluginOsPermissionPreviewService.js';
import { PluginUrlInstallService } from './PluginUrlInstallService.js';

export type PluginOsMarketplaceEntry = {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  version?: string;
  moduleKind?: string;
  tier?: string;
  tags?: string[];
  permissions?: string[];
  source?: string;
  sourceLocator?: string | null;
  signed?: boolean;
  curated?: boolean;
  installed?: boolean;
  enabled?: boolean;
  trust?: string;
  origin: 'curated' | 'remote' | 'local' | 'bundled';
};

export type PluginOsMarketplaceListResult = {
  ok: boolean;
  query: string | null;
  total: number;
  entries: PluginOsMarketplaceEntry[];
  sources: Array<{ kind: string; path?: string; count: number }>;
  findings: string[];
  formatText(): string;
};

export type PluginOsMarketplacePreviewResult = {
  ok: boolean;
  entry: PluginOsMarketplaceEntry | null;
  canInstall: boolean;
  canEnable: boolean;
  installTarget: string | null;
  bundledPath: string | null;
  remoteUrl: string | null;
  permissionPreview: ReturnType<PluginOsPermissionPreviewService['preview']> | null;
  steps: string[];
  message: string;
  formatText(): string;
};

export type PluginOsMarketplaceInstallOutcome = {
  ok: boolean;
  pluginId: string;
  method: 'bundled-copy' | 'materialize' | 'url' | 'already-present' | 'none';
  packageDir: string | null;
  enabled: boolean;
  message: string;
  install?: PluginMarketplaceInstallResult;
  findings: string[];
  formatText(): string;
};

export type PluginOsMarketplaceServiceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  curated?: PluginCuratedMarketplaceService;
  installService?: PluginMarketplaceInstallService;
  stateBridge?: PluginStateBridgeService;
  permissionPreview?: PluginOsPermissionPreviewService;
  urlInstall?: PluginUrlInstallService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  cpSync?: typeof fs.cpSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

const PORTABLE_BUILTIN_MARKETPLACE_ENTRIES: PluginOsMarketplaceEntry[] = [
  {
    id: 'zavorth-plugin-workspace-inspector',
    name: 'Workspace Inspector',
    summary: 'Read-only workspace analysis with governed receipts.',
    version: '1.0.0',
    moduleKind: 'tool',
    tier: 'first-party',
    tags: ['workspace', 'inspect', 'read-only', 'diagnostics'],
    permissions: ['workspace:read'],
    source: 'builtin://workspace-inspector',
    sourceLocator: 'builtin://workspace-inspector',
    signed: true,
    curated: true,
    installed: false,
    enabled: false,
    trust: 'trusted',
    origin: 'bundled',
  },
];

/**
 * Product marketplace facade: list curated/remote, preview trust, install, enable.
 * Never auto-enables unless options.enable === true.
 */
export class PluginOsMarketplaceService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly installService: PluginMarketplaceInstallService;
  private readonly bridge: PluginStateBridgeService;
  private readonly permissionPreviewService: PluginOsPermissionPreviewService;
  private readonly urlInstall: PluginUrlInstallService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly cpSync: typeof fs.cpSync | null;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: PluginOsMarketplaceServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
      now: this.now,
    });
    this.installService = runtime.installService || new PluginMarketplaceInstallService({
      projectRoot: this.projectRoot,
      bridge: this.bridge,
      now: this.now,
    });
    this.permissionPreviewService = runtime.permissionPreview || new PluginOsPermissionPreviewService({
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
    });
    this.urlInstall = runtime.urlInstall || new PluginUrlInstallService({
      projectRoot: this.projectRoot,
      now: this.now,
    });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.cpSync = runtime.cpSync
      || (typeof fs.cpSync === 'function' ? fs.cpSync.bind(fs) : null);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public list(options: {
    root?: string;
    query?: string;
    includeRemote?: boolean;
    limit?: number;
  } = {}): PluginOsMarketplaceListResult {
    const root = path.resolve(options.root || this.projectRoot);
    const query = String(options.query || '').trim().toLowerCase() || null;
    const limit = Math.max(1, Math.min(500, Number(options.limit) || 200));
    const findings: string[] = [];
    const sources: PluginOsMarketplaceListResult['sources'] = [];
    const byId = new Map<string, PluginOsMarketplaceEntry>();

    const curated = this.curated.list({
      root,
      query: query || undefined,
      includeRemote: options.includeRemote !== false,
    });
    findings.push(...(curated.findings || []));
    for (const source of curated.sources || []) {
      sources.push({ kind: source.kind, path: source.path, count: source.count });
    }
    for (const entry of curated.entries || []) {
      const id = String(entry.id || '').trim();
      if (!id) continue;
      const origin = String(entry.source || '').startsWith('http') ? 'remote'
        : entry.curated ? 'curated'
          : 'local';
      byId.set(id, this.enrich(entry as Record<string, unknown>, origin as PluginOsMarketplaceEntry['origin'], root));
    }

    for (const entry of PORTABLE_BUILTIN_MARKETPLACE_ENTRIES) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, this.enrich(entry as unknown as Record<string, unknown>, 'bundled', root));
      }
    }

    // Also surface any first-party packages on disk that might not be in curated (soft).
    const pluginsRoot = path.join(root, 'plugins');
    if (this.existsSync(pluginsRoot)) {
      let bundledCount = 0;
      try {
        for (const name of this.readdirSync(pluginsRoot, { withFileTypes: true })) {
          if (!name.isDirectory() || name.name === 'examples') continue;
          const id = name.name;
          const manifestPath = path.join(pluginsRoot, id, 'manifest.json');
          if (!this.existsSync(manifestPath)) continue;
          bundledCount += 1;
          if (byId.has(id)) {
            const current = byId.get(id)!;
            current.origin = current.origin === 'remote' ? current.origin : 'bundled';
            continue;
          }
          try {
            const raw = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
            byId.set(id, this.enrich({
              id,
              name: raw.label || raw.name || id,
              summary: raw.summary || '',
              version: raw.version || '1.0.0',
              moduleKind: raw.moduleKind || 'tool',
              tags: raw.tags || [],
              source: `bundled://${id}`,
              tier: 'first-party',
            }, 'bundled', root));
          } catch {
            /* skip broken */
          }
        }
      } catch {
        /* soft */
      }
      sources.push({ kind: 'bundled', path: 'plugins/', count: bundledCount });
    }

    let entries = Array.from(byId.values());
    if (query) {
      entries = entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query));
    }
    entries.sort((a, b) => a.id.localeCompare(b.id));
    const total = entries.length;
    entries = entries.slice(0, limit);

    return {
      ok: true,
      query,
      total,
      entries,
      sources,
      findings,
      formatText() {
        const lines = [
          'Plugin OS marketplace',
          query ? `query: ${query}` : 'query: <all>',
          `total: ${total} (showing ${entries.length})`,
          ...sources.map((s) => `source ${s.kind}${s.path ? ` ${s.path}` : ''}: ${s.count}`),
          '',
          ...entries.map((e) => (
            `- ${e.id} | ${e.name || e.id}`
            + ` | ${e.tier || e.origin}`
            + (e.installed ? ' [installed]' : '')
            + (e.enabled ? ' [enabled]' : '')
            + (e.signed ? ' [signed]' : '')
            + (e.summary ? ` — ${e.summary}` : '')
          )),
        ];
        if (findings.length) {
          lines.push('', 'findings:', ...findings.map((f) => ` ? ${f}`));
        }
        return lines.join('\n');
      },
    };
  }

  public get(pluginId: string, options: { root?: string } = {}): PluginOsMarketplaceEntry | null {
    const id = String(pluginId || '').trim();
    if (!id) return null;
    // Exact id/name match only — do not use fuzzy query (avoids partial false hits).
    const listed = this.list({ root: options.root, limit: 500 });
    return listed.entries.find((e) => e.id === id || e.name === id) || null;
  }

  public preview(pluginId: string, options: { root?: string } = {}): PluginOsMarketplacePreviewResult {
    const root = path.resolve(options.root || this.projectRoot);
    const entry = this.get(pluginId, { root });
    if (!entry) {
      return {
        ok: false,
        entry: null,
        canInstall: false,
        canEnable: false,
        installTarget: null,
        bundledPath: null,
        remoteUrl: null,
        permissionPreview: null,
        steps: [],
        message: `Marketplace entry not found: ${pluginId}`,
        formatText() {
          return this.message;
        },
      };
    }

    const bundledPath = this.resolveBundledPackageDir(root, entry.id);
    const remoteUrl = this.resolveRemoteUrl(entry);
    const installTarget = path.join(root, '.zavorth', 'plugins', entry.id);
    let permissionPreview: ReturnType<PluginOsPermissionPreviewService['preview']> | null = null;
    try {
      permissionPreview = this.permissionPreviewService.preview(entry.id, root);
    } catch {
      permissionPreview = null;
    }

    const steps = [
      bundledPath ? `Install copies first-party package from plugins/${entry.id}`
        : remoteUrl ? `Install downloads ${remoteUrl}`
          : 'Install materializes a soft Plugin OS package under .zavorth/plugins/',
      'Enable requires explicit --enable or plugins enable --yes (never automatic).',
      'Review permissions before enable.',
    ];

    return {
      ok: true,
      entry,
      canInstall: true,
      canEnable: entry.installed === true || Boolean(bundledPath),
      installTarget,
      bundledPath,
      remoteUrl,
      permissionPreview,
      steps,
      message: `Preview ${entry.id}: ${entry.summary || entry.name || 'marketplace package'}`,
      formatText() {
        return [
          `Marketplace preview: ${entry.id}`,
          `name: ${entry.name}`,
          `summary: ${entry.summary || ''}`,
          `tier: ${entry.tier || entry.origin}`,
          `installed: ${entry.installed ? 'yes' : 'no'}`,
          `enabled: ${entry.enabled ? 'yes' : 'no'}`,
          `trust: ${entry.trust || 'review'}`,
          bundledPath ? `bundled: ${path.relative(root, bundledPath)}` : 'bundled: n/a',
          remoteUrl ? `remote: ${remoteUrl}` : 'remote: n/a',
          `target: ${path.relative(root, installTarget)}`,
          '',
          'Steps:',
          ...steps.map((s) => ` ? ${s}`),
          '',
          'Next:',
          `  zavorth plugins install marketplace:${entry.id} --yes`,
          `  zavorth plugins install marketplace:${entry.id} --yes --enable`,
        ].join('\n');
      },
    };
  }

  public async install(
    pluginId: string,
    options: { root?: string; enable?: boolean; force?: boolean } = {},
  ): Promise<PluginOsMarketplaceInstallOutcome> {
    const root = path.resolve(options.root || this.projectRoot);
    const enable = options.enable === true;
    const force = options.force === true;
    const findings: string[] = [];
    const entry = this.get(pluginId, { root });
    if (!entry) {
      return failInstall(pluginId, `Marketplace entry not found: ${pluginId}`);
    }

    const bundled = this.resolveBundledPackageDir(root, entry.id);
    const remoteUrl = this.resolveRemoteUrl(entry);
    const targetDir = path.join(root, '.zavorth', 'plugins', entry.id);

    try {
      // 1) Prefer real first-party package copy
      if (bundled && this.cpSync) {
        if (force && this.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        if (!this.existsSync(targetDir) || force) {
          this.mkdirSync(path.dirname(targetDir), { recursive: true });
          this.cpSync(bundled, targetDir, { recursive: true });
          findings.push(`copied bundled package from plugins/${entry.id}`);
        } else {
          findings.push('bundled package already present under .zavorth/plugins');
        }
        const bridged = this.bridge.markInstalled({
          pluginId: entry.id,
          revision: entry.version || '1.0.0',
          sourceLocator: entry.source || `bundled://${entry.id}`,
          sourceTrusted: entry.signed === true,
          trust: 'review',
          enable,
        });
        this.syncCliRecord(root, entry, targetDir, enable);
        return {
          ok: true,
          pluginId: entry.id,
          method: force || findings.some((f) => f.includes('copied')) ? 'bundled-copy' : 'already-present',
          packageDir: targetDir,
          enabled: bridged.enabled === true || enable,
          message: `Installed ${entry.id} from bundled first-party package.`,
          findings,
          formatText() {
            return [
              `Marketplace install OK: ${entry.id}`,
              `method: bundled-copy`,
              `package: ${path.relative(root, targetDir)}`,
              `enabled: ${enable ? 'yes' : 'no'}`,
              ...findings.map((f) => ` ? ${f}`),
            ].join('\n');
          },
        };
      }

      // 2) HTTPS source
      if (remoteUrl && this.urlInstall.isUrlSpec(remoteUrl)) {
        const downloaded = await this.urlInstall.downloadAndExtract(remoteUrl);
        if (!downloaded.ok || !downloaded.packageDir) {
          findings.push(downloaded.error || 'url install failed');
          // fall through to materialize
        } else {
          this.bridge.markInstalled({
            pluginId: entry.id,
            revision: entry.version || '1.0.0',
            sourceLocator: remoteUrl,
            sourceTrusted: entry.signed === true,
            trust: 'review',
            enable,
          });
          this.syncCliRecord(root, entry, downloaded.packageDir, enable);
          return {
            ok: true,
            pluginId: entry.id,
            method: 'url',
            packageDir: downloaded.packageDir,
            enabled: enable,
            message: `Installed ${entry.id} from remote URL.`,
            findings: [...findings, `url: ${remoteUrl}`],
            formatText() {
              return `Marketplace install OK: ${entry.id} (url) → ${downloaded.packageDir}`;
            },
          };
        }
      }

      // 3) Soft materialize local package
      const catalogEntry: MarketplaceCatalogEntry = {
        id: entry.id,
        name: entry.name,
        summary: entry.summary,
        description: entry.description,
        version: entry.version,
        moduleKind: entry.moduleKind,
        permissions: entry.permissions,
        tags: entry.tags,
        sourceLocator: entry.sourceLocator || entry.source || `marketplace://${entry.id}`,
      };
      const installed = this.installService.materialize(catalogEntry, { enable, force });
      this.syncCliRecord(root, entry, installed.packageDir, enable);
      return {
        ok: true,
        pluginId: installed.pluginId,
        method: 'materialize',
        packageDir: installed.packageDir,
        enabled: enable,
        message: `Materialized marketplace package ${installed.pluginId}.`,
        install: installed,
        findings,
        formatText() {
          return [
            `Marketplace install OK: ${installed.pluginId}`,
            `method: materialize`,
            `package: ${path.relative(root, installed.packageDir)}`,
            `enabled: ${enable ? 'yes' : 'no'}`,
          ].join('\n');
        },
      };
    } catch (error) {
      return failInstall(
        entry.id,
        error instanceof Error ? error.message : String(error),
        findings,
      );
    }
  }

  public async refreshRemote(options: { root?: string; url?: string } = {}) {
    return this.curated.refreshRemote(options);
  }

  private enrich(
    raw: Record<string, unknown>,
    origin: PluginOsMarketplaceEntry['origin'],
    root: string,
  ): PluginOsMarketplaceEntry {
    const id = String(raw.id || '').trim();
    const bridged = this.bridge.resolve(id);
    const permissions = Array.isArray(raw.permissions)
      ? raw.permissions.map(String)
      : [];
    return {
      id,
      name: String(raw.name || raw.label || id),
      summary: raw.summary ? String(raw.summary) : undefined,
      description: raw.description ? String(raw.description) : undefined,
      version: raw.version ? String(raw.version) : '1.0.0',
      moduleKind: raw.moduleKind ? String(raw.moduleKind) : undefined,
      tier: raw.tier ? String(raw.tier) : origin === 'bundled' ? 'first-party' : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      permissions,
      source: raw.source ? String(raw.source) : raw.sourceLocator ? String(raw.sourceLocator) : undefined,
      sourceLocator: raw.sourceLocator ? String(raw.sourceLocator) : raw.source ? String(raw.source) : null,
      signed: raw.signed === true,
      curated: raw.curated === true || origin === 'curated',
      installed: bridged.installed === true || this.existsSync(path.join(root, '.zavorth', 'plugins', id)),
      enabled: bridged.enabled === true,
      trust: bridged.trust,
      origin,
    };
  }

  private resolveBundledPackageDir(root: string, pluginId: string): string | null {
    const candidates = [
      path.join(root, 'plugins', pluginId),
      path.join(root, 'plugins', 'examples', pluginId),
    ];
    for (const dir of candidates) {
      if (this.existsSync(path.join(dir, 'manifest.json'))) {
        return dir;
      }
    }
    return null;
  }

  private resolveRemoteUrl(entry: PluginOsMarketplaceEntry): string | null {
    const source = String(entry.source || entry.sourceLocator || '').trim();
    if (/^https:\/\//iu.test(source)) return source;
    return null;
  }

  private syncCliRecord(
    root: string,
    entry: PluginOsMarketplaceEntry,
    packageDir: string,
    enabled: boolean,
  ): void {
    try {
      const relativeDir = path.relative(root, packageDir).replace(/\\/gu, '/');
      const records = this.bridge.readCliRecords();
      const existing = records.find((record) => String(record.id || '') === entry.id);
      const next = {
        ...(existing || {}),
        id: entry.id,
        spec: relativeDir.startsWith('.') ? relativeDir : `./${relativeDir}`,
        name: entry.name || entry.id,
        version: entry.version || '1.0.0',
        status: 'installed',
        enabled,
        manifestFound: true,
        entry: 'index.js',
        permissions: entry.permissions || [],
        updatedAt: this.now().toISOString(),
        installedAt: existing?.installedAt || this.now().toISOString(),
      };
      if (existing) {
        Object.assign(existing, next);
      } else {
        records.push(next);
      }
      this.bridge.writeCliRecords(records);
      this.bridge.syncRuntimeIndex();
    } catch {
      /* soft */
    }
  }
}

function failInstall(
  pluginId: string,
  message: string,
  findings: string[] = [],
): PluginOsMarketplaceInstallOutcome {
  return {
    ok: false,
    pluginId,
    method: 'none',
    packageDir: null,
    enabled: false,
    message,
    findings,
    formatText() {
      return `Marketplace install failed: ${pluginId}\n  ${message}`;
    },
  };
}
