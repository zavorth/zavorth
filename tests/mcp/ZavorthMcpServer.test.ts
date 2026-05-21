const registeredHandlers = new Map<any, any>();
const connectMock = jest.fn(async () => undefined);
const closeMock = jest.fn();
const getToolDefinitionsMock = jest.fn(() => [
  {
    name: 'browser_navigate',
    description: 'Navigate browser',
    inputSchema: { type: 'object' },
  },
  {
    name: 'evaluate_js',
    description: 'Evaluate JavaScript',
    inputSchema: { type: 'object' },
  },
]);
const handleToolCallMock = jest.fn(async () => ({
  content: [{ type: 'text', text: 'ok' }],
  isError: false,
}));
const shutdownMock = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: (schema: any, handler: any) => {
      registeredHandlers.set(schema, handler);
    },
    connect: connectMock,
    close: closeMock,
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({ kind: 'stdio' })),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'CALL_TOOL_SCHEMA',
  ListToolsRequestSchema: 'LIST_TOOLS_SCHEMA',
}));

jest.mock('../../src/mcp/tools/AutomaticBrowserTool.js', () => ({
  AutomaticBrowserTool: jest.fn().mockImplementation(() => ({
    getToolDefinitions: getToolDefinitionsMock,
    handleToolCall: handleToolCallMock,
    shutdown: shutdownMock,
  })),
}));

import { ZavorthMcpServer } from '../../src/mcp/ZavorthMcpServer.js';
import { McpToolPolicy } from '../../src/mcp/McpToolPolicy.js';

describe('ZavorthMcpServer', () => {
  beforeEach(() => {
    registeredHandlers.clear();
    connectMock.mockClear();
    closeMock.mockClear();
    getToolDefinitionsMock.mockClear();
    handleToolCallMock.mockClear();
    shutdownMock.mockClear();
  });

  it('registers list/call handlers and delegates tool execution to AutomaticBrowserTool', async () => {
    const server = new ZavorthMcpServer();

    await server.start();

    const listHandler = registeredHandlers.get('LIST_TOOLS_SCHEMA');
    const callHandler = registeredHandlers.get('CALL_TOOL_SCHEMA');
    const listResult = await listHandler();
    const callResult = await callHandler({
      params: {
        name: 'browser_navigate',
        arguments: { url: 'https://example.com' },
      },
    });

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(getToolDefinitionsMock).toHaveBeenCalledTimes(2);
    expect(listResult).toEqual({
      tools: expect.arrayContaining([
        expect.objectContaining({
          name: 'browser_navigate',
        }),
      ]),
    });
    expect(handleToolCallMock).toHaveBeenCalledWith('browser_navigate', { url: 'https://example.com' });
    expect(callResult).toEqual({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    server.shutdown();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('hides and blocks dangerous tools in the safe MCP profile', async () => {
    const dangerousExecute = jest.fn(async () => 'shell output');
    const registry = {
      getToolDefinitions: () => [
        {
          name: 'remote_shell',
          description: 'Run shell',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'get_datetime',
          description: 'Get time',
          parameters: { type: 'object', properties: {} },
        },
      ],
      getTool: (name: string) => name === 'remote_shell'
        ? { execute: dangerousExecute }
        : undefined,
    };
    const server = new ZavorthMcpServer(registry as any, {
      toolPolicy: new McpToolPolicy({ profile: 'safe' }),
    });

    await server.start();

    const listHandler = registeredHandlers.get('LIST_TOOLS_SCHEMA');
    const callHandler = registeredHandlers.get('CALL_TOOL_SCHEMA');
    const listResult = await listHandler();
    const callResult = await callHandler({
      params: {
        name: 'remote_shell',
        arguments: { command: 'whoami' },
      },
    });

    expect(listResult.tools.map((tool: any) => tool.name)).toContain('get_datetime');
    expect(listResult.tools.map((tool: any) => tool.name)).not.toContain('remote_shell');
    expect(listResult.tools.map((tool: any) => tool.name)).not.toContain('evaluate_js');
    expect(dangerousExecute).not.toHaveBeenCalled();
    expect(callResult.isError).toBe(true);
    expect(callResult.content[0].text).toContain('bloqueada');

    server.shutdown();
  });

  it('delegates registry tools through the central ToolExecutor instead of raw tool.execute', async () => {
    const rawExecute = jest.fn(async () => 'raw result');
    const executor = {
      executeTool: jest.fn(async () => 'governed datetime'),
    };
    const registry = {
      getToolDefinitions: () => [
        {
          name: 'get_datetime',
          description: 'Get time',
          parameters: { type: 'object', properties: {} },
        },
      ],
      getTool: (name: string) => name === 'get_datetime'
        ? { execute: rawExecute }
        : undefined,
    };
    const server = new ZavorthMcpServer(registry as any, {
      toolPolicy: new McpToolPolicy({ profile: 'safe' }),
      toolExecutor: executor,
    });

    await server.start();

    const callHandler = registeredHandlers.get('CALL_TOOL_SCHEMA');
    const callResult = await callHandler({
      params: {
        name: 'get_datetime',
        arguments: { timezone: 'UTC' },
      },
    });

    expect(rawExecute).not.toHaveBeenCalled();
    expect(executor.executeTool).toHaveBeenCalledWith('get_datetime', { timezone: 'UTC' });
    expect(callResult).toEqual({
      content: [{ type: 'text', text: 'governed datetime' }],
      isError: false,
    });

    server.shutdown();
  });
});
