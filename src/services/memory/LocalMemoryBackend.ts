import { MemoryService } from '../MemoryService.js';
import type { IMemoryBackend } from './IMemoryBackend.js';

export class LocalMemoryBackend implements IMemoryBackend {
  public readonly name = 'local';

  constructor(private readonly memoryService: MemoryService = new MemoryService()) {}

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async addMemory(userId: string, content: string): Promise<void> {
    await this.memoryService.remember(
      userId,
      `fato_${Date.now()}`,
      String(content || '').trim(),
      'agente_extraido',
    );
  }

  public async searchMemory(userId: string, query: string, limit = 5): Promise<string[]> {
    const entries = await this.memoryService.listRelevant(userId, query, limit);
    return entries.map((entry) => `[${entry.category}] ${entry.value}`);
  }

  public getMemoryService(): MemoryService {
    return this.memoryService;
  }
}
