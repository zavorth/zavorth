/**
 * Backward-compatible adapters for IMemoryBackend v2.
 *
 * Wraps any backend (v1 string-only or partial v2) into a full v2 surface
 * without requiring callers to feature-detect every method.
 */

import {
  matchesMemoryFilter,
  normalizeMemoryQueryOptions,
  resolveMemoryQueryLimit,
  type IMemoryBackend,
  type MemoryDeleteOptions,
  type MemoryHit,
  type MemoryQueryOptions,
  type MemoryRecord,
  type MemoryWriteOptions,
} from './IMemoryBackend.js';

export type IMemoryBackendV2 = IMemoryBackend & {
  readonly contractVersion: 2;
  addMemoryRecord(
    userId: string,
    content: string,
    options?: MemoryWriteOptions,
  ): Promise<MemoryRecord>;
  searchMemoryRecords(
    userId: string,
    query: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryHit[]>;
  listMemoryRecords(
    userId: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryRecord[]>;
  getMemoryRecord(
    userId: string,
    idOrKey: string,
  ): Promise<MemoryRecord | null>;
  deleteMemory(
    userId: string,
    idOrKey: string,
    options?: MemoryDeleteOptions,
  ): Promise<boolean>;
  restoreMemory(
    userId: string,
    idOrKey: string,
  ): Promise<boolean>;
};

/**
 * Lift any IMemoryBackend to a full v2 API.
 * Prefer native methods when present; synthesize the rest from v1.
 */
export function asMemoryBackendV2(backend: IMemoryBackend): IMemoryBackendV2 {
  if (isFullV2(backend)) {
    return backend;
  }
  return new MemoryBackendCompatAdapter(backend);
}

function isFullV2(backend: IMemoryBackend): backend is IMemoryBackendV2 {
  return (
    backend.contractVersion === 2
    && typeof backend.addMemoryRecord === 'function'
    && typeof backend.searchMemoryRecords === 'function'
    && typeof backend.listMemoryRecords === 'function'
    && typeof backend.getMemoryRecord === 'function'
    && typeof backend.deleteMemory === 'function'
    && typeof backend.restoreMemory === 'function'
  );
}

/**
 * Adapter: v1 backend to v2 surface with in-memory metadata/soft-delete overlay
 * when the underlying backend cannot persist those fields.
 */
export class MemoryBackendCompatAdapter implements IMemoryBackendV2 {
  public readonly contractVersion = 2 as const;
  public readonly name: string;

  /** Overlay for soft-deleted ids when native delete is missing. */
  private readonly softDeleted = new Set<string>();
  /** Overlay records synthesized from v1 writes (best-effort). */
  private readonly overlay = new Map<string, MemoryRecord>();

  constructor(private readonly inner: IMemoryBackend) {
    this.name = `${inner.name}+compat-v2`;
  }

  public getInner(): IMemoryBackend {
    return this.inner;
  }

  public async isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  public async addMemory(
    userId: string,
    content: string,
    options?: MemoryWriteOptions,
  ): Promise<void> {
    await this.addMemoryRecord(userId, content, options);
  }

  public async searchMemory(
    userId: string,
    query: string,
    limitOrOptions?: number | MemoryQueryOptions,
  ): Promise<string[]> {
    const hits = await this.searchMemoryRecords(
      userId,
      query,
      normalizeMemoryQueryOptions(limitOrOptions),
    );
    return hits.map((hit) => hit.content);
  }

  public async addMemoryRecord(
    userId: string,
    content: string,
    options?: MemoryWriteOptions,
  ): Promise<MemoryRecord> {
    if (typeof this.inner.addMemoryRecord === 'function') {
      const record = await this.inner.addMemoryRecord(userId, content, options);
      this.overlay.set(scopeKey(userId, record.id), record);
      if (record.metadata.key) {
        this.overlay.set(scopeKey(userId, record.metadata.key), record);
      }
      this.softDeleted.delete(scopeKey(userId, record.id));
      return record;
    }

    await this.inner.addMemory(userId, content, options);
    const now = new Date().toISOString();
    const key = String(options?.key || options?.metadata?.key || `mem_${Date.now()}`).trim();
    const id = String(options?.id || key).trim();
    const record: MemoryRecord = {
      id,
      userId,
      content: String(content || '').trim(),
      metadata: {
        ...(options?.metadata || {}),
        key,
        category: options?.metadata?.category || 'general',
        source: options?.metadata?.source || this.inner.name,
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.overlay.set(scopeKey(userId, id), record);
    this.overlay.set(scopeKey(userId, key), record);
    this.softDeleted.delete(scopeKey(userId, id));
    return record;
  }

  public async searchMemoryRecords(
    userId: string,
    query: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryHit[]> {
    if (typeof this.inner.searchMemoryRecords === 'function') {
      return this.inner.searchMemoryRecords(userId, query, options);
    }

    const opts = options || {};
    const limit = resolveMemoryQueryLimit(opts, 5);
    const strings = await this.inner.searchMemory(userId, query, limit);
    const hits: MemoryHit[] = [];

    for (const content of strings) {
      const fromOverlay = [...this.overlay.values()].find(
        (r) => r.userId === userId && r.content === content && !this.isSoftDeleted(userId, r),
      );
      const record = fromOverlay || synthesizeRecord(userId, content, this.inner.name);
      if (!matchesMemoryFilter(record, opts.filter)) continue;
      hits.push({ content, record, score: 1 });
      if (hits.length >= limit) break;
    }

    return hits;
  }

  public async listMemoryRecords(
    userId: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryRecord[]> {
    if (typeof this.inner.listMemoryRecords === 'function') {
      return this.inner.listMemoryRecords(userId, options);
    }

    const limit = resolveMemoryQueryLimit(options || {}, 50);
    const records = [...this.overlay.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => matchesMemoryFilter(r, options?.filter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
    return records;
  }

  public async getMemoryRecord(
    userId: string,
    idOrKey: string,
  ): Promise<MemoryRecord | null> {
    if (typeof this.inner.getMemoryRecord === 'function') {
      return this.inner.getMemoryRecord(userId, idOrKey);
    }
    return this.overlay.get(scopeKey(userId, idOrKey)) || null;
  }

  public async deleteMemory(
    userId: string,
    idOrKey: string,
    options?: MemoryDeleteOptions,
  ): Promise<boolean> {
    if (typeof this.inner.deleteMemory === 'function') {
      return this.inner.deleteMemory(userId, idOrKey, options);
    }

    const mode = options?.mode || 'soft';
    const key = scopeKey(userId, idOrKey);
    const record = this.overlay.get(key);

    if (mode === 'hard') {
      this.overlay.delete(key);
      if (record?.metadata.key) {
        this.overlay.delete(scopeKey(userId, String(record.metadata.key)));
      }
      this.softDeleted.delete(key);
      return Boolean(record);
    }

    this.softDeleted.add(key);
    if (record) {
      const next: MemoryRecord = {
        ...record,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.overlay.set(key, next);
      if (record.metadata.key) {
        this.overlay.set(scopeKey(userId, String(record.metadata.key)), next);
      }
      return true;
    }
    // Mark unknown keys so search overlay can hide synthesized matches later
    this.softDeleted.add(key);
    return true;
  }

  public async restoreMemory(
    userId: string,
    idOrKey: string,
  ): Promise<boolean> {
    if (typeof this.inner.restoreMemory === 'function') {
      return this.inner.restoreMemory(userId, idOrKey);
    }

    const key = scopeKey(userId, idOrKey);
    this.softDeleted.delete(key);
    const record = this.overlay.get(key);
    if (!record) return false;
    const next: MemoryRecord = {
      ...record,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    };
    this.overlay.set(key, next);
    if (record.metadata.key) {
      this.overlay.set(scopeKey(userId, String(record.metadata.key)), next);
    }
    return true;
  }

  private isSoftDeleted(userId: string, record: MemoryRecord): boolean {
    if (record.deletedAt) return true;
    return this.softDeleted.has(scopeKey(userId, record.id))
      || this.softDeleted.has(scopeKey(userId, String(record.metadata.key || '')));
  }
}

function scopeKey(userId: string, idOrKey: string): string {
  return `${userId}::${String(idOrKey || '').trim().toLowerCase()}`;
}

function synthesizeRecord(userId: string, content: string, source: string): MemoryRecord {
  const now = new Date().toISOString();
  const id = `synth_${hashLite(content)}`;
  // Parse "[category] value" lines from LocalMemoryBackend search format
  const match = content.match(/^\[([^\]]+)\]\s*(.*)$/);
  return {
    id,
    userId,
    content: match ? match[2] : content,
    metadata: {
      category: match ? match[1] : 'general',
      source,
      key: id,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function hashLite(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
