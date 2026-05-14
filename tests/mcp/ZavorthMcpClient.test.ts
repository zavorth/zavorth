const listToolsMock = jest.fn();
const connectMock = jest.fn(async () => undefined);
const closeMock = jest.fn(async () => undefined);
const callToolMock = jest.fn();

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: connectMock,
    listTools: listToolsMock,
    callTool: callToolMock,
    close: closeMock,
  })),
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation((config: any) => ({ config })),
}));

import { ZavorthMcpClient, type McpServerRegistration } from '../../src/mcp/ZavorthMcpClient.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('ZavorthMcpClient', () => {
  beforeEach(() => {
    listToolsMock.mockReset();
    connectMock.mockClear();
    closeMock.mockClear();
    callToolMock.mockReset();
    (StdioClientTransport as jest.Mock).mockClear();
  });

  it('connects enabled servers, caches discovered tools and invokes them through the owning client', async () => {
    listToolsMock.mockResolvedValue({
      tools: [
        {
          name: 'browser_navigate',
          description: 'Navigate browser',
          inputSchema: { type: 'object' },
        },
      ],
    });
    callToolMock.mockResolvedValue({
      content: [{ type: 'text', text: 'navigated' }],
      isError: false,
    });

    const registrations: McpServerRegistration[] = [
      {
        id: 'browser',
        label: 'Browser MCP',
        command: 'node',
        args: ['browser.js'],
        enabled: true,
      },
      {
        id: 'disabled',
        label: 'Disabled MCP',
        command: 'node',
        args: ['disabled.js'],
        enabled: false,
      },
    ];
    const client = new ZavorthMcpClient(registrations);

    await client.connectAll();
    const tools = client.listAllTools();
    const result = await client.callTool('browser_navigate', { url: 'https://example.com' });
    const snapshot = client.getSnapshot();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(tools).toEqual([
      expect.objectContaining({
        serverId: 'browser',
        name: 'browser_navigate',
      }),
    ]);
    expect(result).toEqual({
      serverId: 'browser',
      toolName: 'browser_navigate',
      content: [{ type: 'text', text: 'navigated' }],
      isError: false,
    });
    expect(snapshot).toEqual({
      connectedServers: 1,
      totalTools: 1,
      servers: [
        {
          id: 'browser',
          label: 'Browser MCP',
          connected: true,
          toolCount: 1,
        },
      ],
    });

    await client.disconnectAll();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('does not inherit host provider secrets into external MCP server env', async () => {
    const previousOpenAi = process.env.OPENAI_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousTelegram = process.env.TELEGRAM_BOT_TOKEN;
    process.env.OPENAI_API_KEY = 'host-openai-secret';
    process.env.GEMINI_API_KEY = 'host-gemini-secret';
    process.env.TELEGRAM_BOT_TOKEN = 'host-telegram-secret';
    listToolsMock.mockResolvedValue({ tools: [] });

    try {
      const client = new ZavorthMcpClient([
        {
          id: 'browser',
          label: 'Browser MCP',
          command: 'node',
          args: ['browser.js'],
          env: {
            ZAVORTH_MCP_FLAG: '1',
          },
          allowedEnv: ['GEMINI_API_KEY'],
          enabled: true,
        },
      ]);

      await client.connectAll();

      expect(StdioClientTransport).toHaveBeenCalledWith(expect.objectContaining({
        env: expect.objectContaining({
          ZAVORTH_MCP_FLAG: '1',
          GEMINI_API_KEY: 'host-gemini-secret',
        }),
      }));
      const transportConfig = (StdioClientTransport as jest.Mock).mock.calls[0][0];
      expect(transportConfig.env.OPENAI_API_KEY).toBeUndefined();
      expect(transportConfig.env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    } finally {
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAi;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousTelegram === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previousTelegram;
    }
  });

  it('returns honest errors for missing tools and failed tool calls', async () => {
    listToolsMock.mockResolvedValue({
      tools: [
        {
          name: 'browser_navigate',
          description: 'Navigate browser',
          inputSchema: { type: 'object' },
        },
      ],
    });
    callToolMock.mockRejectedValue(new Error('upstream failed'));

    const client = new ZavorthMcpClient([
      {
        id: 'browser',
        label: 'Browser MCP',
        command: 'node',
        args: ['browser.js'],
        enabled: true,
      },
    ]);

    await client.connectAll();
    const missing = await client.callTool('unknown_tool', {});
    const failed = await client.callTool('browser_navigate', { url: 'https://example.com' });

    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain('unknown_tool');
    expect(failed.isError).toBe(true);
    expect(failed.content[0]?.text).toContain('upstream failed');
  });
});
