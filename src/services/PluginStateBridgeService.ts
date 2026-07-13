import fs from 'node:fs';
import path from 'node:path';

import type { ZavorthPluginRuntimeState, ZavorthPluginTrustLevel } from '../contracts/PluginManifestContract.js';
import {
  PluginStateService,
  type PluginTrustState,
  type StoredPluginState,
} from './PluginStateService.js';
import type { PluginDiscoveryStateLookup } from './PluginDiscoveryService.js';
import type {
  BridgedPluginState,
  PluginOsStateEntry,
  PluginOsStateFile,
  PluginStateBridgeRuntime,
} from './PluginStateBridgeContracts.js';

export type {
  BridgedPluginState,
  PluginOsStateEntry,
  PluginOsStateFile,
  PluginStateBridgeRuntime,
} from './PluginStateBridgeContracts.js';

type MutableView = {
  pluginId: string;
  installed: boolean;
  enabled: boolean;
  trust: ZavorthPluginTrustLevel;
  installedRevision: string | null;
  sourceDigest: string | null;
  sourceLocator: string | null;
  sourceTrusted: boolean | null;
  updatedAt: string;
  origins: {
    fromPluginStateService: boolean;
    fromCliRecord: boolean;
    fromRuntimeIndex: boolean;
  };
};

