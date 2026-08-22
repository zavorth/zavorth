import {
  matchesMemoryFilter,
  normalizeMemoryQueryOptions,
  resolveMemoryQueryLimit,
  type IMemoryBackend,
  type MemoryDeleteOptions,
  type MemoryHit,
  type MemoryMetadata,
  type MemoryQueryOptions,
  type MemoryRecord,
  type MemoryWriteOptions,
} from './IMemoryBackend.js';

type Mem0ClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(content: string, params?: { user_id?: string; metadata?: Record<string, unknown>; [key: string]: any }): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search(query: string, params?: { user_id?: string; limit?: number; [key: string]: any }): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete?(memoryId: string): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update?(memoryId: string, params?: Record<string, unknown>): Promise<any>;
};

type Mem0Module = {
  MemoryClient: new (config?: { apiKey?: string; user_id?: string }) => Mem0ClientLike;
};

type ModuleImporter = () => Promise<Mem0Module>;

/**
 * Mem0 remote backend.
 * Declares contractVersion 2 with best-effort metadata / soft-delete:
 * - metadata forwarded to Mem0 when supported
 * - soft-delete tracked in-process (remote hard-delete when client exposes delete)
 */
export class Mem0MemoryBackend implements IMemoryBackend {
  public readonly name = 'mem0';
  public readonly contractVersion = 2 as const;

  private client: Mem0ClientLike | null = null;
  private availabilityChecked = false;
  private available = false;
  /** Local index for structured v2 ops when Mem0 returns limited fields. */
  private readonly localIndex = new Map<string, MemoryRecord>();
  private readonly softDeleted = new Set<string>();

  constructor(
    private readonly apiKey: string = process.env.MEM0_API_KEY || '',
    private readonly importer: ModuleImporter = async () => {
      const moduleName = 'mem0ai';
      return import(moduleName) as Promise<Mem0Module>;
    },
  ) {}

  public async isAvailable(): Promise<boolean> {
    if (this.availabilityChecked) {
      return this.available;
    }

    this.availabilityChecked = true;

    if (!this.apiKey) {
      this.available = false;
      return false;
    }

    try {
      const module = await this.importer();
      this.client = new module.MemoryClient({ apiKey: this.apiKey });
      this.available = true;
      return true;
    } catch (error: unknown) {
      this.client = null;
      this.available = false;
      return false;
    }
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
    if (!(await this.isAvailable()) || !this.client) {
      throw new Error('Mem0 unavailable in this runtime.');
    }

    const text = String(content || '').trim();
    const meta: MemoryMetadata = {
      ...(options?.metadata || {}),
      key: options?.key || options?.metadata?.key,
      source: options?.metadata?.source || 'mem0',
      category: options?.metadata?.category || 'general',
    };

    const result = await this.client.add(text, {
      user_id: userId,
      metadata: meta as Record<string, unknown>,
    });

    const now = new Date().toISOString();
    const remoteId = String(
      result?.id
      || result?.memory_id
      || (Array.isArray(result) && result[0]?.id)
      || options?.id
      || meta.key
      || `mem0_${Date.now()}`,
    );
    const record: MemoryRecord = {
      id: remoteId,
      userId,
      content: text,
      metadata: { ...meta, key: meta.key || remoteId },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.indexRecord(record);
    this.softDeleted.delete(scopeKey(userId, remoteId));
    return record;
  }

  public async searchMemoryRecords(
    userId: string,
    query: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryHit[]> {
    if (!(await this.isAvailable()) || !this.client) {
      throw new Error('Mem0 unavailable in this runtime.');
    }

    const opts = options || {};
    const limit = resolveMemoryQueryLimit(opts, 5);
    const results = await this.client.search(query, { user_id: userId, limit });
    const hits: MemoryHit[] = [];

    for (const entry of results || []) {
      const content = String(entry?.memory || entry?.content || '').trim();
      if (!content) continue;
      const id = String(entry?.id || entry?.memory_id || `mem0_${hashLite(content)}`);
      if (this.softDeleted.has(scopeKey(userId, id))) continue;

      const indexed = this.localIndex.get(scopeKey(userId, id));
      const record: MemoryRecord = indexed || {
        id,
        userId,
        content,
        metadata: {
          category: 'general',
          source: 'mem0',
          key: id,
          ...(entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}),
        },
        createdAt: String(entry?.created_at || new Date().toISOString()),
        updatedAt: String(entry?.updated_at || entry?.created_at || new Date().toISOString()),
        deletedAt: null,
      };

      if (!matchesMemoryFilter(record, opts.filter)) continue;
      hits.push({
        content,
        record,
        score: typeof entry?.score === 'number' ? entry.score : 1,
      });
      if (hits.length >= limit) break;
    }

    return hits;
  }

  public async listMemoryRecords(
    userId: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryRecord[]> {
    const limit = resolveMemoryQueryLimit(options || {}, 50);
    return [...this.localIndex.values()]
      .filter((r) => r.userId === userId)
      .filter((r) => matchesMemoryFilter(r, options?.filter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  public async getMemoryRecord(
    userId: string,
    idOrKey: string,
  ): Promise<MemoryRecord | null> {
    return this.localIndex.get(scopeKey(userId, idOrKey)) || null;
  }

  public async deleteMemory(
    userId: string,
    idOrKey: string,
    options?: MemoryDeleteOptions,
  ): Promise<boolean> {
    const mode = options?.mode || 'soft';
    const key = scopeKey(userId, idOrKey);
    const record = this.localIndex.get(key);

    if (mode === 'hard') {
      if (this.client && typeof this.client.delete === 'function' && record) {
        try {
          await this.client.delete(record.id);
        } catch {
          // best-effort remote
        }
      }
      this.localIndex.delete(key);
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
      this.localIndex.set(key, next);
      return true;
    }
    this.softDeleted.add(key);
    return true;
  }

  public async restoreMemory(
    userId: string,
    idOrKey: string,
  ): Promise<boolean> {
    const key = scopeKey(userId, idOrKey);
    this.softDeleted.delete(key);
    const record = this.localIndex.get(key);
    if (!record) return false;
    this.localIndex.set(key, {
      ...record,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  private indexRecord(record: MemoryRecord): void {
    this.localIndex.set(scopeKey(record.userId, record.id), record);
    if (record.metadata.key) {
      this.localIndex.set(scopeKey(record.userId, String(record.metadata.key)), record);
    }
  }
}

function scopeKey(userId: string, idOrKey: string): string {
  return `${userId}::${String(idOrKey || '').trim().toLowerCase()}`;
}

function hashLite(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
