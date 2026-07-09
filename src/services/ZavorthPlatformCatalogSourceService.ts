import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
ZavorthPlatformCatalogSyncService,
  type ZavorthPlatformCatalogSyncStatus,
} from './ZavorthPlatformCatalogSyncService.js';

export type ZavorthPlatformCatalogKind = 'plugin' | 'skill' | 'mcp';

export type ZavorthPlatformCatalogEntry = {
  id: string;
  label: string;
  kind: ZavorthPlatformCatalogKind;
  source: string;
  readiness: 'ready' | 'partial' | 'planned' | 'disabled';
  trust: 'trusted' | 'review' | 'planned';
  installState: 'installed' | 'available' | 'workspace' | 'enabled' | 'disabled';
  summary: string;
  actionHint: string;
  tags: string[];
  capabilities: string[];
  details: string[];
  featured: boolean;
  searchText: string;
};

export type ZavorthPlatformCatalogCollection = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  tags: string[];
  capabilities: string[];
  details: string[];
  entryIds: string[];
  featured: boolean;
  searchText: string;
};

export type ZavorthPlatformCatalogRecipe = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  tags: string[];
  details: string[];
  steps: string[];
  targetIds: string[];
  featured: boolean;
  searchText: string;
};

type ZavorthPlatformCatalogSourceRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  catalogFile?: string;
  remoteCacheFile?: string;
  syncService?: Pick<ZavorthPlatformCatalogSyncService, 'readStatus'>;
};

export class ZavorthPlatformCatalogSourceService {
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly catalogFile: string;
  private readonly remoteCacheFile: string;
  private readonly syncService: Pick<ZavorthPlatformCatalogSyncService, 'readStatus'>;

  constructor(runtime: ZavorthPlatformCatalogSourceRuntime = {}) {
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.catalogFile = runtime.catalogFile || path.join(config.projectRoot, 'config', 'platform-registry.json');
    this.remoteCacheFile = runtime.remoteCacheFile || config.platformRegistryRemoteCacheFile;
    this.syncService = runtime.syncService || new ZavorthPlatformCatalogSyncService();
  }

  public listEntries(kind?: ZavorthPlatformCatalogKind | null): ZavorthPlatformCatalogEntry[] {
    const normalizedKind = this.normalizeKind(kind);
    const entries = this.readCatalog().entries;
    return normalizedKind
      ? entries.filter((entry) => entry.kind === normalizedKind)
      : entries;
  }

  public listCollections(): ZavorthPlatformCatalogCollection[] {
    return this.readCatalog().collections;
  }

  public listRecipes(): ZavorthPlatformCatalogRecipe[] {
    return this.readCatalog().recipes;
  }

  public readSyncStatus(): ZavorthPlatformCatalogSyncStatus {
    return this.syncService.readStatus();
  }

  private readCatalog(): {
    entries: ZavorthPlatformCatalogEntry[];
    collections: ZavorthPlatformCatalogCollection[];
    recipes: ZavorthPlatformCatalogRecipe[];
  } {
    try {
      const syncStatus = this.syncService.readStatus();
      const localCatalog = this.readCatalogFile(this.catalogFile, 'registry:local-catalog');
      const remoteCatalog = this.shouldUseRemoteCatalog(syncStatus)
        ? this.readCatalogFile(this.remoteCacheFile, 'registry:remote-catalog')
        : { entries: [], collections: [], recipes: [] };
      return {
        entries: this.mergeById(localCatalog.entries, remoteCatalog.entries),
        collections: this.mergeById(localCatalog.collections, remoteCatalog.collections),
        recipes: this.mergeById(localCatalog.recipes, remoteCatalog.recipes),
      };
    } catch (error: unknown) {logger.warn('[Zavorth Platform  Source] cache operation failed', error);
    return { entries: [], collections: [], recipes: [] };
  }
  }

