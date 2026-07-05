import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthPlatformCatalogSyncStatusKind =
  | 'disabled'
  | 'never-synced'
  | 'ready'
  | 'stale'
  | 'failed';

export type ZavorthPlatformCatalogSyncStatus = {
  enabled: boolean;
  status: ZavorthPlatformCatalogSyncStatusKind;
  remoteUrl: string | null;
  sourceTrusted: boolean;
  contentSha256: string | null;
  expectedSha256: string | null;
  checkedAt: string | null;
  syncedAt: string | null;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  entryCount: number;
  collectionCount: number;
  recipeCount: number;
  error: string | null;
  cacheFile: string;
  statusFile: string;
  command: string;
  summary: string;
};

export type ZavorthPlatformCatalogSyncResult = ZavorthPlatformCatalogSyncStatus & {
  ok: boolean;
};

type SyncStateFile = {
  version: number;
  checkedAt: string;
  syncedAt: string | null;
  remoteUrl: string | null;
  sourceTrusted: boolean;
  contentSha256: string | null;
  expectedSha256: string | null;
  entryCount: number;
  collectionCount: number;
  recipeCount: number;
  error: string | null;
};

type PlatformCatalogLike = {
  version?: number;
  entries?: unknown[];
  collections?: unknown[];
  recipes?: unknown[];
};

type ZavorthPlatformCatalogSyncRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  remoteUrl?: string;
  remoteToken?: string;
  allowedHosts?: string[];
  allowHttpHosts?: string[];
  expectedSha256?: string;
  cacheFile?: string;
  statusFile?: string;
  maxAgeMs?: number;
  timeoutMs?: number;
};

export class ZavorthPlatformCatalogSyncService {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly remoteUrl: string;
  private readonly remoteToken: string;
  private readonly allowedHosts: string[];
  private readonly allowHttpHosts: string[];
  private readonly expectedSha256: string;
  private readonly cacheFile: string;
  private readonly statusFile: string;
  private readonly maxAgeMs: number;
  private readonly timeoutMs: number;

