/**
 * User-configured HTTPS skill catalogs (optional).
 * Refresh + cache under .zavorth/cache with SSRF guards.
 * Install resolves entry.source through SkillInstallPipeline (consent required).
 */

import fs from 'node:fs';
import path from 'node:path';

import { fetchPublicHttpsBuffer, validatePublicHttpsUrl } from '../security/PublicHttpsFetch.js';
import { SkillInstallPipelineService } from './SkillInstallPipelineService.js';
import type { SkillInstallPlan, SkillInstallReceipt } from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';

export const SKILL_CATALOG_SCHEMA_VERSION = 'zavorth.skill-catalog.v1';

const MAX_REMOTE_CATALOG_BYTES = 5 * 1024 * 1024;
const MAX_REMOTE_CATALOG_ENTRIES = 5_000;

export type SkillCatalogEntry = {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  source: string;
  version?: string;
  tags?: string[];
  digest?: string;
  tools?: string[];
  [key: string]: unknown;
};

export type SkillCatalogListResult = {
  ok: boolean;
  entries: SkillCatalogEntry[];
  sources: Array<{ kind: 'local' | 'remote' | 'cache' | 'example'; path: string; count: number }>;
  findings: string[];
  formatText(): string;
};

export type SkillCatalogRefreshResult = {
  ok: boolean;
  entries: SkillCatalogEntry[];
  cachePath: string | null;
  url: string | null;
  findings: string[];
};

export type SkillCatalogShowResult = {
  ok: boolean;
  entry: SkillCatalogEntry | null;
  findings: string[];
  formatText(): string;
};

export type SkillRemoteCatalogRuntime = {
  projectRoot?: string;
  remoteUrl?: string | null;
  installPipeline?: SkillInstallPipelineService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  fetchImpl?: typeof fetch;
  fetchBuffer?: (url: string) => Promise<Buffer>;
  now?: () => Date;
};

export class SkillRemoteCatalogService {
  private readonly projectRoot: string;
  private readonly remoteUrl: string | null;
  private readonly installPipeline: SkillInstallPipelineService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly fetchImpl: typeof fetch | null;
  private readonly fetchBuffer: (url: string) => Promise<Buffer>;
  private readonly now: () => Date;

  constructor(runtime: SkillRemoteCatalogRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.remoteUrl =
      runtime.remoteUrl === undefined
        ? process.env.ZAVORTH_SKILL_CATALOG_URL || resolveDefaultSkillCatalogUrl(this.projectRoot) || null
        : runtime.remoteUrl;
    this.installPipeline =
      runtime.installPipeline || new SkillInstallPipelineService({ projectRoot: this.projectRoot });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.fetchImpl = runtime.fetchImpl || null;
    this.fetchBuffer =
      runtime.fetchBuffer ||
      ((url) =>
        fetchPublicHttpsBuffer(url, {
          maxBytes: MAX_REMOTE_CATALOG_BYTES,
          maxRedirects: 3,
          timeoutMs: 15_000,
          accept: 'application/json',
        }));
    this.now = runtime.now || (() => new Date());
  }

