import fs from 'node:fs';
import path from 'node:path';

import { PluginSignatureService } from './PluginSignatureService.js';
import {
  fetchPublicHttpsBuffer,
  validatePublicHttpsUrl,
} from '../security/PublicHttpsFetch.js';

const MAX_REMOTE_CATALOG_BYTES = 5 * 1024 * 1024;
const MAX_REMOTE_CATALOG_ENTRIES = 5_000;

export type CuratedMarketplaceEntry = {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  moduleKind?: string;
  source?: string;
  signed?: boolean;
  tier?: string;
  curated?: boolean;
  tags?: string[];
  version?: string;
  permissions?: string[];
  [key: string]: unknown;
};

export type CuratedListResult = {
  ok: boolean;
  entries: CuratedMarketplaceEntry[];
  path: string | null;
  findings: string[];
  sources?: Array<{ kind: 'local' | 'remote' | 'cache'; path: string; count: number }>;
  formatText(): string;
};

export type CuratedVerifyResult = {
  ok: boolean;
  pluginId: string;
  packageDir: string | null;
  checksum?: string;
  status: string;
  findings: string[];
  formatText(): string;
};

export type PluginCuratedMarketplaceServiceRuntime = {
  projectRoot?: string;
  signatureService?: PluginSignatureService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  fetchImpl?: typeof fetch;
  fetchBuffer?: (url: string) => Promise<Buffer>;
  remoteUrl?: string | null;
  now?: () => Date;
};

export class PluginCuratedMarketplaceService {
  private readonly projectRoot: string;
  private readonly signatureService: PluginSignatureService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly fetchImpl: typeof fetch | null;
  private readonly fetchBuffer: (url: string) => Promise<Buffer>;
  private readonly remoteUrl: string | null;
  private readonly now: () => Date;

  constructor(runtime: PluginCuratedMarketplaceServiceRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.signatureService = runtime.signatureService || new PluginSignatureService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    // An injected fetch is a trusted test/host adapter. The default path uses
    // DNS-pinned public HTTPS fetching to prevent redirects into private nets.
    this.fetchImpl = runtime.fetchImpl || null;
    this.fetchBuffer = runtime.fetchBuffer || ((url) => fetchPublicHttpsBuffer(url, {
      maxBytes: MAX_REMOTE_CATALOG_BYTES,
      maxRedirects: 3,
      timeoutMs: 15_000,
      accept: 'application/json',
    }));
    this.remoteUrl = runtime.remoteUrl === undefined
      ? (process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL || resolveDefaultMarketplaceUrl(this.projectRoot) || null)
      : runtime.remoteUrl;
    this.now = runtime.now || (() => new Date());
  }

