import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { BaseTool } from './BaseTool.js';

const DEFAULT_PARAMETERS: ToolDefinition['parameters'] = {
  type: 'object',
  properties: {
    input: {
      type: 'object',
      description: 'Capability input payload',
    },
  },
};

export class PluginCapabilityTool extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolDefinition['parameters'];
  private readonly run: (args: Record<string, unknown>) => Promise<unknown>;

  constructor(options: {
    name: string;
    description: string;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
    parameters?: ToolDefinition['parameters'];
  }) {
    super();
    this.name = String(options.name || '').trim();
    this.description = String(options.description || '').trim() || this.name;
    this.parameters = options.parameters || DEFAULT_PARAMETERS;
    this.run = options.execute;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const result = await this.run(args || {});
    if (typeof result === 'string') {
      return result;
    }
    if (result === undefined) {
      return '';
    }
    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }
}
