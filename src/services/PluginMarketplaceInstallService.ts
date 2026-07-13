import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import type { ZavorthPluginManifest, ZavorthPluginModuleKind } from '../contracts/PluginManifestContract.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';

export type MarketplaceCatalogEntry = {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  version?: string;
  moduleKind?: string;
  permissions?: string[];
  tags?: string[];
  sourceLocator?: string | null;
};

export type PluginMarketplaceInstallResult = {
  pluginId: string;
  packageDir: string;
  manifestPath: string;
  entryPath: string;
  checksum: string;
  bridged: ReturnType<PluginStateBridgeService['resolve']>;
  created: boolean;
};

export type PluginMarketplaceInstallRuntime = {
  now?: () => Date;
  projectRoot?: string;
  bridge?: PluginStateBridgeService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

const DEFAULT_MODULE_KIND: ZavorthPluginModuleKind = 'module';

export class PluginMarketplaceInstallService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: PluginMarketplaceInstallRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.bridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public materialize(
    entry: MarketplaceCatalogEntry,
    options: { enable?: boolean; force?: boolean } = {},
  ): PluginMarketplaceInstallResult {
    const pluginId = this.normalizeId(entry.id || entry.name);
    if (!pluginId) {
      throw new Error('Marketplace entry id is required.');
    }

    const packageDir = path.join(this.projectRoot, '.zavorth', 'plugins', pluginId);
    const manifestPath = path.join(packageDir, 'manifest.json');
    const entryPath = path.join(packageDir, 'index.js');
    const created = !this.existsSync(manifestPath) || options.force === true;

    if (created) {
      this.mkdirSync(packageDir, { recursive: true });
      const manifest = this.buildManifest(entry, pluginId);
      const indexSource = this.buildEntrypointSource(pluginId, manifest.capabilities[0]?.id || 'main.run');
      this.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      this.writeFileSync(entryPath, indexSource, 'utf8');
      this.writeFileSync(
        path.join(packageDir, 'README.md'),
        [
          `# ${manifest.label}`,
          '',
          manifest.summary,
          '',
          'Installed from the local Plugin OS marketplace catalog.',
          '',
          '```bash',
          `zavorth plugins enable ${pluginId} --yes`,
          `zavorth plugins inspect ${pluginId}`,
          '```',
          '',
        ].join('\n'),
        'utf8',
      );
    }

    const checksum = this.checksumPackage(packageDir);
    const relativeLocator = path.relative(this.projectRoot, packageDir).replace(/\\/g, '/');
    const bridged = this.bridge.markInstalled({
      pluginId,
      revision: String(entry.version || '0.1.0'),
      sourceLocator: entry.sourceLocator || `marketplace://${pluginId}`,
      sourceDigest: checksum,
      sourceTrusted: false,
      trust: 'review',
      enable: options.enable === true,
    });

    const records = this.bridge.readCliRecords();
    const existing = records.find((record) => String(record.id || '') === pluginId);
    if (existing) {
      existing.spec = relativeLocator.startsWith('.') ? relativeLocator : `./${relativeLocator}`;
      existing.status = 'installed';
      existing.version = entry.version || existing.version || '0.1.0';
      existing.checksum = checksum;
      existing.manifestFound = true;
      existing.updatedAt = this.now().toISOString();
      this.bridge.writeCliRecords(records);
    }

    this.bridge.syncRuntimeIndex();

    return {
      pluginId,
      packageDir,
      manifestPath,
      entryPath,
      checksum,
      bridged,
      created,
    };
  }

  private buildManifest(
    entry: MarketplaceCatalogEntry,
    pluginId: string,
  ): ZavorthPluginManifest {
    const label = String(entry.name || pluginId).trim() || pluginId;
    const summary = String(entry.summary || entry.description || `${label} marketplace package`).trim();
    const capabilityId = 'main.run';
    const moduleKind = this.normalizeModuleKind(entry.moduleKind);
    const permissionKinds = this.mapPermissions(entry.permissions || []);

    return {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: pluginId,
      label,
      version: String(entry.version || '0.1.0').trim() || '0.1.0',
      moduleKind,
      summary,
      description: summary,
      tags: Array.from(new Set([...(entry.tags || []), 'marketplace', moduleKind])),
      source: {
        kind: 'registry',
        locator: entry.sourceLocator || `marketplace://${pluginId}`,
        digest: null,
        trusted: false,
      },
      compatibility: {
        zavorthVersion: '>=1.1.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
      capabilities: [
        {
          id: capabilityId,
          intent: `${moduleKind}.run`,
          label: `${label} Run`,
          summary: `Primary capability for ${label}.`,
          artifactKinds: [],
          command: {
            name: pluginId.replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
            aliases: [],
            usage: null,
          },
        },
      ],
      permissions: permissionKinds.map((kind) => ({
        kind,
        scope: kind.startsWith('network') ? 'external' as const : 'workspace' as const,
        reason: `Marketplace catalog declared ${kind}`,
        required: true,
      })),
      entrypoint: {
        module: './index.js',
        exportName: 'register',
        runtime: 'node',
      },
      lifecycle: {
        actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
        defaultAction: 'invoke',
      },
      policy: {
        defaultTrust: 'review',
        requiresApproval: permissionKinds.length > 0,
        allowNetworkByDefault: false,
        allowFilesystemWriteByDefault: false,
        allowProcessSpawnByDefault: false,
        sandboxProfile: permissionKinds.some((kind) => kind.startsWith('network'))
          ? 'networked'
          : 'restricted',
      },
      artifactKinds: [],
      receiptKinds: [`${pluginId}.receipt`],
    };
  }

  private buildEntrypointSource(pluginId: string, capabilityId: string): string {
    return [
      'export function register(ctx) {',
      `  ctx.bindCapability('${capabilityId}', async ({ input }) => ({`,
      `    output: {`,
      `      pluginId: '${pluginId}',`,
      `      capabilityId: '${capabilityId}',`,
      '      ok: true,',
      '      input: input || {},',
      `      message: 'Marketplace plugin ${pluginId} is loaded.',`,
      '    },',
      '  }));',
      '}',
      '',
    ].join('\n');
  }

  private checksumPackage(packageDir: string): string {
    const hash = createHash('sha256');
    const files = ['manifest.json', 'index.js', 'README.md']
      .map((name) => path.join(packageDir, name))
      .filter((filePath) => this.existsSync(filePath))
      .sort();
    for (const filePath of files) {
      hash.update(path.basename(filePath));
      hash.update(this.readFileSync(filePath));
    }
    return `sha256:${hash.digest('hex')}`;
  }

  private mapPermissions(values: string[]): Array<
    | 'network.external'
    | 'network.local'
    | 'filesystem.read'
    | 'filesystem.write'
    | 'secret.read'
    | 'process.spawn'
    | 'artifact.read'
    | 'artifact.write'
    | 'memory.read'
    | 'memory.write'
    | 'channel.send'
    | 'provider.call'
    | 'node.invoke'
  > {
    const mapped = new Set<
      | 'network.external'
      | 'network.local'
      | 'filesystem.read'
      | 'filesystem.write'
      | 'secret.read'
      | 'process.spawn'
      | 'artifact.read'
      | 'artifact.write'
      | 'memory.read'
      | 'memory.write'
      | 'channel.send'
      | 'provider.call'
      | 'node.invoke'
    >();
    for (const raw of values) {
      const value = String(raw || '').toLowerCase();
      if (/network|http|webhook|external/.test(value)) mapped.add('network.external');
      if (/workspace:read|filesystem\.read|file:read|read/.test(value) && /write|mutate|delete/.test(value) === false) {
        mapped.add('filesystem.read');
      }
      if (/write|mutate|delete|filesystem\.write/.test(value)) mapped.add('filesystem.write');
      if (/shell|process|exec|spawn/.test(value)) mapped.add('process.spawn');
      if (/secret/.test(value)) mapped.add('secret.read');
      if (/message:send|channel/.test(value)) mapped.add('channel.send');
      if (/memory/.test(value)) mapped.add('memory.write');
      if (/provider|llm/.test(value)) mapped.add('provider.call');
    }
    if (mapped.size === 0) {
      mapped.add('filesystem.read');
    }
    return Array.from(mapped);
  }

  private normalizeModuleKind(value: string | undefined): ZavorthPluginModuleKind {
    const kind = String(value || '').trim().toLowerCase();
    const allowed: ZavorthPluginModuleKind[] = [
      'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
      'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
    ];
    if (allowed.includes(kind as ZavorthPluginModuleKind)) {
      return kind as ZavorthPluginModuleKind;
    }
    if (kind.includes('channel')) return 'channel';
    if (kind.includes('memory')) return 'memory';
    if (kind.includes('provider') || kind.includes('llm')) return 'provider';
    if (kind.includes('tool')) return 'tool';
    return DEFAULT_MODULE_KIND;
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