  public catalogPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), 'config', 'plugin-marketplace-curated.json');
  }

  public remoteCachePath(root?: string): string {
    return path.join(
      path.resolve(root || this.projectRoot),
      '.zavorth',
      'cache',
      'plugin-marketplace-remote.json',
    );
  }

  public list(options: {
    root?: string;
    query?: string;
    includeRemote?: boolean;
  } = {}): CuratedListResult {
    const root = path.resolve(options.root || this.projectRoot);
    const filePath = this.catalogPath(root);
    const findings: string[] = [];
    const sources: Array<{ kind: 'local' | 'remote' | 'cache'; path: string; count: number }> = [];
    const byId = new Map<string, CuratedMarketplaceEntry>();

    if (this.existsSync(filePath)) {
      try {
        const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as unknown;
        const list = Array.isArray(raw) ? raw : [];
        let count = 0;
        for (const item of list) {
          const entry = normalizeEntry(item);
          if (!entry) continue;
          byId.set(entry.id, { ...entry, curated: true });
          count += 1;
        }
        sources.push({
          kind: 'local',
          path: path.relative(root, filePath).replace(/\\/gu, '/'),
          count,
        });
        findings.push(`local curated entries=${count}`);
      } catch (error) {
        findings.push(
          `local parse failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      findings.push(`curated catalog missing: ${path.relative(root, filePath)}`);
    }

    const wantRemote = options.includeRemote !== false
      && Boolean(this.remoteUrl || process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL);
    if (wantRemote) {
      const remote = this.loadRemoteCatalog(root);
      findings.push(...remote.findings);
      if (remote.entries.length > 0) {
        sources.push({
          kind: remote.fromCache ? 'cache' : 'remote',
          path: remote.path || this.remoteUrl || 'remote',
          count: remote.entries.length,
        });
        for (const entry of remote.entries) {
          // Local wins on id conflict.
          if (!byId.has(entry.id)) {
            byId.set(entry.id, { ...entry, curated: true, source: entry.source || 'remote' });
          }
        }
      }
    }

    let entries = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    const query = String(options.query || '').trim().toLowerCase();
    if (query) {
      entries = entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query));
    }

    const relative = this.existsSync(filePath)
      ? path.relative(root, filePath).replace(/\\/gu, '/')
      : null;

    const ok = entries.length > 0;
    return {
      ok,
      entries,
      path: relative,
      findings,
      sources,
      formatText() {
        const lines = [
          `Curated marketplace (${entries.length})`,
          relative ? `path: ${relative}` : 'path: (remote/cache only)',
          ...sources.map((source) => `  source ${source.kind}: ${source.path} (${source.count})`),
          ...entries.slice(0, 40).map(
            (entry) => `  - ${entry.id} | ${entry.name} | tier=${entry.tier || 'curated'} | ${entry.summary || ''}`,
          ),
        ];
        return lines.join('\n');
      },
    };
  }

  /**
   * Fetch remote catalog (HTTPS JSON array) and cache under .zavorth/cache.
   * Soft-fails to cache / empty.
   */
  public loadRemoteCatalog(root?: string): {
    entries: CuratedMarketplaceEntry[];
    findings: string[];
    path: string | null;
    fromCache: boolean;
  } {
    const projectRoot = path.resolve(root || this.projectRoot);
    const url = this.remoteUrl || process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL || '';
    const findings: string[] = [];
    const cachePath = this.remoteCachePath(projectRoot);

    if (!url) {
      return { entries: [], findings: ['no remote marketplace URL configured'], path: null, fromCache: false };
    }

    // Prefer fresh remote when fetch is available; otherwise cache.
    if (this.fetchImpl) {
      try {
        // Synchronous-friendly: use cached if recent (< 1h), else try fetch via deasync-less pattern.
        // We cannot await in sync list(); so only use cache here and expose refreshRemote() for async.
        if (this.existsSync(cachePath)) {
          const stat = fs.statSync(cachePath);
          const ageMs = this.now().getTime() - stat.mtimeMs;
          if (ageMs < 3_600_000) {
            const cached = this.readCachedCatalog(cachePath);
            findings.push(`remote cache hit ageMs=${ageMs}`);
            return { entries: cached, findings, path: path.relative(projectRoot, cachePath).replace(/\\/gu, '/'), fromCache: true };
          }
        }
      } catch {
        /* fall through to cache read */
      }
    }

    if (this.existsSync(cachePath)) {
      const cached = this.readCachedCatalog(cachePath);
      findings.push(`remote cache fallback entries=${cached.length}`);
      return {
        entries: cached,
        findings,
        path: path.relative(projectRoot, cachePath).replace(/\\/gu, '/'),
        fromCache: true,
      };
    }

    findings.push(`remote catalog not cached yet (call refreshRemote). url=${url}`);
    return { entries: [], findings, path: null, fromCache: false };
  }

  public async refreshRemote(options: { root?: string; url?: string } = {}): Promise<{
    ok: boolean;
    entries: CuratedMarketplaceEntry[];
    cachePath: string | null;
    findings: string[];
  }> {
    const root = path.resolve(options.root || this.projectRoot);
    const url = options.url || this.remoteUrl || process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL || '';
    const findings: string[] = [];
    if (!url) {
      return { ok: false, entries: [], cachePath: null, findings: ['ZAVORTH_PLUGIN_MARKETPLACE_URL not set'] };
    }
    const urlCheck = assertSafeRemoteCatalogUrl(url);
    if (!urlCheck.ok) {
      return { ok: false, entries: [], cachePath: null, findings: [urlCheck.reason || 'unsafe remote URL'] };
    }
    try {
      const raw = this.fetchImpl
        ? await this.readInjectedFetchJson(url)
        : JSON.parse((await this.fetchBuffer(url)).toString('utf8')) as unknown;
      const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)
          ? (raw as { entries: unknown[] }).entries
          : []);
      const entries = list.slice(0, MAX_REMOTE_CATALOG_ENTRIES)
        .map((item) => normalizeEntry(item))
        .filter((entry): entry is CuratedMarketplaceEntry => Boolean(entry));

      const cachePath = this.remoteCachePath(root);
      this.mkdirSync(path.dirname(cachePath), { recursive: true });
      this.writeFileSync(
        cachePath,
        `${JSON.stringify({
          fetchedAt: this.now().toISOString(),
          url,
          entries,
        }, null, 2)}\n`,
        'utf8',
      );
      findings.push(`refreshed remote catalog entries=${entries.length}`);
      return {
        ok: true,
        entries,
        cachePath: path.relative(root, cachePath).replace(/\\/gu, '/'),
        findings,
      };
    } catch (error) {
      return {
        ok: false,
        entries: [],
        cachePath: null,
        findings: [`remote refresh failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private async readInjectedFetchJson(url: string): Promise<unknown> {
    const response = await (this.fetchImpl as typeof fetch)(url, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`remote HTTP ${response.status} for ${url}`);
    }
    if (typeof response.text === 'function') {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_REMOTE_CATALOG_BYTES) {
        throw new Error(`remote catalog exceeds ${MAX_REMOTE_CATALOG_BYTES} bytes`);
      }
      return JSON.parse(text) as unknown;
    }
    return response.json() as Promise<unknown>;
  }

  private readCachedCatalog(cachePath: string): CuratedMarketplaceEntry[] {
    try {
      const raw = JSON.parse(this.readFileSync(cachePath, 'utf8')) as unknown;
      const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)
          ? (raw as { entries: unknown[] }).entries
          : []);
      return list
        .map((item) => normalizeEntry(item))
        .filter((entry): entry is CuratedMarketplaceEntry => Boolean(entry));
    } catch {
      return [];
    }
  }

  public search(query: string, options: { root?: string } = {}): CuratedListResult {
    return this.list({ ...options, query });
  }

  public verifyBundled(
    pluginId: string,
    options: { root?: string } = {},
  ): CuratedVerifyResult {
    const root = path.resolve(options.root || this.projectRoot);
    const id = String(pluginId || '').trim();
    const candidates = [
      path.join(root, 'plugins', id),
      path.join(root, 'plugins', 'examples', id),
      path.join(root, '.zavorth', 'plugins', id),
    ];
    const packageDir = candidates.find((dir) => this.existsSync(path.join(dir, 'manifest.json'))) || null;
    if (!packageDir) {
      return {
        ok: false,
        pluginId: id,
        packageDir: null,
        status: 'missing',
        findings: [`bundled package not found for ${id}`],
        formatText() {
          return `Curated verify ${id}: missing package`;
        },
      };
    }

    try {
      const checksum = this.signatureService.computePackageChecksum(packageDir);
      const verify = this.signatureService.verifyPackage(packageDir);
      const ok = verify.ok || verify.status === 'unsigned';
      return {
        ok,
        pluginId: id,
        packageDir: path.relative(root, packageDir).replace(/\\/gu, '/'),
        checksum,
        status: verify.status,
        findings: [
          `checksum=${checksum.slice(0, 16)}…`,
          ...verify.findings,
        ],
        formatText() {
          return [
            `Curated verify: ${id}`,
            `status=${verify.status} ok=${ok}`,
            `package: ${path.relative(root, packageDir).replace(/\\/gu, '/')}`,
            `checksum: ${checksum}`,
            ...verify.findings.map((line) => `  - ${line}`),
          ].join('\n');
        },
      };
    } catch (error) {
      return {
        ok: false,
        pluginId: id,
        packageDir: path.relative(root, packageDir).replace(/\\/gu, '/'),
        status: 'error',
        findings: [error instanceof Error ? error.message : String(error)],
        formatText() {
          return `Curated verify ${id}: error`;
        },
      };
    }
  }
}

