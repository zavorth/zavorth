import { BaseTool } from './BaseTool.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { MemoryRuntimeService } from '../services/memory/MemoryRuntimeService.js';
import { logger } from '../logger.js';

export class Mem0Tool extends BaseTool {
  public readonly name = 'semantic_memory';
  public readonly description =
    'Queries or writes durable user memories. local memory is canonical; when the Mem0 backend is available, it is used as optional enrichment.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'add'],
        description: 'Memory action: search existing facts or save a new fact.',
      },
      content: {
        type: 'string',
        description: 'Query to search or fact to save.',
      },
      user_id: {
        type: 'string',
        description: 'User isolation context.',
      },
      backend: {
        type: 'string',
        enum: ['auto', 'local', 'mem0'],
        description: 'Desired backend. "auto" uses local memory as the base and Mem0 only when available.',
      },
    },
    required: ['action', 'content'],
  };

  constructor(private readonly memoryRuntime: MemoryRuntimeService = new MemoryRuntimeService()) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = args.action as 'search' | 'add';
    const content = String(args.content || '');
    const userId = String(args.user_id || '1');
    const backend = String(args.backend || 'auto') as 'auto' | 'local' | 'mem0';

    try {
      if (action === 'add') {
        return this.memoryRuntime.addMemory(userId, content, { backend });
      }

      const results = await this.memoryRuntime.searchMemory(userId, content, { backend, limit: 5 });
      if (results.length === 0) {
        return '[MemoryRuntime] No memories found for this query.';
      }

      return results.map((entry) => `- ${entry}`).join('\n');
    } catch (error: unknown) {logger.warn('[Mem0] search failed', error); return ''; }
  }
}
