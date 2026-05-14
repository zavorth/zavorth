import { MemoryRuntimeService } from './memory/MemoryRuntimeService.js';

/**
 * @deprecated Use MemoryRuntimeService.
 * Mantido por compatibilidade durante a migracao da fase de memoria.
 */
export class Mem0Service {
  constructor(private readonly memoryRuntime: MemoryRuntimeService = new MemoryRuntimeService()) {}

  public async addMemory(userId: string, content: string): Promise<string> {
    return this.memoryRuntime.addMemory(userId, content, { backend: 'auto' });
  }

  public async searchMemory(userId: string, query: string): Promise<string> {
    const results = await this.memoryRuntime.searchMemory(userId, query, {
      backend: 'auto',
      limit: 5,
    });

    if (results.length === 0) {
      return '[MemoryRuntime] Nenhuma memoria associada a esta query.';
    }

    return results.map((entry) => `- ${entry}`).join('\n');
  }
}