function normalizeEntry(item: unknown): CuratedMarketplaceEntry | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  const id = String(record.id || '').trim();
  if (!id) return null;
  return {
    ...record,
    id,
    name: String(record.name || id),
    summary: record.summary ? String(record.summary) : undefined,
    description: record.description ? String(record.description) : undefined,
    moduleKind: record.moduleKind ? String(record.moduleKind) : undefined,
    source: record.source ? String(record.source) : undefined,
    signed: record.signed === true,
    tier: record.tier ? String(record.tier) : 'first-party',
    curated: true,
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    version: record.version ? String(record.version) : '1.0.0',
    permissions: Array.isArray(record.permissions) ? record.permissions.map(String) : [],
  };
}

/**
 * Block SSRF-prone remote catalog URLs (non-HTTPS, localhost, private IPs, file/data schemes).
 */
function assertSafeRemoteCatalogUrl(raw: string): { ok: boolean; reason?: string } {
  const reason = validatePublicHttpsUrl(String(raw || '').trim());
  return reason ? { ok: false, reason: `remote catalog ${reason}` } : { ok: true };
}

/**
 * Wave 8: optional default remote URL from config/plugin-os-marketplace.json
 * (env ZAVORTH_PLUGIN_MARKETPLACE_URL still wins when set).
 */
function resolveDefaultMarketplaceUrl(projectRoot: string): string | null {
  try {
    const configPath = path.join(path.resolve(projectRoot), 'config', 'plugin-os-marketplace.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      defaultRemoteUrl?: string | null;
      defaultRemoteUrlEnv?: string;
    };
    const envName = String(raw.defaultRemoteUrlEnv || 'ZAVORTH_PLUGIN_MARKETPLACE_URL').trim();
    const fromEnv = envName ? String(process.env[envName] || '').trim() : '';
    if (fromEnv) return fromEnv;
    const configured = raw.defaultRemoteUrl == null ? '' : String(raw.defaultRemoteUrl).trim();
    return configured || null;
  } catch {
    return null;
  }
}
