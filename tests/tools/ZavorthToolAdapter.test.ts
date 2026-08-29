import { ZavorthToolAdapter } from '../../src/tools/ZavorthToolAdapter.js';
import { ConnectionManageTool } from '../../src/tool-runtime/tools/connection/ConnectionManageTool.js';
import type { IZavorthTool, ToolExecutionResult } from '../../src/tool-runtime/types/IZavorthTool.js';
import { z } from 'zod';

describe('ZavorthToolAdapter', () => {
  it('correctly adapts an IZavorthTool into a BaseTool', () => {
    const connectionTool = new ConnectionManageTool();
    const adapter = new ZavorthToolAdapter(connectionTool);

    expect(adapter.name).toBe('connection_manage');
    expect(adapter.description).toBe(connectionTool.description);
    expect(adapter.parameters.type).toBe('object');
    expect(adapter.parameters.properties).toHaveProperty('action');
    expect(adapter.parameters.properties).toHaveProperty('target');
    expect(adapter.parameters.properties).toHaveProperty('credentials');
    expect(adapter.parameters.properties).toHaveProperty('userId');
  });

  it('executes the underlying tool and formats success output with JSON data', async () => {
    const mockTool: IZavorthTool = {
      name: 'mock_custom_tool',
      description: 'Mock custom tool for testing',
      schema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async (_params: Record<string, unknown>): Promise<ToolExecutionResult> => ({
        success: true,
        message: 'Query completed',
        data: { count: 3, items: ['a', 'b', 'c'] },
      }),
    };

    const adapter = new ZavorthToolAdapter(mockTool);
    const result = await adapter.execute({ query: 'test' });

    expect(result).toContain('Query completed');
    expect(result).toContain('"count":3');
  });

  it('handles and formats errors gracefully without crashing', async () => {
    const failingTool: IZavorthTool = {
      name: 'failing_tool',
      description: 'Fails intentionally',
      schema: z.object({}),
      execute: async (): Promise<ToolExecutionResult> => {
        throw new Error('Explosive failure');
      },
    };

    const adapter = new ZavorthToolAdapter(failingTool);
    const result = await adapter.execute({});

    expect(result).toContain("Tool 'failing_tool' failed: Explosive failure");
  });
});