export class PluginStateBridgeService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly pluginStateService: Pick<PluginStateService, 'getState' | 'upsertState' | 'clearState' | 'readState'>;
  private readonly pluginsFile: string;
  private readonly runtimeFile: string;
  private readonly osStateFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: PluginStateBridgeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    const stateDir = path.join(this.projectRoot, '.zavorth');
    this.pluginsFile = runtime.pluginsFile || path.join(stateDir, 'plugins.json');
    this.runtimeFile = runtime.runtimeFile || path.join(stateDir, 'plugins-runtime.json');
    this.osStateFile = runtime.osStateFile || path.join(stateDir, 'plugin-os-state.json');
    this.pluginStateService = runtime.pluginStateService || new PluginStateService({
      now: this.now,
      stateFile: path.join(stateDir, 'plugin-registry-state.json'),
    });
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public resolve(pluginId: string): BridgedPluginState {
    const normalizedId = this.normalizeId(pluginId);
    const view = this.createDefaultView(normalizedId || String(pluginId || '').trim() || 'unknown');
    this.applyPluginStateService(view, normalizedId);
    this.applyOsState(view, normalizedId);
    this.applyCliRecord(view, normalizedId);
    this.applyRuntimeIndex(view, normalizedId);
    return this.finalize(view);
  }

  public list(): BridgedPluginState[] {
    const ids = new Set<string>();

    try {
      const state = this.pluginStateService.readState();
      for (const [key, entry] of Object.entries(state.entries || {})) {
        const id = this.normalizeId(entry?.pluginId) || this.normalizeId(key);
        if (id) ids.add(id);
      }
    } catch {
      /* soft-fail */
    }

    const osState = this.readOsState();
    for (const [key, entry] of Object.entries(osState.entries || {})) {
      const id = this.normalizeId(entry?.pluginId) || this.normalizeId(key);
      if (id) ids.add(id);
    }

    for (const record of this.readCliRecords()) {
      const id = this.normalizeId(String(record.id || record.name || record.spec || ''));
      if (id) ids.add(id);
    }

    for (const id of this.readRuntimeEnabledIds()) {
      if (id) ids.add(id);
    }

    return Array.from(ids)
      .sort((left, right) => left.localeCompare(right))
      .map((id) => this.resolve(id));
  }

  public asStateLookup(): PluginDiscoveryStateLookup {
    return {
      resolve: (pluginId: string) => {
        const bridged = this.resolve(pluginId);
        return {
          installed: bridged.installed,
          enabled: bridged.enabled && bridged.trust !== 'blocked',
          trust: bridged.trust,
          installedRevision: bridged.installedRevision,
          sourceLocator: bridged.sourceLocator,
        };
      },
    };
  }

  public markInstalled(input: {
    pluginId: string;
    revision?: string | null;
    sourceLocator?: string | null;
    sourceDigest?: string | null;
    sourceTrusted?: boolean | null;
    trust?: 'review' | 'trusted' | 'blocked';
    enable?: boolean;
  }): BridgedPluginState {
    const pluginId = this.normalizeId(input.pluginId) || String(input.pluginId || '').trim();
    const trust = this.normalizeTrust(input.trust || 'review');
    const enabled = input.enable === true;
    const updatedAt = this.now().toISOString();
    const installedRevision = input.revision ?? null;
    const sourceLocator = input.sourceLocator ?? null;
    const sourceDigest = input.sourceDigest ?? null;
    const sourceTrusted = typeof input.sourceTrusted === 'boolean' ? input.sourceTrusted : null;

    this.writePluginStateService({
      pluginId,
      installed: true,
      trust,
      installedRevision,
      sourceLocator,
      sourceDigest,
      sourceTrusted,
    });

    this.writeOsEntry({
      pluginId,
      installed: true,
      enabled,
      trust,
      installedRevision,
      sourceLocator,
      sourceDigest,
      sourceTrusted,
      updatedAt,
    });

    const records = this.readCliRecords();
    const existing = records.find((record) => this.cliRecordMatches(record, pluginId));
    if (existing) {
      existing.status = existing.status === 'install-failed' ? existing.status : 'installed';
      if (installedRevision) existing.version = installedRevision;
      if (sourceLocator && !existing.spec) existing.spec = sourceLocator;
      if (sourceDigest) existing.checksum = sourceDigest;
      existing.enabled = enabled;
      existing.updatedAt = updatedAt;
    } else {
      records.push({
        id: pluginId,
        name: pluginId,
        spec: sourceLocator || pluginId,
        version: installedRevision || '0.0.0',
        status: 'installed',
        enabled,
        checksum: sourceDigest,
        installedAt: updatedAt,
        createdAt: updatedAt,
        updatedAt,
      });
    }
    this.writeCliRecords(records);
    this.syncRuntimeIndex();
    return this.resolve(pluginId);
  }

  public setEnabled(pluginId: string, enabled: boolean): BridgedPluginState {
    const id = this.normalizeId(pluginId) || String(pluginId || '').trim();
    const current = this.resolve(id);
    const updatedAt = this.now().toISOString();

    this.writeOsEntry({
      pluginId: id,
      installed: current.installed || enabled,
      enabled,
      trust: current.trust,
      installedRevision: current.installedRevision,
      sourceLocator: current.sourceLocator,
      sourceDigest: current.sourceDigest,
      sourceTrusted: current.sourceTrusted,
      updatedAt,
    });

    if (current.installed || enabled) {
      this.writePluginStateService({
        pluginId: id,
        installed: true,
        trust: current.trust,
        installedRevision: current.installedRevision,
        sourceLocator: current.sourceLocator,
        sourceDigest: current.sourceDigest,
        sourceTrusted: current.sourceTrusted,
      });
    }

    const records = this.readCliRecords();
    const existing = records.find((record) => this.cliRecordMatches(record, id));
    if (existing) {
      existing.enabled = enabled;
      existing.updatedAt = updatedAt;
      if (enabled && existing.status !== 'installed' && existing.status !== 'install-failed') {
        existing.status = 'installed';
      }
      this.writeCliRecords(records);
    }

    this.syncRuntimeIndex();
    return this.resolve(id);
  }

  public setTrust(pluginId: string, trust: 'review' | 'trusted' | 'blocked'): BridgedPluginState {
    const id = this.normalizeId(pluginId) || String(pluginId || '').trim();
    const current = this.resolve(id);
    const nextTrust = this.normalizeTrust(trust);
    const updatedAt = this.now().toISOString();

    this.writeOsEntry({
      pluginId: id,
      installed: current.installed,
      enabled: current.enabled,
      trust: nextTrust,
      installedRevision: current.installedRevision,
      sourceLocator: current.sourceLocator,
      sourceDigest: current.sourceDigest,
      sourceTrusted: current.sourceTrusted,
      updatedAt,
    });

    this.writePluginStateService({
      pluginId: id,
      installed: current.installed,
      trust: nextTrust,
      installedRevision: current.installedRevision,
      sourceLocator: current.sourceLocator,
      sourceDigest: current.sourceDigest,
      sourceTrusted: current.sourceTrusted,
    });

    return this.resolve(id);
  }

  public markUninstalled(pluginId: string): BridgedPluginState | null {
    const id = this.normalizeId(pluginId) || String(pluginId || '').trim();
    if (!id) {
      return null;
    }

    try {
      this.pluginStateService.clearState(id);
    } catch {
      /* soft-fail */
    }

    const osState = this.readOsState();
    if (osState.entries[id]) {
      delete osState.entries[id];
      osState.updatedAt = this.now().toISOString();
      this.writeOsState(osState);
    }

    const records = this.readCliRecords();
    const next = records.filter((record) => !this.cliRecordMatches(record, id));
    if (next.length !== records.length) {
      this.writeCliRecords(next);
    }

    // Drop the id from the runtime index before sync so list()/resolve()
    // cannot re-inflate installed=true from a stale enabled entry.
    this.removeFromRuntimeIndex(id);
    this.syncRuntimeIndex();
    return this.resolve(id);
  }

  private removeFromRuntimeIndex(pluginId: string): void {
    const id = this.normalizeId(pluginId);
    if (!id || !this.existsSyncImpl(this.runtimeFile)) {
      return;
    }
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(this.runtimeFile, 'utf8')) as {
        version?: number;
        enabled?: unknown;
      };
      const enabled = Array.isArray(parsed?.enabled) ? parsed.enabled : [];
      const filtered = enabled.filter((item) => {
        if (typeof item === 'string') {
          return this.normalizeId(item) !== id;
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const candidate = this.normalizeId(String(record.id || record.name || ''));
          return candidate !== id;
        }
        return true;
      });
      this.mkdirSyncImpl(path.dirname(this.runtimeFile), { recursive: true });
      this.writeFileSyncImpl(
        this.runtimeFile,
        `${JSON.stringify({
          version: Number.isFinite(parsed?.version) ? parsed.version : 1,
          updatedAt: this.now().toISOString(),
          enabled: filtered,
        }, null, 2)}\n`,
        'utf8',
      );
    } catch {
      /* soft-fail */
    }
  }

  public upsertCliRecord(partial: Record<string, unknown>): void {
    const pluginId = this.normalizeId(String(partial.id || partial.name || partial.spec || ''));
    if (!pluginId) {
      return;
    }
    const records = this.readCliRecords();
    const existing = records.find((record) => this.cliRecordMatches(record, pluginId));
    if (existing) {
      Object.assign(existing, partial, { id: existing.id || pluginId });
    } else {
      records.push({ ...partial, id: partial.id || pluginId });
    }
    this.writeCliRecords(records);
  }

  public readCliRecords(): Array<Record<string, unknown>> {
    try {
      if (!this.existsSyncImpl(this.pluginsFile)) {
        return [];
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.pluginsFile, 'utf8'));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({ ...item }));
    } catch {
      return [];
    }
  }

  public writeCliRecords(records: Array<Record<string, unknown>>): void {
    this.mkdirSyncImpl(path.dirname(this.pluginsFile), { recursive: true });
    this.writeFileSyncImpl(this.pluginsFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }

  public syncRuntimeIndex(): void {
    // Derive enabled set from OS state + CLI only (never from the runtime index itself)
    // to avoid enable/disable feedback loops when resolve() re-applies runtime membership.
    const cliById = new Map<string, Record<string, unknown>>();
    for (const record of this.readCliRecords()) {
      const id = this.normalizeId(String(record.id || record.name || record.spec || ''));
      if (id) {
        cliById.set(id, record);
      }
    }

    const enabledIds = new Set<string>();
    const osState = this.readOsState();
    for (const entry of Object.values(osState.entries || {})) {
      const id = this.normalizeId(entry.pluginId);
      if (!id) continue;
      if (entry.installed && entry.enabled && entry.trust !== 'blocked') {
        enabledIds.add(id);
      } else if (id && entry.enabled === false) {
        enabledIds.delete(id);
      }
    }
    for (const [id, record] of cliById.entries()) {
      const trust = this.normalizeTrust(String(record.trust || 'review'));
      if (trust === 'blocked') {
        enabledIds.delete(id);
        continue;
      }
      if (record.enabled === true) {
        enabledIds.add(id);
      } else if (record.enabled === false) {
        enabledIds.delete(id);
      }
    }

    const enabled = Array.from(enabledIds)
      .sort((left, right) => left.localeCompare(right))
      .map((pluginId) => {
        const record = cliById.get(pluginId) || {};
        const osEntry = osState.entries[pluginId];
        return {
          id: pluginId,
          name: record.name || pluginId,
          version: osEntry?.installedRevision || record.version || null,
          entry: record.entry || null,
          permissions: record.permissions || [],
          sandbox: record.sandbox || {},
          hooks: record.hooks || {},
          checksum: osEntry?.sourceDigest || record.checksum || null,
        };
      });

    const payload = {
      version: 1,
      updatedAt: this.now().toISOString(),
      enabled,
    };
    this.mkdirSyncImpl(path.dirname(this.runtimeFile), { recursive: true });
    this.writeFileSyncImpl(this.runtimeFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  public formatSnapshotText(): string {
    const entries = this.list();
    const lines = [
      'Zavorth Plugin State Bridge',
      `Generated: ${this.now().toISOString()}`,
      `Plugins: ${entries.length}`,
      `Installed: ${entries.filter((entry) => entry.installed).length}`,
      `Enabled: ${entries.filter((entry) => entry.enabled).length}`,
      `Blocked: ${entries.filter((entry) => entry.trust === 'blocked').length}`,
    ];
    for (const entry of entries.slice(0, 40)) {
      lines.push(
        `- ${entry.pluginId} installed=${entry.installed} enabled=${entry.enabled} trust=${entry.trust} state=${entry.runtimeState}`,
      );
    }
    return lines.join('\n');
  }

  private createDefaultView(pluginId: string): MutableView {
    return {
      pluginId,
      installed: false,
      enabled: false,
      trust: 'review',
      installedRevision: null,
      sourceDigest: null,
      sourceLocator: null,
      sourceTrusted: null,
      updatedAt: this.now().toISOString(),
      origins: {
        fromPluginStateService: false,
        fromCliRecord: false,
        fromRuntimeIndex: false,
      },
    };
  }

  private applyPluginStateService(view: MutableView, normalizedId: string): void {
    if (!normalizedId) {
      return;
    }
    try {
      const stored = this.pluginStateService.getState(normalizedId) as StoredPluginState | null;
      if (!stored) {
        return;
      }
      view.origins.fromPluginStateService = true;
      if (typeof stored.installed === 'boolean') {
        view.installed = stored.installed;
      }
      if (stored.trust === 'trusted' || stored.trust === 'review') {
        view.trust = stored.trust;
      }
      if (stored.installedRevision) {
        view.installedRevision = stored.installedRevision;
      }
      if (stored.sourceDigest) {
        view.sourceDigest = stored.sourceDigest;
      }
      if (stored.sourceLocator) {
        view.sourceLocator = stored.sourceLocator;
      }
      if (typeof stored.sourceTrusted === 'boolean') {
        view.sourceTrusted = stored.sourceTrusted;
      }
      if (stored.updatedAt) {
        view.updatedAt = stored.updatedAt;
      }
    } catch {
      /* soft-fail */
    }
  }

  private applyOsState(view: MutableView, normalizedId: string): void {
    if (!normalizedId) {
      return;
    }
    const osState = this.readOsState();
    const entry = osState.entries[normalizedId]
      || Object.values(osState.entries).find((item) => this.normalizeId(item.pluginId) === normalizedId);
    if (!entry) {
      return;
    }
    if (typeof entry.installed === 'boolean') {
      view.installed = entry.installed;
    }
    if (typeof entry.enabled === 'boolean') {
      view.enabled = entry.enabled;
    }
    if (entry.trust === 'trusted' || entry.trust === 'review' || entry.trust === 'blocked') {
      view.trust = entry.trust;
    }
    if (entry.installedRevision) {
      view.installedRevision = entry.installedRevision;
    }
    if (entry.sourceDigest) {
      view.sourceDigest = entry.sourceDigest;
    }
    if (entry.sourceLocator) {
      view.sourceLocator = entry.sourceLocator;
    }
    if (typeof entry.sourceTrusted === 'boolean') {
      view.sourceTrusted = entry.sourceTrusted;
    }
    if (entry.updatedAt) {
      view.updatedAt = entry.updatedAt;
    }
  }

  private applyCliRecord(view: MutableView, normalizedId: string): void {
    if (!normalizedId) {
      return;
    }
    const record = this.readCliRecords().find((item) => this.cliRecordMatches(item, normalizedId));
    if (!record) {
      return;
    }
    view.origins.fromCliRecord = true;
    const status = String(record.status || '').toLowerCase();
    const statusInstalled = status === 'installed'
      || (status.includes('install') && !status.includes('failed'));
    if (statusInstalled || record.enabled === true) {
      view.installed = true;
    }
    if (record.enabled === true) {
      view.enabled = true;
    } else if (record.enabled === false) {
      view.enabled = false;
    }
    if (!view.sourceLocator && record.spec) {
      view.sourceLocator = String(record.spec);
    }
    if (!view.installedRevision && record.version) {
      view.installedRevision = String(record.version);
    }
    if (!view.sourceDigest && record.checksum) {
      view.sourceDigest = String(record.checksum);
    }
    if (record.updatedAt) {
      view.updatedAt = String(record.updatedAt);
    } else if (record.installedAt) {
      view.updatedAt = String(record.installedAt);
    }
  }

  private applyRuntimeIndex(view: MutableView, normalizedId: string): void {
    if (!normalizedId) {
      return;
    }
    if (!this.readRuntimeEnabledIds().has(normalizedId)) {
      return;
    }
    view.origins.fromRuntimeIndex = true;
    view.enabled = true;
    view.installed = true;
  }

  private finalize(view: MutableView): BridgedPluginState {
    const trust = this.normalizeTrust(view.trust);
    const installed = view.installed === true;
    const enabled = view.enabled === true;
    return {
      pluginId: view.pluginId,
      installed,
      enabled,
      trust,
      installedRevision: view.installedRevision,
      sourceDigest: view.sourceDigest,
      sourceLocator: view.sourceLocator,
      sourceTrusted: view.sourceTrusted,
      runtimeState: this.mapRuntimeState({ trust, installed, enabled }),
      updatedAt: view.updatedAt || this.now().toISOString(),
      origins: { ...view.origins },
    };
  }

  private mapRuntimeState(input: {
    trust: ZavorthPluginTrustLevel;
    installed: boolean;
    enabled: boolean;
  }): ZavorthPluginRuntimeState {
    if (input.trust === 'blocked') {
      return 'blocked';
    }
    if (input.installed && input.enabled) {
      return 'enabled';
    }
    if (input.installed) {
      return 'disabled';
    }
    return 'available';
  }

  private writePluginStateService(input: {
    pluginId: string;
    installed: boolean;
    trust: ZavorthPluginTrustLevel;
    installedRevision: string | null;
    sourceLocator: string | null;
    sourceDigest: string | null;
    sourceTrusted: boolean | null;
  }): void {
    const trustForState: PluginTrustState = input.trust === 'trusted' ? 'trusted' : 'review';
    try {
      this.pluginStateService.upsertState({
        pluginId: input.pluginId,
        installed: input.installed,
        trust: trustForState,
        installedRevision: input.installedRevision,
        sourceLocator: input.sourceLocator,
        sourceDigest: input.sourceDigest,
        sourceTrusted: input.sourceTrusted,
      });
    } catch {
      /* soft-fail */
    }
  }

  private writeOsEntry(entry: PluginOsStateEntry): void {
    const osState = this.readOsState();
    const id = this.normalizeId(entry.pluginId) || entry.pluginId;
    osState.entries[id] = {
      ...entry,
      pluginId: id,
      trust: this.normalizeTrust(entry.trust),
    };
    osState.updatedAt = entry.updatedAt || this.now().toISOString();
    this.writeOsState(osState);
  }

  private readOsState(): PluginOsStateFile {
    const fallback: PluginOsStateFile = {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: Object.create(null) as Record<string, PluginOsStateEntry>,
    };
    try {
      if (!this.existsSyncImpl(this.osStateFile)) {
        return fallback;
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.osStateFile, 'utf8')) as PluginOsStateFile;
      const entries = Object.create(null) as Record<string, PluginOsStateEntry>;
      for (const [key, entry] of Object.entries(parsed?.entries || {})) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const id = this.normalizeId(entry.pluginId) || this.normalizeId(key);
        if (!id) {
          continue;
        }
        entries[id] = {
          pluginId: id,
          enabled: entry.enabled === true,
          trust: this.normalizeTrust(entry.trust),
          installed: entry.installed === true,
          installedRevision: entry.installedRevision || null,
          sourceDigest: entry.sourceDigest || null,
          sourceLocator: entry.sourceLocator || null,
          sourceTrusted: typeof entry.sourceTrusted === 'boolean' ? entry.sourceTrusted : null,
          updatedAt: entry.updatedAt || this.now().toISOString(),
        };
      }
      return {
        version: Number.isFinite(parsed?.version) ? parsed.version : 1,
        updatedAt: parsed?.updatedAt || this.now().toISOString(),
        entries,
      };
    } catch {
      return fallback;
    }
  }

  private writeOsState(state: PluginOsStateFile): void {
    this.mkdirSyncImpl(path.dirname(this.osStateFile), { recursive: true });
    this.writeFileSyncImpl(this.osStateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private readRuntimeEnabledIds(): Set<string> {
    const ids = new Set<string>();
    try {
      if (!this.existsSyncImpl(this.runtimeFile)) {
        return ids;
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.runtimeFile, 'utf8')) as {
        enabled?: unknown;
      };
      const enabled = parsed?.enabled;
      if (!Array.isArray(enabled)) {
        return ids;
      }
      for (const item of enabled) {
        if (typeof item === 'string') {
          const id = this.normalizeId(item);
          if (id) ids.add(id);
          continue;
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const id = this.normalizeId(String(record.id || record.name || ''));
          if (id) ids.add(id);
        }
      }
    } catch {
      /* soft-fail */
    }
    return ids;
  }

  private cliRecordMatches(record: Record<string, unknown>, pluginId: string): boolean {
    const candidates = [record.id, record.name, record.spec]
      .map((value) => this.normalizeId(String(value || '')))
      .filter(Boolean);
    return candidates.includes(pluginId);
  }

  private normalizeTrust(value: unknown): ZavorthPluginTrustLevel {
    if (value === 'trusted' || value === 'blocked' || value === 'review') {
      return value;
    }
    return 'review';
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
