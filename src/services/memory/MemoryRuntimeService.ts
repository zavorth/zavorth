import { MemoryService, type MemoryEntry } from '../MemoryService.js';
import {
  normalizeMemoryQueryOptions,
  type IMemoryBackend,
  type MemoryDeleteOptions,
  type MemoryHit,
  type MemoryQueryOptions,
  type MemoryRecord,
  type MemoryWriteOptions,
} from './IMemoryBackend.js';
import { asMemoryBackendV2, type IMemoryBackendV2 } from './MemoryBackendCompat.js';
import { LocalMemoryBackend } from './LocalMemoryBackend.js';
import { Mem0MemoryBackend } from './Mem0MemoryBackend.js';
import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';

type MemoryAddOptions = {
  backend?: 'auto' | 'local' | 'mem0';
  write?: MemoryWriteOptions;
};

type MemorySearchOptions = {
  backend?: 'auto' | 'local' | 'mem0';
  limit?: number;
  filter?: MemoryQueryOptions['filter'];
};

export class MemoryRuntimeService {
  private readonly localBackend: LocalMemoryBackend;
  private readonly mem0Backend: IMemoryBackend;
  private readonly localV2: IMemoryBackendV2;
  private readonly mem0V2: IMemoryBackendV2;

  constructor(
    localBackend: LocalMemoryBackend = new LocalMemoryBackend(),
    mem0Backend: IMemoryBackend = new Mem0MemoryBackend(),
  ) {
    this.localBackend = localBackend;
    this.mem0Backend = mem0Backend;
    this.localV2 = asMemoryBackendV2(localBackend);
    this.mem0V2 = asMemoryBackendV2(mem0Backend);
  }

  public async addMemory(
    userId: string,
    content: string,
    options: MemoryAddOptions = {},
  ): Promise<string> {
    const backend = options.backend || 'auto';
    const write = options.write;

    if (backend === 'local') {
      await this.localBackend.addMemory(userId, content, write);
      return tService('memory_runtime.local_saved');
    }

    if (backend === 'mem0') {
      await this.mem0Backend.addMemory(userId, content, write);
      await this.localBackend.addMemory(userId, content, write);
      return tService('memory_runtime.mem0_saved');
    }

    await this.localBackend.addMemory(userId, content, write);

    if (await this.mem0Backend.isAvailable()) {
      try {
        await this.mem0Backend.addMemory(userId, content, write);
        return tService('memory_runtime.auto_synced');
      } catch (error: unknown) {
        logger.warn('[Memory Runtime] operation failed', error);
        return tService('memory_runtime.auto_local_only');
      }
    }

    return tService('memory_runtime.local_saved');
  }

  /** Phase 6 — structured write via local (and optional mem0 sync in auto). */
  public async addMemoryRecord(
    userId: string,
    content: string,
    options: MemoryAddOptions = {},
  ): Promise<MemoryRecord> {
    const backend = options.backend || 'auto';
    const write = options.write;

    if (backend === 'mem0') {
      const remote = await this.mem0V2.addMemoryRecord(userId, content, write);
      await this.localV2.addMemoryRecord(userId, content, write);
      return remote;
    }

    const local = await this.localV2.addMemoryRecord(userId, content, write);
    if (backend === 'local') return local;

    if (await this.mem0Backend.isAvailable()) {
      try {
        await this.mem0V2.addMemoryRecord(userId, content, write);
      } catch (error: unknown) {
        logger.warn('[Memory Runtime] v2 remote sync failed', error);
      }
    }
    return local;
  }

  public async searchMemory(
    userId: string,
    query: string,
    options: MemorySearchOptions = {},
  ): Promise<string[]> {
    const backend = options.backend || 'auto';
    const queryOptions: MemoryQueryOptions = {
      limit: options.limit || 5,
      filter: options.filter,
    };

    if (backend === 'local') {
      return this.localBackend.searchMemory(userId, query, queryOptions);
    }

    if (backend === 'mem0') {
      return this.mem0Backend.searchMemory(userId, query, queryOptions);
    }

    const localResults = await this.localBackend.searchMemory(userId, query, queryOptions);
    if (!(await this.mem0Backend.isAvailable())) {
      return localResults;
    }

    try {
      const remoteResults = await this.mem0Backend.searchMemory(userId, query, queryOptions);
      return Array.from(new Set([...localResults, ...remoteResults])).slice(
        0,
        resolveMemoryQueryLimitSafe(options.limit || 5),
      );
    } catch (error: unknown) {
      logger.warn('[Memory Runtime] search failed', error);
      return localResults;
    }
  }

