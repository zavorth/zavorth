import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  EchoHandsService,
  type EchoHandsRequest,
} from '../services/EchoHandsService.js';

export class EchoHandsTool extends BaseTool {
  public readonly name = 'echo_hands';
  public readonly description =
    'Executa ações declarativas e supervisionadas do Echo Hands: abrir apps allowlisted, buscar no navegador, abrir URLs aprovadas e rodar protocolos.';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['open_app', 'browser_search', 'open_url', 'protocol_run'],
        description: 'Ação declarativa do Echo Hands.',
      },
      args: {
        type: 'object',
        description: 'Argumentos da ação. Ex: { "app": "notepad" } ou { "engine": "youtube", "query": "ia" }.',
      },
      risk: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Risco declarado pelo agente; o serviço sempre recalcula o risco mínimo real.',
      },
      requestId: {
        type: 'string',
        description: 'ID opcional para auditoria.',
      },
      trusted: {
        type: 'boolean',
        description: 'Somente true quando o runtime/approval já autorizou ações medium.',
      },
    },
    required: ['action'],
  };

  constructor(private readonly service: EchoHandsService = new EchoHandsService()) {
    super();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const result = await this.service.execute(args as EchoHandsRequest);
    return JSON.stringify(result, null, 2);
  }
}
