import { describe, it, expect, beforeEach } from '@jest/globals';
import { McpPluginToolsServer } from '../../src/mcp/McpPluginToolsServer.js';

describe('McpPluginToolsServer', () => {
  let server: McpPluginToolsServer;

  beforeEach(() => {
    // Create a mock tool registry
    const mockRegistry = {
      getAllTools: () => [
        { name: 'test_tool', description: 'A test tool', parameters: { type: 'object' }, execute: async () => 'result' },
      ],
      getTool: (name: string) => {
        if (name === 'test_tool') {
          return { name: 'test_tool', description: 'A test tool', parameters: { type: 'object' }, execute: async () => 'result' };
        }
        return null;
      },
    } as any;

    server = new McpPluginToolsServer(mockRegistry);
  });

  it('lists tools', () => {
    const tools = server.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('calls tool', async () => {
    const result = await server.callTool('test_tool', {});
    expect(result.content[0].text).toBe('result');
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
