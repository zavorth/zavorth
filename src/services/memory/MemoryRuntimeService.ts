import { MemoryService, type MemoryEntry } from '../MemoryService.js';
import type { IMemoryBackend } from './IMemoryBackend.js';
import { LocalMemoryBackend } from './LocalMemoryBackend.js';
import { Mem0MemoryBackend } from './Mem0MemoryBackend.js';
import { logger } from '../../logger.js';

type MemoryAddOptions = {
  backend?: 'auto' | 'local' | 'mem0';
};

type MemorySearchOptions = {
  backend?: 'auto' | 'local' | 'mem0';
  limit?: number;
};

export class MemoryRuntimeService {
  private readonly localBackend: LocalMemoryBackend;
  private readonly mem0Backend: IMemoryBackend;

  constructor(
    localBackend: LocalMemoryBackend = new LocalMemoryBackend(),
    mem0Backend: IMemoryBackend = new Mem0MemoryBackend(),
  ) {
    this.localBackend = localBackend;
    this.mem0Backend = mem0Backend;
  }

  public async addMemory(
    userId: string,
    content: string,
    options: MemoryAddOptions = {},
  ): Promise<string> {
    const backend = options.backend || 'auto';

    if (backend === 'local') {
      await this.localBackend.addMemory(userId, content);
      return '[LocalMemory] Fato guardado na memoria local com sucesso.';
    }

    if (backend === 'mem0') {
      await this.mem0Backend.addMemory(userId, content);
      await this.localBackend.addMemory(userId, content);
      return '[Mem0] Fato guardado no backend remoto e sincronizado localmente.';
    }

    await this.localBackend.addMemory(userId, content);

    if (await this.mem0Backend.isAvailable()) {
      try {
        await this.mem0Backend.addMemory(userId, content);
        return '[MemoryRuntime] Fato guardado localmente e sincronizado com Mem0.';
      } catch (error: unknown) {logger.warn('[Memory Runtime] operation failed', error);
    return '[MemoryRuntime] Fato guardado localmente. Sincronizacao com Mem0 indisponivel nesta sessao.';
  }
    }

    return '[LocalMemory] Fato guardado na memoria local com sucesso.';
  }

  public async searchMemory(
    userId: string,
    query: string,
    options: MemorySearchOptions = {},
  ): Promise<string[]> {
    const backend = options.backend || 'auto';
    const limit = options.limit || 5;

    if (backend === 'local') {
      return this.localBackend.searchMemory(userId, query, limit);
    }

    if (backend === 'mem0') {
      return this.mem0Backend.searchMemory(userId, query, limit);
    }

    const localResults = await this.localBackend.searchMemory(userId, query, limit);
    if (!(await this.mem0Backend.isAvailable())) {
      return localResults;
    }

    try {
      const remoteResults = await this.mem0Backend.searchMemory(userId, query, limit);
      return Array.from(new Set([...localResults, ...remoteResults])).slice(0, limit);
    } catch (error: unknown) {logger.warn('[Memory Runtime] search failed', error); return localResults; }
  }

  public async isBackendAvailable(name: 'local' | 'mem0'): Promise<boolean> {
    if (name === 'local') {
      return this.localBackend.isAvailable();
    }

    return this.mem0Backend.isAvailable();
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