  private readCatalogFile(
    targetFile: string,
    defaultSource: string,
  ): {
    entries: ZavorthPlatformCatalogEntry[];
    collections: ZavorthPlatformCatalogCollection[];
    recipes: ZavorthPlatformCatalogRecipe[];
  } {
    try {
      if (!targetFile || !this.existsSync(targetFile)) {
        return { entries: [], collections: [], recipes: [] };
      }

      const parsed = JSON.parse(this.readFileSync(targetFile, 'utf8')) as Record<string, unknown>;
      const entries = Array.isArray(parsed.entries)
        ? parsed.entries
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => this.normalizeEntry(entry as Record<string, unknown>, defaultSource))
          .filter((entry): entry is ZavorthPlatformCatalogEntry => Boolean(entry))
        : [];
      const collections = Array.isArray(parsed.collections)
        ? parsed.collections
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => this.normalizeCollection(entry as Record<string, unknown>, defaultSource))
          .filter((entry): entry is ZavorthPlatformCatalogCollection => Boolean(entry))
        : [];
      const recipes = Array.isArray(parsed.recipes)
        ? parsed.recipes
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => this.normalizeRecipe(entry as Record<string, unknown>, defaultSource))
          .filter((entry): entry is ZavorthPlatformCatalogRecipe => Boolean(entry))
        : [];
      return { entries, collections, recipes };
    } catch (error: unknown) {logger.warn('[Zavorth Platform  Source] parsing failed', error);
    return { entries: [], collections: [], recipes: [] };
  }
  }

  private mergeById<T extends { id: string }>(localItems: T[], remoteItems: T[]): T[] {
    const merged = new Map<string, T>();
    for (const entry of [...remoteItems, ...localItems]) {
      const normalizedId = this.normalizeToken(entry.id);
      if (!normalizedId) {
        continue;
      }
      merged.set(normalizedId, entry);
    }
    return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id, 'en-US'));
  }

  private shouldUseRemoteCatalog(syncStatus: ZavorthPlatformCatalogSyncStatus): boolean {
    return syncStatus.enabled
      && syncStatus.status === 'ready'
      && syncStatus.sourceTrusted === true
      && !syncStatus.stale
      && !syncStatus.error;
  }

  private normalizeEntry(input: Record<string, unknown>, defaultSource: string): ZavorthPlatformCatalogEntry | null {
    const id = this.normalizeToken(input.id);
    const kind = this.normalizeKind(input.kind);
    const label = this.readText(input.label);
    if (!id || !kind || !label) {
      return null;
    }

    const source = this.readText(input.source) || defaultSource;
    const fromRemoteCatalog = source.includes('remote-catalog');
    const tags = this.normalizeStringArray(input.tags);
    const capabilities = this.normalizeStringArray(input.capabilities);
    const details = this.normalizeStringArray(input.details);
    return {
      id,
      label,
      kind,
      source,
      readiness: fromRemoteCatalog ? 'planned' : this.normalizeReadiness(input.readiness),
      trust: fromRemoteCatalog ? 'planned' : this.normalizeTrust(input.trust),
      installState: fromRemoteCatalog ? 'available' : this.normalizeInstallState(input.installState),
      summary: this.readText(input.summary) || `${label} catalogado no registry local do Zavorth.`,
      actionHint: this.readText(input.actionHint),
      tags,
      capabilities,
      details,
      featured: input.featured === true,
      searchText: this.normalizeSearchText([
        id,
        label,
        this.readText(input.summary),
        this.readText(input.actionHint),
        ...tags,
        ...capabilities,
        ...details,
      ]),
    };
  }

  private normalizeSearchText(values: string[]): string {
    return values
      .map((value) => this.normalizeText(value))
      .filter(Boolean)
      .join(' ');
  }

  private normalizeCollection(
    input: Record<string, unknown>,
    defaultSource: string,
  ): ZavorthPlatformCatalogCollection | null {
    const id = this.normalizeCollectionId(input.id);
    const label = this.readText(input.label);
    if (!id || !label) {
      return null;
    }

    const tags = this.normalizeStringArray(input.tags);
    const capabilities = this.normalizeStringArray(input.capabilities);
    const details = this.normalizeStringArray(input.details);
    const entryIds = this.normalizeEntryIds(input.entryIds || input.entries);
    return {
      id,
      label,
      source: this.readText(input.source) || defaultSource,
      summary: this.readText(input.summary) || `${label} agrupa itens curados do ecossistema Zavorth.`,
      actionHint: this.readText(input.actionHint),
      tags,
      capabilities,
      details,
      entryIds,
      featured: input.featured === true,
      searchText: this.normalizeSearchText([
        id,
        label,
        this.readText(input.summary),
        this.readText(input.actionHint),
        ...tags,
        ...capabilities,
        ...details,
        ...entryIds,
      ]),
    };
  }

  private normalizeRecipe(input: Record<string, unknown>, defaultSource: string): ZavorthPlatformCatalogRecipe | null {
    const id = this.normalizeRecipeId(input.id);
    const label = this.readText(input.label);
    if (!id || !label) {
      return null;
    }

    const tags = this.normalizeStringArray(input.tags);
    const details = this.normalizeStringArray(input.details);
    const steps = this.normalizeStringArray(input.steps);
    const targetIds = this.normalizeEntryIds(input.targetIds || input.targets || input.entries);
    return {
      id,
      label,
      source: this.readText(input.source) || defaultSource,
      summary: this.readText(input.summary) || `${label} organiza uma trilha guiada do ecossistema Zavorth.`,
      actionHint: this.readText(input.actionHint),
      tags,
      details,
      steps,
      targetIds,
      featured: input.featured === true,
      searchText: this.normalizeSearchText([
        id,
        label,
        this.readText(input.summary),
        this.readText(input.actionHint),
        ...tags,
        ...details,
        ...steps,
        ...targetIds,
      ]),
    };
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => this.readText(entry))
      .filter(Boolean);
  }

  private normalizeReadiness(value: unknown): ZavorthPlatformCatalogEntry['readiness'] {
    switch (this.normalizeToken(value)) {
      case 'ready':
      case 'partial':
      case 'disabled':
        return this.normalizeToken(value) as ZavorthPlatformCatalogEntry['readiness'];
      default:
        return 'planned';
    }
  }

  private normalizeTrust(value: unknown): ZavorthPlatformCatalogEntry['trust'] {
    switch (this.normalizeToken(value)) {
      case 'trusted':
      case 'review':
        return this.normalizeToken(value) as ZavorthPlatformCatalogEntry['trust'];
      default:
        return 'planned';
    }
  }

  private normalizeInstallState(value: unknown): ZavorthPlatformCatalogEntry['installState'] {
    switch (this.normalizeToken(value)) {
      case 'installed':
      case 'workspace':
      case 'enabled':
      case 'disabled':
        return this.normalizeToken(value) as ZavorthPlatformCatalogEntry['installState'];
      default:
        return 'available';
    }
  }

  private normalizeKind(value: unknown): ZavorthPlatformCatalogKind | null {
    switch (this.normalizeToken(value)) {
      case 'plugin':
      case 'skill':
      case 'mcp':
        return this.normalizeToken(value) as ZavorthPlatformCatalogKind;
      default:
        return null;
    }
  }

  private normalizeCollectionId(value: unknown): string {
    const normalized = this.normalizeToken(value);
    if (!normalized) {
      return '';
    }
    return normalized.startsWith('collection:') ? normalized : `collection:${normalized}`;
  }

  private normalizeRecipeId(value: unknown): string {
    const normalized = this.normalizeToken(value);
    if (!normalized) {
      return '';
    }
    return normalized.startsWith('recipe:') ? normalized : `recipe:${normalized}`;
  }

  private normalizeEntryIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => this.normalizeToken(entry))
      .filter(Boolean);
  }

  private normalizeToken(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeText(value: unknown): string {
    return this.normalizeToken(value);
  }

  private readText(value: unknown): string {
    return String(value || '').trim();
  }
}