  constructor(runtime: ZavorthPlatformCatalogSyncRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.remoteUrl = String(
      runtime.remoteUrl ?? config.platformRegistryRemoteUrl ?? '',
    ).trim();
    this.remoteToken = String(
      runtime.remoteToken ?? config.platformRegistryRemoteToken ?? '',
    ).trim();
    this.allowedHosts = (runtime.allowedHosts ?? config.platformRegistryRemoteAllowedHosts ?? [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
    this.allowHttpHosts = (runtime.allowHttpHosts ?? config.platformRegistryRemoteAllowHttpHosts ?? [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
    this.expectedSha256 = String(
      runtime.expectedSha256 ?? config.platformRegistryRemoteExpectedSha256 ?? '',
    ).trim().toLowerCase().replace(/^sha256:/, '');
    this.cacheFile = String(
      runtime.cacheFile ?? config.platformRegistryRemoteCacheFile ?? '',
    ).trim();
    this.statusFile = String(
      runtime.statusFile ?? config.platformRegistryRemoteStatusFile ?? '',
    ).trim();
    this.maxAgeMs = Number(runtime.maxAgeMs ?? config.platformRegistryRemoteMaxAgeMs ?? 43_200_000) || 43_200_000;
    this.timeoutMs = Number(runtime.timeoutMs ?? config.platformRegistryRemoteSyncTimeoutMs ?? 8_000) || 8_000;
  }

  public readStatus(): ZavorthPlatformCatalogSyncStatus {
    if (!this.remoteUrl) {
      return this.buildStatus({
        enabled: false,
        status: 'disabled',
        sourceTrusted: false,
        contentSha256: null,
        expectedSha256: this.expectedSha256 || null,
        checkedAt: null,
        syncedAt: null,
        entryCount: 0,
        collectionCount: 0,
        recipeCount: 0,
        error: null,
      });
    }

    const parsed = this.readStateFile();
    if (!parsed) {
      return this.buildStatus({
        enabled: true,
        status: 'never-synced',
        sourceTrusted: this.isSourceTrusted(),
        contentSha256: null,
        expectedSha256: this.expectedSha256 || null,
        checkedAt: null,
        syncedAt: null,
        entryCount: 0,
        collectionCount: 0,
        recipeCount: 0,
        error: null,
      });
    }

    const normalizedStatus: ZavorthPlatformCatalogSyncStatusKind = parsed.error
      ? 'failed'
      : this.isStale(parsed.syncedAt)
        ? 'stale'
        : parsed.syncedAt
          ? 'ready'
          : 'never-synced';

    return this.buildStatus({
      enabled: true,
      status: normalizedStatus,
      sourceTrusted: parsed.sourceTrusted !== false,
      contentSha256: parsed.contentSha256 || null,
      expectedSha256: parsed.expectedSha256 || this.expectedSha256 || null,
      checkedAt: parsed.checkedAt || null,
      syncedAt: parsed.syncedAt || null,
      entryCount: Number(parsed.entryCount || 0) || 0,
      collectionCount: Number(parsed.collectionCount || 0) || 0,
      recipeCount: Number(parsed.recipeCount || 0) || 0,
      error: parsed.error || null,
    });
  }

  public async sync(): Promise<ZavorthPlatformCatalogSyncResult> {
    if (!this.remoteUrl) {
      return {
        ok: false,
        ...this.readStatus(),
      };
    }

    if (!this.isSourceTrusted()) {
      const failed = this.persistFailure('Registry remoto bloqueado pela policy de origem/HTTPS.', {
        sourceTrusted: false,
      });
      return {
        ok: false,
        ...failed,
      };
    }

    if (!this.fetchImpl) {
      const failed = this.persistFailure('Fetch indisponivel neste runtime.');
      return {
        ok: false,
        ...failed,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (this.remoteToken) {
        headers.Authorization = this.remoteToken;
      }

      const response = await this.fetchImpl(this.remoteUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Registry remoto respondeu com status ${response.status}.`);
      }

      const rawBody = await response.text();
      const contentSha256 = sha256Hex(rawBody);
      if (this.expectedSha256 && contentSha256 !== this.expectedSha256) {
        throw new Error(`Registry remoto falhou na integridade SHA-256 esperada (${this.expectedSha256}).`);
      }

      const payload = JSON.parse(rawBody) as PlatformCatalogLike;
      const normalized = this.normalizeCatalog(payload);
      this.writeJsonFile(this.cacheFile, normalized);

      const checkedAt = this.now().toISOString();
      const state: SyncStateFile = {
        version: 1,
        checkedAt,
        syncedAt: checkedAt,
        remoteUrl: this.remoteUrl,
        sourceTrusted: true,
        contentSha256,
        expectedSha256: this.expectedSha256 || null,
        entryCount: normalized.entries.length,
        collectionCount: normalized.collections.length,
        recipeCount: normalized.recipes.length,
        error: null,
      };
      this.writeJsonFile(this.statusFile, state);

      return {
        ok: true,
        ...this.readStatus(),
      };
    } catch (error: any) {
      const failed = this.persistFailure(error?.message || 'Falha ao sincronizar o registry remoto.');
      return {
        ok: false,
        ...failed,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private persistFailure(
    message: string,
    options: {
      sourceTrusted?: boolean;
      contentSha256?: string | null;
    } = {},
  ): ZavorthPlatformCatalogSyncStatus {
    const previous = this.readStateFile();
    const nextState: SyncStateFile = {
      version: 1,
      checkedAt: this.now().toISOString(),
      syncedAt: previous?.syncedAt || null,
      remoteUrl: this.remoteUrl || previous?.remoteUrl || null,
      sourceTrusted: options.sourceTrusted ?? previous?.sourceTrusted ?? this.isSourceTrusted(),
      contentSha256: options.contentSha256 ?? previous?.contentSha256 ?? null,
      expectedSha256: this.expectedSha256 || previous?.expectedSha256 || null,
      entryCount: Number(previous?.entryCount || 0) || 0,
      collectionCount: Number(previous?.collectionCount || 0) || 0,
      recipeCount: Number(previous?.recipeCount || 0) || 0,
      error: String(message || '').trim() || 'Falha ao sincronizar o registry remoto.',
    };
    this.writeJsonFile(this.statusFile, nextState);
    return this.readStatus();
  }

  private buildStatus(input: {
    enabled: boolean;
    status: ZavorthPlatformCatalogSyncStatusKind;
    sourceTrusted: boolean;
    contentSha256: string | null;
    expectedSha256: string | null;
    checkedAt: string | null;
    syncedAt: string | null;
    entryCount: number;
    collectionCount: number;
    recipeCount: number;
    error: string | null;
  }): ZavorthPlatformCatalogSyncStatus {
    const syncedAtMs = input.syncedAt ? Date.parse(input.syncedAt) : Number.NaN;
    const ageMs = Number.isFinite(syncedAtMs)
      ? Math.max(0, this.now().getTime() - syncedAtMs)
      : null;
    const stale = input.status === 'stale' || (input.status === 'ready' && ageMs !== null && ageMs > this.maxAgeMs);
    const effectiveStatus: ZavorthPlatformCatalogSyncStatusKind = input.enabled
      ? stale && input.status === 'ready'
        ? 'stale'
        : input.status
      : 'disabled';

    return {
      enabled: input.enabled,
      status: effectiveStatus,
      remoteUrl: this.remoteUrl || null,
      sourceTrusted: input.sourceTrusted,
      contentSha256: input.contentSha256,
      expectedSha256: input.expectedSha256,
      checkedAt: input.checkedAt,
      syncedAt: input.syncedAt,
      stale,
      ageMs,
      maxAgeMs: this.maxAgeMs,
      entryCount: input.entryCount,
      collectionCount: input.collectionCount,
      recipeCount: input.recipeCount,
      error: input.error,
      cacheFile: this.cacheFile,
      statusFile: this.statusFile,
      command: 'zavorth platform sync',
      summary: this.buildSummary(
        effectiveStatus,
        input.entryCount,
        input.collectionCount,
        input.recipeCount,
        input.error,
        input.sourceTrusted,
        input.contentSha256,
      ),
    };
  }

  private buildSummary(
    status: ZavorthPlatformCatalogSyncStatusKind,
    entryCount: number,
    collectionCount: number,
    recipeCount: number,
    error: string | null,
    sourceTrusted: boolean,
    contentSha256: string | null,
  ): string {
    if (!sourceTrusted) {
      return 'Registry remoto bloqueado por policy de origem ou transporte inseguro.';
    }
    switch (status) {
      case 'disabled':
        return 'Registry remoto desabilitado; o platform plane segue apenas com o catalogo local.';
      case 'never-synced':
        return 'Registry remoto configurado, mas ainda sem sincronizacao local.';
      case 'failed':
        return error
          ? `Registry remoto falhou no ultimo sync: ${error}`
          : 'Registry remoto falhou no ultimo sync.';
      case 'stale':
        return `Registry remoto sincronizado, mas cache venceu. ${entryCount} item(ns), ${collectionCount} colecao(oes) e ${recipeCount} recipe(s) no ultimo snapshot.`;
      default:
        return `Registry remoto pronto com ${entryCount} item(ns), ${collectionCount} colecao(oes) e ${recipeCount} recipe(s)${contentSha256 ? `, sha256 ${contentSha256.slice(0, 12)}...` : ''}.`;
    }
  }

  private isSourceTrusted(): boolean {
    if (!this.remoteUrl) {
      return false;
    }

    try {
      const parsed = new URL(this.remoteUrl);
      const host = parsed.hostname.toLowerCase();
      const httpsAllowed = parsed.protocol === 'https:';
      const httpAllowed = parsed.protocol === 'http:' && this.allowHttpHosts.includes(host);
      const hostAllowed = this.allowedHosts.length < 1 || this.allowedHosts.includes(host);
      return hostAllowed && (httpsAllowed || httpAllowed);
    } catch (error) { logger.warn('[Zavorth Platform] network request failed', error); return false; }
  }

  private normalizeCatalog(input: PlatformCatalogLike): Required<PlatformCatalogLike> {
    return {
      version: Number(input?.version || 1) || 1,
      entries: Array.isArray(input?.entries) ? input.entries : [],
      collections: Array.isArray(input?.collections) ? input.collections : [],
      recipes: Array.isArray(input?.recipes) ? input.recipes : [],
    };
  }

  private isStale(syncedAt: string | null | undefined): boolean {
    const syncedAtMs = syncedAt ? Date.parse(syncedAt) : Number.NaN;
    if (!Number.isFinite(syncedAtMs)) {
      return false;
    }
    return Math.max(0, this.now().getTime() - syncedAtMs) > this.maxAgeMs;
  }

  private readStateFile(): SyncStateFile | null {
    try {
      if (!this.statusFile || !this.existsSync(this.statusFile)) {
        return null;
      }
      return JSON.parse(this.readFileSync(this.statusFile, 'utf8')) as SyncStateFile;
    } catch (error) { logger.warn('[Zavorth Platform] JSON parse failed', error); return null; }
  }

  private writeJsonFile(targetFile: string, payload: unknown): void {
    if (!targetFile) {
      return;
    }
    this.mkdirSync(path.dirname(targetFile), { recursive: true });
    this.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf8');
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}
