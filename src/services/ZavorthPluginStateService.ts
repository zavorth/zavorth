import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthPluginTrustLevel = 'review' | 'trusted' | 'blocked';

export type ZavorthPluginStateEntry = {
  id: string;
  installed: boolean;
  installedRevision: string | null;
  trust: ZavorthPluginTrustLevel;
  notes: string[];
  installedAt: string | null;
  updatedAt: string;
};

type ZavorthPluginState = {
  version: number;
  updatedAt: string;
  entries: Record<string, ZavorthPluginStateEntry>;
};

type ZavorthPluginStateRuntime = {
  now?: () => Date;
  stateFile?: string;
};

export class ZavorthPluginStateService {
  private readonly now: () => Date;
  private readonly stateFile: string;

  constructor(runtime: ZavorthPluginStateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile || config.pluginRegistryStateFile;
  }

  public getEntry(pluginId: string | null | undefined): ZavorthPluginStateEntry | null {
    const normalizedId = this.normalizeId(pluginId);
    if (!normalizedId) {
      return null;
    }
    return this.readState().entries[normalizedId] || null;
  }

  public trust(pluginId: string | null | undefined): ZavorthPluginStateEntry | null {
    return this.upsert(pluginId, (current) => ({
      ...current,
      trust: 'trusted',
    }));
  }

  public untrust(pluginId: string | null | undefined): ZavorthPluginStateEntry | null {
    return this.upsert(pluginId, (current) => ({
      ...current,
      trust: 'review',
      installed: false,
      installedRevision: null,
      installedAt: null,
    }));
  }

  public install(pluginId: string | null | undefined, revision: string, note?: string | null): ZavorthPluginStateEntry | null {
    return this.upsert(pluginId, (current, nowIso) => ({
      ...current,
      installed: true,
      installedRevision: revision,
      trust: current.trust === 'blocked' ? 'review' : current.trust,
      installedAt: current.installedAt || nowIso,
      notes: note ? this.mergeNotes(current.notes, note) : current.notes,
    }));
  }

  public remove(pluginId: string | null | undefined, note?: string | null): ZavorthPluginStateEntry | null {
    return this.upsert(pluginId, (current) => ({
      ...current,
      installed: false,
      installedRevision: null,
      installedAt: null,
      notes: note ? this.mergeNotes(current.notes, note) : current.notes,
    }));
  }

  public refreshRevision(pluginId: string | null | undefined, revision: string, note?: string | null): ZavorthPluginStateEntry | null {
    return this.upsert(pluginId, (current) => ({
      ...current,
      installed: current.installed,
      installedRevision: current.installed ? revision : current.installedRevision,
      notes: note ? this.mergeNotes(current.notes, note) : current.notes,
    }));
  }

  private upsert(
    pluginId: string | null | undefined,
    updater: (current: ZavorthPluginStateEntry, nowIso: string) => ZavorthPluginStateEntry,
  ): ZavorthPluginStateEntry | null {
    const normalizedId = this.normalizeId(pluginId);
    if (!normalizedId) {
      return null;
    }

    const state = this.readState();
    const nowIso = this.now().toISOString();
    const current = state.entries[normalizedId] || {
      id: normalizedId,
      installed: false,
      installedRevision: null,
      trust: 'review' as ZavorthPluginTrustLevel,
      notes: [],
      installedAt: null,
      updatedAt: nowIso,
    };
    const next = {
      ...updater(current, nowIso),
      id: normalizedId,
      updatedAt: nowIso,
    };
    state.entries[normalizedId] = next;
    state.updatedAt = nowIso;
    this.writeState(state);
    return next;
  }

  public readState(): ZavorthPluginState {
    try {
      if (!fs.existsSync(this.stateFile)) {
        return {
          version: 1,
          updatedAt: this.now().toISOString(),
          entries: {},
        };
      }
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as ZavorthPluginState;
    } catch (error: unknown) {logger.warn('[Zavorth Plugin State] JSON parse failed', error);
    return {
        version: 1,
        updatedAt: this.now().toISOString(),
        entries: {},
      };
  }
  }

  private writeState(state: ZavorthPluginState): void {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private normalizeId(input: string | null | undefined): string {
    return String(input || '').trim().toLowerCase();
  }

  private mergeNotes(existing: string[], note: string): string[] {
    return Array.from(new Set([...existing, String(note || '').trim()].filter(Boolean))).slice(0, 8);
  }
}
