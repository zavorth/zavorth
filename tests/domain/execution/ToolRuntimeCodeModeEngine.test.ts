import { ToolRuntimeCodeModeEngine } from '../../../src/domain/execution/infrastructure/ToolRuntimeCodeModeEngine.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { BaseTool } from '../../../src/tools/BaseTool.js';
import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';

class MockCalculatorTool extends BaseTool {
  public readonly name = 'calculator';
  public readonly description = 'Adds two numbers';
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const a = Number(args.a || 0);
    const b = Number(args.b || 0);
    return JSON.stringify({ sum: a + b });
  }
}

describe('ToolRuntimeCodeModeEngine', () => {
  let engine: ToolRuntimeCodeModeEngine;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(new MockCalculatorTool());
    engine = new ToolRuntimeCodeModeEngine(registry);
  });

  it('executes isolated JavaScript calculations and captures logs', async () => {
    const script = `
      console.log("Starting calculation");
      const a = 10;
      const b = 25;
      return a * b;
    `;

    const result = await engine.executeScript({ script, toolRegistry: registry });

    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(250);
    expect(result.logs).toContain('Starting calculation');
  });

  it('calls registered tools seamlessly from inside the JS script pipeline', async () => {
    const script = `
      const res1 = await tools.call("calculator", { a: 15, b: 25 });
      const res2 = await tools.call("calculator", { a: res1.sum, b: 60 });
      return res2.sum;
    `;

    const result = await engine.executeScript({ script, toolRegistry: registry });

    expect(result.success).toBe(true);
    expect(result.executedToolCallsCount).toBe(2);
    expect(result.returnValue).toBe(100);
  });

  it('prevents breakout and safely intercepts errors within timeout', async () => {
    const dangerousScript = `
      return process.env;
    `;

    const result = await engine.executeScript({ script: dangerousScript, toolRegistry: registry });
    expect(result.success).toBe(false);
    expect(result.error).toContain('process is not defined');
  });
});
