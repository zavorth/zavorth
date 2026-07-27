import { MemoryService, type MemoryEntry } from '../MemoryService.js';
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

export class LocalMemoryBackend implements IMemoryBackend {
  public readonly name = 'local';
  public readonly contractVersion = 2 as const;

  constructor(private readonly memoryService: MemoryService = new MemoryService()) {}

  public async isAvailable(): Promise<boolean> {
    return true;
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
    const text = String(content || '').trim();
    const meta = options?.metadata || {};
    const key = String(options?.key || meta.key || `fato_${Date.now()}`).trim().toLowerCase();
    const category = String(meta.category || 'agent_extracted').trim().toLowerCase() || 'agent_extracted';
    const metadata: MemoryMetadata = {
      ...meta,
      key,
      category,
      source: meta.source || 'local',
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : meta.tags ? [String(meta.tags)] : undefined,
    };

    await this.memoryService.remember(userId, key, text, category, {
      metadata,
    });

    const entry = await this.memoryService.getByKey(userId, key, { includeDeleted: true });
    if (!entry) {
      // Should not happen; synthesize from write
      const now = new Date().toISOString();
      return {
        id: key,
        userId,
        content: text,
        metadata,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
    }
    return this.toRecord(entry);
  }

  public async searchMemoryRecords(
    userId: string,
    query: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryHit[]> {
    const opts = options || {};
    const limit = resolveMemoryQueryLimit(opts, 5);
    const category = opts.filter?.category;
    const entries = await this.memoryService.listRelevant(userId, query, Math.max(limit * 2, 16), {
      includeDeleted: opts.filter?.includeDeleted === true,
      category: category || null,
    });

    const hits: MemoryHit[] = [];
    for (const entry of entries) {
      const record = this.toRecord(entry);
      if (!matchesMemoryFilter(record, opts.filter)) continue;
      hits.push({
        content: `[${record.metadata.category || 'general'}] ${record.content}`,
        record,
        score: 1,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  public async listMemoryRecords(
    userId: string,
    options?: MemoryQueryOptions,
  ): Promise<MemoryRecord[]> {
    const opts = options || {};
    const limit = resolveMemoryQueryLimit(opts, 50);
    const entries = await this.memoryService.listAll(userId, {
      includeDeleted: opts.filter?.includeDeleted === true,
      category: opts.filter?.category || null,
      limit: Math.max(limit * 2, limit),
    });

    return entries
      .map((entry) => this.toRecord(entry))
      .filter((record) => matchesMemoryFilter(record, opts.filter))
      .slice(0, limit);
  }

  public async getMemoryRecord(
    userId: string,
    idOrKey: string,
  ): Promise<MemoryRecord | null> {
    const entry = await this.memoryService.getByKey(userId, idOrKey, { includeDeleted: true });
    return entry ? this.toRecord(entry) : null;
  }

  public async deleteMemory(
    userId: string,
    idOrKey: string,
    options?: MemoryDeleteOptions,
  ): Promise<boolean> {
    const mode = options?.mode || 'soft';
    if (mode === 'hard') {
      return this.memoryService.hardDelete(userId, idOrKey);
    }
    return this.memoryService.softDelete(userId, idOrKey);
  }

  public async restoreMemory(
    userId: string,
    idOrKey: string,
  ): Promise<boolean> {
    return this.memoryService.restore(userId, idOrKey);
  }

  public getMemoryService(): MemoryService {
    return this.memoryService;
  }

  private toRecord(entry: MemoryEntry): MemoryRecord {
    const parsed = this.memoryService.parseMetadata(entry);
    const tagsRaw = parsed.tags;
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.map(String)
      : typeof tagsRaw === 'string'
        ? [tagsRaw]
        : undefined;

    return {
      id: String(entry.id || entry.key),
      userId: entry.user_id,
      content: entry.value,
      metadata: {
        ...parsed,
        key: entry.key,
        category: entry.category || 'general',
        source: typeof parsed.source === 'string' ? parsed.source : 'local',
        ...(tags ? { tags } : {}),
      },
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      deletedAt: entry.deleted_at || null,
    };
  }
}
