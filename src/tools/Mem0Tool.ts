import { BaseTool } from './BaseTool.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { MemoryRuntimeService } from '../services/memory/MemoryRuntimeService.js';

export class Mem0Tool extends BaseTool {
  public readonly name = 'semantic_memory';
  public readonly description =
    'Consulta ou grava memorias duradouras do usuario. A memoria local e canonica; quando o backend Mem0 estiver disponivel, ele entra como enriquecimento opcional.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'add'],
        description: 'Acao na memoria: buscar fatos existentes ou salvar um novo fato.',
      },
      content: {
        type: 'string',
        description: 'Consulta para busca ou fato a ser salvo.',
      },
      user_id: {
        type: 'string',
        description: 'Contexto de isolamento do usuario.',
      },
      backend: {
        type: 'string',
        enum: ['auto', 'local', 'mem0'],
        description: 'Backend desejado. "auto" usa memoria local como base e Mem0 apenas quando estiver disponivel.',
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
        return '[MemoryRuntime] Nenhuma memoria encontrada para esta consulta.';
      }

      return results.map((entry) => `- ${entry}`).join('\n');
    } catch (error: any) {
      return `MEMORY FAILURE: ${error.message}`;
    }
  }
}
