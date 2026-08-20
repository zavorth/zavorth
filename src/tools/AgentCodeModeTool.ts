import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  ToolRuntimeCodeModeEngine,
} from '../domain/execution/infrastructure/ToolRuntimeCodeModeEngine.js';

export class AgentCodeModeTool extends BaseTool {
  public readonly name = 'agent_code_mode';
  public readonly description =
    'Executes a JavaScript pipeline in a secure sandbox with direct access to an injected `tools` API ' +
    '(e.g. `await tools.readFile(path)`, `await tools.writeFile(path, content)`, `await tools.call(name, args)`). ' +
    'Allows complex multi-tool workflows, loops, and data aggregation in a single turn.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute. Can use async/await and call `tools.*`.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default: 15000).',
      },
    },
    required: ['script'],
  };

  private readonly engine: ToolRuntimeCodeModeEngine;

  constructor(engine = new ToolRuntimeCodeModeEngine()) {
    super();
    this.engine = engine;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const script = String(args.script || '').trim();
    if (!script) {
      return JSON.stringify({ error: 'script parameter is required.' });
    }

    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 15000;
    const result = await this.engine.executeScript({
      script,
      timeoutMs,
    });

    return JSON.stringify(result, null, 2);
  }
}
