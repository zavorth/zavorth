import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  EchoHandsService,
  type EchoHandsRequest,
} from '../services/ToolRuntimeHandsService.js';

export class ToolRuntimeHandsTool extends BaseTool {
  public readonly name = 'echo_hands';
  public readonly description =
    'Runs supervised declarative Echo Hands actions: open allowlisted apps, search in the browser, open approved URLs, and run protocols.';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['open_app', 'browser_search', 'open_url', 'protocol_run'],
        description: 'Declarative Echo Hands action.',
      },
      args: {
        type: 'object',
        description: 'Action arguments. Example: { "app": "notepad" } or { "engine": "youtube", "query": "ai" }.',
      },
      risk: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Agent-declared risk; the service always recalculates the real minimum risk.',
      },
      requestId: {
        type: 'string',
        description: 'Optional ID for auditing.',
      },
      trusted: {
        type: 'boolean',
        description: 'Only true when runtime/approval already authorized medium actions.',
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

export const EchoHandsTool = ToolRuntimeHandsTool;

