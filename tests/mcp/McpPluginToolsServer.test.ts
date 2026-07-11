import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { McpPluginToolsServer } from '../../src/mcp/McpPluginToolsServer.js';

describe('McpPluginToolsServer', () => {
  let server: McpPluginToolsServer;
  let executeTool: jest.MockedFunction<(name: string, args: Record<string, unknown>) => Promise<string>>;
  let rawExecute: jest.MockedFunction<(args: Record<string, unknown>) => Promise<string>>;

  beforeEach(() => {
    rawExecute = jest.fn(async () => 'raw result');
    executeTool = jest.fn(async () => 'result');

    const mockRegistry = {
      getAllTools: () => [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object' },
          execute: rawExecute,
        },
      ],
      getTool: (name: string) => {
        if (name === 'test_tool') {
          return {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object' },
            execute: rawExecute,
          };
        }
        return null;
      },
    } as any;

    server = new McpPluginToolsServer(mockRegistry, {
      toolExecutor: { executeTool },
    });
  });

  it('lists tools', () => {
    const tools = server.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('calls tool through the central ToolExecutor instead of raw tool.execute', async () => {
    const result = await server.callTool('test_tool', { foo: 'bar' });
    expect(result.content[0].text).toBe('result');
    expect(executeTool).toHaveBeenCalledWith('test_tool', { foo: 'bar' });
    expect(rawExecute).not.toHaveBeenCalled();
  });

  it('requires a configured ToolExecutor for tool calls', async () => {
    const mockRegistry = {
      getAllTools: () => [],
      getTool: () => ({
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object' },
        execute: rawExecute,
      }),
    } as any;
    const unconfigured = new McpPluginToolsServer(mockRegistry);
    const result = await unconfigured.callTool('test_tool', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ToolExecutor');
    expect(rawExecute).not.toHaveBeenCalled();
  });

  it('handles unknown tool', async () => {
    const result = await server.callTool('unknown_tool', {});
    expect(result.isError).toBe(true);
  });

  it('handles initialize request', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    });
    expect(response.result).toBeDefined();
  });

  it('handles tools/list request', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    expect((response.result as any).tools).toBeDefined();
  });

  it('handles tools/call request', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'test_tool', arguments: {} },
    });
    expect(response.result).toBeDefined();
    expect(executeTool).toHaveBeenCalledWith('test_tool', {});
    expect(rawExecute).not.toHaveBeenCalled();
  });

  it('handles unknown method', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'unknown/method',
    });
    expect(response.error).toBeDefined();
  });
});