  /** Phase 6 — structured search with filters. */
  public async searchMemoryRecords(
    userId: string,
    query: string,
    options: MemorySearchOptions = {},
  ): Promise<MemoryHit[]> {
    const backend = options.backend || 'auto';
    const queryOptions = {
      limit: options.limit || 5,
      filter: options.filter,
    };

    if (backend === 'local') {
      return this.localV2.searchMemoryRecords(userId, query, queryOptions);
    }
    if (backend === 'mem0') {
      return this.mem0V2.searchMemoryRecords(userId, query, queryOptions);
    }

    const localHits = await this.localV2.searchMemoryRecords(userId, query, queryOptions);
    if (!(await this.mem0Backend.isAvailable())) {
      return localHits;
    }
    try {
      const remoteHits = await this.mem0V2.searchMemoryRecords(userId, query, queryOptions);
      const seen = new Set(localHits.map((h) => h.content));
      const merged = [...localHits];
      for (const hit of remoteHits) {
        if (seen.has(hit.content)) continue;
        seen.add(hit.content);
        merged.push(hit);
      }
      return merged.slice(0, resolveMemoryQueryLimitSafe(options.limit || 5));
    } catch (error: unknown) {
      logger.warn('[Memory Runtime] v2 search failed', error);
      return localHits;
    }
  }

  public async deleteMemory(
    userId: string,
    idOrKey: string,
    options: MemoryDeleteOptions & { backend?: 'local' | 'mem0' | 'auto' } = {},
  ): Promise<boolean> {
    const backend = options.backend || 'local';
    if (backend === 'mem0') {
      return this.mem0V2.deleteMemory(userId, idOrKey, options);
    }
    return this.localV2.deleteMemory(userId, idOrKey, options);
  }

  public async restoreMemory(
    userId: string,
    idOrKey: string,
    options: { backend?: 'local' | 'mem0' | 'auto' } = {},
  ): Promise<boolean> {
    const backend = options.backend || 'local';
    if (backend === 'mem0') {
      return this.mem0V2.restoreMemory(userId, idOrKey);
    }
    return this.localV2.restoreMemory(userId, idOrKey);
  }

  public async listMemoryRecords(
    userId: string,
    options: MemorySearchOptions = {},
  ): Promise<MemoryRecord[]> {
    return this.localV2.listMemoryRecords(userId, {
      limit: options.limit,
      filter: options.filter,
    });
  }

  public async isBackendAvailable(name: 'local' | 'mem0'): Promise<boolean> {
    if (name === 'local') {
      return this.localBackend.isAvailable();
    }

    return this.mem0Backend.isAvailable();
  }

  public getLocalBackendV2(): IMemoryBackendV2 {
    return this.localV2;
  }

  public getMem0BackendV2(): IMemoryBackendV2 {
    return this.mem0V2;
  }

  public async getMemoryContext(userId: string, currentMessage = ''): Promise<string> {
    return this.localBackend.getMemoryService().getMemoryContext(userId, currentMessage);
  }

  public async autoExtract(userId: string, userMessage: string, botResponse: string): Promise<void> {
    await this.localBackend.getMemoryService().autoExtract(userId, userMessage, botResponse);
  }

  public async remember(userId: string, key: string, value: string, category = 'general'): Promise<void> {
    await this.localBackend.getMemoryService().remember(userId, key, value, category);
  }

  public async recall(userId: string, key: string): Promise<string | null> {
    return this.localBackend.getMemoryService().recall(userId, key);
  }

  public async listAll(userId: string): Promise<MemoryEntry[]> {
    return this.localBackend.getMemoryService().listAll(userId);
  }

  public async listRelevant(userId: string, query: string, limit = 8): Promise<MemoryEntry[]> {
    return this.localBackend.getMemoryService().listRelevant(userId, query, limit);
  }

  public async listHistory(userId: string, limit = 50): Promise<MemoryEntry[]> {
    return this.localBackend.getMemoryService().listHistory(userId, limit);
  }

  public async listHistoricalRelevant(userId: string, query: string, limit = 8): Promise<MemoryEntry[]> {
    return this.localBackend.getMemoryService().listHistoricalRelevant(userId, query, limit);
  }

  public async forget(userId: string, key: string): Promise<boolean> {
    return this.localBackend.getMemoryService().forget(userId, key);
  }

  public getLocalMemoryService(): MemoryService {
    return this.localBackend.getMemoryService();
  }
}

function resolveMemoryQueryLimitSafe(limit: number): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(Math.floor(n), 100);
}

// re-export for callers that only import runtime
export type { MemoryQueryOptions, MemoryWriteOptions, MemoryRecord, MemoryHit };
export { normalizeMemoryQueryOptions };