  public exampleCatalogPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), 'config', 'skill-catalog.example.json');
  }

  public localCatalogPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), 'config', 'skill-catalog.json');
  }

  public remoteCachePath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), '.zavorth', 'cache', 'skill-catalog-remote.json');
  }

  public resolveRemoteUrl(): string | null {
    return (
      this.remoteUrl || process.env.ZAVORTH_SKILL_CATALOG_URL || resolveDefaultSkillCatalogUrl(this.projectRoot) || null
    );
  }

  /**
   * List catalog entries: local config (if any) + cached remote + optional example.
   * Works with zero remote configured (local/example only).
   */
  public list(
    options: {
      root?: string;
      query?: string;
      includeRemote?: boolean;
      includeExample?: boolean;
    } = {},
  ): SkillCatalogListResult {
    const root = path.resolve(options.root || this.projectRoot);
    const findings: string[] = [];
    const sources: SkillCatalogListResult['sources'] = [];
    const byId = new Map<string, SkillCatalogEntry>();

    const loadFile = (filePath: string, kind: SkillCatalogListResult['sources'][0]['kind']) => {
      if (!this.existsSync(filePath)) return;
      try {
        const entries = parseCatalogDocument(this.readFileSync(filePath, 'utf8'));
        let count = 0;
        for (const entry of entries) {
          if (!byId.has(entry.id)) {
            byId.set(entry.id, entry);
            count += 1;
          }
        }
        sources.push({
          kind,
          path: path.relative(root, filePath).replace(/\\/gu, '/'),
          count,
        });
        findings.push(`${kind} entries=${count}`);
      } catch (error) {
        findings.push(`${kind} parse failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    loadFile(this.localCatalogPath(root), 'local');

    const wantRemote =
      options.includeRemote !== false &&
      Boolean(this.resolveRemoteUrl() || this.existsSync(this.remoteCachePath(root)));
    if (wantRemote) {
      const cachePath = this.remoteCachePath(root);
      if (this.existsSync(cachePath)) {
        loadFile(cachePath, 'cache');
      } else {
        findings.push('remote catalog not cached yet (call refresh). url=' + (this.resolveRemoteUrl() || '(none)'));
      }
    } else {
      findings.push('no remote skill catalog URL configured');
    }

    if (options.includeExample === true || byId.size === 0) {
      loadFile(this.exampleCatalogPath(root), 'example');
    }

    let entries = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    const query = String(options.query || '')
      .trim()
      .toLowerCase();
    if (query) {
      entries = entries.filter((e) => JSON.stringify(e).toLowerCase().includes(query));
    }

    return {
      ok: true,
      entries,
      sources,
      findings,
      formatText() {
        const lines = [
          `Skill catalog (${entries.length})`,
          ...sources.map((s) => `  source ${s.kind}: ${s.path} (${s.count})`),
          ...entries.slice(0, 40).map((e) => ` ? ${e.id} | ${e.name} | ${e.version || '...'} | ${e.summary || ''}`),
        ];
        if (!entries.length) {
          lines.push('  (empty — set ZAVORTH_SKILL_CATALOG_URL or config/skill-catalog.json)');
        }
        return lines.join('\n');
      },
    };
  }

  public show(id: string, options: { root?: string; includeExample?: boolean } = {}): SkillCatalogShowResult {
    const target = String(id || '').trim();
    const listed = this.list({
      root: options.root,
      includeRemote: true,
      includeExample: options.includeExample !== false,
    });
    const entry = listed.entries.find((e) => e.id === target) || null;
    return {
      ok: Boolean(entry),
      entry,
      findings: listed.findings,
      formatText() {
        if (!entry) return `Skill catalog entry not found: ${target}`;
        return [
          `Skill catalog: ${entry.id}`,
          `  name: ${entry.name}`,
          `  version: ${entry.version || '—'}`,
          `  source: ${entry.source}`,
          `  summary: ${entry.summary || '—'}`,
          entry.digest ? `  digest: ${entry.digest}` : null,
          entry.tags?.length ? `  tags: ${entry.tags.join(', ')}` : null,
          entry.tools?.length ? `  tools: ${entry.tools.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      },
    };
  }

  public async refreshRemote(
    options: {
      root?: string;
      url?: string;
    } = {},
  ): Promise<SkillCatalogRefreshResult> {
    const root = path.resolve(options.root || this.projectRoot);
    const url = options.url || this.resolveRemoteUrl() || '';
    const findings: string[] = [];
    if (!url) {
      return {
        ok: false,
        entries: [],
        cachePath: null,
        url: null,
        findings: ['ZAVORTH_SKILL_CATALOG_URL not set'],
      };
    }
    const urlCheck = assertSafeRemoteCatalogUrl(url);
    if (!urlCheck.ok) {
      return {
        ok: false,
        entries: [],
        cachePath: null,
        url,
        findings: [urlCheck.reason || 'unsafe remote URL'],
      };
    }
    try {
      const raw = this.fetchImpl
        ? await this.readInjectedFetchJson(url)
        : (JSON.parse((await this.fetchBuffer(url)).toString('utf8')) as unknown);
      const entries = parseCatalogEntries(raw).slice(0, MAX_REMOTE_CATALOG_ENTRIES);
      const cachePath = this.remoteCachePath(root);
      this.mkdirSync(path.dirname(cachePath), { recursive: true });
      this.writeFileSync(
        cachePath,
        `${JSON.stringify(
          {
            schemaVersion: SKILL_CATALOG_SCHEMA_VERSION,
            fetchedAt: this.now().toISOString(),
            url,
            entries,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      findings.push(`refreshed skill catalog entries=${entries.length}`);
      return {
        ok: true,
        entries,
        cachePath: path.relative(root, cachePath).replace(/\\/gu, '/'),
        url,
        findings,
      };
    } catch (error) {
      return {
        ok: false,
        entries: [],
        cachePath: null,
        url,
        findings: [`remote refresh failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * Preview install for a catalog entry id (no disk write).
   */
  public previewInstall(
    id: string,
    options: { root?: string } = {},
  ): { ok: boolean; entry: SkillCatalogEntry | null; plan: SkillInstallPlan | null; findings: string[] } {
    const shown = this.show(id, { root: options.root, includeExample: true });
    if (!shown.entry) {
      return {
        ok: false,
        entry: null,
        plan: null,
        findings: [`catalog entry not found: ${id}`, ...shown.findings],
      };
    }
    const plan = this.installPipeline.preview({ source: shown.entry.source });
    const blocked = (plan.risks || []).some((r) => r.severity === 'high' || r.severity === 'critical');
    return {
      ok: !blocked,
      entry: shown.entry,
      plan,
      findings: shown.findings,
    };
  }

  /**
   * Install by catalog id via entry.source. Requires consent=true.
   */
  public async installById(
    id: string,
    options: { root?: string; consent?: boolean } = {},
  ): Promise<{
    ok: boolean;
    entry: SkillCatalogEntry | null;
    receipt: SkillInstallReceipt | null;
    plan: SkillInstallPlan | null;
    findings: string[];
    message: string;
  }> {
    const shown = this.show(id, { root: options.root, includeExample: true });
    if (!shown.entry) {
      return {
        ok: false,
        entry: null,
        receipt: null,
        plan: null,
        findings: [`catalog entry not found: ${id}`],
        message: `Unknown catalog id: ${id}`,
      };
    }
    if (options.consent !== true) {
      const plan = this.installPipeline.preview({ source: shown.entry.source });
      return {
        ok: false,
        entry: shown.entry,
        receipt: null,
        plan,
        findings: ['consent_required'],
        message: `Consent required. Preview only. Re-run: zavorth skill catalog install ${id} --consent`,
      };
    }
    const receipt = await this.installPipeline.apply({
      source: shown.entry.source,
      consent: true,
    });
    return {
      ok: receipt.status === 'applied' || receipt.status === 'partial',
      entry: shown.entry,
      receipt,
      plan: null,
      findings: [],
      message:
        receipt.status === 'applied' || receipt.status === 'partial'
          ? `Installed catalog skill ${shown.entry.id} from ${shown.entry.source}`
          : `Install did not apply: ${receipt.status}`,
    };
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
}

function parseCatalogDocument(text: string): SkillCatalogEntry[] {
  return parseCatalogEntries(JSON.parse(text) as unknown);
}

function parseCatalogEntries(raw: unknown): SkillCatalogEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)
      ? (raw as { entries: unknown[] }).entries
      : [];
  return list.map((item) => normalizeSkillCatalogEntry(item)).filter((e): e is SkillCatalogEntry => Boolean(e));
}

export function normalizeSkillCatalogEntry(item: unknown): SkillCatalogEntry | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  const id = String(record.id || '').trim();
  const source = String(record.source || '').trim();
  if (!id || !source) return null;
  return {
    ...record,
    id,
    name: String(record.name || id),
    summary: record.summary != null ? String(record.summary) : undefined,
    description: record.description != null ? String(record.description) : undefined,
    source,
    version: record.version != null ? String(record.version) : '1.0.0',
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    digest: record.digest != null ? String(record.digest) : undefined,
    tools: Array.isArray(record.tools) ? record.tools.map(String) : undefined,
  };
}

/**
 * Block SSRF-prone remote catalog URLs (non-HTTPS, localhost, private IPs).
 */
export function assertSafeRemoteCatalogUrl(raw: string): { ok: boolean; reason?: string } {
  const reason = validatePublicHttpsUrl(String(raw || '').trim());
  return reason ? { ok: false, reason: `remote catalog ${reason}` } : { ok: true };
}

function resolveDefaultSkillCatalogUrl(projectRoot: string): string | null {
  try {
    const configPath = path.join(path.resolve(projectRoot), 'config', 'skill-sources.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      skillCatalogUrl?: string | null;
      defaultSkillCatalogUrl?: string | null;
      sources?: Array<{
        kind?: string;
        enabled?: boolean;
        url?: string;
        config?: { url?: string };
      }>;
    };
    const direct = String(raw.skillCatalogUrl || raw.defaultSkillCatalogUrl || '').trim() || '';
    if (direct) return direct;
    for (const src of raw.sources || []) {
      if (src.enabled === false) continue;
      if (String(src.kind || '') !== 'https-catalog') continue;
      const u = String(src.url || src.config?.url || '').trim();
      if (u) return u;
    }
    return null;
  } catch {
    return null;
  }
}
