import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type PluginTrustState = 'trusted' | 'review';

export type StoredPluginState = {
  pluginId: string;
  installed: boolean;
  trust: PluginTrustState;
  installedRevision: string | null;
  sourceDigest: string | null;
  sourceLocator: string | null;
  sourceTrusted: boolean | null;
  updatedAt: string;
};

export type PluginRegistryState = {
  version: number;
  updatedAt: string;
  entries: Record<string, StoredPluginState>;
};

type PluginStateRuntime = {
  now?: () => Date;
  stateFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class PluginStateService {
  private readonly now: () => Date;
  private readonly stateFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: PluginStateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile || config.pluginRegistryStateFile;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readState(): PluginRegistryState {
    return this.readJsonFile<PluginRegistryState>({
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
  }

  public getState(pluginId: string | null | undefined): StoredPluginState | null {
    const normalizedId = this.normalizeId(pluginId);
    if (!normalizedId) {
      return null;
    }

    const entries = this.readState().entries || {};
    if (entries[normalizedId]) {
      return entries[normalizedId];
    }

    for (const [key, entry] of Object.entries(entries)) {
      if (
        this.normalizeId(key) === normalizedId
        || this.normalizeId(entry?.pluginId) === normalizedId
      ) {
        return entry;
      }
    }

    return null;
  }

  public resolveState(
    pluginId: string | null | undefined,
    defaults: {
      installed: boolean;
      trust: PluginTrustState;
      installedRevision?: string | null;
      sourceDigest?: string | null;
      sourceLocator?: string | null;
      sourceTrusted?: boolean | null;
    },
  ): StoredPluginState {
    const normalizedId = this.normalizeId(pluginId);
    const fallback: StoredPluginState = {
      pluginId: normalizedId,
      installed: defaults.installed,
      trust: defaults.trust,
      installedRevision: defaults.installedRevision || null,
      sourceDigest: defaults.sourceDigest || null,
      sourceLocator: defaults.sourceLocator || null,
      sourceTrusted: typeof defaults.sourceTrusted === 'boolean' ? defaults.sourceTrusted : null,
      updatedAt: this.now().toISOString(),
    };

    if (!normalizedId) {
      return fallback;
    }

    const stored = this.getState(normalizedId);
    if (!stored) {
      return fallback;
    }

    return {
      pluginId: stored.pluginId || normalizedId,
      installed: typeof stored.installed === 'boolean' ? stored.installed : defaults.installed,
      trust: stored.trust === 'trusted'
        ? 'trusted'
        : stored.trust === 'review'
          ? 'review'
          : defaults.trust,
      installedRevision: stored.installedRevision || defaults.installedRevision || null,
      sourceDigest: stored.sourceDigest || defaults.sourceDigest || null,
      sourceLocator: stored.sourceLocator || defaults.sourceLocator || null,
      sourceTrusted: typeof stored.sourceTrusted === 'boolean'
        ? stored.sourceTrusted
        : typeof defaults.sourceTrusted === 'boolean'
          ? defaults.sourceTrusted
          : null,
      updatedAt: stored.updatedAt || fallback.updatedAt,
    };
  }

  public upsertState(input: {
    pluginId: string;
    installed: boolean;
    trust: PluginTrustState;
    installedRevision?: string | null;
    sourceDigest?: string | null;
    sourceLocator?: string | null;
    sourceTrusted?: boolean | null;
  }): StoredPluginState {
    const normalizedId = this.normalizeId(input.pluginId);
    const state = this.readState();
    const nextEntry: StoredPluginState = {
      pluginId: normalizedId,
      installed: Boolean(input.installed),
      trust: input.trust === 'trusted' ? 'trusted' : 'review',
      installedRevision: input.installedRevision || null,
      sourceDigest: input.sourceDigest || null,
      sourceLocator: input.sourceLocator || null,
      sourceTrusted: typeof input.sourceTrusted === 'boolean' ? input.sourceTrusted : null,
      updatedAt: this.now().toISOString(),
    };
    state.entries[normalizedId] = nextEntry;
    state.updatedAt = nextEntry.updatedAt;
    this.writeJsonFile(state);
    return nextEntry;
  }

  /**
   * Verifica se um plugin foi explicitamente aprovado pelo operador para execução.
   * Um plugin é considerado aprovado apenas se estiver marcado como 'trusted'
   * E se sua fonte for considerada confiável (sourceTrusted === true).
   * Plugins com trust 'review' são sempre bloqueados pelo Cognitive Firewall.
   *
   * @param pluginId - Identificador do plugin a ser verificado
   * @returns true se o plugin estiver aprovado para execução, false caso contrário
   */
  public isApproved(pluginId: string | null | undefined): boolean {
    const state = this.getState(pluginId);
    if (!state) {
      return false;
    }
    return state.trust === 'trusted' && state.sourceTrusted === true;
  }

  public clearState(pluginId: string | null | undefined): boolean {
    const normalizedId = this.normalizeId(pluginId);
    if (!normalizedId) {
      return false;
    }

    const state = this.readState();
    if (!state.entries[normalizedId]) {
      return false;
    }

    delete state.entries[normalizedId];
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(state);
    return true;
  }

  private readJsonFile<T>(fallback: T): T {
    try {
      if (!this.existsSyncImpl(this.stateFile)) {
        return fallback;
      }
      return JSON.parse(this.readFileSyncImpl(this.stateFile, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private writeJsonFile(state: PluginRegistryState): void {
    this.mkdirSyncImpl(path.dirname(this.stateFile), { recursive: true });
    this.writeFileSyncImpl(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-:/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
